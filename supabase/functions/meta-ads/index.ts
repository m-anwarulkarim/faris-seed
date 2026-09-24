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
    const { date_from, date_to } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get Meta Ads credentials from app_settings
    const { data: settings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["meta_ads_access_token", "meta_ad_account_id"]);

    const map: Record<string, string> = {};
    settings?.forEach((r: { key: string; value: string }) => {
      map[r.key] = r.value;
    });

    const accessToken = map["meta_ads_access_token"];
    const adAccountId = map["meta_ad_account_id"];

    if (!accessToken || !adAccountId) {
      return new Response(
        JSON.stringify({ error: "Meta Ads API credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build date range
    const now = new Date();
    // Build date range — Meta API allows max 37 months back
    const maxPast = new Date(now);
    maxPast.setMonth(maxPast.getMonth() - 36);
    const sinceDateStr = date_from || maxPast.toISOString().split("T")[0];
    const untilDateStr = date_to || now.toISOString().split("T")[0];

    // Fetch campaign insights from Meta Marketing API (with pagination)
    const fields = "campaign_name,impressions,clicks,spend,ctr,cpc,cpm,actions,reach,frequency";
    const timeRange = encodeURIComponent(JSON.stringify({ since: sinceDateStr, until: untilDateStr }));
    let nextUrl: string | null =
      `https://graph.facebook.com/v21.0/act_${adAccountId}/insights?fields=${fields}&level=campaign&time_range=${timeRange}&limit=500&use_unified_attribution_setting=true&access_token=${accessToken}`;

    const allRows: any[] = [];
    let pageGuard = 0;
    while (nextUrl && pageGuard < 20) {
      const fbRes = await fetch(nextUrl);
      const fbData = await fbRes.json();
      if (!fbRes.ok) {
        console.error("Meta Ads API error:", fbData);
        return new Response(
          JSON.stringify({ error: "Meta Ads API error", details: fbData?.error?.message || fbData }),
          { status: fbRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      allRows.push(...(fbData.data || []));
      nextUrl = fbData?.paging?.next || null;
      pageGuard++;
    }
    const fbData = { data: allRows };

    // Parse actions to extract conversions (purchases, leads, etc.)
    const campaigns = (fbData.data || []).map((row: any) => {
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
        ctr: parseFloat(row.ctr || "0"),
        cpc: parseFloat(row.cpc || "0"),
        cpm: parseFloat(row.cpm || "0"),
        reach: parseInt(row.reach || "0"),
        frequency: parseFloat(row.frequency || "0"),
        purchases: getAction("purchase"),
        leads: getAction("lead"),
        add_to_cart: getAction("add_to_cart"),
        link_clicks: getAction("link_click"),
      };
    });

    // Calculate totals
    const totals = campaigns.reduce(
      (acc: any, c: any) => ({
        impressions: acc.impressions + c.impressions,
        clicks: acc.clicks + c.clicks,
        spend: acc.spend + c.spend,
        reach: acc.reach + c.reach,
        purchases: acc.purchases + c.purchases,
        leads: acc.leads + c.leads,
      }),
      { impressions: 0, clicks: 0, spend: 0, reach: 0, purchases: 0, leads: 0 }
    );

    if (totals.impressions > 0) {
      totals.ctr = ((totals.clicks / totals.impressions) * 100).toFixed(2);
      totals.cpc = totals.clicks > 0 ? (totals.spend / totals.clicks).toFixed(2) : "0";
      totals.cpm = ((totals.spend / totals.impressions) * 1000).toFixed(2);
    }

    return new Response(
      JSON.stringify({ campaigns, totals, date_from: sinceDateStr, date_to: untilDateStr }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Meta Ads edge function error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
