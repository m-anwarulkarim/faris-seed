// NSFW image scanner. Called fire-and-forget from client after profile/cover upload.
// Uses Lovable AI Gateway (Gemini 2.5 Flash vision). On NSFW detection:
// 1. Deletes the file from storage
// 2. Nulls the field on visitor_profiles (cover_photo or profile_picture)
// 3. Marks profile shadow_moderated + invalidates session
// 4. Adds to watched_visitors
// 5. Sends SMS to owner (01708356800) and pushes admin notification
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const OWNER_PHONE = "01708356800";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ScanResult {
  nsfw: boolean;
  category: string; // "safe" | "nudity" | "porn" | "gore" | "violence" | "hate" | "weapons" | "other"
  confidence: "low" | "medium" | "high";
  reason: string;
}

async function classifyImage(imageUrl: string): Promise<ScanResult> {
  const prompt =
    `You are a strict content-moderation classifier for a Bangladeshi agriculture e-commerce site (Faris Seed). ` +
    `Analyze the image and return a JSON object with these fields exactly: ` +
    `{"nsfw": boolean, "category": "safe"|"nudity"|"porn"|"gore"|"violence"|"hate"|"weapons"|"other", "confidence": "low"|"medium"|"high", "reason": "short english description"}. ` +
    `Mark nsfw=true for: nudity, sexual/pornographic content, genitalia, sexual acts, gore, graphic violence, hate symbols, weapons aimed/in use. ` +
    `Mark nsfw=false for: people fully clothed, plants, fields, food, animals, products, scenery, text/screenshots, memes without explicit content. ` +
    `Be strict on porn/nudity (Bangladesh cultural context). Only output the JSON, no prose.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error("AI Gateway error:", res.status, txt);
    throw new Error(`ai_gateway_${res.status}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || "{}";
  try {
    const parsed = JSON.parse(raw);
    return {
      nsfw: !!parsed.nsfw,
      category: String(parsed.category || "other"),
      confidence: (parsed.confidence === "high" || parsed.confidence === "medium" ? parsed.confidence : "low") as any,
      reason: String(parsed.reason || "").slice(0, 200),
    };
  } catch {
    return { nsfw: false, category: "other", confidence: "low", reason: "parse_failed" };
  }
}

function extractStoragePath(publicUrl: string, bucket = "product-images"): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const imageUrl = String(body?.image_url || "").trim();
  const profileId = String(body?.profile_id || "").trim();
  const sessionToken = String(body?.session_token || "").trim();
  const kind = body?.kind === "cover" ? "cover" : body?.kind === "avatar" ? "avatar" : null;

  if (!imageUrl || !profileId || !sessionToken || !kind) return json({ error: "missing_fields" }, 400);
  if (!/^https:\/\//.test(imageUrl)) return json({ error: "invalid_url" }, 400);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: prof } = await supabase
    .from("visitor_profiles")
    .select("id, name, username, phone, alt_phone, visitor_id, district, thana, phone_verified, session_token")
    .eq("id", profileId)
    .eq("session_token", sessionToken)
    .eq("phone_verified", true)
    .maybeSingle();

  if (!prof) return json({ error: "invalid_session" }, 401);

  const expectedPrefix = `/storage/v1/object/public/product-images/profiles/${prof.visitor_id}/`;
  if (!imageUrl.includes(expectedPrefix)) return json({ error: "invalid_profile_image_path" }, 400);

  let result: ScanResult;
  try {
    result = await classifyImage(imageUrl);
  } catch (e) {
    console.error("classifyImage failed:", e);
    return json({ error: "classify_failed", message: String(e) }, 500);
  }

  console.log("NSFW scan:", profileId, kind, JSON.stringify(result));

  if (!result.nsfw) {
    return json({ nsfw: false, category: result.category, reason: result.reason });
  }

  // ─── NSFW DETECTED — execute ban ───
  const field = kind === "cover" ? "cover_photo" : "profile_picture";

  // 1. Delete file from storage
  const storagePath = extractStoragePath(imageUrl);
  if (storagePath) {
    await supabase.storage.from("product-images").remove([storagePath]);
  }

  // 2. Wipe field + ban
  await supabase
    .from("visitor_profiles")
    .update({
      [field]: null,
      shadow_moderated: true,
      shadow_moderated_reason: `Auto-ban: NSFW ${kind} (${result.category}, ${result.confidence}) — ${result.reason}`,
      shadow_moderated_at: new Date().toISOString(),
      session_invalidated_at: new Date().toISOString(),
      session_token: null,
    })
    .eq("id", profileId);

  // 3. Add to watched_visitors (idempotent best-effort)
  if (prof) {
    await supabase.from("watched_visitors").insert({
      name: prof.name || "Unknown",
      phone: prof.phone || null,
      visitor_id: prof.visitor_id || null,
      visitor_profile_id: prof.id,
      reason: `NSFW ${kind} auto-ban (${result.category}): ${result.reason}`,
      alert_phone: OWNER_PHONE,
      is_active: true,
    });
  }

  // 4. Send owner SMS
  const smsBody =
    `NSFW ${kind} BANNED: ${prof?.name || "Unknown"} (${prof?.phone || "no-phone"}, @${prof?.username || "?"}). ` +
    `Category: ${result.category} (${result.confidence}). ${result.reason.slice(0, 60)}. Profile wiped, session killed.`;
  fetch(`${SUPABASE_URL}/functions/v1/sms-api`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "send_sms", number: OWNER_PHONE, message: smsBody.slice(0, 200), reason: "nsfw_ban" }),
  }).catch((e) => console.warn("SMS dispatch failed:", e));

  return json({
    nsfw: true,
    category: result.category,
    confidence: result.confidence,
    reason: result.reason,
    banned: true,
  });
});
