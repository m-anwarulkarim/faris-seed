import { useState, useEffect, useCallback } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Upload, Search, Link, Image, Loader2, Check, FolderOpen,
} from "lucide-react";
import { compressImageToWebP, generateWebPFileName } from "@/lib/imageCompressor";

interface MediaPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string) => void;
  multiple?: boolean;
  onSelectMultiple?: (urls: string[]) => void;
  /** Title/context string — uploaded filenames will be slugified from this. */
  titleContext?: string;
}

interface MediaFile {
  name: string;
  url: string;
  mimetype: string;
  size: number;
}

export function MediaPickerDialog({
  open,
  onOpenChange,
  onSelect,
  multiple = false,
  onSelectMultiple,
  titleContext,
}: MediaPickerDialogProps) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<string>("media");
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from("product-images")
        .list("", { limit: 500, sortBy: { column: "created_at", order: "desc" } });

      if (error) {
        console.error(error);
        setFiles([]);
        setLoading(false);
        return;
      }

      const mapped: MediaFile[] = (data || [])
        .filter((f) => f.name && !f.name.startsWith("."))
        .filter((f) => (f.metadata as any)?.mimetype?.startsWith("image/"))
        .map((f) => {
          const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(f.name);
          return {
            name: f.name,
            url: urlData.publicUrl,
            mimetype: (f.metadata as any)?.mimetype || "",
            size: (f.metadata as any)?.size || 0,
          };
        });

      setFiles(mapped);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      fetchFiles();
      setSelected([]);
      setLinkUrl("");
    }
  }, [open, fetchFiles]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setUploading(true);
    const uploadedUrls: string[] = [];

    for (let i = 0; i < Array.from(fileList).length; i++) {
      const file = Array.from(fileList)[i];
      // Compress image to WebP
      const compressed = await compressImageToWebP(file);
      const ctx = (titleContext || "").trim();
      const suffix = fileList.length > 1 ? `-${i + 1}` : "";
      const ctxWithSuffix = ctx ? `${ctx}${suffix}` : "";
      const fileName = compressed.type === "image/webp"
        ? generateWebPFileName(file.name, ctxWithSuffix || undefined)
        : `${ctxWithSuffix ? ctxWithSuffix.toLowerCase().replace(/[^\w-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") + "-" : ""}${Date.now()}-${Math.random().toString(36).substring(7)}.${file.name.split(".").pop()}`;

      const { error } = await supabase.storage
        .from("product-images")
        .upload(fileName, compressed);

      if (error) {
        toast.error(`আপলোড ব্যর্থ: ${file.name}`);
        continue;
      }

      const { data } = supabase.storage.from("product-images").getPublicUrl(fileName);
      uploadedUrls.push(data.publicUrl);
    }

    setUploading(false);

    if (uploadedUrls.length > 0) {
      toast.success(`${uploadedUrls.length}টি ফাইল আপলোড হয়েছে`);

      if (multiple && onSelectMultiple) {
        onSelectMultiple(uploadedUrls);
        onOpenChange(false);
      } else if (uploadedUrls.length === 1) {
        onSelect(uploadedUrls[0]);
        onOpenChange(false);
      } else {
        // Refresh the list so they appear
        fetchFiles();
      }
    }

    // Reset file input
    e.target.value = "";
  };

  const handleMediaSelect = (url: string) => {
    if (multiple) {
      setSelected((prev) =>
        prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
      );
    } else {
      onSelect(url);
      onOpenChange(false);
    }
  };

  const handleConfirmMultiple = () => {
    if (onSelectMultiple && selected.length > 0) {
      onSelectMultiple(selected);
      onOpenChange(false);
    }
  };

  const handleLinkSubmit = () => {
    if (!linkUrl.trim()) return;
    onSelect(linkUrl.trim());
    onOpenChange(false);
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("ছবি নির্বাচন করুন", "Select Image")}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload" className="gap-1.5">
              <Upload className="w-3.5 h-3.5" /> {t("আপলোড", "Upload")}
            </TabsTrigger>
            <TabsTrigger value="media" className="gap-1.5">
              <FolderOpen className="w-3.5 h-3.5" /> {t("মিডিয়া", "Media")}
            </TabsTrigger>
            <TabsTrigger value="link" className="gap-1.5">
              <Link className="w-3.5 h-3.5" /> {t("লিংক", "Link")}
            </TabsTrigger>
          </TabsList>

          {/* Upload Tab */}
          <TabsContent value="upload" className="flex-1">
            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border rounded-lg">
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">{t("আপলোড হচ্ছে...", "Uploading...")}</p>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Upload className="w-7 h-7 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">
                      {t("ক্লিক করে ছবি আপলোড করুন", "Click to upload images")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple={multiple}
                    className="hidden"
                    onChange={handleUpload}
                  />
                </label>
              )}
            </div>
          </TabsContent>

          {/* Media Library Tab */}
          <TabsContent value="media" className="flex-1 overflow-hidden flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("ছবি খুঁজুন...", "Search images...")}
                className="pl-9 h-9"
              />
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="text-center py-12">
                  <Image className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {t("কোনো ছবি পাওয়া যায়নি", "No images found")}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {filteredFiles.map((file) => {
                    const isSelected = selected.includes(file.url);
                    return (
                      <button
                        key={file.name}
                        type="button"
                        onClick={() => handleMediaSelect(file.url)}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:opacity-90 ${
                          isSelected
                            ? "border-primary ring-2 ring-primary/30"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <img
                          src={file.url}
                          alt={file.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3 text-primary-foreground" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {multiple && selected.length > 0 && (
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-muted-foreground">
                  {selected.length}টি নির্বাচিত
                </span>
                <Button size="sm" onClick={handleConfirmMultiple}>
                  {t("নিশ্চিত করুন", "Confirm")}
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Link Tab */}
          <TabsContent value="link" className="flex-1">
            <div className="space-y-4 py-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t("বাহ্যিক ছবির URL দিন", "Enter external image URL")}
                </p>
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com/image.webp"
                />
              </div>
              {linkUrl && (
                <div className="w-32 h-32 rounded-lg border overflow-hidden">
                  <img
                    src={linkUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
              <Button onClick={handleLinkSubmit} disabled={!linkUrl.trim()}>
                {t("ব্যবহার করুন", "Use this URL")}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
