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
const PRIVILEGED_ROLES: UserRole[] = ["admin", "op"];

/**
 * Determine chat access mode:
 * - Privileged roles (admin/op) → BYOK direct to OpenRouter/Mimo
 * - Moderator & user → Proxy with daily quota + credits
 */
export function deriveChatAccess(role: UserRole, quota: ChatQuota) {
  if (PRIVILEGED_ROLES.includes(role)) {
    return { isSubscriptionUser: false, effectiveQuota: BYOK_FALLBACK_QUOTA };
  }
  return { isSubscriptionUser: true, effectiveQuota: quota };
}
