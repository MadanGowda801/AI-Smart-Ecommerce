-- ==============================================================================
-- Migration: 20261002220000_notification-deeplinks-patch.sql
-- Description: Patch admin_update_order_status to use send_notification()
--              so notifications include deep-link data (link_page, link_params).
--              Also patches mark_order_paid/failed to add deep-linked notifications.
-- ==============================================================================

-- Patch admin_update_order_status to use send_notification with deep-link
CREATE OR REPLACE FUNCTION public.admin_update_order_status(
  p_order_id   UUID,
  p_new_status TEXT,
  p_location   TEXT DEFAULT NULL,
  p_notes      TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_order       public.orders%ROWTYPE;
  v_customer_id UUID;
  v_title       TEXT;
  v_description TEXT;
  v_notif_msg   TEXT;
  v_order_ref   TEXT;
BEGIN
  IF NOT public.is_admin((SELECT auth.uid())) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthorized');
  END IF;

  IF p_new_status NOT IN ('placed','payment_confirmed','processing','shipped','out_for_delivery','delivered','cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'order_not_found');
  END IF;

  v_order_ref   := UPPER(SUBSTRING(p_order_id::TEXT, 1, 8));
  v_customer_id := v_order.user_id;

  CASE p_new_status
    WHEN 'placed' THEN
      v_title       := 'Order Placed';
      v_description := COALESCE(p_notes, 'Your order has been received and is being prepared.');
      v_notif_msg   := format('Order #%s received. We''ll keep you updated as it progresses.', v_order_ref);
    WHEN 'payment_confirmed' THEN
      v_title       := 'Payment Confirmed';
      v_description := COALESCE(p_notes, 'Payment received and verified. Order is queued for processing.');
      v_notif_msg   := format('Payment for Order #%s confirmed successfully.', v_order_ref);
    WHEN 'processing' THEN
      v_title       := 'Order Processing';
      v_description := COALESCE(p_notes, 'Your items are being picked, packed, and quality-checked.');
      v_notif_msg   := format('Order #%s is now being processed and packed at our fulfillment center.', v_order_ref);
    WHEN 'shipped' THEN
      v_title       := 'Order Shipped';
      v_description := COALESCE(p_notes, 'Your order has been dispatched. Track using your AWB number.');
      v_notif_msg   := format('Order #%s has been shipped! Your package is on its way.', v_order_ref);
    WHEN 'out_for_delivery' THEN
      v_title       := 'Out for Delivery';
      v_description := COALESCE(p_notes, 'Your order is out for delivery. Please be available at your address.');
      v_notif_msg   := format('Order #%s is out for delivery today! Expect it soon.', v_order_ref);
    WHEN 'delivered' THEN
      v_title       := 'Order Delivered';
      v_description := COALESCE(p_notes, 'Your order has been successfully delivered. Thank you for shopping with SmartShop!');
      v_notif_msg   := format('Order #%s delivered successfully! Enjoy your purchase.', v_order_ref);
    WHEN 'cancelled' THEN
      v_title       := 'Order Cancelled';
      v_description := COALESCE(p_notes, 'Your order has been cancelled. Any payment will be refunded within 5-7 business days.');
      v_notif_msg   := format('Order #%s has been cancelled. Refund (if applicable) in 5-7 business days.', v_order_ref);
    ELSE
      v_title       := initcap(replace(p_new_status, '_', ' '));
      v_description := COALESCE(p_notes, 'Order status updated.');
      v_notif_msg   := format('Your order #%s status updated to: %s.', v_order_ref, v_title);
  END CASE;

  UPDATE public.orders
  SET
    status       = p_new_status,
    order_status = p_new_status,
    updated_at   = NOW(),
    payment_confirmed_at = CASE WHEN p_new_status = 'payment_confirmed' THEN NOW() ELSE payment_confirmed_at END,
    processing_at        = CASE WHEN p_new_status = 'processing'        THEN NOW() ELSE processing_at        END,
    shipped_at           = CASE WHEN p_new_status = 'shipped'           THEN NOW() ELSE shipped_at           END,
    out_for_delivery_at  = CASE WHEN p_new_status = 'out_for_delivery'  THEN NOW() ELSE out_for_delivery_at  END,
    delivered_at         = CASE WHEN p_new_status = 'delivered'         THEN NOW() ELSE delivered_at         END,
    cancelled_at         = CASE WHEN p_new_status = 'cancelled'         THEN NOW() ELSE cancelled_at         END
  WHERE id = p_order_id;

  INSERT INTO public.order_timeline (order_id, status, title, description, location, updated_by)
  VALUES (p_order_id, p_new_status, v_title, v_description, p_location, (SELECT auth.uid()));

  IF v_customer_id IS NOT NULL THEN
    PERFORM public.send_notification(
      v_customer_id,
      v_title,
      v_notif_msg,
      'order',
      'order-details',
      jsonb_build_object('id', p_order_id::TEXT)
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', p_new_status, 'title', v_title);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_order_status(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- Patch mark_order_paid to also send a Payment Confirmed notification with deep-link
CREATE OR REPLACE FUNCTION public.mark_order_paid(
  p_order_id             UUID,
  p_razorpay_order_id    TEXT,
  p_razorpay_payment_id  TEXT,
  p_razorpay_signature   TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_order        public.orders%ROWTYPE;
  v_payment      public.payments%ROWTYPE;
  v_order_ref    TEXT;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'order_not_found');
  END IF;

  IF v_order.payment_status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_paid');
  END IF;

  v_order_ref := UPPER(SUBSTRING(p_order_id::TEXT, 1, 8));

  UPDATE public.orders
  SET payment_status = 'paid',
      status         = 'payment_confirmed',
      order_status   = 'payment_confirmed',
      payment_confirmed_at = NOW(),
      updated_at     = NOW()
  WHERE id = p_order_id;

  UPDATE public.payments
  SET payment_status      = 'paid',
      transaction_reference = p_razorpay_payment_id
  WHERE order_id = p_order_id;

  INSERT INTO public.payment_events (order_id, payment_id, event_type, raw_payload)
  VALUES (p_order_id, p_razorpay_payment_id, 'payment_captured',
          jsonb_build_object('razorpay_order_id', p_razorpay_order_id, 'razorpay_payment_id', p_razorpay_payment_id));

  INSERT INTO public.order_timeline (order_id, status, title, description)
  VALUES (p_order_id, 'payment_confirmed', 'Payment Confirmed', 'Payment received and verified. Your order is now being prepared.');

  IF v_order.user_id IS NOT NULL THEN
    PERFORM public.send_notification(
      v_order.user_id,
      'Payment Confirmed',
      format('Payment for Order #%s confirmed! Your order is now being prepared.', v_order_ref),
      'order',
      'order-details',
      jsonb_build_object('id', p_order_id::TEXT)
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'payment_id', p_razorpay_payment_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_order_paid(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_paid(UUID, TEXT, TEXT, TEXT) TO anon;

-- Patch mark_order_payment_failed to also send notification with deep-link
CREATE OR REPLACE FUNCTION public.mark_order_payment_failed(
  p_order_id          UUID,
  p_razorpay_order_id TEXT,
  p_error_code        TEXT DEFAULT NULL,
  p_error_description TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_order     public.orders%ROWTYPE;
  v_order_ref TEXT;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'order_not_found');
  END IF;

  v_order_ref := UPPER(SUBSTRING(p_order_id::TEXT, 1, 8));

  UPDATE public.orders
  SET payment_status = 'failed',
      updated_at     = NOW()
  WHERE id = p_order_id;

  UPDATE public.payments
  SET payment_status = 'failed'
  WHERE order_id = p_order_id;

  INSERT INTO public.payment_events (order_id, event_type, raw_payload)
  VALUES (p_order_id, 'payment_failed',
          jsonb_build_object('razorpay_order_id', p_razorpay_order_id, 'error_code', p_error_code, 'error_description', p_error_description));

  IF v_order.user_id IS NOT NULL THEN
    PERFORM public.send_notification(
      v_order.user_id,
      'Payment Failed',
      format('Payment for Order #%s could not be processed. You can retry from Order Details.', v_order_ref),
      'order',
      'order-details',
      jsonb_build_object('id', p_order_id::TEXT)
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'reason', 'payment_failed_recorded');
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_order_payment_failed(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_payment_failed(UUID, TEXT, TEXT, TEXT) TO anon;
