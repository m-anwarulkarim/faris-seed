import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { action, api_key, phone } = await req.json();

    // ─── Save API Key ───
    if (action === "update_key") {
      if (!api_key) {
        return new Response(JSON.stringify({ error: "API Key required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "ecomah_api_key", value: api_key, updated_at: now }, { onConflict: "key" });
      if (error) throw error;
      // Clean up old keys
      await supabase.from("app_settings").delete().in("key", ["fraud_checker_api_key", "fraud_checker_api_secret"]);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Delete Key ───
    if (action === "delete_key") {
      await supabase.from("app_settings").delete().in("key", ["ecomah_api_key", "fraud_checker_api_key", "fraud_checker_api_secret"]);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Check Phone (with cache) ───
    if (action === "check" || action === "force_check") {
      if (!phone) {
        return new Response(JSON.stringify({ error: "Phone number required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

      // Check cache first (skip if force_check)
      if (action === "check") {
        const { data: cached } = await supabase
          .from("fraud_data")
          .select("fraudchecker_data, updated_at")
          .eq("phone", phone)
          .maybeSingle();

        if (cached?.fraudchecker_data) {
          const age = Date.now() - new Date(cached.updated_at).getTime();
          const stale = age > CACHE_TTL_MS;
          return new Response(JSON.stringify({ success: true, data: cached.fraudchecker_data, cached: true, stale }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Fetch API key
      const { data: settings } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["ecomah_api_key", "fraud_checker_api_key"]);

      const apiKeyVal = settings?.find((s: any) => s.key === "ecomah_api_key")?.value
        || settings?.find((s: any) => s.key === "fraud_checker_api_key")?.value;

      if (!apiKeyVal) {
        return new Response(JSON.stringify({ error: "E-COMAH API key not configured" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetch("https://api.ecomah.com/fraud-checker", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKeyVal,
        },
        body: JSON.stringify({ action: action === "force_check" ? "force_check" : "check", phone }),
      });

      const text = await res.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch {
        result = { raw: text };
      }

      // Save to cache if valid data
      const isValid = result && !result.raw && !result.error && result.success !== false;
      if (isValid) {
        const cacheData = result.data || result;
        await supabase
          .from("fraud_data")
          .upsert({
            phone,
            fraudchecker_data: cacheData,
            updated_at: new Date().toISOString(),
          }, { onConflict: "phone" });
      }

      return new Response(JSON.stringify({
        success: true,
        data: result.data || result,
        cached: false,
        stale: false,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
