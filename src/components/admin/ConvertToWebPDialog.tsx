import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Image as ImageIcon, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { generateWebPFileName } from "@/lib/imageCompressor";

interface ConvertToWebPDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProductRow {
  id: string;
  name: string;
  product_image: string | null;
  image_gallery: string[] | null;
}

interface JobItem {
  productId: string;
  productName: string;
  field: "product_image" | "image_gallery";
  galleryIndex?: number;
  url: string;
  status: "pending" | "processing" | "done" | "error";
  errorMessage?: string;
  newUrl?: string;
}

const NON_WEBP_REGEX = /\.(jpg|jpeg|png|gif|bmp)(\?|$)/i;

/**
 * Fetch an external image and convert to a WebP File using Canvas.
 * Note: Uses crossOrigin="anonymous"; if remote does not allow CORS, conversion fails.
 */
async function urlToWebPFile(url: string, baseName: string): Promise<File> {
  // Try fetching as blob first (works if CORS allows)
  let blob: Blob;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    blob = await res.blob();
  } catch {
    // Fallback: use Image with crossOrigin
    blob = await new Promise<Blob>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas context unavailable"));
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/webp", 0.85);
      };
      img.onerror = () => reject(new Error("Image load failed (CORS?)"));
      img.src = url;
    });
  }

  // If blob is not webp, convert via canvas
  if (blob.type === "image/webp") {
    return new File([blob], `${baseName}.webp`, { type: "image/webp" });
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

  const webpBlob = await new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      // Cap dimensions to keep file size reasonable
      const maxDim = 1600;
      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > maxDim || h > maxDim) {
        const r = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * r);
        h = Math.round(h * r);
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context unavailable"));
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("WebP encode failed"))), "image/webp", 0.85);
    };
    img.onerror = () => reject(new Error("Image decode failed"));
    img.src = dataUrl;
  });

  return new File([webpBlob], `${baseName}.webp`, { type: "image/webp" });
}

export function ConvertToWebPDialog({ open, onOpenChange }: ConvertToWebPDialogProps) {
  const [scanning, setScanning] = useState(false);
  const [running, setRunning] = useState(false);
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [doneCount, setDoneCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  const scan = useCallback(async () => {
    setScanning(true);
    setJobs([]);
    setDoneCount(0);
    setErrorCount(0);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, product_image, image_gallery");
      if (error) throw error;

      const items: JobItem[] = [];
      (data as ProductRow[] | null)?.forEach((p) => {
        if (p.product_image && NON_WEBP_REGEX.test(p.product_image)) {
          items.push({
            productId: p.id,
            productName: p.name,
            field: "product_image",
            url: p.product_image,
            status: "pending",
          });
        }
        (p.image_gallery || []).forEach((g, idx) => {
          if (g && NON_WEBP_REGEX.test(g)) {
            items.push({
              productId: p.id,
              productName: p.name,
              field: "image_gallery",
              galleryIndex: idx,
              url: g,
              status: "pending",
            });
          }
        });
      });

      setJobs(items);
      toast.success(`${items.length}টি non-WebP ইমেজ পাওয়া গেছে`);
    } catch (e: any) {
      toast.error("স্ক্যান ব্যর্থ: " + e.message);
    } finally {
      setScanning(false);
    }
  }, []);

  const runAll = useCallback(async () => {
    if (jobs.length === 0) return;
    setRunning(true);

    // Group by productId so we can update gallery in one go
    const galleryUpdates = new Map<string, string[]>();

    for (let i = 0; i < jobs.length; i++) {
      // mark processing
      setJobs((prev) => prev.map((j, idx) => (idx === i ? { ...j, status: "processing" } : j)));
      const job = jobs[i];

      try {
        const fileName = generateWebPFileName(undefined, job.productName);
        const webpFile = await urlToWebPFile(job.url, fileName.replace(/\.webp$/, ""));

        const { error: upErr } = await supabase.storage
          .from("product-images")
          .upload(fileName, webpFile, { contentType: "image/webp", upsert: false });
        if (upErr) throw upErr;

        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
        const newUrl = urlData.publicUrl;

        if (job.field === "product_image") {
          const { error: updErr } = await supabase
            .from("products")
            .update({ product_image: newUrl, updated_at: new Date().toISOString() })
            .eq("id", job.productId);
          if (updErr) throw updErr;
        } else {
          // gallery — fetch current, replace at index, update
          let current = galleryUpdates.get(job.productId);
          if (!current) {
            const { data: prod } = await supabase
              .from("products")
              .select("image_gallery")
              .eq("id", job.productId)
              .single();
            current = [...((prod?.image_gallery as string[]) || [])];
          }
          if (typeof job.galleryIndex === "number") {
            current[job.galleryIndex] = newUrl;
          }
          galleryUpdates.set(job.productId, current);

          const { error: updErr } = await supabase
            .from("products")
            .update({ image_gallery: current, updated_at: new Date().toISOString() })
            .eq("id", job.productId);
          if (updErr) throw updErr;
        }

        setJobs((prev) =>
          prev.map((j, idx) => (idx === i ? { ...j, status: "done", newUrl } : j))
        );
        setDoneCount((c) => c + 1);
      } catch (e: any) {
        setJobs((prev) =>
          prev.map((j, idx) =>
            idx === i ? { ...j, status: "error", errorMessage: e.message || "Unknown error" } : j
          )
        );
        setErrorCount((c) => c + 1);
      }
    }

    setRunning(false);
    toast.success("কনভার্সন সম্পন্ন");
  }, [jobs]);

  const total = jobs.length;
  const completed = doneCount + errorCount;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" /> JPG/PNG → WebP কনভার্ট করুন
          </DialogTitle>
          <DialogDescription>
            সব প্রোডাক্টের non-WebP ইমেজ স্ক্যান করে WebP ফরম্যাটে কনভার্ট করে storage এ আপলোড ও DB আপডেট করবে।
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-3 min-h-0">
          {jobs.length === 0 && !scanning && (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <ImageIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                শুরু করতে স্ক্যান করুন
              </p>
              <Button onClick={scan} disabled={scanning}>
                {scanning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                স্ক্যান শুরু করুন
              </Button>
            </div>
          )}

          {scanning && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}

          {jobs.length > 0 && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span>মোট: <strong>{total}</strong></span>
                <span className="text-primary">✓ {doneCount}</span>
                <span className="text-destructive">✗ {errorCount}</span>
                <span>বাকি: {total - completed}</span>
              </div>
              <Progress value={progress} className="h-2" />

              <div className="flex-1 overflow-y-auto border rounded-lg divide-y min-h-0">
                {jobs.map((j, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 text-xs">
                    <div className="w-5 flex-shrink-0">
                      {j.status === "pending" && <span className="text-muted-foreground">·</span>}
                      {j.status === "processing" && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                      {j.status === "done" && <CheckCircle2 className="w-4 h-4 text-primary" />}
                      {j.status === "error" && <AlertCircle className="w-4 h-4 text-destructive" />}
                    </div>
                    <img src={j.url} alt="" className="w-8 h-8 object-cover rounded flex-shrink-0" loading="lazy" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate">{j.productName}</p>
                      <p className="truncate text-muted-foreground">
                        {j.field === "image_gallery" ? `Gallery [${j.galleryIndex}]` : "Main"}
                        {j.errorMessage ? ` — ${j.errorMessage}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          {jobs.length > 0 && !running && completed === 0 && (
            <Button variant="outline" onClick={scan} disabled={scanning}>
              আবার স্ক্যান
            </Button>
          )}
          {jobs.length > 0 && completed < total && (
            <Button onClick={runAll} disabled={running || scanning}>
              {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              কনভার্ট শুরু করুন ({total - completed})
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={running}>
            বন্ধ করুন
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
