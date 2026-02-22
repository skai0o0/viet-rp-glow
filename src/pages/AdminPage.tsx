import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Shield, Loader2 } from "lucide-react";

const STORAGE_KEY = "vietrp_global_system_prompt";

// Mock admin check — expand later with a proper roles system
const ADMIN_EMAILS = ["admin@vietrp.com"]; // Add your email here
function isAdmin(email?: string): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email);
}

export function getGlobalSystemPrompt(): string {
  return localStorage.getItem(STORAGE_KEY) || "";
}

const AdminPage = () => {
  const { user, isLoading } = useAuth();
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    setPrompt(getGlobalSystemPrompt());
  }, []);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-oled-base">
        <Loader2 size={24} className="animate-spin text-neon-purple" />
      </div>
    );
  }

  if (!user || !isAdmin(user.email)) {
    return <Navigate to="/" replace />;
  }

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, prompt);
    toast.success("Đã lưu cấu hình thành công!");
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
    </motion.div>
  );
};

export default AdminPage;
