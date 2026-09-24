import { Badge } from "@/components/ui/badge";
import { Banknote, CheckCircle2, Clock, XCircle, RotateCcw } from "lucide-react";

type Props = {
  method?: string | null;
  status?: string | null;
  amount?: number | null;
  compact?: boolean;
};

/**
 * Small pill showing whether an order is COD or bKash, and bKash payment state.
 * - cod              → grey "COD"
 * - bkash + paid     → green  "bKash ✓ ৳amount"
 * - bkash + pending  → yellow "bKash ⏳"
 * - bkash + failed   → red    "bKash ✗"
 * - bkash + refunded → blue   "bKash ↩"
 */
export function PaymentBadge({ method, status, amount, compact }: Props) {
  const m = (method || "cod").toLowerCase();
  const s = (status || "").toLowerCase();

  if (m !== "bkash") {
    return (
      <Badge variant="outline" className="gap-1 bg-slate-100 text-slate-700 border-slate-200 text-[10px] px-1.5 py-0">
        <Banknote className="w-3 h-3" /> COD
      </Badge>
    );
  }

  if (s === "paid") {
    return (
      <Badge className="gap-1 bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] px-1.5 py-0">
        <CheckCircle2 className="w-3 h-3" /> bKash ✓{!compact && amount ? ` ৳${Number(amount).toLocaleString()}` : ""}
      </Badge>
    );
  }
  if (s === "failed") {
    return (
      <Badge className="gap-1 bg-red-100 text-red-800 border-red-200 text-[10px] px-1.5 py-0">
        <XCircle className="w-3 h-3" /> bKash ✗
      </Badge>
    );
  }
  if (s === "refunded") {
    return (
      <Badge className="gap-1 bg-blue-100 text-blue-800 border-blue-200 text-[10px] px-1.5 py-0">
        <RotateCcw className="w-3 h-3" /> bKash ↩
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-amber-100 text-amber-800 border-amber-200 text-[10px] px-1.5 py-0">
      <Clock className="w-3 h-3" /> bKash ⏳
    </Badge>
  );
}
