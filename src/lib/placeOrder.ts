import { supabase } from "@/integrations/supabase/client";

export interface PlaceOrderItem {
  productName: string;
  productImage?: string | null;
  quantity: number;
  unitPrice: number;
}

export interface PlaceOrderInput {
  customerName: string;
  phone: string;
  address: string;
  altPhone?: string | null;
  note?: string | null;
  deliveryCharge: number;
  discount?: number;
  items: PlaceOrderItem[];
}

/**
 * Saves an order into the backend database (orders + order_items)
 * so it appears in the admin dashboard and generates a customer invoice.
 */
export async function placeOrder(input: PlaceOrderInput) {
  const subtotal = input.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const discount = input.discount ?? 0;
  const grandTotal = subtotal + input.deliveryCharge - discount;

  const orderNumber = `FS-${Math.floor(100000 + Math.random() * 900000)}`;

  // 1. Insert into orders table
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      customer_name: input.customerName.trim(),
      phone: input.phone.trim(),
      address: input.address.trim(),
      total_amount: grandTotal,
      delivery_charge: input.deliveryCharge,
      status: "pending",
      notes: input.note?.trim() || null,
    })
    .select()
    .single();

  if (orderErr || !order) {
    console.error("Order insertion error:", orderErr);
    throw orderErr || new Error("Order creation failed");
  }

  // 2. Insert into order_items table
  const { error: itemsErr } = await supabase.from("order_items").insert(
    input.items.map((i) => ({
      order_id: order.id,
      product_name: i.productName,
      product_image: i.productImage || null,
      quantity: i.quantity,
      unit_price: i.unitPrice,
    }))
  );

  if (itemsErr) {
    console.error("Order items insertion error:", itemsErr);
    throw itemsErr;
  }

  // 3. Save local snapshot for thank-you page / invoice
  try {
    localStorage.setItem(
      "last_order_invoice",
      JSON.stringify({
        order_id: order.id,
        invoice_no: order.order_number || order.id.slice(0, 8).toUpperCase(),
        created_at: new Date().toISOString(),
        customer_name: input.customerName,
        phone: input.phone,
        address: input.address,
        delivery_charge: input.deliveryCharge,
        discount,
        total_amount: grandTotal,
        items: input.items.map((i) => ({
          product_name: i.productName,
          quantity: i.quantity,
          unit_price: i.unitPrice,
        })),
      })
    );
  } catch {
    /* storage unavailable */
  }

  return order;
}

