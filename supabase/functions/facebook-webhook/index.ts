// 🔒 DO_NOT_MODIFY START: Facebook Webhook — full file locked
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { replaceNamaskar } from "../_shared/namaskarReplace.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sendFacebookTextMessage(pageAccessToken: string, recipientId: string, message: string) {
  const fbRes = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${pageAccessToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: message },
    }),
  });

  const fbData = await fbRes.json().catch(() => ({}));
  if (!fbRes.ok) {
    console.error("❌ FB Send API error:", fbData);
    throw new Error(fbData?.error?.message || "Facebook API error");
  }

  return fbData;
}

const SITE_URL = "https://farisshop.com";

interface ParsedProduct {
  name: string;
  slug?: string;
  image?: string;
  regular_price?: number;
  offer_price?: number;
}

function parseAiReplyForFacebook(aiReply: string): { textParts: string; products: ParsedProduct[] } {
  const products: ParsedProduct[] = [];
  const productRegex = /\[PRODUCT:\{[^}]*\}\]/g;

  // Extract products
  let match;
  while ((match = productRegex.exec(aiReply)) !== null) {
    try {
      const jsonStr = match[0].slice(9, -1); // remove [PRODUCT: and ]
      const p = JSON.parse(jsonStr);
      products.push({
        name: p.name || "পণ্য",
        slug: p.slug,
        image: p.image || p.product_image,
        regular_price: p.regular_price,
        offer_price: p.offer_price,
      });
    } catch { /* skip malformed */ }
  }

  // Clean text: remove PRODUCT tags and SUGGESTIONS
  let cleaned = aiReply
    .replace(productRegex, "")
    .replace(/\[SUGGESTIONS:[^\]]*\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // If products exist but text is empty, add intro
  if (products.length > 0 && !cleaned) {
    cleaned = "এই পণ্যগুলো দেখুন 👇";
  }

  return { textParts: cleaned, products };
}

async function sendFacebookGenericTemplate(
  pageAccessToken: string,
  recipientId: string,
  products: ParsedProduct[],
) {
  const elements = products.slice(0, 10).map((p) => {
    const subtitle = p.offer_price
      ? `অফার: ৳${p.offer_price} (আগে ৳${p.regular_price})`
      : p.regular_price
        ? `দাম: ৳${p.regular_price}`
        : "";
    const url = `${SITE_URL}/products`;

    const element: Record<string, unknown> = {
      title: p.name,
      subtitle: subtitle || undefined,
      buttons: [{ type: "web_url", url, title: "🛒 অর্ডার করুন" }],
    };
    if (p.image) element.image_url = p.image;
    return element;
  });

  const fbRes = await fetch(
    `https://graph.facebook.com/v21.0/me/messages?access_token=${pageAccessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: "template",
            payload: { template_type: "generic", elements },
          },
        },
      }),
    },
  );

  const data = await fbRes.json().catch(() => ({}));
  if (!fbRes.ok) {
    console.error("❌ FB Generic Template error:", data);
    return false;
  }
  return true;
}

async function parseAndSendFacebookReply(
  pageAccessToken: string,
  recipientId: string,
  aiReply: string,
) {
  // Check for sequential message separator (---) — send parts with 10s delay
  const sequentialParts = aiReply.split(/\n?---\n?/).map(p => p.trim()).filter(Boolean);
  if (sequentialParts.length > 1) {
    for (let i = 0; i < sequentialParts.length; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, 2000)); // 2 second delay
      const { textParts, products } = parseAiReplyForFacebook(sequentialParts[i]);
      if (textParts) await sendFacebookTextMessage(pageAccessToken, recipientId, textParts);
      if (products.length > 0) {
        const sent = await sendFacebookGenericTemplate(pageAccessToken, recipientId, products);
        if (!sent) {
          const fallback = products.map((p, j) => `${j + 1}. ${p.name} ${p.offer_price ? `৳${p.offer_price}` : p.regular_price ? `৳${p.regular_price}` : ""}`).join("\n");
          await sendFacebookTextMessage(pageAccessToken, recipientId, fallback);
        }
      }
    }
    return;
  }

  const { textParts, products } = parseAiReplyForFacebook(aiReply);

  // Send text part first
  if (textParts) {
    await sendFacebookTextMessage(pageAccessToken, recipientId, textParts);
  }

  // Send product carousel if any
  if (products.length > 0) {
    const sent = await sendFacebookGenericTemplate(pageAccessToken, recipientId, products);
    if (!sent) {
      const fallback = products
        .map((p, i) => {
          const price = p.offer_price ? `৳${p.offer_price}` : p.regular_price ? `৳${p.regular_price}` : "";
          return `${i + 1}. ${p.name} ${price}`;
        })
        .join("\n");
      await sendFacebookTextMessage(pageAccessToken, recipientId, fallback);
    }
  }
}

async function transcribeAudio(audioUrl: string): Promise<string | null> {
  try {
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) {
      console.error(`❌ Failed to download audio: ${audioRes.status}`);
      return null;
    }
    const audioBuffer = await audioRes.arrayBuffer();
    const audioBase64 = encodeBase64(new Uint8Array(audioBuffer));
    const mimeType = audioRes.headers.get("content-type") || "audio/mpeg";

    console.log(`🎤 Audio downloaded: ${audioBuffer.byteLength} bytes, type: ${mimeType}`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("❌ LOVABLE_API_KEY not configured for transcription");
      return null;
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
              {
                type: "input_audio",
                input_audio: {
                  data: audioBase64,
                  format: mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "mp3",
                },
              },
              {
                type: "text",
                text: "এই অডিও মেসেজটি হুবহু ট্রান্সক্রাইব করো। শুধুমাত্র ট্রান্সক্রিপশন দাও, অন্য কিছু বলো না।",
              },
            ],
          },
        ],
      }),
    });

    const aiData = await aiRes.json().catch(() => ({}));
    if (!aiRes.ok) {
      console.error("❌ Transcription AI error:", aiData);
      return null;
    }

    const transcript = aiData?.choices?.[0]?.message?.content?.trim();
    console.log(`📝 Transcription result: ${transcript?.slice(0, 100)}`);
    return transcript || null;
  } catch (err) {
    console.error("❌ Transcription failed:", err);
    return null;
  }
}

async function getFacebookProfile(pageAccessToken: string, senderId: string): Promise<{ name: string | null; avatar: string | null }> {
  // Try multiple field combinations — Graph API v18+ sometimes restricts certain fields
  const fieldSets = [
    "first_name,last_name,profile_pic",
    "name,profile_pic",
    "first_name,last_name",
    "name",
  ];

  for (const fields of fieldSets) {
    try {
      const profileRes = await fetch(
        `https://graph.facebook.com/v21.0/${senderId}?fields=${fields}&access_token=${pageAccessToken}`,
      );
      const profileText = await profileRes.text();
      console.log(`📋 FB Profile API (${senderId}) fields=${fields}: status=${profileRes.status}, body=${profileText.slice(0, 300)}`);

      if (!profileRes.ok) continue;

      const profile = JSON.parse(profileText);
      const fullName = profile.name
        ? profile.name.trim()
        : `${profile.first_name || ""} ${profile.last_name || ""}`.trim();

      if (!fullName && !profile.profile_pic) continue;

      return {
        name: fullName ? `📘 ${fullName}` : null,
        avatar: profile.profile_pic || null,
      };
    } catch (error) {
      console.log(`Could not fetch FB profile (fields=${fields}):`, error);
    }
  }

  // Final fallback: generate avatar from Graph API picture endpoint (works without special permissions)
  const avatarUrl = `https://graph.facebook.com/v21.0/${senderId}/picture?type=large&access_token=${pageAccessToken}`;
  try {
    const picRes = await fetch(avatarUrl, { redirect: "manual" });
    const redirectUrl = picRes.headers.get("location");
    // If redirected to a real image (not default silhouette)
    if (redirectUrl && !redirectUrl.includes("static.xx.fbcdn.net/rsrc.php")) {
      console.log(`📸 FB avatar via /picture endpoint for ${senderId}`);
      return { name: null, avatar: redirectUrl };
    }
  } catch { /* ignore */ }

  console.log(`⚠️ All FB profile fetch attempts failed for ${senderId}`);
  return { name: null, avatar: null };
}

// 🔒 DO_NOT_MODIFY: imageUrlToBase64 + normalizeMessages — multimodal image passthrough to AI
async function imageUrlToBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
    const base64 = btoa(binary);
    const contentType = response.headers.get("content-type") || "image/jpeg";
    return `data:${contentType};base64,${base64}`;
  } catch (e) {
    console.error("❌ imageUrlToBase64 failed:", e);
    return null;
  }
}

async function normalizeMessages(messages: any[]) {
  const results: any[] = [];
  for (const message of (Array.isArray(messages) ? messages : [])) {
    const role = message?.role === "assistant" ? "assistant" : "user";
    const hasImage = message?.has_image && message?.image_url;
    const textContent = typeof message?.content === "string" ? message.content : "";

    // If message has an image, convert to base64 and build multimodal content
    if (hasImage && role === "user") {
      const base64Url = await imageUrlToBase64(message.image_url);
      if (base64Url) {
        const parts: any[] = [];
        const cleanText = textContent.replace("📷 ছবি পাঠিয়েছে", "").trim();
        if (cleanText) {
          parts.push({ type: "text", text: cleanText });
        }
        // No forced prompt — let Mina's system prompt handle image behavior
        parts.push({ type: "image_url", image_url: { url: base64Url } });
        results.push({ role, content: parts });
        continue;
      }
      // If base64 conversion failed, fall through to text-only
    }

    // If content is already multimodal array, pass through
    if (Array.isArray(message?.content)) {
      results.push({ role, content: message.content });
      continue;
    }

    if (textContent.trim().length > 0) {
      results.push({ role, content: textContent });
    }
  }
  return results;
}
// 🔒 END DO_NOT_MODIFY

async function generateMinaReply({
  supabaseUrl,
  serviceRoleKey,
  messages,
  sessionId,
}: {
  supabaseUrl: string;
  serviceRoleKey: string;
  messages: any[];
  sessionId: string;
}): Promise<{ content: string; source: "system" | "taiba" | "ai"; tokens_used?: number } | null> {
  const response = await fetch(`${supabaseUrl}/functions/v1/unified-ai-chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      role: "customer",
      session_id: sessionId,
      messages: await normalizeMessages(messages),
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `AI error ${response.status}`);
  }

  // no_reply means the message doesn't need a response (e.g. "ওকে", "ঠিক আছে")
  // skip means AI returned empty content even after retries → don't send anything
  if (data?.no_reply || data?.skip) {
    if (data?.skip) console.warn("⚠️ AI returned skip:true — not sending FB reply");
    return null;
  }

  if (data?.error && !data?.content && !data?.multi_messages) {
    return null;
  }

  // Handle multi_messages (welcome message split into parts)
  if (data?.multi_messages && Array.isArray(data.multi_messages) && data.multi_messages.length > 0) {
    const combined = data.multi_messages.join("\n---\n");
    return {
      content: combined,
      source: "system" as const,
    };
  }

  if (!data?.content) {
    return null;
  }

  const content = String(data.content).trim();
  const source = data.source === "system"
    ? "system" as const
    : data.source === "taiba"
      ? "taiba" as const
      : "ai" as const;

  return {
    content,
    source,
    ...(typeof data.tokens_used === "number" ? { tokens_used: data.tokens_used } : {}),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: settings } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["fb_page_access_token", "fb_verify_token"]);

  const settingsMap = new Map((settings || []).map((s: any) => [s.key, s.value]));
  const VERIFY_TOKEN = settingsMap.get("fb_verify_token") || Deno.env.get("FB_VERIFY_TOKEN");
  const PAGE_ACCESS_TOKEN = settingsMap.get("fb_page_access_token") || Deno.env.get("FB_PAGE_ACCESS_TOKEN");

  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("✅ Webhook verified");
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method === "POST") {
    try {
      const body = await req.json();

      if (body.action === "send_reply") {
        const { recipient_id, message } = body;
        if (!recipient_id || !message) {
          return json({ error: "Missing recipient_id or message" }, 400);
        }
        if (!PAGE_ACCESS_TOKEN) {
          return json({ error: "Facebook page token not configured" }, 400);
        }

        console.log(`📤 Sending admin reply to ${recipient_id}`);
        const fbData = await sendFacebookTextMessage(PAGE_ACCESS_TOKEN, recipient_id, message);
        return json({ success: true, data: fbData });
      }

      // Admin sends image to Facebook
      if (body.action === "send_image") {
        const { recipient_id, image_url, caption } = body;
        if (!recipient_id || !image_url) {
          return json({ error: "Missing recipient_id or image_url" }, 400);
        }
        if (!PAGE_ACCESS_TOKEN) {
          return json({ error: "Facebook page token not configured" }, 400);
        }

        console.log(`📤 Sending admin image to ${recipient_id}`);

        // Send image attachment
        const fbRes = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient: { id: recipient_id },
            message: {
              attachment: {
                type: "image",
                payload: { url: image_url, is_reusable: true },
              },
            },
          }),
        });

        const fbData = await fbRes.json().catch(() => ({}));
        if (!fbRes.ok) {
          console.error("❌ FB Image Send error:", fbData);
          return json({ error: fbData?.error?.message || "Failed to send image" }, 500);
        }

        // Send caption as separate text if provided
        if (caption) {
          await sendFacebookTextMessage(PAGE_ACCESS_TOKEN, recipient_id, caption);
        }

        return json({ success: true, data: fbData });
      }

      // Webhook events from Facebook
      console.log(`📩 Facebook webhook event: ${JSON.stringify(body).slice(0, 500)}`);

      if (body.object !== "page") {
        return new Response("Not a page event", { status: 200, headers: corsHeaders });
      }

      for (const entry of body.entry || []) {
        for (const event of entry.messaging || []) {
          const senderId = event.sender?.id;
          if (!senderId) continue;

          // Handle read receipts
          if (event.read) {
            const fbPhoneRead = `fb:${senderId}`;
            const { data: fbSession } = await supabase
              .from("ai_chat_sessions")
              .select("id")
              .eq("customer_phone", fbPhoneRead)
              .limit(1)
              .maybeSingle();
            if (fbSession) {
              await supabase
                .from("ai_chat_sessions")
                .update({ customer_last_seen_at: new Date(event.read.watermark).toISOString() })
                .eq("id", fbSession.id);
            }
            continue;
          }

          if (event.message?.is_echo) continue;

          let messageText = event.message?.text || "";
          // 🔒 LOCKED (5×): namaskar → আসসালামু আলাইকুম on every inbound FB message
          messageText = replaceNamaskar(messageText);
          const timestamp = event.timestamp;

          // Handle sticker (Facebook like/thumbs-up) — store silently, no reply
          const stickerId = event.message?.sticker_id;
          const messageMid = event.message?.mid || null;

          // 🔒 Atomic cross-invocation dedup — prevent two parallel webhook runs
          // for the same MID from both invoking Mina (which produced double replies).
          if (messageMid) {
            const { error: dedupErr } = await supabase
              .from("fb_webhook_dedup")
              .insert({ message_id: messageMid });
            if (dedupErr) {
              console.log(`⚠️ FB MID ${messageMid} already in-flight — skipping duplicate webhook`);
              continue;
            }
          }
          if (stickerId && !event.message?.text) {
            console.log(`👍 Sticker ${stickerId} from ${senderId} — storing silently`);
            const stickerMessage: Record<string, unknown> = {
              role: "user" as const,
              content: "👍",
              timestamp: new Date(timestamp).toISOString(),
              source: "facebook",
              is_sticker: true,
              ...(messageMid ? { message_id: messageMid } : {}),
            };
            const fbPhoneSticker = `fb:${senderId}`;
            const { data: stickerSession } = await supabase
              .from("ai_chat_sessions")
              .select("id, messages, customer_name")
              .eq("customer_phone", fbPhoneSticker)
              .maybeSingle();

            if (stickerSession) {
              const isDuplicateSticker = !!messageMid && Array.isArray(stickerSession.messages) && stickerSession.messages.some((msg: any) => msg?.message_id === messageMid);
              if (isDuplicateSticker) {
                console.log(`⚠️ Duplicate FB sticker skipped: ${messageMid}`);
                continue;
              }

              const msgs = Array.isArray(stickerSession.messages) ? [...stickerSession.messages, stickerMessage] : [stickerMessage];
              await supabase.from("ai_chat_sessions").update({
                messages: msgs,
                message_count: msgs.length,
                last_message_at: new Date().toISOString(),
                is_read: false,
              }).eq("id", stickerSession.id);
            } else {
              await supabase.from("ai_chat_sessions").insert({
                customer_phone: fbPhoneSticker,
                customer_name: `FB User ${senderId.slice(-4)}`,
                messages: [stickerMessage],
                message_count: 1,
                last_message_at: new Date().toISOString(),
                is_read: false,
                ai_paused: false,
              });
            }
            continue; // Skip AI — no reply for stickers
          }

          // Handle attachments (audio, image)
          const attachments = event.message?.attachments || [];
          const audioAttachment = attachments.find((a: any) => a.type === "audio");
          // Filter out stickers, GIFs, emojis, and animated images from "image" attachments
          const imageAttachments = attachments.filter((a: any) => {
            if (a.type !== "image") return false;
            const url = a?.payload?.url || "";
            // Facebook sticker/emoji/GIF patterns — these are NOT real photos
            const isStickerOrGif = 
              /\/sticker\//i.test(url) ||
              /\/emoji\//i.test(url) ||
              /\.gif(\?|$)/i.test(url) ||
              /animated/i.test(url) ||
              /static\.xx\.fbcdn\.net\/rsrc/i.test(url) ||
              /platform-lookaside.*fbsbx/i.test(url) ||
              (a?.payload?.sticker_id != null);
            if (isStickerOrGif) {
              console.log(`🎭 Filtered out FB sticker/GIF/emoji attachment: ${url.slice(0, 80)}`);
              return false;
            }
            return true;
          });
          let incomingImageUrl: string | null = null;

          let audioUrl: string | null = null;
          if (audioAttachment?.payload?.url && !messageText) {
            console.log(`🎤 Voice message from ${senderId}, transcribing...`);
            audioUrl = audioAttachment.payload.url;
            const transcript = await transcribeAudio(audioUrl);
            if (transcript) {
              messageText = `🎤 ${transcript}`;
              console.log(`📝 Transcribed: ${transcript.slice(0, 100)}`);
            } else {
              if (PAGE_ACCESS_TOKEN) {
                await sendFacebookTextMessage(PAGE_ACCESS_TOKEN, senderId, "দুঃখিত, আমি ভয়েস মেসেজ বুঝতে পারিনি। দয়া করে টেক্সটে লিখুন। 🙏");
              }
              continue;
            }
          }

          // Handle image attachments (stickers/GIFs already filtered above)
          if (imageAttachments.length > 0) {
            incomingImageUrl = imageAttachments[0]?.payload?.url || null;
            if (!messageText) {
              messageText = "📷 ছবি পাঠিয়েছে";
            }
            console.log(`🖼️ Real image from ${senderId}: ${incomingImageUrl?.slice(0, 80)}`);
          }

          if (!messageText && !incomingImageUrl) continue;

          console.log(`💬 Message from ${senderId}: ${messageText}`);

          const fbPhone = `fb:${senderId}`;
          const { data: existingSession, error: fetchErr } = await supabase
            .from("ai_chat_sessions")
            .select("*")
            .eq("customer_phone", fbPhone)
            .maybeSingle();

          if (fetchErr) {
            console.error("❌ Fetch session error:", fetchErr);
          }

          const incomingTimestampIso = new Date(timestamp).toISOString();
          const isDuplicateMessage = Array.isArray(existingSession?.messages) && existingSession.messages.some((msg: any) => {
            if (messageMid && msg?.message_id === messageMid) return true;

            return !messageMid
              && msg?.role === "user"
              && msg?.source === "facebook"
              && msg?.timestamp === incomingTimestampIso
              && msg?.content === messageText;
          });

          if (isDuplicateMessage) {
            console.log(`⚠️ Duplicate FB message skipped: ${messageMid || `${senderId}:${timestamp}`}`);
            continue;
          }

          const incomingMessage: Record<string, unknown> = {
            role: "user" as const,
            content: messageText,
            timestamp: incomingTimestampIso,
            source: "facebook",
            ...(messageMid ? { message_id: messageMid } : {}),
            ...(incomingImageUrl ? { has_image: true, image_url: incomingImageUrl } : {}),
            ...(audioUrl ? { has_audio: true, audio_url: audioUrl } : {}),
          };

          let sessionId = existingSession?.id as string | undefined;
          let sessionMessages = Array.isArray(existingSession?.messages) ? [...existingSession.messages] : [];
          sessionMessages.push(incomingMessage);
          let aiPaused = !!existingSession?.ai_paused;
          let currentCustomerName = existingSession?.customer_name || `FB User ${senderId.slice(-4)}`;

          if (existingSession) {
            const { error: updateErr } = await supabase
              .from("ai_chat_sessions")
              .update({
                messages: sessionMessages,
                message_count: sessionMessages.length,
                last_message_at: new Date().toISOString(),
                is_read: false,
                customer_name: currentCustomerName,
              })
              .eq("id", existingSession.id);

            if (updateErr) console.error("❌ Update session error:", updateErr);
            else console.log("✅ Updated existing FB session");
          } else {
            const { data: insertedSession, error: insertErr } = await supabase
              .from("ai_chat_sessions")
              .insert({
                customer_phone: fbPhone,
                customer_name: currentCustomerName,
                messages: sessionMessages,
                message_count: sessionMessages.length,
                last_message_at: new Date().toISOString(),
                is_read: false,
                ai_paused: false,
              })
              .select("id, ai_paused, customer_name")
              .single();

            if (insertErr) {
              console.error("❌ Insert session error:", insertErr);
              continue;
            }

            sessionId = insertedSession.id;
            aiPaused = !!insertedSession.ai_paused;
            currentCustomerName = insertedSession.customer_name || currentCustomerName;
            console.log("✅ Created new FB session");
          }

          // Fetch profile name if not already resolved (still fallback name)
          const needsNameFetch = !currentCustomerName.startsWith("📘");
          if (needsNameFetch && PAGE_ACCESS_TOKEN) {
            const profile = await getFacebookProfile(PAGE_ACCESS_TOKEN, senderId);
            if (sessionId && (profile.name || profile.avatar)) {
              if (profile.name) currentCustomerName = profile.name;
              const updatePayload: Record<string, unknown> = {};
              if (profile.name) updatePayload.customer_name = profile.name;
              if (profile.avatar) updatePayload.customer_avatar = profile.avatar;
              await supabase
                .from("ai_chat_sessions")
                .update(updatePayload)
                .eq("id", sessionId);
              console.log(`✅ Updated FB profile: name=${profile.name}, avatar=${profile.avatar ? 'yes' : 'no'}`);
            }
          }

          // Keep calling unified-ai-chat even when AI is paused — it handles paused-session
          // confirmations and phone capture/callback lead creation for this session.
          if (!PAGE_ACCESS_TOKEN || !sessionId) continue;

          try {
            const aiResult = await generateMinaReply({
              supabaseUrl: SUPABASE_URL,
              serviceRoleKey: SERVICE_ROLE_KEY,
              messages: sessionMessages,
              sessionId,
            });

            if (!aiResult) {
              console.log("ℹ️ Mina auto reply skipped");
              continue;
            }

            await parseAndSendFacebookReply(PAGE_ACCESS_TOKEN, senderId, aiResult.content);
            console.log(`🤖 Mina auto reply sent to ${senderId} (source: ${aiResult.source})`);

            const assistantMessage = {
              role: "assistant" as const,
              content: aiResult.content,
              timestamp: new Date().toISOString(),
              source: aiResult.source,
              ...(typeof aiResult.tokens_used === "number" ? { tokens_used: aiResult.tokens_used } : {}),
            };

            const finalMessages = [...sessionMessages, assistantMessage];
            await supabase
              .from("ai_chat_sessions")
              .update({
                messages: finalMessages,
                last_message_at: new Date().toISOString(),
                customer_name: currentCustomerName,
              })
              .eq("id", sessionId);
          } catch (aiError) {
            console.error("❌ Mina auto reply failed:", aiError);
          }
        }
      }

      return new Response("EVENT_RECEIVED", { status: 200, headers: corsHeaders });
    } catch (error) {
      console.error("❌ Webhook error:", error);
      return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
    }
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});
// 🔒 DO_NOT_MODIFY END