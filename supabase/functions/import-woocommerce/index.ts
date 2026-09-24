import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const WC_KEY = Deno.env.get("WC_CONSUMER_KEY");
    const WC_SECRET = Deno.env.get("WC_CONSUMER_SECRET");
    if (!WC_KEY || !WC_SECRET) {
      throw new Error("WooCommerce credentials not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse optional page param from body
    let reqPage = 1;
    let reqPerPage = 20;
    try {
      const body = await req.json();
      if (body.page) reqPage = body.page;
      if (body.per_page) reqPerPage = Math.min(body.per_page, 50);
    } catch { /* no body is fine */ }

    const url = `https://bij-bd.com/wp-json/wc/v3/products?per_page=${reqPerPage}&page=${reqPage}&consumer_key=${WC_KEY}&consumer_secret=${WC_SECRET}`;
    console.log("Fetching:", url.replace(WC_KEY, "***").replace(WC_SECRET, "***"));
    
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`WooCommerce API error [${res.status}]: ${text}`);
    }
    
    const totalPages = parseInt(res.headers.get("x-wp-totalpages") || "1");
    const totalProducts = parseInt(res.headers.get("x-wp-total") || "0");
    const wcProducts = await res.json();

    const stripHtml = (html: string) => html?.replace(/<[^>]*>/g, "").trim() || null;

    const mapped = wcProducts.map((p: any) => {
      const regularPrice = parseFloat(p.regular_price) || 0;
      const salePrice = p.sale_price ? parseFloat(p.sale_price) : null;
      const mainImage = p.images?.[0]?.src || null;
      const gallery = p.images?.slice(1).map((img: any) => img.src) || [];

      return {
        name: p.name,
        sku: p.sku || `wc-${p.id}`,
        regular_price: regularPrice,
        offer_price: salePrice && salePrice < regularPrice ? salePrice : null,
        short_description: stripHtml(p.short_description),
        full_description: stripHtml(p.description),
        product_image: mainImage,
        image_gallery: gallery.length > 0 ? gallery : null,
        stock: p.stock_quantity ?? (p.in_stock ? 999 : 0),
        tag: p.categories?.map((c: any) => c.name).join(", ") || null,
      };
    });

    let inserted = 0;
    let updated = 0;
    for (const product of mapped) {
      const { data: existing } = await supabase
        .from("products")
        .select("id")
        .eq("sku", product.sku)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase.from("products").update(product).eq("id", existing.id);
        if (error) console.error("Update error:", error);
        else updated++;
      } else {
        const { error } = await supabase.from("products").insert(product);
        if (error) console.error("Insert error:", error);
        else inserted++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        page: reqPage,
        total_pages: totalPages,
        total_wc_products: totalProducts,
        fetched: wcProducts.length,
        inserted,
        updated,
        has_more: reqPage < totalPages,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Import error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
