import { type ChatQuota } from "@/services/openRouter";
import { type UserRole } from "@/hooks/useUserRole";

export const BYOK_FALLBACK_QUOTA: ChatQuota = {
  used: 0,
  limit: Number.POSITIVE_INFINITY,
  remaining: Number.POSITIVE_INFINITY,
  plan_name: "BYOK",
  tier: "all",
};

export function deriveChatAccess(role: UserRole, quota: ChatQuota, forceByok = false) {
  const isSubscriptionUser = !forceByok && role === "user";
  return {
    isSubscriptionUser,
    effectiveQuota: isSubscriptionUser ? quota : BYOK_FALLBACK_QUOTA,
  };
}
