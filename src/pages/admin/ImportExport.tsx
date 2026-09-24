import { useState, useRef } from "react";
import EcomDriveImportSection from "@/components/admin/EcomDriveImportSection";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Download, Upload, Loader2, Package, ShoppingCart, Users,
  BookOpen, Tag, FileSpreadsheet, CheckCircle2, AlertCircle,
  Brain, Database, HardDrive,
} from "lucide-react";

interface TableConfig {
  key: string;
  label: string;
  labelEn: string;
  icon: React.ElementType;
  table: string;
  columns: string[];
  uniqueKey?: string;
  orderBy?: string;
  filterDeleted?: boolean;
}

const TABLE_CONFIGS: TableConfig[] = [
  {
    key: "products",
    label: "পণ্য তালিকা",
    labelEn: "Products",
    icon: Package,
    table: "products",
    columns: ["name","sku","category","tag","regular_price","offer_price","buying_price","stock","reserved_stock","incoming_stock","position","is_hidden","slug","short_description","full_description","product_image","image_gallery"],
    uniqueKey: "sku",
    orderBy: "created_at",
  },
  {
    key: "orders_all",
    label: "সকল অর্ডার",
    labelEn: "All Orders",
    icon: ShoppingCart,
    table: "orders",
    columns: ["order_id","customer_facing_id","customer_name","phone","alt_phone","address","district","thana","delivery_area","status","total_amount","delivery_charge","advance","discount","note","pre_date","is_printed","is_courier_entered","is_deleted","consignment_id","tracking_code","delivery_status","courier_note","courier_total_lot","courier_delivery_type","print_note","traffic_source","created_at"],
    uniqueKey: "order_id",
    orderBy: "created_at",
  },
  {
    key: "order_items",
    label: "অর্ডার আইটেম",
    labelEn: "Order Items",
    icon: ShoppingCart,
    table: "order_items",
    columns: ["order_id","product_id","product_name","product_image","quantity","unit_price","delivered_qty","returned_qty","created_at"],
    orderBy: "created_at",
  },
  {
    key: "customers",
    label: "কাস্টমার তালিকা",
    labelEn: "Customer List",
    icon: Users,
    table: "visitor_profiles",
    columns: ["name","phone","alt_phone","address","district","thana","gender","age","user_type","bio","username","profile_picture","cover_photo","created_at"],
    uniqueKey: "phone",
    orderBy: "created_at",
  },
  {
    key: "categories",
    label: "ক্যাটাগরি",
    labelEn: "Categories",
    icon: BookOpen,
    table: "categories",
    columns: ["name","display_name","description","image","position"],
    uniqueKey: "name",
    orderBy: "created_at",
  },
  {
    key: "tags",
    label: "ট্যাগ",
    labelEn: "Tags",
    icon: Tag,
    table: "tags",
    columns: ["name","description","color","icon"],
    uniqueKey: "name",
    orderBy: "created_at",
  },
];

const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "", inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { result.push(current); current = ""; }
      else current += ch;
    }
  }
  result.push(current);
  return result;
};

const escapeCSV = (val: any): string => {
  if (val === null || val === undefined) return "";
  if (Array.isArray(val)) val = val.join("|");
  if (typeof val === "object") val = JSON.stringify(val);
  const str = String(val).replace(/"/g, '""');
  return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str}"` : str;
};

interface ImportProgress {
  current: number;
  total: number;
  inserted: number;
  updated: number;
  errors: number;
}


export default function ImportExport() {
  const { t } = useLanguage();
  const [exporting, setExporting] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [importProgress, setImportProgress] = useState<Record<string, ImportProgress>>({});
  const [lastResult, setLastResult] = useState<{ key: string; message: string; type: "success" | "error" } | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchAllRows = async (table: string, orderBy?: string) => {
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let from = 0;
    while (true) {
      let query = supabase.from(table as any).select("*").range(from, from + PAGE_SIZE - 1);
      if (orderBy) query = query.order(orderBy, { ascending: true });
      const { data, error } = await query;
      if (error) throw error;
      if (!data?.length) break;
      allData = allData.concat(data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return allData;
  };

  const handleExport = async (config: TableConfig) => {
    setExporting(config.key);
    setProgress(0);
    try {
      const data = await fetchAllRows(config.table, config.orderBy);
      if (!data?.length) { toast.info(t("কোনো ডেটা নেই", "No data found")); setExporting(null); return; }

      setProgress(50);
      const headers = config.columns;
      const csvRows = [headers.join(",")];
      for (const row of data) {
        csvRows.push(headers.map(h => escapeCSV((row as any)[h])).join(","));
      }

      const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${config.key}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setProgress(100);
      setLastResult({ key: config.key, message: t(`${data.length}টি রেকর্ড এক্সপোর্ট হয়েছে`, `${data.length} records exported`), type: "success" });
      toast.success(t(`${data.length}টি রেকর্ড এক্সপোর্ট হয়েছে`, `${data.length} records exported`));
    } catch (err: any) {
      setLastResult({ key: config.key, message: err.message, type: "error" });
      toast.error(err.message);
    }
    setExporting(null);
  };

  const handleImport = async (config: TableConfig, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(config.key);
    setProgress(0);

    try {
      const text = await file.text();
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) throw new Error(t("CSV ফাইলে ডেটা নেই", "No data in CSV"));

      const headers = parseCSVLine(lines[0]).map(h => h.trim().replace(/^\uFEFF/, ""));
      const numericCols = ["regular_price","offer_price","buying_price","total_amount","unit_price","delivery_charge","advance","discount"];
      const intCols = ["stock","quantity","position","reserved_stock","incoming_stock","age","delivered_qty","returned_qty","courier_total_lot","courier_delivery_type"];
      const boolCols = ["is_printed","is_courier_entered","is_deleted","is_hidden","print_note"];
      const arrayCols = ["image_gallery"];

      let inserted = 0, updated = 0, errors = 0;
      const total = lines.length - 1;

      // 🔒 PROTECTED COLUMNS: never auto-overwrite these via CSV import unless
      // the cell has an explicit value. Prevents accidental mass-unhide of
      // products when an exported CSV is re-imported with empty is_hidden cells.
      const protectedCols = new Set(["is_hidden"]);

      for (let i = 1; i < lines.length; i++) {
        const vals = parseCSVLine(lines[i]);
        const row: any = {};
        const explicitlyProvided = new Set<string>();
        headers.forEach((h, idx) => {
          const rawCell = vals[idx];
          const v = rawCell?.trim() || null;
          if (v) explicitlyProvided.add(h);
          if (!v) { row[h] = null; return; }
          if (intCols.includes(h)) { row[h] = parseInt(v) || 0; }
          else if (numericCols.includes(h)) { row[h] = parseFloat(v) || null; }
          else if (boolCols.includes(h)) { row[h] = v === "true" || v === "1" || v.toLowerCase() === "yes"; }
          else if (arrayCols.includes(h)) { row[h] = v.split("|").filter(Boolean); }
          else { row[h] = v; }
        });

        // Filter only valid columns for this table
        const validRow: any = {};
        for (const col of config.columns) {
          if (col in row) validRow[col] = row[col];
        }

        // Drop protected columns when blank — keeps existing DB value intact
        for (const col of protectedCols) {
          if (col in validRow && !explicitlyProvided.has(col)) {
            delete validRow[col];
          }
        }

        if (config.uniqueKey && validRow[config.uniqueKey]) {
          const { data: existing } = await supabase
            .from(config.table as any)
            .select("id")
            .eq(config.uniqueKey, validRow[config.uniqueKey])
            .maybeSingle();

          if (existing) {
            const { error } = await supabase.from(config.table as any).update(validRow).eq("id", (existing as any).id);
            if (error) errors++; else updated++;
          } else {
            const { error } = await supabase.from(config.table as any).insert(validRow);
            if (error) errors++; else inserted++;
          }
        } else {
          const { error } = await supabase.from(config.table as any).insert(validRow);
          if (error) errors++; else inserted++;
        }

        setProgress(Math.round((i / total) * 100));
        setImportProgress(prev => ({ ...prev, [config.key]: { current: i, total, inserted, updated, errors } }));
      }

      const msg = t(
        `ইমপোর্ট সম্পন্ন: ${inserted} নতুন, ${updated} আপডেট${errors ? `, ${errors} ত্রুটি` : ""}`,
        `Import done: ${inserted} new, ${updated} updated${errors ? `, ${errors} errors` : ""}`
      );
      setLastResult({ key: config.key, message: msg, type: errors > 0 ? "error" : "success" });
      toast.success(msg);
    } catch (err: any) {
      setLastResult({ key: config.key, message: err.message, type: "error" });
      toast.error(err.message);
    }

    setImporting(null);
    setImportProgress(prev => { const copy = { ...prev }; delete copy[config.key]; return copy; });
    setProgress(0);
    const ref = fileRefs.current[config.key];
    if (ref) ref.value = "";
  };

  // AI training & RAG export/import removed


  // === Full Backup ===
  const [fullBackingUp, setFullBackingUp] = useState(false);
  const [fullRestoring, setFullRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState("");
  const fullRestoreRef = useRef<HTMLInputElement>(null);

  // All additional tables to include in full backup/restore
  const EXTRA_BACKUP_TABLES = [
    { key: "visitors", table: "visitors" },
    { key: "credit_transactions", table: "credit_transactions" },
    { key: "wishlists", table: "wishlists" },
    { key: "product_reviews", table: "product_reviews" },
    { key: "saved_addresses", table: "saved_addresses" },
    { key: "support_messages", table: "support_messages" },
    { key: "support_reports", table: "support_reports" },
    { key: "referrals", table: "referrals" },
    { key: "incomplete_orders", table: "incomplete_orders" },
    { key: "order_status_history", table: "order_status_history" },
    { key: "order_notifications", table: "order_notifications" },
    { key: "sms_logs", table: "sms_logs" },
    { key: "push_subscriptions", table: "push_subscriptions" },
    { key: "push_templates", table: "push_templates" },
    { key: "push_broadcast_logs", table: "push_broadcast_logs" },
    { key: "push_prompt_events", table: "push_prompt_events" },
    { key: "direct_messages", table: "direct_messages" },
    { key: "flagged_keywords", table: "flagged_keywords" },
    { key: "blocked_devices", table: "blocked_devices" },
    { key: "custom_pages", table: "custom_pages" },
    { key: "analytics_events", table: "analytics_events" },
    { key: "admin_permissions", table: "admin_permissions" },
    { key: "message_flags", table: "message_flags" },
  ];

  const handleFullBackup = async () => {
    setFullBackingUp(true);
    try {
      const backup: any = { version: 2, exported_at: new Date().toISOString(), tables: {} };

      for (const config of TABLE_CONFIGS) {
        const data = await fetchAllRows(config.table, config.orderBy);
        backup.tables[config.key] = data || [];
      }

      // Extra tables
      for (const extra of EXTRA_BACKUP_TABLES) {
        const data = await fetchAllRows(extra.table, "created_at");
        backup.tables[extra.key] = data || [];
      }

      // AI training & RAG tables removed from backup


      const { data: coupons } = await supabase.from("coupons").select("*");
      backup.tables.coupons = coupons || [];

      const { data: settings } = await supabase.from("app_settings").select("*");
      backup.tables.app_settings = settings || [];

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `full-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      const totalRecords = Object.values(backup.tables).reduce((sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
      toast.success(t(`সম্পূর্ণ ব্যাকআপ সম্পন্ন — ${totalRecords}টি রেকর্ড`, `Full backup done — ${totalRecords} records`));
    } catch (err: any) {
      toast.error(err.message || t("ব্যাকআপ ব্যর্থ", "Backup failed"));
    } finally {
      setFullBackingUp(false);
    }
  };

  const handleFullRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm(t(
      "⚠️ রিস্টোর করলে বিদ্যমান ডেটা আপডেট/ওভাররাইট হতে পারে। আপনি কি নিশ্চিত?",
      "⚠️ Restoring may update/overwrite existing data. Are you sure?"
    ))) {
      if (fullRestoreRef.current) fullRestoreRef.current.value = "";
      return;
    }

    setFullRestoring(true);
    setRestoreProgress("");
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      if (!backup.tables || (backup.version !== 1 && backup.version !== 2)) throw new Error(t("অবৈধ ব্যাকআপ ফাইল", "Invalid backup file"));

      const results: string[] = [];

      // Restore CSV-type tables via upsert
      const tableRestoreOrder: { key: string; table: string; uniqueKey?: string; label: string }[] = [
        { key: "categories", table: "categories", uniqueKey: "name", label: "ক্যাটাগরি" },
        { key: "tags", table: "tags", uniqueKey: "name", label: "ট্যাগ" },
        { key: "products", table: "products", uniqueKey: "sku", label: "পণ্য" },
        { key: "customers", table: "visitor_profiles", uniqueKey: "phone", label: "কাস্টমার" },
        { key: "coupons", table: "coupons", uniqueKey: "code", label: "কুপন" },
      ];

      for (const tbl of tableRestoreOrder) {
        const rows = backup.tables[tbl.key];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        setRestoreProgress(t(`${tbl.label} রিস্টোর হচ্ছে...`, `Restoring ${tbl.label}...`));
        let count = 0;
        for (const row of rows) {
          const { id, created_at, updated_at, ...rest } = row;
          if (tbl.uniqueKey && rest[tbl.uniqueKey]) {
            const { data: existing } = await supabase
              .from(tbl.table as any)
              .select("id")
              .eq(tbl.uniqueKey, rest[tbl.uniqueKey])
              .maybeSingle();
            if (existing) {
              await supabase.from(tbl.table as any).update(rest).eq("id", (existing as any).id);
            } else {
              await supabase.from(tbl.table as any).insert(rest);
            }
          } else {
            await supabase.from(tbl.table as any).insert(rest);
          }
          count++;
        }
        results.push(`${tbl.label}: ${count}`);
      }

      // Orders restore (upsert by order_id, then restore order_items)
      const orderRows = backup.tables.orders_all;
      if (Array.isArray(orderRows) && orderRows.length > 0) {
        setRestoreProgress(t("অর্ডার রিস্টোর হচ্ছে...", "Restoring orders..."));
        let orderCount = 0;
        const orderIdMap: Record<string, string> = {}; // old id -> new/existing id

        for (const row of orderRows) {
          const { id: oldId, created_at, updated_at, ...rest } = row;
          if (rest.order_id) {
            const { data: existing } = await supabase
              .from("orders")
              .select("id")
              .eq("order_id", rest.order_id)
              .maybeSingle();
            if (existing) {
              await supabase.from("orders").update(rest).eq("id", (existing as any).id);
              orderIdMap[oldId] = (existing as any).id;
            } else {
              const { data: newOrder } = await supabase.from("orders").insert(rest).select("id").maybeSingle();
              if (newOrder) orderIdMap[oldId] = (newOrder as any).id;
            }
          } else {
            const { data: newOrder } = await supabase.from("orders").insert(rest).select("id").maybeSingle();
            if (newOrder) orderIdMap[oldId] = (newOrder as any).id;
          }
          orderCount++;
        }
        results.push(`${t("অর্ডার", "Orders")}: ${orderCount}`);

        // Order items
        const itemRows = backup.tables.order_items;
        if (Array.isArray(itemRows) && itemRows.length > 0) {
          setRestoreProgress(t("অর্ডার আইটেম রিস্টোর হচ্ছে...", "Restoring order items..."));
          let itemCount = 0;
          for (const item of itemRows) {
            const { id, created_at, ...rest } = item;
            const mappedOrderId = orderIdMap[rest.order_id] || rest.order_id;
            // Check if this item already exists for this order+product
            const { data: existingItem } = await supabase
              .from("order_items")
              .select("id")
              .eq("order_id", mappedOrderId)
              .eq("product_id", rest.product_id)
              .maybeSingle();
            if (!existingItem) {
              const { error } = await supabase.from("order_items").insert({ ...rest, order_id: mappedOrderId });
              if (!error) itemCount++;
            }
          }
          results.push(`${t("আইটেম", "Items")}: ${itemCount}`);
        }
      }

      // App settings
      const settingsRows = backup.tables.app_settings;
      if (Array.isArray(settingsRows) && settingsRows.length > 0) {
        setRestoreProgress(t("সেটিংস রিস্টোর হচ্ছে...", "Restoring settings..."));
        for (const row of settingsRows) {
          const { created_at, updated_at, ...rest } = row;
          const { data: existing } = await supabase.from("app_settings").select("key").eq("key", rest.key).maybeSingle();
          if (existing) {
            await supabase.from("app_settings").update({ value: rest.value }).eq("key", rest.key);
          } else {
            await supabase.from("app_settings").insert(rest);
          }
        }
        results.push(`${t("সেটিংস", "Settings")}: ${settingsRows.length}`);
      }

      // AI Training Data
      const aiRows = backup.tables.ai_training_data;
      if (Array.isArray(aiRows) && aiRows.length > 0) {
        setRestoreProgress(t("AI ট্রেনিং ডেটা রিস্টোর হচ্ছে...", "Restoring AI training data..."));
        let aiCount = 0;
        for (const item of aiRows) {
          const { id, created_at, updated_at, ...rest } = item;
          if (!rest.title || !rest.content) continue;
          const { error } = await supabase.from("ai_training_data").insert({
            category: rest.category || "general",
            title: rest.title,
            content: rest.content,
            is_active: rest.is_active !== false,
            position: rest.position || 0,
          });
          if (!error) aiCount++;
        }
        results.push(`AI: ${aiCount}`);
      }

      // RAG Documents (re-process via edge function for embeddings)
      const ragDocs = backup.tables.rag_documents;
      const ragChunksData = backup.tables.rag_chunks;
      if (Array.isArray(ragDocs) && ragDocs.length > 0 && Array.isArray(ragChunksData)) {
        setRestoreProgress(t("RAG ডকুমেন্ট রিস্টোর হচ্ছে...", "Restoring RAG documents..."));
        let ragCount = 0;
        for (const doc of ragDocs) {
          const docChunks = ragChunksData.find((c: any) => c.document_id === doc.id)?.chunks || [];
          if (docChunks.length === 0) continue;
          const fullContent = docChunks.sort((a: any, b: any) => a.chunk_index - b.chunk_index).map((c: any) => c.content).join("\n\n");
          const { data, error } = await supabase.functions.invoke("process-rag-document", {
            body: { title: doc.title, content: fullContent },
          });
          if (!error && !data?.error) ragCount++;
        }
        results.push(`RAG: ${ragCount}`);
      }

      // Restore extra tables (simple insert, skip duplicates)
      const extraRestoreOrder = [
        { key: "visitors", table: "visitors", label: "ভিজিটর", uniqueField: "fingerprint" },
        { key: "credit_transactions", table: "credit_transactions", label: "ক্রেডিট" },
        { key: "wishlists", table: "wishlists", label: "উইশলিস্ট" },
        { key: "product_reviews", table: "product_reviews", label: "রিভিউ" },
        { key: "saved_addresses", table: "saved_addresses", label: "ঠিকানা" },
        { key: "support_messages", table: "support_messages", label: "সাপোর্ট মেসেজ" },
        { key: "support_reports", table: "support_reports", label: "সাপোর্ট রিপোর্ট" },
        { key: "referrals", table: "referrals", label: "রেফারেল" },
        { key: "incomplete_orders", table: "incomplete_orders", label: "অসম্পূর্ণ অর্ডার" },
        { key: "order_status_history", table: "order_status_history", label: "স্ট্যাটাস হিস্টরি" },
        { key: "sms_logs", table: "sms_logs", label: "SMS লগ" },
        { key: "push_templates", table: "push_templates", label: "পুশ টেমপ্লেট", uniqueField: "name" },
        { key: "push_broadcast_logs", table: "push_broadcast_logs", label: "পুশ লগ" },
        { key: "direct_messages", table: "direct_messages", label: "ডাইরেক্ট মেসেজ" },
        { key: "flagged_keywords", table: "flagged_keywords", label: "ফ্ল্যাগড কীওয়ার্ড", uniqueField: "keyword" },
        { key: "blocked_devices", table: "blocked_devices", label: "ব্লকড ডিভাইস" },
        { key: "custom_pages", table: "custom_pages", label: "কাস্টম পেজ", uniqueField: "slug" },
      ];

      for (const extra of extraRestoreOrder) {
        const rows = backup.tables[extra.key];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        setRestoreProgress(t(`${extra.label} রিস্টোর হচ্ছে...`, `Restoring ${extra.key}...`));
        let count = 0;
        for (const row of rows) {
          const { id, created_at, updated_at, ...rest } = row;
          try {
            if (extra.uniqueField && rest[extra.uniqueField]) {
              const { data: existing } = await supabase
                .from(extra.table as any)
                .select("id")
                .eq(extra.uniqueField, rest[extra.uniqueField])
                .maybeSingle();
              if (existing) {
                await supabase.from(extra.table as any).update(rest).eq("id", (existing as any).id);
              } else {
                await supabase.from(extra.table as any).insert(rest);
              }
            } else {
              await supabase.from(extra.table as any).insert(rest);
            }
            count++;
          } catch { /* skip errors */ }
        }
        if (count > 0) results.push(`${extra.label}: ${count}`);
      }

      setRestoreProgress("");
      toast.success(t(
        `রিস্টোর সম্পন্ন — ${results.join(", ")}`,
        `Restore done — ${results.join(", ")}`
      ));
    } catch (err: any) {
      toast.error(err.message || t("রিস্টোর ব্যর্থ", "Restore failed"));
    } finally {
      setFullRestoring(false);
      setRestoreProgress("");
      if (fullRestoreRef.current) fullRestoreRef.current.value = "";
    }
  };

  const groupedConfigs = [
    { title: t("পণ্য", "Products"), items: TABLE_CONFIGS.filter(c => ["products", "categories", "tags"].includes(c.key)) },
    { title: t("অর্ডার", "Orders"), items: TABLE_CONFIGS.filter(c => c.key.startsWith("order")) },
    { title: t("কাস্টমার", "Customers"), items: TABLE_CONFIGS.filter(c => c.key === "customers") },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleFullBackup} disabled={fullBackingUp || fullRestoring} className="gap-2">
            {fullBackingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
            {t("সম্পূর্ণ ব্যাকআপ", "Full Backup")}
          </Button>
          <Button variant="outline" onClick={() => fullRestoreRef.current?.click()} disabled={fullBackingUp || fullRestoring} className="gap-2">
            {fullRestoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {fullRestoring ? restoreProgress || t("রিস্টোর হচ্ছে...", "Restoring...") : t("সম্পূর্ণ রিস্টোর", "Full Restore")}
          </Button>
          <input ref={fullRestoreRef} type="file" accept=".json" className="hidden" onChange={handleFullRestore} />
        </div>
      </div>

      {groupedConfigs.map((group) => (
        <div key={group.title} className="space-y-3">
          <h2 className="text-lg font-display font-semibold text-foreground">{group.title}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {group.items.map((config) => {
              const Icon = config.icon;
              const isExp = exporting === config.key;
              const isImp = importing === config.key;
              const result = lastResult?.key === config.key ? lastResult : null;
              const impProg = importProgress[config.key];

              return (
                <Card key={config.key} className="relative overflow-hidden">
                  {(isExp || isImp) && (
                    <div className="absolute bottom-0 left-0 right-0">
                      <Progress value={progress} className="h-1.5 rounded-none" />
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base">{t(config.label, config.labelEn)}</CardTitle>
                        <CardDescription className="text-xs">
                          {t(`${config.table} টেবিল`, `${config.table} table`)}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleExport(config)}
                        disabled={isExp || isImp}
                      >
                        {isExp ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                        {t("এক্সপোর্ট", "Export")}
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => fileRefs.current[config.key]?.click()}
                        disabled={isExp || isImp}
                      >
                        {isImp ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                        {t("ইমপোর্ট", "Import")}
                      </Button>
                      <input
                        ref={(el) => { fileRefs.current[config.key] = el; }}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => handleImport(config, e)}
                      />
                    </div>
                    {/* Live import progress */}
                    {isImp && impProg && (
                      <div className="bg-muted/60 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground font-medium">
                            {t("ইমপোর্ট হচ্ছে...", "Importing...")}
                          </span>
                          <span className="font-mono text-foreground font-semibold">
                            {impProg.current}/{impProg.total}
                          </span>
                        </div>
                        <Progress value={Math.round((impProg.current / impProg.total) * 100)} className="h-2" />
                        <div className="flex gap-3 text-[11px]">
                          <span className="text-green-600 dark:text-green-400">✓ {t("নতুন", "New")}: {impProg.inserted}</span>
                          <span className="text-blue-600 dark:text-blue-400">↻ {t("আপডেট", "Updated")}: {impProg.updated}</span>
                          {impProg.errors > 0 && <span className="text-destructive">✗ {t("ত্রুটি", "Errors")}: {impProg.errors}</span>}
                        </div>
                      </div>
                    )}
                    {result && !isImp && (
                      <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${result.type === "success" ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-destructive/10 text-destructive"}`}>
                        {result.type === "success" ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                        <span>{result.message}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}


      {/* EcomDrive Import Section */}
      <EcomDriveImportSection />

      <Card className="bg-muted/50">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <FileSpreadsheet className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">{t("CSV ফরম্যাট গাইড", "CSV Format Guide")}</p>
              <p>{t("• এক্সপোর্ট করা ফাইলের হেডার অনুসরণ করে ইমপোর্ট CSV তৈরি করুন", "• Create import CSV following the exported file headers")}</p>
              <p>{t("• SKU/Phone/Name দিয়ে ম্যাচ করে আপডেট হবে, না মিললে নতুন তৈরি হবে", "• Updates by matching SKU/Phone/Name, creates new if not found")}</p>
              <p>{t("• ইমেজ গ্যালারি: URL গুলো | (pipe) দিয়ে আলাদা করুন", "• Image gallery: separate URLs with | (pipe)")}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
