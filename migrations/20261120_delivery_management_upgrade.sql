-- ==============================================================================
-- Migration: 20261120_delivery_management_upgrade.sql
-- Description: Backward-compatible Delivery Management System upgrade.
--   1. Extends saved_addresses with house_number, street, and landmark.
--   2. Extends orders with delivery_status, estimated_delivery_date,
--      delivery_person_id, delivery_person_name, delivery_person_phone,
--      delivery_assigned_at, confirmed_at, packed_at, delivery_failed_at,
--      return_requested_at, returned_at, is_delayed, delay_reason,
--      delivery_notes, and delivery_pincode.
--   3. Adds RBAC helper is_delivery_personnel(uid) and hardens profile role
--      escalation guard so customers cannot self-assign delivery_personnel or admin.
--   4. Updates RLS on orders & order_timeline so:
--      - Customers ONLY access their own orders.
--      - Delivery personnel ONLY access their assigned deliveries.
--      - Admins access all orders.
--   5. Provides SECURITY DEFINER RPCs:
--      - admin_assign_delivery
--      - update_delivery_status (supports all 10 delivery statuses + notifications)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Extend saved_addresses with explicit house_number, street, landmark
-- ------------------------------------------------------------------------------
ALTER TABLE public.saved_addresses
  ADD COLUMN IF NOT EXISTS house_number TEXT,
  ADD COLUMN IF NOT EXISTS street       TEXT,
  ADD COLUMN IF NOT EXISTS landmark     TEXT;

UPDATE public.saved_addresses
SET
  house_number = COALESCE(NULLIF(house_number, ''), line1),
  street       = COALESCE(NULLIF(street, ''), line2, '')
WHERE house_number IS NULL OR street IS NULL;

-- ------------------------------------------------------------------------------
-- 2. Extend orders with delivery management columns
-- ------------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_status         TEXT DEFAULT 'order_placed',
  ADD COLUMN IF NOT EXISTS estimated_delivery_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_person_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_person_name    TEXT,
  ADD COLUMN IF NOT EXISTS delivery_person_phone   TEXT,
  ADD COLUMN IF NOT EXISTS delivery_assigned_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS packed_at               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_failed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_requested_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS returned_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_delayed              BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS delay_reason            TEXT,
  ADD COLUMN IF NOT EXISTS delivery_notes          TEXT,
  ADD COLUMN IF NOT EXISTS delivery_pincode        TEXT;

UPDATE public.orders
SET delivery_status = CASE COALESCE(status, order_status, 'placed')
  WHEN 'placed'            THEN 'order_placed'
  WHEN 'payment_confirmed' THEN 'order_confirmed'
  WHEN 'processing'        THEN 'packed'
  WHEN 'shipped'           THEN 'shipped'
  WHEN 'out_for_delivery'  THEN 'out_for_delivery'
  WHEN 'delivered'         THEN 'delivered'
  WHEN 'cancelled'         THEN 'cancelled'
  ELSE COALESCE(delivery_status, 'order_placed')
END
WHERE delivery_status IS NULL OR delivery_status = 'order_placed';

CREATE INDEX IF NOT EXISTS idx_orders_delivery_person_id ON public.orders(delivery_person_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_status    ON public.orders(delivery_status);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_pincode   ON public.orders(delivery_pincode);
CREATE INDEX IF NOT EXISTS idx_orders_is_delayed         ON public.orders(is_delayed);

-- ------------------------------------------------------------------------------
-- 3. Role helper: is_delivery_personnel(uid) + hardened role escalation guard
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_delivery_personnel(uid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = uid AND role = 'delivery_personnel'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp;

CREATE OR REPLACE FUNCTION public.guard_profile_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.role IN ('admin', 'delivery_personnel') AND NOT public.is_admin((SELECT auth.uid())) THEN
      RAISE EXCEPTION 'Only administrators can create privileged role accounts';
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

-- ------------------------------------------------------------------------------
-- 4. Update RLS & Security Triggers for Delivery Personnel Scoping
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "orders_select_policy" ON public.orders;
CREATE POLICY "orders_select_policy" ON public.orders
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR delivery_person_id = (SELECT auth.uid())
    OR public.is_admin((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "order_timeline_customer_select" ON public.order_timeline;
CREATE POLICY "order_timeline_customer_select" ON public.order_timeline
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND (
          o.user_id = (SELECT auth.uid())
          OR o.delivery_person_id = (SELECT auth.uid())
          OR public.is_admin((SELECT auth.uid()))
        )
    )
  );

CREATE OR REPLACE FUNCTION public.guard_orders_security()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_admin((SELECT auth.uid())) THEN
      IF NEW.payment_status <> 'pending' THEN
        RAISE EXCEPTION 'Initial order payment status must be pending';
      END IF;
      IF NEW.status NOT IN ('placed', 'order_placed') OR NEW.order_status NOT IN ('placed', 'order_placed') THEN
        RAISE EXCEPTION 'Initial order status must be placed';
      END IF;
      IF NEW.user_id IS DISTINCT FROM (SELECT auth.uid()) THEN
        RAISE EXCEPTION 'Cannot create an order for another user';
      END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NOT public.is_admin((SELECT auth.uid())) THEN
      IF OLD.user_id = (SELECT auth.uid())
         AND NEW.user_id = OLD.user_id
         AND NEW.total_amount = OLD.total_amount
         AND NEW.status = 'cancelled'
         AND NEW.order_status = 'cancelled'
         AND OLD.status IN ('placed', 'order_placed', 'order_confirmed', 'processing', 'packed') THEN
        RETURN NEW;
      END IF;

      IF public.is_delivery_personnel((SELECT auth.uid()))
         AND OLD.delivery_person_id = (SELECT auth.uid())
         AND NEW.user_id = OLD.user_id
         AND NEW.total_amount = OLD.total_amount
         AND NEW.payment_status = OLD.payment_status
         AND NEW.delivery_person_id = OLD.delivery_person_id
         AND NEW.delivery_status IN ('shipped', 'out_for_delivery', 'delivered', 'delivery_failed') THEN
        RETURN NEW;
      END IF;

      RAISE EXCEPTION 'Unauthorized order modification';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp;

-- ------------------------------------------------------------------------------
-- 5. RPC: admin_assign_delivery
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_assign_delivery(
  p_order_id                UUID,
  p_delivery_person_id      UUID DEFAULT NULL,
  p_delivery_person_name    TEXT DEFAULT NULL,
  p_delivery_person_phone   TEXT DEFAULT NULL,
  p_estimated_delivery_date TIMESTAMPTZ DEFAULT NULL,
  p_is_delayed              BOOLEAN DEFAULT NULL,
  p_delay_reason            TEXT DEFAULT NULL
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
  IF auth.uid() IS NOT NULL AND NOT public.is_admin((SELECT auth.uid())) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthorized');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'order_not_found');
  END IF;

  v_order_ref := UPPER(SUBSTRING(p_order_id::TEXT, 1, 8));

  UPDATE public.orders
  SET
    delivery_person_id      = COALESCE(p_delivery_person_id, delivery_person_id),
    delivery_person_name    = COALESCE(NULLIF(TRIM(p_delivery_person_name), ''), delivery_person_name),
    delivery_person_phone   = COALESCE(NULLIF(TRIM(p_delivery_person_phone), ''), delivery_person_phone),
    delivery_assigned_at    = CASE WHEN p_delivery_person_name IS NOT NULL OR p_delivery_person_id IS NOT NULL THEN NOW() ELSE delivery_assigned_at END,
    estimated_delivery_date = COALESCE(p_estimated_delivery_date, estimated_delivery_date),
    is_delayed              = COALESCE(p_is_delayed, is_delayed),
    delay_reason            = CASE WHEN p_is_delayed = FALSE THEN NULL ELSE COALESCE(p_delay_reason, delay_reason) END,
    updated_at              = NOW()
  WHERE id = p_order_id;

  IF p_is_delayed = TRUE AND v_order.user_id IS NOT NULL THEN
    INSERT INTO public.order_timeline (order_id, status, title, description, updated_by)
    VALUES (
      p_order_id,
      COALESCE(v_order.delivery_status, v_order.status, 'order_placed'),
      'Delivery Delayed',
      COALESCE(p_delay_reason, 'Your delivery has been slightly delayed. We apologize for the inconvenience.'),
      auth.uid()
    );

    INSERT INTO public.notifications (user_id, title, message, type, is_read, link_page, link_params)
    VALUES (
      v_order.user_id,
      'Delivery Delayed',
      format('Order #%s delivery is delayed: %s', v_order_ref, COALESCE(p_delay_reason, 'Updated delivery schedule in progress.')),
      'order',
      false,
      'order-tracking',
      jsonb_build_object('id', p_order_id)
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'order_id', p_order_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_assign_delivery(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 6. RPC: update_delivery_status (Admin + Assigned Delivery Personnel)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_delivery_status(
  p_order_id   UUID,
  p_new_status TEXT,
  p_location   TEXT DEFAULT NULL,
  p_notes      TEXT DEFAULT NULL,
  p_is_delayed BOOLEAN DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_order       public.orders%ROWTYPE;
  v_caller      UUID := auth.uid();
  v_is_admin    BOOLEAN := (v_caller IS NULL) OR public.is_admin(v_caller);
  v_is_agent    BOOLEAN := (v_caller IS NOT NULL) AND public.is_delivery_personnel(v_caller);
  v_title       TEXT;
  v_description TEXT;
  v_notif_title TEXT := NULL;
  v_notif_msg   TEXT := NULL;
  v_order_ref   TEXT;
BEGIN
  IF p_new_status NOT IN (
    'order_placed', 'order_confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered',
    'cancelled', 'delivery_failed', 'return_requested', 'returned',
    'placed', 'payment_confirmed', 'processing'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'order_not_found');
  END IF;

  IF NOT v_is_admin THEN
    IF NOT v_is_agent OR v_order.delivery_person_id IS DISTINCT FROM v_caller THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'unauthorized');
    END IF;
    IF p_new_status NOT IN ('shipped', 'out_for_delivery', 'delivered', 'delivery_failed') THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'forbidden_status_for_delivery_agent');
    END IF;
  END IF;

  v_order_ref := UPPER(SUBSTRING(p_order_id::TEXT, 1, 8));

  CASE p_new_status
    WHEN 'order_placed', 'placed' THEN
      v_title       := 'Order Placed';
      v_description := COALESCE(p_notes, 'Order received and awaiting confirmation.');
    WHEN 'order_confirmed', 'payment_confirmed' THEN
      v_title       := 'Order Confirmed';
      v_description := COALESCE(p_notes, 'Order has been confirmed and queued for packing.');
      v_notif_title := 'Order Confirmed';
      v_notif_msg   := format('Order #%s has been confirmed and is being prepared for packing.', v_order_ref);
    WHEN 'packed', 'processing' THEN
      v_title       := 'Packed';
      v_description := COALESCE(p_notes, 'Items have been quality-checked and packed securely for dispatch.');
    WHEN 'shipped' THEN
      v_title       := 'Shipped';
      v_description := COALESCE(p_notes, 'Your order has been dispatched for delivery.');
      v_notif_title := 'Order Shipped';
      v_notif_msg   := format('Order #%s has been shipped and is on its way.', v_order_ref);
    WHEN 'out_for_delivery' THEN
      v_title       := 'Out for Delivery';
      v_description := COALESCE(p_notes, 'Assigned delivery agent is on the way to your delivery address.');
      v_notif_title := 'Out for Delivery';
      v_notif_msg   := format('Order #%s is out for delivery today! Please keep your phone accessible.', v_order_ref);
    WHEN 'delivered' THEN
      v_title       := 'Delivered';
      v_description := COALESCE(p_notes, 'Order delivered and confirmed at the doorstep.');
      v_notif_title := 'Order Delivered';
      v_notif_msg   := format('Order #%s has been delivered successfully. Thank you for shopping with TrustCart AI!', v_order_ref);
    WHEN 'cancelled' THEN
      v_title       := 'Cancelled';
      v_description := COALESCE(p_notes, 'Order has been cancelled.');
      v_notif_title := 'Order Cancelled';
      v_notif_msg   := format('Order #%s has been cancelled.', v_order_ref);
    WHEN 'delivery_failed' THEN
      v_title       := 'Delivery Failed';
      v_description := COALESCE(p_notes, 'Delivery attempt unsuccessful. Re-attempt will be scheduled.');
      v_notif_title := 'Delivery Attempt Failed';
      v_notif_msg   := format('Delivery attempt failed for Order #%s. Reason: %s', v_order_ref, COALESCE(p_notes, 'Recipient unreachable.'));
    WHEN 'return_requested' THEN
      v_title       := 'Return Requested';
      v_description := COALESCE(p_notes, 'Customer return request logged and under review.');
    WHEN 'returned' THEN
      v_title       := 'Returned';
      v_description := COALESCE(p_notes, 'Returned item received and verified at warehouse.');
    ELSE
      v_title       := initcap(replace(p_new_status, '_', ' '));
      v_description := COALESCE(p_notes, 'Delivery status updated.');
  END CASE;

  UPDATE public.orders
  SET
    status              = p_new_status,
    order_status        = p_new_status,
    delivery_status     = p_new_status,
    updated_at          = NOW(),
    confirmed_at        = CASE WHEN p_new_status IN ('order_confirmed', 'payment_confirmed') THEN NOW() ELSE confirmed_at END,
    packed_at           = CASE WHEN p_new_status IN ('packed', 'processing') THEN NOW() ELSE packed_at END,
    shipped_at          = CASE WHEN p_new_status = 'shipped' THEN NOW() ELSE shipped_at END,
    out_for_delivery_at = CASE WHEN p_new_status = 'out_for_delivery' THEN NOW() ELSE out_for_delivery_at END,
    delivered_at        = CASE WHEN p_new_status = 'delivered' THEN NOW() ELSE delivered_at END,
    cancelled_at        = CASE WHEN p_new_status = 'cancelled' THEN NOW() ELSE cancelled_at END,
    delivery_failed_at  = CASE WHEN p_new_status = 'delivery_failed' THEN NOW() ELSE delivery_failed_at END,
    return_requested_at = CASE WHEN p_new_status = 'return_requested' THEN NOW() ELSE return_requested_at END,
    returned_at         = CASE WHEN p_new_status = 'returned' THEN NOW() ELSE returned_at END,
    is_delayed          = CASE WHEN p_new_status IN ('delivered', 'cancelled', 'returned') THEN FALSE ELSE COALESCE(p_is_delayed, is_delayed) END,
    delivery_notes      = COALESCE(p_notes, delivery_notes)
  WHERE id = p_order_id;

  INSERT INTO public.order_timeline (order_id, status, title, description, location, updated_by)
  VALUES (p_order_id, p_new_status, v_title, v_description, p_location, v_caller);

  IF v_notif_title IS NOT NULL AND v_order.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, is_read, link_page, link_params)
    VALUES (
      v_order.user_id,
      v_notif_title,
      v_notif_msg,
      'order',
      false,
      'order-tracking',
      jsonb_build_object('id', p_order_id)
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'status', p_new_status,
    'title', v_title,
    'updated_at', NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_delivery_status(UUID, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

