import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import {
  Shield,
  ShieldCheck,
  Loader2,
  Users,
  MessageSquare,
  Sparkles,
  ChevronRight,
  BookOpen,
  Database,
  BarChart3,
  Zap,
  Wand2,
  Map,
  ClipboardCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePendingApprovalCount } from "@/hooks/usePendingApprovalCount";
import { AdminPageShell, AdminStatCard } from "@/admin/components";

const AdminPage = () => {
  const { user, isLoading } = useAuth();
  const { isAdmin, isOp, isModerator, canViewAdminHub, checking } = useUserRole();

  const [stats, setStats] = useState({ characters: "—", users: "—", sessions: "—" });
  const pendingCount = usePendingApprovalCount(isAdmin || isOp);

  useEffect(() => {
    if (!canViewAdminHub) return;
    Promise.all([
      supabase.from("characters").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("chat_sessions").select("id", { count: "exact", head: true }),
    ]).then(([chars, profiles, sessions]) => {
      setStats({
        characters: String(chars.count ?? 0),
        users: String(profiles.count ?? 0),
        sessions: String(sessions.count ?? 0),
      });
    });
  }, [canViewAdminHub]);

  if (isLoading || checking) {
    return (
      <div className="flex-1 flex items-center justify-center bg-oled-base">
        <Loader2 size={24} className="animate-spin text-neon-purple" />
      </div>
    );
  }

  if (!user || !canViewAdminHub) {
    return <Navigate to="/" replace />;
  }

  const quickLinkGroups = [
    {
      label: "Analytics",
      links: [
        { icon: BarChart3, label: "Dashboard", description: "Thống kê, analytics, model usage", path: "/admin/dashboard", color: "text-neon-blue bg-neon-blue/10" },
      ],
    },
    {
      label: "AI & Models",
      links: [
        { icon: Zap, label: "AI Configuration", description: "API Keys, Models, Prompts & Sampling", path: "/admin/api-settings", color: "text-orange-400 bg-orange-400/10" },
        { icon: Wand2, label: "AI Card Generator", description: "Tạo Character Card bằng LLM, duyệt & xuất bản", path: "/create?tab=ai", color: "text-neon-rose bg-neon-rose/10" },
      ],
    },
    {
      label: "Content",
      links: [
        { icon: BookOpen, label: "Knowledge Base", description: "Kho kiến thức, prompt & template hệ thống", path: "/admin/knowledge", color: "text-green-400 bg-green-400/10" },
        { icon: Map, label: "Roadmap phát triển", description: "Xem & chỉnh sửa lộ trình tính năng", path: "/admin/roadmap", color: "text-neon-purple bg-neon-purple/10" },
      ],
    },
    {
      label: "Operations",
      links: [
        {
          icon: ClipboardCheck,
          label: "Approval Queue",
          description: `Duyệt yêu cầu chỉnh sửa từ Operator${pendingCount > 0 ? ` · ${pendingCount} chờ duyệt` : ""}`,
          path: "/admin/approvals",
          color: "text-orange-400 bg-orange-400/10",
          badge: pendingCount,
        },
      ],
    },
    ...(isAdmin
      ? [
          {
            label: "Dev",
            links: [
              { icon: Database, label: "SQL Editor", description: "Thực thi truy vấn SQL trực tiếp trên Supabase", path: "/admin/sql", color: "text-amber-400 bg-amber-400/10" },
            ],
          },
        ]
      : []),
  ];

  const title = isOp ? "Operator Hub" : isModerator ? "Moderator Hub" : "Admin Hub";
  const subtitle = isOp
    ? "Quản lý hệ thống VietRP (Operator)"
    : isModerator
    ? "Xem thống kê & nội dung hệ thống (Read-Only)"
    : "Quản trị hệ thống VietRP";

  const iconGradient = isOp
    ? "bg-gradient-to-br from-neon-blue to-cyan-500"
    : isModerator
    ? "bg-gradient-to-br from-yellow-500 to-amber-600"
    : "bg-gradient-to-br from-neon-rose to-neon-purple";

  return (
    <AdminPageShell
      icon={Shield}
      iconGradient={iconGradient}
      title={title}
      subtitle={subtitle}
    >
      {/* Role notice banners */}
      {isOp && (
        <Card className="bg-neon-blue/5 border-neon-blue/20">
          <CardContent className="p-3 flex items-center gap-2.5">
            <ShieldCheck size={16} className="text-neon-blue shrink-0" />
            <p className="text-xs text-muted-foreground">
              Bạn đang truy cập với quyền <span className="text-neon-blue font-medium">Operator</span>.
              Có thể xem tất cả & chỉnh sửa — các thay đổi quan trọng sẽ cần Admin duyệt.
            </p>
          </CardContent>
        </Card>
      )}

      {isModerator && (
        <Card className="bg-yellow-500/5 border-yellow-500/20">
          <CardContent className="p-3 flex items-center gap-2.5">
            <ShieldCheck size={16} className="text-yellow-400 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Bạn đang truy cập với quyền <span className="text-yellow-400 font-medium">Moderator</span>.
              Chỉ có quyền xem — không thể thực hiện thao tác chỉnh sửa.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AdminStatCard icon={Sparkles} label="Nhân vật" value={stats.characters} color="text-neon-purple" delay={0} />
        <AdminStatCard icon={Users} label="Người dùng" value={stats.users} color="text-neon-blue" delay={0.05} />
        <AdminStatCard icon={MessageSquare} label="Phiên chat" value={stats.sessions} color="text-neon-rose" delay={0.1} />
      </div>

      {/* Quick Links */}
      <div className="space-y-5">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Truy cập nhanh</h2>
        {quickLinkGroups.map((group) => (
          <div key={group.label} className="space-y-2">
            <h3 className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
              {group.label}
            </h3>
            {group.links.map((link) => {
              const Icon = link.icon;
              return (
                <Link key={link.path} to={link.path}>
                  <Card className="bg-oled-surface border-gray-border hover:border-neon-purple/30 transition-colors cursor-pointer group">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${link.color} relative`}>
                        <Icon size={16} />
                        {link.badge ? (
                          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-neon-rose text-[9px] font-bold flex items-center justify-center text-white">
                            {link.badge}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{link.label}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{link.description}</p>
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground/30 group-hover:text-neon-purple transition-colors" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </AdminPageShell>
  );
};

export default AdminPage;
