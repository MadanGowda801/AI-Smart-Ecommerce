-- ==============================================================================
-- Migration: 20261002230000_fix_payment_events_rpc.sql
-- Description: Fix payment_events column names and event_type enum constraints
--              in mark_order_paid and mark_order_payment_failed functions.
-- ==============================================================================

-- 1. Patch mark_order_paid
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
  v_payment_id   UUID;
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
  SET payment_status        = 'paid',
      transaction_reference = p_razorpay_payment_id,
      razorpay_order_id     = p_razorpay_order_id,
      razorpay_payment_id   = p_razorpay_payment_id,
      razorpay_signature    = p_razorpay_signature,
      paid_at               = NOW()
  WHERE order_id = p_order_id
  RETURNING id INTO v_payment_id;

  -- Record audit event in payment_events with correct schema
  INSERT INTO public.payment_events (
    order_id,
    payment_id,
    event_type,
    gateway_provider,
    gateway_mode,
    razorpay_order_id,
    razorpay_payment_id,
    metadata
  )
  VALUES (
    p_order_id,
    v_payment_id,
    'verified',
    'razorpay',
    'test',
    p_razorpay_order_id,
    p_razorpay_payment_id,
    jsonb_build_object(
      'razorpay_order_id', p_razorpay_order_id,
      'razorpay_payment_id', p_razorpay_payment_id,
      'verified_at', NOW()
    )
  );

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

-- 2. Patch mark_order_payment_failed
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
  v_order      public.orders%ROWTYPE;
  v_payment_id UUID;
  v_order_ref  TEXT;
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
  SET payment_status      = 'failed',
      failure_code        = p_error_code,
      failure_description = p_error_description,
      failed_at           = NOW()
  WHERE order_id = p_order_id
  RETURNING id INTO v_payment_id;

  -- Record audit event in payment_events with correct schema
  INSERT INTO public.payment_events (
    order_id,
    payment_id,
    event_type,
    gateway_provider,
    gateway_mode,
    razorpay_order_id,
    error_code,
    error_description,
    metadata
  )
  VALUES (
    p_order_id,
    v_payment_id,
    'failed',
    'razorpay',
    'test',
    p_razorpay_order_id,
    p_error_code,
    p_error_description,
    jsonb_build_object(
      'razorpay_order_id', p_razorpay_order_id,
      'error_code', p_error_code,
      'error_description', p_error_description,
      'failed_at', NOW()
    )
  );

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
