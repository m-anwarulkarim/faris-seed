import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Log {
  id: string;
  created_at: string;
  order_id: string | null;
  payment_id: string | null;
  trx_id: string | null;
  action: string;
  status: string | null;
  amount: number | null;
  payer_msisdn: string | null;
  error: string | null;
}

export default function BkashLogs() {
  const [rows, setRows] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [refundTarget, setRefundTarget] = useState<Log | null>(null);

  const load = async () => {
    setLoading(true);
    let q = (supabase as any).from("bkash_payment_logs").select("*").order("created_at", { ascending: false }).limit(300);
    if (status !== "all") q = q.eq("status", status);
    if (search.trim()) q = q.or(`trx_id.ilike.%${search}%,payment_id.ilike.%${search}%`);
    const { data, error } = await q;
    setLoading(false);
    if (error) return toast.error(error.message);
    setRows((data as any[]) || []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const doRefund = async () => {
    if (!refundTarget) return;
    const t = refundTarget;
    setRefundTarget(null);
    const { data, error } = await supabase.functions.invoke("bkash-pgw/refund", {
      body: {
        paymentID: t.payment_id,
        trxID: t.trx_id,
        amount: t.amount,
        reason: "Admin refund",
      },
    });
    if (error || !data?.success) {
      toast.error("Refund failed: " + (data?.response?.statusMessage || error?.message));
    } else {
      toast.success("Refund successful");
      load();
    }
  };

  const statusBadge = (s: string | null) => {
    if (!s) return <Badge variant="secondary">-</Badge>;
    const map: Record<string, string> = {
      paid: "bg-emerald-600",
      success: "bg-emerald-600",
      fail: "bg-destructive",
      pending: "bg-amber-500",
      refunded: "bg-blue-600",
    };
    return <Badge className={map[s] || "bg-muted"}>{s}</Badge>;
  };

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">bKash Payment Logs</h1>
        <p className="text-sm text-muted-foreground">সকল bKash পেমেন্ট অ্যাকশন</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="Search trxID / paymentID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          className="max-w-xs"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="fail">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={load} variant="outline">Refresh</Button>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>TrxID</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Payer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Error</TableHead>
              <TableHead>Refund</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">Loading...</TableCell></TableRow>
            )}
            {!loading && rows.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">কোনো লগ নেই</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-xs">{new Date(r.created_at).toLocaleString("en-GB")}</TableCell>
                <TableCell><Badge variant="outline">{r.action}</Badge></TableCell>
                <TableCell>
                  {r.order_id ? (
                    <Link to={`/e/orders/${r.order_id}`} className="text-primary underline text-xs">
                      {r.order_id.slice(0, 8)}
                    </Link>
                  ) : "-"}
                </TableCell>
                <TableCell className="text-xs font-mono">{r.trx_id || "-"}</TableCell>
                <TableCell>৳{r.amount ?? "-"}</TableCell>
                <TableCell className="text-xs">{r.payer_msisdn || "-"}</TableCell>
                <TableCell>{statusBadge(r.status)}</TableCell>
                <TableCell className="text-xs text-destructive max-w-[200px] truncate">{r.error || "-"}</TableCell>
                <TableCell>
                  {r.action === "execute" && r.status === "paid" && r.trx_id && (
                    <Button size="sm" variant="outline" onClick={() => setRefundTarget(r)}>Refund</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!refundTarget} onOpenChange={(o) => !o && setRefundTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refund Confirm</AlertDialogTitle>
            <AlertDialogDescription>
              TrxID <b>{refundTarget?.trx_id}</b> এর জন্য ৳{refundTarget?.amount} refund করতে চান?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doRefund}>Confirm Refund</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
