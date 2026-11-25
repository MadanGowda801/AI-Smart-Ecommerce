-- Migration: place_order_safe function
-- Atomic order placement with server-side price validation and stock deduction

CREATE OR REPLACE FUNCTION public.place_order_safe(
  p_user_id        UUID,
  p_items          JSONB,
  p_shipping_addr  TEXT,
  p_payment_method TEXT,
  p_shipping_method TEXT,
  p_coupon_code    TEXT,
  p_discount_amt   NUMERIC,
  p_shipping_amt   NUMERIC,
  p_tax_amt        NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item           JSONB;
  v_product_id     UUID;
  v_quantity       INTEGER;
  v_db_price       NUMERIC;
  v_db_stock       INTEGER;
  v_subtotal       NUMERIC := 0;
  v_total          NUMERIC;
  v_order_id       UUID;
  v_tracking_no    TEXT;
  v_courier        TEXT;
  v_est_delivery   TEXT;
  v_payment_status TEXT;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity   := (v_item->>'quantity')::INTEGER;

    IF v_quantity <= 0 THEN
      RETURN jsonb_build_object('error', 'Invalid quantity');
    END IF;

    SELECT price, stock INTO v_db_price, v_db_stock
      FROM public.products WHERE id = v_product_id FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Product not found: ' || v_product_id);
    END IF;

    IF v_db_stock < v_quantity THEN
      RETURN jsonb_build_object('error',
        'Insufficient stock. Available: ' || v_db_stock || ', requested: ' || v_quantity);
    END IF;

    v_subtotal := v_subtotal + (v_db_price * v_quantity);
  END LOOP;

  v_total := GREATEST(0,
    v_subtotal - COALESCE(p_discount_amt, 0)
    + COALESCE(p_shipping_amt, 0)
    + COALESCE(p_tax_amt, 0));

  v_tracking_no := (ARRAY['BLU','DTX','EKT','DHL','FDX'])[floor(random()*5+1)::int]
                   || '-IND-' || floor(10000000 + random() * 90000000)::bigint::text;

  v_courier := CASE p_shipping_method
    WHEN 'express' THEN 'BlueDart Express Air'
    WHEN 'sameday' THEN 'EcomExpress Same-Day'
    ELSE 'BlueDart Ground'
  END;

  v_est_delivery := CASE p_shipping_method
    WHEN 'express' THEN 'In 1-2 business days'
    WHEN 'sameday' THEN 'Today by 8:00 PM'
    ELSE 'In 3-5 business days'
  END;

  v_payment_status := CASE WHEN lower(p_payment_method) LIKE '%cod%' THEN 'pending' ELSE 'paid' END;

  INSERT INTO public.orders (
    user_id, total_amount, subtotal_amount, discount_amount,
    tax_amount, shipping_amount, shipping_address,
    payment_method, payment_status, shipping_method, coupon_code,
    tracking_number, courier, estimated_delivery, status, order_status
  ) VALUES (
    p_user_id, v_total, v_subtotal, COALESCE(p_discount_amt,0),
    COALESCE(p_tax_amt,0), COALESCE(p_shipping_amt,0), p_shipping_addr,
    p_payment_method, v_payment_status, COALESCE(p_shipping_method,'standard'), p_coupon_code,
    v_tracking_no, v_courier, v_est_delivery, 'placed', 'placed'
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity   := (v_item->>'quantity')::INTEGER;
    SELECT price INTO v_db_price FROM public.products WHERE id = v_product_id;
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, price)
    VALUES (v_order_id, v_product_id, v_quantity, v_db_price, v_db_price);
    UPDATE public.products SET stock = stock - v_quantity, updated_at = NOW()
    WHERE id = v_product_id;
  END LOOP;

  INSERT INTO public.payments (order_id, user_id, amount, payment_method, payment_status, transaction_reference)
  VALUES (v_order_id, p_user_id, v_total, p_payment_method, v_payment_status,
          'TXN-' || extract(epoch from now())::bigint::text);

  DELETE FROM public.cart_items WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'total', v_total,
    'subtotal', v_subtotal,
    'tracking_number', v_tracking_no,
    'courier', v_courier,
    'estimated_delivery', v_est_delivery,
    'payment_status', v_payment_status
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_order_safe(UUID, JSONB, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC)
  TO authenticated;