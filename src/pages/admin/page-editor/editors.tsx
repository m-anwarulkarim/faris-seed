import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import type { ImagePickerFieldProps } from "./types";

// ImagePickerField is passed in via prop to avoid circular imports with PageEditor.
type EditorProps = { data: Record<string, any>; onUpdate: (d: Record<string, any>) => void };
type EditorWithPickerProps = EditorProps & { ImagePickerField: React.ComponentType<ImagePickerFieldProps> };

export function FeaturesEditor({ data, onUpdate }: EditorProps) {
  const items: { emoji: string; title: string; desc?: string }[] = data.items || [];
  const setItem = (index: number, key: string, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [key]: value };
    onUpdate({ ...data, items: newItems });
  };

  return (
    <div className="space-y-2">
      <Input value={data.heading || ""} onChange={(e) => onUpdate({ ...data, heading: e.target.value })} placeholder="সেকশন হেডিং" className="h-8 text-xs" />
      {items.map((item, i) => (
        <div key={i} className="flex gap-1.5 items-center">
          <Input className="w-12 h-8 text-xs" value={item.emoji} onChange={(e) => setItem(i, "emoji", e.target.value)} />
          <Input className="flex-1 h-8 text-xs" value={item.title} onChange={(e) => setItem(i, "title", e.target.value)} placeholder="ফিচার" />
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onUpdate({ ...data, items: items.filter((_, idx) => idx !== i) })}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => onUpdate({ ...data, items: [...items, { emoji: "✅", title: "" }] })}>
        <Plus className="w-3 h-3" /> যোগ করুন
      </Button>
    </div>
  );
}

export function TestimonialEditor({ data, onUpdate }: EditorProps) {
  const items: any[] = data.items || [];
  const setItem = (i: number, key: string, val: any) => {
    const n = [...items]; n[i] = { ...n[i], [key]: val }; onUpdate({ ...data, items: n });
  };
  return (
    <div className="space-y-2">
      <Input value={data.heading || ""} onChange={(e) => onUpdate({ ...data, heading: e.target.value })} placeholder="সেকশন হেডিং" className="h-8 text-xs" />
      {items.map((item, i) => (
        <div key={i} className="space-y-1 p-2 bg-muted/50 rounded-lg border border-border">
          <Input value={item.name || ""} onChange={(e) => setItem(i, "name", e.target.value)} placeholder="নাম" className="h-7 text-[10px]" />
          <Input value={item.role || ""} onChange={(e) => setItem(i, "role", e.target.value)} placeholder="পদবি (অপশনাল)" className="h-7 text-[10px]" />
          <Textarea value={item.text || ""} onChange={(e) => setItem(i, "text", e.target.value)} rows={2} placeholder="মতামত" className="text-[10px]" />
          <div className="flex items-center gap-2">
            <label className="text-[9px] text-muted-foreground">রেটিং</label>
            <Select value={String(item.rating || 5)} onValueChange={(v) => setItem(i, "rating", parseInt(v))}>
              <SelectTrigger className="h-6 text-[10px] w-16"><SelectValue /></SelectTrigger>
              <SelectContent>{[1,2,3,4,5].map(r => <SelectItem key={r} value={String(r)}>{r}⭐</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive ml-auto" onClick={() => onUpdate({ ...data, items: items.filter((_, idx) => idx !== i) })}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => onUpdate({ ...data, items: [...items, { name: "", text: "", rating: 5 }] })}>
        <Plus className="w-3 h-3" /> রিভিউ যোগ
      </Button>
    </div>
  );
}

export function FaqEditor({ data, onUpdate }: EditorProps) {
  const items: any[] = data.items || [];
  const setItem = (i: number, key: string, val: string) => {
    const n = [...items]; n[i] = { ...n[i], [key]: val }; onUpdate({ ...data, items: n });
  };
  return (
    <div className="space-y-2">
      <Input value={data.heading || ""} onChange={(e) => onUpdate({ ...data, heading: e.target.value })} placeholder="সেকশন হেডিং" className="h-8 text-xs" />
      {items.map((item, i) => (
        <div key={i} className="space-y-1 p-2 bg-muted/50 rounded-lg border border-border">
          <Input value={item.question || ""} onChange={(e) => setItem(i, "question", e.target.value)} placeholder="প্রশ্ন" className="h-7 text-[10px]" />
          <Textarea value={item.answer || ""} onChange={(e) => setItem(i, "answer", e.target.value)} rows={2} placeholder="উত্তর" className="text-[10px]" />
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onUpdate({ ...data, items: items.filter((_, idx) => idx !== i) })}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => onUpdate({ ...data, items: [...items, { question: "", answer: "" }] })}>
        <Plus className="w-3 h-3" /> প্রশ্ন যোগ
      </Button>
    </div>
  );
}

export function GalleryEditor({ data, onUpdate, ImagePickerField }: EditorWithPickerProps) {
  const images: any[] = data.images || [];
  return (
    <div className="space-y-2">
      <Input value={data.heading || ""} onChange={(e) => onUpdate({ ...data, heading: e.target.value })} placeholder="হেডিং" className="h-8 text-xs" />
      <Select value={String(data.cols || 2)} onValueChange={(v) => onUpdate({ ...data, cols: parseInt(v) })}>
        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="কলাম" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="2">২ কলাম</SelectItem>
          <SelectItem value="3">৩ কলাম</SelectItem>
          <SelectItem value="4">৪ কলাম</SelectItem>
        </SelectContent>
      </Select>
      {images.map((img, i) => (
        <div key={i} className="flex items-center gap-2">
          {img.src && <img src={img.src} className="w-10 h-10 rounded object-cover" alt="" />}
          <ImagePickerField value={img.src || ""} onChange={(url) => { const n = [...images]; n[i] = { ...n[i], src: url }; onUpdate({ ...data, images: n }); }} label={`ছবি ${i + 1}`} />
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0" onClick={() => onUpdate({ ...data, images: images.filter((_, idx) => idx !== i) })}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => onUpdate({ ...data, images: [...images, { src: "", alt: "" }] })}>
        <Plus className="w-3 h-3" /> ছবি যোগ
      </Button>
    </div>
  );
}

export function ImageSliderEditor({ data, onUpdate, ImagePickerField }: EditorWithPickerProps) {
  const images: any[] = data.images || [];
  return (
    <div className="space-y-2">
      <Input value={data.heading || ""} onChange={(e) => onUpdate({ ...data, heading: e.target.value })} placeholder="হেডিং (ঐচ্ছিক)" className="h-8 text-xs" />
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-[9px] text-muted-foreground">ইন্টারভাল (সেকেন্ড)</label>
          <Input type="number" min={1} max={20} value={data.interval || 3} onChange={(e) => onUpdate({ ...data, interval: parseInt(e.target.value) || 3 })} className="h-7 text-xs" />
        </div>
        <div className="flex-1">
          <label className="text-[9px] text-muted-foreground">অনুপাত</label>
          <Select value={data.aspectRatio || "16/9"} onValueChange={(v) => onUpdate({ ...data, aspectRatio: v })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="16/9">16:9</SelectItem>
              <SelectItem value="4/3">4:3</SelectItem>
              <SelectItem value="1/1">1:1</SelectItem>
              <SelectItem value="21/9">21:9</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-3">
        <label className="flex items-center gap-1.5 text-[10px]">
          <Checkbox checked={data.showArrows !== false} onCheckedChange={(v) => onUpdate({ ...data, showArrows: !!v })} /> অ্যারো
        </label>
        <label className="flex items-center gap-1.5 text-[10px]">
          <Checkbox checked={data.showDots !== false} onCheckedChange={(v) => onUpdate({ ...data, showDots: !!v })} /> ডটস
        </label>
      </div>
      <p className="text-[9px] text-muted-foreground font-semibold pt-1">স্লাইড:</p>
      {images.map((img, i) => (
        <div key={i} className="flex items-center gap-1.5 p-1.5 bg-muted/50 rounded border border-border">
          {img.src && <img src={img.src} className="w-10 h-10 rounded object-cover shrink-0" alt="" />}
          <div className="flex-1 space-y-1">
            <ImagePickerField value={img.src || ""} onChange={(url) => { const n = [...images]; n[i] = { ...n[i], src: url }; onUpdate({ ...data, images: n }); }} label={`ছবি ${i + 1}`} />
            <Input value={img.link || ""} onChange={(e) => { const n = [...images]; n[i] = { ...n[i], link: e.target.value }; onUpdate({ ...data, images: n }); }} placeholder="লিংক (ঐচ্ছিক)" className="h-6 text-[10px]" />
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0" onClick={() => onUpdate({ ...data, images: images.filter((_, idx) => idx !== i) })}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => onUpdate({ ...data, images: [...images, { src: "", alt: "", link: "" }] })}>
        <Plus className="w-3 h-3" /> স্লাইড যোগ
      </Button>
    </div>
  );
}

export function SocialProofEditor({ data, onUpdate }: EditorProps) {
  const items: any[] = data.items || [];
  const setItem = (i: number, key: string, val: string) => {
    const n = [...items]; n[i] = { ...n[i], [key]: val }; onUpdate({ ...data, items: n });
  };
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-1.5 items-center">
          <Input value={item.value || ""} onChange={(e) => setItem(i, "value", e.target.value)} placeholder="500+" className="w-20 h-7 text-[10px]" />
          <Input value={item.label || ""} onChange={(e) => setItem(i, "label", e.target.value)} placeholder="লেবেল" className="flex-1 h-7 text-[10px]" />
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onUpdate({ ...data, items: items.filter((_, idx) => idx !== i) })}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => onUpdate({ ...data, items: [...items, { value: "", label: "" }] })}>
        <Plus className="w-3 h-3" /> যোগ করুন
      </Button>
    </div>
  );
}

export function ComparisonEditor({ data, onUpdate }: EditorProps) {
  const columns: string[] = data.columns || [];
  const rows: any[] = data.rows || [];
  return (
    <div className="space-y-2">
      <Input value={data.heading || ""} onChange={(e) => onUpdate({ ...data, heading: e.target.value })} placeholder="হেডিং" className="h-8 text-xs" />
      <p className="text-[9px] text-muted-foreground font-semibold">কলাম:</p>
      {columns.map((col, i) => (
        <div key={i} className="flex gap-1 items-center">
          <Input value={col} onChange={(e) => { const n = [...columns]; n[i] = e.target.value; onUpdate({ ...data, columns: n }); }} className="h-7 text-[10px] flex-1" />
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => {
            const nc = columns.filter((_, idx) => idx !== i);
            const nr = rows.map(r => ({ ...r, values: (r.values || []).filter((_: any, idx: number) => idx !== i) }));
            onUpdate({ ...data, columns: nc, rows: nr });
          }}><Trash2 className="w-3 h-3" /></Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="gap-1 h-6 text-[10px]" onClick={() => {
        onUpdate({ ...data, columns: [...columns, ""], rows: rows.map(r => ({ ...r, values: [...(r.values || []), ""] })) });
      }}><Plus className="w-3 h-3" /> কলাম</Button>

      <p className="text-[9px] text-muted-foreground font-semibold pt-2">সারি:</p>
      {rows.map((row, i) => (
        <div key={i} className="space-y-1 p-1.5 bg-muted/50 rounded border border-border">
          <div className="flex gap-1 items-center">
            <Input value={row.feature || ""} onChange={(e) => { const n = [...rows]; n[i] = { ...n[i], feature: e.target.value }; onUpdate({ ...data, rows: n }); }} placeholder="ফিচার" className="h-6 text-[9px] flex-1" />
            <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => onUpdate({ ...data, rows: rows.filter((_, idx) => idx !== i) })}><Trash2 className="w-2.5 h-2.5" /></Button>
          </div>
          <div className="flex gap-1">
            {(row.values || []).map((v: string, j: number) => (
              <Input key={j} value={v} onChange={(e) => { const n = [...rows]; const vals = [...(n[i].values || [])]; vals[j] = e.target.value; n[i] = { ...n[i], values: vals }; onUpdate({ ...data, rows: n }); }} placeholder="✅/❌/টেক্সট" className="h-6 text-[9px]" />
            ))}
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" className="gap-1 h-6 text-[10px]" onClick={() => {
        onUpdate({ ...data, rows: [...rows, { feature: "", values: columns.map(() => "") }] });
      }}><Plus className="w-3 h-3" /> সারি</Button>
    </div>
  );
}

export function PricingEditor({ data, onUpdate }: EditorProps) {
  const plans: any[] = data.plans || [];
  const setPlan = (i: number, key: string, val: any) => {
    const n = [...plans]; n[i] = { ...n[i], [key]: val }; onUpdate({ ...data, plans: n });
  };
  return (
    <div className="space-y-2">
      <Input value={data.heading || ""} onChange={(e) => onUpdate({ ...data, heading: e.target.value })} placeholder="হেডিং" className="h-8 text-xs" />
      {plans.map((plan, i) => (
        <div key={i} className="space-y-1.5 p-2 bg-muted/50 rounded-lg border border-border">
          <Input value={plan.name || ""} onChange={(e) => setPlan(i, "name", e.target.value)} placeholder="প্ল্যান নাম" className="h-7 text-[10px]" />
          <div className="grid grid-cols-2 gap-1">
            <Input value={plan.price || ""} onChange={(e) => setPlan(i, "price", e.target.value)} placeholder="মূল্য" className="h-7 text-[10px]" />
            <Input value={plan.period || ""} onChange={(e) => setPlan(i, "period", e.target.value)} placeholder="মাস/বছর" className="h-7 text-[10px]" />
          </div>
          <Textarea value={(plan.features || []).join("\n")} onChange={(e) => setPlan(i, "features", e.target.value.split("\n").filter(Boolean))} rows={3} placeholder="ফিচার (প্রতি লাইনে একটি)" className="text-[10px]" />
          <div className="grid grid-cols-2 gap-1">
            <Input value={plan.buttonText || ""} onChange={(e) => setPlan(i, "buttonText", e.target.value)} placeholder="বাটন" className="h-7 text-[10px]" />
            <Input value={plan.buttonLink || ""} onChange={(e) => setPlan(i, "buttonLink", e.target.value)} placeholder="লিংক" className="h-7 text-[10px]" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={plan.highlight || false} onCheckedChange={(v) => setPlan(i, "highlight", v)} />
            <span className="text-[9px] text-muted-foreground">হাইলাইট</span>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive ml-auto" onClick={() => onUpdate({ ...data, plans: plans.filter((_, idx) => idx !== i) })}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => onUpdate({ ...data, plans: [...plans, { name: "", price: "", features: [], buttonText: "" }] })}>
        <Plus className="w-3 h-3" /> প্ল্যান যোগ
      </Button>
    </div>
  );
}
