import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Mail, KeyRound, Sprout, Eye, EyeOff } from "lucide-react";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });

    if (error || !data.user) {
      setLoading(false);
      toast.error("ইমেইল বা পাসওয়ার্ড ভুল হয়েছে।");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .in("role", ["admin", "moderator"])
      .maybeSingle();

    if (!roleData) {
      await supabase.auth.signOut();
      setLoading(false);
      toast.error("আপনি অ্যাডমিন/মডারেটর নন।");
      return;
    }

    setLoading(false);
    toast.success("সফলভাবে লগইন হয়েছে!");
    navigate("/e/overview");
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
          <h1 className="text-2xl font-bold tracking-tight text-white">AB Seed অ্যাডমিন</h1>
          <p className="mt-1 text-sm text-emerald-200/70">কন্ট্রোল প্যানেলে প্রবেশ করতে লগইন করুন</p>
        </div>

        {/* Glass card */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-8 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-emerald-100">
                <Mail className="h-4 w-4 text-emerald-300" /> ইমেইল
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
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              লগইন করুন
            </Button>
          </form>
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-emerald-200/50">
          <ShieldCheck className="h-3.5 w-3.5" /> শুধুমাত্র অনুমোদিত অ্যাডমিন ও মডারেটরদের জন্য
        </p>
      </div>
    </div>
  );
}
