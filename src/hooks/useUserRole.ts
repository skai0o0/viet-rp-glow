import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "admin" | "op" | "moderator" | "user";

interface UserRoleResult {
  role: UserRole;
  isAdmin: boolean;
  isOp: boolean;
  isModerator: boolean;
  isAdminOrOp: boolean;
  /** admin + op + moderator: có thể truy cập Admin Hub */
  canViewAdminHub: boolean;
  /** admin + op: có thể thực hiện thao tác ghi trong Admin Hub */
  canEditAdminHub: boolean;
  /** admin only: chạy các tác vụ nguy hiểm (SQL editor, v.v.) */
  canRunDangerousAdmin: boolean;
  checking: boolean;
}

/**
 * Hook phân quyền 4 cấp: admin > op > moderator > user
 * - admin: toàn quyền (view + edit) mọi nơi
 * - op: truy cập Admin Hub, sửa được — các thay đổi quan trọng cần duyệt
 * - moderator: truy cập Admin Hub nhưng chỉ xem (read-only), không ghi
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
        const { data, error } = await supabase.rpc("get_user_role", {
          p_user_id: user.id,
        } as any);

        if (!error && data) {
          setRole(data as UserRole);
        } else {
          setRole("user");
        }
      } catch {
        setRole("user");
      }
      setChecking(false);
    };

    fetchRole();
  }, [user]);

  const isAdmin = role === "admin";
  const isOp = role === "op";
  const isModerator = role === "moderator";

  return {
    role,
    isAdmin,
    isOp,
    isModerator,
    isAdminOrOp: isAdmin || isOp,
    canViewAdminHub: isAdmin || isOp || isModerator,
    canEditAdminHub: isAdmin || isOp,
    canRunDangerousAdmin: isAdmin,
    checking,
  };
}
