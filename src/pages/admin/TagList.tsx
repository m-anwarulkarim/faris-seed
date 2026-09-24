import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, icons } from "lucide-react";

const colorOptions = [
  { value: "gray", label: { bn: "ধূসর", en: "Gray" }, bg: "bg-gray-100", text: "text-gray-600" },
  { value: "red", label: { bn: "লাল", en: "Red" }, bg: "bg-red-100", text: "text-red-600" },
  { value: "orange", label: { bn: "কমলা", en: "Orange" }, bg: "bg-orange-100", text: "text-orange-600" },
  { value: "yellow", label: { bn: "হলুদ", en: "Yellow" }, bg: "bg-yellow-100", text: "text-yellow-700" },
  { value: "green", label: { bn: "সবুজ", en: "Green" }, bg: "bg-green-100", text: "text-green-600" },
  { value: "teal", label: { bn: "টিল", en: "Teal" }, bg: "bg-teal-100", text: "text-teal-600" },
  { value: "blue", label: { bn: "নীল", en: "Blue" }, bg: "bg-blue-100", text: "text-blue-600" },
  { value: "purple", label: { bn: "বেগুনি", en: "Purple" }, bg: "bg-purple-100", text: "text-purple-600" },
  { value: "pink", label: { bn: "গোলাপি", en: "Pink" }, bg: "bg-pink-100", text: "text-pink-600" },
  { value: "amber", label: { bn: "অ্যাম্বার", en: "Amber" }, bg: "bg-amber-100", text: "text-amber-600" },
  { value: "emerald", label: { bn: "এমেরাল্ড", en: "Emerald" }, bg: "bg-emerald-100", text: "text-emerald-600" },
  { value: "lime", label: { bn: "লাইম", en: "Lime" }, bg: "bg-lime-100", text: "text-lime-700" },
  { value: "slate", label: { bn: "স্লেট", en: "Slate" }, bg: "bg-slate-100", text: "text-slate-600" },
];

const iconOptions = [
  "Tag", "Repeat", "Percent", "AlertTriangle", "Crown", "ThumbsUp",
  "AlertCircle", "Import", "Sparkles", "Zap", "FlaskConical", "Leaf",
  "Flower2", "Award", "Home", "Star", "Heart", "Shield", "Flame",
  "Gift", "Truck", "Clock", "CheckCircle", "Package",
];

function getColorClasses(color: string) {
  return colorOptions.find((c) => c.value === color) || colorOptions[0];
}

function LucideIcon({ name, className }: { name: string; className?: string }) {
  const IconComponent = (icons as any)[name];
  if (!IconComponent) {
    const FallbackIcon = (icons as any)["Tag"];
    return <FallbackIcon className={className} />;
  }
  return <IconComponent className={className} />;
}

interface TagFormData {
  name: string;
  description: string;
  icon: string;
  color: string;
}

const emptyForm: TagFormData = { name: "", description: "", icon: "Tag", color: "gray" };

export default function TagList() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TagFormData>(emptyForm);

  const { data: tags, isLoading } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tags").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: TagFormData & { id?: string }) => {
      if (data.id) {
        const { error } = await supabase.from("tags").update({
          name: data.name, description: data.description, icon: data.icon, color: data.color,
        }).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tags").insert({
          name: data.name, description: data.description, icon: data.icon, color: data.color,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      toast.success(editingId ? t("ট্যাগ আপডেট হয়েছে", "Tag updated") : t("ট্যাগ তৈরি হয়েছে", "Tag created"));
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tags").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      toast.success(t("ট্যাগ মুছে ফেলা হয়েছে", "Tag deleted"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (tag: any) => {
    setEditingId(tag.id);
    setForm({ name: tag.name, description: tag.description || "", icon: tag.icon, color: tag.color });
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditingId(null); setForm(emptyForm); };
  const handleSave = () => {
    if (!form.name.trim()) { toast.error(t("ট্যাগের নাম দিন", "Enter tag name")); return; }
    saveMutation.mutate({ ...form, id: editingId || undefined });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> {t("নতুন ট্যাগ", "New Tag")}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tags?.map((tag) => {
            const colors = getColorClasses(tag.color);
            return (
              <div key={tag.id} className="group flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:shadow-md transition-all">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${colors.bg}`}>
                  <LucideIcon name={tag.icon} className={`w-5 h-5 ${colors.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">{tag.name}</h3>
                  {tag.description && <p className="text-xs text-muted-foreground line-clamp-1">{tag.description}</p>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(tag)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
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
                        <AlertDialogTitle>{t("ট্যাগ মুছে ফেলুন?", "Delete tag?")}</AlertDialogTitle>
                        <AlertDialogDescription>
                          "{tag.name}" {t("ট্যাগটি মুছে ফেলা হবে।", "tag will be deleted.")}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("বাতিল", "Cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(tag.id)}>
                          {t("মুছে ফেলুন", "Delete")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? t("ট্যাগ সম্পাদনা", "Edit Tag") : t("নতুন ট্যাগ", "New Tag")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("নাম", "Name")} *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("ট্যাগের নাম", "Tag name")} />
            </div>
            <div>
              <Label>{t("বিবরণ", "Description")}</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t("সংক্ষিপ্ত বিবরণ", "Short description")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("আইকন", "Icon")}</Label>
                <Select value={form.icon} onValueChange={(v) => setForm({ ...form, icon: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {iconOptions.map((icon) => (
                      <SelectItem key={icon} value={icon}>
                        <span className="flex items-center gap-2">
                          <LucideIcon name={icon} className="w-4 h-4" />
                          {icon}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("রঙ", "Color")}</Label>
                <Select value={form.color} onValueChange={(v) => setForm({ ...form, color: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {colorOptions.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        <span className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${c.bg} border`} />
                          {t(c.label.bn, c.label.en)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <Label className="text-xs text-muted-foreground mb-2 block">{t("প্রিভিউ", "Preview")}</Label>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getColorClasses(form.color).bg}`}>
                  <LucideIcon name={form.icon} className={`w-5 h-5 ${getColorClasses(form.color).text}`} />
                </div>
                <div>
                  <p className="font-semibold text-sm">{form.name || t("ট্যাগের নাম", "Tag name")}</p>
                  <p className="text-xs text-muted-foreground">{form.description || t("বিবরণ", "Description")}</p>
                </div>
              </div>
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
