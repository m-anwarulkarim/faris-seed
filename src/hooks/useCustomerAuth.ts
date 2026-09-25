import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useCustomerAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Check if the current URL contains OAuth tokens or auth code
    const hasAuthHashOrCode =
      window.location.hash.includes("access_token") ||
      window.location.hash.includes("error") ||
      window.location.search.includes("code=");

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
      } else if (!hasAuthHashOrCode) {
        // Only mark loading false if there are no OAuth tokens being processed in the URL
        setLoading(false);
      }
    });

    // Safety timeout in case URL has OAuth params but auth state takes time to resolve
    const timeout = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 3000);

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  return { session, user, loading };
}
