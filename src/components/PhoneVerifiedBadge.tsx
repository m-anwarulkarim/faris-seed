import { VerifiedBadge } from "@/components/VerifiedBadge";

interface PhoneVerifiedBadgeProps {
  /** Pass true if verified (from parent batch query or single query) */
  verified: boolean;
  size?: number;
  className?: string;
}

/**
 * Shows a blue verified badge next to a phone number if OTP-verified.
 * The parent is responsible for checking verification status via usePhoneVerificationMap or usePhoneVerified.
 */
export function PhoneVerifiedBadge({ verified, size = 14, className }: PhoneVerifiedBadgeProps) {
  if (!verified) return null;
  return <VerifiedBadge size={size} className={className} />;
}
