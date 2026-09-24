import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Loader2, Plus, Trash2, Timer, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface TimerRow {
  id: string;
  key: string;
  label: string;
  ends_at: string;
  is_enabled: boolean;
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(local: string) {
  return new Date(local).toISOString();
}

const PRESET_KEYS = [
  { key: "flash_deals", label: "Flash Deals (homepage)" },
];

export default function CountdownTimers() {
  const qc = useQueryClient();
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newEnd, setNewEnd] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(23, 59, 0, 0);
    return toLocalInput(d.toISOString());
  });

  const { data: timers, isLoading } = useQuery({
    queryKey: ["admin-countdown-timers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("countdown_timers")
        .select("id,key,label,ends_at,is_enabled")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as TimerRow[]) ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const key = newKey.trim().toLowerCase().replace(/\s+/g, "_");
      if (!key) throw new Error("Key is required");
      const { error } = await supabase.from("countdown_timers").insert({
        key,
        label: newLabel.trim() || key,
        ends_at: fromLocalInput(newEnd),
        is_enabled: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Timer added" });
      setNewKey("");
      setNewLabel("");
      qc.invalidateQueries({ queryKey: ["admin-countdown-timers"] });
      qc.invalidateQueries({ queryKey: ["countdown-timer"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const save = useMutation({
    mutationFn: async (row: TimerRow) => {
      const { error } = await supabase
        .from("countdown_timers")
        .update({ label: row.label, ends_at: row.ends_at, is_enabled: row.is_enabled })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Saved" });
      qc.invalidateQueries({ queryKey: ["admin-countdown-timers"] });
      qc.invalidateQueries({ queryKey: ["countdown-timer"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("countdown_timers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Deleted" });
      qc.invalidateQueries({ queryKey: ["admin-countdown-timers"] });
      qc.invalidateQueries({ queryKey: ["countdown-timer"] });
    },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2">
        <Timer className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-bold">Countdown Timers</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        এখান থেকে Flash Deals সহ যেকোনো সেকশনের কাউন্টডাউন কন্ট্রোল করুন। কোনো সেকশনে এই টাইমার দেখাতে চাইলে কোডে <code className="px-1 rounded bg-muted">countdownKey="your_key"</code> দিন (যেমন <code className="px-1 rounded bg-muted">flash_deals</code>)। বন্ধ থাকলে বা সময় শেষ হলে ঘড়ি অটো-হাইড হবে।
      </p>

      <Card className="p-4 space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> নতুন টাইমার</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Key (unique)</Label>
            <Input
              list="timer-preset-keys"
              placeholder="flash_deals"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
            />
            <datalist id="timer-preset-keys">
              {PRESET_KEYS.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </datalist>
          </div>
          <div>
            <Label>Label</Label>
            <Input placeholder="Flash Deals" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>শেষ হবে</Label>
            <Input type="datetime-local" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
          </div>
        </div>
        <Button onClick={() => create.mutate()} disabled={create.isPending || !newKey.trim()}>
          {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add timer
        </Button>
      </Card>

      <div className="space-y-3">
        {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
        {timers?.map((t) => (
          <TimerCard key={t.id} row={t} onSave={(r) => save.mutate(r)} onDelete={() => remove.mutate(t.id)} saving={save.isPending} />
        ))}
        {timers && timers.length === 0 && (
          <p className="text-sm text-muted-foreground">কোনো টাইমার নেই — উপরে নতুন একটা যোগ করুন।</p>
        )}
      </div>
    </div>
  );
}

function TimerCard({ row, onSave, onDelete, saving }: { row: TimerRow; onSave: (r: TimerRow) => void; onDelete: () => void; saving: boolean }) {
  const [label, setLabel] = useState(row.label);
  const [endsAt, setEndsAt] = useState(toLocalInput(row.ends_at));
  const [enabled, setEnabled] = useState(row.is_enabled);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs text-muted-foreground">key</div>
          <div className="font-mono text-sm">{row.key}</div>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Enabled</Label>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label>Label</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div>
          <Label>শেষ হবে</Label>
          <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => onSave({ ...row, label, ends_at: fromLocalInput(endsAt), is_enabled: enabled })}
          disabled={saving}
        >
          <Save className="w-4 h-4" /> Save
        </Button>
        <Button size="sm" variant="destructive" onClick={onDelete}>
          <Trash2 className="w-4 h-4" /> Delete
        </Button>
      </div>
    </Card>
  );
}
