// Backfill ECD order_items from items_NNN.json chunks in storage.
// For each (order_number, items[]):
//   - Find order by order_id starting with "ECD<order_number>" (matches "ECD123" or "ECD123-suffix")
//   - Skip if order already has items.
//   - Match items[].sku (CSV "sku-keyword") against products.sku via case-insensitive substring/equality.
//   - Compute subtotal = order.total_amount - 50 (delivery).
//   - sumNominal = Σ(qty * current_price); factor = subtotal / sumNominal.
//   - Insert order_items with unit_price = round(price * factor, 2).
//   - Update orders.delivery_charge = 50 (only if NULL or different).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CsvItem { sku: string; qty: number; }
interface ChunkData { [orderNumber: string]: CsvItem[]; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const url = new URL(req.url);
    const chunkIdx = url.searchParams.get("chunk");
    if (!chunkIdx) return jsonRes({ ok: false, error: "missing ?chunk=NNN" }, 400);
    const chunkPath = `ecd_items/items_${String(chunkIdx).padStart(3, "0")}.json`;

    // 1. Download chunk
    const { data: file, error: dlErr } = await supabase.storage.from("order-backups").download(chunkPath);
    if (dlErr || !file) return jsonRes({ ok: false, error: dlErr?.message || "no file" }, 404);
    const chunkData: ChunkData = JSON.parse(await file.text());
    const orderNumbers = Object.keys(chunkData);

    // 2. Load all products (small ~250)
    const { data: products } = await supabase.from("products").select("id, sku, name, offer_price, regular_price");
    type Prod = { id: string; sku: string; name: string; offer_price: number | null; regular_price: number };
    const prods = (products || []) as Prod[];
    // Build lookups
    const skuExact = new Map<string, Prod>();
    const skuTokens: { tokens: string[]; prod: Prod }[] = [];
    for (const p of prods) {
      const k = (p.sku || "").toLowerCase().trim();
      if (k) skuExact.set(k, p);
      // Also tokenize SKU on common separators for fuzzy match
      const tokens = k.split(/[\s,\-_/]+/).filter(t => t.length > 2);
      if (tokens.length) skuTokens.push({ tokens, prod: p });
    }
    const priceOf = (p: Prod) => Number(p.offer_price ?? p.regular_price ?? 0);
    const matchProduct = (csvSku: string): Prod | null => {
      const k = csvSku.toLowerCase().trim();
      if (!k) return null;
      // 1. Exact match
      if (skuExact.has(k)) return skuExact.get(k)!;
      // 2. Substring: csv-sku contains product sku OR product sku contains csv-sku
      for (const [psku, p] of skuExact) {
        if (k.includes(psku) || psku.includes(k)) return p;
      }
      // 3. Token overlap (≥2 matching tokens, or all csv tokens matched)
      const csvTokens = k.split(/[\s,\-_/]+/).filter(t => t.length > 2);
      if (!csvTokens.length) return null;
      let bestScore = 0; let best: Prod | null = null;
      for (const { tokens, prod } of skuTokens) {
        const overlap = csvTokens.filter(t => tokens.includes(t)).length;
        if (overlap >= Math.min(2, csvTokens.length) && overlap > bestScore) {
          bestScore = overlap; best = prod;
        }
      }
      return best;
    };

    // 3. Load existing orders for these order numbers (in batches to avoid URL length)
    type Ord = { id: string; order_id: string; total_amount: number; delivery_charge: number | null };
    const allOrders: Ord[] = [];
    const BATCH = 100;
    for (let i = 0; i < orderNumbers.length; i += BATCH) {
      const slice = orderNumbers.slice(i, i + BATCH);
      // Use OR with prefix LIKE for each
      const orFilter = slice.map(n => `order_id.like.ECD${n},order_id.like.ECD${n}-%`).join(",");
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_id, total_amount, delivery_charge")
        .eq("traffic_source", "ecomdrive")
        .or(orFilter);
      if (error) return jsonRes({ ok: false, error: `orders fetch: ${error.message}` }, 500);
      if (data) allOrders.push(...(data as Ord[]));
    }

    // 4. Determine which orders already have items
    const allOrderIds = allOrders.map(o => o.id);
    const hasItems = new Set<string>();
    for (let i = 0; i < allOrderIds.length; i += 200) {
      const slice = allOrderIds.slice(i, i + 200);
      const { data: existing } = await supabase
        .from("order_items").select("order_id").in("order_id", slice);
      (existing || []).forEach((r: any) => hasItems.add(r.order_id));
    }

    // 5. Group orders by order_number prefix → all matching orders
    const ordersByNum = new Map<string, Ord[]>();
    for (const o of allOrders) {
      const m = o.order_id.match(/^ECD(\d+)(?:-|$)/);
      if (!m) continue;
      const num = m[1];
      if (!ordersByNum.has(num)) ordersByNum.set(num, []);
      ordersByNum.get(num)!.push(o);
    }

    // 6. Process each order
    let processed = 0, skippedNoOrder = 0, skippedHasItems = 0, skippedNoMatch = 0;
    let itemsInserted = 0, ordersUpdated = 0, errors = 0;
    const itemsToInsert: any[] = [];
    const ordersToUpdateDelivery: string[] = [];

    for (const [orderNum, csvItems] of Object.entries(chunkData)) {
      const matchOrders = ordersByNum.get(orderNum) || [];
      if (!matchOrders.length) { skippedNoOrder++; continue; }

      for (const ord of matchOrders) {
        if (hasItems.has(ord.id)) { skippedHasItems++; continue; }

        // Build resolved items
        const resolved: { product: any; qty: number; nominalPrice: number }[] = [];
        for (const it of csvItems) {
          const prod = matchProduct(it.sku);
          if (prod) resolved.push({ product: prod, qty: it.qty, nominalPrice: priceOf(prod) });
        }
        if (!resolved.length) { skippedNoMatch++; continue; }

        // Compute subtotal & factor
        const subtotal = Math.max(0, Number(ord.total_amount) - 50);
        const sumNominal = resolved.reduce((s, r) => s + r.nominalPrice * r.qty, 0);
        const factor = sumNominal > 0 && subtotal > 0 ? subtotal / sumNominal : 1;

        for (const r of resolved) {
          const adjPrice = Math.round(r.nominalPrice * factor * 100) / 100;
          itemsToInsert.push({
            order_id: ord.id,
            product_id: r.product.id,
            product_name: r.product.name,
            quantity: r.qty,
            unit_price: adjPrice >= 0 ? adjPrice : 0,
          });
          itemsInserted++;
        }
        if (ord.delivery_charge !== 50) ordersToUpdateDelivery.push(ord.id);
        processed++;
      }
    }

    // 7. Bulk insert items in batches of 500
    for (let i = 0; i < itemsToInsert.length; i += 500) {
      const batch = itemsToInsert.slice(i, i + 500);
      const { error } = await supabase.from("order_items").insert(batch);
      if (error) { errors += batch.length; itemsInserted -= batch.length; }
    }

    // 8. Update delivery_charge in batches of 200
    for (let i = 0; i < ordersToUpdateDelivery.length; i += 200) {
      const slice = ordersToUpdateDelivery.slice(i, i + 200);
      const { error } = await supabase.from("orders").update({ delivery_charge: 50 }).in("id", slice);
      if (!error) ordersUpdated += slice.length;
    }

    return jsonRes({
      ok: true,
      chunk: chunkIdx,
      stats: {
        chunkOrders: orderNumbers.length,
        ordersFound: allOrders.length,
        processed,
        skippedNoOrder,
        skippedHasItems,
        skippedNoMatch,
        itemsInserted,
        errors,
        ordersDeliveryUpdated: ordersUpdated,
      },
    });
  } catch (e) {
    return jsonRes({ ok: false, error: String((e as Error)?.message || e) }, 500);
  }
});

function jsonRes(obj: any, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
