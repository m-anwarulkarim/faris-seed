import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Star, MessageSquare, Clock, CheckCircle, XCircle, PauseCircle, Loader2, Gift, Video, Download, Trash2, Plus, Pencil, Share2, ExternalLink } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { format } from "date-fns";
import { bn } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { compressImageToWebP } from "@/lib/imageCompressor";
import { addWatermarkToImage } from "@/lib/watermark";

const STATUS_OPTIONS = [
  { value: "all", label: "সব", icon: MessageSquare },
  { value: "pending", label: "পেন্ডিং", icon: Clock },
  { value: "approved", label: "অ্যাপ্রুভড", icon: CheckCircle },
  { value: "hold", label: "হোল্ড", icon: PauseCircle },
  { value: "rejected", label: "রিজেক্টেড", icon: XCircle },
];

const statusBadgeVariant: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  hold: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

function suggestCredit(rating: number, comment?: string | null): number {
  const commentLen = (comment || "").trim().length;
  let base = 0;
  if (rating >= 5) base = 3;
  else if (rating >= 4) base = 2;
  else if (rating >= 3) base = 1.5;
  else base = 1;
  if (commentLen >= 100) base += 2;
  else if (commentLen >= 50) base += 1;
  else if (commentLen >= 20) base += 0.5;
  return Math.min(999, Math.round(base * 100) / 100);
}

function isVideoUrl(url: string) {
  return /\.(mp4|mov|avi|webm|mkv)(\?|$)/i.test(url);
}

async function downloadFile(url: string, filename?: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename || url.split("/").pop() || "download";
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    window.open(url, "_blank");
  }
}

export default function ReviewManagement() {
  const [statusFilter, setStatusFilter] = useState("pending");
  const [approveDialog, setApproveDialog] = useState<{ review: any } | null>(null);
  const [creditAmount, setCreditAmount] = useState("3");
  const [editDialog, setEditDialog] = useState<{ review: any } | null>(null);
  
  const queryClient = useQueryClient();

  const { data: reviews, isLoading } = useQuery({
    queryKey: ["admin-reviews", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("product_reviews")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query.limit(200);
      if (error) throw error;

      if (!data?.length) return [];
      const productIds = [...new Set(data.map(r => r.product_id))];
      const profileIds = [...new Set(data.map(r => r.visitor_profile_id))];

      const [productsRes, profilesRes] = await Promise.all([
        supabase.from("products").select("id, name, product_image, sku").in("id", productIds),
        supabase.from("visitor_profiles").select("id, name, phone").in("id", profileIds),
      ]);

      const productMap = Object.fromEntries((productsRes.data || []).map(p => [p.id, p]));
      const profileMap = Object.fromEntries((profilesRes.data || []).map(p => [p.id, p]));

      return data.map(r => ({
        ...r,
        product: productMap[r.product_id] || null,
        customer: profileMap[r.visitor_profile_id] || null,
      }));
    },
  });

  const { data: counts } = useQuery({
    queryKey: ["admin-review-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_reviews").select("status");
      if (error) throw error;
      const c: Record<string, number> = { pending: 0, approved: 0, hold: 0, rejected: 0 };
      (data || []).forEach(r => { c[(r as any).status] = (c[(r as any).status] || 0) + 1; });
      return c;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("product_reviews")
        .update({ status, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["admin-review-counts"] });
      toast.success("স্ট্যাটাস আপডেট হয়েছে");
    },
    onError: () => toast.error("আপডেট ব্যর্থ হয়েছে"),
  });

  const approveWithCredit = useMutation({
    mutationFn: async ({ review }: { review: any; amount: number }) => {
      const { error } = await supabase
        .from("product_reviews")
        .update({ status: "approved", updated_at: new Date().toISOString() } as any)
        .eq("id", review.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["admin-review-counts"] });
      setApproveDialog(null);
      setCreditAmount("3");
      toast.success("রিভিউ অ্যাপ্রুভ হয়েছে ✅");
    },
    onError: (e: any) => toast.error(e?.message || "অ্যাপ্রুভ ব্যর্থ হয়েছে"),
  });

  const pendingCount = counts?.pending || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <MessageSquare className="w-5 h-5" /> কাস্টমার রিভিউ
          {pendingCount > 0 && (
            <Badge variant="destructive" className="text-xs">{pendingCount} পেন্ডিং</Badge>
          )}
        </h1>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map(opt => {
          const count = opt.value === "all"
            ? Object.values(counts || {}).reduce((a, b) => a + b, 0)
            : counts?.[opt.value] || 0;
          return (
            <Button
              key={opt.value}
              variant={statusFilter === opt.value ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(opt.value)}
              className="gap-1.5"
            >
              <opt.icon className="w-3.5 h-3.5" />
              {opt.label}
              <Badge variant="secondary" className="h-4 min-w-[16px] px-1 text-[10px]">{count}</Badge>
            </Button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !reviews?.length ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">কোনো রিভিউ নেই</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {reviews.map((review: any) => (
            <ReviewCard
              key={review.id}
              review={review}
              onApprove={() => {
                const suggested = suggestCredit(review.rating, review.comment);
                setApproveDialog({ review });
                setCreditAmount(String(suggested));
              }}
              onStatusChange={(status) => updateStatus.mutate({ id: review.id, status })}
              onEdit={() => setEditDialog({ review })}
              onPublish={() => {}}
              isPending={updateStatus.isPending}
            />
          ))}
        </div>
      )}

      {/* Approve + Credit Dialog */}
      <Dialog open={!!approveDialog} onOpenChange={(open) => !open && setApproveDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Gift className="w-4 h-4 text-green-600" /> রিভিউ অ্যাপ্রুভ ও ক্রেডিট
            </DialogTitle>
          </DialogHeader>

          {approveDialog && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                <p><strong>{approveDialog.review.customer?.name || "কাস্টমার"}</strong> — {approveDialog.review.product?.name || "পণ্য"}</p>
                <div className="flex items-center gap-0.5 mt-1">
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} className={`w-3.5 h-3.5 ${i <= approveDialog.review.rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`} />
                  ))}
                </div>
                {approveDialog.review.comment && (
                  <p className="mt-1 text-xs italic line-clamp-2">"{approveDialog.review.comment}"</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-foreground">ক্রেডিট পরিমাণ (৳)</label>
                <Input
                  type="number"
                  min={0}
                  max={999}
                  step={0.5}
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  className="mt-1"
                  placeholder="০.০১ - ৯৯৯"
                />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[10px] text-muted-foreground">সর্বনিম্ন ৳০.০১ • সর্বোচ্চ ৳৯৯৯ • ০ = ক্রেডিট ছাড়া</p>
                  <button
                    type="button"
                    className="text-[10px] text-primary hover:underline"
                    onClick={() => {
                      if (approveDialog) {
                        setCreditAmount(String(suggestCredit(approveDialog.review.rating, approveDialog.review.comment)));
                      }
                    }}
                  >
                    সাজেস্ট: ৳{approveDialog ? suggestCredit(approveDialog.review.rating, approveDialog.review.comment) : 0}
                  </button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setApproveDialog(null)}>বাতিল</Button>
            <Button
              size="sm"
              className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
              disabled={approveWithCredit.isPending}
              onClick={() => {
                if (!approveDialog) return;
                const amt = parseFloat(creditAmount) || 0;
                if (amt > 999) { toast.error("সর্বোচ্চ ৯৯৯ টাকা দেওয়া যাবে"); return; }
                if (amt > 0 && amt < 0.01) { toast.error("সর্বনিম্ন ০.০১ টাকা"); return; }
                approveWithCredit.mutate({ review: approveDialog.review, amount: amt });
              }}
            >
              {approveWithCredit.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
              অ্যাপ্রুভ{parseFloat(creditAmount) > 0 ? ` ও ৳${creditAmount} দাও` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Review Dialog */}
      {editDialog && (
        <EditReviewDialog
          review={editDialog.review}
          open={!!editDialog}
          onClose={() => setEditDialog(null)}
          onSaved={() => {
            setEditDialog(null);
            queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
          }}
        />
      )}

      {/* Social publish removed */}
    </div>
  );
}

/* ─── Review Card ─── */
function ReviewCard({ review, onApprove, onStatusChange, onEdit, onPublish, isPending }: {
  review: any;
  onApprove: () => void;
  onStatusChange: (status: string) => void;
  onEdit: () => void;
  onPublish: () => void;
  isPending: boolean;
}) {
  const mediaUrls: string[] = review.media_urls || [];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {review.product?.product_image ? (
            <img src={review.product.product_image} alt="" className="w-14 h-14 rounded-lg object-cover border border-border shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-muted shrink-0" />
          )}

          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground truncate">
                  {review.product?.name || "অজানা পণ্য"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  SKU: {review.product?.sku || "—"}
                </p>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusBadgeVariant[review.status] || statusBadgeVariant.pending}`}>
                {STATUS_OPTIONS.find(s => s.value === review.status)?.label || review.status}
              </span>
            </div>

            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} className={`w-3.5 h-3.5 ${i <= review.rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`} />
              ))}
            </div>

            {review.comment && (
              <p className="text-sm text-foreground/80 leading-relaxed">{review.comment}</p>
            )}

            {/* Media preview */}
            {mediaUrls.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {mediaUrls.map((url, idx) => (
                  <div key={idx} className="relative group">
                    {isVideoUrl(url) ? (
                      <div
                        className="w-16 h-16 rounded-lg bg-muted border border-border flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => window.open(url, "_blank")}
                      >
                        <Video className="w-6 h-6 text-muted-foreground" />
                      </div>
                    ) : (
                      <img
                        src={url}
                        alt={`রিভিউ মিডিয়া ${idx + 1}`}
                        className="w-16 h-16 rounded-lg object-cover border border-border cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => window.open(url, "_blank")}
                      />
                    )}
                    <button
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-background border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
                      onClick={(e) => { e.stopPropagation(); downloadFile(url, `review-media-${idx + 1}`); }}
                      title="ডাউনলোড"
                    >
                      <Download className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
              <span>{review.customer?.name || "অজানা"} • {review.customer?.phone || "—"}</span>
              <span>{format(new Date(review.created_at), "dd MMM yyyy, hh:mm a", { locale: bn })}</span>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-2">
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                onClick={onEdit}
              >
                <Pencil className="w-3 h-3" /> সম্পাদনা
              </Button>
              {review.status !== "approved" && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-900/20"
                  onClick={onApprove}
                  disabled={isPending}
                >
                  <Gift className="w-3 h-3" /> অ্যাপ্রুভ ও ক্রেডিট
                </Button>
              )}
              {review.status !== "hold" && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-blue-600 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  onClick={() => onStatusChange("hold")}
                  disabled={isPending}
                >
                  <PauseCircle className="w-3 h-3" /> হোল্ড
                </Button>
              )}
              {review.status !== "rejected" && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20"
                  onClick={() => onStatusChange("rejected")}
                  disabled={isPending}
                >
                  <XCircle className="w-3 h-3" /> রিজেক্ট
                </Button>
              )}
              {review.status !== "pending" && (
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"
                  onClick={() => onStatusChange("pending")}
                  disabled={isPending}
                >
                  <Clock className="w-3 h-3" /> পেন্ডিং
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Edit Review Dialog ─── */
function EditReviewDialog({ review, open, onClose, onSaved }: {
  review: any;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [comment, setComment] = useState(review.comment || "");
  const [mediaUrls, setMediaUrls] = useState<string[]>(review.media_urls || []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploading(true);
    const newUrls: string[] = [];

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} খুব বড় (সর্বোচ্চ 10MB)`);
        continue;
      }

      let fileToUpload = file;
      const isImage = file.type.startsWith("image/");

      if (isImage) {
        try {
          fileToUpload = await compressImageToWebP(file, { maxWidth: 1200, quality: 0.85 });
          fileToUpload = await addWatermarkToImage(fileToUpload);
        } catch { /* use original */ }
      }

      const ext = fileToUpload.name.split(".").pop() || (file.type.startsWith("video/") ? "mp4" : "webp");
      const path = `reviews/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error } = await supabase.storage.from("chat-images").upload(path, fileToUpload, {
        cacheControl: "31536000",
        upsert: false,
      });

      if (error) {
        console.error("Upload error:", error);
        toast.error(`${file.name} আপলোড ব্যর্থ`);
        continue;
      }

      const { data: publicUrl } = supabase.storage.from("chat-images").getPublicUrl(path);
      newUrls.push(publicUrl.publicUrl);
    }

    if (newUrls.length) {
      setMediaUrls(prev => [...prev, ...newUrls]);
      toast.success(`${newUrls.length}টি ফাইল যোগ হয়েছে`);
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeMedia = (index: number) => {
    setMediaUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("product_reviews")
      .update({
        comment: comment.trim() || null,
        media_urls: mediaUrls,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", review.id);

    if (error) {
      toast.error("সেভ করা যায়নি");
    } else {
      toast.success("রিভিউ আপডেট হয়েছে ✅");
      onSaved();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Pencil className="w-4 h-4" /> রিভিউ সম্পাদনা
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product info */}
          <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-2.5">
            {review.product?.product_image && (
              <img src={review.product.product_image} alt="" className="w-10 h-10 rounded-lg object-cover border border-border" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{review.product?.name || "পণ্য"}</p>
              <p className="text-[11px] text-muted-foreground">{review.customer?.name || "কাস্টমার"} • {review.customer?.phone || ""}</p>
            </div>
            <div className="ml-auto flex items-center gap-0.5 shrink-0">
              {[1,2,3,4,5].map(i => (
                <Star key={i} className={`w-3.5 h-3.5 ${i <= review.rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`} />
              ))}
            </div>
          </div>

          {/* Comment edit */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">কমেন্ট</label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="কাস্টমারের মন্তব্য..."
              className="resize-none"
              rows={4}
            />
          </div>

          {/* Media section */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              ছবি / ভিডিও ({mediaUrls.length})
            </label>

            {mediaUrls.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mb-3">
                {mediaUrls.map((url, idx) => (
                  <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-muted">
                    {isVideoUrl(url) ? (
                      <div className="w-full h-full flex items-center justify-center cursor-pointer" onClick={() => window.open(url, "_blank")}>
                        <video src={url} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Video className="w-6 h-6 text-white" />
                        </div>
                      </div>
                    ) : (
                      <img
                        src={url}
                        alt=""
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => window.open(url, "_blank")}
                      />
                    )}
                    {/* Action overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                      <button
                        className="w-7 h-7 rounded-full bg-background/90 flex items-center justify-center hover:bg-background transition-colors"
                        onClick={(e) => { e.stopPropagation(); downloadFile(url, `review-${idx + 1}`); }}
                        title="ডাউনলোড"
                      >
                        <Download className="w-3.5 h-3.5 text-foreground" />
                      </button>
                      <button
                        className="w-7 h-7 rounded-full bg-destructive/90 flex items-center justify-center hover:bg-destructive transition-colors"
                        onClick={(e) => { e.stopPropagation(); removeMedia(idx); }}
                        title="মুছুন"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> আপলোড হচ্ছে...</>
              ) : (
                <><Plus className="w-4 h-4" /> নতুন ছবি/ভিডিও যোগ করুন</>
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleAddMedia}
              className="hidden"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>বাতিল</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
            সেভ করুন
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


