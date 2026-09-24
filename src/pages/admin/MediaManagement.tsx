import { useState, useEffect, useCallback } from "react";

import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileImage, Image, Video, FileText, Search, Trash2,
  ExternalLink, Loader2, FolderOpen, Upload, Copy, Check,
  Users, MessageSquare, ShoppingBag, LayoutGrid, Lock, X,
  ArrowUpDown, CalendarIcon, Download, UploadCloud, Wand2,
  ImageOff,
} from "lucide-react";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { compressImageToWebP, generateWebPFileName } from "@/lib/imageCompressor";
import { ConvertToWebPDialog } from "@/components/admin/ConvertToWebPDialog";
import { BrokenImagesDialog } from "@/components/admin/BrokenImagesDialog";

interface StorageFile {
  name: string;
  id: string;
  created_at: string;
  metadata: { size: number; mimetype: string };
  bucket: string;
  fullPath: string;
  url: string;
  category: "product" | "profile" | "chat" | "category";
}

type FolderTab = "all" | "product" | "profile" | "chat" | "category";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

const FOLDER_CONFIG: { key: FolderTab; icon: any; labelBn: string; labelEn: string; color: string }[] = [
  { key: "all", icon: FolderOpen, labelBn: "সব ফাইল", labelEn: "All Files", color: "text-foreground" },
  { key: "product", icon: ShoppingBag, labelBn: "প্রোডাক্ট ফটো", labelEn: "Product Photos", color: "text-blue-500" },
  { key: "profile", icon: Users, labelBn: "প্রোফাইল ফটো", labelEn: "Profile Photos", color: "text-emerald-500" },
  { key: "chat", icon: MessageSquare, labelBn: "চ্যাট ফাইল", labelEn: "Chat Files", color: "text-purple-500" },
  { key: "category", icon: LayoutGrid, labelBn: "ক্যাটাগরি ফটো", labelEn: "Category Photos", color: "text-orange-500" },
];

export default function MediaManagement() {
  const { t } = useLanguage();
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFolder, setActiveFolder] = useState<FolderTab>("all");
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>("date-desc");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [brokenDialogOpen, setBrokenDialogOpen] = useState(false);

  // Selection & delete state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<"single" | "bulk" | null>(null);
  const [singleDeleteFile, setSingleDeleteFile] = useState<StorageFile | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteVerifying, setDeleteVerifying] = useState(false);

  const [profileUrls, setProfileUrls] = useState<Set<string>>(new Set());
  const [categoryUrls, setCategoryUrls] = useState<Set<string>>(new Set());

  const fetchReferences = useCallback(async () => {
    const { data: profiles } = await supabase
      .from("visitor_profiles")
      .select("profile_picture, cover_photo");
    const pUrls = new Set<string>();
    (profiles || []).forEach((p) => {
      if (p.profile_picture) pUrls.add(p.profile_picture);
      if (p.cover_photo) pUrls.add(p.cover_photo);
    });
    setProfileUrls(pUrls);

    const { data: cats } = await supabase.from("categories").select("image");
    const cUrls = new Set<string>();
    (cats || []).forEach((c) => { if (c.image) cUrls.add(c.image); });
    setCategoryUrls(cUrls);
  }, []);

  const categorizeFile = useCallback((url: string, bucket: string): StorageFile["category"] => {
    if (bucket === "chat-images") return "chat";
    if (profileUrls.has(url)) return "profile";
    if (categoryUrls.has(url)) return "category";
    return "product";
  }, [profileUrls, categoryUrls]);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const allFiles: StorageFile[] = [];

      const { data: productFiles } = await supabase.storage
        .from("product-images")
        .list("", { limit: 500, sortBy: { column: "created_at", order: "desc" } });

      (productFiles || [])
        .filter((f) => f.name && !f.name.startsWith("."))
        .forEach((f) => {
          const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(f.name);
          const url = urlData.publicUrl;
          allFiles.push({
            name: f.name, id: f.id || f.name, created_at: f.created_at || "",
            metadata: { size: (f.metadata as any)?.size || 0, mimetype: (f.metadata as any)?.mimetype || "application/octet-stream" },
            bucket: "product-images", fullPath: `product-images/${f.name}`, url,
            category: categorizeFile(url, "product-images"),
          });
        });

      const { data: chatFiles } = await supabase.storage
        .from("chat-images")
        .list("", { limit: 500, sortBy: { column: "created_at", order: "desc" } });

      (chatFiles || [])
        .filter((f) => f.name && !f.name.startsWith("."))
        .forEach((f) => {
          const { data: urlData } = supabase.storage.from("chat-images").getPublicUrl(f.name);
          allFiles.push({
            name: f.name, id: f.id || f.name, created_at: f.created_at || "",
            metadata: { size: (f.metadata as any)?.size || 0, mimetype: (f.metadata as any)?.mimetype || "application/octet-stream" },
            bucket: "chat-images", fullPath: `chat-images/${f.name}`, url: urlData.publicUrl,
            category: "chat",
          });
        });

      setFiles(allFiles);
    } catch (err) {
      console.error("Error fetching files:", err);
    }
    setLoading(false);
  }, [categorizeFile]);

  useEffect(() => { fetchReferences(); }, [fetchReferences]);
  useEffect(() => {
    if (profileUrls.size > 0 || categoryUrls.size > 0) fetchFiles();
    else {
      const timer = setTimeout(() => fetchFiles(), 300);
      return () => clearTimeout(timer);
    }
  }, [profileUrls, categoryUrls, fetchFiles]);

  // Unique key for a file
  const fileKey = (f: StorageFile) => `${f.bucket}::${f.name}`;

  const toggleSelect = (f: StorageFile) => {
    const key = fileKey(f);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    const allKeys = filteredFiles.map(fileKey);
    setSelected(new Set(allKeys));
  };

  const deselectAll = () => setSelected(new Set());

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  // Verify password and delete
  const verifyAndDelete = async () => {
    if (!deletePassword) return;
    setDeleteVerifying(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        toast.error(t("অ্যাডমিন ভেরিফিকেশন ব্যর্থ", "Admin verification failed"));
        setDeleteVerifying(false);
        return;
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: deletePassword,
      });

      if (authError) {
        toast.error(t("ভুল পাসওয়ার্ড!", "Wrong password!"));
        setDeleteVerifying(false);
        return;
      }

      if (deleteTarget === "single" && singleDeleteFile) {
        const { error } = await supabase.storage
          .from(singleDeleteFile.bucket)
          .remove([singleDeleteFile.name]);
        if (error) toast.error(error.message);
        else toast.success(t("ফাইল ডিলিট হয়েছে", "File deleted"));
      } else if (deleteTarget === "bulk") {
        // Group selected files by bucket
        const byBucket: Record<string, string[]> = {};
        files.forEach((f) => {
          if (selected.has(fileKey(f))) {
            if (!byBucket[f.bucket]) byBucket[f.bucket] = [];
            byBucket[f.bucket].push(f.name);
          }
        });

        let totalDeleted = 0;
        for (const [bucket, names] of Object.entries(byBucket)) {
          const { error } = await supabase.storage.from(bucket).remove(names);
          if (error) toast.error(`${bucket}: ${error.message}`);
          else totalDeleted += names.length;
        }

        if (totalDeleted > 0) {
          toast.success(`${totalDeleted}টি ফাইল ডিলিট হয়েছে`);
        }
        exitSelectMode();
      }

      fetchFiles();
    } catch (err) {
      toast.error(t("ডিলিট ব্যর্থ হয়েছে", "Delete failed"));
    }

    setDeleteTarget(null);
    setSingleDeleteFile(null);
    setDeletePassword("");
    setDeleteVerifying(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    let count = 0;
    for (const file of Array.from(fileList)) {
      let fileToUpload = file;
      // Compress images to WebP then add watermark
      if (file.type.startsWith("image/")) {
        fileToUpload = await compressImageToWebP(file);
        const { addWatermarkToImage } = await import("@/lib/watermark");
        fileToUpload = await addWatermarkToImage(fileToUpload);
      }
      const fileName = fileToUpload.type === "image/webp"
        ? generateWebPFileName(file.name)
        : `${Date.now()}-${Math.random().toString(36).substring(7)}.${file.name.split(".").pop()}`;
      const { error } = await supabase.storage.from("product-images").upload(fileName, fileToUpload);
      if (error) toast.error(`আপলোড ব্যর্থ: ${file.name}`);
      else count++;
    }
    setUploading(false);
    if (count > 0) {
      toast.success(`${count}টি ফাইল আপলোড হয়েছে`);
      fetchFiles();
    }
    e.target.value = "";
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopySuccess(url);
    toast.success(t("URL কপি হয়েছে", "URL copied"));
    setTimeout(() => setCopySuccess(null), 2000);
  };

  const filteredFiles = files
    .filter((f) => {
      const matchesSearch = f.name.toLowerCase().includes(search.toLowerCase());
      const matchesFolder = activeFolder === "all" || f.category === activeFolder;
      
      // Date filter
      let matchesDate = true;
      if (dateFrom && f.created_at) {
        matchesDate = matchesDate && isAfter(new Date(f.created_at), startOfDay(dateFrom));
      }
      if (dateTo && f.created_at) {
        matchesDate = matchesDate && isBefore(new Date(f.created_at), endOfDay(dateTo));
      }
      
      return matchesSearch && matchesFolder && matchesDate;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "size-asc": return a.metadata.size - b.metadata.size;
        case "size-desc": return b.metadata.size - a.metadata.size;
        case "name-asc": return a.name.localeCompare(b.name);
        case "name-desc": return b.name.localeCompare(a.name);
        case "date-asc": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "date-desc":
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  const counts = {
    all: files.length,
    product: files.filter((f) => f.category === "product").length,
    profile: files.filter((f) => f.category === "profile").length,
    chat: files.filter((f) => f.category === "chat").length,
    category: files.filter((f) => f.category === "category").length,
  };

  const sizes: Record<FolderTab, number> = {
    all: files.reduce((s, f) => s + (f.metadata?.size || 0), 0),
    product: files.filter((f) => f.category === "product").reduce((s, f) => s + (f.metadata?.size || 0), 0),
    profile: files.filter((f) => f.category === "profile").reduce((s, f) => s + (f.metadata?.size || 0), 0),
    chat: files.filter((f) => f.category === "chat").reduce((s, f) => s + (f.metadata?.size || 0), 0),
    category: files.filter((f) => f.category === "category").reduce((s, f) => s + (f.metadata?.size || 0), 0),
  };

  const deleteDialogOpen = deleteTarget !== null;
  const deleteCount = deleteTarget === "bulk" ? selected.size : 1;
  const deleteFileName = deleteTarget === "single" ? singleDeleteFile?.name : null;

  const handleDownloadAll = async () => {
    const targetFiles = activeFolder === "all" ? files : files.filter(f => f.category === activeFolder);
    if (!targetFiles.length) { toast.info(t("কোনো ফাইল নেই", "No files")); return; }
    setDownloading(true);
    toast.info(t(`${targetFiles.length}টি ফাইল ডাউনলোড শুরু হচ্ছে...`, `Downloading ${targetFiles.length} files...`));
    
    let count = 0;
    for (const f of targetFiles) {
      try {
        const res = await fetch(f.url);
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = f.name;
        a.click();
        URL.revokeObjectURL(a.href);
        count++;
        // Small delay to prevent browser blocking
        await new Promise(r => setTimeout(r, 200));
      } catch { /* skip failed */ }
    }
    setDownloading(false);
    toast.success(t(`${count}টি ফাইল ডাউনলোড হয়েছে`, `${count} files downloaded`));
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    let count = 0;
    for (const file of Array.from(fileList)) {
      let fileToUpload = file;
      if (file.type.startsWith("image/")) {
        fileToUpload = await compressImageToWebP(file);
        const { addWatermarkToImage } = await import("@/lib/watermark");
        fileToUpload = await addWatermarkToImage(fileToUpload);
      }
      const fileName = fileToUpload.type === "image/webp"
        ? generateWebPFileName(file.name)
        : `${Date.now()}-${Math.random().toString(36).substring(7)}.${file.name.split(".").pop()}`;
      const { error } = await supabase.storage.from("product-images").upload(fileName, fileToUpload);
      if (error) console.error(`Upload failed: ${file.name}`);
      else count++;
    }
    setUploading(false);
    if (count > 0) {
      toast.success(t(`${count}টি ফাইল আপলোড হয়েছে`, `${count} files uploaded`));
      fetchFiles();
    }
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      {/* Header with Download All & Upload All */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {!selectMode ? (
            <>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSelectMode(true)}>
                <Check className="w-4 h-4" /> {t("সিলেক্ট", "Select")}
              </Button>
              <label>
                <Button className="gap-2" size="sm" disabled={uploading} asChild>
                  <span>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {t("আপলোড", "Upload")}
                  </span>
                </Button>
                <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleUpload} />
              </label>
            </>
          ) : (
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={exitSelectMode}>
              <X className="w-4 h-4" /> {t("বাতিল", "Cancel")}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-1.5" 
            onClick={handleDownloadAll}
            disabled={downloading || files.length === 0}
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {t("সব ডাউনলোড", "Download All")}
            {activeFolder !== "all" && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">
                {counts[activeFolder]}
              </Badge>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setConvertDialogOpen(true)}
          >
            <Wand2 className="w-4 h-4" />
            {t("WebP কনভার্ট", "Convert to WebP")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={() => setBrokenDialogOpen(true)}
          >
            <ImageOff className="w-4 h-4" />
            {t("Broken ইমেজ চেক", "Check Broken Images")}
          </Button>
          <label>
            <Button variant="outline" size="sm" className="gap-1.5" disabled={uploading} asChild>
              <span>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                {t("বাল্ক আপলোড", "Bulk Upload")}
              </span>
            </Button>
            <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleBulkUpload} />
          </label>
        </div>
      </div>

      <ConvertToWebPDialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen} />
      <BrokenImagesDialog open={brokenDialogOpen} onOpenChange={setBrokenDialogOpen} />

      {/* Bulk action bar */}
      {selectMode && (
        <div className="flex items-center justify-between bg-muted/50 border rounded-lg px-4 py-2.5">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={selected.size === filteredFiles.length ? deselectAll : selectAll}>
              {selected.size === filteredFiles.length
                ? t("সব বাদ দিন", "Deselect all")
                : t("সব সিলেক্ট", "Select all")}
            </Button>
            <span className="text-sm text-muted-foreground">
              {selected.size > 0
                ? `${selected.size}টি সিলেক্টেড`
                : t("ফাইল সিলেক্ট করুন", "Select files")}
            </span>
          </div>
          {selected.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() => setDeleteTarget("bulk")}
            >
              <Trash2 className="w-4 h-4" />
              {t(`${selected.size}টি ডিলিট`, `Delete ${selected.size}`)}
            </Button>
          )}
        </div>
      )}

      {/* Folder Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {FOLDER_CONFIG.map((folder) => {
          const Icon = folder.icon;
          const isActive = activeFolder === folder.key;
          return (
            <button
              key={folder.key}
              onClick={() => setActiveFolder(folder.key)}
              className={`rounded-xl border-2 p-4 text-center transition-all ${
                isActive
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card hover:border-primary/30"
              }`}
            >
              <Icon className={`w-6 h-6 mx-auto mb-2 ${folder.color}`} />
              <p className="text-xs font-medium text-foreground">
                {t(folder.labelBn, folder.labelEn)}
              </p>
              <p className="text-lg font-bold text-foreground mt-1">
                {counts[folder.key]}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {formatBytes(sizes[folder.key])}
              </p>
            </button>
          );
        })}
      </div>

      {/* Search, Sort & Date Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("ফাইল খুঁজুন...", "Search files...")}
            className="pl-9"
          />
        </div>

        {/* Sort */}
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-[180px] gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date-desc">{t("নতুন আগে", "Newest first")}</SelectItem>
            <SelectItem value="date-asc">{t("পুরনো আগে", "Oldest first")}</SelectItem>
            <SelectItem value="size-desc">{t("বড় আগে", "Largest first")}</SelectItem>
            <SelectItem value="size-asc">{t("ছোট আগে", "Smallest first")}</SelectItem>
            <SelectItem value="name-asc">{t("নাম A-Z", "Name A-Z")}</SelectItem>
            <SelectItem value="name-desc">{t("নাম Z-A", "Name Z-A")}</SelectItem>
          </SelectContent>
        </Select>

        {/* Date From */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-full sm:w-[150px] justify-start text-left font-normal gap-1.5", !dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="w-3.5 h-3.5" />
              {dateFrom ? format(dateFrom, "dd/MM/yyyy") : t("শুরু", "From")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>

        {/* Date To */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-full sm:w-[150px] justify-start text-left font-normal gap-1.5", !dateTo && "text-muted-foreground")}>
              <CalendarIcon className="w-3.5 h-3.5" />
              {dateTo ? format(dateTo, "dd/MM/yyyy") : t("শেষ", "To")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>

        {/* Clear date filter */}
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="icon" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }} title={t("ফিল্টার মুছুন", "Clear filter")}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* File Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredFiles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileImage className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? t("কোনো ফাইল পাওয়া যায়নি", "No files found") : t("কোনো ফাইল নেই", "No files yet")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filteredFiles.map((file) => {
            const isImage = file.metadata.mimetype?.startsWith("image/");
            const isVideo = file.metadata.mimetype?.startsWith("video/");
            const folderInfo = FOLDER_CONFIG.find((f) => f.key === file.category);
            const key = fileKey(file);
            const isSelected = selected.has(key);

            return (
              <Card
                key={key}
                className={`overflow-hidden transition-shadow group relative ${
                  isSelected ? "ring-2 ring-primary shadow-md" : "hover:shadow-md"
                }`}
                onClick={selectMode ? () => toggleSelect(file) : undefined}
              >
                {/* Checkbox in select mode */}
                {selectMode && (
                  <div className="absolute top-2 left-2 z-10">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(file)}
                      className="h-5 w-5 bg-background/80 backdrop-blur-sm border-2"
                    />
                  </div>
                )}

                <div className="aspect-square bg-muted/50 flex items-center justify-center overflow-hidden relative">
                  {isImage ? (
                    <img src={file.url} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : isVideo ? (
                    <Video className="w-10 h-10 text-muted-foreground" />
                  ) : (
                    <FileText className="w-10 h-10 text-muted-foreground" />
                  )}
                  {/* Overlay - only in non-select mode */}
                  {!selectMode && (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => handleCopyUrl(file.url)}>
                        {copySuccess === file.url ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                      <a href={file.url} target="_blank" rel="noopener noreferrer">
                        <Button size="icon" variant="secondary" className="h-8 w-8">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </a>
                      <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => {
                        setSingleDeleteFile(file);
                        setDeleteTarget("single");
                      }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}

                  {/* Select mode overlay for selected items */}
                  {selectMode && isSelected && (
                    <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
                  )}
                </div>
                <CardContent className="p-2">
                  <p className="text-xs font-medium text-foreground truncate" title={file.name}>{file.name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground">{formatBytes(file.metadata.size)}</span>
                    <Badge variant="outline" className={`text-[9px] h-4 ${folderInfo?.color || ""}`}>
                      {t(folderInfo?.labelBn || file.bucket, folderInfo?.labelEn || file.bucket)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete with Password Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
        if (!open) { setDeleteTarget(null); setSingleDeleteFile(null); setDeletePassword(""); }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-destructive" />
              {t("ডিলিট করতে পাসওয়ার্ড দিন", "Enter password to delete")}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {deleteTarget === "single" && deleteFileName ? (
                  <p>
                    <span className="font-medium text-foreground">{deleteFileName}</span>
                    {" — "}
                    {t("এই ফাইলটি স্থায়ীভাবে মুছে ফেলা হবে।", "This file will be permanently deleted.")}
                  </p>
                ) : (
                  <p className="text-destructive font-medium">
                    {`${deleteCount}টি ফাইল স্থায়ীভাবে মুছে ফেলা হবে!`}
                  </p>
                )}
                <Input
                  type="password"
                  placeholder={t("অ্যাডমিন পাসওয়ার্ড", "Admin password")}
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && deletePassword && verifyAndDelete()}
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteVerifying}>{t("বাতিল", "Cancel")}</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={!deletePassword || deleteVerifying}
              onClick={verifyAndDelete}
              className="gap-2"
            >
              {deleteVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {deleteTarget === "bulk"
                ? t(`${deleteCount}টি ডিলিট`, `Delete ${deleteCount}`)
                : t("ডিলিট", "Delete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
