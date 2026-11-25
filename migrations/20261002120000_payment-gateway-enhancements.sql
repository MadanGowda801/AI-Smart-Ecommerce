-- ==============================================================================
-- Migration: 20261002120000_payment-gateway-enhancements.sql
-- Description: Enhances payments table with Razorpay-specific columns,
--              adds a payment_events audit log table for immutable payment
--              history, and adds server-side order status update functions.
-- ==============================================================================

-- 1. Add Razorpay-specific columns to payments table
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS razorpay_order_id    TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id  TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_signature   TEXT,
  ADD COLUMN IF NOT EXISTS gateway_mode         TEXT NOT NULL DEFAULT 'test'
                             CHECK (gateway_mode IN ('test', 'live')),
  ADD COLUMN IF NOT EXISTS failure_code         TEXT,
  ADD COLUMN IF NOT EXISTS failure_description  TEXT,
  ADD COLUMN IF NOT EXISTS paid_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Index for fast look-ups by gateway order/payment reference
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id
  ON public.payments(razorpay_order_id);

CREATE INDEX IF NOT EXISTS idx_payments_razorpay_payment_id
  ON public.payments(razorpay_payment_id);

-- Trigger to keep payments.updated_at fresh
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_payments_updated_at'
      AND tgrelid = 'public.payments'::regclass
  ) THEN
    CREATE TRIGGER set_payments_updated_at
      BEFORE UPDATE ON public.payments
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;


-- 2. Payment Events - immutable audit log of every gateway event
CREATE TABLE IF NOT EXISTS public.payment_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_id          UUID        REFERENCES public.payments(id) ON DELETE SET NULL,
  event_type          TEXT        NOT NULL
                        CHECK (event_type IN (
                          'initiated', 'authorised', 'verified',
                          'failed', 'cancelled', 'refunded'
                        )),
  gateway_provider    TEXT        NOT NULL DEFAULT 'razorpay',
  gateway_mode        TEXT        NOT NULL DEFAULT 'test'
                        CHECK (gateway_mode IN ('test', 'live')),
  razorpay_order_id   TEXT,
  razorpay_payment_id TEXT,
  error_code          TEXT,
  error_description   TEXT,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_events_order_id
  ON public.payment_events(order_id);

CREATE INDEX IF NOT EXISTS idx_payment_events_event_type
  ON public.payment_events(event_type);

CREATE INDEX IF NOT EXISTS idx_payment_events_created_at
  ON public.payment_events(created_at DESC);

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_events_select_policy" ON public.payment_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = order_id
        AND (user_id = (SELECT auth.uid()) OR public.is_admin((SELECT auth.uid())))
    )
  );

CREATE POLICY "payment_events_insert_policy" ON public.payment_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin((SELECT auth.uid())));

-- 3. Server-side function: safely mark an order as paid (idempotent)
CREATE OR REPLACE FUNCTION public.mark_order_paid(
  p_order_id          UUID,
  p_payment_id        UUID,
  p_razorpay_order_id TEXT,
  p_razorpay_pay_id   TEXT,
  p_razorpay_sig      TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_order_row public.orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order_row FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'order_not_found');
  END IF;
  IF v_order_row.payment_status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_paid');
  END IF;

  UPDATE public.payments
  SET
    payment_status        = 'paid',
    razorpay_order_id     = p_razorpay_order_id,
    razorpay_payment_id   = p_razorpay_pay_id,
    razorpay_signature    = p_razorpay_sig,
    transaction_reference = p_razorpay_pay_id,
    paid_at               = NOW(),
    updated_at            = NOW()
  WHERE id = p_payment_id;

  UPDATE public.orders
  SET
    payment_status = 'paid',
    order_status   = 'placed',
    status         = 'placed',
    updated_at     = NOW()
  WHERE id = p_order_id
    AND payment_status <> 'paid';

  INSERT INTO public.payment_events (
    order_id, payment_id, event_type, gateway_mode,
    razorpay_order_id, razorpay_payment_id
  ) VALUES (
    p_order_id, p_payment_id, 'verified', 'test',
    p_razorpay_order_id, p_razorpay_pay_id
  );

  RETURN jsonb_build_object('ok', true, 'reason', 'updated');
END;
$$;

-- 4. Server-side function: record a payment failure
CREATE OR REPLACE FUNCTION public.mark_order_payment_failed(
  p_order_id          UUID,
  p_payment_id        UUID,
  p_razorpay_order_id TEXT,
  p_error_code        TEXT,
  p_error_desc        TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.orders WHERE id = p_order_id AND payment_status = 'paid') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_paid');
  END IF;

  UPDATE public.payments
  SET
    payment_status      = 'failed',
    failure_code        = p_error_code,
    failure_description = p_error_desc,
    failed_at           = NOW(),
    updated_at          = NOW()
  WHERE id = p_payment_id;

  UPDATE public.orders
  SET payment_status = 'failed', updated_at = NOW()
  WHERE id = p_order_id AND payment_status NOT IN ('paid');

  INSERT INTO public.payment_events (
    order_id, payment_id, event_type, gateway_mode,
    razorpay_order_id, error_code, error_description
  ) VALUES (
    p_order_id, p_payment_id, 'failed', 'test',
    p_razorpay_order_id, p_error_code, p_error_desc
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 5. Grants
GRANT EXECUTE ON FUNCTION public.mark_order_paid(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_payment_failed(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;
