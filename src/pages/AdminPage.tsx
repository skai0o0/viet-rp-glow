import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Shield, Loader2, Upload, FileJson, Map } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { createCharacter } from "@/services/characterDb";
import { readJsonFile } from "@/utils/importCharacterJson";

const STORAGE_KEY = "vietrp_global_system_prompt";

export function getGlobalSystemPrompt(): string {
  return localStorage.getItem(STORAGE_KEY) || "";
}

const AdminPage = () => {
  const { user, isLoading } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [importing, setImporting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPrompt(getGlobalSystemPrompt());
  }, []);

  useEffect(() => {
    if (!user) { setCheckingRole(false); return; }
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" } as any)
      .then(({ data }) => {
        setIsAdmin(!!data);
        setCheckingRole(false);
      });
  }, [user]);

  if (isLoading || checkingRole) {
    return (
      <div className="flex-1 flex items-center justify-center bg-oled-base">
        <Loader2 size={24} className="animate-spin text-neon-purple" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, prompt);
    toast.success("Đã lưu cấu hình thành công!");
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
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex flex-col p-4 md:p-8 max-w-3xl mx-auto w-full gap-6"
    >
      <div className="flex items-center gap-3">
        <Shield className="text-neon-rose" size={28} />
        <h1 className="text-2xl font-bold text-foreground">
          Admin Dashboard - System Configuration
        </h1>
      </div>

      {/* Global System Prompt */}
      <div className="flex flex-col gap-3">
        <Label htmlFor="global-prompt" className="text-base font-semibold text-foreground">
          Global Base System Prompt
        </Label>
        <p className="text-sm text-muted-foreground">
          Đoạn prompt này sẽ được âm thầm thêm vào đầu mọi cuộc trò chuyện để định hướng hành vi cốt lõi của AI.
        </p>
        <Textarea
          id="global-prompt"
          rows={15}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Nhập global system prompt tại đây..."
          className="bg-oled-surface border-oled-border text-foreground font-mono text-sm resize-y min-h-[300px]"
        />
      </div>

      <Button
        onClick={handleSave}
        className="self-start bg-neon-rose hover:bg-neon-rose/80 text-white font-semibold px-8"
      >
        Lưu cấu hình
      </Button>

      {/* Import Character JSON */}
      <div className="border-t border-gray-border pt-6 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <FileJson className="text-neon-blue" size={20} />
          <Label className="text-base font-semibold text-foreground">
            Import Character Card (JSON)
          </Label>
        </div>
        <p className="text-sm text-muted-foreground">
          Upload file JSON theo chuẩn TavernCardV2 để tạo nhân vật công khai ngay lập tức.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileChange}
        />

        <Button
          onClick={handleImportClick}
          disabled={importing}
          variant="outline"
          className="self-start border-neon-blue text-neon-blue hover:bg-neon-blue/10"
        >
          {importing ? (
            <Loader2 size={14} className="animate-spin mr-2" />
          ) : (
            <Upload size={14} className="mr-2" />
          )}
          {importing ? "Đang import..." : "Chọn file JSON"}
        </Button>
      </div>

      {/* Roadmap Link */}
      <div className="border-t border-gray-border pt-6">
        <Button asChild variant="outline" className="border-neon-purple text-neon-purple hover:bg-neon-purple/10">
          <Link to="/admin/roadmap">
            <Map size={14} className="mr-2" />
            Xem Roadmap phát triển
          </Link>
        </Button>
      </div>
    </motion.div>
  );
};

export default AdminPage;
