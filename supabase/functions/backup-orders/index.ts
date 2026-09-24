// One-time backup: dump orders + order_items in chunks to order-backups bucket (no ZIP, low memory)
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

    const ts = new Date().toISOString().slice(0, 10);
    const folder = `backup_${ts}`;
    const pageSize = 1000;
    const result: Record<string, number> = {};

    for (const table of ["orders", "order_items"]) {
      let from = 0;
      let part = 0;
      let total = 0;
      while (true) {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .order("id", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        const path = `${folder}/${table}_part_${String(part).padStart(3, "0")}.json`;
        const { error: upErr } = await supabase.storage
          .from("order-backups")
          .upload(path, new TextEncoder().encode(JSON.stringify(data)), {
            contentType: "application/json",
            upsert: true,
          });
        if (upErr) throw upErr;
        total += data.length;
        part++;
        if (data.length < pageSize) break;
        from += pageSize;
      }
      result[table] = total;
    }

    await supabase.storage.from("order-backups").upload(
      `${folder}/meta.json`,
      new TextEncoder().encode(JSON.stringify({ created_at: new Date().toISOString(), ...result })),
      { contentType: "application/json", upsert: true },
    );

    return new Response(JSON.stringify({ ok: true, folder, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
