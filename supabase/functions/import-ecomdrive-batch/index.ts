import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STATUS_MAP: Record<string, string> = {
  "Pending": "pending",
  "Confirmed": "confirmed",
  "Processing": "confirmed",
  "Shipped": "shipped",
  "In Transit": "shipped",
  "Out for Delivery": "shipped",
  "Delivered": "delivered",
  "Cancelled": "cancelled",
  "Returned": "return",
  "Return": "return",
  "Partial Delivered": "delivered",
};

// EcomDrive API limit: 250 requests/hour → ~4/min
// Cron runs every 60s, so process 3 items per call to stay safe
const MAX_BATCH_PER_CALL = 3;
const API_DELAY_MS = 1500; // 1.5s between API calls

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const apiKey = Deno.env.get("ECOMDRIVE_API_KEY")!;
    const businessId = Deno.env.get("ECOMDRIVE_BUSINESS_ID")!;
    const baseUrl = "https://my.ecomdrivebd.com/api/external";

    // Get current import progress
    const { data: progress, error: pErr } = await supabase
      .from("import_progress")
      .select("*")
      .eq("source", "ecomdrive")
      .maybeSingle();

    if (pErr) throw pErr;
    if (!progress) {
      return new Response(JSON.stringify({ success: false, error: "No import job found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If not running, return immediately (no DB queries wasted)
    if (progress.status !== "running") {
      return new Response(JSON.stringify({ success: true, message: `Import is ${progress.status}`, status: progress.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const batchSize = MAX_BATCH_PER_CALL;
    const startInvoice = progress.current_invoice;
    const maxInvoice = progress.max_invoice;
    let imported = 0, skipped = 0, errors = 0;
    let currentInvoice = startInvoice;

    // Fetch products SKU->ID map for matching
    const { data: products } = await supabase.from("products").select("id, sku, name");
    const skuMap: Record<string, string> = {};
    const nameMap: Record<string, string> = {};
    for (const p of products || []) {
      if (p.sku) skuMap[p.sku.toLowerCase().trim()] = p.id;
      if (p.name) nameMap[p.name.toLowerCase().trim()] = p.id;
    }

    // Pre-check which orders already exist in this batch range
    const invoiceIds = [];
    for (let i = 0; i < batchSize && (startInvoice + i) <= maxInvoice; i++) {
      invoiceIds.push(`ECD${startInvoice + i}`);
    }
    const { data: existingOrders } = await supabase
      .from("orders")
      .select("order_id")
      .in("order_id", invoiceIds);
    const existingSet = new Set((existingOrders || []).map(o => o.order_id));

    for (let i = 0; i < batchSize && currentInvoice <= maxInvoice; i++, currentInvoice++) {
      const orderId = `ECD${currentInvoice}`;

      // Skip if already exists (no API call needed!)
      if (existingSet.has(orderId)) {
        skipped++;
        continue;
      }

      try {
        const resp = await fetch(
          `${baseUrl}/orders/tracking?businessId=${businessId}&invoiceNumber=${currentInvoice}`,
          { headers: { "X-API-Key": apiKey } }
        );

        if (resp.status === 429) {
          // Rate limited - save progress and stop
          await supabase.from("import_progress").update({
            current_invoice: currentInvoice,
            total_imported: progress.total_imported + imported,
            total_skipped: progress.total_skipped + skipped,
            total_errors: progress.total_errors + errors,
            last_run_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", progress.id);

          return new Response(JSON.stringify({
            success: true, message: "Rate limited, will continue next run",
            batch: { imported, skipped, errors, stoppedAt: currentInvoice },
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const data = await resp.json();
        if (!data.success || !data.data?.order) {
          skipped++;
          continue; // No API delay needed for missing invoices
        }

        const order = data.data.order;
        const items = data.data.items || [];
        const tracking = data.data.tracking;

        // Calculate subtotal from items
        const subtotal = items.reduce((s: number, it: any) => s + (it.itemTotal || it.price * it.quantity || 0), 0);

        // Insert order
        const { data: newOrder, error: oErr } = await supabase.from("orders").insert({
          order_id: orderId,
          customer_name: order.customerName || "Unknown",
          phone: order.customerPhone || "",
          address: order.customerAddress || "",
          total_amount: order.grandTotal || 0,
          delivery_charge: order.deliveryCharge || 0,
          advance: order.advance || 0,
          discount: order.discount || 0,
          status: STATUS_MAP[order.status] || "pending",
          consignment_id: tracking?.consignmentId || null,
          tracking_code: tracking?.trackingId || null,
          delivery_status: tracking?.currentStatus || null,
          traffic_source: "ecomdrive",
          is_courier_entered: !!tracking?.consignmentId,
          created_at: order.createdAt || new Date().toISOString(),
        }).select("id").maybeSingle();

        if (oErr || !newOrder) { errors++; continue; }

        // Insert order items
        const itemInserts = [];
        for (const item of items) {
          const skuKey = (item.sku || "").toLowerCase().trim();
          const nameKey = (item.name || "").toLowerCase().trim();
          const productId = skuMap[skuKey] || nameMap[nameKey] || null;

          if (productId) {
            itemInserts.push({
              order_id: newOrder.id,
              product_id: productId,
              product_name: item.name || item.sku || "Unknown",
              quantity: item.quantity || 1,
              unit_price: item.price || 0,
            });
          }
        }
        if (itemInserts.length > 0) {
          await supabase.from("order_items").insert(itemInserts);
        }

        imported++;

        // Delay only after actual API call to respect rate limit
        await new Promise(r => setTimeout(r, API_DELAY_MS));
      } catch (e) {
        errors++;
      }
    }

    // Update progress
    const isCompleted = currentInvoice > maxInvoice;
    await supabase.from("import_progress").update({
      current_invoice: currentInvoice,
      total_imported: progress.total_imported + imported,
      total_skipped: progress.total_skipped + skipped,
      total_errors: progress.total_errors + errors,
      status: isCompleted ? "completed" : "running",
      last_run_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", progress.id);

    return new Response(JSON.stringify({
      success: true,
      batch: { imported, skipped, errors, currentInvoice, isCompleted },
      total: {
        imported: progress.total_imported + imported,
        skipped: progress.total_skipped + skipped,
        errors: progress.total_errors + errors,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
