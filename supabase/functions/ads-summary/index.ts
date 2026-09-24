import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = "তুমি একজন সিনিয়র ডিজিটাল মার্কেটিং স্ট্র্যাটেজিস্ট। তুমি Meta Ads ডাটা বিশ্লেষণে বিশেষজ্ঞ। বাংলায় উত্তর দাও, প্রয়োজনে ইংরেজি টার্ম ব্যবহার করো। মার্কডাউন ফরম্যাটিং ব্যবহার করো। কখনো নমস্কার/অভিবাদন বা নিজের পরিচয় দিয়ে শুরু করবে না — সরাসরি বিশ্লেষণে যাবে। সবচেয়ে গুরুত্বপূর্ণ ৩টি মেট্রিক: Total Spend, Purchases এবং Cost per Purchase — এগুলো সবসময় আগে এবং বিশেষ গুরুত্ব দিয়ে বিশ্লেষণ করবে।";

function buildDataBlock(campaigns: any[], totals: any, date_from: string, date_to: string): string {
  const topCampaigns = (campaigns || [])
    .sort((a: any, b: any) => b.spend - a.spend)
    .slice(0, 15)
    .map((c: any, i: number) => `${i + 1}. ${c.campaign_name}: Spend ৳${c.spend.toFixed(2)}, Impr ${c.impressions}, Clicks ${c.clicks}, CTR ${c.ctr.toFixed(2)}%, CPC ৳${c.cpc.toFixed(2)}, CPM ৳${c.cpm.toFixed(2)}, Reach ${c.reach}, Purchases ${c.purchases}, Leads ${c.leads}, AddToCart ${c.add_to_cart}`)
    .join("\n");

  return `📅 তারিখ: ${date_from} → ${date_to}
💰 মোট খরচ: ৳${totals?.spend?.toFixed(2) || 0}
👁 ইম্প্রেশন: ${totals?.impressions || 0}
🖱 ক্লিক: ${totals?.clicks || 0}
👥 রিচ: ${totals?.reach || 0}
📊 CTR: ${totals?.ctr || 0}%
💵 CPC: ৳${totals?.cpc || 0}
📈 CPM: ৳${totals?.cpm || 0}
🛒 পারচেজ: ${totals?.purchases || 0}
📋 লিডস: ${totals?.leads || 0}
📦 মোট ক্যাম্পেইন: ${campaigns?.length || 0}

ক্যাম্পেইন ডিটেইলস:
${topCampaigns}`;
}

const MODE_PROMPTS: Record<string, string> = {
  summary: `নিচের Meta Ads ডাটা বিশ্লেষণ করে একটি বিস্তারিত সামারি দাও:

নির্দেশনা:
1. **সামগ্রিক পারফর্মেন্স রেটিং** — ⭐ দিয়ে (১-৫) রেট করো এবং কেন
2. **সেরা ক্যাম্পেইন** — কোনটি সবচেয়ে ভালো করেছে, কেন (CTR, CPC, Conversions দিয়ে ব্যাখ্যা)
3. **দুর্বল ক্যাম্পেইন** — কোনটিতে টাকা নষ্ট হচ্ছে
4. **Key Metrics Analysis** — CTR, CPC, CPM industry benchmark এর তুলনায় কেমন
5. **ROI হিসাব** — Spend vs Purchases থেকে Cost per Purchase বের করো`,

  compare: `নিচের Meta Ads ক্যাম্পেইন ডাটা তুলনা করো:

নির্দেশনা:
1. **ক্যাম্পেইন র‍্যাংকিং** — সেরা থেকে খারাপ, টেবিল আকারে (Campaign | Spend | CTR | CPC | Purchases | Score)
2. **Winner vs Loser** — সেরা ও সবচেয়ে খারাপ ক্যাম্পেইনের তুলনা
3. **Efficiency Score** — প্রতিটি ক্যাম্পেইনের Cost per Result হিসাব করো
4. **Budget Allocation** — কোন ক্যাম্পেইনে বাজেট বাড়ানো উচিত, কোনটিতে কমানো
5. **Pattern Analysis** — কোন ধরনের ক্যাম্পেইন (ভিডিও/ফটো/ক্যারোসেল) ভালো করছে`,

  suggestion: `নিচের Meta Ads ডাটা দেখে অ্যাকশনেবল পরামর্শ দাও:

নির্দেশনা:
1. **তাৎক্ষণিক পদক্ষেপ (আজই করুন)** — ৩-৫টি দ্রুত অ্যাকশন
2. **বাজেট অপ্টিমাইজেশন** — কোথায় বাজেট শিফট করবেন, exact % সহ
3. **ক্রিয়েটিভ পরামর্শ** — কোন ক্যাম্পেইনের অ্যাড কপি/ক্রিয়েটিভ চেঞ্জ করা উচিত
4. **টার্গেটিং পরামর্শ** — অডিয়েন্স টার্গেটিং কিভাবে উন্নত করবেন
5. **স্কেলিং প্ল্যান** — সেরা ক্যাম্পেইনগুলো কিভাবে স্কেল করবেন
6. **A/B টেস্ট আইডিয়া** — ২-৩টি টেস্ট প্রস্তাব`,

  waste: `নিচের Meta Ads ডাটা দেখে বাজেট অপচয় বিশ্লেষণ করো:

নির্দেশনা:
1. **অপচয়ের পরিমাণ** — মোট কত টাকা অপচয় হচ্ছে (কম CTR/বেশি CPC/০ Purchase ক্যাম্পেইন)
2. **সমস্যাযুক্ত ক্যাম্পেইন** — কোনগুলো বন্ধ করা উচিত এবং কেন
3. **সেভিংস প্ল্যান** — অপচয় কমিয়ে কত টাকা বাঁচানো সম্ভব
4. **রিঅ্যালোকেশন** — বাঁচানো টাকা কোথায় খরচ করবেন
5. **Warning Signs** — কোন মেট্রিক্স দেখে বুঝবেন ক্যাম্পেইন কাজ করছে না`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaigns, totals, date_from, date_to, mode = "summary" } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dataBlock = buildDataBlock(campaigns, totals, date_from, date_to);
    const modePrompt = MODE_PROMPTS[mode] || MODE_PROMPTS["summary"];
    const prompt = `${modePrompt}\n\nডাটা:\n${dataBlock}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "AI রেট লিমিট, কিছুক্ষণ পর চেষ্টা করুন" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI ক্রেডিট শেষ, টপ আপ করুন" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiRes.text();
      console.error("AI error:", aiRes.status, t);
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const summary = aiData.choices?.[0]?.message?.content || "সামারি তৈরি করা যায়নি।";
    const tokensUsed = aiData.usage?.total_tokens || 0;

    // Log admin token usage
    if (tokensUsed > 0) {
      try {
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await sb.from("admin_ai_token_logs").insert({
          category: "ads_summary",
          tokens_used: tokensUsed,
          metadata: { mode, campaign_count: campaigns?.length || 0 },
        });
      } catch (e) { console.error("Token log error:", e); }
    }

    return new Response(JSON.stringify({ summary, mode, tokens_used: tokensUsed }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ads-summary error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
