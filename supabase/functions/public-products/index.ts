// Public Products API — read-only endpoint for connected external sites.
// Auth: header `x-api-key: pk_...`
// Endpoints (GET):
//   ?action=list                 → active products (public-safe fields only)
//   ?action=detail&slug=xxx      → single product detail
//   ?action=detail&id=uuid       → single product detail by id
//   ?action=categories           → distinct category list
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const apiKey = req.headers.get("x-api-key") || "";
  if (!apiKey.startsWith("pk_")) return json({ error: "missing_api_key" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Validate site
  const { data: site, error: siteErr } = await supabase
    .from("connected_sites")
    .select("id, is_active, site_slug")
    .eq("api_key", apiKey)
    .maybeSingle();
  if (siteErr) return json({ error: "auth_lookup_failed" }, 500);
  if (!site || !site.is_active) return json({ error: "invalid_or_inactive_key" }, 403);

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "list";

  // Public-safe product fields (NO buying_price, paikari, nursery, cash_back, reserved_stock, incoming_stock)
  const SAFE_FIELDS =
    "id, name, sku, tag, short_description, full_description, product_image, image_gallery, regular_price, offer_price, stock, category, slug, video_url, is_combo, combo_components, stock_out_display, position, is_preorder, preorder_advance, preorder_note";

  try {
    if (action === "list") {
      const { data, error } = await supabase
        .from("products")
        .select(SAFE_FIELDS)
        .eq("is_hidden", false)
        .order("position", { ascending: true });
      if (error) throw error;
      return json({ success: true, count: data?.length || 0, products: data || [] });
    }

    if (action === "detail") {
      const slug = url.searchParams.get("slug");
      const id = url.searchParams.get("id");
      if (!slug && !id) return json({ error: "slug_or_id_required" }, 400);
      const q = supabase.from("products").select(SAFE_FIELDS).eq("is_hidden", false).limit(1);
      const { data, error } = slug ? await q.eq("slug", slug).maybeSingle() : await q.eq("id", id!).maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "not_found" }, 404);
      return json({ success: true, product: data });
    }

    if (action === "categories") {
      const { data, error } = await supabase
        .from("products")
        .select("category")
        .eq("is_hidden", false);
      if (error) throw error;
      const uniq = Array.from(new Set((data || []).map((r: any) => r.category).filter(Boolean)));
      return json({ success: true, categories: uniq });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("public-products error:", e);
    return json({ error: "server_error", message: String((e as Error).message || e) }, 500);
  }
});
