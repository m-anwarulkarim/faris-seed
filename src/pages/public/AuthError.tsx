import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Copy, RefreshCw, ArrowLeft, Bug } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { Section } from "@/components/pub/section";
import { Card, CardContent } from "@/components/pub/card";
import { Button } from "@/components/ui/button";

export default function AuthErrorPage() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [authData, setAuthData] = useState<{
    urlHash: string;
    urlSearch: string;
    errorCode: string | null;
    errorDesc: string | null;
    sessionUser: string | null;
    sessionProvider: string | null;
    sessionError: string | null;
  }>({
    urlHash: "",
    urlSearch: "",
    errorCode: null,
    errorDesc: null,
    sessionUser: null,
    sessionProvider: null,
    sessionError: null,
  });

  useEffect(() => {
    const hash = window.location.hash;
    const search = window.location.search;
    const hashParams = new URLSearchParams(hash.replace(/^#/, "?"));
    const searchParams = new URLSearchParams(search);

    const errCode = hashParams.get("error_code") || searchParams.get("error_code") || hashParams.get("error") || searchParams.get("error");
    const errDesc = hashParams.get("error_description") || searchParams.get("error_description");

    supabase.auth.getSession().then(({ data, error }) => {
      setAuthData({
        urlHash: hash,
        urlSearch: search,
        errorCode: errCode,
        errorDesc: errDesc ? decodeURIComponent(errDesc.replace(/\+/g, " ")) : null,
        sessionUser: data.session?.user?.email ?? null,
        sessionProvider: data.session?.user?.app_metadata?.provider ?? null,
        sessionError: error?.message ?? null,
      });
    });
  }, []);

  const fullDiagnosticLog = JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      current_url: window.location.href,
      error_code: authData.errorCode,
      error_description: authData.errorDesc,
      session_user: authData.sessionUser,
      session_provider: authData.sessionProvider,
      session_error: authData.sessionError,
      url_hash: authData.urlHash,
      url_search: authData.urlSearch,
    },
    null,
    2
  );

  function copyLog() {
    navigator.clipboard.writeText(fullDiagnosticLog);
    setCopied(true);
    toast.success("এরর রিপোর্ট কপি হয়েছে!");
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <Navbar />
      <main className="flex-1 py-10">
        <Section spacing="sm" width="narrow">
          <Card variant="panel" className="mx-auto w-full max-w-xl border-destructive/30 shadow-xl">
            <CardContent className="p-6 sm:p-8 space-y-6">
              <div className="flex items-center gap-3 border-b border-border/60 pb-4">
                <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                  <Bug className="size-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-foreground">
                    লগইন ডায়াগনস্টিক ও এরর রিপোর্ট
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    Google OAuth বা Supabase সেটিংসের সমস্যা অনুসন্ধানের বিবরণ
                  </p>
                </div>
              </div>

              {/* Error Status Box */}
              {authData.errorCode || authData.errorDesc || authData.sessionError ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="size-4" />
                    <span>সমস্যার বিবরণ:</span>
                  </div>
                  {authData.errorCode && (
                    <div className="text-xs font-mono bg-destructive/10 p-1.5 rounded">
                      Code: {authData.errorCode}
                    </div>
                  )}
                  {authData.errorDesc && (
                    <p className="text-xs leading-relaxed">{authData.errorDesc}</p>
                  )}
                  {authData.sessionError && (
                    <p className="text-xs leading-relaxed font-mono">Session Error: {authData.sessionError}</p>
                  )}
                </div>
              ) : authData.sessionUser ? (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-300 space-y-1">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    <span>ইউজার লগইন সক্রিয় আছে!</span>
                  </div>
                  <p className="text-xs">Email: {authData.sessionUser} ({authData.sessionProvider})</p>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300">
                  <p className="text-xs">
                    কোনো সক্রিয় লগইন সেশন বা সরাসরি URL এরর পাওয়া যায়নি। আপনি নতুন করে লগইন চেষ্টা করতে পারেন।
                  </p>
                </div>
              )}

              {/* Helpful Explanations */}
              <div className="space-y-2 text-xs text-muted-foreground bg-card p-4 rounded-lg border border-border">
                <h3 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                  💡 সম্ভাব্য কারণ ও সমাধান:
                </h3>
                <ul className="list-disc pl-4 space-y-1.5 leading-relaxed">
                  <li>
                    <strong>Google Consent Screen (Testing Mode):</strong> Google Cloud Console-এ প্রজেক্টটি if "Testing" মোডে থাকে, তবে নির্দিষ্ট টেস্ট জিমেইল ছাড়া নতুন কোনো জিমেইল দিয়ে গুগল সাইন-ইন করা যাবে না।
                  </li>
                  <li>
                    <strong>Existing Email:</strong> এই জিমেইল দিয়ে পূর্বে ইমেইল/পাসওয়ার্ড দিয়ে অ্যাকাউন্ট করা থাকলে গুগল লগইনে বাধা দিতে পারে।
                  </li>
                  <li>
                    <strong>Incognito / 3rd Party Cookies:</strong> ইনকগনিটো মোডে ব্রাউজারের কুকিজ ব্লক থাকলে লগইন রিডাইরেক্ট সম্পূর্ণ নাও হতে পারে।
                  </li>
                </ul>
              </div>

              {/* Raw JSON details */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  কারিগরি লগ (ডিবগিং ডাটা):
                </label>
                <pre className="p-3 bg-slate-950 text-slate-100 rounded-md text-[11px] font-mono overflow-x-auto max-h-48">
                  {fullDiagnosticLog}
                </pre>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60">
                <Button variant="outline" size="sm" onClick={copyLog} className="gap-2">
                  {copied ? <CheckCircle2 className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                  {copied ? "কপি হয়েছে" : "এরর কোড কপি করুন"}
                </Button>

                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => navigate("/auth")} className="gap-1.5">
                    <RefreshCw className="size-4" /> পুনরায় লগইন
                  </Button>
                  <Button variant="default" size="sm" asChild>
                    <Link to="/" className="gap-1.5">
                      <ArrowLeft className="size-4" /> হোম
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </Section>
      </main>
      <Footer />
    </div>
  );
}
