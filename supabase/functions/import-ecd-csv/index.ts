// One-shot ECD CSV import: reads JSON chunks from order-backups/ecd_import/ and inserts into orders
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const startChunk = parseInt(url.searchParams.get("start") || "0");
    const endChunk = parseInt(url.searchParams.get("end") || "25");

    const result: { chunk: number; inserted: number; error?: string }[] = [];

    for (let i = startChunk; i <= endChunk; i++) {
      const path = `ecd_import/chunk_${String(i).padStart(3, "0")}.json`;
      const { data: file, error: dErr } = await supabase.storage
        .from("order-backups")
        .download(path);
      if (dErr || !file) {
        result.push({ chunk: i, inserted: 0, error: dErr?.message || "no file" });
        continue;
      }
      const text = await file.text();
      const rows = JSON.parse(text);

      // Insert in sub-batches of 500 to avoid payload limits
      let totalInserted = 0;
      for (let j = 0; j < rows.length; j += 500) {
        const batch = rows.slice(j, j + 500);
        const { error: iErr, count } = await supabase
          .from("orders")
          .insert(batch, { count: "exact" });
        if (iErr) {
          result.push({ chunk: i, inserted: totalInserted, error: iErr.message });
          break;
        }
        totalInserted += count || batch.length;
      }
      result.push({ chunk: i, inserted: totalInserted });
    }

    const total = result.reduce((s, r) => s + r.inserted, 0);
    return new Response(JSON.stringify({ ok: true, total, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
