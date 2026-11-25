-- ==============================================================================
-- Migration: 20261002200000_order-tracking-timeline.sql
-- Description: Real order tracking with persistent timeline table.
--              Every status change creates an immutable timeline entry and sends
--              a customer notification. Customers cannot update order status.
-- ==============================================================================

-- 1. Ensure orders table has all required status timestamp columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processing_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipped_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS out_for_delivery_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at         TIMESTAMPTZ;

-- 2. Create order_timeline table (immutable append-only event log)
CREATE TABLE IF NOT EXISTS public.order_timeline (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status      TEXT        NOT NULL,
  title       TEXT        NOT NULL,
  description TEXT,
  location    TEXT,
  updated_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_timeline_order_id
  ON public.order_timeline(order_id);
CREATE INDEX IF NOT EXISTS idx_order_timeline_created_at
  ON public.order_timeline(created_at DESC);

-- 3. RLS on order_timeline
ALTER TABLE public.order_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_timeline_customer_select" ON public.order_timeline
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = order_id
        AND (user_id = (SELECT auth.uid()) OR public.is_admin((SELECT auth.uid())))
    )
  );

CREATE POLICY "order_timeline_admin_insert" ON public.order_timeline
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin((SELECT auth.uid())));

-- 4. Backfill: insert initial timeline entry for every order that has none
INSERT INTO public.order_timeline (order_id, status, title, description, created_at)
SELECT
  o.id,
  COALESCE(o.status, 'placed'),
  'Order Placed',
  'Your order has been received and is being prepared.',
  o.created_at
FROM public.orders o
WHERE NOT EXISTS (
  SELECT 1 FROM public.order_timeline t WHERE t.order_id = o.id
);

-- 5. admin_update_order_status: update status, log timeline, notify customer
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
      v_notif_msg   := format('Order #%s has been received. We''ll update you as it progresses.', v_order_ref);
    WHEN 'payment_confirmed' THEN
      v_title       := 'Payment Confirmed';
      v_description := COALESCE(p_notes, 'Payment received and verified. Order is queued for processing.');
      v_notif_msg   := format('Payment for Order #%s has been confirmed.', v_order_ref);
    WHEN 'processing' THEN
      v_title       := 'Order Processing';
      v_description := COALESCE(p_notes, 'Your items are being picked, packed, and quality-checked at our fulfillment center.');
      v_notif_msg   := format('Order #%s is now being processed and packed.', v_order_ref);
    WHEN 'shipped' THEN
      v_title       := 'Shipped';
      v_description := COALESCE(p_notes, 'Your order has been dispatched. Track using your AWB number.');
      v_notif_msg   := format('Order #%s has been shipped! Your package is on its way.', v_order_ref);
    WHEN 'out_for_delivery' THEN
      v_title       := 'Out for Delivery';
      v_description := COALESCE(p_notes, 'Your order is out for delivery. Please be available at your delivery address.');
      v_notif_msg   := format('Order #%s is out for delivery today! Expect it soon.', v_order_ref);
    WHEN 'delivered' THEN
      v_title       := 'Delivered';
      v_description := COALESCE(p_notes, 'Your order has been successfully delivered. Thank you for shopping with SmartShop!');
      v_notif_msg   := format('Order #%s has been delivered! Enjoy your purchase.', v_order_ref);
    WHEN 'cancelled' THEN
      v_title       := 'Order Cancelled';
      v_description := COALESCE(p_notes, 'Your order has been cancelled. Any payment will be refunded within 5-7 business days.');
      v_notif_msg   := format('Order #%s has been cancelled. If you paid, expect a refund in 5-7 business days.', v_order_ref);
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
    INSERT INTO public.notifications (user_id, title, message, type, is_read)
    VALUES (v_customer_id, v_title, v_notif_msg, 'order', false);
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', p_new_status, 'title', v_title);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_order_status(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- 6. admin_get_all_orders: fetch all orders with customer info (admin only)
CREATE OR REPLACE FUNCTION public.admin_get_all_orders(
  p_status TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit  INT  DEFAULT 100,
  p_offset INT  DEFAULT 0
)
RETURNS TABLE (
  id               UUID,
  user_id          UUID,
  customer_email   TEXT,
  customer_name    TEXT,
  status           TEXT,
  order_status     TEXT,
  payment_status   TEXT,
  payment_method   TEXT,
  total_amount     NUMERIC,
  subtotal_amount  NUMERIC,
  shipping_amount  NUMERIC,
  discount_amount  NUMERIC,
  tax_amount       NUMERIC,
  tracking_number  TEXT,
  courier          TEXT,
  shipping_address TEXT,
  shipping_method  TEXT,
  coupon_code      TEXT,
  items_count      BIGINT,
  created_at       TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin((SELECT auth.uid())) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.user_id,
    u.email AS customer_email,
    COALESCE(p.name, u.email, 'Unknown') AS customer_name,
    o.status,
    o.order_status,
    o.payment_status,
    o.payment_method,
    o.total_amount,
    o.subtotal_amount,
    o.shipping_amount,
    o.discount_amount,
    o.tax_amount,
    o.tracking_number,
    o.courier,
    o.shipping_address,
    o.shipping_method,
    o.coupon_code,
    (SELECT COUNT(*) FROM public.order_items oi WHERE oi.order_id = o.id) AS items_count,
    o.created_at,
    o.updated_at
  FROM public.orders o
  LEFT JOIN auth.users u ON u.id = o.user_id
  LEFT JOIN public.profiles p ON p.user_id = o.user_id
  WHERE
    (p_status IS NULL OR o.status = p_status OR o.order_status = p_status)
    AND (
      p_search IS NULL
      OR o.id::TEXT ILIKE '%' || p_search || '%'
      OR u.email ILIKE '%' || p_search || '%'
      OR COALESCE(p.name, '') ILIKE '%' || p_search || '%'
      OR o.tracking_number ILIKE '%' || p_search || '%'
    )
  ORDER BY o.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_all_orders(TEXT, TEXT, INT, INT) TO authenticated;

-- 7. Performance indexes
CREATE INDEX IF NOT EXISTS idx_orders_status         ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user_id        ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at     ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
