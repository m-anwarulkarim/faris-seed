import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get Meta Ads credentials
    const { data: settings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["meta_ads_access_token", "meta_ad_account_id"]);

    const map: Record<string, string> = {};
    settings?.forEach((r: { key: string; value: string }) => { map[r.key] = r.value; });

    const accessToken = map["meta_ads_access_token"];
    const adAccountId = map["meta_ad_account_id"];

    if (!accessToken || !adAccountId) {
      return new Response(
        JSON.stringify({ error: "Meta Ads credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine which date to sync — default: yesterday
    let body: any = {};
    try { body = await req.json(); } catch {}
    
    const mode = body?.mode || "yesterday"; // "yesterday" | "today" | "backfill"
    const now = new Date();
    
    let datesToSync: string[] = [];

    if (mode === "today") {
      datesToSync = [now.toISOString().split("T")[0]];
    } else if (mode === "backfill") {
      // Backfill: find earliest order date, sync all missing dates
      const { data: existing } = await supabase
        .from("ads_daily_spend")
        .select("spend_date")
        .order("spend_date", { ascending: false })
        .limit(1);

      const lastSynced = existing?.[0]?.spend_date;
      const startDate = body?.start_date || lastSynced || 
        new Date(now.getFullYear(), now.getMonth() - 12, 1).toISOString().split("T")[0];
      
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const endDate = yesterday.toISOString().split("T")[0];

      // Get all dates already in DB
      const { data: existingDates } = await supabase
        .from("ads_daily_spend")
        .select("spend_date");
      const syncedSet = new Set((existingDates || []).map((d: any) => d.spend_date));

      // Generate missing dates
      const cursor = new Date(startDate);
      const end = new Date(endDate);
      while (cursor <= end) {
        const dateStr = cursor.toISOString().split("T")[0];
        if (!syncedSet.has(dateStr)) {
          datesToSync.push(dateStr);
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    } else {
      // yesterday
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().split("T")[0];

      // Check if already synced
      const { data: exists } = await supabase
        .from("ads_daily_spend")
        .select("id")
        .eq("spend_date", yStr)
        .maybeSingle();

      if (exists) {
        return new Response(
          JSON.stringify({ message: "Already synced", date: yStr }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      datesToSync = [yStr];
    }

    if (datesToSync.length === 0) {
      return new Response(
        JSON.stringify({ message: "No dates to sync" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get USD to BDT rate
    let bdtRate = 121;
    try {
      const rateRes = await fetch("https://open.er-api.com/v6/latest/USD");
      const rateData = await rateRes.json();
      if (rateData?.rates?.BDT) bdtRate = rateData.rates.BDT;
    } catch {}

    const results: any[] = [];

    // Process in batches (Meta API allows single day queries)
    for (const dateStr of datesToSync) {
      try {
        const fields = "campaign_name,impressions,clicks,spend,actions";
        const timeRange = encodeURIComponent(JSON.stringify({ since: dateStr, until: dateStr }));
        let nextUrl: string | null =
          `https://graph.facebook.com/v21.0/act_${adAccountId}/insights?fields=${fields}&level=campaign&time_range=${timeRange}&limit=500&use_unified_attribution_setting=true&access_token=${accessToken}`;

        const rows: any[] = [];
        let pageGuard = 0;
        let pageErr: any = null;
        while (nextUrl && pageGuard < 20) {
          const fbRes = await fetch(nextUrl);
          const fbData = await fbRes.json();
          if (!fbRes.ok) {
            pageErr = fbData?.error?.message || fbData;
            break;
          }
          rows.push(...(fbData.data || []));
          nextUrl = fbData?.paging?.next || null;
          pageGuard++;
        }
        if (pageErr) {
          console.error(`Meta API error for ${dateStr}:`, pageErr);
          results.push({ date: dateStr, error: pageErr });
          continue;
        }

        const campaigns = rows.map((row: any) => {
          const actions = row.actions || [];
          const getAction = (type: string) => {
            const a = actions.find((a: any) => a.action_type === type);
            return a ? parseInt(a.value) : 0;
          };
          return {
            campaign_name: row.campaign_name,
            impressions: parseInt(row.impressions || "0"),
            clicks: parseInt(row.clicks || "0"),
            spend: parseFloat(row.spend || "0"),
            purchases: getAction("purchase"),
          };
        });

        const totalSpendUsd = campaigns.reduce((s: number, c: any) => s + c.spend, 0);
        const totalImpressions = campaigns.reduce((s: number, c: any) => s + c.impressions, 0);
        const totalClicks = campaigns.reduce((s: number, c: any) => s + c.clicks, 0);
        const totalPurchases = campaigns.reduce((s: number, c: any) => s + c.purchases, 0);

        // Upsert (for "today" mode which may update)
        const { error: upsertErr } = await supabase
          .from("ads_daily_spend")
          .upsert({
            spend_date: dateStr,
            spend_usd: totalSpendUsd,
            spend_bdt: Math.round(totalSpendUsd * bdtRate),
            impressions: totalImpressions,
            clicks: totalClicks,
            purchases: totalPurchases,
            campaigns_data: campaigns,
          }, { onConflict: "spend_date" });

        if (upsertErr) {
          console.error(`DB error for ${dateStr}:`, upsertErr);
          results.push({ date: dateStr, error: upsertErr.message });
        } else {
          results.push({ date: dateStr, spend_usd: totalSpendUsd, spend_bdt: Math.round(totalSpendUsd * bdtRate) });
        }

        // Rate limit: small delay between requests
        if (datesToSync.length > 1) {
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (err) {
        console.error(`Error syncing ${dateStr}:`, err);
        results.push({ date: dateStr, error: String(err) });
      }
    }

    return new Response(
      JSON.stringify({ synced: results.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("sync-ads-daily error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
