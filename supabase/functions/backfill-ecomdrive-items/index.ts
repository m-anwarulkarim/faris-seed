import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Get backfill progress
    const { data: progress, error: pErr } = await supabase
      .from("import_progress")
      .select("*")
      .eq("source", "ecomdrive_backfill")
      .maybeSingle();

    if (pErr) throw pErr;
    if (!progress) {
      return new Response(JSON.stringify({ success: false, error: "No backfill job found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (progress.status !== "running") {
      return new Response(JSON.stringify({ success: true, message: "Backfill paused/completed", status: progress.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if we've passed max_invoice — mark completed
    if (progress.current_invoice > progress.max_invoice) {
      await supabase.from("import_progress").update({
        status: "completed",
        updated_at: new Date().toISOString(),
        last_run_at: new Date().toISOString(),
      }).eq("id", progress.id);

      return new Response(JSON.stringify({ success: true, message: "Backfill completed - reached max invoice" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const batchSize = Math.min(progress.batch_size || 4, 4);

    // Fetch ECD orders that have NO order_items, starting from current_invoice
    const { data: ordersToFill, error: oErr } = await supabase
      .from("orders")
      .select("id, order_id")
      .eq("traffic_source", "ecomdrive")
      .not("order_id", "is", null)
      .order("order_id", { ascending: true })
      .gt("order_id", `ECD${progress.current_invoice - 1}`)
      .lte("order_id", `ECD${progress.max_invoice}`)
      .limit(batchSize * 2);

    if (oErr) throw oErr;
    if (!ordersToFill || ordersToFill.length === 0) {
      await supabase.from("import_progress").update({
        status: "completed",
        updated_at: new Date().toISOString(),
        last_run_at: new Date().toISOString(),
      }).eq("id", progress.id);

      return new Response(JSON.stringify({ success: true, message: "Backfill completed - no more orders" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter out orders that already have items
    const orderIds = ordersToFill.map(o => o.id);
    const { data: existingItems } = await supabase
      .from("order_items")
      .select("order_id")
      .in("order_id", orderIds);
    
    const hasItemsSet = new Set((existingItems || []).map(i => i.order_id));
    const needsItems = ordersToFill.filter(o => !hasItemsSet.has(o.id)).slice(0, batchSize);

    if (needsItems.length === 0) {
      // All in this batch already have items, advance
      const lastOrder = ordersToFill[ordersToFill.length - 1];
      const lastInvoice = parseInt(lastOrder.order_id.replace("ECD", ""), 10) || progress.current_invoice + batchSize;
      
      await supabase.from("import_progress").update({
        current_invoice: lastInvoice + 1,
        total_skipped: progress.total_skipped + ordersToFill.length,
        last_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", progress.id);

      return new Response(JSON.stringify({ success: true, message: "Batch skipped - already have items", skipped: ordersToFill.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch products for matching
    const { data: products } = await supabase.from("products").select("id, sku, name");
    const skuMap: Record<string, string> = {};
    const nameMap: Record<string, string> = {};
    for (const p of products || []) {
      if (p.sku) skuMap[p.sku.toLowerCase().trim()] = p.id;
      if (p.name) nameMap[p.name.toLowerCase().trim()] = p.id;
    }

    let imported = 0, skipped = 0, errors = 0;
    let lastInvoice = progress.current_invoice;

    for (const order of needsItems) {
      const invoiceNum = parseInt(order.order_id.replace("ECD", ""), 10);
      if (isNaN(invoiceNum)) { skipped++; continue; }
      lastInvoice = Math.max(lastInvoice, invoiceNum);

      try {
        const resp = await fetch(
          `${baseUrl}/orders/tracking?businessId=${businessId}&invoiceNumber=${invoiceNum}`,
          { headers: { "X-API-Key": apiKey } }
        );

        if (resp.status === 429) {
          // Rate limited - save and stop
          await supabase.from("import_progress").update({
            current_invoice: lastInvoice,
            total_imported: progress.total_imported + imported,
            total_skipped: progress.total_skipped + skipped,
            total_errors: progress.total_errors + errors,
            last_run_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", progress.id);

          return new Response(JSON.stringify({
            success: true, message: "Rate limited",
            batch: { imported, skipped, errors },
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const data = await resp.json();
        if (!data.success || !data.data?.items || data.data.items.length === 0) {
          skipped++;
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }

        const items = data.data.items;
        let itemsInserted = 0;

        for (const item of items) {
          const skuKey = (item.sku || "").toLowerCase().trim();
          const nameKey = (item.name || "").toLowerCase().trim();
          const productId = skuMap[skuKey] || nameMap[nameKey] || null;

          // Insert item even without product match - use a placeholder product_id
          if (productId) {
            await supabase.from("order_items").insert({
              order_id: order.id,
              product_id: productId,
              product_name: item.name || item.sku || "Unknown",
              quantity: item.quantity || 1,
              unit_price: item.price || 0,
            });
            itemsInserted++;
          }
        }

        if (itemsInserted > 0) imported++;
        else skipped++;

        // Rate limit: ~4 req/min
        await new Promise(r => setTimeout(r, 2000));
      } catch (e) {
        errors++;
      }
    }

    // Update progress
    await supabase.from("import_progress").update({
      current_invoice: lastInvoice + 1,
      total_imported: progress.total_imported + imported,
      total_skipped: progress.total_skipped + skipped,
      total_errors: progress.total_errors + errors,
      last_run_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", progress.id);

    return new Response(JSON.stringify({
      success: true,
      batch: { imported, skipped, errors, lastInvoice },
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
