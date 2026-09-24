import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  MessageCircleQuestion,
  Check,
  Trash2,
  AlertTriangle,
  HelpCircle,
  MessageSquare,
  Loader2,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { bn } from "date-fns/locale";

type Tab = "pending_q" | "pending_a" | "auto_approved" | "all";

interface QuestionRow {
  id: string;
  product_id: string;
  question: string;
  status: string;
  guest_name: string | null;
  visitor_profile_id: string | null;
  has_flagged_keyword: boolean;
  moderation_reason: string | null;
  was_auto_approved: boolean;
  created_at: string;
  customer?: { name?: string | null; profile_picture?: string | null } | null;
  product?: { name?: string | null; product_image?: string | null; slug?: string | null } | null;
}

interface AnswerRow {
  id: string;
  question_id: string;
  answer: string;
  status: string;
  guest_name: string | null;
  visitor_profile_id: string | null;
  has_flagged_keyword: boolean;
  moderation_reason: string | null;
  was_auto_approved: boolean;
  created_at: string;
  customer?: { name?: string | null; profile_picture?: string | null } | null;
  question?: { question?: string | null; product_id?: string | null } | null;
  product?: { name?: string | null; slug?: string | null } | null;
}

export default function ProductQAManagement() {
  const [tab, setTab] = useState<Tab>("pending_q");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const qc = useQueryClient();

  const { data: counts } = useQuery({
    queryKey: ["qa-mgmt-counts"],
    queryFn: async () => {
      const [{ count: pq }, { count: pa }, { count: aa }] = await Promise.all([
        supabase.from("product_questions" as any).select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("product_answers" as any).select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("product_answers" as any).select("id", { count: "exact", head: true }).eq("was_auto_approved", true).gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
      ]);
      return { pq: pq || 0, pa: pa || 0, aa: aa || 0 };
    },
    refetchInterval: 60000, // Cloud cost: was 30s
  });

  const { data: questions, isLoading: qLoading } = useQuery({
    queryKey: ["qa-questions", tab],
    enabled: tab === "pending_q" || tab === "all",
    queryFn: async (): Promise<QuestionRow[]> => {
      let q = supabase
        .from("product_questions" as any)
        .select("id, product_id, question, status, guest_name, visitor_profile_id, has_flagged_keyword, moderation_reason, was_auto_approved, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (tab === "pending_q") q = q.eq("status", "pending");
      else q = q.eq("status", "approved");

      const { data, error } = await q;
      if (error) throw error;
      const rows = (data as any[]) || [];
      if (!rows.length) return [];

      const productIds = [...new Set(rows.map((r) => r.product_id))];
      const profileIds = [...new Set(rows.map((r) => r.visitor_profile_id).filter(Boolean))];

      const [{ data: products }, { data: profiles }] = await Promise.all([
        supabase.from("products").select("id, name, product_image, slug").in("id", productIds),
        profileIds.length
          ? supabase.from("visitor_profiles").select("id, name, profile_picture").in("id", profileIds as string[])
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const pmap = Object.fromEntries((products || []).map((p: any) => [p.id, p]));
      const vmap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));

      return rows.map((r) => ({
        ...r,
        product: pmap[r.product_id] || null,
        customer: r.visitor_profile_id ? vmap[r.visitor_profile_id] || null : null,
      }));
    },
  });

  const { data: answers, isLoading: aLoading } = useQuery({
    queryKey: ["qa-answers", tab],
    enabled: tab === "pending_a" || tab === "auto_approved" || tab === "all",
    queryFn: async (): Promise<AnswerRow[]> => {
      let q = supabase
        .from("product_answers" as any)
        .select("id, question_id, answer, status, guest_name, visitor_profile_id, has_flagged_keyword, moderation_reason, was_auto_approved, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (tab === "pending_a") q = q.eq("status", "pending");
      else if (tab === "auto_approved") {
        q = q.eq("was_auto_approved", true).gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
      } else q = q.eq("status", "approved");

      const { data, error } = await q;
      if (error) throw error;
      const rows = (data as any[]) || [];
      if (!rows.length) return [];

      const questionIds = [...new Set(rows.map((r) => r.question_id))];
      const profileIds = [...new Set(rows.map((r) => r.visitor_profile_id).filter(Boolean))];

      const { data: qs } = await supabase
        .from("product_questions" as any)
        .select("id, question, product_id")
        .in("id", questionIds);
      const productIds = [...new Set(((qs as any[]) || []).map((x) => x.product_id))];

      const [{ data: products }, { data: profiles }] = await Promise.all([
        productIds.length
          ? supabase.from("products").select("id, name, slug").in("id", productIds)
          : Promise.resolve({ data: [] as any[] }),
        profileIds.length
          ? supabase.from("visitor_profiles").select("id, name, profile_picture").in("id", profileIds as string[])
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const qmap = Object.fromEntries(((qs as any[]) || []).map((x) => [x.id, x]));
      const pmap = Object.fromEntries((products || []).map((p: any) => [p.id, p]));
      const vmap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));

      return rows.map((r) => {
        const qrow = qmap[r.question_id];
        return {
          ...r,
          question: qrow ? { question: qrow.question, product_id: qrow.product_id } : null,
          product: qrow ? pmap[qrow.product_id] || null : null,
          customer: r.visitor_profile_id ? vmap[r.visitor_profile_id] || null : null,
        };
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ kind, id }: { kind: "q" | "a"; id: string }) => {
      const table = kind === "q" ? "product_questions" : "product_answers";
      const { error } = await supabase.from(table as any).update({ status: "approved" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Approve হয়েছে");
      qc.invalidateQueries({ queryKey: ["qa-questions"] });
      qc.invalidateQueries({ queryKey: ["qa-answers"] });
      qc.invalidateQueries({ queryKey: ["qa-mgmt-counts"] });
    },
    onError: (e: any) => toast.error(e?.message || "Approve হয়নি"),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ kind, id }: { kind: "q" | "a"; id: string }) => {
      const table = kind === "q" ? "product_questions" : "product_answers";
      const { error } = await supabase.from(table as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("মুছে ফেলা হয়েছে");
      qc.invalidateQueries({ queryKey: ["qa-questions"] });
      qc.invalidateQueries({ queryKey: ["qa-answers"] });
      qc.invalidateQueries({ queryKey: ["qa-mgmt-counts"] });
    },
    onError: (e: any) => toast.error(e?.message || "মুছা যায়নি"),
  });

  const adminReplyMutation = useMutation({
    mutationFn: async ({ questionId, answer }: { questionId: string; answer: string }) => {
      const text = answer.trim();
      if (text.length < 2) throw new Error("উত্তর লিখুন");
      const { error: aErr } = await supabase.from("product_answers" as any).insert({
        question_id: questionId,
        answer: text,
        status: "approved",
        guest_name: "Griha Nova (Official)",
        was_auto_approved: false,
      });
      if (aErr) throw aErr;
      // Auto-approve the question so the Q&A pair is visible to customers
      await supabase.from("product_questions" as any).update({ status: "approved" }).eq("id", questionId);
    },
    onSuccess: (_d, vars) => {
      toast.success("উত্তর পাঠানো হয়েছে");
      setReplyDrafts((p) => ({ ...p, [vars.questionId]: "" }));
      qc.invalidateQueries({ queryKey: ["qa-questions"] });
      qc.invalidateQueries({ queryKey: ["qa-answers"] });
      qc.invalidateQueries({ queryKey: ["qa-mgmt-counts"] });
    },
    onError: (e: any) => toast.error(e?.message || "পাঠানো যায়নি"),
  });

  const renderQuestion = (q: QuestionRow) => (
    <div key={q.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600 gap-1">
            <HelpCircle className="w-3 h-3" /> প্রশ্ন
          </Badge>
          {q.status === "pending" && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-800">
              পেন্ডিং
            </Badge>
          )}
          {q.has_flagged_keyword && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="w-3 h-3" /> Flagged
            </Badge>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground shrink-0">
          {formatDistanceToNow(new Date(q.created_at), { addSuffix: true, locale: bn })}
        </span>
      </div>

      {q.product && (
        <Link
          to={`/product/${q.product.slug}`}
          target="_blank"
          className="flex items-center gap-2 text-xs bg-muted/40 rounded-lg p-2 hover:bg-muted transition-colors"
        >
          {q.product.product_image && (
            <img src={q.product.product_image} alt="" className="w-8 h-8 rounded object-cover" />
          )}
          <span className="font-semibold text-foreground flex-1 truncate">{q.product.name}</span>
          <ExternalLink className="w-3 h-3 text-muted-foreground" />
        </Link>
      )}

      <div>
        <div className="text-xs text-muted-foreground mb-1">
          {q.customer?.name || q.guest_name || "Guest"}
          {q.guest_name && !q.customer && <span className="ml-1 text-amber-700">(guest)</span>}
        </div>
        <p className="text-sm text-foreground leading-relaxed">{q.question}</p>
      </div>

      {q.moderation_reason && (
        <p className="text-[11px] text-amber-700 bg-amber-50 rounded p-2">
          {q.moderation_reason}
        </p>
      )}

      <div className="space-y-2 pt-1 border-t border-border/60">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
          অফিসিয়াল উত্তর লিখুন
        </div>
        <Textarea
          value={replyDrafts[q.id] || ""}
          onChange={(e) => setReplyDrafts((p) => ({ ...p, [q.id]: e.target.value }))}
          placeholder="এখানে আপনার উত্তর লিখুন..."
          rows={3}
          className="text-sm"
        />
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={() =>
              adminReplyMutation.mutate({ questionId: q.id, answer: replyDrafts[q.id] || "" })
            }
            disabled={adminReplyMutation.isPending || !(replyDrafts[q.id] || "").trim()}
            className="gap-1.5"
          >
            <MessageSquare className="w-3.5 h-3.5" /> উত্তর পাঠান
          </Button>
          {q.status === "pending" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => approveMutation.mutate({ kind: "q", id: q.id })}
              disabled={approveMutation.isPending}
              className="gap-1.5"
            >
              <Check className="w-3.5 h-3.5" /> শুধু Approve
            </Button>
          )}
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              if (confirm("নিশ্চিত মুছে ফেলতে চান?")) deleteMutation.mutate({ kind: "q", id: q.id });
            }}
            className="gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </Button>
        </div>
      </div>
    </div>
  );

  const renderAnswer = (a: AnswerRow) => (
    <div key={a.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="default" className="bg-blue-600 hover:bg-blue-600 gap-1">
            <MessageSquare className="w-3 h-3" /> উত্তর
          </Badge>
          {a.status === "pending" && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-800">
              পেন্ডিং
            </Badge>
          )}
          {a.was_auto_approved && a.status === "approved" && (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 gap-1">
              <Sparkles className="w-3 h-3" /> Auto-Approved
            </Badge>
          )}
          {a.has_flagged_keyword && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="w-3 h-3" /> Flagged
            </Badge>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground shrink-0">
          {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: bn })}
        </span>
      </div>

      {a.product && (
        <Link
          to={`/product/${a.product.slug}`}
          target="_blank"
          className="text-xs bg-muted/40 rounded-lg p-2 hover:bg-muted block transition-colors"
        >
          <span className="font-semibold text-foreground">{a.product.name}</span>
          <ExternalLink className="w-3 h-3 text-muted-foreground inline ml-1" />
        </Link>
      )}

      {a.question?.question && (
        <div className="bg-muted/30 rounded-lg p-2 border-l-2 border-primary/40">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">
            মূল প্রশ্ন
          </div>
          <p className="text-xs text-foreground/80 leading-relaxed">{a.question.question}</p>
        </div>
      )}

      <div>
        <div className="text-xs text-muted-foreground mb-1">
          {a.customer?.name || a.guest_name || "Guest"}
          {a.guest_name && !a.customer && <span className="ml-1 text-amber-700">(guest)</span>}
        </div>
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{a.answer}</p>
      </div>

      {a.moderation_reason && (
        <p className="text-[11px] text-amber-700 bg-amber-50 rounded p-2">
          {a.moderation_reason}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        {a.status === "pending" && (
          <Button
            size="sm"
            onClick={() => approveMutation.mutate({ kind: "a", id: a.id })}
            disabled={approveMutation.isPending}
            className="gap-1.5"
          >
            <Check className="w-3.5 h-3.5" /> Approve
          </Button>
        )}
        <Button
          size="sm"
          variant="destructive"
          onClick={() => {
            if (confirm("নিশ্চিত মুছে ফেলতে চান?")) deleteMutation.mutate({ kind: "a", id: a.id });
          }}
          className="gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </Button>
      </div>
    </div>
  );

  const empty = (msg: string) => (
    <div className="text-center py-12 text-muted-foreground">
      <MessageCircleQuestion className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p className="text-sm">{msg}</p>
    </div>
  );

  const loader = (
    <div className="flex justify-center py-10">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-5">
        <MessageCircleQuestion className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold text-foreground">জিজ্ঞাসা — প্রশ্ন ও উত্তর Moderation</h1>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full mb-4 h-auto">
          <TabsTrigger value="pending_q" className="gap-1.5 text-xs py-2">
            <HelpCircle className="w-3.5 h-3.5" /> পেন্ডিং প্রশ্ন
            {!!counts?.pq && (
              <span className="ml-1 bg-destructive text-destructive-foreground rounded-full text-[10px] px-1.5 py-0.5 font-bold">
                {counts.pq}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="pending_a" className="gap-1.5 text-xs py-2">
            <MessageSquare className="w-3.5 h-3.5" /> পেন্ডিং উত্তর
            {!!counts?.pa && (
              <span className="ml-1 bg-destructive text-destructive-foreground rounded-full text-[10px] px-1.5 py-0.5 font-bold">
                {counts.pa}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="auto_approved" className="gap-1.5 text-xs py-2">
            <Sparkles className="w-3.5 h-3.5" /> Auto-Approved
            {!!counts?.aa && (
              <span className="ml-1 bg-emerald-600 text-white rounded-full text-[10px] px-1.5 py-0.5 font-bold">
                {counts.aa}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-1.5 text-xs py-2">
            সব Approved
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending_q" className="space-y-3 mt-0">
          {qLoading ? loader : !questions?.length ? empty("কোনো পেন্ডিং প্রশ্ন নেই") : questions.map(renderQuestion)}
        </TabsContent>

        <TabsContent value="pending_a" className="space-y-3 mt-0">
          {aLoading ? loader : !answers?.length ? empty("কোনো পেন্ডিং উত্তর নেই") : answers.map(renderAnswer)}
        </TabsContent>

        <TabsContent value="auto_approved" className="space-y-3 mt-0">
          {aLoading ? loader : !answers?.length ? empty("শেষ ৭ দিনে কোনো auto-approved উত্তর নেই") : answers.map(renderAnswer)}
        </TabsContent>

        <TabsContent value="all" className="space-y-3 mt-0">
          {qLoading || aLoading ? loader : (
            <>
              {questions?.map(renderQuestion)}
              {answers?.map(renderAnswer)}
              {!questions?.length && !answers?.length && empty("কোনো approved প্রশ্ন/উত্তর নেই")}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
