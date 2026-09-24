import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { keyword, severity, sender_name, message_preview } = await req.json();

    if (!keyword) {
      return new Response(
        JSON.stringify({ error: "keyword is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get admin user IDs from user_roles
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "moderator"]);

    if (!adminRoles || adminRoles.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No admin users found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call the existing send-push function to broadcast to all subscribers
    // (admins will have push subscriptions from their browser)
    const title = severity === "critical"
      ? "🚨 Critical Alert: Flagged Message"
      : "⚠️ Flagged Message Detected";

    const senderLabel = sender_name || "Unknown";
    const preview = message_preview
      ? message_preview.slice(0, 80)
      : keyword;

    const body = `${senderLabel}: "${preview}" — Keyword: ${keyword}`;

    // Use internal send-push function
    const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        title,
        body,
        url: "/e/message-monitor",
        tag: `flag-${keyword}`,
        send_to_admins: true,
      }),
    });

    const pushResult = await pushResponse.json();

    return new Response(
      JSON.stringify({ success: true, push: pushResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Notify critical flag error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
