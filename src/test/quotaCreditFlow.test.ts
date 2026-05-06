import { describe, it, expect } from "vitest";

/**
 * Tests for the quota + credit fallback logic used in ChatPage.
 * These test the pure decision logic, not the React component.
 */

interface QuotaState {
  remaining: number;
  limit: number;
  used: number;
  plan_name: string;
  tier: string;
}

function shouldUseCredit(quota: QuotaState, isSubscriptionUser: boolean): boolean {
  return isSubscriptionUser && quota.remaining <= 0;
}

function canSendMessage(quota: QuotaState, isSubscriptionUser: boolean, creditBalance: number): {
  allowed: boolean;
  method: "quota" | "credit" | "blocked";
} {
  if (!isSubscriptionUser) {
    return { allowed: true, method: "quota" };
  }

  if (quota.remaining > 0) {
    return { allowed: true, method: "quota" };
  }

  if (creditBalance > 0) {
    return { allowed: true, method: "credit" };
  }

  return { allowed: false, method: "blocked" };
}

describe("quotaCreditFlow", () => {
  const fullQuota: QuotaState = { remaining: 20, limit: 20, used: 0, plan_name: "Free", tier: "free" };
  const exhaustedQuota: QuotaState = { remaining: 0, limit: 20, used: 20, plan_name: "Free", tier: "free" };
  const lowQuota: QuotaState = { remaining: 1, limit: 20, used: 19, plan_name: "Free", tier: "free" };

  describe("shouldUseCredit", () => {
    it("returns false when quota is available", () => {
      expect(shouldUseCredit(fullQuota, true)).toBe(false);
    });

    it("returns false for non-subscription users (BYOK)", () => {
      expect(shouldUseCredit(exhaustedQuota, false)).toBe(false);
    });

    it("returns true when quota is exhausted for subscription user", () => {
      expect(shouldUseCredit(exhaustedQuota, true)).toBe(true);
    });

    it("returns false when quota has 1 remaining", () => {
      expect(shouldUseCredit(lowQuota, true)).toBe(false);
    });
  });

  describe("canSendMessage", () => {
    it("allows BYOK users regardless of quota", () => {
      const result = canSendMessage(exhaustedQuota, false, 0);
      expect(result.allowed).toBe(true);
      expect(result.method).toBe("quota");
    });

    it("uses quota when available", () => {
      const result = canSendMessage(fullQuota, true, 10);
      expect(result.allowed).toBe(true);
      expect(result.method).toBe("quota");
    });

    it("falls back to credit when quota exhausted and credits available", () => {
      const result = canSendMessage(exhaustedQuota, true, 5);
      expect(result.allowed).toBe(true);
      expect(result.method).toBe("credit");
    });

    it("blocks when both quota and credits exhausted", () => {
      const result = canSendMessage(exhaustedQuota, true, 0);
      expect(result.allowed).toBe(false);
      expect(result.method).toBe("blocked");
    });

    it("uses quota when exactly 1 remaining", () => {
      const result = canSendMessage(lowQuota, true, 10);
      expect(result.allowed).toBe(true);
      expect(result.method).toBe("quota");
    });

    it("uses credit when quota is exactly 0", () => {
      const zeroQuota: QuotaState = { remaining: 0, limit: 20, used: 20, plan_name: "Free", tier: "free" };
      const result = canSendMessage(zeroQuota, true, 1);
      expect(result.allowed).toBe(true);
      expect(result.method).toBe("credit");
    });
  });
});
