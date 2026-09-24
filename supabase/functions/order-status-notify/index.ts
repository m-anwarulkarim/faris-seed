// 🔒 DO_NOT_MODIFY_START — order-status-notify edge function (SMS + Push + Mina chat notifications)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NotifyPayload {
  order_id: string; // UUID
  new_status: string;
  old_status?: string;
}

const TRACKING_BASE_URL = "https://steadfast.com.bd/t/";
const sanitizeSmsText = (value: string) =>
  value.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "").replace(/\s{2,}/g, " ").trim();

// Validate Bangladesh mobile number — strict 11-digit 01[3-9]XXXXXXXX format
const normalizeBdPhone = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("88") && digits.length === 13) digits = digits.slice(2);
  if (digits.length !== 11) return null;
  if (!/^01[3-9]\d{8}$/.test(digits)) return null;
  return digits;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { order_id, new_status, old_status }: NotifyPayload = await req.json();
    if (!order_id || !new_status) return json({ error: "order_id and new_status required" }, 400);

    // Skip if same status
    if (old_status === new_status) return json({ skipped: true });

    // Fetch order details
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, order_id, phone, customer_name, total_amount, tracking_code, consignment_id, pre_date, visitor_id, visitor_profile_id")
      .eq("id", order_id)
      .maybeSingle();

    if (orderErr || !order) return json({ error: "Order not found" }, 404);

    // Fetch notification toggle settings + custom messages
    const { data: toggleSettings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [
        "sms_on_pending", "sms_on_no_response", "sms_on_confirmed", "sms_on_entry_done",
        "sms_msg_pending", "sms_msg_no_response", "sms_msg_confirmed", "sms_msg_entry_done",
        "mina_on_pending", "mina_on_no_response", "mina_on_confirmed", "mina_on_entry_done",
        "mina_msg_pending", "mina_msg_no_response", "mina_msg_confirmed", "mina_msg_entry_done",
        "customer_ai_chat_enabled",
      ]);
    const toggleMap: Record<string, string> = {};
    toggleSettings?.forEach((s: any) => { toggleMap[s.key] = s.value; });
    const isOn = (key: string) => toggleMap[key] === undefined ? true : toggleMap[key] === "true";
    const chatEnabled = toggleMap["customer_ai_chat_enabled"] === undefined ? true : toggleMap["customer_ai_chat_enabled"] === "true";
    const getMsg = (key: string, fallback: string) => toggleMap[key] || fallback;

    // Determine SMS message
    let smsMessage: string | null = null;
    let smsReason: string | null = null;
    let sendSms = false;

    // Determine Mina chat message
    let minaMessage: string | null = null;
    let sendMina = false;

    const orderId = order.order_id;
    const total = order.total_amount;
    const trackingLink = order.tracking_code ? `${TRACKING_BASE_URL}${order.tracking_code}` : null;

    // Helper to replace variables in custom messages
    const replaceVars = (msg: string) =>
      msg.replace(/\{\s*order[_\s]?id\s*\}/gi, orderId)
         .replace(/\{\s*(total|amount|total[_\s]?amount|due)\s*\}/gi, String(total ?? ""))
         .replace(/\{\s*tracking[_\s]?link\s*\}/gi, trackingLink || "");

    switch (new_status) {
      case "pending":
        smsMessage = replaceVars(getMsg("sms_msg_pending", `${orderId} অর্ডার সফল হয়েছে, টোটাল ${total} টাকা। ধন্যবাদ! - এবি সিড`));
        smsReason = "order_created";
        sendSms = isOn("sms_on_pending");
        minaMessage = replaceVars(getMsg("mina_msg_pending", `আপনার ${orderId} অর্ডার সফলভাবে গৃহীত হয়েছে! অর্ডার সম্পর্কে জানাতে একজন প্রতিনিধি আপনাকে কল করবেন। 😊`));
        sendMina = isOn("mina_on_pending");
        break;

      case "no_response":
      case "good_but_no_response":
      case "busy":
        smsMessage = replaceVars(getMsg("sms_msg_no_response", `আপনাকে কল করে পাওয়া যায়নি, অনুগ্রহ করে 09617443377 নাম্বারে যোগাযোগ করুন`));
        smsReason = "no_response";
        sendSms = isOn("sms_on_no_response");
        minaMessage = replaceVars(getMsg("mina_msg_no_response", `আপনাকে কল করে পাওয়া যায়নি, অনুগ্রহ করে 09617443377 নাম্বারে যোগাযোগ করুন। 📞`));
        sendMina = isOn("mina_on_no_response");
        break;

      case "confirmed":
        smsMessage = replaceVars(getMsg("sms_msg_confirmed", `অভিনন্দন! অর্ডারটি কনফার্ম হয়েছে। টোটাল ${total} টাকা।`));
        smsReason = "order_confirmed";
        sendSms = isOn("sms_on_confirmed");
        minaMessage = replaceVars(getMsg("mina_msg_confirmed", `অভিনন্দন! আপনার ${orderId} অর্ডারটি কনফার্ম হয়েছে😊`));
        sendMina = isOn("mina_on_confirmed");
        break;

      case "entry_done":
        smsMessage = replaceVars(getMsg("sms_msg_entry_done", `যেকোনো প্রয়োজনে মেসেজ করুন- grihanova.com/help`));
        smsReason = "courier_entry";
        sendSms = isOn("sms_on_entry_done");
        minaMessage = replaceVars(getMsg("mina_msg_entry_done", `আপনার অর্ডার ${orderId} কুরিয়ারে পাঠানো হয়েছে। সাধারণত, ঢাকা ও আশেপাশে ২ দিনের মধ্যে ডেলিভারি সম্পন্ন হয় এবং সারাদেশে ২ থেকে ৩ দিন সময় লাগে। যেকোনো জরুরি অবস্থার জন্য সর্বোচ্চ ৫ দিন পর্যন্ত লাগতে পারে।\nআপনার পণ্যটি খুব দ্রুত আপনার কাছে পৌঁছে যাবে।`));
        sendMina = isOn("mina_on_entry_done");
        break;

      default:
        break;
    }

    const results: Record<string, unknown> = {};

    // ─── Check if customer has push subscription ───
    let hasPushSubscription = false;
    if (order.visitor_profile_id || order.visitor_id) {
      let subQuery = supabase.from("push_subscriptions").select("id", { count: "exact", head: true });
      if (order.visitor_profile_id) {
        subQuery = subQuery.eq("visitor_profile_id", order.visitor_profile_id);
      } else if (order.visitor_id) {
        subQuery = subQuery.eq("visitor_id", order.visitor_id);
      }
      const { count } = await subQuery;
      hasPushSubscription = (count || 0) > 0;
    }

    // If no push subscription, also check by phone → visitor_profile
    if (!hasPushSubscription && order.phone && !order.visitor_profile_id) {
      const { data: profile } = await supabase
        .from("visitor_profiles")
        .select("id")
        .eq("phone", order.phone)
        .limit(1)
        .maybeSingle();
      if (profile) {
        const { count } = await supabase
          .from("push_subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("visitor_profile_id", profile.id);
        hasPushSubscription = (count || 0) > 0;
      }
    }

    // ─── Send Push Notification (if subscription exists) ───
    let pushSentSuccessfully = false;
    if (minaMessage && hasPushSubscription) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        const pushTitleMap: Record<string, string> = {
          pending: "🛒 অর্ডার গৃহীত",
          no_response: "📞 কল করা হয়েছে",
          good_but_no_response: "📞 কল করা হয়েছে",
          busy: "📞 কল করা হয়েছে",
          confirmed: "✅ অর্ডার কনফার্মড",
          entry_done: "🚚 কুরিয়ারে হস্তান্তর",
        };
        const pushTitle = pushTitleMap[new_status] || `অর্ডার আপডেট: ${orderId}`;

        const pushPayload: Record<string, unknown> = {
          title: pushTitle,
          body: minaMessage,
          url: "/profile",
          tag: `order-${orderId}`,
        };

        if (order.visitor_profile_id) {
          pushPayload.visitor_profile_id = order.visitor_profile_id;
        } else if (order.visitor_id) {
          pushPayload.visitor_id = order.visitor_id;
        } else {
          const { data: profile } = await supabase
            .from("visitor_profiles")
            .select("id")
            .eq("phone", order.phone)
            .limit(1)
            .maybeSingle();
          if (profile) pushPayload.visitor_profile_id = profile.id;
        }

        if (pushPayload.visitor_profile_id || pushPayload.visitor_id) {
          const pushRes = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify(pushPayload),
          });
          const pushResult = await pushRes.json();
          pushSentSuccessfully = pushRes.ok && (pushResult.sent > 0 || pushResult.success);
          results.push_notification = { sent: pushSentSuccessfully, ...pushResult };
        }
      } catch (e) {
        console.error("Push notification error:", e);
        results.push_notification = { sent: false, error: String(e) };
      }
    } else if (minaMessage && !hasPushSubscription) {
      results.push_notification = { sent: false, reason: "No push subscription" };
    }

    // ─── Send SMS via E-COMAH API (always, when toggle ON — push disabled as fallback gate) ───
    if (smsMessage && sendSms && order.phone) {
      try {
        const { data: apiKeySetting } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "ecomah_api_key")
          .maybeSingle();

        const ecomahKey = apiKeySetting?.value;
        const safeSmsMessage = sanitizeSmsText(smsMessage);
        const validPhone = normalizeBdPhone(order.phone);

        if (!validPhone) {
          results.sms = { sent: false, reason: "invalid_phone" };
          await supabase.from("sms_logs").insert({
            phone: String(order.phone).slice(0, 32),
            message: safeSmsMessage,
            reason: smsReason || "status_change",
            result: { error: "invalid_phone" },
            status: "failed",
          });
        } else if (ecomahKey) {
          const res = await fetch("https://api.ecomah.com/sms-api", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": ecomahKey,
            },
            body: JSON.stringify({ action: "send_sms", number: validPhone, message: safeSmsMessage }),
          });

          const text = await res.text();
          let smsResult;
          try { smsResult = JSON.parse(text); } catch { smsResult = { raw: text }; }

          const isSuccess = res.ok && smsResult?.success === true;

          // Log SMS
          await supabase.from("sms_logs").insert({
            phone: validPhone,
            message: safeSmsMessage,
            reason: smsReason || "status_change",
            result: smsResult,
            status: isSuccess ? "sent" : "failed",
          });

          results.sms = { sent: isSuccess, fallback: true };
        } else {
          results.sms = { sent: false, reason: "SMS not configured" };
        }
      } catch (e) {
        console.error("SMS send error:", e);
        results.sms = { sent: false, error: String(e) };
      }
    }


    // ─── Push Mina Chat Message ───
    if (minaMessage && sendMina && chatEnabled) {
      try {
        // Find existing chat session by visitor_id, visitor_profile_id, or phone
        let session: any = null;

        if (order.visitor_profile_id) {
          const { data } = await supabase
            .from("ai_chat_sessions")
            .select("id, messages, message_count")
            .eq("visitor_profile_id", order.visitor_profile_id)
            .order("last_message_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          session = data;
        }

        if (!session && order.visitor_id) {
          const { data } = await supabase
            .from("ai_chat_sessions")
            .select("id, messages, message_count")
            .eq("visitor_id", order.visitor_id)
            .order("last_message_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          session = data;
        }

        if (!session && order.phone) {
          const { data } = await supabase
            .from("ai_chat_sessions")
            .select("id, messages, message_count")
            .eq("customer_phone", order.phone)
            .order("last_message_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          session = data;
        }

        if (session) {
          const messages = Array.isArray(session.messages) ? session.messages : [];
          const newMsg = {
            role: "assistant",
            content: minaMessage,
            timestamp: new Date().toISOString(),
          };
          messages.push(newMsg);

          // If no push subscription, add a prompt to enable notifications
          if (!hasPushSubscription) {
            const notifPrompt = {
              role: "assistant",
              content: "🔔 টিপস: নোটিফিকেশন চালু করলে অর্ডারের সকল আপডেট সরাসরি আপনার ফোনে পাবেন! নোটিফিকেশন চালু করতে grihanova.com ভিজিট করুন এবং 'নোটিফিকেশন চালু করুন' বাটনে ক্লিক করুন।",
              timestamp: new Date(Date.now() + 1000).toISOString(),
            };
            messages.push(notifPrompt);
          }

          await supabase
            .from("ai_chat_sessions")
            .update({
              messages,
              message_count: (session.message_count || 0) + (hasPushSubscription ? 1 : 2),
              last_message_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              is_read: false,
            })
            .eq("id", session.id);

          results.mina = { pushed: true, session_id: session.id, notif_prompt: !hasPushSubscription };
        } else {
          results.mina = { pushed: false, reason: "No chat session found" };
        }
      } catch (e) {
        console.error("Mina push error:", e);
        results.mina = { pushed: false, error: String(e) };
      }
    }

    return json({ success: true, hasPushSubscription, results });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return json({ error: msg }, 500);
  }
});
// 🔒 DO_NOT_MODIFY_END