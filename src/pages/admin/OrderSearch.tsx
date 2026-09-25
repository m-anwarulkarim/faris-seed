import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Search, Loader2, Package, X, FileText, Phone, User, Pencil,
  Globe, Fingerprint, ChevronDown, ChevronRight, ShoppingCart,
  UserCircle, Zap, PlayCircle, Eye, Printer, MessageCircle, AlertTriangle,
} from "lucide-react";
import { PhoneVerifiedBadge } from "@/components/PhoneVerifiedBadge";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";

const HISTORY_KEY = "order-search-history";
const MAX_HISTORY = 200;
const DEFAULT_ORDER_LIMIT = 200;

interface SearchHistoryItem {
  query: string;
  type: "invoice" | "number" | "name" | "ip" | "fingerprint";
  timestamp: number;
}

interface ProgressState {
  round: number;
  orders: number;
  profiles: number;
  visitors: number;
  phones: number;
  ips: number;
  fingerprints: number;
  phase: string;
  hitLimit: boolean;
}

interface InvestigationResult {
  orders: any[];
  visitors: any[];
  profiles: any[];
  orderItems: any[];
  phones: string[];
  ips: string[];
  fingerprints: string[];
  hitLimit: boolean;
  completedRounds: number;
  incompleteOrders: any[];
  chatSessions: any[];
}

// Shared state for chain reaction continuation
interface ChainState {
  ordersMap: Map<string, any>;
  visitorsMap: Map<string, any>;
  profilesMap: Map<string, any>;
  allPhones: Set<string>;
  allVisitorIds: Set<string>;
  allProfileIds: Set<string>;
  allIps: Set<string>;
  allFingerprints: Set<string>;
  allOrderIds: Set<string>;
  processedPhones: Set<string>;
  processedVisitorIds: Set<string>;
  processedProfileIds: Set<string>;
  processedIps: Set<string>;
  processedFingerprints: Set<string>;
  completedRounds: number;
}

function getHistory(): SearchHistoryItem[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}
function addToHistory(query: string, type: SearchHistoryItem["type"]) {
  const history = getHistory().filter(h => !(h.query === query && h.type === type));
  history.unshift({ query, type, timestamp: Date.now() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}
function removeFromHistory(index: number) {
  const history = getHistory();
  history.splice(index, 1);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  confirmed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  delivered: "bg-green-500/10 text-green-600 border-green-500/20",
  cancelled: "bg-red-500/10 text-red-600 border-red-500/20",
  returned: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  shipped: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  entry_done: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  printed: "bg-purple-500/10 text-purple-600 border-purple-500/20",
};

function createChainState(): ChainState {
  return {
    ordersMap: new Map(),
    visitorsMap: new Map(),
    profilesMap: new Map(),
    allPhones: new Set(),
    allVisitorIds: new Set(),
    allProfileIds: new Set(),
    allIps: new Set(),
    allFingerprints: new Set(),
    allOrderIds: new Set(),
    processedPhones: new Set(),
    processedVisitorIds: new Set(),
    processedProfileIds: new Set(),
    processedIps: new Set(),
    processedFingerprints: new Set(),
    completedRounds: 0,
  };
}

async function deepInvestigate(
  query: string,
  orderLimit: number,
  onProgress: (p: ProgressState) => void,
  existingState?: ChainState,
): Promise<{ result: InvestigationResult; chainState: ChainState }> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) {
    const empty = createChainState();
    return { result: { orders: [], visitors: [], profiles: [], orderItems: [], phones: [], ips: [], fingerprints: [], hitLimit: false, completedRounds: 0, incompleteOrders: [], chatSessions: [] }, chainState: empty };
  }

  const state = existingState || createChainState();
  const { ordersMap, visitorsMap, profilesMap, allPhones, allVisitorIds, allProfileIds, allIps, allFingerprints, allOrderIds, processedPhones, processedVisitorIds, processedProfileIds, processedIps, processedFingerprints } = state;

  const emitProgress = (phase: string) => {
    onProgress({
      round: state.completedRounds,
      orders: allOrderIds.size,
      profiles: profilesMap.size,
      visitors: visitorsMap.size,
      phones: allPhones.size,
      ips: allIps.size,
      fingerprints: allFingerprints.size,
      phase,
      hitLimit: allOrderIds.size >= orderLimit,
    });
  };

  const seedFromOrder = (o: any) => {
    if (allOrderIds.size >= orderLimit && !allOrderIds.has(o.id)) return; // Safeguard
    ordersMap.set(o.id, o);
    allOrderIds.add(o.id);
    if (o.phone) allPhones.add(o.phone);
    if (o.alt_phone) allPhones.add(o.alt_phone);
    if (o.visitor_id) allVisitorIds.add(o.visitor_id);
    if (o.visitor_profile_id) allProfileIds.add(o.visitor_profile_id);
  };
  const seedFromVisitor = (v: any) => {
    visitorsMap.set(v.id, v);
    allVisitorIds.add(v.id);
    if (v.fingerprint) allFingerprints.add(v.fingerprint);
    if (v.ip_addresses) v.ip_addresses.forEach((ip: string) => allIps.add(ip));
  };
  const seedFromProfile = (p: any) => {
    profilesMap.set(p.id, p);
    allProfileIds.add(p.id);
    if (p.phone) allPhones.add(p.phone);
    if (p.alt_phone) allPhones.add(p.alt_phone);
    if (p.visitor_id) allVisitorIds.add(p.visitor_id);
  };

  // Phase 1: Initial search (only if fresh state)
  if (!existingState) {
    emitProgress("প্রাথমিক সার্চ...");
    const isIpLike = /^\d{1,3}\.\d{1,3}/.test(trimmed);
    const isFpLike = trimmed.startsWith("fp_");

    const { data: orderData } = await supabase
      .from("orders").select("*")
      .or(`order_id.ilike.%${trimmed}%,customer_facing_id.ilike.%${trimmed}%,phone.ilike.%${trimmed}%,alt_phone.ilike.%${trimmed}%,customer_name.ilike.%${trimmed}%`)
      .order("created_at", { ascending: false }).limit(500);
    if (orderData) orderData.forEach(seedFromOrder);
    emitProgress("অর্ডার পাওয়া গেছে");

    if (isFpLike) {
      const { data } = await supabase.from("visitors").select("*").ilike("fingerprint", `%${trimmed}%`).limit(50);
      if (data) data.forEach(seedFromVisitor);
    }
    if (isIpLike) {
      const { data } = await supabase.from("visitors").select("*").contains("ip_addresses", [trimmed]).limit(50);
      if (data) data.forEach(seedFromVisitor);
    }

    const { data: profileData } = await supabase
      .from("visitor_profiles").select("*")
      .or(`phone.ilike.%${trimmed}%,alt_phone.ilike.%${trimmed}%`).limit(50);
    if (profileData) profileData.forEach(seedFromProfile);
    emitProgress("প্রাথমিক ডাটা সংগ্রহ সম্পন্ন");
  }

  // Phase 2: Chain reaction
  const MAX_ROUNDS = 10;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (allOrderIds.size >= orderLimit) break; // Hit limit

    const snapshot = allPhones.size + allVisitorIds.size + allProfileIds.size + allIps.size + allFingerprints.size + allOrderIds.size;
    state.completedRounds++;

    // Visitor IDs → visitors
    const newVIds = [...allVisitorIds].filter(id => !processedVisitorIds.has(id));
    if (newVIds.length > 0) {
      emitProgress(`রাউন্ড ${state.completedRounds}: ভিজিটর খুঁজছে (${newVIds.length})`);
      for (let i = 0; i < newVIds.length; i += 50) {
        const batch = newVIds.slice(i, i + 50);
        const { data } = await supabase.from("visitors").select("*").in("id", batch);
        if (data) data.forEach(seedFromVisitor);
        batch.forEach(id => processedVisitorIds.add(id));
      }
    }

    // Profile IDs → profiles
    const newPIds = [...allProfileIds].filter(id => !processedProfileIds.has(id));
    if (newPIds.length > 0) {
      emitProgress(`রাউন্ড ${state.completedRounds}: প্রোফাইল খুঁজছে (${newPIds.length})`);
      for (let i = 0; i < newPIds.length; i += 50) {
        const batch = newPIds.slice(i, i + 50);
        const { data } = await supabase.from("visitor_profiles").select("*").in("id", batch);
        if (data) data.forEach(seedFromProfile);
        batch.forEach(id => processedProfileIds.add(id));
      }
    }

    // Phones → profiles + orders
    const newPhones = [...allPhones].filter(p => !processedPhones.has(p));
    for (const phone of newPhones) {
      if (allOrderIds.size >= orderLimit) break;
      processedPhones.add(phone);
      emitProgress(`রাউন্ড ${state.completedRounds}: ${phone} ফলো করছে`);

      const { data: profs } = await supabase
        .from("visitor_profiles").select("*")
        .or(`phone.eq.${phone},alt_phone.eq.${phone}`).limit(20);
      if (profs) profs.forEach(seedFromProfile);

      const { data: ords } = await supabase
        .from("orders").select("*")
        .or(`phone.eq.${phone},alt_phone.eq.${phone}`)
        .order("created_at", { ascending: false }).limit(500);
      if (ords) ords.forEach(seedFromOrder);
    }

    // Fingerprints → visitors → orders (RARITY-GATED)
    // Only chain via fingerprint if it's RARE (≤ 3 visitors share it).
    // Common fingerprints (default browsers, headless, etc.) explode the graph with noise.
    // Also requires the user to have searched by fingerprint OR for the fp to be from
    // an already-linked-by-phone visitor — which it always is here.
    const RARE_FP_THRESHOLD = 3;
    const newFps = [...allFingerprints].filter(fp => !processedFingerprints.has(fp));
    for (const fp of newFps) {
      if (allOrderIds.size >= orderLimit) break;
      processedFingerprints.add(fp);
      // Count how many visitors share this fingerprint — skip if too common (noise)
      const { count: fpCount } = await supabase
        .from("visitors")
        .select("id", { count: "exact", head: true })
        .eq("fingerprint", fp);
      if ((fpCount ?? 0) > RARE_FP_THRESHOLD) continue;

      emitProgress(`রাউন্ড ${state.completedRounds}: রেয়ার ফিঙ্গারপ্রিন্ট ${fp.slice(0, 10)}...`);
      const { data } = await supabase.from("visitors").select("*").eq("fingerprint", fp).limit(10);
      if (data) {
        data.forEach(seedFromVisitor);
        for (const v of data) {
          if (allOrderIds.size >= orderLimit) break;
          const { data: ords } = await supabase
            .from("orders").select("*").eq("visitor_id", v.id)
            .order("created_at", { ascending: false }).limit(100);
          if (ords) ords.forEach(seedFromOrder);
        }
      }
    }

    // IPs: NO outward expansion.
    // BD mobile carriers (CGNAT) and shared WiFi mean one IP = hundreds of unrelated users.
    // We just mark them processed so they appear in the evidence list, no fan-out.
    [...allIps].filter(ip => !processedIps.has(ip)).forEach(ip => processedIps.add(ip));

    emitProgress(`রাউন্ড ${state.completedRounds} সম্পন্ন`);
    const newSnapshot = allPhones.size + allVisitorIds.size + allProfileIds.size + allIps.size + allFingerprints.size + allOrderIds.size;
    if (newSnapshot === snapshot) break;
  }

  const hitLimit = allOrderIds.size >= orderLimit;

  // Phase 3: Order items
  emitProgress("পণ্যের তথ্য লোড হচ্ছে...");
  const orderUuids = Array.from(allOrderIds);
  let allItems: any[] = [];
  for (let i = 0; i < orderUuids.length; i += 200) {
    const batch = orderUuids.slice(i, i + 200);
    const { data } = await supabase.from("order_items").select("*, products(product_image)").in("order_id", batch);
    if (data) {
      allItems.push(...data.map((item: any) => ({
        ...item,
        product_image: item.product_image || item.products?.product_image || null,
      })));
    }
  }

  const uniqueOrders = Array.from(ordersMap.values())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Phase 4: Fetch incomplete orders by all discovered phones
  emitProgress("অসম্পূর্ণ অর্ডার খুঁজছে...");
  const phoneArr = Array.from(allPhones);
  let incompleteOrders: any[] = [];

  if (phoneArr.length > 0) {
    const phoneFilter = phoneArr.map(p => `phone.eq.${p}`).join(",");
    const incRes = await supabase.from("incomplete_orders").select("*").or(phoneFilter).order("created_at", { ascending: false }).limit(50);
    incompleteOrders = incRes.data || [];
  }

  return {
    result: {
      orders: uniqueOrders,
      visitors: Array.from(visitorsMap.values()),
      profiles: Array.from(profilesMap.values()),
      orderItems: allItems,
      phones: phoneArr,
      ips: Array.from(allIps),
      fingerprints: Array.from(allFingerprints),
      hitLimit,
      completedRounds: state.completedRounds,
      incompleteOrders,
      chatSessions: [],
    },
    chainState: state,
  };
}

// Generate invoice HTML (inlined to avoid circular deps)
function generateInvoicePreviewHtml(
  order: any,
  items: { product_name: string; product_image: string | null; short_description?: string | null; quantity: number; unit_price: number }[],
  qrDataUrl: string
): string {
  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const discount = order.discount || 0;
  const advance = order.advance || 0;
  const deliveryCharge = order.delivery_charge != null ? order.delivery_charge : order.total_amount - subtotal + discount + advance;
  const showNote = order.print_note && order.note?.trim();
  const bagerhat = (order.address || "").toLowerCase().includes("বাগেরহাট") || (order.address || "").toLowerCase().includes("bagerhat");
  const recipientStyle = bagerhat
    ? "background:#fef3c7;border:2px solid #f59e0b;border-radius:8px;padding:8px;"
    : "background:#f0fdf4;border:2px solid #22c55e;border-radius:8px;padding:8px;";
  const dd = String(new Date(order.created_at).getDate()).padStart(2, "0");
  const mm = String(new Date(order.created_at).getMonth() + 1).padStart(2, "0");
  const yyyy = new Date(order.created_at).getFullYear();
  const dateStr = `${dd}-${mm}-${yyyy}`;
  const fontSize = items.length <= 10 ? 13 : items.length <= 20 ? 11 : 9;
  const imgSize = items.length <= 10 ? 36 : items.length <= 20 ? 28 : 22;
  const padding = items.length <= 10 ? 8 : items.length <= 20 ? 5 : 3;
  const rowGap = items.length <= 10 ? 10 : items.length <= 20 ? 6 : 4;

  const itemRows = items.map((item, idx) => `
    <tr style="${item.quantity > 1 ? "background:#dbeafe;" : ""}">
      <td style="padding:${padding}px 2px;text-align:center;font-size:${fontSize}px;color:#6b7280;border-bottom:1px solid #e5e7eb;">${idx + 1}</td>
      <td style="padding:${padding}px 0;border-bottom:1px solid #e5e7eb;">
        <div style="display:flex;align-items:center;gap:${rowGap}px;">
          ${item.product_image ? `<img src="${item.product_image}" style="width:${imgSize}px;height:${imgSize}px;border-radius:50%;object-fit:cover;border:1px solid #e5e7eb;" />` : `<div style="width:${imgSize}px;height:${imgSize}px;border-radius:50%;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:${imgSize * 0.45}px;">📦</div>`}
          <div><div style="font-size:${fontSize}px;font-weight:600;color:#111827;">${item.product_name}</div>${item.short_description ? `<div style="font-size:${Math.max(fontSize - 2, 8)}px;color:#6b7280;">${item.short_description}</div>` : ""}</div>
        </div>
      </td>
      <td style="padding:${padding}px 4px;text-align:center;font-size:${fontSize}px;border-bottom:1px solid #e5e7eb;">${item.unit_price}</td>
      <td style="padding:${padding}px 4px;text-align:center;font-size:${fontSize}px;border-bottom:1px solid #e5e7eb;font-weight:${item.quantity > 1 ? "700" : "400"};">${item.quantity}</td>
      <td style="padding:${padding}px 4px;text-align:right;font-size:${fontSize}px;font-weight:700;border-bottom:1px solid #e5e7eb;">${item.unit_price * item.quantity}</td>
    </tr>`).join("");

  return `<!DOCTYPE html><html><head><style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;background:#fff;padding:16px 20px;}</style></head><body>
    <div style="position:relative;">
      <div style="position:absolute;top:40%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:80px;font-weight:900;color:rgba(0,0,0,0.03);pointer-events:none;white-space:nowrap;">INVOICE</div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
        <div>
          <div style="font-size:18px;font-weight:900;"><span>FARIS</span> <span style="color:#16a34a;">SEED</span></div>
          <div style="font-size:11px;color:#374151;margin-top:2px;">তারিখ: ${dateStr}</div>
          <div style="font-size:10px;color:#6b7280;">INV- ${order.customer_facing_id || order.order_id}</div>
          <div style="font-size:18px;font-weight:700;margin-top:4px;">আপনার অর্ডার রিসিট</div>
        </div>
        <div style="text-align:right;display:flex;align-items:flex-start;gap:10px;">
          <div style="font-size:20px;font-weight:900;letter-spacing:2px;">${order.customer_facing_id || order.order_id}</div>
          ${qrDataUrl ? `<img src="${qrDataUrl}" style="width:72px;height:72px;" />` : ""}
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:16px;">
        <div style="flex:1;">
          <div style="font-size:12px;color:#6b7280;margin-bottom:2px;">প্রেরক</div>
          <div style="font-size:15px;font-weight:800;">Faris Seed</div>
          <div style="font-size:10px;color:#6b7280;font-style:italic;">বাংলাদেশের বিশ্বস্ত অনলাইন শপ</div>
          <div style="font-size:14px;font-weight:700;">📞 09617443377</div>
        </div>
        <div style="flex:1;${recipientStyle}">
          <div style="font-size:12px;color:#6b7280;margin-bottom:2px;">প্রাপক</div>
          <div style="font-size:14px;font-weight:700;">${order.customer_name}</div>
          <div style="font-size:13px;font-weight:700;">${order.phone}</div>
          ${order.alt_phone ? `<div style="font-size:12px;color:#374151;">${order.alt_phone} (alt)</div>` : ""}
          <div style="font-size:12px;color:#374151;">${order.address}</div>
          ${showNote ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;font-style:italic;">📝 ${order.note}</div>` : ""}
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:0;">
        <thead><tr>
          <th style="text-align:center;padding:${padding}px 2px;font-size:${fontSize}px;font-weight:600;color:#374151;border-bottom:1px solid #d1d5db;width:28px;">#</th>
          <th style="text-align:left;padding:${padding}px 0;font-size:${fontSize}px;font-weight:600;color:#374151;border-bottom:1px solid #d1d5db;">পণ্য</th>
          <th style="text-align:center;padding:${padding}px 4px;font-size:${fontSize}px;font-weight:600;color:#374151;border-bottom:1px solid #d1d5db;">মূল্য</th>
          <th style="text-align:center;padding:${padding}px 4px;font-size:${fontSize}px;font-weight:600;color:#374151;border-bottom:1px solid #d1d5db;">পরিমাণ</th>
          <th style="text-align:right;padding:${padding}px 4px;font-size:${fontSize}px;font-weight:600;color:#374151;border-bottom:1px solid #d1d5db;">মোট</th>
        </tr></thead>
        <tbody>
          ${itemRows}
          <tr style="border-top:1px solid #d1d5db;">
            <td></td><td></td>
            <td style="padding:${padding}px 4px;text-align:center;font-size:${fontSize}px;font-weight:600;">মোট-</td>
            <td style="padding:${padding}px 4px;text-align:center;font-size:${fontSize}px;font-weight:600;">${totalQty}</td>
            <td style="padding:${padding}px 4px;text-align:right;font-size:14px;font-weight:700;color:#16a34a;">${subtotal}</td>
          </tr>
        </tbody>
      </table>
      <div style="text-align:center;font-size:12px;color:#374151;margin-top:8px;line-height:1.6;">
        পণ্য- ৳${subtotal}${deliveryCharge > 0 ? `, ডেলিভারি চার্জ- ৳${deliveryCharge}` : ", ডেলিভারি চার্জ- ফ্রি"}${discount > 0 ? `, ডিসকাউন্ট- ৳${discount}` : ""}${advance > 0 ? `, অ্যাডভান্স- ৳${advance}` : ""}, সর্বমোট- ৳${order.total_amount}
      </div>
      ${discount > 0 ? `<div style="text-align:center;font-size:13px;color:#16a34a;font-weight:700;margin-top:4px;">আপনি ৳${discount} সেভ করেছেন! 🎉</div>` : ""}
      <div style="text-align:center;margin-top:8px;">
        <div style="font-size:12px;font-weight:600;">আমাদের উপর আস্থা রেখে অর্ডার করার জন্য অসংখ্য ধন্যবাদ!</div>
      </div>
    </div>
  </body></html>`;
}

export default function OrderSearch() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [history, setHistory] = useState<SearchHistoryItem[]>(getHistory);
  const [showHistory, setShowHistory] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    orders: true, visitors: false, profiles: true,
  });
  const [result, setResult] = useState<InvestigationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const chainStateRef = useRef<ChainState | null>(null);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [quickResult, setQuickResult] = useState<any[] | null>(null);
  const [quickLoading, setQuickLoading] = useState(false);
  const quickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchMode, setSearchMode] = useState<"quick" | "chain">("quick");
  const [previewOrder, setPreviewOrder] = useState<any | null>(null);
  const [incompleteResults, setIncompleteResults] = useState<any[] | null>(null);
  const [chatResults, setChatResults] = useState<any[] | null>(null);

  // Fetch items for invoice preview
  const { data: previewItems, isLoading: previewLoading } = useQuery({
    queryKey: ["invoice-preview-items", previewOrder?.id],
    enabled: !!previewOrder?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("order_items")
        .select("*, products(product_image, short_description)")
        .eq("order_id", previewOrder!.id);
      return (data || []).map((i: any) => ({
        product_name: i.product_name,
        product_image: i.product_image || i.products?.product_image || null,
        short_description: i.products?.short_description || null,
        quantity: i.quantity,
        unit_price: i.unit_price,
      }));
    },
  });

  // Generate QR + invoice HTML
  const [invoiceHtml, setInvoiceHtml] = useState("");
  const generatePreview = useCallback(async () => {
    if (!previewOrder || !previewItems) return;
    try {
      const text = `Scan=${previewOrder.order_id}`;
      const qr = await QRCode.toDataURL(text, { width: 100, margin: 1, errorCorrectionLevel: "M" });
      setInvoiceHtml(generateInvoicePreviewHtml(previewOrder, previewItems, qr));
    } catch {
      setInvoiceHtml(generateInvoicePreviewHtml(previewOrder, previewItems, ""));
    }
  }, [previewOrder, previewItems]);

  // Trigger preview generation when items load  
  // Using a ref to avoid re-renders
  const prevPreviewRef = useRef<string | null>(null);
  if (previewOrder && previewItems && !previewLoading && prevPreviewRef.current !== previewOrder.id) {
    prevPreviewRef.current = previewOrder.id;
    generatePreview();
  }

  // Quick search: simple orders query
  const runQuickSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) { setQuickResult(null); setIncompleteResults(null); setChatResults(null); return; }
    setQuickLoading(true);
    setSearchMode("quick");
    setResult(null);
    chainStateRef.current = null;
    try {
      const [ordersRes, incompleteRes] = await Promise.all([
        supabase
          .from("orders")
          .select("*, order_items(id, product_name, product_image, unit_price, quantity, products(product_image))")
          .or(`order_id.ilike.%${trimmed}%,customer_facing_id.ilike.%${trimmed}%,phone.ilike.%${trimmed}%,alt_phone.ilike.%${trimmed}%,customer_name.ilike.%${trimmed}%`)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("incomplete_orders")
          .select("*")
          .or(`phone.ilike.%${trimmed}%,customer_name.ilike.%${trimmed}%`)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      setQuickResult(ordersRes.data || []);
      setIncompleteResults(incompleteRes.data || []);
      setChatResults([]);
      setActiveSearch(trimmed);
      setShowHistory(false);
    } finally {
      setQuickLoading(false);
    }
  }, []);

  // Chain reaction search
  const runChainSearch = useCallback(async (query: string, continueFrom?: ChainState) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    setSearchMode("chain");
    setQuickResult(null);

    if (continueFrom) {
      setIsContinuing(true);
    } else {
      setIsLoading(true);
      setResult(null);
      chainStateRef.current = null;
    }

    try {
      const limit = continueFrom
        ? (result?.orders.length || 0) + DEFAULT_ORDER_LIMIT
        : DEFAULT_ORDER_LIMIT;

      const { result: newResult, chainState } = await deepInvestigate(
        trimmed, limit, setProgress, continueFrom,
      );
      setResult(newResult);
      chainStateRef.current = chainState;
    } finally {
      setIsLoading(false);
      setIsContinuing(false);
      setProgress(null);
    }
  }, [result]);

  const handleSearch = () => {
    const trimmed = search.trim();
    if (trimmed.length < 2) return;
    setActiveSearch(trimmed);
    setShowHistory(false);
    runChainSearch(trimmed);

    const type: SearchHistoryItem["type"] = trimmed.startsWith("fp_")
      ? "fingerprint"
      : /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(trimmed) ? "ip"
      : /^\d{11}$/.test(trimmed) ? "number"
      : /^\d+$/.test(trimmed) ? "invoice" : "name";
    addToHistory(trimmed, type);
    setHistory(getHistory());
  };

  const handleContinue = () => {
    if (chainStateRef.current && activeSearch) {
      runChainSearch(activeSearch, chainStateRef.current);
    }
  };

  const quickSearch = (value: string) => {
    setSearch(value);
    setActiveSearch(value);
    setShowHistory(false);
    setQuickResult(null);
    runChainSearch(value);
    addToHistory(value, value.startsWith("fp_") ? "fingerprint" : /^\d{11}$/.test(value) ? "number" : "name");
    setHistory(getHistory());
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Debounced quick search on typing
  const handleInputChange = (value: string) => {
    setSearch(value);
    setShowHistory(true);
    if (quickTimerRef.current) clearTimeout(quickTimerRef.current);
    if (value.trim().length >= 2) {
      quickTimerRef.current = setTimeout(() => runQuickSearch(value), 400);
    } else {
      setQuickResult(null);
      setActiveSearch("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (quickTimerRef.current) clearTimeout(quickTimerRef.current);
      runQuickSearch(search);
    }
  };

  const historyIcon = (type: string) => {
    if (type === "number") return <Phone className="w-3.5 h-3.5" />;
    if (type === "name") return <User className="w-3.5 h-3.5" />;
    if (type === "ip") return <Globe className="w-3.5 h-3.5" />;
    if (type === "fingerprint") return <Fingerprint className="w-3.5 h-3.5" />;
    return <FileText className="w-3.5 h-3.5" />;
  };

  const historyColor = (type: string) => {
    if (type === "number") return "bg-blue-500/10 text-blue-500";
    if (type === "name") return "bg-green-500/10 text-green-500";
    if (type === "ip") return "bg-purple-500/10 text-purple-500";
    if (type === "fingerprint") return "bg-rose-500/10 text-rose-500";
    return "bg-amber-500/10 text-amber-500";
  };

  const itemsByOrder = (orderId: string) =>
    result?.orderItems?.filter(i => i.order_id === orderId) || [];

  const showLoading = isLoading || isContinuing;

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <Card>
        <CardHeader className="pb-3 space-y-2 sticky top-0 z-10 bg-card border-b border-border rounded-t-lg">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                placeholder={t("ইনভয়েস, নম্বর, নাম, IP...", "Invoice, number, name, IP...")}
                className="pl-9"
                value={search}
                onChange={(e) => handleInputChange(e.target.value)}
                onFocus={() => !activeSearch && setShowHistory(true)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <Button onClick={handleSearch} disabled={search.trim().length < 2 || showLoading}>
              {showLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Zap className="w-4 h-4 mr-1.5" />}
              {t("চেইন রিএকশন", "Chain Reaction")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t(
              "টাইপ করলেই সার্চ হবে — বাটনে ক্লিক করলে চেইন রিএকশনে সম্পৃক্ত সকল ডাটা আসবে",
              "Search starts as you type — click button for chain reaction to find all linked data"
            )}
          </p>
        </CardHeader>

        <CardContent className="p-0">
          {/* Search history */}
          {showHistory && !activeSearch && history.length > 0 && (
            <div className="border-t border-border">
              <div className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("সাম্প্রতিক সার্চ", "Recent Searches")}
                </span>
                <button
                  onClick={() => { localStorage.removeItem(HISTORY_KEY); setHistory([]); }}
                  className="text-xs text-destructive hover:underline"
                >
                  {t("সব মুছুন", "Clear all")}
                </button>
              </div>
              <div className="max-h-[320px] overflow-y-auto">
                {history.map((item, i) => (
                  <div
                    key={`${item.query}-${item.timestamp}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 cursor-pointer group transition-colors"
                    onClick={() => { setSearch(item.query); setActiveSearch(item.query); setShowHistory(false); runQuickSearch(item.query); }}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${historyColor(item.type)}`}>
                      {historyIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.query}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFromHistory(i); setHistory(getHistory()); }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!activeSearch && history.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="w-12 h-12 mb-3 opacity-40" />
              <p>{t("সার্চ করতে টাইপ করুন", "Type to search")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Search Results */}
      {searchMode === "quick" && quickResult && !isLoading && (
        <>
          {quickResult.length === 0 && (!incompleteResults || incompleteResults.length === 0) && (!chatResults || chatResults.length === 0) ? (
            <Card>
              <CardContent className="py-8 flex flex-col items-center text-muted-foreground gap-3">
                <Package className="w-10 h-10 opacity-40" />
                <p className="text-sm">{t("কোনো ডাটা পাওয়া যায়নি", "No data found")}</p>
                <Button onClick={handleSearch} variant="outline" className="gap-2 mt-1">
                  <Zap className="w-4 h-4" />
                  {t("চেইন রিএকশনে খুঁজুন", "Search with Chain Reaction")}
                </Button>
              </CardContent>
            </Card>
          ) : quickResult.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-blue-500" />
                    <h3 className="font-semibold">{t("অর্ডার", "Orders")} ({quickResult.length})</h3>
                    {quickLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                  </div>
                  <Button onClick={handleSearch} variant="ghost" size="sm" className="gap-1.5 text-xs">
                    <Zap className="w-3.5 h-3.5" />
                    {t("চেইন রিএকশন", "Chain Reaction")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("ইনভয়েস", "Invoice")}</TableHead>
                      <TableHead>{t("কাস্টমার", "Customer")}</TableHead>
                      <TableHead>{t("ফোন", "Phone")}</TableHead>
                      <TableHead>{t("পণ্য", "Products")}</TableHead>
                      <TableHead className="text-right">{t("মোট", "Total")}</TableHead>
                      <TableHead>{t("স্ট্যাটাস", "Status")}</TableHead>
                      <TableHead>{t("তারিখ", "Date")}</TableHead>
                      <TableHead className="text-right">{t("অ্যাকশন", "Action")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quickResult.map((order: any) => {
                      const items: any[] = order.order_items || [];
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-bold text-primary whitespace-nowrap">{order.customer_facing_id || order.order_id}</TableCell>
                          <TableCell className="font-medium max-w-[120px] truncate">{order.customer_name}</TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              <p className="text-sm cursor-pointer text-primary hover:underline" onClick={() => quickSearch(order.phone)}>
                                {order.phone}
                              </p>
                              {order.alt_phone && (
                                <p className="text-xs text-muted-foreground cursor-pointer hover:text-primary hover:underline" onClick={() => quickSearch(order.alt_phone)}>
                                  {order.alt_phone}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {items.length > 0 ? (
                              <div className="flex items-center gap-1">
                                {items.slice(0, 2).map((item: any) => {
                                  const img = item.product_image || item.products?.product_image;
                                  return img ? (
                                    <img key={item.id} src={img} alt="" className="w-7 h-7 rounded object-cover border border-border" />
                                  ) : (
                                    <div key={item.id} className="w-7 h-7 rounded bg-muted flex items-center justify-center">
                                      <Package className="w-3 h-3" />
                                    </div>
                                  );
                                })}
                                {items.length > 2 && <span className="text-xs text-muted-foreground">+{items.length - 2}</span>}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold whitespace-nowrap">৳{order.total_amount}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs capitalize ${STATUS_COLORS[order.status] || ""}`}>
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                            {format(new Date(order.created_at), "dd/MM/yy HH:mm")}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" title={t("ইনভয়েস দেখুন", "View Invoice")} onClick={() => { setInvoiceHtml(""); prevPreviewRef.current = null; setPreviewOrder(order); }}>
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/e/orders/edit/${order.order_id}`)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      {/* Incomplete Orders */}
      {searchMode === "quick" && incompleteResults && incompleteResults.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="font-semibold">{t("অসম্পূর্ণ অর্ডার", "Incomplete Orders")} ({incompleteResults.length})</h3>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("ফোন", "Phone")}</TableHead>
                  <TableHead>{t("নাম", "Name")}</TableHead>
                  <TableHead>{t("কারণ", "Reason")}</TableHead>
                  <TableHead>{t("ঠিকানা", "Address")}</TableHead>
                  <TableHead>{t("চেষ্টা", "Attempts")}</TableHead>
                  <TableHead>{t("তারিখ", "Date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incompleteResults.map((inc: any) => (
                  <TableRow key={inc.id}>
                    <TableCell>
                      <span className="text-sm cursor-pointer text-primary hover:underline" onClick={() => quickSearch(inc.phone)}>
                        {inc.phone}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{inc.customer_name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">
                        {inc.reason}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{inc.address || "—"}</TableCell>
                    <TableCell className="text-center">{inc.attempt_count}</TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {format(new Date(inc.created_at), "dd/MM/yy HH:mm")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* AI Chat Conversations */}
      {searchMode === "quick" && chatResults && chatResults.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-violet-500" />
              <h3 className="font-semibold">{t("চ্যাট কনভার্সেশন", "Chat Conversations")} ({chatResults.length})</h3>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("কাস্টমার", "Customer")}</TableHead>
                  <TableHead>{t("ফোন", "Phone")}</TableHead>
                  <TableHead>{t("মেসেজ", "Messages")}</TableHead>
                  <TableHead>{t("শেষ মেসেজ", "Last Message")}</TableHead>
                  <TableHead>{t("স্ট্যাটাস", "Status")}</TableHead>
                  <TableHead className="text-right">{t("অ্যাকশন", "Action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chatResults.map((chat: any) => {
                  const msgs = Array.isArray(chat.messages) ? chat.messages : [];
                  const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
                  const lastMsgText = lastMsg?.content ? (typeof lastMsg.content === "string" ? lastMsg.content : "") : "";
                  return (
                    <TableRow key={chat.id}>
                      <TableCell className="font-medium">{chat.customer_name || "—"}</TableCell>
                      <TableCell>
                        {chat.customer_phone ? (
                          <span className="text-sm cursor-pointer text-primary hover:underline" onClick={() => quickSearch(chat.customer_phone)}>
                            {chat.customer_phone}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{chat.message_count}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="text-xs text-muted-foreground truncate">{lastMsgText.slice(0, 80) || "—"}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {chat.last_message_at ? format(new Date(chat.last_message_at), "dd/MM/yy HH:mm") : "—"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {!chat.is_read && <Badge className="text-[10px] bg-red-500/10 text-red-600 border-red-500/20" variant="outline">Unread</Badge>}
                          {chat.ai_paused && <Badge className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20" variant="outline">AI Off</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/admin/messages`)}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {quickLoading && !quickResult && (
        <Card>
          <CardContent className="py-8 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      )}

      {/* Live Progress */}
      {showLoading && progress && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary animate-pulse" />
              <h3 className="font-semibold text-sm">{t("চেইন রিএকশন চলছে...", "Chain Reaction Running...")}</h3>
              <Badge variant="outline" className="ml-auto text-xs">
                {t("রাউন্ড", "Round")} {progress.round}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{progress.phase}</p>
            <Progress value={Math.min((progress.orders / DEFAULT_ORDER_LIMIT) * 100, 100)} className="h-2" />
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center">
              <MiniStat label={t("অর্ডার", "Orders")} value={progress.orders} />
              <MiniStat label={t("প্রোফাইল", "Profiles")} value={progress.profiles} />
              <MiniStat label={t("ভিজিটর", "Visitors")} value={progress.visitors} />
              <MiniStat label={t("ফোন", "Phones")} value={progress.phones} />
              <MiniStat label={t("আইপি", "IPs")} value={progress.ips} />
            </div>
            {progress.hitLimit && (
              <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                ⚠️ {t(`লিমিট (${DEFAULT_ORDER_LIMIT} অর্ডার) পূর্ণ — সার্চ থামানো হচ্ছে`, `Limit (${DEFAULT_ORDER_LIMIT} orders) reached — stopping`)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {searchMode === "chain" && result && !isLoading && (
        <>
          {/* Limit Warning + Continue Button */}
          {result.hitLimit && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                    ⚠️ {t("অর্ডার লিমিটে পৌঁছেছে", "Order limit reached")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t(
                      `${result.orders.length}টি অর্ডার পাওয়া গেছে (${result.completedRounds}টি রাউন্ড)। আরো ডাটা থাকতে পারে — চালিয়ে যেতে ক্লিক করুন।`,
                      `${result.orders.length} orders found (${result.completedRounds} rounds). More data may exist — click to continue.`
                    )}
                  </p>
                </div>
                <Button
                  onClick={handleContinue}
                  disabled={isContinuing}
                  className="shrink-0"
                  variant="outline"
                >
                  {isContinuing ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <PlayCircle className="w-4 h-4 mr-1.5" />
                  )}
                  {t(`আরো ${DEFAULT_ORDER_LIMIT}টি খুঁজুন`, `Find ${DEFAULT_ORDER_LIMIT} more`)}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <SummaryCard icon={<ShoppingCart className="w-5 h-5" />} label={t("অর্ডার", "Orders")} count={result.orders.length} color="text-blue-500" />
            <SummaryCard icon={<UserCircle className="w-5 h-5" />} label={t("প্রোফাইল", "Profiles")} count={result.profiles.length} color="text-green-500" />
            <SummaryCard icon={<Fingerprint className="w-5 h-5" />} label={t("ভিজিটর", "Visitors")} count={result.visitors.length} color="text-purple-500" />
            <SummaryCard icon={<Phone className="w-5 h-5" />} label={t("ফোন", "Phones")} count={result.phones.length} color="text-amber-500" />
            <SummaryCard icon={<Globe className="w-5 h-5" />} label={t("আইপি", "IPs")} count={result.ips.length} color="text-rose-500" />
          </div>

          {/* Completed info */}
          {!result.hitLimit && result.orders.length > 0 && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                ✅ {t(
                  `চেইন রিএকশন সম্পন্ন — ${result.completedRounds}টি রাউন্ডে সকল সম্পৃক্ত ডাটা পাওয়া গেছে`,
                  `Chain reaction complete — all linked data found in ${result.completedRounds} rounds`
                )}
              </p>
            </div>
          )}

          {/* Linked Phones & IPs */}
          {(result.phones.length > 0 || result.ips.length > 0) && (
            <Card>
              <CardContent className="p-4 space-y-3">
                {result.phones.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" /> {t("সম্পৃক্ত ফোন নম্বর", "Linked Phone Numbers")}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.phones.map(phone => (
                        <Badge key={phone} variant="outline" className="cursor-pointer hover:bg-primary/10 transition-colors" onClick={() => quickSearch(phone)}>
                          <Phone className="w-3 h-3 mr-1" />{phone}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {result.ips.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" /> {t("আইপি অ্যাড্রেস", "IP Addresses")}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.ips.map(ip => (
                        <Badge key={ip} variant="outline" className="cursor-pointer hover:bg-primary/10 transition-colors font-mono text-xs" onClick={() => quickSearch(ip)}>
                          <Globe className="w-3 h-3 mr-1" />{ip}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Visitor Profiles */}
          {result.profiles.length > 0 && (
            <Card>
              <Collapsible open={expandedSections.profiles} onOpenChange={() => toggleSection("profiles")}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserCircle className="w-5 h-5 text-green-500" />
                        <h3 className="font-semibold">{t("কাস্টমার প্রোফাইল", "Customer Profiles")} ({result.profiles.length})</h3>
                      </div>
                      {expandedSections.profiles ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {result.profiles.map((profile: any) => (
                        <div key={profile.id} className="p-4 hover:bg-muted/20 transition-colors">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">{t("নাম", "Name")}</p>
                              <p className="font-semibold">{profile.name || "—"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">{t("ফোন", "Phone")}</p>
                              <p className="font-semibold cursor-pointer text-primary hover:underline flex items-center gap-1" onClick={() => quickSearch(profile.phone)}>
                                {profile.phone} <PhoneVerifiedBadge verified={profile.phone_verified === true} />
                              </p>
                            </div>
                            {profile.alt_phone && (
                              <div>
                                <p className="text-xs text-muted-foreground">{t("বিকল্প নম্বর", "Alt Phone")}</p>
                                <p className="font-semibold cursor-pointer text-primary hover:underline" onClick={() => quickSearch(profile.alt_phone)}>
                                  {profile.alt_phone}
                                </p>
                              </div>
                            )}
                            <div>
                              <p className="text-xs text-muted-foreground">{t("ঠিকানা", "Address")}</p>
                              <p className="font-medium text-xs">{profile.address || "—"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">{t("ক্রেডিট", "Credit")}</p>
                              <p className="font-bold text-primary">৳{(profile as any).credit_balance || 0}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">{t("ইউজার টাইপ", "User Type")}</p>
                              <p className="font-medium">{profile.user_type || "regular"}</p>
                            </div>
                            {profile.visitor_id && (
                              <div className="col-span-2 sm:col-span-3">
                                <p className="text-xs text-muted-foreground">{t("ভিজিটর আইডি", "Visitor ID")}</p>
                                <p className="font-mono text-xs text-muted-foreground">{profile.visitor_id}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          )}

          {/* Visitors (Devices) */}
          {result.visitors.length > 0 && (
            <Card>
              <Collapsible open={expandedSections.visitors} onOpenChange={() => toggleSection("visitors")}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Fingerprint className="w-5 h-5 text-purple-500" />
                        <h3 className="font-semibold">{t("ডিভাইস / ভিজিটর", "Devices / Visitors")} ({result.visitors.length})</h3>
                      </div>
                      {expandedSections.visitors ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {result.visitors.map((visitor: any) => (
                        <div key={visitor.id} className="p-4 hover:bg-muted/20 transition-colors">
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">{t("মোট ভিজিট", "Total Visits")}</p>
                              <p className="font-bold">{visitor.total_visit_count || 0}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">{t("অ্যাক্সেস", "Access")}</p>
                              <Badge variant={visitor.access_allowed ? "default" : "destructive"} className="text-xs">
                                {visitor.access_allowed ? t("অনুমোদিত", "Allowed") : t("ব্লকড", "Blocked")}
                              </Badge>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">{t("সোর্স", "Source")}</p>
                              <p className="font-medium">{visitor.traffic_source || "direct"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">{t("প্রথম ভিজিট", "First Visit")}</p>
                              <p className="text-xs">{format(new Date(visitor.first_visit_at || visitor.created_at), "dd/MM/yy HH:mm")}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">{t("লোড টাইম", "Load Time")}</p>
                              <p className="font-medium">{visitor.avg_page_load_ms ? `${visitor.avg_page_load_ms}ms` : "—"}</p>
                            </div>
                            {visitor.ip_addresses?.length > 0 && (
                              <div className="col-span-2 sm:col-span-3">
                                <p className="text-xs text-muted-foreground mb-1">{t("আইপি অ্যাড্রেস", "IP Addresses")}</p>
                                <div className="flex flex-wrap gap-1">
                                  {visitor.ip_addresses.map((ip: string) => (
                                    <Badge key={ip} variant="outline" className="cursor-pointer hover:bg-primary/10 font-mono text-xs" onClick={() => quickSearch(ip)}>
                                      {ip}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            {visitor.user_agent && (
                              <div className="col-span-2 sm:col-span-3">
                                <p className="text-xs text-muted-foreground">{t("ব্রাউজার", "Browser")}</p>
                                <p className="font-mono text-[10px] text-muted-foreground line-clamp-1">{visitor.user_agent}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          )}

          {/* Orders */}
          {result.orders.length > 0 ? (
            <Card>
              <Collapsible open={expandedSections.orders} onOpenChange={() => toggleSection("orders")}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5 text-blue-500" />
                        <h3 className="font-semibold">{t("সকল অর্ডার", "All Orders")} ({result.orders.length})</h3>
                        {result.hitLimit && (
                          <Badge variant="secondary" className="text-[10px]">
                            {t("লিমিটেড", "Limited")}
                          </Badge>
                        )}
                      </div>
                      {expandedSections.orders ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="p-0 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("ইনভয়েস", "Invoice")}</TableHead>
                          <TableHead>{t("কাস্টমার", "Customer")}</TableHead>
                          <TableHead>{t("ফোন", "Phone")}</TableHead>
                          <TableHead>{t("পণ্য", "Products")}</TableHead>
                          <TableHead className="text-right">{t("মোট", "Total")}</TableHead>
                          <TableHead>{t("স্ট্যাটাস", "Status")}</TableHead>
                          <TableHead>{t("তারিখ", "Date")}</TableHead>
                          <TableHead className="text-right">{t("অ্যাকশন", "Action")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.orders.map((order: any) => {
                          const items = itemsByOrder(order.id);
                          return (
                            <TableRow key={order.id}>
                              <TableCell className="font-bold text-primary whitespace-nowrap">{order.customer_facing_id || order.order_id}</TableCell>
                              <TableCell className="font-medium max-w-[120px] truncate">{order.customer_name}</TableCell>
                              <TableCell>
                                <div className="space-y-0.5">
                                  <p className="text-sm cursor-pointer text-primary hover:underline" onClick={() => quickSearch(order.phone)}>
                                    {order.phone}
                                  </p>
                                  {order.alt_phone && (
                                    <p className="text-xs text-muted-foreground cursor-pointer hover:text-primary hover:underline" onClick={() => quickSearch(order.alt_phone)}>
                                      {order.alt_phone}
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {items.length > 0 ? (
                                  <div className="flex items-center gap-1">
                                    {items.slice(0, 2).map((item: any) => (
                                      item.product_image ? (
                                        <img key={item.id} src={item.product_image} alt="" className="w-7 h-7 rounded object-cover border border-border" />
                                      ) : (
                                        <div key={item.id} className="w-7 h-7 rounded bg-muted flex items-center justify-center">
                                          <Package className="w-3 h-3" />
                                        </div>
                                      )
                                    ))}
                                    {items.length > 2 && (
                                      <span className="text-xs text-muted-foreground">+{items.length - 2}</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-semibold whitespace-nowrap">৳{order.total_amount}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-xs capitalize ${STATUS_COLORS[order.status] || ""}`}>
                                  {order.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                                {format(new Date(order.created_at), "dd/MM/yy HH:mm")}
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" title={t("ইনভয়েস দেখুন", "View Invoice")} onClick={() => { setInvoiceHtml(""); prevPreviewRef.current = null; setPreviewOrder(order); }}>
                                    <Eye className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/e/orders/edit/${order.order_id}`)}>
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 flex flex-col items-center text-muted-foreground">
                <Package className="w-12 h-12 mb-3 opacity-40" />
                <p>{t("কোনো ডাটা পাওয়া যায়নি", "No data found")}</p>
              </CardContent>
            </Card>
          )}

          {/* Chain: Incomplete Orders */}
          {result.incompleteOrders.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <h3 className="font-semibold">{t("অসম্পূর্ণ অর্ডার", "Incomplete Orders")} ({result.incompleteOrders.length})</h3>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("ফোন", "Phone")}</TableHead>
                      <TableHead>{t("নাম", "Name")}</TableHead>
                      <TableHead>{t("কারণ", "Reason")}</TableHead>
                      <TableHead>{t("ঠিকানা", "Address")}</TableHead>
                      <TableHead>{t("চেষ্টা", "Attempts")}</TableHead>
                      <TableHead>{t("তারিখ", "Date")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.incompleteOrders.map((inc: any) => (
                      <TableRow key={inc.id}>
                        <TableCell>
                          <span className="text-sm cursor-pointer text-primary hover:underline" onClick={() => quickSearch(inc.phone)}>
                            {inc.phone}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">{inc.customer_name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">
                            {inc.reason}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{inc.address || "—"}</TableCell>
                        <TableCell className="text-center">{inc.attempt_count}</TableCell>
                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                          {format(new Date(inc.created_at), "dd/MM/yy HH:mm")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Chain: Chat Sessions */}
          {result.chatSessions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-violet-500" />
                  <h3 className="font-semibold">{t("চ্যাট কনভার্সেশন", "Chat Conversations")} ({result.chatSessions.length})</h3>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("কাস্টমার", "Customer")}</TableHead>
                      <TableHead>{t("ফোন", "Phone")}</TableHead>
                      <TableHead>{t("মেসেজ", "Messages")}</TableHead>
                      <TableHead>{t("শেষ মেসেজ", "Last Message")}</TableHead>
                      <TableHead>{t("স্ট্যাটাস", "Status")}</TableHead>
                      <TableHead className="text-right">{t("অ্যাকশন", "Action")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.chatSessions.map((chat: any) => {
                      const msgs = Array.isArray(chat.messages) ? chat.messages : [];
                      const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
                      const lastMsgText = lastMsg?.content ? (typeof lastMsg.content === "string" ? lastMsg.content : "") : "";
                      return (
                        <TableRow key={chat.id}>
                          <TableCell className="font-medium">{chat.customer_name || "—"}</TableCell>
                          <TableCell>
                            {chat.customer_phone ? (
                              <span className="text-sm cursor-pointer text-primary hover:underline" onClick={() => quickSearch(chat.customer_phone)}>
                                {chat.customer_phone}
                              </span>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{chat.message_count}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            <p className="text-xs text-muted-foreground truncate">{lastMsgText.slice(0, 80) || "—"}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {chat.last_message_at ? format(new Date(chat.last_message_at), "dd/MM/yy HH:mm") : "—"}
                            </p>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {!chat.is_read && <Badge className="text-[10px] bg-red-500/10 text-red-600 border-red-500/20" variant="outline">Unread</Badge>}
                              {chat.ai_paused && <Badge className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20" variant="outline">AI Off</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/admin/messages`)}>
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Bottom continue button */}
          {result.hitLimit && (
            <div className="text-center">
              <Button onClick={handleContinue} disabled={isContinuing} variant="outline" size="lg">
                {isContinuing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
                {t(`আরো ${DEFAULT_ORDER_LIMIT}টি অর্ডার খুঁজুন`, `Find ${DEFAULT_ORDER_LIMIT} more orders`)}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Invoice Preview Dialog */}
      <Dialog open={!!previewOrder} onOpenChange={(open) => { if (!open) { setPreviewOrder(null); setInvoiceHtml(""); prevPreviewRef.current = null; } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b">
            <DialogTitle className="flex items-center justify-between">
              <span>{t("ইনভয়েস প্রিভিউ", "Invoice Preview")} — {previewOrder?.order_id}</span>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  if (!invoiceHtml) return;
                  const w = window.open("", "_blank", "width=800,height=1000");
                  if (!w) return;
                  w.document.write(invoiceHtml);
                  w.document.close();
                  setTimeout(() => w.print(), 500);
                }}
                disabled={!invoiceHtml}
              >
                <Printer className="w-3.5 h-3.5" />
                {t("প্রিন্ট", "Print")}
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto" style={{ height: "calc(90vh - 80px)" }}>
            {previewLoading || !invoiceHtml ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <iframe
                srcDoc={invoiceHtml}
                className="w-full border-0"
                style={{ height: "100%", minHeight: "700px" }}
                title="Invoice Preview"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ icon, label, count, color }: { icon: React.ReactNode; label: string; count: number; color: string }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div className={`${color}`}>{icon}</div>
        <div>
          <p className="text-xl font-bold">{count}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-background/60 rounded-md px-2 py-1.5">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
