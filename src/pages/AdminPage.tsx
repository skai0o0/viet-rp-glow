import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Navigate, Link } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createCharacter } from "@/services/characterDb";
import { readJsonFile } from "@/utils/importCharacterJson";

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
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stats
  const [stats, setStats] = useState({ characters: "—", users: "—", sessions: "—" });

  useEffect(() => {
    fetchGlobalSystemPrompt().then(setPrompt);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    // Fetch basic stats
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

  const handleSave = async () => {
    try {
      await saveGlobalSystemPrompt(prompt);
      toast.success("Đã lưu cấu hình thành công!");
    } catch {
      toast.error("Lưu cấu hình thất bại!");
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

  const quickLinks = [
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
          <StatCard
            icon={Sparkles}
            label="Nhân vật"
            value={stats.characters}
            color="text-neon-purple bg-neon-purple/10"
          />
          <StatCard icon={Users} label="Người dùng" value={stats.users} color="text-neon-blue bg-neon-blue/10" />
          <StatCard
            icon={MessageSquare}
            label="Phiên chat"
            value={stats.sessions}
            color="text-neon-rose bg-neon-rose/10"
          />
        </div>

        {/* Quick Links */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Truy cập nhanh</h2>
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
                  <ChevronRight
                    size={16}
                    className="text-muted-foreground group-hover:text-neon-purple transition-colors"
                  />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Global System Prompt */}
        <Card className="bg-oled-surface border-oled-border">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Terminal size={18} className="text-neon-blue" />
              <CardTitle className="text-base">Global System Prompt</CardTitle>
            </div>
            <CardDescription>
              Prompt này sẽ được âm thầm thêm vào đầu mọi cuộc trò chuyện để định hướng hành vi cốt lõi của AI.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              id="global-prompt"
              rows={12}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Nhập global system prompt tại đây..."
              className="bg-oled-base border-oled-border text-foreground font-mono text-sm resize-y min-h-[200px]"
            />
            <Button onClick={handleSave} className="bg-neon-blue hover:bg-neon-blue/80 text-white font-semibold">
              Lưu cấu hình
            </Button>
          </CardContent>
        </Card>

        {/* Import Character */}
        <Card className="bg-oled-surface border-oled-border">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileJson size={18} className="text-neon-rose" />
              <CardTitle className="text-base">Import Character Cards</CardTitle>
            </div>
            <CardDescription>Chọn một hoặc nhiều file JSON TavernCardV2 để tạo nhân vật hàng loạt.</CardDescription>
          </CardHeader>
          <CardContent>
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
              {importing ? "Đang xử lý..." : "Chọn các file JSON"}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </ScrollArea>
  );
};

export default AdminPage;
