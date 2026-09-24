// Watched-user activity alert. Called fire-and-forget from frontend
// when a known suspicious visitor performs an important action.
// Sends a single SMS via the existing sms-api function, rate-limited
// at the DB layer (1 SMS per 30 minutes per watch entry).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  action: string;          // "order_placed" | "comment" | "post" | "login" | "checkout_start" | "page_view"
  page_path?: string;
  phone?: string;
  ip_address?: string;
  visitor_id?: string;
  visitor_profile_id?: string;
  extra?: string;          // any short context line
}

function bdTimeNow(): string {
  const now = new Date();
  // BST = UTC+6
  const bd = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  const hh = String(bd.getUTCHours()).padStart(2, "0");
  const mm = String(bd.getUTCMinutes()).padStart(2, "0");
  const dd = String(bd.getUTCDate()).padStart(2, "0");
  const mo = String(bd.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mo} ${hh}:${mm}`;
}

function actionLabel(a: string): string {
  switch (a) {
    case "order_placed": return "ORDER";
    case "comment": return "COMMENT";
    case "post": return "POST";
    case "login": return "LOGIN";
    case "checkout_start": return "CHECKOUT";
    case "page_view": return "VISIT";
    default: return a.toUpperCase();
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Payload;
    if (!body || !body.action) {
      return new Response(JSON.stringify({ ok: false, error: "missing action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Owner alert toggle
    const { data: alertEnabled } = await supabase.rpc("owner_alert_enabled", { _category: "watched_user" });
    if (alertEnabled === false) {
      return new Response(JSON.stringify({ ok: true, watched: false, alerted: false, reason: "owner_disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check the watchlist + atomic rate-limit gate
    const { data: matches, error: rpcErr } = await supabase.rpc("check_watched_activity", {
      _phone: body.phone || null,
      _ip: body.ip_address || null,
      _visitor_id: body.visitor_id || null,
      _visitor_profile_id: body.visitor_profile_id || null,
    });

    if (rpcErr) {
      console.error("check_watched_activity error:", rpcErr);
      return new Response(JSON.stringify({ ok: false, error: rpcErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const match = (matches as any[])?.[0];
    if (!match) {
      return new Response(JSON.stringify({ ok: true, watched: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!match.should_alert) {
      // Watched but rate-limited
      return new Response(JSON.stringify({ ok: true, watched: true, alerted: false, reason: "rate_limited" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build SMS body (Bengali kept short to fit ~3 SMS parts max)
    const namePart = match.name ? match.name : "Watched user";
    const ipPart = body.ip_address ? ` IP:${body.ip_address}` : "";
    const phonePart = body.phone ? ` ${body.phone}` : "";
    const pagePart = body.page_path ? ` p:${body.page_path}` : "";
    const extraPart = body.extra ? ` | ${body.extra}` : "";

    const text = `[ALERT] ${namePart}${phonePart} — ${actionLabel(body.action)}${pagePart}${ipPart} @ ${bdTimeNow()}${extraPart}`;

    // Fire SMS via existing sms-api function
    const smsRes = await supabase.functions.invoke("sms-api", {
      body: {
        number: match.alert_phone,
        message: text,
        reason: "watched_user_alert",
      },
    });

    if (smsRes.error) {
      console.error("sms-api invoke error:", smsRes.error);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        watched: true,
        alerted: true,
        sent_to: match.alert_phone,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("watched-user-alert error:", e?.message || e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
