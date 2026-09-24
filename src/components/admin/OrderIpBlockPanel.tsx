import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Ban, Loader2, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Props {
  visitorId?: string | null;
}

const DURATIONS = [
  { value: "1h", label_bn: "১ ঘণ্টা", label_en: "1 hour", hours: 1 },
  { value: "24h", label_bn: "২৪ ঘণ্টা", label_en: "24 hours", hours: 24 },
  { value: "7d", label_bn: "৭ দিন", label_en: "7 days", hours: 24 * 7 },
  { value: "30d", label_bn: "৩০ দিন", label_en: "30 days", hours: 24 * 30 },
  { value: "perm", label_bn: "স্থায়ী", label_en: "Permanent", hours: 0 },
];

export function OrderIpBlockPanel({ visitorId }: Props) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [duration, setDuration] = useState("24h");

  const { data: ip } = useQuery({
    queryKey: ["order-visitor-ip", visitorId],
    enabled: !!visitorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visitors")
        .select("ip_addresses")
        .eq("id", visitorId as string)
        .maybeSingle();
      if (error) throw error;
      const list = (data?.ip_addresses as string[] | null) || [];
      return list[list.length - 1] || null;
    },
  });

  const { data: existing } = useQuery({
    queryKey: ["ip-block", ip],
    enabled: !!ip,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocked_devices")
        .select("*")
        .eq("block_type", "ip")
        .eq("block_value", ip as string)
        .maybeSingle();
      if (error) throw error;
      if (data?.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null;
      return data;
    },
  });

  const blockMut = useMutation({
    mutationFn: async () => {
      if (!ip) throw new Error("No IP");
      const d = DURATIONS.find((x) => x.value === duration)!;
      const expires_at = d.hours === 0 ? null : new Date(Date.now() + d.hours * 3600_000).toISOString();
      const { error } = await supabase
        .from("blocked_devices")
        .upsert({ block_type: "ip", block_value: ip, expires_at, reason: "Blocked from order popup" }, { onConflict: "block_type,block_value" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("IP ব্লক করা হয়েছে", "IP blocked"));
      qc.invalidateQueries({ queryKey: ["ip-block", ip] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  const unblockMut = useMutation({
    mutationFn: async () => {
      if (!ip) throw new Error("No IP");
      const { error } = await supabase.from("blocked_devices").delete().eq("block_type", "ip").eq("block_value", ip);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("ব্লক সরানো হয়েছে", "Unblocked"));
      qc.invalidateQueries({ queryKey: ["ip-block", ip] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  return (
    <div className="border-t border-border pt-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="font-semibold flex items-center gap-1.5">
          <Ban className="w-4 h-4 text-destructive" />
          {t("IP ব্লক", "IP Block")}
        </p>
        {ip ? (
          <code className="text-xs px-2 py-0.5 rounded bg-muted">{ip}</code>
        ) : (
          <span className="text-xs text-muted-foreground">{t("IP পাওয়া যায়নি", "No IP found")}</span>
        )}
      </div>

      {existing ? (
        <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/30">
          <div className="text-xs">
            <p className="font-medium text-destructive">{t("এই IP ব্লক করা আছে", "This IP is blocked")}</p>
            <p className="text-muted-foreground">
              {existing.expires_at
                ? t("শেষ হবে: ", "Expires: ") + formatDistanceToNow(new Date(existing.expires_at), { addSuffix: true })
                : t("স্থায়ী ব্লক", "Permanent block")}
            </p>
          </div>
          <Button size="sm" variant="outline" disabled={unblockMut.isPending} onClick={() => unblockMut.mutate()}>
            {unblockMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldOff className="w-3.5 h-3.5" />}
            {t("আনব্লক", "Unblock")}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger className="h-9 flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DURATIONS.map((d) => (
                <SelectItem key={d.value} value={d.value}>{t(d.label_bn, d.label_en)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="destructive" disabled={!ip || blockMut.isPending} onClick={() => blockMut.mutate()} className="gap-1.5">
            {blockMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
            {t("ব্লক করুন", "Block")}
          </Button>
        </div>
      )}
    </div>
  );
}
