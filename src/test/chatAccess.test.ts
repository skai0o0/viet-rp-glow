import { describe, expect, it } from "vitest";
import { BYOK_FALLBACK_QUOTA, deriveChatAccess } from "@/utils/chatAccess";

const sampleQuota = {
  used: 1,
  limit: 10,
  remaining: 9,
  plan_name: "Pro",
  tier: "pro",
};

describe("deriveChatAccess", () => {
  it("keeps subscription flow for user role", () => {
    const result = deriveChatAccess("user", sampleQuota);
    expect(result.isSubscriptionUser).toBe(true);
    expect(result.effectiveQuota).toBe(sampleQuota);
  });

  it("switches to BYOK fallback for admin-like roles", () => {
    const result = deriveChatAccess("admin", sampleQuota);
    expect(result.isSubscriptionUser).toBe(false);
    expect(result.effectiveQuota).toEqual(BYOK_FALLBACK_QUOTA);
  });

  it("can force BYOK even for user role", () => {
    const result = deriveChatAccess("user", sampleQuota, true);
    expect(result.isSubscriptionUser).toBe(false);
    expect(result.effectiveQuota).toEqual(BYOK_FALLBACK_QUOTA);
  });
});
