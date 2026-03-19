import { type ChatQuota } from "@/services/openRouter";
import { type UserRole } from "@/hooks/useUserRole";

export const BYOK_FALLBACK_QUOTA: ChatQuota = {
  used: 0,
  limit: Number.POSITIVE_INFINITY,
  remaining: Number.POSITIVE_INFINITY,
  plan_name: "BYOK",
  tier: "all",
};

/** Privileged roles that use BYOK (own API key) instead of platform proxy */
const PRIVILEGED_ROLES: UserRole[] = ["admin", "op", "moderator"];

/**
 * Determine chat access mode:
 * - Privileged roles (admin/op/moderator) with BYOK key → BYOK direct to OpenRouter
 * - Privileged roles without key → error (must set key in Settings/API Settings)
 * - Regular users → always Proxy with daily quota (no BYOK access)
 */
export function deriveChatAccess(role: UserRole, quota: ChatQuota) {
  if (PRIVILEGED_ROLES.includes(role)) {
    return { isSubscriptionUser: false, effectiveQuota: BYOK_FALLBACK_QUOTA };
  }
  return { isSubscriptionUser: true, effectiveQuota: quota };
}
