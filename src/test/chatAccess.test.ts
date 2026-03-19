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
  it("routes regular user to proxy with quota", () => {
    const result = deriveChatAccess("user", sampleQuota);
    expect(result.isSubscriptionUser).toBe(true);
    expect(result.effectiveQuota).toBe(sampleQuota);
  });

  it("routes admin to BYOK (direct OpenRouter)", () => {
    const result = deriveChatAccess("admin", sampleQuota);
    expect(result.isSubscriptionUser).toBe(false);
    expect(result.effectiveQuota).toEqual(BYOK_FALLBACK_QUOTA);
  });

  it("routes op to BYOK (direct OpenRouter)", () => {
    const result = deriveChatAccess("op", sampleQuota);
    expect(result.isSubscriptionUser).toBe(false);
    expect(result.effectiveQuota).toEqual(BYOK_FALLBACK_QUOTA);
  });

  it("routes moderator to BYOK (direct OpenRouter)", () => {
    const result = deriveChatAccess("moderator", sampleQuota);
    expect(result.isSubscriptionUser).toBe(false);
    expect(result.effectiveQuota).toEqual(BYOK_FALLBACK_QUOTA);
  });
});
