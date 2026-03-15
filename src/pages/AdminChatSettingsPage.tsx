import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { Loader2, Eye, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { buildMessages } from "@/utils/promptBuilder";
import { dbCharToCard } from "@/services/characterDb";
import type { CharacterCard } from "@/types/character";

const AdminChatSettingsPage = () => {
  const { user, isLoading } = useAuth();
  const { isAdminOrOp, checking } = useUserRole();

  const [characters, setCharacters] = useState<{ id: string; name: string }[]>([]);
  const [selectedCharId, setSelectedCharId] = useState<string>("");
  const [builtMessages, setBuiltMessages] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAdminOrOp) return;
    supabase
      .from("characters")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        if (data) setCharacters(data);
      });
  }, [isAdminOrOp]);

  if (isLoading || checking) {
    return (
      <div className="flex-1 flex items-center justify-center bg-oled-base">
        <Loader2 size={24} className="animate-spin text-neon-purple" />
      </div>
    );
  }

  if (!user || !isAdminOrOp) {
    return <Navigate to="/" replace />;
  }

  const handleInspect = async () => {
    if (!selectedCharId) return;
    setLoading(true);
    try {
      const { data } = await supabase.from("characters").select("*").eq("id", selectedCharId).single();
      if (!data) throw new Error("Character not found");
      const card = dbCharToCard(data as any) as CharacterCard;
      const sampleHistory = [
        { role: "assistant" as const, content: card.first_mes || "(first message)" },
        { role: "user" as const, content: "Xin chào!" },
      ];
      const msgs = buildMessages(card, sampleHistory);
      setBuiltMessages(msgs);
    } catch (err: any) {
      console.error(err);
      setBuiltMessages(null);
    } finally {
      setLoading(false);
    }
  };

  const roleColors: Record<string, string> = {
    system: "text-neon-blue border-neon-blue/30 bg-neon-blue/5",
    user: "text-neon-green border-neon-green/30 bg-neon-green/5",
    assistant: "text-neon-rose border-neon-rose/30 bg-neon-rose/5",
  };

  return (
    <ScrollArea className="flex-1">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6 pb-24"
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/admin" className="w-10 h-10 rounded-xl bg-oled-surface border border-oled-border flex items-center justify-center hover:border-neon-purple/40 transition-colors">
            <ArrowLeft size={18} className="text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Prompt Inspector</h1>
            <p className="text-sm text-muted-foreground">Xem payload gửi tới LLM cho mỗi nhân vật</p>
          </div>
        </div>

        {/* Selector */}
        <Card className="bg-oled-surface border-oled-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Chọn nhân vật</CardTitle>
            <CardDescription>Chọn một nhân vật để xem cấu trúc tin nhắn gửi tới AI (với lịch sử chat mẫu).</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            <Select value={selectedCharId} onValueChange={setSelectedCharId}>
              <SelectTrigger className="flex-1 bg-oled-base border-oled-border">
                <SelectValue placeholder="Chọn nhân vật..." />
              </SelectTrigger>
              <SelectContent>
                {characters.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleInspect}
              disabled={!selectedCharId || loading}
              className="bg-neon-purple hover:bg-neon-purple/80 text-white font-semibold"
            >
              {loading ? <Loader2 size={14} className="animate-spin mr-2" /> : <Eye size={14} className="mr-2" />}
              Xem Payload
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {builtMessages && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Messages Array ({builtMessages.length} items)
              </h2>
              <span className="text-xs text-muted-foreground">
                ~{builtMessages.reduce((sum, m) => sum + (m.content?.length || 0), 0)} ký tự
              </span>
            </div>

            {builtMessages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className={`border ${roleColors[msg.role] || "border-oled-border"}`}>
                  <CardHeader className="pb-2 pt-3 px-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider">
                        [{i}] {msg.role}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {msg.content?.length || 0} chars
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-words text-foreground/80 max-h-96 overflow-auto">
                      {msg.content}
                    </pre>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </ScrollArea>
  );
};

export default AdminChatSettingsPage;
