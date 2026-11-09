const SITE = "https://farisshop.com";
const SUPABASE_URL = "https://nubvbenwbrytvzqeysxr.supabase.co";
const SUPABASE_KEY = "sb_publishable_pOKowQfGx75riR3as_3LWw_xzglGE-g";

function csvEscape(v: any): string {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
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

    const headers = [
      "id", "title", "description", "availability", "condition",
      "price", "link", "image_link", "brand", "product_type", "google_product_category",
    ];

    const rows = products.map((p) => {
      const price = Number(p.offer_price || p.regular_price || 0);
      const link = `${SITE}/products/${p.slug || p.id}`;
      const image = p.product_image?.startsWith("http")
        ? p.product_image
        : `${SITE}${p.product_image || ""}`;
      const availability = (p.stock ?? 0) > 0 ? "in stock" : "out of stock";
      const description = (p.short_description || p.full_description || p.name || "")
        .replace(/<[^>]+>/g, "")
        .slice(0, 4900);

      const obj: Record<string, string> = {
        id: p.sku || p.id,
        title: (p.name || "Product").slice(0, 150),
        description,
        availability,
        condition: "new",
        price: `${price.toFixed(2)} BDT`,
        link,
        image_link: image,
        brand: "Faris Seed",
        product_type: p.category || "Flower Seeds",
        google_product_category: "Home & Garden > Plants > Seeds",
      };

      return headers.map((h) => csvEscape(obj[h])).join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "public, max-age=900", // cache 15 min
      },
    });
  } catch (err: any) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}

