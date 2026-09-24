// TikTok Events API (server-side CAPI) — deduplicated with browser pixel via event_id
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input.trim().toLowerCase()));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Load credentials from app_settings (admin-configured), fallback to env
    let PIXEL_ID = Deno.env.get("TIKTOK_PIXEL_ID") || "";
    let ACCESS_TOKEN = Deno.env.get("TIKTOK_ACCESS_TOKEN") || "";
    try {
      const supa = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data } = await supa
        .from("app_settings")
        .select("key, value")
        .in("key", ["tiktok_pixel_id", "tiktok_access_token"]);
      data?.forEach((r: any) => {
        if (r.key === "tiktok_pixel_id" && r.value) PIXEL_ID = r.value;
        if (r.key === "tiktok_access_token" && r.value) ACCESS_TOKEN = r.value;
      });
    } catch (_) { /* fallback to env */ }

    if (!PIXEL_ID || !ACCESS_TOKEN) {
      return new Response(JSON.stringify({ error: "TikTok credentials not configured" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { event_name, event_id, event_source_url, custom_data = {}, user_data = {} } = body;
    if (!event_name || !event_id) {
      return new Response(JSON.stringify({ error: "event_name and event_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "";
    const ua = req.headers.get("user-agent") || "";

    const ud: Record<string, string> = {};
    if (user_data.ph) ud.phone = await sha256(String(user_data.ph));
    if (user_data.em) ud.email = await sha256(String(user_data.em));
    if (ip) ud.ip = ip;
    if (ua) ud.user_agent = ua;

    const payload = {
      event_source: "web",
      event_source_id: PIXEL_ID,
      data: [{
        event: event_name,
        event_time: Math.floor(Date.now() / 1000),
        event_id,
        user: ud,
        properties: {
          currency: custom_data.currency || "BDT",
          value: custom_data.value,
          content_type: custom_data.content_type || "product",
          contents: custom_data.content_ids?.map((id: string) => ({ content_id: id })) || undefined,
        },
        page: { url: event_source_url },
      }],
    };

    const resp = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Access-Token": ACCESS_TOKEN },
      body: JSON.stringify(payload),
    });
    const result = await resp.json();
    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
