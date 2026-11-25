-- ==============================================================================
-- Migration: 20261008090000_fix-service-role-trigger-guards.sql
-- Description: Fix security triggers to allow service_role (admin client) to
--   bypass table-level guards.
--
--   Problem: guard_orders_security, guard_payments_security, and
--   guard_product_modifications all use:
--     IF NOT public.is_admin((SELECT auth.uid())) THEN RAISE EXCEPTION ...
--
--   When the payment gateway plugin calls mark_order_paid / mark_order_payment_failed
--   via the admin client (createAdminClient, apiKey = INSFORGE_API_KEY), those
--   SECURITY DEFINER RPCs issue UPDATE statements internally. The trigger fires
--   with auth.uid() = NULL (service_role session context). is_admin(NULL) returns
--   FALSE, so the trigger raises exceptions blocking payment confirmation.
--
--   Fix: Allow NULL auth.uid() (service_role / admin client) to pass through all
--   three guards. This is safe because service_role credentials are server-only
--   and never exposed to the frontend.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Fix guard_orders_security — allow service_role (auth.uid() IS NULL)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_orders_security()
RETURNS TRIGGER AS $$
BEGIN
  -- Service-role backend (auth.uid() IS NULL) is always permitted.
  -- This covers the payment gateway plugin using createAdminClient.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

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

-- ------------------------------------------------------------------------------
-- 2. Fix guard_payments_security — allow service_role (auth.uid() IS NULL)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_payments_security()
RETURNS TRIGGER AS $$
BEGIN
  -- Service-role backend (auth.uid() IS NULL) is always permitted.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

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

-- ------------------------------------------------------------------------------
-- 3. Fix guard_product_modifications — allow service_role (auth.uid() IS NULL)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_product_modifications()
RETURNS TRIGGER AS $$
BEGIN
  -- Service-role backend (auth.uid() IS NULL) is always permitted.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_admin((SELECT auth.uid())) THEN
    RAISE EXCEPTION 'Only administrators can modify products directly';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp;

-- ------------------------------------------------------------------------------
-- 4. Confirm grants on mark_order_paid & mark_order_payment_failed
--    to project_admin and postgres (service_role aliases in InsForge).
-- ------------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.mark_order_paid(UUID, TEXT, TEXT, TEXT) TO project_admin;
GRANT EXECUTE ON FUNCTION public.mark_order_paid(UUID, TEXT, TEXT, TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION public.mark_order_payment_failed(UUID, TEXT, TEXT, TEXT) TO project_admin;
GRANT EXECUTE ON FUNCTION public.mark_order_payment_failed(UUID, TEXT, TEXT, TEXT) TO postgres;
