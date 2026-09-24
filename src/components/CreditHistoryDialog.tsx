import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Wallet, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { getSessionToken } from "@/components/CustomerLogin";

interface Tx {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  order_id: string | null;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Admin-mode overrides — when provided, read directly via RLS-allowed admin policy */
  profileId?: string;
  creditBalance?: number;
  adminView?: boolean;
}

function typeLabel(t: string): string {
  const map: Record<string, string> = {
    signup_bonus: "সাইনআপ বোনাস",
    order_cashback: "অর্ডার ক্যাশব্যাক",
    referral_bonus: "রেফারেল বোনাস",
    review_bonus: "রিভিউ বোনাস",
    daily_bonus: "ডেইলি বোনাস",
    admin_add: "অ্যাডমিন অ্যাড",
    admin_deduct: "অ্যাডমিন কাটছাঁট",
    premium_theme_purchase: "প্রিমিয়াম থিম",
    premium_cover_purchase: "প্রিমিয়াম কভার",
    premium_ring_purchase: "প্রিমিয়াম রিং",
    page_creation: "পেজ তৈরি",
    group_creation: "গ্রুপ তৈরি",
  };
  return map[t] || t.replace(/_/g, " ");
}

export default function CreditHistoryDialog({
  open,
  onOpenChange,
  profileId,
  creditBalance,
  adminView,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number>(creditBalance ?? 0);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        if (adminView && profileId) {
          // Admin mode: direct query (RLS allows admin/mod via policy)
          const { data, error: err } = await supabase
            .from("credit_transactions" as any)
            .select("id, amount, type, description, order_id, created_at")
            .eq("visitor_profile_id", profileId)
            .order("created_at", { ascending: false })
            .limit(100);
          if (cancelled) return;
          if (err) {
            setError("ক্রেডিট হিস্টোরি লোড করা যায়নি");
          } else {
            setTxs((data ?? []) as unknown as Tx[]);
            if (typeof creditBalance === "number") setBalance(creditBalance);
          }
        } else {
          // Customer mode: secure RPC
          const token = getSessionToken();
          if (!token) {
            setError("লগইন প্রয়োজন");
            setLoading(false);
            return;
          }
          const { data, error: err } = await supabase.rpc("get_my_credit_history" as any, {
            p_session_token: token,
            p_limit: 100,
          });
          if (cancelled) return;
          if (err || !data || (data as any).success === false) {
            setError("ক্রেডিট হিস্টোরি লোড করা যায়নি");
          } else {
            setBalance(Number((data as any).balance ?? 0));
            setTxs(((data as any).transactions ?? []) as Tx[]);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, adminView, profileId, creditBalance]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            ক্রেডিট হিস্টোরি
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-lg bg-primary/10 border border-primary/20 p-4 text-center">
          <p className="text-xs text-muted-foreground">বর্তমান ব্যালেন্স</p>
          <p className="text-3xl font-bold text-primary mt-1">৳ {balance.toFixed(0)}</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive text-center py-4">{error}</p>
        ) : txs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">কোনো ক্রেডিট লেনদেন নেই।</p>
        ) : (
          <div className="space-y-2 mt-2">
            {txs.map((tx) => {
              const positive = Number(tx.amount) >= 0;
              return (
                <div
                  key={tx.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                >
                  {positive ? (
                    <ArrowDownCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                  ) : (
                    <ArrowUpCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{typeLabel(tx.type)}</p>
                    {tx.description && (
                      <p className="text-xs text-muted-foreground truncate">{tx.description}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(tx.created_at).toLocaleString("bn-BD", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-bold whitespace-nowrap ${
                      positive ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {positive ? "+" : ""}
                    {Number(tx.amount).toFixed(0)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
