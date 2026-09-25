import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useCustomerAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!isMounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        setLoading(false);
      } else {
        const isOAuthCallback =
          window.location.hash.includes("access_token") ||
          window.location.hash.includes("error") ||
          window.location.search.includes("code=");

        if (!isOAuthCallback) {
          setLoading(false);
        }
      }
    });

    const timer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 2500);

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  return { session, user, loading };
}
