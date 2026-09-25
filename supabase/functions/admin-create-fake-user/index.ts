import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPER_ADMIN_EMAILS = ["dev.anwarul@gmail.com", "amdadulislammilon9@gmail.com"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function normalizeBdPhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("88") && digits.length === 13) digits = digits.slice(2);
  if (digits.length !== 11) return null;
  if (!/^01[3-9]\d{8}$/.test(digits)) return null;
  return digits;
}

async function bcryptHash(password: string): Promise<string> {
  const { hashSync } = await import("https://deno.land/x/bcrypt@v0.4.1/mod.ts");
  return hashSync(password);
}

function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function generateUniqueUsername(
  supabase: ReturnType<typeof createClient>,
  phone: string,
  name: string | null,
): Promise<string> {
  const base = (name || `user_${phone.slice(-6)}`)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 16) || `user_${phone.slice(-6)}`;

  for (let i = 0; i < 10; i++) {
    const candidate = i === 0 ? base : `${base}${Math.floor(Math.random() * 9000) + 1000}`;
    const { data: existing } = await supabase
      .from("visitor_profiles")
      .select("id")
      .eq("username", candidate)
      .maybeSingle();
    if (!existing) return candidate;
  }
  return `user_${phone.slice(-6)}_${Date.now().toString(36)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Verify caller is admin ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabase.auth.getUser(token);
    if (!caller) return json({ error: "Unauthorized" }, 401);

    const { data: callerRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .in("role", ["admin", "moderator"])
      .maybeSingle();

    const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(caller.email as string);
    if (!callerRole && !isSuperAdmin) {
      return json({ error: "Forbidden" }, 403);
    }

    // ── Parse body ──
    const body = await req.json();
    const { phone: rawPhone, password, name, gender, user_type } = body || {};

    const phone = normalizeBdPhone(rawPhone);
    if (!phone) {
      return json({ error: "অবৈধ ফোন নম্বর। সঠিক BD নম্বর দিন (01XXXXXXXXX)।" }, 400);
    }
    if (typeof password !== "string" || password.length < 6) {
      return json({ error: "Password কমপক্ষে ৬ অক্ষরের হতে হবে।" }, 400);
    }

    // ── Duplicate check ──
    const { data: existing } = await supabase
      .from("visitor_profiles")
      .select("id, phone")
      .eq("phone", phone)
      .maybeSingle();

    if (existing) {
      return json({ error: "এই ফোন নম্বরে আগে থেকেই একজন user আছে।" }, 409);
    }

    // ── Create visitor row (visitor_profiles.visitor_id is NOT NULL) ──
    const fingerprint = `fake_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const { data: visitor, error: visitorErr } = await supabase
      .from("visitors")
      .insert({ fingerprint, traffic_source: "admin_created" })
      .select("id")
      .single();

    if (visitorErr || !visitor) {
      console.error("visitor insert err:", visitorErr);
      return json({ error: "Visitor তৈরি করা যায়নি।", details: visitorErr?.message }, 500);
    }

    const password_hash = await bcryptHash(password);
    const username = await generateUniqueUsername(supabase, phone, name || null);
    const session_token = generateSessionToken();

    const safeName = (typeof name === "string" && name.trim()) ? name.trim().slice(0, 80) : null;
    const safeGender = (gender === "male" || gender === "female" || gender === "other") ? gender : null;
    const safeUserType = (typeof user_type === "string" && user_type.trim()) ? user_type.trim() : "regular";

    const { data: profile, error: profErr } = await supabase
      .from("visitor_profiles")
      .insert({
        visitor_id: visitor.id,
        phone,
        name: safeName,
        gender: safeGender,
        user_type: safeUserType,
        password_hash,
        phone_verified: true,
        username,
        session_token,
      })
      .select("id, phone, name, username")
      .single();

    if (profErr || !profile) {
      console.error("profile insert err:", profErr);
      // Best-effort cleanup
      await supabase.from("visitors").delete().eq("id", visitor.id);
      return json({ error: "Profile তৈরি করা যায়নি।", details: profErr?.message }, 500);
    }

    return json({
      success: true,
      profile_id: profile.id,
      phone: profile.phone,
      username: profile.username,
      name: profile.name,
    });
  } catch (err) {
    console.error("admin-create-fake-user error:", err);
    return json({ error: "Server error", details: String(err?.message || err) }, 500);
  }
});
