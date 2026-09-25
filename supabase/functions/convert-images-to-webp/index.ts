// Edge function to batch-convert non-WebP product images to WebP.
// Downloads each image, decodes via ImageScript, encodes as WebP-like
// (we use JPEG fallback if WebP encoder unavailable, but ImageScript supports both).
// Uses @jsquash/webp via esm.sh for true WebP encoding.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
// @ts-ignore
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

const NON_WEBP = /\.(jpg|jpeg|png|gif|bmp)(\?|$)/i;

function slugify(name: string): string {
  return (name || "image")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 60)
    .replace(/^-+|-+$/g, "") || "image";
}

async function fetchAndEncodeWebP(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const img = await Image.decode(buf);
  // Cap dimensions
  const maxDim = 1600;
  if (img.width > maxDim || img.height > maxDim) {
    const r = Math.min(maxDim / img.width, maxDim / img.height);
    img.resize(Math.round(img.width * r), Math.round(img.height * r));
  }
  return await img.encodeWEBP(82); // quality 82
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(body.limit ?? 30, 50);

    const { data: products, error } = await sb
      .from("products")
      .select("id, name, product_image, image_gallery")
      .limit(500);
    if (error) throw error;

    interface Job {
      productId: string;
      productName: string;
      field: "product_image" | "image_gallery";
      galleryIndex?: number;
      url: string;
    }
    const jobs: Job[] = [];
    for (const p of products || []) {
      if (p.product_image && NON_WEBP.test(p.product_image)) {
        jobs.push({
          productId: p.id,
          productName: p.name,
          field: "product_image",
          url: p.product_image,
        });
      }
      if (Array.isArray(p.image_gallery)) {
        p.image_gallery.forEach((g: string, i: number) => {
          if (g && NON_WEBP.test(g)) {
            jobs.push({
              productId: p.id,
              productName: p.name,
              field: "image_gallery",
              galleryIndex: i,
              url: g,
            });
          }
        });
      }
    }

    const toProcess = jobs.slice(0, limit);
    const results: any[] = [];
    const galleryCache = new Map<string, string[]>();

    for (const job of toProcess) {
      try {
        const webpBytes = await fetchAndEncodeWebP(job.url);
        const fileName = `${slugify(job.productName)}-faris-seed-${Math.random()
          .toString(36)
          .slice(2, 7)}.webp`;

        const { error: upErr } = await sb.storage
          .from("product-images")
          .upload(fileName, webpBytes, { contentType: "image/webp", upsert: false });
        if (upErr) throw upErr;

        const { data: urlData } = sb.storage.from("product-images").getPublicUrl(fileName);
        const newUrl = urlData.publicUrl;

        if (job.field === "product_image") {
          const { error: updErr } = await sb
            .from("products")
            .update({ product_image: newUrl, updated_at: new Date().toISOString() })
            .eq("id", job.productId);
          if (updErr) throw updErr;
        } else {
          let current = galleryCache.get(job.productId);
          if (!current) {
            const { data: prod } = await sb
              .from("products")
              .select("image_gallery")
              .eq("id", job.productId)
              .single();
            current = [...((prod?.image_gallery as string[]) || [])];
          }
          if (typeof job.galleryIndex === "number") current[job.galleryIndex] = newUrl;
          galleryCache.set(job.productId, current);
          const { error: updErr } = await sb
            .from("products")
            .update({ image_gallery: current, updated_at: new Date().toISOString() })
            .eq("id", job.productId);
          if (updErr) throw updErr;
        }

        results.push({ ok: true, name: job.productName, field: job.field, newUrl });
      } catch (e: any) {
        results.push({
          ok: false,
          name: job.productName,
          field: job.field,
          url: job.url,
          error: e?.message || String(e),
        });
      }
    }

    return new Response(
      JSON.stringify({
        total_pending: jobs.length,
        processed: results.length,
        success: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        results,
      }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
