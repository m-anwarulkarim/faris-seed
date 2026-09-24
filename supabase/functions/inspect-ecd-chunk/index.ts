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
    const chunk = url.searchParams.get("chunk") || "000";
    const path = `ecd_import/chunk_${chunk}.json`;
    const { data: file, error } = await supabase.storage.from("order-backups").download(path);
    if (error || !file) {
      return new Response(JSON.stringify({ ok: false, error: error?.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const rows = JSON.parse(await file.text());
    return new Response(JSON.stringify({
      ok: true,
      total: rows.length,
      keys: Object.keys(rows[0] || {}),
      sample: rows.slice(0, 2),
    }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
