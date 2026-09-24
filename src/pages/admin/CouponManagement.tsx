import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Ticket, Copy, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface CouponForm {
  code: string;
  discount_type: "fixed" | "percentage";
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  usage_limit: number | null;
  starts_at: string;
  expires_at: string | null;
  is_active: boolean;
}

const emptyForm: CouponForm = {
  code: "",
  discount_type: "fixed",
  discount_value: 0,
  min_order_amount: 0,
  max_discount_amount: null,
  usage_limit: null,
  starts_at: new Date().toISOString().slice(0, 16),
  expires_at: null,
  is_active: true,
};

function generateCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function CouponManagement() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CouponForm>(emptyForm);
  const [isLifetime, setIsLifetime] = useState(true);

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        code: form.code.trim().toUpperCase(),
        discount_type: form.discount_type,
        discount_value: form.discount_value,
        min_order_amount: form.min_order_amount,
        max_discount_amount: form.discount_type === "percentage" ? form.max_discount_amount : null,
        usage_limit: form.usage_limit,
        starts_at: new Date(form.starts_at).toISOString(),
        expires_at: isLifetime ? null : form.expires_at ? new Date(form.expires_at).toISOString() : null,
        is_active: form.is_active,
      };

      if (editingId) {
        const { error } = await supabase.from("coupons").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("coupons").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "কুপন আপডেট হয়েছে" : "কুপন তৈরি হয়েছে");
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      setDialogOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coupons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("কুপন মুছে ফেলা হয়েছে");
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("coupons").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-coupons"] }),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, code: generateCode(), starts_at: new Date().toISOString().slice(0, 16) });
    setIsLifetime(true);
    setDialogOpen(true);
  };

  const openEdit = (c: any) => {
    setEditingId(c.id);
    setForm({
      code: c.code,
      discount_type: c.discount_type,
      discount_value: c.discount_value,
      min_order_amount: c.min_order_amount,
      max_discount_amount: c.max_discount_amount,
      usage_limit: c.usage_limit,
      starts_at: c.starts_at ? new Date(c.starts_at).toISOString().slice(0, 16) : "",
      expires_at: c.expires_at ? new Date(c.expires_at).toISOString().slice(0, 16) : null,
      is_active: c.is_active,
    });
    setIsLifetime(!c.expires_at);
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim()) return toast.error("কুপন কোড দিন");
    if (form.discount_value <= 0) return toast.error("ডিসকাউন্ট মান দিন");
    saveMutation.mutate();
  };

  const isExpired = (c: any) => c.expires_at && new Date(c.expires_at) < new Date();
  const isLimitReached = (c: any) => c.usage_limit && c.used_count >= c.usage_limit;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> নতুন কুপন
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : coupons.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Ticket className="w-12 h-12 mx-auto opacity-30 mb-3" />
          <p>কোনো কুপন নেই। নতুন কুপন তৈরি করুন।</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>কোড</TableHead>
                <TableHead>ডিসকাউন্ট</TableHead>
                <TableHead>ন্যূনতম অর্ডার</TableHead>
                <TableHead>ব্যবহার</TableHead>
                <TableHead>মোট ছাড়</TableHead>
                <TableHead>মেয়াদ</TableHead>
                <TableHead>স্ট্যাটাস</TableHead>
                <TableHead className="text-right">অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((c: any) => (
                <TableRow key={c.id} className={!c.is_active ? "opacity-50" : ""}>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <code className="font-mono font-bold text-sm bg-muted px-2 py-0.5 rounded">{c.code}</code>
                      <button
                        onClick={() => { navigator.clipboard.writeText(c.code); toast.success("কপি হয়েছে"); }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    {c.discount_type === "fixed"
                      ? `৳${c.discount_value}`
                      : `${c.discount_value}%${c.max_discount_amount ? ` (সর্বোচ্চ ৳${c.max_discount_amount})` : ""}`}
                  </TableCell>
                  <TableCell>{c.min_order_amount > 0 ? `৳${c.min_order_amount}+` : "—"}</TableCell>
                  <TableCell>
                    {c.used_count}{c.usage_limit ? `/${c.usage_limit}` : " (∞)"}
                  </TableCell>
                  <TableCell>৳{Number(c.total_discount_given).toFixed(0)}</TableCell>
                  <TableCell>
                    <div className="text-xs space-y-0.5">
                      <div>শুরু: {format(new Date(c.starts_at), "dd MMM yyyy")}</div>
                      {c.expires_at ? (
                        <div className={isExpired(c) ? "text-destructive" : ""}>
                          শেষ: {format(new Date(c.expires_at), "dd MMM yyyy")}
                          {isExpired(c) && " (মেয়াদ শেষ)"}
                        </div>
                      ) : (
                        <div className="text-muted-foreground">লাইফটাইম</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {isExpired(c) ? (
                      <Badge variant="destructive">মেয়াদ শেষ</Badge>
                    ) : isLimitReached(c) ? (
                      <Badge variant="secondary">লিমিট শেষ</Badge>
                    ) : (
                      <Switch
                        checked={c.is_active}
                        onCheckedChange={(v) => toggleMutation.mutate({ id: c.id, active: v })}
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => { if (confirm("কুপনটি মুছে ফেলতে চান?")) deleteMutation.mutate(c.id); }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "কুপন এডিট" : "নতুন কুপন"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>কুপন কোড</Label>
              <div className="flex gap-2">
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, "") })}
                  placeholder="SAVE100"
                  className="font-mono uppercase"
                  maxLength={20}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, code: generateCode() })}>
                  র‍্যান্ডম
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>ডিসকাউন্ট ধরন</Label>
                <Select value={form.discount_type} onValueChange={(v: "fixed" | "percentage") => setForm({ ...form, discount_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">নির্দিষ্ট টাকা (৳)</SelectItem>
                    <SelectItem value="percentage">শতাংশ (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{form.discount_type === "fixed" ? "ছাড়ের পরিমাণ (৳)" : "ছাড়ের হার (%)"}</Label>
                <Input
                  type="number" min={0}
                  value={form.discount_value || ""}
                  onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })}
                />
              </div>
            </div>

            {form.discount_type === "percentage" && (
              <div className="space-y-2">
                <Label>সর্বোচ্চ ছাড় (৳) — ঐচ্ছিক</Label>
                <Input
                  type="number" min={0}
                  value={form.max_discount_amount ?? ""}
                  onChange={(e) => setForm({ ...form, max_discount_amount: e.target.value ? Number(e.target.value) : null })}
                  placeholder="সীমা না থাকলে খালি রাখুন"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>ন্যূনতম অর্ডার (৳)</Label>
                <Input
                  type="number" min={0}
                  value={form.min_order_amount || ""}
                  onChange={(e) => setForm({ ...form, min_order_amount: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>ব্যবহার সীমা</Label>
                <Input
                  type="number" min={0}
                  value={form.usage_limit ?? ""}
                  onChange={(e) => setForm({ ...form, usage_limit: e.target.value ? Number(e.target.value) : null })}
                  placeholder="সীমাহীন"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>শুরুর তারিখ</Label>
              <Input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>মেয়াদ</Label>
                <div className="flex items-center gap-2">
                  <Switch checked={isLifetime} onCheckedChange={setIsLifetime} />
                  <span className="text-xs text-muted-foreground">{isLifetime ? "লাইফটাইম" : "নির্দিষ্ট মেয়াদ"}</span>
                </div>
              </div>
              {!isLifetime && (
                <Input
                  type="datetime-local"
                  value={form.expires_at || ""}
                  onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                />
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>{form.is_active ? "সক্রিয়" : "নিষ্ক্রিয়"}</Label>
            </div>

            <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editingId ? "আপডেট করুন" : "তৈরি করুন"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
