-- ==============================================================================
-- Migration: 20261007130000_security-audit-hardening.sql
-- Description: Comprehensive security hardening for Smart E-Commerce platform.
--   1. Fix privilege escalation in is_admin (eliminate auth.users profile trust)
--   2. Guard profile role modifications on INSERT and UPDATE
--   3. Drop insecure RLS policies (products_customer_stock_decrement,
--      orders_user_update_policy, payments_user_update_policy)
--   4. Guard products, orders, and payments with database-level security triggers
--   5. Fix place_order_safe: authoritative price lookup, server-side coupon &
--      tax/shipping validation, atomic stock deduction, initial status 'pending'
--   6. Add customer_cancel_order RPC with inventory restoration
--   7. Restrict mark_order_paid & mark_order_payment_failed to service_role only
--   8. Secure send_notification against spoofing / cross-user inbox tampering
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Fix is_admin() privilege escalation
-- ------------------------------------------------------------------------------
-- Previously, is_admin() checked `auth.users.profile->>'role' = 'admin'`.
-- Because users can write to their own profile via auth.setProfile, any user
-- could escalate to admin. We now strictly check public.profiles (guarded by
-- trigger) or the internal is_project_admin flag.
CREATE OR REPLACE FUNCTION public.is_admin(uid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = uid AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = uid AND is_project_admin = true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp;

-- ------------------------------------------------------------------------------
-- 2. Guard profiles role changes on both INSERT and UPDATE
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_profile_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.role = 'admin' AND NOT public.is_admin((SELECT auth.uid())) THEN
      RAISE EXCEPTION 'Only administrators can create admin accounts';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      IF NOT public.is_admin((SELECT auth.uid())) THEN
        RAISE EXCEPTION 'Only administrators can modify user roles';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp;

DROP TRIGGER IF EXISTS trigger_guard_profile_role ON public.profiles;
CREATE TRIGGER trigger_guard_profile_role
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role_change();

-- ------------------------------------------------------------------------------
-- 3. Drop insecure RLS policies
-- ------------------------------------------------------------------------------
-- Drop the overly permissive stock decrement policy that allowed any authenticated
-- user to update any column of products (including price, name, discount).
DROP POLICY IF EXISTS "products_customer_stock_decrement" ON public.products;

-- Drop user update policies on orders and payments that allowed customers
-- to arbitrarily update status to 'delivered' or payment_status to 'paid'.
DROP POLICY IF EXISTS "orders_user_update_policy" ON public.orders;
DROP POLICY IF EXISTS "payments_user_update_policy" ON public.payments;

-- Re-enforce admin-only direct updates on products, orders, and payments
DROP POLICY IF EXISTS "products_update_policy" ON public.products;
CREATE POLICY "products_update_policy" ON public.products
  FOR UPDATE TO authenticated
  USING (public.is_admin((SELECT auth.uid())))
  WITH CHECK (public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "orders_update_policy" ON public.orders;
CREATE POLICY "orders_update_policy" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.is_admin((SELECT auth.uid())))
  WITH CHECK (public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "payments_update_policy" ON public.payments;
CREATE POLICY "payments_update_policy" ON public.payments
  FOR UPDATE TO authenticated
  USING (public.is_admin((SELECT auth.uid())))
  WITH CHECK (public.is_admin((SELECT auth.uid())));

-- ------------------------------------------------------------------------------
-- 4. Database triggers: Guard products, orders, and payments against direct tampering
-- ------------------------------------------------------------------------------

-- Products: only administrators may modify product catalog
CREATE OR REPLACE FUNCTION public.guard_product_modifications()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.is_admin((SELECT auth.uid())) THEN
    RAISE EXCEPTION 'Only administrators can modify products directly';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp;

DROP TRIGGER IF EXISTS trigger_guard_product_modifications ON public.products;
CREATE TRIGGER trigger_guard_product_modifications
  BEFORE INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.guard_product_modifications();

-- Orders: enforce valid initial status on INSERT, prevent customer updates
CREATE OR REPLACE FUNCTION public.guard_orders_security()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_admin((SELECT auth.uid())) THEN
      IF NEW.payment_status <> 'pending' THEN
        RAISE EXCEPTION 'Initial order payment status must be pending';
      END IF;
      IF NEW.status NOT IN ('placed') OR NEW.order_status NOT IN ('placed') THEN
        RAISE EXCEPTION 'Initial order status must be placed';
      END IF;
      IF NEW.user_id IS DISTINCT FROM (SELECT auth.uid()) THEN
        RAISE EXCEPTION 'Cannot create an order for another user';
      END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NOT public.is_admin((SELECT auth.uid())) THEN
      RAISE EXCEPTION 'Only administrators can update orders directly';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp;

DROP TRIGGER IF EXISTS trigger_guard_orders_security ON public.orders;
CREATE TRIGGER trigger_guard_orders_security
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_orders_security();

-- Payments: enforce pending status on INSERT, prevent customer updates
CREATE OR REPLACE FUNCTION public.guard_payments_security()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_admin((SELECT auth.uid())) THEN
      IF NEW.payment_status <> 'pending' THEN
        RAISE EXCEPTION 'Initial payment status must be pending';
      END IF;
      IF NEW.user_id IS DISTINCT FROM (SELECT auth.uid()) THEN
        RAISE EXCEPTION 'Cannot create a payment record for another user';
      END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NOT public.is_admin((SELECT auth.uid())) THEN
      RAISE EXCEPTION 'Only backend verification and administrators can update payment records';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp;

DROP TRIGGER IF EXISTS trigger_guard_payments_security ON public.payments;
CREATE TRIGGER trigger_guard_payments_security
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.guard_payments_security();

-- ------------------------------------------------------------------------------
-- 5. Safe Order Placement RPC (place_order_safe)
-- ------------------------------------------------------------------------------
-- Server-side authoritative price validation, coupon calculation, tax calculation,
-- stock verification and deduction. Initial payment_status is ALWAYS 'pending'.
CREATE OR REPLACE FUNCTION public.place_order_safe(
  p_user_id         UUID,
  p_items           JSONB,
  p_shipping_addr   TEXT,
  p_payment_method  TEXT,
  p_shipping_method TEXT,
  p_coupon_code     TEXT,
  p_discount_amt    NUMERIC DEFAULT 0,
  p_shipping_amt    NUMERIC DEFAULT 0,
  p_tax_amt         NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_item             JSONB;
  v_product_id       UUID;
  v_quantity         INTEGER;
  v_db_price         NUMERIC;
  v_db_stock         INTEGER;
  v_subtotal         NUMERIC := 0;
  v_clean_coupon     TEXT;
  v_server_discount  NUMERIC := 0;
  v_server_shipping  NUMERIC := 0;
  v_taxable          NUMERIC := 0;
  v_server_tax       NUMERIC := 0;
  v_total            NUMERIC := 0;
  v_order_id         UUID;
  v_tracking_no      TEXT;
  v_courier          TEXT;
  v_est_delivery     TEXT;
  v_clean_ship_meth  TEXT;
  v_initial_txn      TEXT;
BEGIN
  -- Authenticate caller
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cart is empty');
  END IF;

  -- 1. Validate items and verify inventory with exclusive locks
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity   := COALESCE((v_item->>'quantity')::INTEGER, 0);

    IF v_quantity <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Invalid item quantity');
    END IF;

    SELECT price, stock INTO v_db_price, v_db_stock
      FROM public.products WHERE id = v_product_id FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Product not found: ' || v_product_id::TEXT);
    END IF;

    IF v_db_stock < v_quantity THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'Insufficient stock. Available: ' || v_db_stock || ', requested: ' || v_quantity
      );
    END IF;

    v_subtotal := v_subtotal + ROUND(v_db_price * v_quantity, 2);
  END LOOP;

  v_subtotal := ROUND(v_subtotal, 2);

  -- 2. Authoritative server-side discount calculation
  v_clean_coupon := UPPER(TRIM(COALESCE(p_coupon_code, '')));
  IF v_clean_coupon = 'SMART10' THEN
    IF v_subtotal >= 1999 THEN
      v_server_discount := LEAST(2500, ROUND(v_subtotal * 0.10, 2));
    END IF;
  ELSIF v_clean_coupon = 'FIRSTBUY' THEN
    IF v_subtotal >= 2999 THEN
      v_server_discount := 500;
    END IF;
  ELSIF v_clean_coupon = 'AURA20' THEN
    IF v_subtotal >= 9999 THEN
      v_server_discount := LEAST(5000, ROUND(v_subtotal * 0.20, 2));
    END IF;
  ELSE
    v_server_discount := 0;
  END IF;

  v_server_discount := LEAST(v_subtotal, v_server_discount);

  -- 3. Authoritative server-side shipping calculation
  v_clean_ship_meth := LOWER(COALESCE(p_shipping_method, 'standard'));
  IF v_clean_ship_meth = 'sameday' THEN
    v_server_shipping := 199;
  ELSIF v_clean_ship_meth = 'express' THEN
    v_server_shipping := 99;
  ELSE
    v_clean_ship_meth := 'standard';
    v_server_shipping := CASE WHEN v_subtotal >= 999 OR v_subtotal = 0 THEN 0 ELSE 99 END;
  END IF;

  -- 4. Authoritative server-side 5% GST calculation
  v_taxable := GREATEST(0, v_subtotal - v_server_discount);
  v_server_tax := ROUND(v_taxable * 0.05, 2);

  -- 5. Authoritative final total
  v_total := GREATEST(0, ROUND(v_subtotal - v_server_discount + v_server_shipping + v_server_tax, 2));

  -- 6. Courier & Tracking metadata
  v_tracking_no := (ARRAY['BLU','DTX','EKT','DHL','FDX'])[floor(random()*5+1)::int]
                   || '-IND-' || floor(10000000 + random() * 90000000)::bigint::text;

  v_courier := CASE v_clean_ship_meth
    WHEN 'express' THEN 'BlueDart Express Air'
    WHEN 'sameday' THEN 'EcomExpress Same-Day'
    ELSE 'BlueDart Ground'
  END;

  v_est_delivery := CASE v_clean_ship_meth
    WHEN 'express' THEN 'In 1-2 business days'
    WHEN 'sameday' THEN 'Today by 8:00 PM'
    ELSE 'In 3-5 business days'
  END;

  -- 7. Insert Order Record
  -- CRITICAL SECURITY: payment_status is ALWAYS 'pending' at creation time.
  -- Online orders are marked 'paid' ONLY after server-side cryptographic HMAC verification.
  INSERT INTO public.orders (
    user_id,
    total_amount,
    subtotal_amount,
    discount_amount,
    tax_amount,
    shipping_amount,
    shipping_address,
    payment_method,
    payment_status,
    shipping_method,
    coupon_code,
    tracking_number,
    courier,
    estimated_delivery,
    status,
    order_status
  ) VALUES (
    p_user_id,
    v_total,
    v_subtotal,
    v_server_discount,
    v_server_tax,
    v_server_shipping,
    p_shipping_addr,
    p_payment_method,
    'pending',
    v_clean_ship_meth,
    CASE WHEN v_server_discount > 0 THEN v_clean_coupon ELSE NULL END,
    v_tracking_no,
    v_courier,
    v_est_delivery,
    'placed',
    'placed'
  ) RETURNING id INTO v_order_id;

  -- 8. Insert Order Items & Deduct Inventory (using authoritative DB prices)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity   := (v_item->>'quantity')::INTEGER;

    SELECT price INTO v_db_price FROM public.products WHERE id = v_product_id;

    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, price)
    VALUES (v_order_id, v_product_id, v_quantity, v_db_price, v_db_price);

    UPDATE public.products
    SET stock = stock - v_quantity, updated_at = NOW()
    WHERE id = v_product_id;

    INSERT INTO public.inventory_history (product_id, quantity_change, reason)
    VALUES (
      v_product_id,
      -v_quantity,
      'Order #' || UPPER(SUBSTRING(v_order_id::TEXT, 1, 8)) || ' purchase'
    );
  END LOOP;

  -- 9. Insert Initial Payment record (status: 'pending')
  IF LOWER(p_payment_method) LIKE '%cod%' THEN
    v_initial_txn := 'COD-' || extract(epoch from now())::bigint::text;
  ELSE
    v_initial_txn := NULL;
  END IF;

  INSERT INTO public.payments (
    order_id,
    user_id,
    amount,
    payment_method,
    payment_status,
    transaction_reference
  ) VALUES (
    v_order_id,
    p_user_id,
    v_total,
    p_payment_method,
    'pending',
    v_initial_txn
  );

  -- 10. Record initial order timeline event
  INSERT INTO public.order_timeline (order_id, status, title, description, updated_by)
  VALUES (
    v_order_id,
    'placed',
    'Order Placed',
    'Your order has been received and is being prepared.',
    p_user_id
  );

  -- 11. Clear user cart
  DELETE FROM public.cart_items WHERE user_id = p_user_id;

  -- 12. Send order notification
  PERFORM public.send_notification(
    p_user_id,
    'Order Placed',
    format(
      'Order #%s for ₹%s has been placed successfully.',
      UPPER(SUBSTRING(v_order_id::TEXT, 1, 8)),
      v_total::TEXT
    ),
    'order',
    'order-details',
    jsonb_build_object('id', v_order_id::TEXT)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'total', v_total,
    'subtotal', v_subtotal,
    'discount', v_server_discount,
    'shipping', v_server_shipping,
    'tax', v_server_tax,
    'tracking_number', v_tracking_no,
    'courier', v_courier,
    'estimated_delivery', v_est_delivery,
    'payment_status', 'pending',
    'status', 'placed'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_order_safe(
  UUID, JSONB, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC
) TO authenticated;

-- ------------------------------------------------------------------------------
-- 6. Safe Customer Order Cancellation RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.customer_cancel_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item  RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthenticated');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Order not found');
  END IF;

  IF v_order.user_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin(auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  IF v_order.status NOT IN ('placed', 'processing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Order cannot be cancelled in status: ' || v_order.status);
  END IF;

  -- Restore product stock and inventory history
  FOR v_item IN SELECT product_id, quantity FROM public.order_items WHERE order_id = p_order_id LOOP
    UPDATE public.products
    SET stock = stock + v_item.quantity, updated_at = NOW()
    WHERE id = v_item.product_id;

    INSERT INTO public.inventory_history (product_id, quantity_change, reason)
    VALUES (
      v_item.product_id,
      v_item.quantity,
      'Order #' || UPPER(SUBSTRING(p_order_id::TEXT, 1, 8)) || ' cancellation by customer'
    );
  END LOOP;

  UPDATE public.orders
  SET status = 'cancelled',
      order_status = 'cancelled',
      cancelled_at = NOW(),
      updated_at = NOW()
  WHERE id = p_order_id;

  UPDATE public.payments
  SET payment_status = 'cancelled'
  WHERE order_id = p_order_id AND payment_status <> 'paid';

  INSERT INTO public.order_timeline (order_id, status, title, description, updated_by)
  VALUES (
    p_order_id,
    'cancelled',
    'Order Cancelled',
    'Order was cancelled by customer. Any refund will be processed in 5-7 business days.',
    auth.uid()
  );

  PERFORM public.send_notification(
    v_order.user_id,
    'Order Cancelled',
    format('Your order #%s has been cancelled.', UPPER(SUBSTRING(p_order_id::TEXT, 1, 8))),
    'order',
    'order-details',
    jsonb_build_object('id', p_order_id::TEXT)
  );

  RETURN jsonb_build_object('ok', true, 'status', 'cancelled');
END;
$$;

GRANT EXECUTE ON FUNCTION public.customer_cancel_order(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 7. Restrict mark_order_paid & mark_order_payment_failed to service_role ONLY
-- ------------------------------------------------------------------------------
-- Never allow anon or authenticated clients to invoke payment settlement directly.
REVOKE EXECUTE ON FUNCTION public.mark_order_paid(UUID, TEXT, TEXT, TEXT) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.mark_order_payment_failed(UUID, TEXT, TEXT, TEXT) FROM anon, authenticated, public;

-- Drop legacy overload if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'mark_order_paid' AND pronargs = 5
  ) THEN
    DROP FUNCTION public.mark_order_paid(UUID, UUID, TEXT, TEXT, TEXT);
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'mark_order_payment_failed' AND pronargs = 5
  ) THEN
    DROP FUNCTION public.mark_order_payment_failed(UUID, UUID, TEXT, TEXT, TEXT);
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.mark_order_paid(UUID, TEXT, TEXT, TEXT) TO project_admin;
GRANT EXECUTE ON FUNCTION public.mark_order_paid(UUID, TEXT, TEXT, TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION public.mark_order_payment_failed(UUID, TEXT, TEXT, TEXT) TO project_admin;
GRANT EXECUTE ON FUNCTION public.mark_order_payment_failed(UUID, TEXT, TEXT, TEXT) TO postgres;

-- ------------------------------------------------------------------------------
-- 8. Secure send_notification against spoofing
-- ------------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.send_notification(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) FROM anon, public;

CREATE OR REPLACE FUNCTION public.send_notification(
  p_user_id     UUID,
  p_title       TEXT,
  p_message     TEXT,
  p_type        TEXT DEFAULT 'system',
  p_link_page   TEXT DEFAULT NULL,
  p_link_params JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_id UUID;
  v_caller UUID;
BEGIN
  v_caller := auth.uid();
  -- If invoked from client session, prevent writing to another user's inbox unless admin
  IF v_caller IS NOT NULL AND v_caller IS DISTINCT FROM p_user_id AND NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'Unauthorized: cannot send notifications to other users';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, is_read, link_page, link_params)
  VALUES (p_user_id, p_title, p_message, p_type, false, p_link_page, p_link_params)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_notification(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_notification(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO project_admin;
GRANT EXECUTE ON FUNCTION public.send_notification(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO postgres;
