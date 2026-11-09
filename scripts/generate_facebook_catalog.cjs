const fs = require('fs');
const path = require('path');
const pg = require('pg');

const client = new pg.Client({
  connectionString: 'postgresql://postgres.nubvbenwbrytvzqeysxr:rCnH9f8Ohjt7SJec@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true',
  ssl: { rejectUnauthorized: false }
});

const SITE = 'https://farisshop.com';

function xmlEscape(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function csvEscape(s) {
  const v = String(s ?? '');
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT id, name, slug, short_description, full_description, product_image, regular_price, offer_price, stock, category, sku, tag, is_hidden, stock_status_override
    FROM products
    WHERE is_hidden = false
    ORDER BY created_at DESC;
  `);
  await client.end();

  const products = res.rows || [];
  console.log(`Generating catalog for ${products.length} products...`);

  const rows = products.map((p) => {
    const price = Number(p.offer_price || p.regular_price || 0);
    const link = `${SITE}/products/${p.slug || p.id}`;
    const image = p.product_image?.startsWith('http')
      ? p.product_image
      : `${SITE}${p.product_image || ''}`;
    const availability = (p.stock ?? 0) > 0 ? 'in stock' : 'out of stock';
    const description = (p.short_description || p.full_description || p.name || '')
      .replace(/<[^>]+>/g, '')
      .slice(0, 4900);

    return {
      id: p.sku || p.id,
      title: (p.name || 'Product').slice(0, 150),
      description,
      availability,
      condition: 'new',
      price: `${price.toFixed(2)} BDT`,
      link,
      image_link: image,
      brand: 'Faris Seed',
      product_type: p.category || 'Flower Seeds',
      google_product_category: 'Home & Garden > Plants > Seeds',
    };
  });

  // 1. Generate CSV
  const headers = [
    'id', 'title', 'description', 'availability', 'condition',
    'price', 'link', 'image_link', 'brand', 'product_type', 'google_product_category',
  ];
  const csv = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(',')),
  ].join('\n');

  const publicDir = path.join(__dirname, '..', 'public');
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

  fs.writeFileSync(path.join(publicDir, 'facebook-catalog.csv'), csv, 'utf-8');
  console.log('Saved public/facebook-catalog.csv');

  // 2. Generate XML (RSS 2.0 / Google Merchant & Facebook standard)
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
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Faris Seed Catalog</title>
    <link>${SITE}</link>
    <description>Product catalog for Faris Seed (Facebook / Meta Commerce)</description>
${items}
  </channel>
</rss>`;

  fs.writeFileSync(path.join(publicDir, 'facebook-catalog.xml'), xml, 'utf-8');
  console.log('Saved public/facebook-catalog.xml');
}

run().catch(console.error);
