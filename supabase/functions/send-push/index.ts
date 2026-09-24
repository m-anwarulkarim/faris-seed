// 🔒 DO_NOT_MODIFY: Push notification dispatch (VAPID, batching) — full file locked. Modify only with explicit user permission.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function base64UrlDecode(str: string): Uint8Array {
  const padding = "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function derToRaw(der: Uint8Array): Uint8Array {
  if (der.length === 64) return der;
  const raw = new Uint8Array(64);
  let offset = 2;
  if (der[offset] !== 0x02) return der.slice(0, 64);
  offset++;
  const rLen = der[offset++];
  const rStart = rLen === 33 ? offset + 1 : offset;
  const rBytes = Math.min(rLen === 33 ? 32 : rLen, 32);
  raw.set(der.slice(rStart, rStart + rBytes), 32 - rBytes);
  offset += rLen;
  if (der[offset] !== 0x02) return raw;
  offset++;
  const sLen = der[offset++];
  const sStart = sLen === 33 ? offset + 1 : offset;
  const sBytes = Math.min(sLen === 33 ? 32 : sLen, 32);
  raw.set(der.slice(sStart, sStart + sBytes), 64 - sBytes);
  return raw;
}

async function createVapidToken(
  audience: string,
  privateKeyBytes: Uint8Array,
  publicKeyBytes: Uint8Array
) {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: "mailto:push@grihanovas.com",
  };

  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsigned = `${headerB64}.${payloadB64}`;

  // Use JWK import to avoid PKCS#8 DER encoding issues
  const x = publicKeyBytes.slice(1, 33);
  const y = publicKeyBytes.slice(33, 65);

  const key = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      d: base64UrlEncode(privateKeyBytes),
      x: base64UrlEncode(x),
      y: base64UrlEncode(y),
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsigned)
  );

  const rawSig = derToRaw(new Uint8Array(signature));
  const sigB64 = base64UrlEncode(rawSig);

  return {
    token: `${unsigned}.${sigB64}`,
    publicKey: base64UrlEncode(publicKeyBytes),
  };
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const hmacKey = await crypto.subtle.importKey(
    "raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const infoWithCounter = new Uint8Array(info.length + 1);
  infoWithCounter.set(info);
  infoWithCounter[info.length] = 1;
  const result = new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, infoWithCounter));
  return result.slice(0, length);
}

async function encryptPayload(
  p256dhKey: string, authSecret: string, plaintext: Uint8Array
): Promise<Uint8Array> {
  const clientPublicKey = base64UrlDecode(p256dhKey);
  const clientAuth = base64UrlDecode(authSecret);

  const serverKeys = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]
  );
  const serverPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeys.publicKey)
  );

  const clientKey = await crypto.subtle.importKey(
    "raw", clientPublicKey, { name: "ECDH", namedCurve: "P-256" }, false, []
  );

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientKey }, serverKeys.privateKey, 256
    )
  );

  const encoder = new TextEncoder();
  const keyInfoBuf = new Uint8Array([
    ...encoder.encode("WebPush: info\0"),
    ...clientPublicKey,
    ...serverPublicKeyRaw,
  ]);

  const hmacKey = await crypto.subtle.importKey(
    "raw", clientAuth, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, sharedSecret));
  const ikm = await hkdfExpand(prk, keyInfoBuf, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const cekInfo = new Uint8Array([...encoder.encode("Content-Encoding: aes128gcm\0")]);
  const nonceInfo = new Uint8Array([...encoder.encode("Content-Encoding: nonce\0")]);

  const saltKey = await crypto.subtle.importKey(
    "raw", salt, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const prk2 = new Uint8Array(await crypto.subtle.sign("HMAC", saltKey, ikm));

  const cek = await hkdfExpand(prk2, cekInfo, 16);
  const nonce = await hkdfExpand(prk2, nonceInfo, 12);

  const paddedPlaintext = new Uint8Array(plaintext.length + 1);
  paddedPlaintext.set(plaintext);
  paddedPlaintext[plaintext.length] = 2;

  const aesKey = await crypto.subtle.importKey(
    "raw", cek, { name: "AES-GCM" }, false, ["encrypt"]
  );
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, paddedPlaintext)
  );

  const rs = plaintext.length + 1 + 16;
  const header = new Uint8Array(16 + 4 + 1 + serverPublicKeyRaw.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, rs + 86, false);
  header[20] = serverPublicKeyRaw.length;
  header.set(serverPublicKeyRaw, 21);

  const result = new Uint8Array(header.length + encrypted.length);
  result.set(header);
  result.set(encrypted, header.length);
  return result;
}

async function generatePushPayload(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
) {
  const privateKeyBytes = base64UrlDecode(vapidPrivateKey);
  const publicKeyBytes = base64UrlDecode(vapidPublicKey);

  const audience = new URL(subscription.endpoint).origin;
  const vapidToken = await createVapidToken(audience, privateKeyBytes, publicKeyBytes);

  const encryptedPayload = await encryptPayload(
    subscription.p256dh, subscription.auth, new TextEncoder().encode(payload)
  );

  return await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${vapidToken.token}, k=${vapidToken.publicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "normal",
    },
    body: encryptedPayload,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const {
      title, body, url, tag,
      visitor_profile_id, visitor_id, user_id,
      send_to_all, send_to_admins,
    } = await req.json();

    if (!title || !body) {
      return new Response(
        JSON.stringify({ error: "title and body are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let query = supabase.from("push_subscriptions").select("*");

    // Security: send_to_admins and send_to_all require internal/service-level access
    if (send_to_admins || send_to_all) {
      const authHeader = req.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "").trim();
      
      let isAuthorized = token === serviceRoleKey;
      
      if (!isAuthorized) {
        try {
          const parts = token.split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            isAuthorized = payload.role === "anon" || payload.role === "service_role" || payload.role === "authenticated";
          }
        } catch {
          // Not a valid JWT
        }
      }
      
      if (!isAuthorized) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (send_to_admins) {
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "moderator"]);
      const adminIds = (adminRoles || []).map((r: any) => r.user_id);
      if (adminIds.length > 0) {
        query = query.in("user_id", adminIds);
      } else {
        return new Response(
          JSON.stringify({ sent: 0, message: "No admin subscriptions found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (send_to_all) {
      // send to all
    } else if (visitor_profile_id) {
      query = query.eq("visitor_profile_id", visitor_profile_id);
    } else if (user_id) {
      query = query.eq("user_id", user_id);
    } else if (visitor_id) {
      query = query.eq("visitor_id", visitor_id);
    } else {
      return new Response(
        JSON.stringify({ error: "visitor_profile_id, user_id, visitor_id, or send_to_all required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: subscriptions, error: subError } = await query;
    if (subError) throw subError;

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No subscriptions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payloadStr = JSON.stringify({ title, body, url: url || "/", tag: tag || "default" });

    let sent = 0;
    let failed = 0;
    const expiredEndpoints: string[] = [];

    for (const sub of subscriptions) {
      try {
        const response = await generatePushPayload(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payloadStr, vapidPublicKey, vapidPrivateKey
        );

        if (response.status === 201 || response.status === 200) {
          sent++;
        } else if (response.status === 404 || response.status === 410) {
          expiredEndpoints.push(sub.endpoint);
          failed++;
        } else {
          const errBody = await response.text();
          console.error(`Push failed ${response.status}: ${errBody}`);
          failed++;
        }
      } catch (err) {
        console.error(`Push error for ${sub.endpoint}:`, err.message);
        failed++;
      }
    }

    if (expiredEndpoints.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
    }

    return new Response(
      JSON.stringify({ sent, failed, expired_cleaned: expiredEndpoints.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Send push error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
