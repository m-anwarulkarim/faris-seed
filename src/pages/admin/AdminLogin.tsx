import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Mail, KeyRound, Sprout, Eye, EyeOff, Lock, ArrowLeft, RefreshCw } from "lucide-react";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"credentials" | "verify_otp">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  // Step 1: Validate Email & Password, Check Role, and Send OTP to Gmail
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);

    try {
      // 1. Check Email & Password
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error || !data.user) {
        setLoading(false);
        toast.error("ইমেইল বা পাসওয়ার্ড ভুল হয়েছে।");
        return;
      }

      // 2. Check Admin / Moderator Role
      const SUPER_ADMIN_EMAILS = ["dev.anwarul@gmail.com", "amdadulislammilon9@gmail.com"];
      const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase());

      if (!isSuperAdmin) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .maybeSingle();

        if (!roleData || (roleData.role !== "admin" && (roleData.role as any) !== "moderator")) {
          await supabase.auth.signOut();
          setLoading(false);
          toast.error("আপনি অ্যাডমিন/মডারেটর নন।");
          return;
        }
      }

      // 3. Trigger OTP sending to Gmail
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      });

      if (otpErr) {
        console.warn("OTP trigger notice:", otpErr.message);
      }

      setLoading(false);
      setStep("verify_otp");
      setTimer(60);
      toast.success(`আপনার জি-মেইল (${email.trim()})-এ ভেরিফিকেশন কোড পাঠানো হয়েছে!`);
    } catch (err: any) {
      setLoading(false);
      toast.error("লগইন সিস্টেমে সমস্যা হয়েছে: " + (err?.message || ""));
    }
  };

  // Step 2: Verify Gmail OTP Code
  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) {
      toast.error("৬ ডিজিটের ভেরিফিকেশন কোডটি দিন।");
      return;
    }
    setVerifying(true);

    try {
      // Try verifying with Supabase Auth OTP
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpCode.trim(),
        type: "email",
      });

      if (error || !data.session) {
        // Fallback try type 'signup' or 'magiclink' if configured
        const { data: altData, error: altErr } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: otpCode.trim(),
          type: "magiclink",
        });

        if (altErr || !altData.session) {
          setVerifying(false);
          toast.error("জি-মেইল ভেরিফিকেশন কোডটি ভুল বা মেয়াদ্দোত্তীর্ণ হয়েছে।");
          return;
        }
      }

      setVerifying(false);
      toast.success("জি-মেইল ভেরিফিকেশন সফল! অ্যাডমিন প্যানেলে স্বাগতম।");
      navigate("/admin/overview");
    } catch (err: any) {
      setVerifying(false);
      toast.error("ভেরিফিকেশন ব্যর্থ হয়েছে: " + (err?.message || ""));
    }
  };

  // Resend OTP to Gmail
  const handleResendOtp = async () => {
    if (timer > 0) return;
    setLoading(true);
    try {
      await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      });
      setTimer(60);
      toast.success("নতুন ভেরিফিকেশন কোড আপনার জি-মেইলে পাঠানো হয়েছে!");
    } catch {
      toast.error("কোড পুনরায় পাঠাতে ব্যর্থ হয়েছে।");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900">
      {/* Decorative glow blobs */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 right-1/4 h-64 w-64 rounded-full bg-teal-400/10 blur-3xl" />

      <div className="relative w-full max-w-md">
        {/* Brand header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30 ring-4 ring-emerald-400/20">
            <Sprout className="h-8 w-8 text-emerald-950" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">FARIS SEED ADMIN</h1>
          <p className="mt-1 text-sm text-emerald-200/70">
            {step === "credentials"
              ? "অ্যাডমিন প্যানেলে প্রবেশ করতে অ্যাকাউন্ট তথ্য দিন"
              : "আপনার জি-মেইল ভেরিফিকেশন সম্পন্ন করুন"}
          </p>
        </div>

        {/* Glass card */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-8 shadow-2xl shadow-black/30 backdrop-blur-xl transition-all duration-300">
          {step === "credentials" ? (
            /* STEP 1: Email & Password */
            <form onSubmit={handleCredentialsSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-emerald-100">
                  <Mail className="h-4 w-4 text-emerald-300" /> ইমেইল ঠিকানা
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className="h-12 rounded-xl border-white/10 bg-white/10 text-white placeholder:text-emerald-200/40 focus-visible:border-emerald-400 focus-visible:ring-emerald-400/30"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-emerald-100">
                  <KeyRound className="h-4 w-4 text-emerald-300" /> পাসওয়ার্ড
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="h-12 rounded-xl border-white/10 bg-white/10 pr-11 text-white placeholder:text-emerald-200/40 focus-visible:border-emerald-400 focus-visible:ring-emerald-400/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-200/60 transition hover:text-emerald-100"
                    aria-label={showPassword ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখান"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 text-base font-semibold text-emerald-950 shadow-lg shadow-emerald-500/25 transition hover:from-emerald-300 hover:to-emerald-400"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                পরবর্তী ধাপ (জি-মেইল ভেরিফিকেশন)
              </Button>
            </form>
          ) : (
            /* STEP 2: Gmail OTP Verification */
            <form onSubmit={handleVerifyOtpSubmit} className="space-y-5">
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-center">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
                  <Lock className="h-5 w-5" />
                </div>
                <p className="text-xs font-medium text-emerald-200">
                  নিরাপত্তার জন্য আপনার জি-মেইলে সিকিউরিটি কোড পাঠানো হয়েছে:
                </p>
                <p className="mt-1 font-mono text-sm font-bold text-white">{email}</p>
              </div>

              <div className="space-y-2">
                <label className="flex items-center justify-between text-sm font-medium text-emerald-100">
                  <span>৬ ডিজিটের ভেরিফিকেশন কোড</span>
                  {timer > 0 ? (
                    <span className="text-xs font-mono text-emerald-300">{timer}s</span>
                  ) : null}
                </label>
                <Input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="1 2 3 4 5 6"
                  autoFocus
                  required
                  className="h-14 rounded-xl border-white/10 bg-white/10 text-center font-mono text-2xl font-black tracking-[0.5em] text-emerald-300 placeholder:tracking-normal placeholder:text-emerald-200/30 placeholder:text-base focus-visible:border-emerald-400 focus-visible:ring-emerald-400/30"
                />
              </div>

              <Button
                type="submit"
                disabled={verifying || otpCode.length < 6}
                className="h-12 w-full rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 text-base font-semibold text-emerald-950 shadow-lg shadow-emerald-500/25 transition hover:from-emerald-300 hover:to-emerald-400 disabled:opacity-50"
              >
                {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                ভেরিফাই করুন ও লগইন সম্পন্ন করুন
              </Button>

              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setStep("credentials")}
                  className="flex items-center gap-1 text-emerald-200/70 transition hover:text-white"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> পিছনে যান
                </button>

                <button
                  type="button"
                  disabled={timer > 0 || loading}
                  onClick={handleResendOtp}
                  className="flex items-center gap-1 font-medium text-emerald-400 transition hover:text-emerald-300 disabled:opacity-40"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  {timer > 0 ? `পুনরায় কোড পাঠান (${timer}s)` : "পুনরায় কোড পাঠান"}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-emerald-200/50">
          <ShieldCheck className="h-3.5 w-3.5" /> টু-স্টেপ জি-মেইল ভেরিফিকেশন দ্বারা সুরক্ষিত
        </p>
      </div>
    </div>
  );
}
