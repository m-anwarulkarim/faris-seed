import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { Download } from "lucide-react";

interface CustomerRow {
  name: string | null;
  phone: string;
  district: string | null;
  thana: string | null;
  address: string | null;
  user_type: string | null;
  credit_balance: number;
  alt_phone: string | null;
  gender: string | null;
  admin_notes: string | null;
  access_allowed: boolean;
  orderCount: number;
  orderTotal: number;
}

export function CustomerExportButton({ customers }: { customers: CustomerRow[] }) {
  const { t } = useLanguage();

  const exportCSV = () => {
    if (!customers.length) return;
    const headers = ["Name", "Phone", "Alt Phone", "District", "Thana", "Address", "Type", "Gender", "Credit", "Orders", "Total Amount", "Status", "Notes"];
    const rows = customers.map(c => [
      c.name || "", c.phone, c.alt_phone || "", c.district || "", c.thana || "",
      (c.address || "").replace(/,/g, ";"), c.user_type || "regular", c.gender || "",
      c.credit_balance, c.orderCount, c.orderTotal,
      c.access_allowed ? "Active" : "Banned", (c.admin_notes || "").replace(/,/g, ";"),
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="outline" size="sm" onClick={exportCSV} disabled={!customers.length}>
      <Download className="w-4 h-4 mr-1.5" />
      {t("CSV এক্সপোর্ট", "Export CSV")}
    </Button>
  );
}
