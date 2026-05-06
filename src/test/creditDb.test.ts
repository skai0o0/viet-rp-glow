import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase client — all mock functions must be declared inside the factory
vi.mock("@/integrations/supabase/client", () => {
  const mockRpc = vi.fn();
  const mockGetSession = vi.fn();
  const mockFrom = vi.fn();
  return {
    supabase: {
      auth: { getSession: mockGetSession },
      rpc: mockRpc,
      from: mockFrom,
    },
    __mocks: { mockRpc, mockGetSession, mockFrom },
  };
});

// Import after mock setup
import { useCredits, fetchCreditPackages, fetchCreditHistory, fetchUserBalance } from "@/services/creditDb";
import { supabase } from "@/integrations/supabase/client";

// Get references to the mock functions
const { mockRpc, mockGetSession, mockFrom } = (vi.mocked(supabase) as any).__mocks ?? {};

function getMocks() {
  // Re-import to get fresh references
  const mod = vi.mocked(supabase);
  return {
    rpc: mod.rpc as unknown as ReturnType<typeof vi.fn>,
    getSession: mod.auth.getSession as unknown as ReturnType<typeof vi.fn>,
    from: mod.from as unknown as ReturnType<typeof vi.fn>,
  };
}

describe("creditDb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const m = getMocks();
    m.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
    });
  });

  describe("useCredits", () => {
    it("returns true when credit deduction succeeds", async () => {
      const m = getMocks();
      m.rpc.mockResolvedValue({ data: true, error: null });

      const result = await useCredits("chat_message", 1);

      expect(result).toBe(true);
      expect(m.rpc).toHaveBeenCalledWith("use_credits", {
        p_user_id: "user-1",
        p_feature: "chat_message",
        p_credits: 1,
      });
    });

    it("returns false when credit deduction fails (insufficient balance)", async () => {
      const m = getMocks();
      m.rpc.mockResolvedValue({ data: false, error: null });

      const result = await useCredits("chat_message", 1);

      expect(result).toBe(false);
    });

    it("returns false when RPC errors", async () => {
      const m = getMocks();
      m.rpc.mockResolvedValue({ data: null, error: { message: "RPC error" } });

      const result = await useCredits("chat_message", 1);

      expect(result).toBe(false);
    });

    it("returns false when not logged in", async () => {
      const m = getMocks();
      m.getSession.mockResolvedValue({ data: { session: null } });

      const result = await useCredits("chat_message", 1);

      expect(result).toBe(false);
      expect(m.rpc).not.toHaveBeenCalled();
    });
  });

  describe("fetchCreditPackages", () => {
    it("returns packages on success", async () => {
      const mockPackages = [
        { id: "1", name: "Starter", credits: 10, price: 50000, discount_percent: 0 },
        { id: "2", name: "Pro", credits: 50, price: 200000, discount_percent: 10 },
      ];
      const m = getMocks();
      m.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockPackages, error: null }),
          }),
        }),
      });

      const result = await fetchCreditPackages();

      expect(result).toEqual(mockPackages);
    });

    it("returns empty array on error", async () => {
      const m = getMocks();
      m.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: { message: "error" } }),
          }),
        }),
      });

      const result = await fetchCreditPackages();

      expect(result).toEqual([]);
    });
  });

  describe("fetchCreditHistory", () => {
    it("returns transactions on success", async () => {
      const mockTx = [
        { id: "1", user_id: "user-1", amount: -1, type: "usage", description: "chat", balance_after: 9, created_at: "2026-01-01" },
      ];
      const m = getMocks();
      m.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: mockTx, error: null }),
            }),
          }),
        }),
      });

      const result = await fetchCreditHistory();

      expect(result).toEqual(mockTx);
    });

    it("returns empty array when not logged in", async () => {
      const m = getMocks();
      m.getSession.mockResolvedValue({ data: { session: null } });

      const result = await fetchCreditHistory();

      expect(result).toEqual([]);
    });
  });

  describe("fetchUserBalance", () => {
    it("returns balance on success", async () => {
      const m = getMocks();
      m.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { balance: 42 }, error: null }),
          }),
        }),
      });

      const result = await fetchUserBalance();

      expect(result).toBe(42);
    });

    it("returns 0 on error", async () => {
      const m = getMocks();
      m.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: "error" } }),
          }),
        }),
      });

      const result = await fetchUserBalance();

      expect(result).toBe(0);
    });
  });
});
