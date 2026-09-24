// Forensic data ingest — only stores data when the visitor matches the watchlist.
// Public endpoint (no JWT). Admin reads via RLS.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getRealIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip")
      || req.headers.get("x-real-ip")
      || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const ip = body.ip_address || getRealIp(req);
    const profileId = body.visitor_profile_id || null;
    const visitorId = body.visitor_id || null;
    const phone = body.phone || null;

    // Server-side watchlist match — drops everyone else.
    const { data: watchedId, error: matchErr } = await supabase.rpc("match_watched_visitor", {
      _profile_id: profileId,
      _visitor_id: visitorId,
      _ip: ip,
      _phone: phone,
    });

    if (matchErr) {
      console.error("match_watched_visitor failed", matchErr);
      return new Response(JSON.stringify({ ok: true, matched: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!watchedId) {
      // Not on watchlist — drop silently
      return new Response(JSON.stringify({ ok: true, matched: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const insertRow = {
      visitor_profile_id: profileId,
      visitor_id: visitorId,
      watched_visitor_id: watchedId,
      ip_address: ip,
      webrtc_local_ips: body.webrtc_local_ips || null,
      webrtc_public_ip: body.webrtc_public_ip || null,
      user_agent: body.user_agent || req.headers.get("user-agent"),
      device_fingerprint: body.device_fingerprint || null,
      canvas_fingerprint: body.canvas_fingerprint || null,
      webgl_fingerprint: body.webgl_fingerprint || null,
      audio_fingerprint: body.audio_fingerprint || null,
      fonts_list: body.fonts_list || null,
      screen_info: body.screen_info || null,
      hardware_info: body.hardware_info || null,
      timezone: body.timezone || null,
      languages: body.languages || null,
      platform: body.platform || null,
      plugins: body.plugins || null,
      battery_info: body.battery_info || null,
      network_info: body.network_info || null,
      page_path: body.page_path || null,
      referrer: body.referrer || null,
      action_type: body.action_type || "page_view",
      action_details: body.action_details || null,
      session_duration_ms: body.session_duration_ms || null,
      behavioral_metrics: body.behavioral_metrics || null,
    };

    const { error: insErr } = await supabase.from("forensic_logs").insert(insertRow);
    if (insErr) {
      console.error("forensic_logs insert failed", insErr);
      return new Response(JSON.stringify({ ok: false, error: insErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, matched: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("forensic-collect error", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
