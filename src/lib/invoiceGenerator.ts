/**
 * A4 Invoice Generator for Faris Seed
 * - Serial sorting by order_id
 * - Auto-fit up to 30 items per A4 page
 * - Dynamic font/padding scaling
 * - Unique QR code per invoice
 * - Sender info on left, customer on right (below QR)
 * - Company logo, watermark, Bengali headers
 * - Serial numbers, savings highlight, Bagerhat highlight
 * - Note only prints if print_note flag is true
 * - Two-column product layout when items > 10
 */

import QRCode from "qrcode";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import * as LucideIcons from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface InvoiceItem {
  product_name: string;
  product_image: string | null;
  short_description?: string | null;
  quantity: number;
  unit_price: number;
  tag?: string | null; // comma-separated tag names from products.tag
}

// Render lucide icon name to inline SVG string for print-safe rendering
const _iconSvgCache: Record<string, string> = {};
function getIconSvg(name: string, size: number, color: string): string {
  const key = `${name}|${size}|${color}`;
  if (_iconSvgCache[key]) return _iconSvgCache[key];
  const Icon = (LucideIcons as any)[name];
  if (!Icon) return (_iconSvgCache[key] = "");
  try {
    const svg = renderToStaticMarkup(
      createElement(Icon, { size, color, strokeWidth: 2.25, "aria-hidden": true })
    );
    return (_iconSvgCache[key] = svg);
  } catch {
    return (_iconSvgCache[key] = "");
  }
}

// Color name → {bg, text} hex pairs (mirrors tagColorMap in ProductCard)
const TAG_COLOR_HEX: Record<string, { bg: string; text: string }> = {
  gray: { bg: "#f3f4f6", text: "#4b5563" },
  red: { bg: "#fee2e2", text: "#dc2626" },
  orange: { bg: "#ffedd5", text: "#ea580c" },
  yellow: { bg: "#fef9c3", text: "#a16207" },
  green: { bg: "#dcfce7", text: "#16a34a" },
  teal: { bg: "#ccfbf1", text: "#0d9488" },
  blue: { bg: "#dbeafe", text: "#2563eb" },
  purple: { bg: "#f3e8ff", text: "#9333ea" },
  pink: { bg: "#fce7f3", text: "#db2777" },
  amber: { bg: "#fef3c7", text: "#d97706" },
  emerald: { bg: "#d1fae5", text: "#059669" },
  lime: { bg: "#ecfccb", text: "#4d7c0f" },
  slate: { bg: "#f1f5f9", text: "#475569" },
};

let _tagInfoCache: Map<string, { icon: string; color: string }> | null = null;
async function getTagInfoMap(): Promise<Map<string, { icon: string; color: string }>> {
  if (_tagInfoCache) return _tagInfoCache;
  try {
    const { data } = await supabase.from("tags").select("name, icon, color");
    _tagInfoCache = new Map((data || []).map((t: any) => [t.name, { icon: t.icon, color: t.color }]));
  } catch {
    _tagInfoCache = new Map();
  }
  return _tagInfoCache;
}

function renderTagsHtml(
  tagStr: string | null | undefined,
  tagInfoMap: Map<string, { icon: string; color: string }>,
  fontSize: number
): string {
  if (!tagStr) return "";
  const tags = tagStr.split(",").map((s) => s.trim()).filter(Boolean);
  if (!tags.length) return "";
  const fs = Math.max(fontSize - 3, 7);
  return `<div style="display:flex;flex-wrap:wrap;gap:2px;margin-top:2px;">${tags.map((name) => {
    const info = tagInfoMap.get(name);
    const colors = info ? TAG_COLOR_HEX[info.color] || TAG_COLOR_HEX.gray : TAG_COLOR_HEX.gray;
    const iconSize = Math.max(fs + 1, 9);
    const svg = info?.icon ? getIconSvg(info.icon, iconSize, colors.text) : "";
    return `<span style="display:inline-flex;align-items:center;gap:3px;padding:1px 6px;border-radius:9999px;font-size:${fs}px;font-weight:600;background:${colors.bg};color:${colors.text};line-height:1.2;">${svg ? `<span style="display:inline-flex;align-items:center;">${svg}</span>` : ""}${name}</span>`;
  }).join("")}</div>`;
}

interface InvoiceOrder {
  id: string;
  order_id: string;
  customer_facing_id?: string | null;
  customer_name: string;
  phone: string;
  alt_phone?: string | null;
  address: string;
  note?: string | null;
  print_note?: boolean;
  total_amount: number;
  discount?: number;
  advance?: number;
  delivery_charge?: number | null;
  created_at: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function extractOrderNumber(orderId: string): number {
  const match = orderId.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function isBagerhatAddress(address: string): boolean {
  const lower = address.toLowerCase();
  return lower.includes("বাগেরহাট") || lower.includes("bagerhat");
}

function getCompactStyles(itemCount: number) {
  if (itemCount <= 5) {
    return { fontSize: 15, imgSize: 52, padding: 10, nameLines: 1, rowGap: 12, twoCol: false };
  } else if (itemCount <= 10) {
    return { fontSize: 14, imgSize: 44, padding: 9, nameLines: 1, rowGap: 10, twoCol: false };
  } else if (itemCount <= 15) {
    return { fontSize: 14, imgSize: 44, padding: 8, nameLines: 2, rowGap: 10, twoCol: true };
  } else if (itemCount <= 20) {
    return { fontSize: 12, imgSize: 36, padding: 6, nameLines: 2, rowGap: 8, twoCol: true };
  } else {
    return { fontSize: 9, imgSize: 22, padding: 3, nameLines: 3, rowGap: 4, twoCol: true };
  }
}

async function generateQrDataUrl(orderId: string): Promise<string> {
  try {
    const text = `Scan=${orderId}`;
    return await QRCode.toDataURL(text, { width: 100, margin: 1, errorCorrectionLevel: "M" });
  } catch {
    return "";
  }
}

function generateInvoiceHtml(
  order: InvoiceOrder,
  items: InvoiceItem[],
  qrDataUrl: string,
  pageIndex: number,
  totalPages: number,
  tagInfoMap: Map<string, { icon: string; color: string }>
): string {
  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const discount = order.discount || 0;
  const advance = order.advance || 0;
  const deliveryCharge =
    order.delivery_charge != null
      ? order.delivery_charge
      : order.total_amount - subtotal + discount + advance;

  const styles = getCompactStyles(items.length);
  const isMultiPage = totalPages > 1;
  const pageLabel = isMultiPage ? ` (${pageIndex}/${totalPages})` : "";
  const bagerhat = isBagerhatAddress(order.address);
  // Bagerhat → yellow; all 63 other districts → light green (works in both screen & print)
  const recipientStyle = bagerhat
    ? "background:#fef3c7;border:2px solid #f59e0b;border-radius:8px;padding:8px;"
    : "background:#f0fdf4;border:2px solid #22c55e;border-radius:8px;padding:8px;";

  const showNote = order.print_note && order.note?.trim();

  // Build product list
  let productHtml = "";

  if (styles.twoCol) {
    const leftItems = items.slice(0, Math.ceil(items.length / 2));
    const rightItems = items.slice(Math.ceil(items.length / 2));

    const renderColItem = (item: InvoiceItem, idx: number) => `
      <div style="display:flex;align-items:center;gap:${styles.rowGap}px;padding:${styles.padding}px 2px;border-bottom:1px solid #e5e7eb;${item.quantity > 1 ? "background:#dbeafe;" : ""}">
        <div style="font-size:${styles.fontSize}px;color:#6b7280;min-width:16px;text-align:center;">${idx + 1}</div>
        ${
          item.product_image
            ? `<img src="${item.product_image}" style="width:${styles.imgSize}px;height:${styles.imgSize}px;border-radius:50%;object-fit:cover;border:1px solid #e5e7eb;flex-shrink:0;" />`
            : `<div style="width:${styles.imgSize}px;height:${styles.imgSize}px;border-radius:50%;background:#f3f4f6;border:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:${styles.imgSize * 0.45}px;flex-shrink:0;">📦</div>`
        }
        <div style="min-width:0;flex:1;">
          <div style="font-size:${styles.fontSize}px;font-weight:600;color:#111827;line-height:1.3;display:-webkit-box;-webkit-line-clamp:${styles.nameLines};-webkit-box-orient:vertical;overflow:hidden;">${item.product_name}</div>
          ${item.short_description ? `<div style="font-size:${Math.max(styles.fontSize - 2, 8)}px;color:#6b7280;line-height:1.2;margin-top:1px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${item.short_description}</div>` : ""}
          ${renderTagsHtml(item.tag, tagInfoMap, styles.fontSize)}
          <div style="font-size:${Math.max(styles.fontSize - 2, 8)}px;color:#6b7280;">\u00D7${item.quantity} \u2022 \u09F3${item.unit_price * item.quantity}</div>
        </div>
      </div>`;

    productHtml = `
      <div style="font-size:${styles.fontSize + 1}px;font-weight:600;color:#374151;margin-bottom:4px;border-bottom:1px solid #d1d5db;padding-bottom:3px;">পণ্যের তালিকা</div>
      <div style="display:flex;gap:12px;">
        <div style="flex:1;">${leftItems.map((item, i) => renderColItem(item, i)).join("")}</div>
        <div style="flex:1;">${rightItems.map((item, i) => renderColItem(item, i + leftItems.length)).join("")}</div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:16px;margin-top:4px;font-size:${styles.fontSize}px;font-weight:600;color:#374151;border-top:1px solid #d1d5db;padding-top:4px;">
        <span>মোট পরিমাণ: ${totalQty}</span>
        <span style="color:#16a34a;font-size:14px;font-weight:700;">মোট: \u09F3${subtotal}</span>
      </div>`;
  } else {
    const itemRows = items
      .map(
        (item, idx) => `
      <tr style="${item.quantity > 1 ? "background:#dbeafe;" : ""}">
        <td style="padding:${styles.padding}px 2px;text-align:center;font-size:${styles.fontSize}px;color:#6b7280;vertical-align:middle;border-bottom:1px solid #e5e7eb;">${idx + 1}</td>
        <td style="padding:${styles.padding}px 0;vertical-align:middle;border-bottom:1px solid #e5e7eb;">
          <div style="display:flex;align-items:center;gap:${styles.rowGap}px;">
            ${
              item.product_image
                ? `<img src="${item.product_image}" style="width:${styles.imgSize}px;height:${styles.imgSize}px;border-radius:50%;object-fit:cover;border:1px solid #e5e7eb;flex-shrink:0;" />`
                : `<div style="width:${styles.imgSize}px;height:${styles.imgSize}px;border-radius:50%;background:#f3f4f6;border:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:${styles.imgSize * 0.45}px;flex-shrink:0;">📦</div>`
            }
            <div style="min-width:0;">
              <div style="font-size:${styles.fontSize}px;font-weight:600;color:#111827;line-height:1.3;display:-webkit-box;-webkit-line-clamp:${styles.nameLines};-webkit-box-orient:vertical;overflow:hidden;">${item.product_name}</div>
              ${item.short_description ? `<div style="font-size:${Math.max(styles.fontSize - 2, 8)}px;color:#6b7280;line-height:1.2;margin-top:1px;">${item.short_description}</div>` : ""}
              ${renderTagsHtml(item.tag, tagInfoMap, styles.fontSize)}
            </div>
          </div>
        </td>
        <td style="padding:${styles.padding}px 4px;text-align:center;font-size:${styles.fontSize}px;color:#374151;vertical-align:middle;border-bottom:1px solid #e5e7eb;">${item.unit_price}</td>
        <td style="padding:${styles.padding}px 4px;text-align:center;font-size:${styles.fontSize}px;color:#374151;vertical-align:middle;border-bottom:1px solid #e5e7eb;font-weight:${item.quantity > 1 ? "700" : "400"};">${item.quantity}</td>
        <td style="padding:${styles.padding}px 4px;text-align:right;font-size:${styles.fontSize}px;font-weight:700;color:#111827;vertical-align:middle;border-bottom:1px solid #e5e7eb;">${item.unit_price * item.quantity}</td>
      </tr>`
      )
      .join("");

    productHtml = `
      <table style="width:100%;border-collapse:collapse;margin-bottom:0;position:relative;z-index:1;">
        <thead>
          <tr>
            <th style="text-align:center;padding:${styles.padding}px 2px;font-size:${styles.fontSize}px;font-weight:600;color:#374151;border-bottom:1px solid #d1d5db;width:28px;">#</th>
            <th style="text-align:left;padding:${styles.padding}px 0;font-size:${styles.fontSize}px;font-weight:600;color:#374151;border-bottom:1px solid #d1d5db;">পণ্য</th>
            <th style="text-align:center;padding:${styles.padding}px 4px;font-size:${styles.fontSize}px;font-weight:600;color:#374151;border-bottom:1px solid #d1d5db;">মূল্য</th>
            <th style="text-align:center;padding:${styles.padding}px 4px;font-size:${styles.fontSize}px;font-weight:600;color:#374151;border-bottom:1px solid #d1d5db;">পরিমাণ</th>
            <th style="text-align:right;padding:${styles.padding}px 4px;font-size:${styles.fontSize}px;font-weight:600;color:#374151;border-bottom:1px solid #d1d5db;">মোট</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
          <tr style="border-top:1px solid #d1d5db;">
            <td style="padding:${styles.padding}px 0;"></td>
            <td style="padding:${styles.padding}px 0;"></td>
            <td style="padding:${styles.padding}px 4px;text-align:center;font-size:${styles.fontSize}px;font-weight:600;color:#374151;">মোট-</td>
            <td style="padding:${styles.padding}px 4px;text-align:center;font-size:${styles.fontSize}px;font-weight:600;color:#374151;">${totalQty}</td>
            <td style="padding:${styles.padding}px 4px;text-align:right;font-size:14px;font-weight:700;color:#16a34a;">${subtotal}</td>
          </tr>
        </tbody>
      </table>`;
  }

  const savingsHtml = discount > 0
    ? `<div style="text-align:center;font-size:13px;color:#16a34a;font-weight:700;margin-top:4px;">\u0986\u09AA\u09A8\u09BF \u09F3${discount} \u09B8\u09C7\u09AD \u0995\u09B0\u09C7\u099B\u09C7\u09A8! 🎉</div>`
    : "";

  return `
    <div class="invoice-page">
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:80px;font-weight:900;color:rgba(0,0,0,0.03);pointer-events:none;white-space:nowrap;z-index:0;">INVOICE</div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;position:relative;z-index:1;">
        <div>
          <div style="font-size:18px;font-weight:900;color:#111827;font-family:'Agnirekha',sans-serif;letter-spacing:1px;">
            <span style="color:#111827;">FARIS</span> <span style="color:#16a34a;">SEED</span>
          </div>
          <div style="font-size:11px;color:#374151;margin-top:2px;">তারিখ: ${formatDate(order.created_at)}</div>
          <div style="font-size:10px;color:#6b7280;">INV- ${order.customer_facing_id || order.order_id}</div>
          <div style="font-size:18px;font-weight:700;color:#111827;margin-top:4px;">আপনার অর্ডার রিসিট${pageLabel}</div>
        </div>
        <div style="text-align:right;display:flex;align-items:flex-start;gap:10px;">
          <div><div style="font-size:20px;font-weight:900;letter-spacing:2px;color:#111827;">${order.customer_facing_id || order.order_id}</div></div>
          ${qrDataUrl ? `<img src="${qrDataUrl}" style="width:72px;height:72px;" />` : ""}
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px;position:relative;z-index:1;">
        <div style="flex:1;">
          <div style="font-size:12px;color:#6b7280;margin-bottom:2px;">প্রেরক</div>
          <div style="font-size:15px;font-weight:800;color:#111827;line-height:1.4;">Faris Seed</div>
          <div style="font-size:10px;color:#6b7280;line-height:1.4;font-style:italic;">বাংলাদেশের বিশ্বস্ত অনলাইন শপ</div>
          <div style="font-size:10px;color:#374151;line-height:1.4;">সাহায্য পেতে- farisshop.com/help</div>
          <div style="font-size:14px;font-weight:700;color:#111827;line-height:1.4;">📞 09617443377</div>
          <div style="font-size:12px;color:#374151;line-height:1.4;">Babupara, Debiganj Sadar, Panchagarh</div>
        </div>
        <div style="flex:1;min-width:0;text-align:left;${recipientStyle}">
          <div style="font-size:12px;color:#6b7280;margin-bottom:2px;">প্রাপক ${bagerhat ? '<span style="font-size:10px;background:#f59e0b;color:#fff;padding:1px 6px;border-radius:4px;margin-left:4px;">বাগেরহাট</span>' : ""}</div>
          <div style="font-size:14px;font-weight:700;color:#111827;line-height:1.4;">${order.customer_name}</div>
          <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;line-height:1.4;">
            <span style="font-size:13px;font-weight:700;color:#111827;">${order.phone}</span>
            ${order.alt_phone ? `<span style="font-size:12px;color:#374151;">${order.alt_phone} <span style="font-size:10px;color:#6b7280;">(alt)</span></span>` : ""}
          </div>
          <div style="font-size:12px;color:#374151;line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;" title="${order.address.replace(/"/g, "&quot;")}">${order.address.length > 45 ? order.address.slice(0, 45) + "…" : order.address}</div>
          ${showNote ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;font-style:italic;">📝 ${order.note}</div>` : ""}
          <div style="font-size:13px;font-weight:700;color:#111827;line-height:1.4;margin-top:2px;">Invoice: ${order.customer_facing_id || order.order_id}</div>
        </div>
      </div>
      ${productHtml}
      <div style="text-align:center;font-size:12px;color:#374151;margin-top:8px;line-height:1.6;position:relative;z-index:1;">
        পণ্য- ৳${subtotal}${deliveryCharge > 0 ? `, ডেলিভারি চার্জ- ৳${deliveryCharge}` : ", ডেলিভারি চার্জ- ফ্রি"}${discount > 0 ? `, ডিসকাউন্ট- ৳${discount}` : ""}${advance > 0 ? `, অ্যাডভান্স- ৳${advance}` : ""},
        সর্বমোট- ৳${order.total_amount}
      </div>
      ${savingsHtml}
      <div style="text-align:center;margin-top:8px;position:relative;z-index:1;">
        <div style="font-size:12px;color:#111827;font-weight:600;">আমাদের উপর আস্থা রেখে অর্ডার করার জন্য অসংখ্য ধন্যবাদ!</div>
        <div style="font-size:10px;color:#6b7280;margin-top:4px;font-style:italic;">⚠️ চাষ পদ্ধতি ও আমাদের নির্দেশনা অবশ্যই ভালোমতন ফলো করতে হবে।</div>
      </div>
    </div>
  `;
}

export async function printInvoices(
  orders: InvoiceOrder[],
  itemsByOrder: Record<string, InvoiceItem[]>
): Promise<boolean> {
  if (!orders.length) return false;

  const sorted = [...orders].sort(
    (a, b) => extractOrderNumber(a.order_id) - extractOrderNumber(b.order_id)
  );

  const qrMap: Record<string, string> = {};
  await Promise.all(
    sorted.map(async (order) => {
      qrMap[order.id] = await generateQrDataUrl(order.order_id);
    })
  );

  const tagInfoMap = await getTagInfoMap();

  const allPages: string[] = [];
  for (const order of sorted) {
    const items = itemsByOrder[order.id] || [];
    if (items.length > 30) {
      const mid = Math.ceil(items.length / 2);
      const chunks = [items.slice(0, mid), items.slice(mid)];
      for (let i = 0; i < chunks.length; i++) {
        allPages.push(
          generateInvoiceHtml(order, chunks[i], qrMap[order.id], i + 1, chunks.length, tagInfoMap)
        );
      }
    } else {
      allPages.push(generateInvoiceHtml(order, items, qrMap[order.id], 1, 1, tagInfoMap));
    }
  }

  const invoicesHtml = allPages.join("");

  const printWindow = window.open("", "_blank", "width=800,height=1000");
  if (!printWindow) return false;

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Faris Seed - ${sorted.map((o) => o.customer_facing_id || o.order_id).join(", ")}</title>
  <style>
    @page {
      size: A4;
      margin: 10mm 12mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #111827;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .invoice-page {
      width: 100%;
      max-width: 210mm;
      margin: 0 auto;
      padding: 16px 20px;
      page-break-after: always;
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;
    }
    .invoice-page:last-child {
      page-break-after: auto;
    }
    @media screen {
      body { background: #f3f4f6; padding: 20px 0; }
      .invoice-page {
        background: #fff;
        box-shadow: 0 4px 24px rgba(0,0,0,0.1);
        border-radius: 8px;
        margin-bottom: 30px;
      }
    }
    @media print {
      body { background: #fff; }
      .invoice-page { box-shadow: none; border-radius: 0; }
    }
    table { border-collapse: collapse; }
    img { display: block; }
  </style>
</head>
<body>
  ${invoicesHtml}
  <script>
    function waitForImages() {
      const imgs = document.querySelectorAll('img');
      if (!imgs.length) return Promise.resolve();
      return Promise.all(Array.from(imgs).map(img => {
        if (img.complete && img.naturalHeight > 0) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = () => { img.style.display='none'; resolve(); };
          setTimeout(resolve, 5000);
        });
      }));
    }
    waitForImages().then(() => { setTimeout(() => window.print(), 300); });
  </script>
</body>
</html>`);
  printWindow.document.close();
  return true;
}
