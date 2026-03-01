import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Navigate, Link } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
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
  type PlanPhase,
  type PlanPhaseStatus,
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
  const [prompt, setPrompt] = useState("");
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [importing, setImporting] = useState(false);
  const [rawJson, setRawJson] = useState("");
  const [importingRaw, setImportingRaw] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!isAdmin) return;
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
  }, [isAdmin]);

  if (isLoading || checking) {
    return (
      <div className="flex-1 flex items-center justify-center bg-oled-base">
        <Loader2 size={24} className="animate-spin text-neon-purple" />
      </div>
    );
  }

  if (!user || !isAdmin) {
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
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-neon-rose to-neon-purple flex items-center justify-center shadow-lg">
            <Shield className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Hub</h1>
            <p className="text-sm text-muted-foreground">Quản trị hệ thống VietRP</p>
          </div>
        </div>

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
                      Kế hoạch song song BYOK + Subscription ·{" "}
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
                      onClick={() => handlePlanStatusToggle(phase.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] transition-all hover:scale-105 ${
                        planStatusConfig[phase.status].bg
                      }`}
                      title={`Click để đổi trạng thái · ${phase.title}`}
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
                                  <button
                                    onClick={() => setEditingPhase({ ...phase })}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-neon-blue"
                                  >
                                    <Pencil size={11} />
                                  </button>
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">{phase.description}</p>
                                <ul className="mt-1.5 space-y-0.5">
                                  {phase.details.map((d, i) => (
                                    <li key={i} className="text-[10px] text-muted-foreground/70 flex items-start gap-1.5">
                                      <span className="text-neon-blue/50 mt-px">›</span>
                                      <span>{d}</span>
                                    </li>
                                  ))}
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

          {/* Page links */}
          {quickLinks.map((link) => (
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

          {/* Expandable inline sections */}
          {inlineSections.map((section) => {
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
