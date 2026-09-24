import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Shield } from "lucide-react";

interface CreatedByBadgeProps {
  adminId: string | null | undefined;
  statusChangedBy?: string | null | undefined;
}

export function CreatedByBadge({ adminId, statusChangedBy }: CreatedByBadgeProps) {
  const effectiveId = adminId || statusChangedBy;

  const { data } = useQuery({
    queryKey: ["admin-name", effectiveId],
    enabled: !!effectiveId,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-admin", {
        body: { action: "lookup", user_id: effectiveId },
      });
      if (error) return null;
      return data?.name || null;
    },
  });

  if (!effectiveId || !data) return null;

  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 mt-0.5 whitespace-nowrap">
      <Shield className="w-2.5 h-2.5" />
      {data}
    </span>
  );
}
