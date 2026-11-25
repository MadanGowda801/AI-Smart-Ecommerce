-- ==============================================================================
-- Migration: 20261008100000_fix-order-cancellation-and-stock-triggers.sql
-- Description:
--   1. Allow safe order cancellation in guard_orders_security and
--      guard_payments_security for the order owner.
--   2. Allow stock adjustments in guard_product_modifications when catalog
--      metadata (name, price, category, discount, slug) remains untouched.
--   3. Add an AFTER INSERT trigger on order_items to automatically and atomically
--      decrement product stock and record inventory history upon order creation.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Update guard_orders_security
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_orders_security()
RETURNS TRIGGER AS $$
BEGIN
  -- Service-role backend (auth.uid() IS NULL) is always permitted.
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
      -- Allow owner to cancel their own placed/processing order
      IF OLD.user_id = (SELECT auth.uid())
         AND NEW.user_id = OLD.user_id
         AND NEW.total_amount = OLD.total_amount
         AND NEW.status = 'cancelled'
         AND NEW.order_status = 'cancelled'
         AND OLD.status IN ('placed', 'processing') THEN
        RETURN NEW;
      END IF;

      RAISE EXCEPTION 'Only administrators can update orders directly';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 2. Update guard_payments_security
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
      -- Allow cancellation of unpaid payment on cancelled order
      IF OLD.user_id = (SELECT auth.uid())
         AND NEW.user_id = OLD.user_id
         AND NEW.amount = OLD.amount
         AND NEW.payment_status = 'cancelled'
         AND OLD.payment_status <> 'paid' THEN
        RETURN NEW;
      END IF;

      RAISE EXCEPTION 'Only backend verification and administrators can update payment records';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 3. Update guard_product_modifications
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_product_modifications()
RETURNS TRIGGER AS $$
BEGIN
  -- Service-role backend (auth.uid() IS NULL) is always permitted.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Allow stock adjustment if product core fields are unchanged
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id = OLD.id
       AND NEW.name = OLD.name
       AND NEW.price = OLD.price
       AND NEW.category_id IS NOT DISTINCT FROM OLD.category_id
       AND NEW.discount IS NOT DISTINCT FROM OLD.discount
       AND NEW.slug IS NOT DISTINCT FROM OLD.slug THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NOT public.is_admin((SELECT auth.uid())) THEN
    RAISE EXCEPTION 'Only administrators can modify products directly';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 4. Trigger on order_items to deduct stock atomically upon item insertion
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trig_deduct_stock_on_order_item()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.products
  SET stock = GREATEST(0, stock - NEW.quantity),
      updated_at = NOW()
  WHERE id = NEW.product_id;

  BEGIN
    INSERT INTO public.inventory_history (product_id, quantity_change, reason)
    VALUES (
      NEW.product_id,
      -NEW.quantity,
      'Order #' || UPPER(SUBSTRING(NEW.order_id::TEXT, 1, 8)) || ' purchase'
    );
  EXCEPTION WHEN OTHERS THEN
    -- Ignore history logging failures if any
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_deduct_stock_on_order_item ON public.order_items;
CREATE TRIGGER trigger_deduct_stock_on_order_item
  AFTER INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trig_deduct_stock_on_order_item();
