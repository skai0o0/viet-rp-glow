import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "admin" | "op" | "moderator" | "user";

interface UserRoleResult {
  role: UserRole;
  isAdmin: boolean;
  isOp: boolean;
  isAdminOrOp: boolean;
  checking: boolean;
}

/**
 * Hook phân quyền 3 cấp: admin > op > user
 * - admin: toàn quyền
 * - op: xem + sửa Admin Hub, submit cần duyệt
 * - user: truy cập cơ bản
 */
export function useUserRole(): UserRoleResult {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>("user");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole("user");
      setChecking(false);
      return;
    }

    const fetchRole = async () => {
      try {
        // Try get_user_role RPC first (returns highest role)
        const { data, error } = await supabase.rpc("get_user_role", {
          p_user_id: user.id,
        } as any);

        if (!error && data) {
          setRole(data as UserRole);
        } else {
          // Fallback: check has_role for admin, then op
          const { data: isAdm } = await supabase.rpc("has_role", {
            _user_id: user.id,
            _role: "admin",
          } as any);
          if (isAdm) {
            setRole("admin");
          } else {
            const { data: isOp } = await supabase.rpc("has_role", {
              _user_id: user.id,
              _role: "op",
            } as any);
            setRole(isOp ? "op" : "user");
          }
        }
      } catch {
        setRole("user");
      }
      setChecking(false);
    };

    fetchRole();
  }, [user]);

  return {
    role,
    isAdmin: role === "admin",
    isOp: role === "op",
    isAdminOrOp: role === "admin" || role === "op",
    checking,
  };
}
