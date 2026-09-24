import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Phone, KeyRound, ArrowLeft, UserCircle, Lock, ShieldCheck, AlertTriangle } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const CUSTOMER_SESSION_KEY = "customer-session";
const SESSION_TOKEN_KEY = "customer-session-token";

export interface CustomerSession {
  phone: string;
  profile_id: string;
  name: string | null;
  phone_verified: boolean;
  user_type?: string | null;
  session_token?: string | null;
}

export function getCustomerSession(): CustomerSession | null {
  try {
    const raw = localStorage.getItem(CUSTOMER_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Short-lived barrier set by clearCustomerSession() to block any in-flight
// async work (fetchData, AI AUTH_SUCCESS replay, post-order auto-login, etc.)
// from re-writing the session to localStorage right after a logout.
const LOGOUT_BARRIER_KEY = "customer-session-logout-at";
const LOGOUT_BARRIER_MS = 5000;

function isLogoutBarrierActive(): boolean {
  try {
    const raw = sessionStorage.getItem(LOGOUT_BARRIER_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    if (Date.now() - at > LOGOUT_BARRIER_MS) {
      sessionStorage.removeItem(LOGOUT_BARRIER_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function setCustomerSession(session: CustomerSession) {
  // Hard guard: if user just logged out, ignore stale writes from in-flight closures.
  if (isLogoutBarrierActive()) return;

  localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(session));
  if (session.session_token) {
    localStorage.setItem(SESSION_TOKEN_KEY, session.session_token);
  }
  // Watched-user alert (fire-and-forget) — must run before any return
  try {
    import("@/lib/watchedAlert").then(({ notifyWatchedActivity }) => {
      notifyWatchedActivity({
        action: "login",
        phone: session.phone,
        extra: session.name || undefined,
      });
    }).catch(() => {});
  } catch {}
}

export function getSessionToken(): string | null {
  return localStorage.getItem(SESSION_TOKEN_KEY);
}

export function clearCustomerSession() {
  try {
    sessionStorage.setItem(LOGOUT_BARRIER_KEY, String(Date.now()));
  } catch {}
  localStorage.removeItem(CUSTOMER_SESSION_KEY);
  localStorage.removeItem(SESSION_TOKEN_KEY);
}

type Step = "phone" | "otp" | "password" | "set_password" | "reset_otp" | "reset_new_password";

/**
 * Retry-aware wrapper around supabase.functions.invoke().
 * Handles transient "Failed to fetch" / cold-start network errors by retrying
 * up to 2 extra times with short backoff, instead of immediately surfacing
 * the misleading "সার্ভারের সাথে সংযোগে সমস্যা" toast.
 */
async function invokeWithRetry(fn: string, body: any, attempts = 3): Promise<{ data: any; error: any }> {
  let lastErr: any = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await supabase.functions.invoke(fn, { body });
      // If we got data back, return immediately even if `error` is set
      if (res.data) return res;
      // No data + error → retry
      lastErr = res.error;
    } catch (e) {
      lastErr = e;
    }
    if (i < attempts - 1) {
      // 400ms, 900ms backoff
      await new Promise((r) => setTimeout(r, 400 + i * 500));
    }
  }
  return { data: null, error: lastErr };
}

interface Props {
  onLogin: (session: CustomerSession) => void;
}

export default function CustomerLogin({ onLogin }: Props) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [step, setStep] = useState<Step>("phone");
  const [loading, setLoading] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [tempProfile, setTempProfile] = useState<any>(null);
  const [resetProfileId, setResetProfileId] = useState<string | null>(null);
  const [otpVerifyRemaining, setOtpVerifyRemaining] = useState(3);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = phone.trim();
    if (!trimmed || trimmed.length < 11) {
      toast.error("সঠিক ফোন নম্বর দিন");
      return;
    }

    setLoading(true);
    const { data, error: checkErr } = await invokeWithRetry("customer-auth", {
      action: "check_phone",
      phone: trimmed,
    });
    setLoading(false);

    // Even if `error` is set, prefer the structured body if it has a meaningful payload.
    if (checkErr && !data) {
      toast.error("সার্ভারের সাথে সংযোগে সমস্যা হচ্ছে — একটু পর আবার চেষ্টা করুন।");
      return;
    }

    if (data?.has_password) {
      setHasPassword(true);
      setProfileName(data.name);
      setStep("password");
    } else {
      setLoading(true);
      const { data: otpRes, error: otpErr } = await invokeWithRetry("customer-auth", {
        action: "send_otp",
        phone: trimmed,
      });
      setLoading(false);

      if (otpErr && !otpRes) {
        toast.error("OTP সার্ভারের সাথে সংযোগে সমস্যা হচ্ছে — একটু পর আবার চেষ্টা করুন।");
        return;
      }

      if (otpRes?.locked) {
        setIsLocked(true);
        toast.error(otpRes?.error || "অনেকবার চেষ্টা হয়েছে।");
        return;
      }

      if (otpRes?.success) {
        setOtpVerifyRemaining(3);
        setStep("otp");
        setCountdown(0);
        toast.success("OTP পাঠানো হয়েছে!");
      } else {
        toast.error(otpRes?.error || "OTP পাঠাতে সমস্যা হয়েছে");
      }
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    const { data } = await supabase.functions.invoke("customer-auth", {
      body: { action: "password_login", phone: phone.trim(), password: password.trim() },
    });
    setLoading(false);

    if (data?.locked) {
      setIsLocked(true);
      toast.error(data?.error);
      return;
    }

    if (data?.valid && data.profile) {
      const session: CustomerSession = {
        phone: phone.trim(),
        profile_id: data.profile.id,
        name: data.profile.name,
        phone_verified: true,
        session_token: data.session_token || null,
      };
      setCustomerSession(session);
      toast.success("সফলভাবে লগইন হয়েছে!");
      onLogin(session);
    } else {
      toast.error("পাসওয়ার্ড ভুল হয়েছে");
    }
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpValue.length !== 4 || loading) return;

    setLoading(true);
    const visitorId = localStorage.getItem("visitor-id");
    const { data } = await supabase.functions.invoke("customer-auth", {
      body: { action: "verify_otp", phone: phone.trim(), otp_code: otpValue, visitor_id: visitorId },
    });
    setLoading(false);

    if (data?.locked) {
      setIsLocked(true);
      toast.error(data?.error);
      return;
    }

    if (data?.valid && data.profile) {
      setTempProfile({ ...data.profile, _session_token: data.session_token });
      setStep("set_password");
    } else {
      const remaining = data?.remaining ?? 0;
      setOtpVerifyRemaining(remaining);
      if (data?.last_attempt) {
        toast.error("শেষ চেষ্টা! আবারও ব্যর্থ হলে আরও ১৫ মিনিট অপেক্ষা করুন অথবা কাস্টমার সাপোর্টে যোগাযোগ করুন।");
      } else {
        toast.error("OTP ভুল হয়েছে");
      }
      setOtpValue("");
    }
  };

  const handleSetPassword = async (skip = false) => {
    if (!skip && newPassword.trim().length < 6) {
      toast.error("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে");
      return;
    }

    let finalToken = tempProfile._session_token;

    if (!skip) {
      setLoading(true);
      const { data: setData } = await supabase.functions.invoke("customer-auth", {
        body: {
          action: "set_password",
          phone: phone.trim(),
          password: newPassword.trim(),
          profile_id: tempProfile.id,
        },
      });
      setLoading(false);
      toast.success("পাসওয়ার্ড সেট হয়েছে!");
      if (setData?.session_token) finalToken = setData.session_token;
    }

    const session: CustomerSession = {
      phone: phone.trim(),
      profile_id: tempProfile.id,
      name: tempProfile.name,
      phone_verified: true,
      session_token: finalToken || null,
    };
    setCustomerSession(session);
    // Meta Pixel: CompleteRegistration (fires on first password-set after OTP signup)
    import("@/lib/metaEvents").then(({ trackCompleteRegistration }) =>
      trackCompleteRegistration("phone", { ph: phone.trim(), fn: tempProfile.name || undefined })
    );
    onLogin(session);
  };

  // ─── Forgot Password Flow ───
  const handleForgotPassword = async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke("customer-auth", {
      body: { action: "reset_password_send_otp", phone: phone.trim() },
    });
    setLoading(false);

    if (data?.locked) {
      setIsLocked(true);
      toast.error(data?.error);
      return;
    }

    if (data?.success) {
      setResetProfileId(data.profile_id);
      setOtpValue("");
      setOtpVerifyRemaining(3);
      setStep("reset_otp");
      setCountdown(0);
      toast.success("পাসওয়ার্ড রিসেটের জন্য OTP পাঠানো হয়েছে!");
    } else {
      toast.error(data?.error || "OTP পাঠাতে সমস্যা হয়েছে");
    }
  };

  const handleResetOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpValue.length !== 4) return;
    setStep("reset_new_password");
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.trim().length < 6) {
      toast.error("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে");
      return;
    }

    setLoading(true);
    const { data } = await supabase.functions.invoke("customer-auth", {
      body: {
        action: "reset_password_verify",
        phone: phone.trim(),
        otp_code: otpValue,
        new_password: newPassword.trim(),
      },
    });

    if (data?.locked) {
      setLoading(false);
      setIsLocked(true);
      toast.error(data?.error);
      return;
    }

    if (data?.valid) {
      const { data: loginData } = await supabase.functions.invoke("customer-auth", {
        body: { action: "password_login", phone: phone.trim(), password: newPassword.trim() },
      });
      setLoading(false);

      if (loginData?.valid && loginData.profile) {
        const session: CustomerSession = {
          phone: phone.trim(),
          profile_id: loginData.profile.id,
          name: loginData.profile.name,
          phone_verified: true,
          session_token: loginData.session_token || null,
        };
        setCustomerSession(session);
        toast.success("পাসওয়ার্ড রিসেট হয়েছে ও লগইন সফল!");
        onLogin(session);
      } else {
        toast.success("পাসওয়ার্ড রিসেট হয়েছে! লগইন করুন।");
        setPassword("");
        setNewPassword("");
        setOtpValue("");
        setStep("password");
      }
    } else {
      setLoading(false);
      const remaining = data?.remaining ?? 0;
      setOtpVerifyRemaining(remaining);
      if (data?.last_attempt) {
        toast.error("শেষ চেষ্টা! আবারও ব্যর্থ হলে আরও ১৫ মিনিট অপেক্ষা করুন অথবা কাস্টমার সাপোর্টে যোগাযোগ করুন।");
      } else {
        toast.error(data?.error || "পাসওয়ার্ড রিসেট করতে সমস্যা হয়েছে");
      }
    }
  };

  const resendOtp = async () => {
    setLoading(true);
    const action = step === "reset_otp" ? "reset_password_send_otp" : "send_otp";
    const { data } = await supabase.functions.invoke("customer-auth", {
      body: { action, phone: phone.trim() },
    });
    setLoading(false);

    if (data?.locked) {
      setIsLocked(true);
      toast.error(data?.error);
      return;
    }

    if (data?.success) {
      setOtpVerifyRemaining(3);
      setCountdown(0);
      toast.success("নতুন OTP পাঠানো হয়েছে!");
    }
  };

  const formatCountdown = () => {
    const m = Math.floor(countdown / 60);
    const s = countdown % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const getTitle = () => {
    switch (step) {
      case "phone": return "লগইন করুন";
      case "password": return `স্বাগতম${profileName ? `, ${profileName}` : ""}!`;
      case "otp": return "OTP যাচাই";
      case "set_password": return "পাসওয়ার্ড সেট করুন";
      case "reset_otp": return "পাসওয়ার্ড রিসেট";
      case "reset_new_password": return "নতুন পাসওয়ার্ড";
    }
  };

  const getDescription = () => {
    switch (step) {
      case "phone": return "আপনার ফোন নম্বর দিন";
      case "password": return "আপনার পাসওয়ার্ড দিন";
      case "otp": return `${phone} নম্বরে পাঠানো ৪ সংখ্যার কোড দিন`;
      case "set_password": return "পরবর্তী সময়ে দ্রুত লগইনের জন্য একটি পাসওয়ার্ড সেট করুন (ঐচ্ছিক)";
      case "reset_otp": return `${phone} নম্বরে পাঠানো ৪ সংখ্যার কোড দিন`;
      case "reset_new_password": return "আপনার নতুন পাসওয়ার্ড দিন";
    }
  };

  return (
    <div className="flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md overflow-hidden border-0 shadow-2xl shadow-primary/10 relative">
        {/* Decorative gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/10 pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-56 h-56 rounded-full bg-gradient-to-br from-primary/30 to-secondary/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-20 w-64 h-64 rounded-full bg-gradient-to-tr from-secondary/25 to-primary/10 blur-3xl pointer-events-none" />

        <CardHeader className="text-center space-y-3 relative pt-8">
          <div className="mx-auto relative">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary to-secondary blur-md opacity-50" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/30">
              {(step === "reset_otp" || step === "reset_new_password")
                ? <ShieldCheck className="w-8 h-8 text-primary-foreground" />
                : <Phone className="w-8 h-8 text-primary-foreground" />
              }
            </div>
          </div>
          <CardTitle className="text-2xl font-display bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent">
            {getTitle()}
          </CardTitle>
          <CardDescription className="text-sm">{getDescription()}</CardDescription>
        </CardHeader>
        <CardContent className="relative pb-8">
          {isLocked && (
            <div className="mb-4 p-3 rounded-md bg-destructive/10 border border-destructive/20 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive">
                অ্যাকাউন্ট লক হয়েছে। ১৫ মিনিট পর আবার চেষ্টা করুন অথবা কাস্টমার সাপোর্টে যোগাযোগ করুন: 09617443377
              </p>
            </div>
          )}

          {step === "phone" && (
            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="tel"
                  placeholder="01XXXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-10"
                  required
                  autoFocus
                  disabled={isLocked}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || isLocked}>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                পরবর্তী
              </Button>
            </form>
          )}

          {step === "password" && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="পাসওয়ার্ড"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                  autoFocus
                  disabled={isLocked}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || isLocked}>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                লগইন করুন
              </Button>
              <Button
                type="button"
                variant="link"
                className="w-full text-sm text-primary"
                onClick={handleForgotPassword}
                disabled={loading || isLocked}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                পাসওয়ার্ড ভুলে গেছেন?
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-sm"
                onClick={() => { setStep("phone"); setPassword(""); setIsLocked(false); }}
              >
                <ArrowLeft className="w-4 h-4" /> অন্য নম্বর ব্যবহার করুন
              </Button>
            </form>
          )}

          {(step === "otp" || step === "reset_otp") && (
            <form onSubmit={step === "otp" ? handleOtpVerify : handleResetOtpVerify} className="space-y-5">
              <div className="flex justify-center">
                <InputOTP maxLength={4} value={otpValue} onChange={setOtpValue} autoComplete="one-time-code">
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {otpVerifyRemaining <= 1 && otpVerifyRemaining > 0 && !isLocked && (
                <p className="text-xs text-destructive flex items-center gap-1 justify-center">
                  <AlertTriangle className="w-3 h-3" />
                  শেষ চেষ্টা! ভুল হলে ১৫ মিনিট অপেক্ষা করতে হবে
                </p>
              )}

              <div className="text-center text-sm text-muted-foreground">
                <button type="button" onClick={resendOtp} className="text-primary hover:underline" disabled={loading || isLocked}>
                  আবার OTP পাঠান
                </button>
              </div>
              <Button type="submit" className="w-full" disabled={loading || otpValue.length !== 4 || isLocked}>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                যাচাই করুন
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => { 
                setStep(step === "reset_otp" ? "password" : "phone"); 
                setOtpValue(""); 
                setIsLocked(false);
              }}>
                <ArrowLeft className="w-4 h-4" /> ফিরে যান
              </Button>
            </form>
          )}

          {step === "reset_new_password" && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-10"
                  required
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                পাসওয়ার্ড রিসেট করুন
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => { 
                setStep("password"); 
                setNewPassword(""); 
                setOtpValue(""); 
              }}>
                <ArrowLeft className="w-4 h-4" /> ফিরে যান
              </Button>
            </form>
          )}

          {step === "set_password" && (
            <div className="space-y-4">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-10"
                  autoFocus
                />
              </div>
              <Button className="w-full" onClick={() => handleSetPassword(false)} disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                পাসওয়ার্ড সেট করুন
              </Button>
              <Button variant="ghost" className="w-full text-sm text-muted-foreground" onClick={() => handleSetPassword(true)}>
                এখন নয়, পরে করবো
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
