
DROP POLICY IF EXISTS "Public can read safe storefront settings" ON public.app_settings;
CREATE POLICY "Public can read safe storefront settings"
ON public.app_settings FOR SELECT
TO anon, authenticated
USING (key = ANY (ARRAY['meta_pixel_id','gtm_id','floating_contact_buttons','delivery_tiers','delivery_tiers_enabled','dhaka_delivery_charges','thankyou_offers']));

CREATE OR REPLACE FUNCTION public.add_order_upsell(
  p_order_id uuid,
  p_offer_id text,
  p_quantity integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_offers jsonb;
  v_offer jsonb;
  v_qty integer := GREATEST(1, LEAST(COALESCE(p_quantity, 1), 5));
  v_price numeric;
  v_new_total numeric;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_found');
  END IF;

  IF v_order.created_at < now() - interval '3 hours' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_late');
  END IF;

  IF COALESCE(v_order.status, 'pending') NOT IN ('pending', 'new', 'processing', 'confirmed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_locked');
  END IF;

  SELECT value::jsonb INTO v_offers FROM public.app_settings WHERE key = 'thankyou_offers';
  IF v_offers IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_offers');
  END IF;

  SELECT elem INTO v_offer
  FROM jsonb_array_elements(v_offers) AS elem
  WHERE elem->>'id' = p_offer_id
  LIMIT 1;

  IF v_offer IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'offer_not_found');
  END IF;

  v_price := (v_offer->>'price')::numeric;
  IF v_price IS NULL OR v_price < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_price');
  END IF;

  INSERT INTO public.order_items (order_id, product_id, product_name, product_image, quantity, unit_price)
  VALUES (p_order_id, NULL, v_offer->>'name', NULLIF(v_offer->>'image', ''), v_qty, v_price);

  v_new_total := COALESCE(v_order.total_amount, 0) + (v_price * v_qty);
  UPDATE public.orders SET total_amount = v_new_total, updated_at = now() WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'added_amount', v_price * v_qty, 'total_amount', v_new_total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_order_upsell(uuid, text, integer) TO anon, authenticated;
