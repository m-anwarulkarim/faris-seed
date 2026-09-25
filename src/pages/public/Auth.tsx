import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Mail, KeyRound, UserRound } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { Section } from "@/components/pub/section";
import { Card, CardContent } from "@/components/pub/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate("/account", { replace: true });
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/account", { replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) {
      toast.error("ইমেইল বা পাসওয়ার্ড ভুল হয়েছে।");
      return;
    }
    toast.success("সফলভাবে লগইন হয়েছে!");
    navigate("/account", { replace: true });
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/account`,
        data: { full_name: name.trim() },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(
        error.message.includes("already")
          ? "এই ইমেইলে অ্যাকাউন্ট আছে — লগইন করুন।"
          : "অ্যাকাউন্ট তৈরি করতে সমস্যা হয়েছে।"
      );
      return;
    }
    if (!data.session) {
      toast.success("ইমেইলে একটি কনফার্মেশন লিংক পাঠানো হয়েছে — সেটি ক্লিক করুন।");
      return;
    }
    navigate("/account", { replace: true });
  }

  async function handleGoogle() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/account`,
      },
    });
    if (error) {
      setLoading(false);
      console.error("Google OAuth error:", error);
      toast.error(error.message || "Google দিয়ে লগইন করা যায়নি।");
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Section spacing="lg" width="narrow">
          <Card variant="panel" className="mx-auto w-full max-w-md">
            <CardContent className="p-6 sm:p-8">
              <h1 className="text-center font-display text-2xl font-bold">অ্যাকাউন্ট</h1>
              <p className="mt-1 text-center text-sm text-muted-foreground">
                ইমেইল অথবা Google দিয়ে লগইন করুন
              </p>

              <Button
                type="button"
                variant="outline"
                className="mt-6 w-full"
                onClick={handleGoogle}
                disabled={loading}
              >
                Google দিয়ে চালিয়ে যান
              </Button>

              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> অথবা <span className="h-px flex-1 bg-border" />
              </div>

              <Tabs defaultValue="signin">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">লগইন</TabsTrigger>
                  <TabsTrigger value="signup">নতুন অ্যাকাউন্ট</TabsTrigger>
                </TabsList>

                <TabsContent value="signin">
                  <form onSubmit={handleSignIn} className="mt-4 space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="si-email" className="flex items-center gap-2">
                        <Mail className="size-4" /> ইমেইল
                      </Label>
                      <Input
                        id="si-email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="si-pass" className="flex items-center gap-2">
                        <KeyRound className="size-4" /> পাসওয়ার্ড
                      </Label>
                      <Input
                        id="si-pass"
                        type="password"
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                      লগইন করুন
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="mt-4 space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="su-name" className="flex items-center gap-2">
                        <UserRound className="size-4" /> আপনার নাম
                      </Label>
                      <Input
                        id="su-name"
                        required
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="যেমন: রফিকুল ইসলাম"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="su-email" className="flex items-center gap-2">
                        <Mail className="size-4" /> ইমেইল
                      </Label>
                      <Input
                        id="su-email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="su-pass" className="flex items-center gap-2">
                        <KeyRound className="size-4" /> পাসওয়ার্ড
                      </Label>
                      <Input
                        id="su-pass"
                        type="password"
                        required
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="কমপক্ষে ৬ অক্ষর"
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                      অ্যাকাউন্ট তৈরি করুন
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </Section>
      </main>
      <Footer />
    </div>
  );
}
