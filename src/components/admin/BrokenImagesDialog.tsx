import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, ExternalLink, ImageOff, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface BrokenImagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProductRow {
  id: string;
  name: string;
  sku: string;
  product_image: string | null;
}

interface CheckResult {
  product: ProductRow;
  status: "checking" | "ok" | "broken" | "error";
  httpStatus?: number;
  errorReason?: string;
}

/**
 * Quick HEAD-check using fetch with no-cors fallback.
 * Returns true if the image loads successfully.
 */
async function checkImageLoads(url: string, timeoutMs = 8000): Promise<{ ok: boolean; reason?: string }> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ ok: false, reason: "Timeout" });
    }, timeoutMs);

    const img = new Image();
    img.onload = () => {
      clearTimeout(timer);
      // Some 404 placeholders return tiny images; flag if smaller than 50px
      if (img.naturalWidth < 50 || img.naturalHeight < 50) {
        resolve({ ok: false, reason: "Tiny/placeholder image" });
      } else {
        resolve({ ok: true });
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve({ ok: false, reason: "Failed to load (404 / DNS / blocked)" });
    };
    img.src = url;
  });
}

export function BrokenImagesDialog({ open, onOpenChange }: BrokenImagesDialogProps) {
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [showOnlyBroken, setShowOnlyBroken] = useState(true);

  const scan = useCallback(async () => {
    setScanning(true);
    setResults([]);
    setProgress(0);

    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, product_image")
        .eq("is_hidden", false)
        .not("product_image", "is", null);

      if (error) throw error;

      const products = (data as ProductRow[] | null) || [];
      const initial: CheckResult[] = products.map((p) => ({ product: p, status: "checking" }));
      setResults(initial);

      // Run checks in parallel batches of 8
      const BATCH = 8;
      for (let i = 0; i < products.length; i += BATCH) {
        const batch = products.slice(i, i + BATCH);
        const batchResults = await Promise.all(
          batch.map(async (p) => {
            const r = await checkImageLoads(p.product_image!);
            return {
              product: p,
              status: r.ok ? ("ok" as const) : ("broken" as const),
              errorReason: r.reason,
            };
          })
        );

        setResults((prev) => {
          const next = [...prev];
          batchResults.forEach((br) => {
            const idx = next.findIndex((x) => x.product.id === br.product.id);
            if (idx >= 0) next[idx] = br;
          });
          return next;
        });
        setProgress(Math.round(((i + batch.length) / products.length) * 100));
      }

      const brokenCount = (await new Promise<number>((res) => {
        setResults((prev) => {
          res(prev.filter((r) => r.status === "broken").length);
          return prev;
        });
      }));

      toast.success(`স্ক্যান সম্পন্ন — ${brokenCount}টি broken image পাওয়া গেছে`);
    } catch (e: any) {
      toast.error("স্ক্যান ব্যর্থ: " + e.message);
    } finally {
      setScanning(false);
    }
  }, []);

  const brokenCount = results.filter((r) => r.status === "broken").length;
  const okCount = results.filter((r) => r.status === "ok").length;
  const checkingCount = results.filter((r) => r.status === "checking").length;
  const total = results.length;

  const visible = showOnlyBroken ? results.filter((r) => r.status === "broken") : results;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageOff className="w-5 h-5 text-destructive" /> Broken ইমেজ স্ক্যানার
          </DialogTitle>
          <DialogDescription>
            সব visible প্রোডাক্টের প্রধান ছবি লোড হচ্ছে কিনা তা চেক করে broken (404, DNS error, missing) ইমেজগুলো দেখাবে।
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-3 min-h-0">
          {results.length === 0 && !scanning && (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <ImageOff className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                সব প্রোডাক্টের ছবি চেক করতে স্ক্যান শুরু করুন
              </p>
              <Button onClick={scan}>
                <RefreshCw className="w-4 h-4 mr-2" />
                স্ক্যান শুরু করুন
              </Button>
            </div>
          )}

          {results.length > 0 && (
            <>
              <div className="flex items-center gap-3 text-sm flex-wrap">
                <span>মোট: <strong>{total}</strong></span>
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="w-3 h-3" /> Broken: {brokenCount}
                </Badge>
                <Badge variant="default" className="gap-1 bg-emerald-500">
                  <CheckCircle2 className="w-3 h-3" /> OK: {okCount}
                </Badge>
                {checkingCount > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> {checkingCount}
                  </Badge>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowOnlyBroken(!showOnlyBroken)}
                  >
                    {showOnlyBroken ? "সব দেখান" : "শুধু broken"}
                  </Button>
                </div>
              </div>

              {scanning && <Progress value={progress} className="h-2" />}

              <div className="flex-1 overflow-y-auto border rounded-lg divide-y min-h-0">
                {visible.length === 0 && !scanning && (
                  <div className="text-center py-12 text-sm text-muted-foreground">
                    {showOnlyBroken ? "🎉 কোনো broken ইমেজ নেই!" : "কোনো ফলাফল নেই"}
                  </div>
                )}
                {visible.map((r) => (
                  <div key={r.product.id} className="flex items-center gap-3 p-2.5 text-xs">
                    <div className="w-5 flex-shrink-0">
                      {r.status === "checking" && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                      {r.status === "ok" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                      {r.status === "broken" && <AlertTriangle className="w-4 h-4 text-destructive" />}
                    </div>

                    {/* Try to render the image — broken ones will show alt */}
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden border">
                      <img
                        src={r.product.product_image || ""}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{r.product.name}</p>
                      <p className="truncate text-muted-foreground">
                        SKU: {r.product.sku}
                        {r.errorReason ? ` — ${r.errorReason}` : ""}
                      </p>
                    </div>

                    <Link
                      to={`/admin/products/${r.product.id}/edit`}
                      target="_blank"
                      className="text-primary hover:underline flex items-center gap-1 flex-shrink-0"
                      onClick={() => onOpenChange(false)}
                    >
                      Edit <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          {results.length > 0 && (
            <Button variant="outline" onClick={scan} disabled={scanning}>
              {scanning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              আবার স্ক্যান
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            বন্ধ করুন
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
