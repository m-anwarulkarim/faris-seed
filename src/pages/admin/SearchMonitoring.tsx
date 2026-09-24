import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Search, TrendingUp, AlertTriangle, Ghost, Plus, Pencil, Trash2,
  CheckCircle2, XCircle, Calendar, Eye, Loader2, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { bn } from "date-fns/locale";

type RangeKey = "7" | "30" | "90" | "all";

const STATUS_LABEL: Record<string, { label: string; variant: any }> = {
  pending: { label: "অপেক্ষমাণ", variant: "secondary" },
  planned_future: { label: "ভবিষ্যতে আনব", variant: "default" },
  permanent_ghost: { label: "Ghost তৈরি", variant: "outline" },
  ignored: { label: "উপেক্ষিত", variant: "destructive" },
};

export default function SearchMonitoring() {
  const [range, setRange] = useState<RangeKey>("30");
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  const sinceISO = useMemo(() => {
    if (range === "all") return null;
    const d = new Date();
    d.setDate(d.getDate() - parseInt(range));
    return d.toISOString();
  }, [range]);

  // Aggregated all-search stats
  const { data: allSearches, isLoading: loadingAll } = useQuery({
    queryKey: ["search-stats-all", range],
    queryFn: async () => {
      let q = supabase
        .from("search_logs")
        .select("query_normalized, query_raw, had_results, visitor_id, created_at")
        .order("created_at", { ascending: false })
        .limit(5000);
      if (sinceISO) q = q.gte("created_at", sinceISO);
      const { data, error } = await q;
      if (error) throw error;

      // Aggregate
      const map = new Map<string, {
        keyword: string;
        sample: string;
        total: number;
        hits: number;
        misses: number;
        visitors: Set<string>;
        last: string;
      }>();
      for (const row of (data || [])) {
        const k = row.query_normalized;
        const existing = map.get(k);
        if (existing) {
          existing.total++;
          if (row.had_results) existing.hits++; else existing.misses++;
          if (row.visitor_id) existing.visitors.add(row.visitor_id);
          if (row.created_at > existing.last) existing.last = row.created_at;
        } else {
          map.set(k, {
            keyword: k,
            sample: row.query_raw,
            total: 1,
            hits: row.had_results ? 1 : 0,
            misses: row.had_results ? 0 : 1,
            visitors: new Set(row.visitor_id ? [row.visitor_id] : []),
            last: row.created_at,
          });
        }
      }
      return Array.from(map.values())
        .map(r => ({ ...r, uniqueVisitors: r.visitors.size }))
        .sort((a, b) => b.total - a.total);
    },
  });

  const filteredAll = useMemo(() => {
    if (!allSearches) return [];
    const s = search.trim().toLowerCase();
    if (!s) return allSearches;
    return allSearches.filter(r => r.keyword.includes(s));
  }, [allSearches, search]);

  const successful = useMemo(
    () => filteredAll.filter(r => r.hits > 0).sort((a, b) => b.hits - a.hits),
    [filteredAll]
  );

  // Misses (with admin actions)
  const { data: misses, isLoading: loadingMisses } = useQuery({
    queryKey: ["search-misses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("search_misses")
        .select("*")
        .order("search_count", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const filteredMisses = useMemo(() => {
    if (!misses) return [];
    const s = search.trim().toLowerCase();
    if (!s) return misses;
    return misses.filter(r => r.query_normalized.includes(s));
  }, [misses, search]);

  // Ghost products list
  const { data: ghosts, isLoading: loadingGhosts } = useQuery({
    queryKey: ["ghost-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ghost_products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Search forwards
  const { data: forwards, isLoading: loadingForwards } = useQuery({
    queryKey: ["search-forwards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("search_forwards")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const deleteForward = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("search_forwards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["search-forwards"] });
      toast.success("মুছে ফেলা হয়েছে");
    },
  });

  const toggleForwardActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("search_forwards").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["search-forwards"] }),
  });

  const [forwardDialog, setForwardDialog] = useState<{
    open: boolean;
    editing?: any;
    fromMissId?: string;
    prefilledFrom?: string;
  }>({ open: false });

  // Mutations
  const updateMissStatus = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: string; note?: string }) => {
      const patch: any = { status };
      if (note !== undefined) patch.admin_note = note;
      const { error } = await supabase.from("search_misses").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["search-misses"] });
      toast.success("স্ট্যাটাস আপডেট হয়েছে");
    },
    onError: (e: any) => toast.error(e.message || "ত্রুটি"),
  });

  const deleteGhost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ghost_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ghost-products"] });
      toast.success("মুছে ফেলা হয়েছে");
    },
  });

  const toggleGhostActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("ghost_products").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ghost-products"] }),
  });

  // Ghost dialog
  const [ghostDialog, setGhostDialog] = useState<{
    open: boolean;
    editing?: any;
    fromMissId?: string;
    prefilledKeyword?: string;
  }>({ open: false });

  // Stats
  const totalSearches = allSearches?.reduce((a, r) => a + r.total, 0) || 0;
  const totalHits = allSearches?.reduce((a, r) => a + r.hits, 0) || 0;
  const totalMissesCount = allSearches?.reduce((a, r) => a + r.misses, 0) || 0;
  const hitRate = totalSearches > 0 ? Math.round((totalHits / totalSearches) * 100) : 0;

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Search className="w-5 h-5" /> সার্চ মনিটরিং
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            কাস্টমাররা কী খুঁজছেন, কোন সার্চে রেজাল্ট পাচ্ছেন না — সব এক জায়গায়
          </p>
        </div>
        <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">গত ৭ দিন</SelectItem>
            <SelectItem value="30">গত ৩০ দিন</SelectItem>
            <SelectItem value="90">গত ৯০ দিন</SelectItem>
            <SelectItem value="all">সর্বমোট</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatCard icon={Search} label="মোট সার্চ" value={totalSearches.toLocaleString()} />
        <StatCard icon={CheckCircle2} label="সফল" value={totalHits.toLocaleString()} accent="text-emerald-600" />
        <StatCard icon={XCircle} label="রেজাল্ট নেই" value={totalMissesCount.toLocaleString()} accent="text-destructive" />
        <StatCard icon={TrendingUp} label="হিট রেট" value={`${hitRate}%`} accent="text-primary" />
      </div>

      {/* Search box */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="কীওয়ার্ড দিয়ে ফিল্টার করুন..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs defaultValue="misses" className="w-full">
        <TabsList className="grid grid-cols-5 w-full max-w-3xl">
          <TabsTrigger value="misses" className="text-xs gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> ব্যর্থ
            {misses && misses.filter(m => m.status === "pending").length > 0 && (
              <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">
                {misses.filter(m => m.status === "pending").length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all" className="text-xs gap-1">
            <Search className="w-3.5 h-3.5" /> সব
          </TabsTrigger>
          <TabsTrigger value="success" className="text-xs gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> সফল
          </TabsTrigger>
          <TabsTrigger value="forwards" className="text-xs gap-1">
            <ArrowRight className="w-3.5 h-3.5" /> ফরওয়ার্ড ({forwards?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="ghosts" className="text-xs gap-1">
            <Ghost className="w-3.5 h-3.5" /> Ghost ({ghosts?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* MISSES — main action area */}
        <TabsContent value="misses" className="mt-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                রেজাল্ট পাওয়া যায়নি — এমন সার্চসমূহ
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                "ভবিষ্যতে আনব" → সোর্সিং তালিকায় যাবে। "Ghost তৈরি" → এই কীওয়ার্ডে সার্চ করলে "আমাদের কাছে নেই" হিসেবে দেখাবে।
              </p>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {loadingMisses ? (
                <Loader />
              ) : filteredMisses.length === 0 ? (
                <Empty text="কোনো ব্যর্থ সার্চ নেই" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>কীওয়ার্ড</TableHead>
                      <TableHead className="text-right">কতবার</TableHead>
                      <TableHead>সর্বশেষ</TableHead>
                      <TableHead>স্ট্যাটাস</TableHead>
                      <TableHead className="text-right">অ্যাকশন</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMisses.map((m: any) => {
                      const st = STATUS_LABEL[m.status] || STATUS_LABEL.pending;
                      return (
                        <TableRow key={m.id}>
                          <TableCell>
                            <div className="font-medium">{m.query_sample}</div>
                            {m.admin_note && (
                              <div className="text-[11px] text-muted-foreground mt-0.5">📝 {m.admin_note}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">{m.search_count}</TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(m.last_searched_at), { addSuffix: true, locale: bn })}
                          </TableCell>
                          <TableCell>
                            <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1 flex-wrap">
                              <Button
                                size="sm" variant="outline"
                                className="h-7 text-[11px]"
                                onClick={() => updateMissStatus.mutate({ id: m.id, status: "planned_future" })}
                                disabled={m.status === "planned_future"}
                              >
                                ভবিষ্যতে আনব
                              </Button>
                              <Button
                                size="sm" variant="secondary"
                                className="h-7 text-[11px]"
                                onClick={() => setForwardDialog({
                                  open: true,
                                  fromMissId: m.id,
                                  prefilledFrom: m.query_sample,
                                })}
                              >
                                <ArrowRight className="w-3 h-3 mr-1" /> ফরওয়ার্ড
                              </Button>
                              <Button
                                size="sm" variant="default"
                                className="h-7 text-[11px]"
                                onClick={() => setGhostDialog({
                                  open: true,
                                  fromMissId: m.id,
                                  prefilledKeyword: m.query_sample,
                                })}
                              >
                                <Ghost className="w-3 h-3 mr-1" /> Ghost
                              </Button>
                              <Button
                                size="sm" variant="ghost"
                                className="h-7 text-[11px]"
                                onClick={() => updateMissStatus.mutate({ id: m.id, status: "ignored" })}
                              >
                                উপেক্ষা
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ALL */}
        <TabsContent value="all" className="mt-3">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              {loadingAll ? <Loader /> : filteredAll.length === 0 ? (
                <Empty text="কোনো ডেটা নেই" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>কীওয়ার্ড</TableHead>
                      <TableHead className="text-right">মোট</TableHead>
                      <TableHead className="text-right">হিট</TableHead>
                      <TableHead className="text-right">মিস</TableHead>
                      <TableHead className="text-right">ভিজিটর</TableHead>
                      <TableHead>সর্বশেষ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAll.slice(0, 200).map((r) => (
                      <TableRow key={r.keyword}>
                        <TableCell className="font-medium">{r.sample}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{r.total}</TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-600">{r.hits}</TableCell>
                        <TableCell className="text-right tabular-nums text-destructive">{r.misses}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.uniqueVisitors}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(r.last), { addSuffix: true, locale: bn })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SUCCESS */}
        <TabsContent value="success" className="mt-3">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              {loadingAll ? <Loader /> : successful.length === 0 ? (
                <Empty text="কোনো সফল সার্চ নেই" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>কীওয়ার্ড</TableHead>
                      <TableHead className="text-right">হিট</TableHead>
                      <TableHead className="text-right">মোট সার্চ</TableHead>
                      <TableHead className="text-right">ইউনিক ভিজিটর</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {successful.slice(0, 200).map((r) => (
                      <TableRow key={r.keyword}>
                        <TableCell className="font-medium">{r.sample}</TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-600 font-semibold">{r.hits}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.total}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.uniqueVisitors}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* FORWARDS */}
        <TabsContent value="forwards" className="mt-3">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowRight className="w-4 h-4" /> সার্চ ফরওয়ার্ডিং
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ভুল বানান বা বিকল্প শব্দকে সঠিক কীওয়ার্ড/পণ্যে redirect করুন
                </p>
              </div>
              <Button size="sm" onClick={() => setForwardDialog({ open: true })}>
                <Plus className="w-4 h-4 mr-1" /> নতুন
              </Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {loadingForwards ? <Loader /> : (forwards || []).length === 0 ? (
                <Empty text="এখনো কোনো ফরওয়ার্ড নেই" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>যা সার্চ করছে</TableHead>
                      <TableHead>রিডাইরেক্ট হবে</TableHead>
                      <TableHead className="text-right">হিট</TableHead>
                      <TableHead>অ্যাক্টিভ</TableHead>
                      <TableHead className="text-right">অ্যাকশন</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(forwards || []).map((f: any) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.from_keyword}</TableCell>
                        <TableCell className="text-xs">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            {f.to_keyword && <Badge variant="secondary" className="text-[10px]">{f.to_keyword}</Badge>}
                            {f.to_product_id && (
                              <Badge variant="outline" className="text-[10px]">
                                <PackageHint id={f.to_product_id} />
                              </Badge>
                            )}
                          </div>
                          {f.admin_note && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">📝 {f.admin_note}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{f.hit_count}</TableCell>
                        <TableCell>
                          <Switch
                            checked={f.is_active}
                            onCheckedChange={(v) => toggleForwardActive.mutate({ id: f.id, is_active: v })}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7"
                              onClick={() => setForwardDialog({ open: true, editing: f })}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                              onClick={() => {
                                if (confirm("মুছে ফেলতে চান?")) deleteForward.mutate(f.id);
                              }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* GHOSTS */}
        <TabsContent value="ghosts" className="mt-3">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Ghost className="w-4 h-4" /> Ghost পণ্যসমূহ
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  সার্চ-এ "আমাদের কাছে নেই" হিসেবে দেখাবে
                </p>
              </div>
              <Button size="sm" onClick={() => setGhostDialog({ open: true })}>
                <Plus className="w-4 h-4 mr-1" /> নতুন
              </Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {loadingGhosts ? <Loader /> : (ghosts || []).length === 0 ? (
                <Empty text="এখনো কোনো ghost পণ্য নেই" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>নাম</TableHead>
                      <TableHead>কারণ</TableHead>
                      <TableHead>কীওয়ার্ড</TableHead>
                      <TableHead>অ্যাক্টিভ</TableHead>
                      <TableHead className="text-right">অ্যাকশন</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(ghosts || []).map((g: any) => (
                      <TableRow key={g.id}>
                        <TableCell className="font-medium">{g.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs">
                          <div className="line-clamp-2">{g.unavailable_reason}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {(g.match_keywords || []).slice(0, 4).map((k: string) => (
                              <Badge key={k} variant="outline" className="text-[10px]">{k}</Badge>
                            ))}
                            {(g.match_keywords?.length || 0) > 4 && (
                              <span className="text-[10px] text-muted-foreground">+{g.match_keywords.length - 4}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={g.is_active}
                            onCheckedChange={(v) => toggleGhostActive.mutate({ id: g.id, is_active: v })}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7"
                              onClick={() => setGhostDialog({ open: true, editing: g })}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                              onClick={() => {
                                if (confirm("মুছে ফেলতে চান?")) deleteGhost.mutate(g.id);
                              }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <GhostProductDialog
        state={ghostDialog}
        onClose={() => setGhostDialog({ open: false })}
        onSaved={(newId) => {
          qc.invalidateQueries({ queryKey: ["ghost-products"] });
          if (ghostDialog.fromMissId && newId) {
            updateMissStatus.mutate({ id: ghostDialog.fromMissId, status: "permanent_ghost" });
            // Also link
            supabase.from("search_misses")
              .update({ ghost_product_id: newId })
              .eq("id", ghostDialog.fromMissId);
          }
          setGhostDialog({ open: false });
        }}
      />

      <ForwardDialog
        state={forwardDialog}
        onClose={() => setForwardDialog({ open: false })}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["search-forwards"] });
          if (forwardDialog.fromMissId) {
            updateMissStatus.mutate({ id: forwardDialog.fromMissId, status: "planned_future", note: "Forward করা হয়েছে" });
          }
          setForwardDialog({ open: false });
        }}
      />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: any) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg bg-muted flex items-center justify-center ${accent || "text-foreground"}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] text-muted-foreground">{label}</div>
          <div className={`text-lg font-bold tabular-nums ${accent || ""}`}>{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Loader() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="text-center py-12 text-sm text-muted-foreground">{text}</div>
  );
}

// =====================================================
// Ghost Product Dialog
// =====================================================
function GhostProductDialog({ state, onClose, onSaved }: {
  state: { open: boolean; editing?: any; prefilledKeyword?: string; fromMissId?: string };
  onClose: () => void;
  onSaved: (newId?: string) => void;
}) {
  const editing = state.editing;
  const [name, setName] = useState("");
  const [reason, setReason] = useState("এই পণ্যটি আমাদের ওয়েবসাইটে নেই।");
  const [image, setImage] = useState("");
  const [keywordsText, setKeywordsText] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Reset on open
  useMemo(() => {
    if (state.open) {
      setName(editing?.name || state.prefilledKeyword || "");
      setReason(editing?.unavailable_reason || "এই পণ্যটি আমাদের ওয়েবসাইটে নেই।");
      setImage(editing?.display_image || "");
      setKeywordsText(
        editing?.match_keywords?.join(", ") ||
        (state.prefilledKeyword ? state.prefilledKeyword : "")
      );
      setActive(editing?.is_active ?? true);
    }
  }, [state.open, editing, state.prefilledKeyword]);

  const save = async () => {
    if (!name.trim()) { toast.error("নাম দিন"); return; }
    setSaving(true);
    try {
      const keywords = keywordsText
        .split(",")
        .map(k => k.trim().toLowerCase())
        .filter(Boolean);
      const payload = {
        name: name.trim(),
        unavailable_reason: reason.trim(),
        display_image: image.trim() || null,
        match_keywords: keywords,
        is_active: active,
      };
      if (editing?.id) {
        const { error } = await supabase.from("ghost_products").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("আপডেট হয়েছে");
        onSaved(editing.id);
      } else {
        const { data, error } = await supabase.from("ghost_products").insert(payload).select("id").single();
        if (error) throw error;
        toast.success("Ghost পণ্য তৈরি হয়েছে");
        onSaved(data?.id);
      }
    } catch (e: any) {
      toast.error(e.message || "ত্রুটি");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={state.open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ghost className="w-4 h-4" /> {editing ? "Ghost সম্পাদনা" : "নতুন Ghost পণ্য"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            এই পণ্যটি সার্চ রেজাল্টে দেখাবে কিন্তু "আমাদের কাছে নেই" নোট সহ
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">পণ্যের নাম *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="যেমন: পেঁপের চারা" />
          </div>
          <div>
            <Label className="text-xs">কারণ (গ্রাহককে যা দেখাবে)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="যেমন: এই পণ্যটি বর্তমানে স্টকে নেই।"
            />
          </div>
          <div>
            <Label className="text-xs">কীওয়ার্ড (কমা দিয়ে আলাদা)</Label>
            <Input
              value={keywordsText}
              onChange={(e) => setKeywordsText(e.target.value)}
              placeholder="পেঁপে, পেপে, চারা"
            />
            <p className="text-[10px] text-muted-foreground mt-1">এই শব্দগুলো সার্চ করলে এই Ghost পণ্যটি দেখাবে</p>
          </div>
          <div>
            <Label className="text-xs">ছবি URL (optional)</Label>
            <Input value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://..." />
          </div>
          <div className="flex items-center justify-between border-t pt-3">
            <Label className="text-sm">অ্যাক্টিভ</Label>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>বাতিল</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
            {editing ? "আপডেট" : "তৈরি করুন"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =====================================================
// PackageHint — shows product name from id
// =====================================================
function PackageHint({ id }: { id: string }) {
  const { data } = useQuery({
    queryKey: ["product-hint", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("products_public")
        .select("name")
        .eq("id", id)
        .maybeSingle();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
  return <span>{data?.name || "Product"}</span>;
}

// =====================================================
// Forward Dialog
// =====================================================
function ForwardDialog({ state, onClose, onSaved }: {
  state: { open: boolean; editing?: any; prefilledFrom?: string; fromMissId?: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = state.editing;
  const [from, setFrom] = useState("");
  const [toKw, setToKw] = useState("");
  const [productId, setProductId] = useState<string>("");
  const [productSearch, setProductSearch] = useState("");
  const [note, setNote] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useMemo(() => {
    if (state.open) {
      setFrom(editing?.from_keyword || state.prefilledFrom || "");
      setToKw(editing?.to_keyword || "");
      setProductId(editing?.to_product_id || "");
      setNote(editing?.admin_note || "");
      setActive(editing?.is_active ?? true);
      setProductSearch("");
    }
  }, [state.open, editing, state.prefilledFrom]);

  const { data: productOptions } = useQuery({
    queryKey: ["fwd-product-search", productSearch],
    enabled: productSearch.trim().length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("products_public")
        .select("id, name")
        .ilike("name", `%${productSearch.trim()}%`)
        .limit(8);
      return data || [];
    },
  });

  const save = async () => {
    if (!from.trim()) { toast.error("From keyword দিন"); return; }
    if (!toKw.trim() && !productId) { toast.error("Target keyword বা product দিন"); return; }
    setSaving(true);
    try {
      const payload: any = {
        from_keyword: from.trim(),
        to_keyword: toKw.trim() || null,
        to_product_id: productId || null,
        admin_note: note.trim() || null,
        is_active: active,
      };
      if (editing?.id) {
        const { error } = await supabase.from("search_forwards").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("আপডেট হয়েছে");
      } else {
        const { error } = await supabase.from("search_forwards").insert(payload);
        if (error) {
          if ((error as any).code === "23505") {
            toast.error("এই keyword-এ ইতিমধ্যে forward আছে");
          } else throw error;
          setSaving(false);
          return;
        }
        toast.success("ফরওয়ার্ড তৈরি হয়েছে");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "ত্রুটি");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={state.open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4" /> {editing ? "ফরওয়ার্ড সম্পাদনা" : "নতুন সার্চ ফরওয়ার্ড"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            যা সার্চ করছে → কোন keyword বা product-এ পাঠাবেন তা নির্ধারণ করুন
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">যা সার্চ করছে (From) *</Label>
            <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="যেমন: টমেটু" />
            <p className="text-[10px] text-muted-foreground mt-1">case-insensitive match</p>
          </div>

          <div className="border-t pt-3">
            <Label className="text-xs font-semibold">যেখানে যাবে (To) — যেকোনো একটি</Label>
          </div>

          <div>
            <Label className="text-xs">কীওয়ার্ড</Label>
            <Input value={toKw} onChange={(e) => setToKw(e.target.value)} placeholder="যেমন: টমেটো" />
          </div>

          <div className="text-center text-[11px] text-muted-foreground">— অথবা —</div>

          <div>
            <Label className="text-xs">নির্দিষ্ট পণ্য</Label>
            {productId ? (
              <div className="flex items-center justify-between p-2 rounded border bg-muted/30">
                <span className="text-xs"><PackageHint id={productId} /></span>
                <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => setProductId("")}>
                  সরান
                </Button>
              </div>
            ) : (
              <>
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="পণ্যের নাম লিখুন..."
                />
                {productOptions && productOptions.length > 0 && (
                  <div className="mt-1 border rounded max-h-40 overflow-y-auto">
                    {productOptions.map((p: any) => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted"
                        onClick={() => { setProductId(p.id); setProductSearch(""); }}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="border-t pt-3">
            <Label className="text-xs">নোট (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="যেমন: ভুল বানান" />
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <Label className="text-sm">অ্যাক্টিভ</Label>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>বাতিল</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
            {editing ? "আপডেট" : "তৈরি করুন"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
