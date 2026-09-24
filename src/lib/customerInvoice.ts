/**
 * Customer-facing invoice: opens a clean A4 invoice in a new tab with a
 * "Download PDF" button (browser print → Save as PDF). Bengali-safe because it
 * renders as HTML instead of a jsPDF font sheet.
 */

export interface InvoiceLine {
  product_name: string;
  quantity: number;
  unit_price: number;
}

export interface CustomerInvoice {
  order_id?: string | null;
  invoice_no: string;
  created_at: string;
  customer_name?: string | null;
  phone?: string | null;
  address?: string | null;
  status?: string | null;
  delivery_charge?: number | null;
  discount?: number | null;
  total_amount: number;
  items: InvoiceLine[];
}

const SHOP = {
  name: "Faris Seed",
  tagline: "বিশ্বস্ত অনলাইন বীজ শপ",
  address: "House#69/A, Road#3, Mohammadia Housing, Mohammadpur, Dhaka",
  phone: "+8801897492635",
  email: "shopfaris01@gmail.com",
};

function esc(v: unknown) {
  return String(v ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string
  );
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("bn-BD", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function openInvoice(order: CustomerInvoice): boolean {
  const subtotal = order.items.reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0);
  const delivery = Number(order.delivery_charge || 0);
  const discount = Number(order.discount || 0);

  const rows = order.items
    .map(
      (i, idx) => `
      <tr>
        <td class="c">${idx + 1}</td>
        <td>${esc(i.product_name)}</td>
        <td class="c">৳${Number(i.unit_price)}</td>
        <td class="c">${Number(i.quantity)}</td>
        <td class="r">৳${Number(i.unit_price) * Number(i.quantity)}</td>
      </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="utf-8" />
<title>Invoice ${esc(order.invoice_no)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Sans Bengali', -apple-system, 'Segoe UI', Roboto, sans-serif; color:#111827; background:#f3f4f6; }
  .bar { position:sticky; top:0; display:flex; justify-content:center; gap:10px; padding:12px; background:#fff; border-bottom:1px solid #e5e7eb; }
  .bar button { cursor:pointer; border:0; border-radius:8px; padding:10px 18px; font-size:14px; font-weight:700; background:#166534; color:#fff; }
  .page { max-width:210mm; margin:20px auto; background:#fff; padding:28px 32px; border-radius:8px; box-shadow:0 4px 20px rgba(0,0,0,.08); }
  .head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #166534; padding-bottom:12px; }
  .brand { font-size:22px; font-weight:900; color:#166534; }
  .muted { color:#6b7280; font-size:12px; line-height:1.6; }
  .title { text-align:right; }
  .title h1 { font-size:18px; letter-spacing:1px; }
  .grid { display:flex; gap:20px; margin:18px 0; }
  .box { flex:1; border:1px solid #e5e7eb; border-radius:8px; padding:10px 12px; font-size:13px; line-height:1.6; }
  .box b { display:block; font-size:11px; color:#6b7280; font-weight:600; margin-bottom:2px; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th { background:#f0fdf4; color:#166534; text-align:left; padding:8px; border-bottom:1px solid #d1d5db; font-size:12px; }
  td { padding:8px; border-bottom:1px solid #f1f5f9; }
  .c { text-align:center; } .r { text-align:right; }
  .totals { margin-top:14px; margin-left:auto; width:260px; font-size:13px; }
  .totals div { display:flex; justify-content:space-between; padding:4px 0; }
  .totals .sum { border-top:2px solid #166534; margin-top:6px; padding-top:8px; font-size:15px; font-weight:800; color:#166534; }
  .foot { margin-top:24px; text-align:center; font-size:11px; color:#6b7280; line-height:1.7; border-top:1px solid #e5e7eb; padding-top:12px; }
  @media print { body { background:#fff; } .bar { display:none; } .page { box-shadow:none; margin:0; border-radius:0; padding:0; } }
</style>
</head>
<body>
  <div class="bar">
    <button onclick="window.print()">ইনভয়েস ডাউনলোড / প্রিন্ট করুন</button>
  </div>
  <div class="page">
    <div class="head">
      <div>
        <div class="brand">${SHOP.name}</div>
        <div class="muted">${SHOP.tagline}<br/>${SHOP.address}<br/>${SHOP.phone} · ${SHOP.email}</div>
      </div>
      <div class="title">
        <h1>INVOICE</h1>
        <div class="muted">নং: ${esc(order.invoice_no)}<br/>তারিখ: ${fmtDate(order.created_at)}</div>
      </div>
    </div>

    <div class="grid">
      <div class="box">
        <b>গ্রাহক</b>
        ${esc(order.customer_name || "")}<br/>
        ${esc(order.phone || "")}<br/>
        ${esc(order.address || "")}
      </div>
      <div class="box">
        <b>অর্ডার তথ্য</b>
        অর্ডার নং: ${esc(order.invoice_no)}<br/>
        পেমেন্ট: ক্যাশ অন ডেলিভারি${order.status ? `<br/>স্ট্যাটাস: ${esc(order.status)}` : ""}
      </div>
    </div>

    <table>
      <thead>
        <tr><th class="c">#</th><th>পণ্য</th><th class="c">দর</th><th class="c">পরিমাণ</th><th class="r">মোট</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals">
      <div><span>সাবটোটাল</span><span>৳${subtotal}</span></div>
      <div><span>ডেলিভারি চার্জ</span><span>${delivery > 0 ? `৳${delivery}` : "ফ্রি"}</span></div>
      ${discount > 0 ? `<div><span>ডিসকাউন্ট</span><span>-৳${discount}</span></div>` : ""}
      <div class="sum"><span>সর্বমোট</span><span>৳${Number(order.total_amount)}</span></div>
    </div>

    <div class="foot">
      আমাদের উপর আস্থা রাখার জন্য ধন্যবাদ!<br/>
      যেকোনো প্রয়োজনে কল করুন: ${SHOP.phone}
    </div>
  </div>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}
