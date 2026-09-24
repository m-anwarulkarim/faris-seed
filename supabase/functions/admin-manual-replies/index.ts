// One-shot admin endpoint: deliver handcrafted replies to specific FB sessions.
// POST { replies: [{ session_id, text }] }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { replaceNamaskar } from "../_shared/namaskarReplace.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function sendFB(pageToken: string, recipientId: string, text: string) {
  const r = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${pageToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
  });
  if (!r.ok) {
    const err = await r.text().catch(() => "");
    return { ok: false, error: `${r.status} ${err.slice(0, 300)}` };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const body = await req.json().catch(() => ({}));
  const replies: Array<{ session_id: string; text: string }> = body?.replies || [];

  const { data: tokenRow } = await supabase
    .from("app_settings").select("value").eq("key", "fb_page_access_token").maybeSingle();
  const PAGE_TOKEN = tokenRow?.value || "";
  if (!PAGE_TOKEN) {
    return new Response(JSON.stringify({ error: "no fb token" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const results: any[] = [];
  for (const rRaw of replies) {
    // 🔒 LOCKED (5×): namaskar → আসসালামু আলাইকুম on every outbound admin reply
    const r = { ...rRaw, text: replaceNamaskar(rRaw.text || "") };
    const { data: s } = await supabase
      .from("ai_chat_sessions").select("id, customer_phone, messages").eq("id", r.session_id).maybeSingle();
    if (!s) { results.push({ session_id: r.session_id, status: "not_found" }); continue; }

    const phone = s.customer_phone || "";
    if (!phone.startsWith("fb:")) { results.push({ session_id: r.session_id, status: "not_fb" }); continue; }
    const psid = phone.slice(3);

    const send = await sendFB(PAGE_TOKEN, psid, r.text);
    if (!send.ok) { results.push({ session_id: r.session_id, status: "fb_failed", error: send.error }); continue; }

    const newMsg = {
      role: "assistant",
      source: "admin",
      content: r.text,
      timestamp: new Date().toISOString(),
      manual_reply: true,
    };
    const msgs = Array.isArray(s.messages) ? s.messages : [];
    const finalMsgs = [...msgs, newMsg];
    await supabase.from("ai_chat_sessions").update({
      messages: finalMsgs,
      message_count: finalMsgs.length,
      last_message_at: new Date().toISOString(),
      is_read: true,
    }).eq("id", s.id);

    results.push({ session_id: r.session_id, status: "sent" });
    await new Promise(res => setTimeout(res, 250));
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
