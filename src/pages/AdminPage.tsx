import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate, Link } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ShieldCheck,
  Loader2,
  Upload,
  FileJson,
  Map,
  Terminal,
  Users,
  MessageSquare,
  Sparkles,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Database,
  ClipboardPaste,
  Save,
  BarChart3,
  Wand2,
  Rocket,
  CheckCircle2,
  Clock,
  Circle,
  Pencil,
  X,
  Pin,
  ExternalLink,
  ClipboardCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { createCharacter } from "@/services/characterDb";
import JSON5 from "json5";
import { readJsonFile, parseTavernCardJson } from "@/utils/importCharacterJson";
import {
  fetchGlobalSystemPrompt,
  saveGlobalSystemPrompt,
  fetchSubscriptionPlan,
  saveSubscriptionPlan,
  fetchSamplingParameters,
  saveSamplingParameters,
  type PlanPhase,
  type PlanPhaseStatus,
  type SamplingParameters,
} from "@/services/globalSettingsDb";

const planStatusConfig: Record<PlanPhaseStatus, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  done: { icon: CheckCircle2, label: "Hoàn thành", color: "text-green-400", bg: "bg-green-400/10 border-green-400/30" },
  "in-progress": { icon: Clock, label: "Đang làm", color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/30" },
  planned: { icon: Circle, label: "Dự kiến", color: "text-muted-foreground", bg: "bg-muted/10 border-gray-border" },
};

const StatCard = ({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) => (
  <Card className="bg-oled-surface border-oled-border">
    <CardContent className="p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </CardContent>
  </Card>
);

const AdminPage = () => {
  const { user, isLoading } = useAuth();
  const { isAdmin, checking } = useIsAdmin();
  const { isOp, isModerator, canViewAdminHub, canEditAdminHub } = useUserRole();
  const [prompt, setPrompt] = useState("");
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [importing, setImporting] = useState(false);
  const [rawJson, setRawJson] = useState("");
  const [importingRaw, setImportingRaw] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sampling parameters state
  const [samplingParams, setSamplingParams] = useState<SamplingParameters>({
    temperature: 0.7,
    top_p: 0.9,
    top_k: 40,
    repetition_penalty: 1.0,
  });
  const [savingSamplingParams, setSavingSamplingParams] = useState(false);

  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const [stats, setStats] = useState({ characters: "—", users: "—", sessions: "—" });

  // Subscription plan board
  const [planPhases, setPlanPhases] = useState<PlanPhase[]>([]);
  const [planExpanded, setPlanExpanded] = useState(false);
  const [editingPhase, setEditingPhase] = useState<PlanPhase | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);

  const loadPlan = useCallback(async () => {
    const plan = await fetchSubscriptionPlan();
    setPlanPhases(plan);
  }, []);

  useEffect(() => {
    fetchGlobalSystemPrompt().then(setPrompt);
    fetchSamplingParameters().then(setSamplingParams);
    loadPlan();
  }, [loadPlan]);

  const handlePlanStatusToggle = async (phaseId: number) => {
    const cycle: PlanPhaseStatus[] = ["planned", "in-progress", "done"];
    const updated = planPhases.map((p) => {
      if (p.id !== phaseId) return p;
      const nextIdx = (cycle.indexOf(p.status) + 1) % cycle.length;
      return { ...p, status: cycle[nextIdx] };
    });
    setPlanPhases(updated);
    try {
      await saveSubscriptionPlan(updated);
    } catch {
      toast.error("Không thể lưu trạng thái.");
      loadPlan();
    }
  };

  const handleSavePhaseEdit = async () => {
    if (!editingPhase) return;
    setSavingPlan(true);
    const updated = planPhases.map((p) => (p.id === editingPhase.id ? editingPhase : p));
    try {
      await saveSubscriptionPlan(updated);
      setPlanPhases(updated);
      setEditingPhase(null);
      toast.success("Đã lưu thay đổi!");
    } catch {
      toast.error("Không thể lưu.");
    } finally {
      setSavingPlan(false);
    }
  };

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

  const handleSavePrompt = async () => {
    setSavingPrompt(true);
    try {
      await saveGlobalSystemPrompt(prompt);
      toast.success("Đã lưu cấu hình thành công!");
    } catch {
      toast.error("Lưu cấu hình thất bại!");
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleSaveSamplingParams = async () => {
    setSavingSamplingParams(true);
    try {
      await saveSamplingParameters(samplingParams);
      toast.success("Đã lưu sampling parameters thành công!");
    } catch {
      toast.error("Lưu sampling parameters thất bại!");
    } finally {
      setSavingSamplingParams(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const card = await readJsonFile(file);
      if (!card.data.name.trim()) {
        toast.error("File JSON thiếu trường 'name'.");
        return;
      }
      const saved = await createCharacter(card, user!.id, true);
      toast.success(`Đã import nhân vật công khai: ${saved.name}`);
    } catch (err: any) {
      toast.error(err.message || "Import thất bại.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleImportRawJson = async () => {
    const trimmed = rawJson.trim();
    if (!trimmed) {
      toast.error("Vui lòng dán JSON vào ô bên dưới.");
      return;
    }
    setImportingRaw(true);
    try {
      const parsed = JSON5.parse(trimmed);
      const card = parseTavernCardJson(parsed);
      if (!card.data.name.trim()) {
        toast.error("JSON thiếu trường 'name'.");
        return;
      }
      const saved = await createCharacter(card, user!.id, true);
      toast.success(`Đã import nhân vật công khai: ${saved.name}`);
      setRawJson("");
    } catch (err: any) {
      toast.error(err.message || "JSON không hợp lệ.");
    } finally {
      setImportingRaw(false);
    }
  };

  const toggleSection = (key: string) => {
    setExpandedSection((prev) => (prev === key ? null : key));
  };

  const quickLinks = [
    {
      icon: BarChart3,
      label: "Dashboard thống kê",
      description: "Xem tổng quan số liệu hệ thống",
      path: "/admin/dashboard",
      color: "text-neon-blue bg-neon-blue/10",
    },
    {
      icon: Wand2,
      label: "AI Card Generator",
      description: "Tạo Character Card bằng LLM, duyệt & xuất bản",
      path: "/admin/chargen",
      color: "text-neon-rose bg-neon-rose/10",
    },
    {
      icon: Map,
      label: "Roadmap phát triển",
      description: "Xem & chỉnh sửa lộ trình tính năng",
      path: "/admin/roadmap",
      color: "text-neon-purple bg-neon-purple/10",
    },
    {
      icon: Terminal,
      label: "Prompt Inspector",
      description: "Xem payload input token gửi tới LLM",
      path: "/admin/chatSettings",
      color: "text-neon-blue bg-neon-blue/10",
    },
    {
      icon: BookOpen,
      label: "Knowledge Base",
      description: "Kho kiến thức, prompt & template hệ thống",
      path: "/admin/knowledge",
      color: "text-green-400 bg-green-400/10",
    },
    {
      icon: ClipboardCheck,
      label: "Approval Queue",
      description: "Duyệt yêu cầu chỉnh sửa từ Operator",
      path: "/admin/approvals",
      color: "text-orange-400 bg-orange-400/10",
    },
    {
      icon: Database,
      label: "SQL Editor",
      description: "Thực thi truy vấn SQL trực tiếp trên Supabase",
      path: "/admin/sql",
      color: "text-amber-400 bg-amber-400/10",
    },
    {
      icon: Sparkles,
      label: "API Global Settings",
      description: "Verify API & quản lý model cho phép người dùng",
      path: "/admin/api-settings",
      color: "text-orange-400 bg-orange-400/10",
    },
  ];

  type InlineSection = {
    key: string;
    icon: React.ElementType;
    label: string;
    description: string;
    color: string;
  };

  const inlineSections: InlineSection[] = [
    {
      key: "prompt",
      icon: Terminal,
      label: "Global System Prompt",
      description: "Prompt âm thầm thêm vào đầu mọi cuộc trò chuyện",
      color: "text-cyan-400 bg-cyan-400/10",
    },
    {
      key: "sampling",
      icon: Wand2,
      label: "Sampling Parameters",
      description: "Điều chỉnh độ sáng tạo & độ đa dạng của AI responses",
      color: "text-neon-purple bg-neon-purple/10",
    },
    {
      key: "import",
      icon: FileJson,
      label: "Import Character Cards",
      description: "Import nhân vật từ file JSON hoặc dán raw JSON",
      color: "text-neon-rose bg-neon-rose/10",
    },
  ];

  return (
    <ScrollArea className="flex-1">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6 pb-24"
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
            isOp
              ? "bg-gradient-to-br from-neon-blue to-cyan-500"
              : isModerator
              ? "bg-gradient-to-br from-yellow-500 to-amber-600"
              : "bg-gradient-to-br from-neon-rose to-neon-purple"
          }`}>
            <Shield className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isOp ? "Operator Hub" : isModerator ? "Moderator Hub" : "Admin Hub"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isOp ? "Quản lý hệ thống VietRP (Operator)" : isModerator ? "Xem thống kê & nội dung hệ thống (Read-Only)" : "Quản trị hệ thống VietRP"}
            </p>
          </div>
        </div>

        {/* Operator notice banner */}
        {isOp && (
          <Card className="bg-neon-blue/5 border-neon-blue/20">
            <CardContent className="p-3 flex items-center gap-2.5">
              <ShieldCheck size={16} className="text-neon-blue flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                Bạn đang truy cập với quyền <span className="text-neon-blue font-medium">Operator</span>. 
                Có thể xem tất cả & chỉnh sửa — các thay đổi quan trọng sẽ cần Admin duyệt.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Moderator read-only notice banner */}
        {isModerator && (
          <Card className="bg-yellow-500/5 border-yellow-500/20">
            <CardContent className="p-3 flex items-center gap-2.5">
              <ShieldCheck size={16} className="text-yellow-400 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                Bạn đang truy cập với quyền <span className="text-yellow-400 font-medium">Moderator</span>.
                Chỉ có quyền xem — không thể thực hiện thao tác chỉnh sửa.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={Sparkles} label="Nhân vật" value={stats.characters} color="text-neon-purple bg-neon-purple/10" />
          <StatCard icon={Users} label="Người dùng" value={stats.users} color="text-neon-blue bg-neon-blue/10" />
          <StatCard icon={MessageSquare} label="Phiên chat" value={stats.sessions} color="text-neon-rose bg-neon-rose/10" />
        </div>

        {/* Pinned Subscription Plan Board */}
        <div className="relative">
          <Card className="bg-gradient-to-br from-oled-surface to-oled-elevated border border-neon-blue/20 overflow-hidden">
            {/* Glow accent */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-neon-blue via-neon-purple to-neon-rose" />

            <CardContent className="p-4 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-neon-blue/10 flex items-center justify-center">
                    <Rocket size={18} className="text-neon-blue" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-foreground">Subscription System</h2>
                      <Badge variant="outline" className="text-[10px] border-neon-blue/30 text-neon-blue py-0 h-5">
                        <Pin size={8} className="mr-1" /> Ghim
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      BYOK Chat + Credit System + Role Permissions ·{" "}
                      <span className="text-green-400">{planPhases.filter(p => p.status === "done").length}</span>
                      /{planPhases.length} hoàn thành
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link to="/admin/roadmap" className="text-[10px] text-neon-purple hover:underline flex items-center gap-1">
                    Roadmap <ExternalLink size={10} />
                  </Link>
                  <button
                    onClick={() => setPlanExpanded(!planExpanded)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-oled-elevated transition-colors"
                  >
                    <ChevronDown size={16} className={`transition-transform duration-200 ${planExpanded ? "rotate-180" : ""}`} />
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 bg-oled-base rounded-full overflow-hidden flex gap-0.5">
                {planPhases.map((phase) => (
                  <div
                    key={phase.id}
                    className={`flex-1 rounded-full transition-colors duration-300 ${
                      phase.status === "done"
                        ? "bg-green-400"
                        : phase.status === "in-progress"
                        ? "bg-yellow-400 animate-pulse"
                        : "bg-muted-foreground/20"
                    }`}
                  />
                ))}
              </div>

              {/* Compact phase chips (always visible) */}
              <div className="flex flex-wrap gap-1.5">
                {planPhases.map((phase) => {
                  const { icon: StatusIcon, color } = planStatusConfig[phase.status];
                  return (
                    <button
                      key={phase.id}
                      onClick={() => isAdmin && handlePlanStatusToggle(phase.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] transition-all ${
                        isAdmin ? "hover:scale-105 cursor-pointer" : "cursor-default"
                      } ${planStatusConfig[phase.status].bg}`}
                      title={isAdmin ? `Click để đổi trạng thái · ${phase.title}` : phase.title}
                    >
                      <StatusIcon size={12} className={color} />
                      <span className="text-foreground font-medium">P{phase.id}</span>
                    </button>
                  );
                })}
              </div>

              {/* Expanded details */}
              <AnimatePresence>
                {planExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2 pt-2 border-t border-gray-border">
                      {planPhases.map((phase) => {
                        const { icon: StatusIcon, color } = planStatusConfig[phase.status];
                        const isEditing = editingPhase?.id === phase.id;

                        if (isEditing) {
                          return (
                            <div key={phase.id} className="bg-oled-base rounded-xl p-3 space-y-2 border border-neon-purple/20">
                              <div className="flex items-center gap-2">
                                <Input
                                  value={editingPhase.title}
                                  onChange={(e) => setEditingPhase({ ...editingPhase, title: e.target.value })}
                                  className="bg-oled-elevated border-gray-border text-foreground text-sm h-8 flex-1"
                                />
                                <Select
                                  value={editingPhase.status}
                                  onValueChange={(v) => setEditingPhase({ ...editingPhase, status: v as PlanPhaseStatus })}
                                >
                                  <SelectTrigger className="w-32 h-8 bg-oled-elevated border-gray-border text-foreground text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="done">✅ Hoàn thành</SelectItem>
                                    <SelectItem value="in-progress">🔨 Đang làm</SelectItem>
                                    <SelectItem value="planned">⭕ Dự kiến</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <Input
                                value={editingPhase.description}
                                onChange={(e) => setEditingPhase({ ...editingPhase, description: e.target.value })}
                                placeholder="Mô tả..."
                                className="bg-oled-elevated border-gray-border text-foreground text-xs h-8"
                              />
                              <Textarea
                                value={editingPhase.details.join("\n")}
                                onChange={(e) => setEditingPhase({ ...editingPhase, details: e.target.value.split("\n") })}
                                rows={3}
                                className="bg-oled-elevated border-gray-border text-foreground text-xs font-mono resize-none"
                              />
                              <div className="flex gap-2 justify-end">
                                <Button size="sm" variant="ghost" onClick={() => setEditingPhase(null)} className="h-7 text-xs">
                                  <X size={12} className="mr-1" /> Huỷ
                                </Button>
                                <Button size="sm" onClick={handleSavePhaseEdit} disabled={savingPlan} className="h-7 text-xs bg-neon-purple hover:bg-neon-purple/80 text-white">
                                  {savingPlan ? <Loader2 size={12} className="animate-spin mr-1" /> : <Save size={12} className="mr-1" />}
                                  Lưu
                                </Button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={phase.id}
                            className="bg-oled-base rounded-xl p-3 group hover:border-neon-blue/20 border border-transparent transition-colors"
                          >
                            <div className="flex items-start gap-2">
                              <button
                                onClick={() => handlePlanStatusToggle(phase.id)}
                                className="mt-0.5 shrink-0 hover:scale-125 transition-transform"
                                title="Click để đổi trạng thái"
                              >
                                <StatusIcon size={16} className={color} />
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-neon-blue/30 text-neon-blue shrink-0">
                                    Phase {phase.id}
                                  </Badge>
                                  <span className="text-sm font-medium text-foreground truncate">{phase.title}</span>
                                  {isAdmin && (
                                    <button
                                      onClick={() => setEditingPhase({ ...phase })}
                                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-neon-blue"
                                    >
                                      <Pencil size={11} />
                                    </button>
                                  )}
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">{phase.description}</p>
                                <ul className="mt-1.5 space-y-0.5">
                                  {phase.details.map((d, i) => {
                                    const isPending = d.startsWith("~");
                                    const display = isPending ? d.slice(1) : d;
                                    return (
                                      <li key={i} className={`text-[10px] flex items-start gap-1.5 ${
                                        isPending ? "text-muted-foreground/30 italic" : "text-muted-foreground/70"
                                      }`}>
                                        <span className={`mt-px ${isPending ? "text-neon-purple/30" : "text-neon-blue/50"}`}>
                                          {isPending ? "◇" : "›"}
                                        </span>
                                        <span>{display}</span>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>

        {/* Quick Links + Inline Sections */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Truy cập nhanh</h2>

          {/* Page links — SQL Editor hidden for op */}
          {quickLinks
            .filter((link) => isAdmin || link.path !== "/admin/sql")
            .map((link) => (
            <Link key={link.path} to={link.path}>
              <Card className="bg-oled-surface border-oled-border hover:border-neon-purple/40 transition-colors cursor-pointer group">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${link.color}`}>
                    <link.icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{link.label}</p>
                    <p className="text-xs text-muted-foreground">{link.description}</p>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground group-hover:text-neon-purple transition-colors" />
                </CardContent>
              </Card>
            </Link>
          ))}

          {/* Expandable inline sections — admin only */}
          {isAdmin && inlineSections.map((section) => {
            const isOpen = expandedSection === section.key;
            return (
              <div key={section.key}>
                <Card
                  className={`bg-oled-surface border-oled-border hover:border-neon-purple/40 transition-colors cursor-pointer group ${
                    isOpen ? "border-neon-purple/30" : ""
                  }`}
                  onClick={() => toggleSection(section.key)}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${section.color}`}>
                      <section.icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{section.label}</p>
                      <p className="text-xs text-muted-foreground">{section.description}</p>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180 text-neon-purple" : ""}`}
                    />
                  </CardContent>
                </Card>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-oled-surface border border-t-0 border-oled-border rounded-b-xl p-4 space-y-3">
                        {section.key === "prompt" && (
                          <>
                            <p className="text-xs text-muted-foreground">
                              Prompt này sẽ được âm thầm thêm vào đầu mọi cuộc trò chuyện để định hướng hành vi cốt lõi của AI.
                            </p>
                            <Textarea
                              rows={10}
                              value={prompt}
                              onChange={(e) => setPrompt(e.target.value)}
                              placeholder="Nhập global system prompt tại đây..."
                              className="bg-oled-base border-oled-border text-foreground font-mono text-sm resize-y min-h-[160px]"
                            />
                            <Button
                              onClick={handleSavePrompt}
                              disabled={savingPrompt}
                              className="bg-neon-blue hover:bg-neon-blue/80 text-white font-semibold"
                            >
                              {savingPrompt ? <Loader2 size={14} className="animate-spin mr-2" /> : <Save size={14} className="mr-2" />}
                              Lưu cấu hình
                            </Button>
                          </>
                        )}

                        {section.key === "sampling" && (
                          <>
                            <p className="text-xs text-muted-foreground mb-4">
                              Các thông số này điều chỉnh <strong>độ sáng tạo</strong> và <strong>tính đa dạng</strong> của phản hồi AI. Giá trị cao = sáng tạo hơn, giá trị thấp = nhất quán hơn.
                            </p>
                            <div className="space-y-4">
                              {/* Temperature */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs font-semibold text-foreground">Temperature (độ sáng tạo)</Label>
                                  <span className="text-xs text-neon-purple font-mono">{samplingParams.temperature.toFixed(2)}</span>
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max="2"
                                  step="0.05"
                                  value={samplingParams.temperature}
                                  onChange={(e) => setSamplingParams({ ...samplingParams, temperature: parseFloat(e.target.value) })}
                                  className="w-full h-2 bg-oled-base rounded-lg appearance-none cursor-pointer accent-neon-purple"
                                />
                                <p className="text-[10px] text-muted-foreground">0.0 = Đáp ứng xác định / 2.0 = Cực kì sáng tạo</p>
                              </div>

                              {/* Top-P */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs font-semibold text-foreground">Top-P (Nucleus Sampling)</Label>
                                  <span className="text-xs text-neon-purple font-mono">{samplingParams.top_p.toFixed(2)}</span>
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.05"
                                  value={samplingParams.top_p}
                                  onChange={(e) => setSamplingParams({ ...samplingParams, top_p: parseFloat(e.target.value) })}
                                  className="w-full h-2 bg-oled-base rounded-lg appearance-none cursor-pointer accent-neon-purple"
                                />
                                <p className="text-[10px] text-muted-foreground">0.9 = Cân bằng sáng tạo & nhất quán / 1.0 = Không có giới hạn</p>
                              </div>

                              {/* Top-K */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs font-semibold text-foreground">Top-K (Diversity)</Label>
                                  <span className="text-xs text-neon-purple font-mono">{Math.round(samplingParams.top_k)}</span>
                                </div>
                                <input
                                  type="range"
                                  min="1"
                                  max="100"
                                  step="1"
                                  value={samplingParams.top_k}
                                  onChange={(e) => setSamplingParams({ ...samplingParams, top_k: parseFloat(e.target.value) })}
                                  className="w-full h-2 bg-oled-base rounded-lg appearance-none cursor-pointer accent-neon-purple"
                                />
                                <p className="text-[10px] text-muted-foreground">Số từ tốt nhất cần xem xét (40 = cân bằng tốt)</p>
                              </div>

                              {/* Repetition Penalty */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs font-semibold text-foreground">Repetition Penalty</Label>
                                  <span className="text-xs text-neon-purple font-mono">{samplingParams.repetition_penalty.toFixed(2)}</span>
                                </div>
                                <input
                                  type="range"
                                  min="0.8"
                                  max="2"
                                  step="0.05"
                                  value={samplingParams.repetition_penalty}
                                  onChange={(e) => setSamplingParams({ ...samplingParams, repetition_penalty: parseFloat(e.target.value) })}
                                  className="w-full h-2 bg-oled-base rounded-lg appearance-none cursor-pointer accent-neon-purple"
                                />
                                <p className="text-[10px] text-muted-foreground">1.0 = Không phạt / 1.2+ = Tránh lặp lại từ (tốt cho roleplay)</p>
                              </div>
                            </div>

                            <div className="bg-oled-base/50 border border-oled-border rounded-lg p-3 mt-4">
                              <p className="text-[10px] text-muted-foreground">
                                <strong>💡 Gợi ý:</strong> Temperature 0.8-1.0 + Top-P 0.85-0.95 + Repetition Penalty 1.1-1.2 = Roleplay tốt với sáng tạo phù hợp
                              </p>
                            </div>

                            <Button
                              onClick={handleSaveSamplingParams}
                              disabled={savingSamplingParams}
                              className="w-full bg-neon-purple hover:bg-neon-purple/80 text-white font-semibold"
                            >
                              {savingSamplingParams ? <Loader2 size={14} className="animate-spin mr-2" /> : <Save size={14} className="mr-2" />}
                              Lưu Sampling Parameters
                            </Button>
                          </>
                        )}

                        {section.key === "import" && (
                          <>
                            <p className="text-xs text-muted-foreground">
                              Chọn file JSON TavernCardV2 để import, hoặc dán raw JSON vào ô bên dưới.
                            </p>

                            {/* File import */}
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept=".json"
                              multiple
                              className="hidden"
                              onChange={handleFileChange}
                            />
                            <Button
                              onClick={handleImportClick}
                              disabled={importing}
                              variant="outline"
                              className="border-neon-rose/40 text-neon-rose hover:bg-neon-rose/10"
                            >
                              {importing ? <Loader2 size={14} className="animate-spin mr-2" /> : <Upload size={14} className="mr-2" />}
                              {importing ? "Đang xử lý..." : "Chọn file JSON"}
                            </Button>

                            {/* Divider */}
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-px bg-gray-border" />
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">hoặc dán JSON</span>
                              <div className="flex-1 h-px bg-gray-border" />
                            </div>

                            {/* Raw JSON paste */}
                            <Textarea
                              rows={8}
                              value={rawJson}
                              onChange={(e) => setRawJson(e.target.value)}
                              placeholder='{"spec":"chara_card_v2","spec_version":"2.0","data":{"name":"..."}}'
                              className="bg-oled-base border-oled-border text-foreground font-mono text-xs resize-y min-h-[120px]"
                            />
                            <Button
                              onClick={handleImportRawJson}
                              disabled={importingRaw || !rawJson.trim()}
                              variant="outline"
                              className="border-neon-rose/40 text-neon-rose hover:bg-neon-rose/10"
                            >
                              {importingRaw ? (
                                <Loader2 size={14} className="animate-spin mr-2" />
                              ) : (
                                <ClipboardPaste size={14} className="mr-2" />
                              )}
                              {importingRaw ? "Đang xử lý..." : "Import từ JSON"}
                            </Button>
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </motion.div>
    </ScrollArea>
  );
};

export default AdminPage;
