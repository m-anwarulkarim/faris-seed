import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { action, session_ids, limit } = await req.json();

    // ─── Action: review — Analyze specific conversations ───
    if (action === "review") {
      if (!session_ids || !Array.isArray(session_ids) || session_ids.length === 0) {
        return new Response(JSON.stringify({ error: "session_ids required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch sessions
      const { data: sessions, error: sessErr } = await sb
        .from("ai_chat_sessions")
        .select("id, customer_name, customer_phone, messages")
        .in("id", session_ids.slice(0, 10)); // Max 10 at a time
      if (sessErr) throw sessErr;

      // Fetch saved_replies for reference
      const { data: savedReplies } = await sb
        .from("saved_replies")
        .select("trigger_patterns, reply_text, is_active")
        .eq("is_active", true);

      // Fetch products for context
      const { data: products } = await sb
        .from("products")
        .select("name, sku, category, regular_price, offer_price")
        .eq("is_hidden", false)
        .limit(100);

      const productList = (products || []).map((p: any) => `${p.name} (${p.sku}) - ৳${p.offer_price || p.regular_price}`).join("\n");
      const savedReplyList = (savedReplies || []).map((r: any) => `ট্রিগার: ${r.trigger_patterns.join(", ")} → ${r.reply_text.slice(0, 80)}...`).join("\n");

      // Build review prompt
      const conversationsText = (sessions || []).map((s: any) => {
        const msgs = Array.isArray(s.messages) ? s.messages : [];
        const convo = msgs.map((m: any) => {
          const role = m.role === "user" ? "কাস্টমার" : (m.source === "system" ? "অটো-রিপ্লাই" : "AI (মিনা)");
          return `[${role}]: ${(m.content || "").slice(0, 500)}`;
        }).join("\n");
        return `=== সেশন: ${s.customer_name || s.customer_phone || "অজানা"} ===\n${convo}`;
      }).join("\n\n");

      const systemPrompt = `তুমি "তাইবা" — একজন বাংলাদেশি কৃষি ই-কমার্স কোম্পানির AI কোয়ালিটি অডিটর।

তোমার কাজ:
1. প্রতিটি conversation বিশ্লেষণ করে ভুল, অসম্পূর্ণ বা বিভ্রান্তিকর উত্তর চিহ্নিত করা
2. অটো-রিপ্লাই সঠিক context-এ পাঠানো হয়েছে কিনা যাচাই করা
3. AI (মিনা) এর উত্তরে ভুল তথ্য, অপ্রাসঙ্গিক সাজেশন, বা অর্ডার মিস হয়েছে কিনা খুঁজে বের করা
4. যেসব ক্ষেত্রে উন্নতি সম্ভব সেগুলোর জন্য সুনির্দিষ্ট সুপারিশ দেওয়া

আমাদের পণ্যের তালিকা:
${productList}

বর্তমান অটো-রিপ্লাই তালিকা:
${savedReplyList}

তোমার রিপোর্ট ফরম্যাট:
প্রতিটি সেশনের জন্য:
- 📊 সেশন স্কোর: (১-১০)
- ✅ ভালো দিক: কী সঠিকভাবে হয়েছে
- ❌ সমস্যা: কী ভুল হয়েছে (সুনির্দিষ্টভাবে)
- 💡 সুপারিশ: কীভাবে উন্নতি করা যায়
- 🔧 অ্যাকশন আইটেম: নতুন saved_reply যোগ করা উচিত কিনা, training data আপডেট করা উচিত কিনা

সবশেষে:
- 📋 সামগ্রিক সারাংশ
- 🎯 সর্বোচ্চ অগ্রাধিকার ৩টি উন্নতি`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `এই conversation গুলো রিভিউ করো:\n\n${conversationsText}` },
          ],
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error("Taiba AI error:", aiResponse.status, errText);
        return new Response(JSON.stringify({ error: `AI error: ${aiResponse.status}` }), {
          status: aiResponse.status === 429 ? 429 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiData = await aiResponse.json();
      const reviewContent = aiData.choices?.[0]?.message?.content || "রিভিউ জেনারেট করা যায়নি।";
      const tokensUsed = aiData.usage?.total_tokens || 0;

      // Log token usage
      await sb.from("admin_ai_token_logs").insert({
        category: "taiba_review",
        tokens_used: tokensUsed,
        metadata: { session_count: session_ids.length, session_ids },
      });

      return new Response(JSON.stringify({
        review: reviewContent,
        tokens_used: tokensUsed,
        sessions_reviewed: (sessions || []).length,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Action: batch_audit — Review recent conversations in bulk ───
    if (action === "batch_audit") {
      const batchLimit = Math.min(limit || 20, 50);

      // Get recent sessions with enough messages
      const { data: sessions, error: sessErr } = await sb
        .from("ai_chat_sessions")
        .select("id, customer_name, customer_phone, messages, message_count")
        .gte("message_count", 3)
        .order("last_message_at", { ascending: false })
        .limit(batchLimit);
      if (sessErr) throw sessErr;

      // Fetch products & saved replies
      const [{ data: products }, { data: savedReplies }] = await Promise.all([
        sb.from("products").select("name, sku, offer_price, regular_price").eq("is_hidden", false).limit(100),
        sb.from("saved_replies").select("trigger_patterns, reply_text").eq("is_active", true),
      ]);

      const productList = (products || []).map((p: any) => `${p.name} - ৳${p.offer_price || p.regular_price}`).join(", ");

      // Analyze each session locally first for quick stats
      const sessionSummaries: any[] = [];
      for (const s of (sessions || [])) {
        const msgs = Array.isArray(s.messages) ? s.messages : [];
        const aiMsgs = msgs.filter((m: any) => m.role === "assistant" && m.source !== "system");
        const systemMsgs = msgs.filter((m: any) => m.role === "assistant" && (m.source === "system" || (m.content || "").startsWith("\u2063\u2063")));
        const userMsgs = msgs.filter((m: any) => m.role === "user");

        // Check if conversation ended without order (potential missed order)
        const lastUserMsg = userMsgs[userMsgs.length - 1]?.content || "";
        const hasPhoneInConvo = msgs.some((m: any) => /01[3-9]\d{8}/.test(m.content || ""));
        const hasAddressInConvo = msgs.some((m: any) => /(বাড়ি|রোড|থানা|জেলা|পোস্ট|গ্রাম|ঠিকানা)/i.test(m.content || ""));
        const hasOrderInConvo = msgs.some((m: any) => /অর্ডার.*নিশ্চিত|order.*confirmed|AB\d+/i.test(m.content || ""));

        sessionSummaries.push({
          id: s.id,
          name: s.customer_name || s.customer_phone || "অজানা",
          total_msgs: msgs.length,
          ai_msgs: aiMsgs.length,
          system_msgs: systemMsgs.length,
          potential_missed_order: hasPhoneInConvo && hasAddressInConvo && !hasOrderInConvo,
          last_user_msg: lastUserMsg.slice(0, 100),
        });
      }

      // Use AI to analyze problematic sessions
      const problemSessions = sessionSummaries.filter(s => s.potential_missed_order || s.ai_msgs > 5);
      
      let aiInsight = "";
      if (problemSessions.length > 0) {
        const problemSessionIds = problemSessions.map(s => s.id);
        const problemData = (sessions || [])
          .filter((s: any) => problemSessionIds.includes(s.id))
          .slice(0, 5) // Max 5 for AI analysis
          .map((s: any) => {
            const msgs = Array.isArray(s.messages) ? s.messages : [];
            return `=== ${s.customer_name || s.customer_phone || "অজানা"} ===\n` +
              msgs.slice(-10).map((m: any) => `[${m.role === "user" ? "কাস্টমার" : m.source === "system" ? "অটো" : "AI"}]: ${(m.content || "").slice(0, 300)}`).join("\n");
          }).join("\n\n");

        const auditResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: `তুমি তাইবা, AI কোয়ালিটি অডিটর। সংক্ষেপে সমস্যাগুলো বলো। পণ্য: ${productList.slice(0, 500)}` },
              { role: "user", content: `সমস্যাযুক্ত conversations:\n${problemData}` },
            ],
          }),
        });

        if (auditResp.ok) {
          const d = await auditResp.json();
          aiInsight = d.choices?.[0]?.message?.content || "";
          const tokens = d.usage?.total_tokens || 0;
          await sb.from("admin_ai_token_logs").insert({
            category: "taiba_batch_audit",
            tokens_used: tokens,
            metadata: { batch_size: batchLimit, problems_found: problemSessions.length },
          });
        }
      }

      return new Response(JSON.stringify({
        total_reviewed: sessionSummaries.length,
        summaries: sessionSummaries,
        problem_count: problemSessions.length,
        ai_insight: aiInsight,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Action: learn — Extract good patterns from conversations ───
    if (action === "learn") {
      const learnLimit = Math.min(limit || 50, 200);

      // Get sessions that resulted in successful orders (good conversations)
      const { data: sessions } = await sb
        .from("ai_chat_sessions")
        .select("id, customer_name, customer_phone, messages")
        .gte("message_count", 4)
        .order("last_message_at", { ascending: false })
        .limit(learnLimit);

      // Find sessions where orders were placed (check by phone)
      const phones = (sessions || []).map((s: any) => s.customer_phone).filter(Boolean);
      const { data: orders } = await sb
        .from("orders")
        .select("phone, status")
        .in("phone", phones)
        .eq("is_deleted", false);

      const successPhones = new Set((orders || []).filter((o: any) => ["confirmed", "delivered", "shipped"].includes(o.status)).map((o: any) => o.phone));

      // Good conversations = ones that led to successful orders
      const goodConversations = (sessions || [])
        .filter((s: any) => s.customer_phone && successPhones.has(s.customer_phone))
        .slice(0, 10);

      if (goodConversations.length === 0) {
        return new Response(JSON.stringify({ 
          message: "ভালো conversation পাওয়া যায়নি। আরো ডেটা জমা হলে আবার চেষ্টা করুন।",
          patterns: [],
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const convoText = goodConversations.map((s: any) => {
        const msgs = Array.isArray(s.messages) ? s.messages : [];
        return msgs.map((m: any) => `[${m.role === "user" ? "কাস্টমার" : m.source === "system" ? "অটো" : "AI"}]: ${(m.content || "").slice(0, 400)}`).join("\n");
      }).join("\n---\n");

      const learnResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            {
              role: "system",
              content: `তুমি তাইবা। সফল conversation থেকে প্যাটার্ন বের করো। JSON ফরম্যাটে:
{
  "good_patterns": [
    {
      "trigger": "কাস্টমার যা বলেছে",
      "good_response": "AI/অটো যে ভালো উত্তর দিয়েছে",
      "why_good": "কেন এটি ভালো ছিল"
    }
  ],
  "suggested_auto_replies": [
    {
      "trigger_patterns": ["ট্রিগার ১", "ট্রিগার ২"],
      "reply_text": "সাজেস্টেড অটো-রিপ্লাই"
    }
  ],
  "training_suggestions": [
    {
      "title": "শিরোনাম",
      "content": "AI training data-তে যোগ করার জন্য কনটেন্ট"
    }
  ]
}`,
            },
            { role: "user", content: `সফল conversations (অর্ডার নিশ্চিত হয়েছে):\n${convoText}` },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_patterns",
                description: "Extract good patterns and suggestions from conversations",
                parameters: {
                  type: "object",
                  properties: {
                    good_patterns: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          trigger: { type: "string" },
                          good_response: { type: "string" },
                          why_good: { type: "string" },
                        },
                        required: ["trigger", "good_response", "why_good"],
                      },
                    },
                    suggested_auto_replies: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          trigger_patterns: { type: "array", items: { type: "string" } },
                          reply_text: { type: "string" },
                        },
                        required: ["trigger_patterns", "reply_text"],
                      },
                    },
                    training_suggestions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          content: { type: "string" },
                        },
                        required: ["title", "content"],
                      },
                    },
                  },
                  required: ["good_patterns", "suggested_auto_replies", "training_suggestions"],
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "extract_patterns" } },
        }),
      });

      if (!learnResp.ok) {
        return new Response(JSON.stringify({ error: `AI error: ${learnResp.status}` }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const learnData = await learnResp.json();
      const tokensUsed = learnData.usage?.total_tokens || 0;

      let patterns: any = { good_patterns: [], suggested_auto_replies: [], training_suggestions: [] };
      const toolCall = learnData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        try {
          patterns = JSON.parse(toolCall.function.arguments);
        } catch {
          patterns = { good_patterns: [], suggested_auto_replies: [], training_suggestions: [] };
        }
      }

      // ─── Auto-apply: Insert suggested saved_replies ───
      let repliesAdded = 0;
      if (patterns.suggested_auto_replies?.length > 0) {
        for (const sr of patterns.suggested_auto_replies) {
          if (!sr.trigger_patterns?.length || !sr.reply_text) continue;
          // Check if similar trigger already exists
          const { data: existing } = await sb
            .from("saved_replies")
            .select("id, trigger_patterns")
            .eq("is_active", true);
          const allExistingTriggers = (existing || []).flatMap((r: any) => r.trigger_patterns.map((t: string) => t.toLowerCase()));
          const isNew = sr.trigger_patterns.some((t: string) => !allExistingTriggers.includes(t.toLowerCase()));
          if (isNew) {
            await sb.from("saved_replies").insert({
              trigger_patterns: sr.trigger_patterns,
              reply_text: sr.reply_text,
              match_type: "contains",
              priority: 5,
              is_active: true,
            });
            repliesAdded++;
          }
        }
      }

      // ─── Auto-apply: Insert training suggestions ───
      let trainingAdded = 0;
      if (patterns.training_suggestions?.length > 0) {
        for (const ts of patterns.training_suggestions) {
          if (!ts.title || !ts.content) continue;
          // Check duplicate by title
          const { data: existingTd } = await sb
            .from("ai_training_data")
            .select("id")
            .ilike("title", ts.title)
            .limit(1);
          if (!existingTd?.length) {
            await sb.from("ai_training_data").insert({
              title: `[তাইবা] ${ts.title}`,
              content: ts.content,
              category: "taiba_learned",
              is_active: true,
            });
            trainingAdded++;
          }
        }
      }

      await sb.from("admin_ai_token_logs").insert({
        category: "taiba_learn",
        tokens_used: tokensUsed,
        metadata: {
          conversations_analyzed: goodConversations.length,
          replies_added: repliesAdded,
          training_added: trainingAdded,
        },
      });

      return new Response(JSON.stringify({
        patterns,
        conversations_analyzed: goodConversations.length,
        tokens_used: tokensUsed,
        auto_applied: { replies_added: repliesAdded, training_added: trainingAdded },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use: review, batch_audit, or learn" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Taiba error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
