// 🔒 DO_NOT_MODIFY: Phone OTP verification flow — full file locked. Modify only with explicit user permission.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to batch-check phone verification status for multiple phones.
 * Returns a Map<phone, boolean> indicating verification status.
 */
export function usePhoneVerificationMap(phones: string[]) {
  const uniquePhones = [...new Set(phones.filter(p => p && p.length >= 11))];

  const { data } = useQuery({
    queryKey: ["phone-verified-batch", uniquePhones.sort().join(",")],
    enabled: uniquePhones.length > 0,
    staleTime: 1000 * 60 * 10, // 10 min cache
    queryFn: async () => {
      const map = new Map<string, boolean>();
      // Query in batches of 50
      for (let i = 0; i < uniquePhones.length; i += 50) {
        const batch = uniquePhones.slice(i, i + 50);
        const { data: profiles } = await supabase
          .from("visitor_profiles")
          .select("phone, phone_verified")
          .in("phone", batch)
          .eq("phone_verified", true);
        profiles?.forEach(p => {
          if (p.phone) map.set(p.phone, true);
        });
      }
      return map;
    },
  });

  return data || new Map<string, boolean>();
}

/**
 * Hook to check verification for a single phone number.
 */
export function usePhoneVerified(phone: string | null | undefined) {
  const { data } = useQuery({
    queryKey: ["phone-verified", phone],
    enabled: !!phone && phone.length >= 11,
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("visitor_profiles")
        .select("phone_verified")
        .eq("phone", phone!)
        .eq("phone_verified", true)
        .maybeSingle();
      return !!profile;
    },
  });

  return data === true;
}
