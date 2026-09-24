CREATE OR REPLACE FUNCTION public.current_customer_phone()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nullif(regexp_replace(coalesce(cp.phone,''), '[^0-9]', '', 'g'), '')
  FROM public.customer_profiles cp
  WHERE cp.id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.customer_owns_order(_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = _order_id
      AND public.current_customer_phone() IS NOT NULL
      AND right(regexp_replace(coalesce(o.phone,''), '[^0-9]', '', 'g'), 10)
          = right(public.current_customer_phone(), 10)
  )
$$;

CREATE POLICY "Customers can read own orders by phone"
ON public.orders FOR SELECT TO authenticated
USING (
  public.current_customer_phone() IS NOT NULL
  AND right(regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g'), 10)
      = right(public.current_customer_phone(), 10)
);

CREATE POLICY "Customers can read own order items by phone"
ON public.order_items FOR SELECT TO authenticated
USING (public.customer_owns_order(order_id));

CREATE POLICY "Customers can read own order history by phone"
ON public.order_status_history FOR SELECT TO authenticated
USING (public.customer_owns_order(order_id));

GRANT SELECT ON public.order_status_history TO authenticated;