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

const ROLE_CACHE_KEY = "vietrp_user_role";

function getCachedRole(userId: string): UserRole | null {
  try {
    const raw = localStorage.getItem(ROLE_CACHE_KEY);
    if (!raw) return null;
    const { uid, role } = JSON.parse(raw);
    return uid === userId ? (role as UserRole) : null;
  } catch {
    return null;
  }
}

function setCachedRole(userId: string, role: UserRole) {
  try {
    localStorage.setItem(ROLE_CACHE_KEY, JSON.stringify({ uid: userId, role }));
  } catch {}
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
  const [role, setRole] = useState<UserRole>(() => {
    if (!user) return "user";
    return getCachedRole(user.id) ?? "user";
  });
  const [checking, setChecking] = useState(() => {
    // Nếu có cache thì không cần loading — hiển thị ngay
    return !user || !getCachedRole(user.id);
  });

  useEffect(() => {
    if (!user) {
      setRole("user");
      setChecking(false);
      return;
    }

    let cancelled = false;

    const fetchRole = async () => {
      try {
        const { data, error } = await supabase.rpc("get_user_role", {
          p_user_id: user.id,
        } as any);

        if (!cancelled) {
          if (!error && data) {
            const r = data as UserRole;
            setRole(r);
            setCachedRole(user.id, r);
          } else {
            setRole("user");
          }
          setChecking(false);
        }
      } catch {
        if (!cancelled) {
          setRole("user");
          setChecking(false);
        }
      }
    };

    fetchRole();
    return () => { cancelled = true; };
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
