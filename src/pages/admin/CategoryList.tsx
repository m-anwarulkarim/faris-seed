import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Package, FolderOpen, X } from "lucide-react";
import { MediaPickerDialog } from "@/components/admin/MediaPickerDialog";

interface CategoryFormData {
  name: string;
  display_name: string;
  slug: string;
  description: string;
  image: string;
  position: number;
}

const emptyForm: CategoryFormData = { name: "", display_name: "", slug: "", description: "", image: "", position: 0 };

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0980-\u09FF\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

export default function CategoryList() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryFormData>(emptyForm);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);

  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("position", { ascending: true }).order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: productCounts } = useQuery({
    queryKey: ["category-product-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("category");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((p: any) => {
        const key = (p.category || "").toString().trim().toLowerCase();
        if (!key) return;
        counts[key] = (counts[key] || 0) + 1;
      });
      return counts;
    },
  });

  const getCount = (cat: any) => {
    const counts = productCounts || {};
    const slug = (cat.slug || "").toString().trim().toLowerCase();
    const name = (cat.name || "").toString().trim().toLowerCase();
    return (counts[slug] || 0) + (slug !== name ? (counts[name] || 0) : 0);
  };

  const saveMutation = useMutation({
    mutationFn: async (data: CategoryFormData & { id?: string }) => {
      const slug = (data.slug || "").trim() || slugify(data.name);
      const payload = {
        name: data.name,
        display_name: data.display_name || null,
        slug: slug || null,
        description: data.description,
        image: data.image || null,
        position: data.position,
      };
      if (data.id) {
        const { error } = await supabase.from("categories").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("categories").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      try {
        localStorage.removeItem("cached-categories-v5");
        Object.keys(localStorage).forEach((k) => {
          if (/^cached-(products|categories|shop|home)/i.test(k)) localStorage.removeItem(k);
        });
      } catch {}
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = String(q.queryKey?.[0] ?? "");
          return /categor|product|shop|home|inventory|tag-products|related|flash|ghost/i.test(k);
        },
      });
      toast.success(editingId ? t("ক্যাটাগরি আপডেট হয়েছে", "Category updated") : t("ক্যাটাগরি তৈরি হয়েছে", "Category created"));
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      try {
        localStorage.removeItem("cached-categories-v5");
        Object.keys(localStorage).forEach((k) => {
          if (/^cached-(products|categories|shop|home)/i.test(k)) localStorage.removeItem(k);
        });
      } catch {}
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = String(q.queryKey?.[0] ?? "");
          return /categor|product|shop|home|inventory|tag-products|related|flash|ghost/i.test(k);
        },
      });
      toast.success(t("ক্যাটাগরি মুছে ফেলা হয়েছে", "Category deleted"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (cat: any) => {
    setEditingId(cat.id);
    setForm({ name: cat.name, display_name: cat.display_name || "", slug: cat.slug || "", description: cat.description || "", image: cat.image || "", position: cat.position || 0 });
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditingId(null); setForm(emptyForm); };
  const handleSave = () => {
    if (!form.name.trim()) { toast.error(t("ক্যাটাগরির নাম দিন", "Enter category name")); return; }
    saveMutation.mutate({ ...form, id: editingId || undefined });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> {t("নতুন ক্যাটাগরি", "New Category")}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories?.map((cat) => (
            <div key={cat.id} className="group flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:shadow-md transition-all">
              {cat.image ? (
                <img src={cat.image} alt={cat.name} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <Package className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold"
                    title={t("পণ্য সংখ্যা", "Product count")}
                  >
                    {getCount(cat)}
                  </span>
                  <h3 className="font-semibold text-foreground text-base">{cat.name}</h3>
                </div>
                {cat.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{cat.description}</p>}
              </div>
              <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(cat)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("ক্যাটাগরি মুছে ফেলুন?", "Delete category?")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        "{cat.name}" {t("ক্যাটাগরিটি মুছে ফেলা হবে।", "category will be deleted.")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("বাতিল", "Cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteMutation.mutate(cat.id)}>
                        {t("মুছে ফেলুন", "Delete")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? t("ক্যাটাগরি সম্পাদনা", "Edit Category") : t("নতুন ক্যাটাগরি", "New Category")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("টাইটেল", "Title")} *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("যেমন: Women Clothing", "e.g. Women Clothing")} />
              <p className="text-xs text-muted-foreground mt-1">
                {t("কাস্টমার সাইটে ঠিক এটাই দেখাবে", "Shown exactly as typed on customer site")}
              </p>
            </div>
            <div>
              <Label>{t("স্ল্যাগ (URL)", "Slug (URL)")}</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
                placeholder={form.name ? slugify(form.name) : "my-category"}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("খালি রাখলে টাইটেল থেকে অটো তৈরি হবে", "Auto-generated from title if left empty")}
              </p>
            </div>
            <div>
              <Label>{t("বিবরণ", "Description")}</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t("সংক্ষিপ্ত বিবরণ", "Short description")} rows={3} />
            </div>
            <div>
              <Label>{t("পজিশন নম্বর", "Position Number")}</Label>
              <Input type="number" value={form.position} onChange={(e) => setForm({ ...form, position: parseInt(e.target.value) || 0 })} placeholder="0" />
            </div>
            <div>
              <Label>{t("ছবি", "Image")}</Label>
              <div className="mt-2 flex items-center gap-3">
                {form.image ? (
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
                    <img src={form.image} alt="Preview" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => setForm({ ...form, image: "" })} className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setImagePickerOpen(true)}
                    className="flex flex-col items-center justify-center w-20 h-20 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors"
                  >
                    <FolderOpen className="w-5 h-5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground mt-1">{t("নির্বাচন", "Select")}</span>
                  </button>
                )}
              </div>
              <MediaPickerDialog
                open={imagePickerOpen}
                onOpenChange={setImagePickerOpen}
                onSelect={(url) => setForm({ ...form, image: url })}
                titleContext={form.name}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>{t("বাতিল", "Cancel")}</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingId ? t("আপডেট", "Update") : t("তৈরি করুন", "Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
