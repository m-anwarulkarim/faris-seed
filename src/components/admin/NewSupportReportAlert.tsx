import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

const POLL_MS = 10 * 60 * 1000; // 10 minutes
const SEEN_KEY = "ab_support_alert_seen_ids_v1";
const REPORTS_PATH = "/admin/support/reports";

type PendingReport = {
  id: string;
  subject: string | null;
  customer_name: string | null;
  created_at: string;
};

function loadSeen(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
function saveSeen(set: Set<string>) {
  try {
    // Cap to last 200 ids to avoid bloat
    const arr = Array.from(set).slice(-200);
    sessionStorage.setItem(SEEN_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

export function NewSupportReportAlert() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<PendingReport | null>(null);
  const seenRef = useRef<Set<string>>(loadSeen());
  const timerRef = useRef<number | null>(null);

  const check = useCallback(async () => {
    // Don't pop while user is already on reports page
    if (location.pathname.startsWith(REPORTS_PATH)) return;

    const { data, error } = await supabase
      .from("support_reports")
      .select("id, subject, customer_name, created_at")
      .in("status", ["pending", "open"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) return;

    const latest = data[0] as PendingReport;
    if (seenRef.current.has(latest.id)) return;

    setReport(latest);
    setOpen(true);
  }, [location.pathname]);

  useEffect(() => {
    // First check shortly after mount, then every 10 minutes
    const initial = window.setTimeout(check, 5000);
    timerRef.current = window.setInterval(check, POLL_MS);
    return () => {
      window.clearTimeout(initial);
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [check]);

  function handleAcknowledge() {
    if (report) {
      seenRef.current.add(report.id);
      saveSeen(seenRef.current);
    }
    setOpen(false);
    navigate(REPORTS_PATH);
  }

  function handleOpenChange(next: boolean) {
    // Dismiss without acknowledging: do NOT mark as seen,
    // so it will re-appear on the next 10-minute poll if still pending.
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg border-2 border-destructive/60 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-destructive/15 mx-auto mb-2">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <DialogTitle className="text-center text-2xl font-bold text-destructive">
            New Complaint Received
          </DialogTitle>
          <DialogDescription className="text-center text-base pt-2 space-y-2">
            <span className="block">
              A new customer complaint has been submitted. Please review and resolve it.
            </span>
            {report && (
              <span className="block mt-3 p-3 rounded-md bg-muted/60 text-left text-sm">
                <span className="block font-semibold text-foreground">
                  {report.subject || "Complaint"}
                </span>
                {report.customer_name && (
                  <span className="block text-muted-foreground">
                    From: {report.customer_name}
                  </span>
                )}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Dismiss
          </Button>
          <Button
            onClick={handleAcknowledge}
            className="w-full sm:flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground text-base font-semibold py-5"
          >
            OK — Open Reports
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
