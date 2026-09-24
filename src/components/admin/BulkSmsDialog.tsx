import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, MessageSquare, Send } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  phones: string[];
  filterLabel: string;
}

export function BulkSmsDialog({ open, onOpenChange, phones, filterLabel }: Props) {
  const { t } = useLanguage();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, failed: 0, total: 0 });

  const handleSend = async () => {
    if (!message.trim() || phones.length === 0) return;
    setSending(true);
    const total = phones.length;
    setProgress({ sent: 0, failed: 0, total });

    let sent = 0, failed = 0;
    for (const phone of phones) {
      try {
        const { data, error } = await supabase.functions.invoke("sms-api", {
          body: { action: "send_sms", number: phone, message: message.trim(), reason: "bulk_sms" },
        });
        if (error || !data?.success) { failed++; } else { sent++; }
      } catch { failed++; }
      setProgress({ sent, failed, total });
    }

    setSending(false);
    toast.success(t(`${sent}টি SMS পাঠানো হয়েছে, ${failed}টি ব্যর্থ`, `${sent} sent, ${failed} failed`));
    if (failed === 0) { setMessage(""); onOpenChange(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            {t("বাল্ক SMS", "Bulk SMS")}
          </DialogTitle>
          <DialogDescription>
            {filterLabel} — {phones.length} {t("জন কাস্টমার", "customers")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t("মেসেজ", "Message")}</Label>
            <Textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
              placeholder={t("SMS এর মেসেজ লিখুন...", "Write your SMS message...")} />
            <p className="text-xs text-muted-foreground mt-1">{message.length}/160</p>
          </div>
          {sending && (
            <div className="text-sm text-muted-foreground">
              ✅ {progress.sent} / {progress.total} {t("পাঠানো হয়েছে", "sent")}
              {progress.failed > 0 && <span className="text-destructive ml-2">❌ {progress.failed}</span>}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleSend} disabled={sending || !message.trim() || phones.length === 0}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            {sending ? t("পাঠানো হচ্ছে...", "Sending...") : t(`${phones.length} জনকে পাঠান`, `Send to ${phones.length}`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
