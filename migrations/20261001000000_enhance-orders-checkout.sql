-- ==============================================================================
-- Migration: 20261001000000_enhance-orders-checkout.sql
-- Description: Enhances orders table with checkout metadata and creates
--              saved_addresses table for user address book.
-- ==============================================================================

-- 1. Add checkout metadata columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_method TEXT DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS payment_method  TEXT DEFAULT 'cod',
  ADD COLUMN IF NOT EXISTS coupon_code     TEXT,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount      NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_amount NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS courier         TEXT DEFAULT 'BlueDart Express',
  ADD COLUMN IF NOT EXISTS estimated_delivery TEXT DEFAULT 'In 3-5 business days',
  ADD COLUMN IF NOT EXISTS notes          TEXT;

-- 2. Saved Addresses table
CREATE TABLE IF NOT EXISTS public.saved_addresses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label       TEXT NOT NULL DEFAULT 'Home',
  full_name   TEXT NOT NULL,
  phone       TEXT,
  line1       TEXT NOT NULL,
  line2       TEXT,
  city        TEXT NOT NULL,
  state       TEXT NOT NULL DEFAULT 'Karnataka',
  pincode     TEXT NOT NULL,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_addresses_user_id ON public.saved_addresses(user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_saved_addresses_updated_at'
      AND tgrelid = 'public.saved_addresses'::regclass
  ) THEN
    CREATE TRIGGER set_saved_addresses_updated_at
      BEFORE UPDATE ON public.saved_addresses
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saved_addresses' AND policyname = 'saved_addresses_select') THEN
    CREATE POLICY "saved_addresses_select" ON public.saved_addresses
      FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saved_addresses' AND policyname = 'saved_addresses_insert') THEN
    CREATE POLICY "saved_addresses_insert" ON public.saved_addresses
      FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saved_addresses' AND policyname = 'saved_addresses_update') THEN
    CREATE POLICY "saved_addresses_update" ON public.saved_addresses
      FOR UPDATE TO authenticated
      USING (user_id = (SELECT auth.uid()))
      WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saved_addresses' AND policyname = 'saved_addresses_delete') THEN
    CREATE POLICY "saved_addresses_delete" ON public.saved_addresses
      FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- 3. Ensure orders RLS allows authenticated users to insert their own orders
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'orders_insert_policy') THEN
    CREATE POLICY "orders_insert_policy" ON public.orders
      FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'orders_select_policy') THEN
    CREATE POLICY "orders_select_policy" ON public.orders
      FOR SELECT TO authenticated
      USING (user_id = (SELECT auth.uid()) OR public.is_admin((SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'orders_update_policy') THEN
    CREATE POLICY "orders_update_policy" ON public.orders
      FOR UPDATE TO authenticated
      USING (user_id = (SELECT auth.uid()) OR public.is_admin((SELECT auth.uid())));
  END IF;
END $$;

-- 4. Ensure order_items RLS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_items' AND policyname = 'order_items_insert_policy') THEN
    CREATE POLICY "order_items_insert_policy" ON public.order_items
      FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND user_id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_items' AND policyname = 'order_items_select_policy') THEN
    CREATE POLICY "order_items_select_policy" ON public.order_items
      FOR SELECT TO authenticated USING (public.can_access_order(order_id));
  END IF;
END $$;

-- 5. payments RLS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'payments_insert_policy') THEN
    CREATE POLICY "payments_insert_policy" ON public.payments
      FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'payments_select_policy') THEN
    CREATE POLICY "payments_select_policy" ON public.payments
      FOR SELECT TO authenticated
      USING (user_id = (SELECT auth.uid()) OR public.is_admin((SELECT auth.uid())));
  END IF;
END $$;
