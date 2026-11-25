-- Fix admin_get_all_orders search to support searching with or without '#' prefix
CREATE OR REPLACE FUNCTION public.admin_get_all_orders(
  p_status text DEFAULT NULL::text,
  p_search text DEFAULT NULL::text,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  customer_email text,
  customer_name text,
  status text,
  order_status text,
  payment_status text,
  payment_method text,
  total_amount numeric,
  subtotal_amount numeric,
  shipping_amount numeric,
  discount_amount numeric,
  tax_amount numeric,
  tracking_number text,
  courier text,
  shipping_address text,
  shipping_method text,
  coupon_code text,
  items_count bigint,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  clean_search TEXT;
BEGIN
  IF NOT public.is_admin((SELECT auth.uid())) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Strip leading/trailing '#' and whitespace from the search term
  clean_search := TRIM(BOTH ' #' FROM COALESCE(p_search, ''));

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
      OR clean_search = ''
      OR o.id::TEXT ILIKE '%' || clean_search || '%'
      OR u.email ILIKE '%' || clean_search || '%'
      OR COALESCE(p.name, '') ILIKE '%' || clean_search || '%'
      OR o.tracking_number ILIKE '%' || clean_search || '%'
    )
  ORDER BY o.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;
