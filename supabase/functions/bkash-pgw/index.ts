// bKash Tokenized Checkout integration
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const BASE_URLS = {
  sandbox: "https://tokenized.sandbox.bka.sh/v1.2.0-beta",
  live: "https://tokenized.pay.bka.sh/v1.2.0-beta",
};

interface Settings {
  id: number;
  enabled: boolean;
  mode: "sandbox" | "live";
  app_key: string | null;
  app_secret: string | null;
  username: string | null;
  password: string | null;
  token_cache: string | null;
  token_expires_at: string | null;
}

async function getSettings(): Promise<Settings | null> {
  const { data } = await supa.from("bkash_settings").select("*").eq("id", 1).maybeSingle();
  return data as Settings | null;
}

async function log(entry: Record<string, unknown>) {
  try {
    await supa.from("bkash_payment_logs").insert(entry);
  } catch (e) {
    console.error("log fail", e);
  }
}

async function getToken(s: Settings): Promise<string> {
  // reuse cached if valid for >2 min
  if (s.token_cache && s.token_expires_at) {
    const exp = new Date(s.token_expires_at).getTime();
    if (exp - Date.now() > 120_000) return s.token_cache;
  }
  if (!s.app_key || !s.app_secret || !s.username || !s.password) {
    throw new Error("bKash credentials not configured");
  }
  const url = `${BASE_URLS[s.mode]}/tokenized/checkout/token/grant`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      username: s.username,
      password: s.password,
    },
    body: JSON.stringify({ app_key: s.app_key, app_secret: s.app_secret }),
  });
  const data = await res.json();
  if (!data.id_token) {
    throw new Error(`Token grant failed: ${data.statusMessage || JSON.stringify(data)}`);
  }
  const expiresIn = Number(data.expires_in || 3600);
  await supa
    .from("bkash_settings")
    .update({
      token_cache: data.id_token,
      refresh_token_cache: data.refresh_token,
      token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    })
    .eq("id", 1);
  return data.id_token;
}

async function bkashFetch(s: Settings, path: string, body: unknown) {
  const token = await getToken(s);
  const res = await fetch(`${BASE_URLS[s.mode]}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      authorization: token,
      "x-app-key": s.app_key!,
    },
    body: JSON.stringify(body),
  });
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action = url.pathname.split("/").pop();
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    const s = await getSettings();
    if (!s) throw new Error("Settings missing");

    if (action === "test-connection") {
      try {
        const token = await getToken(s);
        return new Response(JSON.stringify({ ok: true, token: token.slice(0, 20) + "..." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ ok: false, error: e.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!s.enabled) {
      return new Response(JSON.stringify({ error: "bKash disabled" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      const { order_id, amount, callback_url } = body as {
        order_id: string;
        amount: number;
        callback_url: string;
      };
      if (!order_id || !amount || !callback_url) throw new Error("Missing fields");

      // verify order exists
      const { data: order } = await supa
        .from("orders")
        .select("id, customer_facing_id, payment_status")
        .eq("id", order_id)
        .maybeSingle();
      if (!order) throw new Error("Order not found");
      if (order.payment_status === "paid") throw new Error("Already paid");

      const payload = {
        mode: "0011",
        payerReference: order.customer_facing_id || order_id.slice(0, 8),
        callbackURL: callback_url,
        amount: amount.toFixed(2),
        currency: "BDT",
        intent: "sale",
        merchantInvoiceNumber: (order.customer_facing_id || order_id.slice(0, 10)).toString(),
      };
      const resp = await bkashFetch(s, "/tokenized/checkout/create", payload);
      await log({
        order_id,
        payment_id: resp.paymentID,
        action: "create",
        status: resp.statusCode === "0000" ? "success" : "fail",
        amount,
        request: payload,
        response: resp,
        error: resp.statusCode !== "0000" ? resp.statusMessage : null,
      });
      if (resp.statusCode !== "0000") throw new Error(resp.statusMessage || "Create failed");

      await supa
        .from("orders")
        .update({
          payment_method: "bkash",
          payment_status: "pending",
          bkash_payment_id: resp.paymentID,
        })
        .eq("id", order_id);

      return new Response(JSON.stringify({ paymentID: resp.paymentID, bkashURL: resp.bkashURL }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "execute") {
      const { paymentID } = body as { paymentID: string };
      if (!paymentID) throw new Error("paymentID required");
      const resp = await bkashFetch(s, "/tokenized/checkout/execute", { paymentID });

      const { data: order } = await supa
        .from("orders")
        .select("id")
        .eq("bkash_payment_id", paymentID)
        .maybeSingle();

      const success = resp.statusCode === "0000" && resp.transactionStatus === "Completed";

      await log({
        order_id: order?.id || null,
        payment_id: paymentID,
        trx_id: resp.trxID || null,
        action: "execute",
        status: success ? "paid" : "fail",
        amount: resp.amount ? Number(resp.amount) : null,
        payer_msisdn: resp.payerAccount || null,
        response: resp,
        error: !success ? resp.statusMessage || "Execute failed" : null,
      });

      if (order) {
        const updates: Record<string, unknown> = {
          payment_status: success ? "paid" : "failed",
          paid_amount: success && resp.amount ? Number(resp.amount) : null,
          bkash_trx_id: resp.trxID || null,
          bkash_payer_msisdn: resp.payerAccount || null,
        };
        // Auto-confirm the order when bKash payment succeeds
        if (success) {
          updates.status = "confirmed";
          updates.confirmed_at = new Date().toISOString();
        }
        await supa.from("orders").update(updates).eq("id", order.id);

        // Fire status notification (SMS / push) on success
        if (success) {
          try {
            await supa.functions.invoke("order-status-notify", {
              body: { order_id: order.id, new_status: "confirmed" },
            });
          } catch (e) {
            console.error("order-status-notify failed", e);
          }
        }
      }

      return new Response(
        JSON.stringify({ success, order_id: order?.id, trxID: resp.trxID, response: resp }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "query") {
      const { paymentID } = body as { paymentID: string };
      const resp = await bkashFetch(s, "/tokenized/checkout/payment/status", { paymentID });
      return new Response(JSON.stringify(resp), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "refund") {
      const { paymentID, trxID, amount, reason } = body as {
        paymentID: string;
        trxID: string;
        amount: number;
        reason?: string;
      };
      const payload = {
        paymentID,
        trxID,
        amount: amount.toFixed(2),
        sku: reason || "refund",
        reason: reason || "Customer refund",
      };
      const resp = await bkashFetch(s, "/tokenized/checkout/payment/refund", payload);
      const success = resp.statusCode === "0000";

      const { data: order } = await supa
        .from("orders")
        .select("id")
        .eq("bkash_payment_id", paymentID)
        .maybeSingle();

      await log({
        order_id: order?.id || null,
        payment_id: paymentID,
        trx_id: trxID,
        action: "refund",
        status: success ? "refunded" : "fail",
        amount,
        request: payload,
        response: resp,
        error: !success ? resp.statusMessage : null,
      });

      if (success && order) {
        await supa.from("orders").update({ payment_status: "refunded" }).eq("id", order.id);
      }

      return new Response(JSON.stringify({ success, response: resp }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("bkash-pgw error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
