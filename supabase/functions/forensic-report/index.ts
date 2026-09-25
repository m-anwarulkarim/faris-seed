// Generates a formal PDF report for a watched user — for police/legal use.
// Returns base64 PDF.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jsPDF } from "https://esm.sh/jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function safe(v: any): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { watched_visitor_id } = await req.json();
    if (!watched_visitor_id) {
      return new Response(JSON.stringify({ error: "watched_visitor_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: watched } = await supabase
      .from("watched_visitors")
      .select("*")
      .eq("id", watched_visitor_id)
      .maybeSingle();

    if (!watched) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Forensic logs
    const { data: logs } = await supabase
      .from("forensic_logs")
      .select("*")
      .eq("watched_visitor_id", watched_visitor_id)
      .order("created_at", { ascending: false })
      .limit(500);

    // Profile & orders
    let profile: any = null;
    let orders: any[] = [];
    let posts: any[] = [];
    let messages: any[] = [];
    if (watched.visitor_profile_id) {
      const { data: p } = await supabase
        .from("visitor_profiles").select("*")
        .eq("id", watched.visitor_profile_id).maybeSingle();
      profile = p;

      const { data: o } = await supabase
        .from("orders").select("order_id, customer_facing_id, status, total_amount, phone, address, created_at")
        .eq("visitor_profile_id", watched.visitor_profile_id)
        .order("created_at", { ascending: false }).limit(50);
      orders = o || [];

      posts = [];

      const { data: m } = await supabase
        .from("direct_messages").select("id, message, receiver_id, moderation_status, created_at")
        .eq("sender_id", watched.visitor_profile_id)
        .order("created_at", { ascending: false }).limit(50);
      messages = m || [];
    }

    // ─── Build PDF ───
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    let y = 15;
    const left = 15;
    const lineH = 5;

    const heading = (text: string, size = 14) => {
      if (y > 270) { doc.addPage(); y = 15; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(size);
      doc.text(text, left, y); y += lineH + 1;
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    };
    const line = (label: string, value: any) => {
      if (y > 280) { doc.addPage(); y = 15; }
      const wrapped = doc.splitTextToSize(`${label}: ${safe(value)}`, 180);
      doc.text(wrapped, left, y);
      y += lineH * wrapped.length;
    };
    const para = (text: string) => {
      const wrapped = doc.splitTextToSize(text, 180);
      for (const w of wrapped) {
        if (y > 280) { doc.addPage(); y = 15; }
        doc.text(w, left, y); y += lineH;
      }
    };
    const hr = () => { doc.setDrawColor(180); doc.line(left, y, 195, y); y += 3; };

    // ─── Title ───
    doc.setFontSize(18); doc.setFont("helvetica", "bold");
    doc.text("FORENSIC INVESTIGATION REPORT", left, y); y += 7;
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text("Confidential — for legal/law-enforcement use only", left, y); y += 5;
    doc.text(`Generated: ${new Date().toUTCString()}`, left, y); y += 5;
    doc.text(`Issued by: Faris Seed (farisshop.com)`, left, y); y += 7;
    hr();

    heading("1. SUBJECT IDENTIFICATION");
    line("Name", watched.name);
    line("Phone", watched.phone);
    line("Known IP", watched.ip_address);
    line("Reason for surveillance", watched.reason);
    line("Active since", watched.created_at);
    line("Total alerts triggered", watched.alert_count);
    line("Last alert", watched.last_alert_at);
    y += 3;

    if (profile) {
      heading("2. PROFILE DATA");
      line("Profile ID", profile.id);
      line("Display Name", profile.name);
      line("Username", profile.username);
      line("Phone (verified)", `${profile.phone} (${profile.phone_verified ? "yes" : "no"})`);
      line("District", profile.district);
      line("Address", profile.address);
      line("Account created", profile.created_at);
      line("Shadow moderated", profile.shadow_moderated ? "YES" : "no");
      y += 3;
    }

    if (orders.length) {
      heading(`3. ORDER HISTORY (${orders.length})`);
      for (const o of orders.slice(0, 30)) {
        line(`Order ${o.customer_facing_id || o.order_id}`,
          `${o.status} • ৳${o.total_amount} • ${o.phone} • ${new Date(o.created_at).toISOString().slice(0,16)}`);
      }
      y += 3;
    }

    if (posts.length) {
      heading(`4. SOCIAL POSTS (${posts.length})`);
      for (const p of posts.slice(0, 20)) {
        line(`[${p.moderation_status}] ${new Date(p.created_at).toISOString().slice(0,16)}`,
          (p.content || "").slice(0, 200));
      }
      y += 3;
    }

    if (messages.length) {
      heading(`5. DIRECT MESSAGES (${messages.length})`);
      for (const m of messages.slice(0, 20)) {
        line(`[${m.moderation_status}] ${new Date(m.created_at).toISOString().slice(0,16)}`,
          (m.message || "").slice(0, 200));
      }
      y += 3;
    }

    heading(`6. FORENSIC EVIDENCE — ${(logs || []).length} CAPTURED VISITS`);
    para("The following technical evidence was collected automatically from the subject's browser during their visits to farisshop.com. This data persists across normal incognito/private-browsing sessions because it is derived from device-level signals (canvas rendering, GPU fingerprint, audio stack, hardware capabilities, fonts, network).");
    y += 2;

    // Aggregate fingerprints
    const fps = new Map<string, number>();
    const ips = new Map<string, number>();
    const uas = new Map<string, number>();
    for (const l of (logs || [])) {
      if (l.device_fingerprint) fps.set(l.device_fingerprint, (fps.get(l.device_fingerprint)||0)+1);
      if (l.ip_address) ips.set(l.ip_address, (ips.get(l.ip_address)||0)+1);
      if (l.webrtc_public_ip && l.webrtc_public_ip !== l.ip_address) ips.set(l.webrtc_public_ip+" (WebRTC leak)", (ips.get(l.webrtc_public_ip+" (WebRTC leak)")||0)+1);
      if (l.user_agent) uas.set(l.user_agent, (uas.get(l.user_agent)||0)+1);
    }

    heading("6.1 Unique device fingerprints", 12);
    if (!fps.size) para("None captured yet.");
    for (const [fp, count] of Array.from(fps.entries()).slice(0, 10)) {
      line(`  ${fp.slice(0, 32)}…`, `${count} visits`);
    }

    heading("6.2 IP addresses observed", 12);
    if (!ips.size) para("None captured yet.");
    for (const [ip, count] of Array.from(ips.entries()).slice(0, 20)) {
      line(`  ${ip}`, `${count} visits`);
    }

    heading("6.3 User-Agent strings", 12);
    if (!uas.size) para("None captured yet.");
    for (const [ua, count] of Array.from(uas.entries()).slice(0, 10)) {
      line(`  ${ua.slice(0, 80)}`, `${count} visits`);
    }

    heading("6.4 Per-visit detail (most recent 30)", 12);
    for (const l of (logs || []).slice(0, 30)) {
      if (y > 260) { doc.addPage(); y = 15; }
      doc.setFont("helvetica", "bold");
      doc.text(`▸ ${new Date(l.created_at).toUTCString()}`, left, y); y += lineH;
      doc.setFont("helvetica", "normal");
      line("  Action", `${l.action_type} on ${l.page_path}`);
      line("  IP", `${l.ip_address}${l.webrtc_public_ip && l.webrtc_public_ip!==l.ip_address ? ` (WebRTC leaked: ${l.webrtc_public_ip})` : ""}`);
      if (l.webrtc_local_ips?.length) line("  Local IPs (LAN)", l.webrtc_local_ips.join(", "));
      line("  Device FP", l.device_fingerprint?.slice(0, 32) + "…");
      line("  Hardware", `${l.hardware_info?.platform} | ${l.hardware_info?.cpu_cores} cores | ${l.hardware_info?.device_memory_gb}GB | GPU: ${l.hardware_info?.webgl_renderer}`);
      line("  Screen", `${l.screen_info?.width}x${l.screen_info?.height} @ ${l.screen_info?.device_pixel_ratio}x`);
      line("  Timezone/Lang", `${l.timezone} | ${(l.languages||[]).join(",")}`);
      if (l.network_info) line("  Network", `${l.network_info.effective_type} | ${l.network_info.downlink}Mbps | RTT ${l.network_info.rtt}ms`);
      line("  User-Agent", (l.user_agent || "").slice(0, 100));
      y += 1;
    }

    if (y > 270) { doc.addPage(); y = 15; }
    y += 4; hr();
    doc.setFontSize(8);
    doc.text("This report was generated automatically from server-side evidence stored at the time of the events.", left, y); y += 4;
    doc.text("All timestamps are in UTC. For questions, contact the Faris Seed administrator.", left, y);

    const buf = doc.output("arraybuffer");
    const u8 = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    const b64 = btoa(bin);

    return new Response(JSON.stringify({ pdf_base64: b64, log_count: (logs || []).length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("forensic-report error", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
