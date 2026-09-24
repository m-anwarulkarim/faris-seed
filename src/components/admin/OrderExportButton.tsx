import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  statuses: string[];
  search: string;
  fromISO?: string;
  toISO?: string;
  filterLabel: string;
}

const COLUMNS: { key: string; header: string }[] = [
  { key: "customer_facing_id", header: "Order ID" },
  { key: "order_id", header: "Internal ID" },
  { key: "created_at", header: "Created At" },
  { key: "status", header: "Status" },
  { key: "delivery_status", header: "Delivery Status" },
  { key: "customer_name", header: "Customer Name" },
  { key: "phone", header: "Phone" },
  { key: "alt_phone", header: "Alt Phone" },
  { key: "district", header: "District" },
  { key: "thana", header: "Thana" },
  { key: "address", header: "Address" },
  { key: "products_summary", header: "Products" },
  { key: "subtotal", header: "Subtotal" },
  { key: "delivery_charge", header: "Delivery Charge" },
  { key: "discount", header: "Discount" },
  { key: "total_amount", header: "Total" },
  { key: "payment_method", header: "Payment Method" },
  { key: "payment_status", header: "Payment Status" },
  { key: "consignment_id", header: "Consignment ID" },
  { key: "courier", header: "Courier" },
  { key: "notes", header: "Notes" },
  { key: "traffic_source", header: "Traffic Source" },
];

const esc = (v: any) => {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/"/g, '""');
  return `"${s}"`;
};

export function OrderExportButton({ statuses, search, fromISO, toISO, filterLabel }: Props) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);

  const fetchAll = async () => {
    const PAGE = 1000;
    let start = 0;
    const all: any[] = [];
    while (true) {
      let q = supabase
        .from("orders")
        .select("*")
        .eq("is_deleted", false)
        .in("status", statuses)
        .order("created_at", { ascending: false })
        .range(start, start + PAGE - 1);
      if (search) {
        q = q.or(
          `order_id.ilike.%${search}%,customer_facing_id.ilike.%${search}%,customer_name.ilike.%${search}%,phone.ilike.%${search}%`
        );
      }
      if (fromISO) q = q.gte("created_at", fromISO);
      if (toISO) q = q.lte("created_at", toISO);
      const { data, error } = await q;
      if (error) throw error;
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < PAGE) break;
      start += PAGE;
    }

    const ids = all.map((o) => o.id);
    const itemsByOrder: Record<string, string[]> = {};
    for (let i = 0; i < ids.length; i += 200) {
      const slice = ids.slice(i, i + 200);
      const { data: items } = await supabase
        .from("order_items")
        .select("order_id, product_name, quantity")
        .in("order_id", slice);
      (items || []).forEach((it: any) => {
        const arr = itemsByOrder[it.order_id] || (itemsByOrder[it.order_id] = []);
        arr.push(`${it.product_name} x${it.quantity}`);
      });
    }

    return all.map((o) => {
      const row: Record<string, any> = {};
      COLUMNS.forEach((c) => {
        if (c.key === "products_summary") {
          row[c.header] = (itemsByOrder[o.id] || []).join(" | ");
        } else if (c.key === "created_at") {
          row[c.header] = o.created_at ? new Date(o.created_at).toLocaleString("en-GB") : "";
        } else {
          row[c.header] = o[c.key] ?? "";
        }
      });
      return row;
    });
  };

  const filename = (ext: string) => {
    const ts = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    return `orders_${filterLabel}_${ts}.${ext}`;
  };

  const handleExport = async (format: "xlsx" | "csv" | "json") => {
    setLoading(true);
    try {
      const rows = await fetchAll();
      if (rows.length === 0) {
        toast.warning(t("কোনো অর্ডার পাওয়া যায়নি", "No orders found"));
        return;
      }

      if (format === "json") {
        const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename("json");
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const ws = XLSX.utils.json_to_sheet(rows, { header: COLUMNS.map((c) => c.header) });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Orders");
        XLSX.writeFile(wb, filename(format), { bookType: format });
      }

      toast.success(t(`${rows.length}টি অর্ডার এক্সপোর্ট হয়েছে`, `${rows.length} orders exported`));
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Export failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {t("এক্সপোর্ট", "Export")}
          <ChevronDown className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("xlsx")}>
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("csv")}>
          CSV (.csv)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("json")}>
          JSON (.json)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
