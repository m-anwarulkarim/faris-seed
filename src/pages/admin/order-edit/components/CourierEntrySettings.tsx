import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Settings } from "lucide-react";
import { toast } from "sonner";

// Per-order courier entry settings popover
export function CourierEntrySettingsPopover({ order }: { order?: any }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [totalLot, setTotalLot] = useState("1");
  const [deliveryType, setDeliveryType] = useState("0");
  const [courierNote, setCourierNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Load global courier note only (lot & type are always hardcoded 1 and 0)
  const { data: globalCourierNote } = useQuery({
    queryKey: ["courier-entry-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .eq("key", "steadfast_courier_note");
      return data?.[0]?.value || "";
    },
  });

  // Initialize: per-order values if set, otherwise defaults
  useEffect(() => {
    if (initialized) return;
    if (globalCourierNote === undefined) return;

    setTotalLot(order?.courier_total_lot != null ? String(order.courier_total_lot) : "1");
    setDeliveryType(order?.courier_delivery_type != null ? String(order.courier_delivery_type) : "0");
    setCourierNote(order?.courier_note ?? globalCourierNote);
    setInitialized(true);
  }, [globalCourierNote, order, initialized]);

  const handleSave = async () => {
    if (!order?.id) {
      toast.error(t("অর্ডার নেই", "No order"));
      return;
    }
    setSaving(true);
    try {
      await supabase.from("orders").update({
        courier_total_lot: parseInt(totalLot, 10) || 1,
        courier_delivery_type: parseInt(deliveryType, 10) || 0,
        courier_note: courierNote || null,
      } as any).eq("id", order.id);
      queryClient.invalidateQueries({ queryKey: ["order-edit", order.order_id] });
      toast.success(t("এই অর্ডারের কুরিয়ার সেটিংস সেভ হয়েছে", "Order courier settings saved"));
    } catch {
      toast.error(t("সেভ ব্যর্থ", "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl flex-shrink-0" title={t("কুরিয়ার সেটিংস", "Courier Settings")}>
          <Settings className="w-4 h-4 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm space-y-3">
        <DialogHeader>
          <DialogTitle className="text-base">{t("কুরিয়ার এন্ট্রি সেটিংস", "Courier Entry Settings")}</DialogTitle>
          {order?.id && <p className="text-[11px] text-muted-foreground">{t("শুধু এই অর্ডারের জন্য", "For this order only")}</p>}
        </DialogHeader>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("Total Lot (আইটেম সংখ্যা)", "Total Lot")}</Label>
          <Input
            type="number"
            min="1"
            value={totalLot}
            onChange={(e) => setTotalLot(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("Delivery Type", "Delivery Type")}</Label>
          <Select value={deliveryType} onValueChange={setDeliveryType}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">{t("0 — হোম ডেলিভারি", "0 — Home Delivery")}</SelectItem>
              <SelectItem value="1">{t("1 — পয়েন্ট / হাব পিকআপ", "1 — Point / Hub Pickup")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("কুরিয়ার নোট", "Courier Note")}</Label>
          <Textarea
            placeholder={t("কুরিয়ার নোট...", "Courier note...")}
            value={courierNote}
            onChange={(e) => setCourierNote(e.target.value)}
            className="text-sm min-h-[80px]"
          />
        </div>
        {order?.courier_remarks && (
          <div className="space-y-1.5 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-2.5">
            <Label className="text-xs text-amber-700 dark:text-amber-400">💬 {t("কুরিয়ার রিমার্কস (API)", "Courier Remarks (API)")}</Label>
            <p className="text-xs text-amber-800 dark:text-amber-300">{order.courier_remarks}</p>
          </div>
        )}
        <Button size="sm" onClick={async () => { await handleSave(); setOpen(false); }} disabled={saving} className="w-full">
          {saving ? t("সেভ হচ্ছে...", "Saving...") : t("সেভ করুন", "Save")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
