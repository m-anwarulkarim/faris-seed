import { Badge } from "@/components/ui/badge";
import { Globe, Facebook, Instagram, Youtube, Search, MessageCircle, Send, Twitter, Linkedin } from "lucide-react";

const SOURCE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  facebook: { label: "Facebook", icon: Facebook, color: "bg-blue-100 text-blue-700 border-blue-200" },
  instagram: { label: "Instagram", icon: Instagram, color: "bg-pink-100 text-pink-700 border-pink-200" },
  google: { label: "Google", icon: Search, color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  youtube: { label: "YouTube", icon: Youtube, color: "bg-red-100 text-red-700 border-red-200" },
  tiktok: { label: "TikTok", icon: Globe, color: "bg-slate-100 text-slate-700 border-slate-200" },
  twitter: { label: "Twitter/X", icon: Twitter, color: "bg-sky-100 text-sky-700 border-sky-200" },
  linkedin: { label: "LinkedIn", icon: Linkedin, color: "bg-blue-100 text-blue-800 border-blue-200" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, color: "bg-green-100 text-green-700 border-green-200" },
  telegram: { label: "Telegram", icon: Send, color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  bing: { label: "Bing", icon: Search, color: "bg-amber-100 text-amber-700 border-amber-200" },
  referral: { label: "Referral", icon: Globe, color: "bg-purple-100 text-purple-700 border-purple-200" },
  direct: { label: "Direct", icon: Globe, color: "bg-muted text-muted-foreground border-border" },
};

interface SourceBadgeProps {
  source: string | null | undefined;
  createdByAdminId?: string | null;
  className?: string;
}

export function SourceBadge({ source, className }: SourceBadgeProps) {
  let key = (source || "direct").toLowerCase();
  if (key === "fb") key = "facebook";
  if (key === "ig") key = "instagram";
  if (key === "mina_ai") key = "direct";
  const config = SOURCE_CONFIG[key] || SOURCE_CONFIG.direct;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 ${className || ""}`}>
      <Badge variant="outline" className={`gap-1 text-[10px] font-medium px-1.5 py-0.5 ${config.color}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    </span>
  );
}
