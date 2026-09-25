import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = "https://farisshop.com";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const now = new Date().toISOString().split("T")[0];

  // Static pages
  const staticPages = [
    { loc: "/", priority: "1.0", changefreq: "daily" },
    { loc: "/products", priority: "0.9", changefreq: "daily" },
    { loc: "/categories", priority: "0.8", changefreq: "weekly" },
    { loc: "/services", priority: "0.7", changefreq: "weekly" },
    { loc: "/contact", priority: "0.5", changefreq: "monthly" },
    { loc: "/offers", priority: "0.7", changefreq: "daily" },
    { loc: "/privacy-policy", priority: "0.3", changefreq: "yearly" },
  ];

  // Fetch dynamic data in parallel
  const [productsRes, categoriesRes, tagsRes, pagesRes] = await Promise.all([
    supabase.from("products").select("id, slug, updated_at").eq("is_hidden", false).order("position"),
    supabase.from("categories").select("name, slug, created_at").order("position"),
    supabase.from("tags").select("name, created_at"),
    supabase.from("custom_pages").select("slug, updated_at").eq("is_published", true),
  ]);

  const products = productsRes.data || [];
  const categories = categoriesRes.data || [];
  const tags = tagsRes.data || [];
  const pages = pagesRes.data || [];

  // Build URL entries
  let urls = "";

  // Static pages
  for (const p of staticPages) {
    urls += `  <url>
    <loc>${SITE_URL}${p.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>\n`;
  }

  // Products
  for (const p of products) {
    const lastmod = p.updated_at?.split("T")[0] || now;
    const productSlug = p.slug || p.id;
    urls += `  <url>
    <loc>${SITE_URL}/product/${productSlug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>\n`;
  }

  // Categories — prefer slug, fallback to name
  for (const c of categories) {
    const slug = encodeURIComponent((c.slug || c.name || "").toString());
    urls += `  <url>
    <loc>${SITE_URL}/category/${slug}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>\n`;
  }

  // Category slugs for /products/:slug
  for (const c of categories) {
    const slug = c.name.toLowerCase().replace(/\s+/g, "-");
    urls += `  <url>
    <loc>${SITE_URL}/products/${encodeURIComponent(slug)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>\n`;
  }

  // Tags
  for (const t of tags) {
    const slug = encodeURIComponent(t.name);
    urls += `  <url>
    <loc>${SITE_URL}/tag/${slug}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>\n`;
  }

  // Custom pages
  for (const p of pages) {
    const lastmod = p.updated_at?.split("T")[0] || now;
    urls += `  <url>
    <loc>${SITE_URL}/${p.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>\n`;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
