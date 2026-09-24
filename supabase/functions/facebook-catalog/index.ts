// Facebook Catalog XML feed — public, no auth.
// URL: https://<project>.functions.supabase.co/facebook-catalog
// Also exposes ?format=csv for CSV upload.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SITE = "https://grihanova.com";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function xmlEscape(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function csvEscape(s: string): string {
  const v = String(s ?? "");
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xml";

  // Pull all visible, in-stock products (Facebook accepts out of stock too via availability tag)
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, slug, short_description, full_description, product_image, regular_price, offer_price, stock, category, sku, tag, is_hidden, stock_out_display")
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    return new Response(`Error: ${error.message}`, { status: 500, headers: cors });
  }

  const rows = (products ?? []).map((p) => {
    const price = Number(p.offer_price || p.regular_price || 0);
    const link = `${SITE}/products/${p.slug || p.id}`;
    const image = p.product_image?.startsWith("http")
      ? p.product_image
      : `${SITE}${p.product_image || ""}`;
    const availability =
      p.stock_out_display === "visible" || (p.stock ?? 0) <= 0
        ? "out of stock"
        : "in stock";
    const description = (p.short_description || p.full_description || p.name || "")
      .replace(/<[^>]+>/g, "")
      .slice(0, 4900);
    return {
      id: p.sku || p.id,
      title: (p.name || "Product").slice(0, 150),
      description,
      availability,
      condition: "new",
      price: `${price.toFixed(2)} BDT`,
      link,
      image_link: image,
      brand: "Griha Nova",
      product_type: p.category || "General",
      google_product_category: "Apparel & Accessories",
    };
  });

  if (format === "csv") {
    const headers = [
      "id", "title", "description", "availability", "condition",
      "price", "link", "image_link", "brand", "product_type", "google_product_category",
    ];
    const csv = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => csvEscape((r as any)[h])).join(",")),
    ].join("\n");
    return new Response(csv, {
      headers: {
        ...cors,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="facebook-catalog.csv"',
        "Cache-Control": "public, max-age=1800",
      },
    });
  }

  const items = rows
    .map(
      (r) => `    <item>
      <g:id>${xmlEscape(r.id)}</g:id>
      <g:title>${xmlEscape(r.title)}</g:title>
      <g:description>${xmlEscape(r.description)}</g:description>
      <g:availability>${xmlEscape(r.availability)}</g:availability>
      <g:condition>${xmlEscape(r.condition)}</g:condition>
      <g:price>${xmlEscape(r.price)}</g:price>
      <g:link>${xmlEscape(r.link)}</g:link>
      <g:image_link>${xmlEscape(r.image_link)}</g:image_link>
      <g:brand>${xmlEscape(r.brand)}</g:brand>
      <g:product_type>${xmlEscape(r.product_type)}</g:product_type>
      <g:google_product_category>${xmlEscape(r.google_product_category)}</g:google_product_category>
    </item>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Griha Nova Catalog</title>
    <link>${SITE}</link>
    <description>Product catalog for Facebook / Meta Commerce</description>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      ...cors,
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=1800",
    },
  });
});
