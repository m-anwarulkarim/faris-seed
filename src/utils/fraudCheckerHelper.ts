import { supabase } from "@/integrations/supabase/client";

export async function checkFraudStatus(phone: string, force = false): Promise<any> {
  const normalizedPhone = phone.trim();
  if (!normalizedPhone || normalizedPhone.length < 11) return null;

  // 1. Try Supabase Edge Function first
  try {
    const { data, error } = await supabase.functions.invoke("fraud-checker", {
      body: { action: force ? "force_check" : "check", phone: normalizedPhone },
    });
    if (!error && data?.success && data?.data) {
      return data.data;
    }
    if (!error && data && !data.error && data.total_orders !== undefined) {
      return data;
    }
  } catch (err) {
    console.warn("[FraudChecker] Edge function failed/missing, switching to direct API:", err);
  }

  // 2. Direct Fallback: Fetch E-COMAH API key and call E-COMAH API directly
  try {
    const { data: keyData } = await supabase
      .from("app_settings")
      .select("value")
      .in("key", ["ecomah_api_key", "fraud_checker_api_key"])
      .limit(1)
      .maybeSingle();

    const apiKeyVal = keyData?.value;
    if (!apiKeyVal) return null;

    const res = await fetch("https://api.ecomah.com/fraud-checker", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKeyVal,
      },
      body: JSON.stringify({ action: force ? "force_check" : "check", phone: normalizedPhone }),
    });

    if (res.ok) {
      const json = await res.json();
      if (json?.data) return json.data;
      if (json?.success && json?.data === undefined) return json;
    }
  } catch (err) {
    console.error("[FraudChecker] Direct API fallback failed:", err);
  }

  return null;
}
