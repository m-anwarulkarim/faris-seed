import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Fetch all visible products with image
  const { data: products } = await sb
    .from('products')
    .select('name, sku, category, product_image, image_gallery')
    .eq('is_hidden', false)
    .not('product_image', 'is', null);

  // List all storage files
  const allFiles = new Set<string>();
  let offset = 0;
  while (true) {
    const { data, error } = await sb.storage.from('product-images').list('', { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' }});
    if (error || !data || data.length === 0) break;
    data.filter((f: any) => f.id).forEach((f: any) => allFiles.add(f.name));
    if (data.length < 1000) break;
    offset += 1000;
  }

  const broken: any[] = [];
  const galleryBroken: any[] = [];
  for (const p of products || []) {
    const fname = (p.product_image as string).split('/').pop()!;
    if (!allFiles.has(fname)) broken.push({ name: p.name, sku: p.sku, category: p.category, missing: fname });
    if (Array.isArray(p.image_gallery)) {
      for (const g of p.image_gallery) {
        const gname = String(g).split('/').pop()!;
        if (!allFiles.has(gname)) galleryBroken.push({ sku: p.sku, missing: gname });
      }
    }
  }

  return new Response(JSON.stringify({
    total_products: products?.length || 0,
    total_storage_files: allFiles.size,
    broken_main_count: broken.length,
    broken_gallery_count: galleryBroken.length,
    broken_main: broken.slice(0, 50),
    broken_gallery_sample: galleryBroken.slice(0, 20),
  }, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
});
