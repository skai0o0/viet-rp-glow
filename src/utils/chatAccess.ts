import { type ChatQuota } from "@/services/openRouter";
import { type UserRole } from "@/hooks/useUserRole";

export const BYOK_FALLBACK_QUOTA: ChatQuota = {
  used: 0,
  limit: Number.POSITIVE_INFINITY,
  remaining: Number.POSITIVE_INFINITY,
  plan_name: "BYOK",
  tier: "all",
};

/** Roles that bypass subscription quota and use the platform proxy with no limit */
const PRIVILEGED_ROLES: UserRole[] = ["admin", "op", "moderator"];

export function deriveChatAccess(role: UserRole, quota: ChatQuota, forceByok = false) {
  if (forceByok) {
    return { isSubscriptionUser: false, effectiveQuota: BYOK_FALLBACK_QUOTA };
  }
  // Privileged roles use the platform proxy (not BYOK) but have no quota limit
  if (PRIVILEGED_ROLES.includes(role)) {
    return { isSubscriptionUser: true, effectiveQuota: BYOK_FALLBACK_QUOTA };
  }
  return { isSubscriptionUser: true, effectiveQuota: quota };
}
