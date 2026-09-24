// 🔒 DO_NOT_MODIFY_START — Meta CAPI edge function (full file locked)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { event_name, event_id, custom_data, user_data, event_source_url } = await req.json();

    if (!event_name) {
      return new Response(JSON.stringify({ error: "event_name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Pixel ID and CAPI token from app_settings
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: settings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["meta_pixel_id", "meta_capi_token", "meta_test_event_code"]);

    const settingsMap: Record<string, string> = {};
    settings?.forEach((r: { key: string; value: string }) => {
      settingsMap[r.key] = r.value;
    });

    const pixelId = settingsMap["meta_pixel_id"] || Deno.env.get("META_PIXEL_ID");
    const capiToken = settingsMap["meta_capi_token"] || Deno.env.get("META_CAPI_TOKEN");
    const testEventCode = settingsMap["meta_test_event_code"];

    if (!pixelId || !capiToken) {
      // Not configured yet — skip silently so the client does not surface a runtime error.
      return new Response(JSON.stringify({ ok: true, skipped: "capi_not_configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    // Hash user_data fields for Facebook CAPI (requires SHA-256 hashed values)
    const rawUserData = user_data || {};
    const hashedUserData: Record<string, string> = {};
    
    const hashValue = async (val: string) => {
      const encoder = new TextEncoder();
      const data = encoder.encode(val.trim().toLowerCase());
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
    };

    if (rawUserData.ph) {
      let phone = rawUserData.ph.replace(/[^0-9]/g, "");
      if (phone.startsWith("0")) phone = "880" + phone.substring(1);
      hashedUserData.ph = await hashValue(phone);
    }
    if (rawUserData.fn) hashedUserData.fn = await hashValue(rawUserData.fn);
    if (rawUserData.ln) hashedUserData.ln = await hashValue(rawUserData.ln);
    if (rawUserData.em) hashedUserData.em = await hashValue(rawUserData.em);
    if (rawUserData.ct) hashedUserData.ct = await hashValue(rawUserData.ct);
    if (rawUserData.country) hashedUserData.country = await hashValue(rawUserData.country);

    // Facebook CAPI requires at least one user identifier — use client IP + user agent as fallback
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || null;
    const clientUa = req.headers.get("user-agent") || null;

    if (clientIp) hashedUserData.client_ip_address = clientIp; // sent unhashed per FB spec
    if (clientUa) hashedUserData.client_user_agent = clientUa; // sent unhashed per FB spec

    // Build the event payload for Facebook Conversions API
    const eventData: Record<string, unknown> = {
      event_name,
      event_time: Math.floor(Date.now() / 1000),
      action_source: "website",
      event_source_url: event_source_url || "",
      user_data: hashedUserData,
    };

    if (event_id) {
      eventData.event_id = event_id;
    }

    if (custom_data) {
      eventData.custom_data = custom_data;
    }

    // Send to Facebook Conversions API
    const fbResponse = await fetch(
      `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${capiToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: [eventData],
          ...(testEventCode ? { test_event_code: testEventCode } : {}),
        }),
      }
    );


    const fbResult = await fbResponse.json();

    if (!fbResponse.ok) {
      console.error("Facebook CAPI error:", fbResult);
      return new Response(JSON.stringify({ error: "Facebook API error", details: fbResult }), {
        status: fbResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, result: fbResult }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("CAPI edge function error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
// 🔒 DO_NOT_MODIFY_END
