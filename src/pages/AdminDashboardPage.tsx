import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Eye,
  MousePointerClick,
  Zap,
  Server,
  Crown,
  Layers,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface DashboardStats {
  total_characters: number;
  public_characters: number;
  private_characters: number;
  total_users: number;
  total_sessions: number;
  total_messages: number;
  total_favorites: number;
  total_ratings: number;
  avg_rating: number;
  new_users_today: number;
  new_chars_today: number;
  new_sessions_today: number;
  new_messages_today: number;
  total_chat_messages_today: number;
  active_users_today: number;
  total_page_views_today: number;
  unique_visitors_today: number;
}

interface UsageDay {
  day: string;
  messages: number;
  active_users: number;
}

interface SignupDay {
  day: string;
  count: number;
}

interface PageViewDay {
  day: string;
  views: number;
  unique_visitors: number;
}

interface UsageAnalytics {
  chat_usage: UsageDay[];
  signups: SignupDay[];
  sessions: SignupDay[];
  page_views: PageViewDay[];
}

interface TierStat {
  tier: string;
  model: string;
  count: number;
}

interface ApiKeyHealth {
  key_name: string;
  request_count: number;
  last_used_at: string | null;
  is_active: boolean;
}

interface ModelUsageStats {
  by_tier: TierStat[];
  by_day: { day: string; tier: string; count: number }[];
  api_key_health: ApiKeyHealth[];
}

interface TopChar {
  id: string;
  name: string;
  avatar_url: string | null;
  is_public: boolean;
  message_count: number;
  rating: number;
  tags: string[];
  fav_count: number;
  session_count: number;
}

interface TopPage {
  path: string;
  views: number;
  unique_users: number;
}

/* ------------------------------------------------------------------ */
/*  Reusable                                                           */
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

const SparkLine = ({ data, color, height = 40 }: { data: number[]; color: string; height?: number }) => {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 200;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - (v / max) * height}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Chưa dùng";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}p trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h trước`;
  return `${Math.floor(hours / 24)}d trước`;
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */
const AdminDashboardPage = () => {
  const { user, isLoading } = useAuth();
  const { canViewAdminHub, checking } = useUserRole();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [analytics, setAnalytics] = useState<UsageAnalytics | null>(null);
  const [modelStats, setModelStats] = useState<ModelUsageStats | null>(null);
  const [topChars, setTopChars] = useState<TopChar[]>([]);
  const [topPages, setTopPages] = useState<TopPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const fetchAll = useCallback(async () => {
    try {
      const [statsRes, analyticsRes, modelRes, topCharsRes, topPagesRes] = await Promise.all([
        supabase.rpc("get_dashboard_stats"),
        supabase.rpc("get_usage_analytics", { p_days: 30 }),
        supabase.rpc("get_model_usage_stats", { p_days: 30 }),
        supabase.rpc("get_top_characters", { p_limit: 10 }),
        supabase.rpc("get_top_pages", { p_days: 7 }),
      ]);

      if (statsRes.data && !(statsRes.data as any).error) {
        setStats(statsRes.data as unknown as DashboardStats);
      }
      if (analyticsRes.data) setAnalytics(analyticsRes.data as unknown as UsageAnalytics);
      if (modelRes.data) setModelStats(modelRes.data as unknown as ModelUsageStats);
      if (topCharsRes.data) setTopChars((topCharsRes.data as unknown as TopChar[]) ?? []);
      if (topPagesRes.data) setTopPages((topPagesRes.data as unknown as TopPage[]) ?? []);
    } catch (err) {
      console.error("[AdminDashboard] fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!canViewAdminHub) return;
    fetchAll();
  }, [canViewAdminHub, fetchAll]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  if (isLoading || checking) {
    return (
      <div className="flex-1 flex items-center justify-center bg-oled-base">
        <Loader2 size={24} className="animate-spin text-neon-purple" />
      </div>
    );
  }
  if (!user || !canViewAdminHub) return <Navigate to="/" replace />;

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
              <p className="text-sm text-muted-foreground">Thống kê tổng quan & Analytics</p>
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
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="bg-oled-surface border border-oled-border">
                <TabsTrigger value="overview" className="data-[state=active]:bg-neon-purple/20 data-[state=active]:text-neon-purple">
                  Tổng quan
                </TabsTrigger>
                <TabsTrigger value="analytics" className="data-[state=active]:bg-neon-blue/20 data-[state=active]:text-neon-blue">
                  Analytics
                </TabsTrigger>
                <TabsTrigger value="models" className="data-[state=active]:bg-neon-rose/20 data-[state=active]:text-neon-rose">
                  Models & API
                </TabsTrigger>
              </TabsList>

              {/* ═══════════════ TAB: OVERVIEW ═══════════════ */}
              <TabsContent value="overview" className="space-y-4">
                {/* Primary stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <BigStatCard icon={Sparkles} label="Tổng nhân vật" value={formatNumber(stats.total_characters)} color="text-neon-purple bg-neon-purple/10" delay={0} />
                  <BigStatCard icon={Users} label="Người dùng" value={formatNumber(stats.total_users)} color="text-neon-blue bg-neon-blue/10" delay={0.05} />
                  <BigStatCard icon={MessageSquare} label="Phiên chat" value={formatNumber(stats.total_sessions)} color="text-neon-rose bg-neon-rose/10" delay={0.1} />
                  <BigStatCard icon={MessagesSquare} label="Tổng tin nhắn" value={formatNumber(stats.total_messages)} color="text-cyan-400 bg-cyan-400/10" delay={0.15} />
                </div>

                {/* Secondary stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <BigStatCard icon={Heart} label="Lượt yêu thích" value={formatNumber(stats.total_favorites)} color="text-pink-400 bg-pink-400/10" delay={0.2} />
                  <BigStatCard icon={Star} label="Lượt đánh giá" value={formatNumber(stats.total_ratings)} sub={`TB: ${stats.avg_rating}/5`} color="text-amber-400 bg-amber-400/10" delay={0.25} />
                  <BigStatCard icon={Globe} label="Công khai" value={stats.public_characters} color="text-green-400 bg-green-400/10" delay={0.3} />
                  <BigStatCard icon={Lock} label="Riêng tư" value={stats.private_characters} color="text-gray-400 bg-gray-400/10" delay={0.35} />
                </div>

                {/* Today's activity */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                  <Card className="bg-oled-surface border-oled-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <Activity size={14} className="text-neon-blue" />
                        Hoạt động hôm nay
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        <div className="bg-oled-base rounded-xl p-3 text-center">
                          <p className="text-lg font-bold text-neon-blue">{stats.active_users_today}</p>
                          <p className="text-[10px] text-muted-foreground">Active Users</p>
                        </div>
                        <div className="bg-oled-base rounded-xl p-3 text-center">
                          <p className="text-lg font-bold text-cyan-400">{stats.total_chat_messages_today}</p>
                          <p className="text-[10px] text-muted-foreground">Chat Messages</p>
                        </div>
                        <div className="bg-oled-base rounded-xl p-3 text-center">
                          <p className="text-lg font-bold text-neon-purple">{stats.total_page_views_today}</p>
                          <p className="text-[10px] text-muted-foreground">Page Views</p>
                        </div>
                        <div className="bg-oled-base rounded-xl p-3 text-center">
                          <p className="text-lg font-bold text-green-400">{stats.unique_visitors_today}</p>
                          <p className="text-[10px] text-muted-foreground">Unique Visitors</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground">Người dùng mới</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-neon-blue">+{stats.new_users_today}</span>
                          <TrendingUp size={14} className="text-neon-blue" />
                        </div>
                      </div>
                      <MiniBar value={stats.new_users_today} max={Math.max(stats.total_users, 1)} color="bg-neon-blue" />

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground">Nhân vật mới</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-neon-purple">+{stats.new_chars_today}</span>
                          <TrendingUp size={14} className="text-neon-purple" />
                        </div>
                      </div>
                      <MiniBar value={stats.new_chars_today} max={Math.max(stats.total_characters, 1)} color="bg-neon-purple" />

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground">Phiên chat mới</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-neon-rose">+{stats.new_sessions_today}</span>
                          <TrendingUp size={14} className="text-neon-rose" />
                        </div>
                      </div>
                      <MiniBar value={stats.new_sessions_today} max={Math.max(stats.total_sessions, 1)} color="bg-neon-rose" />

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground">Tin nhắn mới</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-cyan-400">+{stats.new_messages_today}</span>
                          <TrendingUp size={14} className="text-cyan-400" />
                        </div>
                      </div>
                      <MiniBar value={stats.new_messages_today} max={Math.max(stats.total_messages, 1)} color="bg-cyan-400" />
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Character ratio */}
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
                        <span className="font-bold text-foreground">{stats.public_characters}</span>
                      </div>
                      <MiniBar value={stats.public_characters} max={Math.max(stats.total_characters, 1)} color="bg-green-400" />
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400 flex items-center gap-1.5"><Lock size={12} /> Riêng tư</span>
                        <span className="font-bold text-foreground">{stats.private_characters}</span>
                      </div>
                      <MiniBar value={stats.private_characters} max={Math.max(stats.total_characters, 1)} color="bg-gray-400" />
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Top characters */}
                {topChars.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                    <Card className="bg-oled-surface border-oled-border">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                          <Crown size={14} className="text-amber-400" />
                          Top nhân vật phổ biến
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {topChars.map((c, idx) => (
                          <Link key={c.id} to={`/character/${c.id}`}>
                            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-oled-elevated/50 transition-colors group">
                              <span className="text-xs font-bold text-muted-foreground w-5 text-right">#{idx + 1}</span>
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
                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                                  <span className="flex items-center gap-0.5"><MessagesSquare size={10} /> {c.message_count}</span>
                                  <span className="flex items-center gap-0.5"><Heart size={10} /> {c.fav_count}</span>
                                  <span className="flex items-center gap-0.5"><MessageSquare size={10} /> {c.session_count}</span>
                                  {c.rating > 0 && <span className="flex items-center gap-0.5"><Star size={10} /> {c.rating}</span>}
                                </div>
                              </div>
                              {c.tags?.slice(0, 2).map((t) => (
                                <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0 border-oled-border text-muted-foreground hidden md:inline-flex">
                                  {t}
                                </Badge>
                              ))}
                            </div>
                          </Link>
                        ))}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </TabsContent>

              {/* ═══════════════ TAB: ANALYTICS ═══════════════ */}
              <TabsContent value="analytics" className="space-y-4">
                {/* Live metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <BigStatCard icon={Eye} label="Page Views hôm nay" value={stats.total_page_views_today} color="text-neon-purple bg-neon-purple/10" />
                  <BigStatCard icon={MousePointerClick} label="Visitors hôm nay" value={stats.unique_visitors_today} color="text-neon-blue bg-neon-blue/10" />
                  <BigStatCard icon={Zap} label="Active Users" value={stats.active_users_today} color="text-green-400 bg-green-400/10" />
                  <BigStatCard icon={MessagesSquare} label="Chat hôm nay" value={stats.total_chat_messages_today} color="text-cyan-400 bg-cyan-400/10" />
                </div>

                {/* Chat usage 30-day sparkline */}
                {analytics && analytics.chat_usage.length > 1 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="bg-oled-surface border-oled-border">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                          <MessagesSquare size={14} className="text-cyan-400" />
                          Chat Messages — 30 ngày qua
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <SparkLine data={analytics.chat_usage.map((d) => d.messages)} color="#22d3ee" height={60} />
                        <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
                          <span>{analytics.chat_usage[0]?.day}</span>
                          <span className="text-cyan-400 font-bold">
                            Tổng: {analytics.chat_usage.reduce((s, d) => s + d.messages, 0)} messages
                          </span>
                          <span>{analytics.chat_usage[analytics.chat_usage.length - 1]?.day}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Active users 30-day sparkline */}
                {analytics && analytics.chat_usage.length > 1 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <Card className="bg-oled-surface border-oled-border">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                          <Users size={14} className="text-neon-blue" />
                          Active Users — 30 ngày qua
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <SparkLine data={analytics.chat_usage.map((d) => d.active_users)} color="#60a5fa" height={60} />
                        <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
                          <span>{analytics.chat_usage[0]?.day}</span>
                          <span className="text-neon-blue font-bold">
                            Cao nhất: {Math.max(...analytics.chat_usage.map((d) => d.active_users))} users/ngày
                          </span>
                          <span>{analytics.chat_usage[analytics.chat_usage.length - 1]?.day}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Page views sparkline */}
                {analytics && analytics.page_views.length > 1 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                    <Card className="bg-oled-surface border-oled-border">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                          <Eye size={14} className="text-neon-purple" />
                          Page Views — 30 ngày qua
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <SparkLine data={analytics.page_views.map((d) => d.views)} color="#a855f7" height={60} />
                        <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
                          <span>{analytics.page_views[0]?.day}</span>
                          <span className="text-neon-purple font-bold">
                            Tổng: {analytics.page_views.reduce((s, d) => s + d.views, 0)} views
                          </span>
                          <span>{analytics.page_views[analytics.page_views.length - 1]?.day}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Signups sparkline */}
                {analytics && analytics.signups.length > 1 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <Card className="bg-oled-surface border-oled-border">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                          <TrendingUp size={14} className="text-green-400" />
                          Đăng ký mới — 30 ngày qua
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <SparkLine data={analytics.signups.map((d) => d.count)} color="#4ade80" height={60} />
                        <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
                          <span>{analytics.signups[0]?.day}</span>
                          <span className="text-green-400 font-bold">
                            Tổng: {analytics.signups.reduce((s, d) => s + d.count, 0)} users
                          </span>
                          <span>{analytics.signups[analytics.signups.length - 1]?.day}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Top pages */}
                {topPages.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                    <Card className="bg-oled-surface border-oled-border">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                          <Eye size={14} className="text-neon-purple" />
                          Trang được xem nhiều nhất (7 ngày)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1">
                        {topPages.map((p, i) => {
                          const maxViews = topPages[0]?.views ?? 1;
                          return (
                            <div key={p.path} className="flex items-center gap-3 py-1.5">
                              <span className="text-xs font-bold text-muted-foreground w-5 text-right">#{i + 1}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-foreground font-mono truncate">{p.path}</p>
                                <div className="mt-1">
                                  <MiniBar value={p.views} max={maxViews} color="bg-neon-purple" />
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-bold text-foreground">{p.views}</p>
                                <p className="text-[10px] text-muted-foreground">{p.unique_users} users</p>
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </TabsContent>

              {/* ═══════════════ TAB: MODELS & API ═══════════════ */}
              <TabsContent value="models" className="space-y-4">
                {/* Tier usage breakdown */}
                {modelStats && modelStats.by_tier.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="bg-oled-surface border-oled-border">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                          <Layers size={14} className="text-neon-rose" />
                          Sử dụng theo Tier (30 ngày)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {modelStats.by_tier.map((t) => {
                          const maxCount = modelStats.by_tier[0]?.count ?? 1;
                          const tierColor = t.tier === "free" ? "bg-green-400" : t.tier === "pro" ? "bg-neon-blue" : "bg-neon-purple";
                          const tierTextColor = t.tier === "free" ? "text-green-400" : t.tier === "pro" ? "text-neon-blue" : "text-neon-purple";
                          return (
                            <div key={`${t.tier}-${t.model}`} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${tierTextColor} border-current`}>
                                    {t.tier?.toUpperCase() ?? "N/A"}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">{t.model}</span>
                                </div>
                                <span className="text-sm font-bold text-foreground">{formatNumber(t.count)}</span>
                              </div>
                              <MiniBar value={t.count} max={maxCount} color={tierColor} />
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* API Key Health */}
                {modelStats && modelStats.api_key_health.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <Card className="bg-oled-surface border-oled-border">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                          <Server size={14} className="text-amber-400" />
                          API Key Pool Health
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {modelStats.api_key_health.map((k) => (
                          <div key={k.key_name} className="flex items-center gap-3 p-2 rounded-lg bg-oled-base">
                            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${k.is_active ? "bg-green-400" : "bg-red-400"}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{k.key_name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {formatNumber(k.request_count)} requests
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 ${k.is_active ? "text-green-400 border-green-400/30" : "text-red-400 border-red-400/30"}`}
                              >
                                {k.is_active ? "Active" : "Inactive"}
                              </Badge>
                              <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1 justify-end">
                                <Clock size={9} /> {timeAgo(k.last_used_at)}
                              </p>
                            </div>
                          </div>
                        ))}
                        <div className="mt-2 pt-2 border-t border-oled-border flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {modelStats.api_key_health.filter((k) => k.is_active).length}/{modelStats.api_key_health.length} keys active
                          </span>
                          <span>
                            Tổng: {formatNumber(modelStats.api_key_health.reduce((s, k) => s + k.request_count, 0))} requests
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Empty states */}
                {modelStats && modelStats.by_tier.length === 0 && modelStats.api_key_health.length === 0 && (
                  <Card className="bg-oled-surface border-oled-border">
                    <CardContent className="p-8 text-center">
                      <Server size={32} className="mx-auto text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">Chưa có dữ liệu model usage.</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Data sẽ xuất hiện khi users bắt đầu chat qua platform proxy.</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </motion.div>
    </ScrollArea>
  );
};

export default AdminDashboardPage;
