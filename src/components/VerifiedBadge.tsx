import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

// Built-in always-verified usernames (system + owner fallback)
const BUILTIN_VERIFIED_USERNAMES = ["mina", "ab", "abrakib"];

type ProfileLike = {
  username?: string | null;
  is_verified?: boolean | null;
};

/**
 * Returns true if a profile (or username) is verified.
 * Accepts either a username string OR an object with `username` / `is_verified`.
 * - Built-in usernames (mina, ab, abrakib) are always verified.
 * - Otherwise relies on the DB `is_verified` flag.
 */
export function isVerified(input: string | ProfileLike | null | undefined): boolean {
  if (!input) return false;
  if (typeof input === "string") {
    return BUILTIN_VERIFIED_USERNAMES.includes(input.toLowerCase());
  }
  if (input.is_verified === true) return true;
  if (input.username && BUILTIN_VERIFIED_USERNAMES.includes(input.username.toLowerCase())) {
    return true;
  }
  return false;
}

export function VerifiedBadge({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <BadgeCheck
      className={cn("text-blue-500 shrink-0", className)}
      size={size}
      fill="currentColor"
      stroke="white"
      strokeWidth={1.5}
    />
  );
}
