import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Loader2,
  ArrowLeft,
  Users,
  Sparkles,
  MessageSquare,
  Heart,
  Star,
  Globe,
  Lock,
  TrendingUp,
  Activity,
  BarChart3,
  Clock,
  MessagesSquare,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface DashboardStats {
  totalCharacters: number;
  publicCharacters: number;
  privateCharacters: number;
  totalUsers: number;
  totalSessions: number;
  totalMessages: number;
  totalFavorites: number;
  totalRatings: number;
  avgRating: number;
  newUsersToday: number;
  newCharsToday: number;
  newSessionsToday: number;
}

interface RecentCharacter {
  id: string;
  name: string;
  avatar_url: string | null;
  is_public: boolean;
  tags: string[];
  created_at: string;
}

interface RecentUser {
  id: string;
  display_name: string;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/*  Reusable Sub-components                                            */
/* ------------------------------------------------------------------ */
const BigStatCard = ({
  icon: Icon,
  label,
  value,
  sub,
  color,
  delay = 0,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  delay?: number;
}) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className="h-full">
    <Card className="bg-oled-surface border-oled-border hover:border-neon-purple/30 transition-colors h-full">
      <CardContent className="p-4 flex items-center gap-3 h-full">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

const MiniBar = ({ value, max, color }: { value: number; max: number; color: string }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-oled-base overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground w-8 text-right">{pct}%</span>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */
const AdminDashboardPage = () => {
  const { user, isLoading } = useAuth();
  const { isAdminOrOp, checking } = useUserRole();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentChars, setRecentChars] = useState<RecentCharacter[]>([]);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  const fetchAll = async () => {
    try {
      const [
        charsAll,
        charsPublic,
        usersAll,
        sessionsAll,
        messagesAll,
        favsAll,
        ratingsAll,
        ratingsAvg,
        newUsersToday,
        newCharsToday,
        newSessionsToday,
        recentCharactersRes,
        recentUsersRes,
      ] = await Promise.all([
        supabase.from("characters").select("id", { count: "exact", head: true }),
        supabase.from("characters").select("id", { count: "exact", head: true }).eq("is_public", true),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("chat_sessions").select("id", { count: "exact", head: true }),
        supabase.from("chat_messages").select("id", { count: "exact", head: true }),
        supabase.from("user_favorites").select("id", { count: "exact", head: true }),
        supabase.from("character_ratings").select("id", { count: "exact", head: true }),
        supabase.from("character_ratings").select("value"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
        supabase.from("characters").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
        supabase.from("chat_sessions").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
        supabase
          .from("characters")
          .select("id, name, avatar_url, is_public, tags, created_at")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("profiles")
          .select("id, display_name, created_at")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      const totalChars = charsAll.count ?? 0;
      const publicChars = charsPublic.count ?? 0;

      const avgVal =
        ratingsAvg.data && ratingsAvg.data.length > 0
          ? ratingsAvg.data.reduce((s: number, r: any) => s + (r.value || 0), 0) / ratingsAvg.data.length
          : 0;

      setStats({
        totalCharacters: totalChars,
        publicCharacters: publicChars,
        privateCharacters: totalChars - publicChars,
        totalUsers: usersAll.count ?? 0,
        totalSessions: sessionsAll.count ?? 0,
        totalMessages: messagesAll.count ?? 0,
        totalFavorites: favsAll.count ?? 0,
        totalRatings: ratingsAll.count ?? 0,
        avgRating: Math.round(avgVal * 10) / 10,
        newUsersToday: newUsersToday.count ?? 0,
        newCharsToday: newCharsToday.count ?? 0,
        newSessionsToday: newSessionsToday.count ?? 0,
      });

      setRecentChars((recentCharactersRes.data ?? []) as RecentCharacter[]);
      setRecentUsers((recentUsersRes.data ?? []) as RecentUser[]);
    } catch (err) {
      console.error("[AdminDashboard] fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isAdminOrOp) return;
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminOrOp]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  /* ---------- guards ---------- */
  if (isLoading || checking) {
    return (
      <div className="flex-1 flex items-center justify-center bg-oled-base">
        <Loader2 size={24} className="animate-spin text-neon-purple" />
      </div>
    );
  }
  if (!user || !isAdminOrOp) return <Navigate to="/" replace />;

  /* ---------- render ---------- */
  return (
    <ScrollArea className="flex-1">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6 pb-24"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft size={20} />
              </Button>
            </Link>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center shadow-lg">
              <BarChart3 className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
              <p className="text-sm text-muted-foreground">Thống kê tổng quan hệ thống</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="text-muted-foreground hover:text-neon-blue"
          >
            <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
          </Button>
        </div>

        {loading || !stats ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-neon-purple" />
          </div>
        ) : (
          <>
            {/* ── Primary stats grid ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <BigStatCard icon={Sparkles} label="Tổng nhân vật" value={stats.totalCharacters} color="text-neon-purple bg-neon-purple/10" delay={0} />
              <BigStatCard icon={Users} label="Người dùng" value={stats.totalUsers} color="text-neon-blue bg-neon-blue/10" delay={0.05} />
              <BigStatCard icon={MessageSquare} label="Phiên chat" value={stats.totalSessions} color="text-neon-rose bg-neon-rose/10" delay={0.1} />
              <BigStatCard icon={MessagesSquare} label="Tổng tin nhắn" value={stats.totalMessages} color="text-cyan-400 bg-cyan-400/10" delay={0.15} />
            </div>

            {/* ── Secondary stats ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <BigStatCard icon={Heart} label="Lượt yêu thích" value={stats.totalFavorites} color="text-pink-400 bg-pink-400/10" delay={0.2} />
              <BigStatCard icon={Star} label="Lượt đánh giá" value={stats.totalRatings} sub={`Trung bình: ${stats.avgRating}/5`} color="text-amber-400 bg-amber-400/10" delay={0.25} />
              <BigStatCard icon={Globe} label="Nhân vật công khai" value={stats.publicCharacters} color="text-green-400 bg-green-400/10" delay={0.3} />
              <BigStatCard icon={Lock} label="Nhân vật riêng tư" value={stats.privateCharacters} color="text-gray-400 bg-gray-400/10" delay={0.35} />
            </div>

            {/* ── Today's activity ── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <Card className="bg-oled-surface border-oled-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Activity size={14} className="text-neon-blue" />
                    Hoạt động hôm nay
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">Người dùng mới</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-neon-blue">+{stats.newUsersToday}</span>
                      <TrendingUp size={14} className="text-neon-blue" />
                    </div>
                  </div>
                  <MiniBar value={stats.newUsersToday} max={Math.max(stats.totalUsers, 1)} color="bg-neon-blue" />

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">Nhân vật mới</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-neon-purple">+{stats.newCharsToday}</span>
                      <TrendingUp size={14} className="text-neon-purple" />
                    </div>
                  </div>
                  <MiniBar value={stats.newCharsToday} max={Math.max(stats.totalCharacters, 1)} color="bg-neon-purple" />

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">Phiên chat mới</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-neon-rose">+{stats.newSessionsToday}</span>
                      <TrendingUp size={14} className="text-neon-rose" />
                    </div>
                  </div>
                  <MiniBar value={stats.newSessionsToday} max={Math.max(stats.totalSessions, 1)} color="bg-neon-rose" />
                </CardContent>
              </Card>
            </motion.div>

            {/* ── Ratio breakdown ── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
              <Card className="bg-oled-surface border-oled-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <BarChart3 size={14} className="text-neon-purple" />
                    Tỷ lệ nhân vật
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-400 flex items-center gap-1.5"><Globe size={12} /> Công khai</span>
                    <span className="font-bold text-foreground">{stats.publicCharacters}</span>
                  </div>
                  <MiniBar value={stats.publicCharacters} max={Math.max(stats.totalCharacters, 1)} color="bg-green-400" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400 flex items-center gap-1.5"><Lock size={12} /> Riêng tư</span>
                    <span className="font-bold text-foreground">{stats.privateCharacters}</span>
                  </div>
                  <MiniBar value={stats.privateCharacters} max={Math.max(stats.totalCharacters, 1)} color="bg-gray-400" />
                </CardContent>
              </Card>
            </motion.div>

            {/* ── Recent characters ── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <Card className="bg-oled-surface border-oled-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Sparkles size={14} className="text-neon-purple" />
                    Nhân vật mới nhất
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {recentChars.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Chưa có dữ liệu.</p>
                  ) : (
                    recentChars.map((c) => (
                      <Link key={c.id} to={`/character/${c.id}`}>
                        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-oled-elevated/50 transition-colors group">
                          <div className="w-9 h-9 rounded-lg bg-oled-base overflow-hidden shrink-0 flex items-center justify-center">
                            {c.avatar_url ? (
                              <img src={c.avatar_url} alt={c.name} className="w-full h-full object-cover" />
                            ) : (
                              <Sparkles size={14} className="text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate group-hover:text-neon-purple transition-colors">
                              {c.name}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${c.is_public ? "border-green-400/40 text-green-400" : "border-gray-500/40 text-gray-400"}`}>
                                {c.is_public ? "Public" : "Private"}
                              </Badge>
                              {c.tags?.slice(0, 2).map((t) => (
                                <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0 border-oled-border text-muted-foreground">
                                  {t}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-1">
                            <Clock size={10} />
                            {new Date(c.created_at).toLocaleDateString("vi-VN")}
                          </span>
                        </div>
                      </Link>
                    ))
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* ── Recent users ── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
              <Card className="bg-oled-surface border-oled-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Users size={14} className="text-neon-blue" />
                    Người dùng mới nhất
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {recentUsers.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Chưa có dữ liệu.</p>
                  ) : (
                    recentUsers.map((u) => (
                      <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-oled-elevated/50 transition-colors">
                        <div className="w-9 h-9 rounded-full bg-neon-blue/10 flex items-center justify-center shrink-0">
                          <Users size={14} className="text-neon-blue" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {u.display_name || "Unnamed"}
                          </p>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(u.created_at).toLocaleDateString("vi-VN")}
                        </span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </motion.div>
    </ScrollArea>
  );
};

export default AdminDashboardPage;
