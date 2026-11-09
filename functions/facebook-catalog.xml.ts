const SITE = "https://farisshop.com";
const SUPABASE_URL = "https://nubvbenwbrytvzqeysxr.supabase.co";
const SUPABASE_KEY = "sb_publishable_pOKowQfGx75riR3as_3LWw_xzglGE-g";

function xmlEscape(s: any): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function onRequestGet() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/products?is_hidden=eq.false&select=id,name,slug,short_description,full_description,product_image,regular_price,offer_price,stock,category,sku&order=created_at.desc`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (!res.ok) {
      return new Response("Failed to fetch products", { status: 500 });
    }

    const products = (await res.json()) as any[];

    const items = products.map((p) => {
      const price = Number(p.offer_price || p.regular_price || 0);
      const link = `${SITE}/products/${p.slug || p.id}`;
      const image = p.product_image?.startsWith("http")
        ? p.product_image
        : `${SITE}${p.product_image || ""}`;
      const availability = (p.stock ?? 0) > 0 ? "in stock" : "out of stock";
      const description = (p.short_description || p.full_description || p.name || "")
        .replace(/<[^>]+>/g, "")
        .slice(0, 4900);

      return `    <item>
      <g:id>${xmlEscape(p.sku || p.id)}</g:id>
      <g:title>${xmlEscape(p.name || "Product")}</g:title>
      <g:description>${xmlEscape(description)}</g:description>
      <g:availability>${xmlEscape(availability)}</g:availability>
      <g:condition>new</g:condition>
      <g:price>${price.toFixed(2)} BDT</g:price>
      <g:link>${xmlEscape(link)}</g:link>
      <g:image_link>${xmlEscape(image)}</g:image_link>
      <g:brand>Faris Seed</g:brand>
      <g:product_type>${xmlEscape(p.category || "Flower Seeds")}</g:product_type>
      <g:google_product_category>Home &amp; Garden &gt; Plants &gt; Seeds</g:google_product_category>
    </item>`;
    }).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Faris Seed Catalog</title>
    <link>${SITE}</link>
    <description>Product catalog for Faris Seed (Facebook / Meta Commerce)</description>
${items}
  </channel>
</rss>`;

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=900", // cache 15 min
      },
    });
  } catch (err: any) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}
