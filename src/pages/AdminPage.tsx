import { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createCharacter } from "@/services/characterDb";
import { readJsonFile, parseTavernCardJson } from "@/utils/importCharacterJson";
import { fetchGlobalSystemPrompt, saveGlobalSystemPrompt } from "@/services/globalSettingsDb";

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

  useEffect(() => {
    fetchGlobalSystemPrompt().then(setPrompt);
  }, []);

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
      const parsed = JSON.parse(trimmed);
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
