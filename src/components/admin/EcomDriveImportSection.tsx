import { useState, useEffect, useCallback, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Play, Pause, CloudDownload, Clock, RotateCcw, Loader2, CheckCircle2, PackagePlus } from "lucide-react";

interface ImportJob {
  id: string;
  current_invoice: number;
  max_invoice: number;
  total_imported: number;
  total_skipped: number;
  total_errors: number;
  status: string;
  started_at: string | null;
  last_run_at: string | null;
  created_at: string;
}

function ImportJobCard({ job, source, title, description, icon: Icon, onRefresh }: {
  job: ImportJob | null;
  source: string;
  title: string;
  description: string;
  icon: React.ElementType;
  onRefresh: () => void;
}) {
  const { t } = useLanguage();
  const [toggling, setToggling] = useState(false);
  const autoRunRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-invoke edge function every 30s while job is running
  useEffect(() => {
    const isRunning = job?.status === "running";
    
    if (isRunning && source === "ecomdrive_backfill") {
      // Clear any existing interval
      if (autoRunRef.current) clearInterval(autoRunRef.current);
      
      autoRunRef.current = setInterval(async () => {
        try {
          const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
          await fetch(
            `https://${projectId}.supabase.co/functions/v1/backfill-ecomdrive-items`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            }
          );
          onRefresh();
        } catch (e) {
          console.error("Auto-run backfill error:", e);
        }
      }, 30000);
    } else if (isRunning && source === "ecomdrive") {
      if (autoRunRef.current) clearInterval(autoRunRef.current);
      
      autoRunRef.current = setInterval(async () => {
        try {
          const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
          await fetch(
            `https://${projectId}.supabase.co/functions/v1/import-ecomdrive-batch`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            }
          );
          onRefresh();
        } catch (e) {
          console.error("Auto-run import error:", e);
        }
      }, 30000);
    } else {
      if (autoRunRef.current) {
        clearInterval(autoRunRef.current);
        autoRunRef.current = null;
      }
    }

    return () => {
      if (autoRunRef.current) {
        clearInterval(autoRunRef.current);
        autoRunRef.current = null;
      }
    };
  }, [job?.status, source, onRefresh]);


  const handleStart = async () => {
    setToggling(true);
    if (!job) {
      const { error } = await supabase.from("import_progress").insert({
        source,
        current_invoice: 1,
        max_invoice: source === "ecomdrive_backfill" ? 41000 : 39000,
        status: "running",
        started_at: new Date().toISOString(),
      } as any);
      if (error) toast.error(error.message);
      else toast.success(t("শুরু হয়েছে!", "Started!"));
    } else {
      const { error } = await supabase
        .from("import_progress")
        .update({ status: "running", updated_at: new Date().toISOString() } as any)
        .eq("id", job.id);
      if (error) toast.error(error.message);
      else toast.success(t("চালু হয়েছে!", "Resumed!"));
    }
    await onRefresh();
    setToggling(false);
  };

  const handlePause = async () => {
    if (!job) return;
    setToggling(true);
    const { error } = await supabase
      .from("import_progress")
      .update({ status: "paused", updated_at: new Date().toISOString() } as any)
      .eq("id", job.id);
    if (error) toast.error(error.message);
    else toast.info(t("পজ করা হয়েছে", "Paused"));
    await onRefresh();
    setToggling(false);
  };

  const handleReset = async () => {
    if (!job) return;
    if (!confirm(t("রিসেট করলে প্রগ্রেস মুছে যাবে। নিশ্চিত?", "Reset will clear progress. Sure?"))) return;
    setToggling(true);
    const { error } = await supabase
      .from("import_progress")
      .update({
        current_invoice: 1,
        total_imported: 0,
        total_skipped: 0,
        total_errors: 0,
        status: "paused",
        started_at: null,
        last_run_at: null,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", job.id);
    if (error) toast.error(error.message);
    await onRefresh();
    setToggling(false);
  };

  const progressPct = job ? Math.round((job.current_invoice / job.max_invoice) * 100) : 0;
  const isRunning = job?.status === "running";
  const isCompleted = job?.status === "completed";

  const getEta = () => {
    if (!job || !isRunning || !job.started_at) return null;
    const elapsed = Date.now() - new Date(job.started_at).getTime();
    const done = job.current_invoice - 1;
    if (done <= 0) return null;
    const ratePerMs = done / elapsed;
    const remaining = job.max_invoice - job.current_invoice;
    const etaMs = remaining / ratePerMs;
    const hours = Math.floor(etaMs / 3600000);
    const mins = Math.floor((etaMs % 3600000) / 60000);
    if (hours > 0) return `~${hours}ঘ ${mins}মি`;
    return `~${mins}মি`;
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="text-xs">{description}</CardDescription>
            </div>
          </div>
          <Badge variant={isRunning ? "default" : isCompleted ? "secondary" : "outline"} className={isRunning ? "animate-pulse" : ""}>
            {isRunning ? "⚡ চলছে" : isCompleted ? "✅ সম্পন্ন" : "⏸ বিরতি"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>Invoice #{job?.current_invoice || 1}</span>
            <span>{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-2.5" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-muted/60 rounded-lg p-2.5 text-center">
            <p className="text-xs text-muted-foreground">{t("ইমপোর্টেড", "Imported")}</p>
            <p className="text-lg font-bold text-green-600">{job?.total_imported || 0}</p>
          </div>
          <div className="bg-muted/60 rounded-lg p-2.5 text-center">
            <p className="text-xs text-muted-foreground">{t("স্কিপড", "Skipped")}</p>
            <p className="text-lg font-bold text-muted-foreground">{job?.total_skipped || 0}</p>
          </div>
          <div className="bg-muted/60 rounded-lg p-2.5 text-center">
            <p className="text-xs text-muted-foreground">{t("ত্রুটি", "Errors")}</p>
            <p className="text-lg font-bold text-destructive">{job?.total_errors || 0}</p>
          </div>
          <div className="bg-muted/60 rounded-lg p-2.5 text-center">
            <p className="text-xs text-muted-foreground">{t("বাকি সময়", "ETA")}</p>
            <p className="text-lg font-bold">{isRunning ? (getEta() || "...") : isCompleted ? "—" : "⏸"}</p>
          </div>
        </div>

        {job?.last_run_at && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            {t("শেষ রান:", "Last run:")} {new Date(job.last_run_at).toLocaleString("bn-BD")}
          </div>
        )}

        <div className="flex gap-2">
          {!isRunning && !isCompleted && (
            <Button onClick={handleStart} disabled={toggling} className="gap-2 flex-1">
              {toggling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {job ? t("চালু করো", "Resume") : t("শুরু করো", "Start")}
            </Button>
          )}
          {isRunning && (
            <Button onClick={handlePause} disabled={toggling} variant="outline" className="gap-2 flex-1">
              {toggling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pause className="w-4 h-4" />}
              {t("বিরতি দাও", "Pause")}
            </Button>
          )}
          {isCompleted && (
            <div className="flex items-center gap-2 text-sm text-green-600 flex-1">
              <CheckCircle2 className="w-4 h-4" />
              {t("সম্পন্ন!", "Completed!")}
            </div>
          )}
          {job && !isRunning && (
            <Button onClick={handleReset} variant="ghost" size="icon" disabled={toggling} title={t("রিসেট", "Reset")}>
              <RotateCcw className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function EcomDriveImportSection() {
  const { t } = useLanguage();
  const [backfillJob, setBackfillJob] = useState<ImportJob | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    const { data } = await supabase
      .from("import_progress")
      .select("*")
      .eq("source", "ecomdrive_backfill");
    
    const jobs = (data || []) as ImportJob[];
    setBackfillJob((jobs.find((j: any) => j.source === "ecomdrive_backfill") as ImportJob) || null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  if (loading) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-display font-semibold text-foreground">
        {t("বাহ্যিক ইমপোর্ট", "External Import")}
      </h2>
      
      <ImportJobCard
        job={backfillJob}
        source="ecomdrive_backfill"
        title={t("প্রোডাক্ট আইটেম ব্যাকফিল", "Product Items Backfill")}
        description={t("বিদ্যমান ECD অর্ডারে প্রোডাক্ট আইটেম যোগ করো", "Add product items to existing ECD orders")}
        icon={PackagePlus}
        onRefresh={fetchJobs}
      />
    </div>
  );
}
