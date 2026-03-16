import { describe, it, expect } from "vitest";
import type { UserRole } from "@/hooks/useUserRole";

// Helper: compute the derived booleans the same way the hook does
function computeRoleFlags(role: UserRole) {
  const isAdmin = role === "admin";
  const isOp = role === "op";
  const isModerator = role === "moderator";
  return {
    isAdmin,
    isOp,
    isModerator,
    isAdminOrOp: isAdmin || isOp,
    canViewAdminHub: isAdmin || isOp || isModerator,
    canEditAdminHub: isAdmin || isOp,
    canRunDangerousAdmin: isAdmin,
  };
}

describe("useUserRole — helper boolean flags", () => {
  describe("admin role", () => {
    const flags = computeRoleFlags("admin");

    it("isAdmin should be true", () => expect(flags.isAdmin).toBe(true));
    it("isOp should be false", () => expect(flags.isOp).toBe(false));
    it("isModerator should be false", () => expect(flags.isModerator).toBe(false));
    it("isAdminOrOp should be true", () => expect(flags.isAdminOrOp).toBe(true));
    it("canViewAdminHub should be true", () => expect(flags.canViewAdminHub).toBe(true));
    it("canEditAdminHub should be true", () => expect(flags.canEditAdminHub).toBe(true));
    it("canRunDangerousAdmin should be true", () => expect(flags.canRunDangerousAdmin).toBe(true));
  });

  describe("op role", () => {
    const flags = computeRoleFlags("op");

    it("isAdmin should be false", () => expect(flags.isAdmin).toBe(false));
    it("isOp should be true", () => expect(flags.isOp).toBe(true));
    it("isModerator should be false", () => expect(flags.isModerator).toBe(false));
    it("isAdminOrOp should be true", () => expect(flags.isAdminOrOp).toBe(true));
    it("canViewAdminHub should be true", () => expect(flags.canViewAdminHub).toBe(true));
    it("canEditAdminHub should be true", () => expect(flags.canEditAdminHub).toBe(true));
    it("canRunDangerousAdmin should be false", () => expect(flags.canRunDangerousAdmin).toBe(false));
  });

  describe("moderator role", () => {
    const flags = computeRoleFlags("moderator");

    it("isAdmin should be false", () => expect(flags.isAdmin).toBe(false));
    it("isOp should be false", () => expect(flags.isOp).toBe(false));
    it("isModerator should be true", () => expect(flags.isModerator).toBe(true));
    it("isAdminOrOp should be false", () => expect(flags.isAdminOrOp).toBe(false));
    it("canViewAdminHub should be true — moderator CAN view admin hub", () =>
      expect(flags.canViewAdminHub).toBe(true));
    it("canEditAdminHub should be false — moderator CANNOT edit admin hub", () =>
      expect(flags.canEditAdminHub).toBe(false));
    it("canRunDangerousAdmin should be false", () => expect(flags.canRunDangerousAdmin).toBe(false));
  });

  describe("user role", () => {
    const flags = computeRoleFlags("user");

    it("isAdmin should be false", () => expect(flags.isAdmin).toBe(false));
    it("isOp should be false", () => expect(flags.isOp).toBe(false));
    it("isModerator should be false", () => expect(flags.isModerator).toBe(false));
    it("isAdminOrOp should be false", () => expect(flags.isAdminOrOp).toBe(false));
    it("canViewAdminHub should be false — regular user CANNOT view admin hub", () =>
      expect(flags.canViewAdminHub).toBe(false));
    it("canEditAdminHub should be false", () => expect(flags.canEditAdminHub).toBe(false));
    it("canRunDangerousAdmin should be false", () => expect(flags.canRunDangerousAdmin).toBe(false));
  });

  describe("role hierarchy verification", () => {
    const roles: UserRole[] = ["admin", "op", "moderator", "user"];
    const allFlags = Object.fromEntries(roles.map((r) => [r, computeRoleFlags(r)]));

    it("only admin can run dangerous admin operations", () => {
      expect(allFlags.admin.canRunDangerousAdmin).toBe(true);
      expect(allFlags.op.canRunDangerousAdmin).toBe(false);
      expect(allFlags.moderator.canRunDangerousAdmin).toBe(false);
      expect(allFlags.user.canRunDangerousAdmin).toBe(false);
    });

    it("admin and op can edit admin hub; moderator and user cannot", () => {
      expect(allFlags.admin.canEditAdminHub).toBe(true);
      expect(allFlags.op.canEditAdminHub).toBe(true);
      expect(allFlags.moderator.canEditAdminHub).toBe(false);
      expect(allFlags.user.canEditAdminHub).toBe(false);
    });

    it("admin, op, moderator can view admin hub; user cannot", () => {
      expect(allFlags.admin.canViewAdminHub).toBe(true);
      expect(allFlags.op.canViewAdminHub).toBe(true);
      expect(allFlags.moderator.canViewAdminHub).toBe(true);
      expect(allFlags.user.canViewAdminHub).toBe(false);
    });

    it("exactly one role flag should be true for each role", () => {
      for (const role of roles) {
        const f = allFlags[role];
        const roleFlags = [f.isAdmin, f.isOp, f.isModerator].filter(Boolean);
        if (role === "user") {
          expect(roleFlags.length).toBe(0);
        } else {
          expect(roleFlags.length).toBe(1);
        }
      }
    });
  });
});
