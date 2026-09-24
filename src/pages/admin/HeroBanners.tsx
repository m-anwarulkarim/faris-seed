import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown, Upload } from "lucide-react";

interface Banner {
  id: string;
  image_url: string;
  alt: string;
  position: number;
  is_enabled: boolean;
}

const BUCKET = "product-images";

export default function HeroBanners() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("hero_banners")
      .select("*")
      .order("position");
    if (error) toast.error(error.message);
    setBanners((data as Banner[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (b: Banner) => {
    const { error } = await supabase
      .from("hero_banners")
      .update({
        image_url: b.image_url,
        alt: b.alt,
        position: b.position,
        is_enabled: b.is_enabled,
      })
      .eq("id", b.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  };

  const addNew = async () => {
    const nextPos = (banners[banners.length - 1]?.position ?? 0) + 1;
    const { error } = await supabase
      .from("hero_banners")
      .insert({ image_url: "", alt: "", position: nextPos, is_enabled: true });
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this banner?")) return;
    const { error } = await supabase.from("hero_banners").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const a = banners[idx];
    const b = banners[idx + dir];
    if (!a || !b) return;
    await supabase.from("hero_banners").update({ position: b.position }).eq("id", a.id);
    await supabase.from("hero_banners").update({ position: a.position }).eq("id", b.id);
    load();
  };

  const upload = async (id: string, file: File) => {
    setUploadingId(id);
    try {
      const ext = file.name.split(".").pop();
      const path = `hero-banners/${id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const url = data.publicUrl;
      setBanners((prev) => prev.map((b) => (b.id === id ? { ...b, image_url: url } : b)));
      await supabase.from("hero_banners").update({ image_url: url }).eq("id", id);
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="container max-w-4xl py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hero Banners</h1>
          <p className="text-sm text-muted-foreground">Manage homepage hero carousel slides</p>
        </div>
        <Button onClick={addNew}>
          <Plus className="w-4 h-4 mr-1" /> Add Banner
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map((b, idx) => (
            <Card key={b.id} className="p-4 space-y-3">
              <div className="flex gap-4">
                <div className="w-40 h-24 rounded-lg overflow-hidden bg-muted shrink-0">
                  {b.image_url ? (
                    <img src={b.image_url} alt={b.alt} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                      No image
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div>
                    <Label className="text-xs">Image URL</Label>
                    <div className="flex gap-2">
                      <Input
                        value={b.image_url}
                        onChange={(e) =>
                          setBanners((p) => p.map((x) => (x.id === b.id ? { ...x, image_url: e.target.value } : x)))
                        }
                      />
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && upload(b.id, e.target.files[0])}
                        />
                        <Button asChild variant="outline" size="icon" disabled={uploadingId === b.id}>
                          <span>
                            {uploadingId === b.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Upload className="w-4 h-4" />
                            )}
                          </span>
                        </Button>
                      </label>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Alt text</Label>
                    <Input
                      value={b.alt}
                      onChange={(e) =>
                        setBanners((p) => p.map((x) => (x.id === b.id ? { ...x, alt: e.target.value } : x)))
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={b.is_enabled}
                    onCheckedChange={(v) =>
                      setBanners((p) => p.map((x) => (x.id === b.id ? { ...x, is_enabled: v } : x)))
                    }
                  />
                  <span className="text-sm">{b.is_enabled ? "Visible" : "Hidden"}</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => move(idx, -1)} disabled={idx === 0}>
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => move(idx, 1)}
                    disabled={idx === banners.length - 1}
                  >
                    <ArrowDown className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(b.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                  <Button onClick={() => save(b)}>Save</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
