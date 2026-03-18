import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import {
  Loader2,
  ArrowLeft,
  Key,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface PlatformKey {
  id: string;
  key_name: string;
  api_key: string;
  is_active: boolean;
  request_count: number;
  last_used_at: string | null;
  created_at: string;
}

const AdminPlatformKeysPage = () => {
  const { user, isLoading } = useAuth();
  const { isAdmin, checking } = useUserRole();

  const [keys, setKeys] = useState<PlatformKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [addingKey, setAddingKey] = useState(false);
  const [showKeyId, setShowKeyId] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    const { data, error } = await supabase
      .from("platform_api_keys")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Không thể tải danh sách API keys");
      return;
    }
    setKeys((data ?? []) as PlatformKey[]);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    fetchKeys().finally(() => setLoading(false));
  }, [isAdmin, fetchKeys]);

  const handleAddKey = async () => {
    if (!newKeyName.trim() || !newKeyValue.trim()) {
      toast.error("Vui lòng nhập tên và API key.");
      return;
    }
    setAddingKey(true);
    const { error } = await supabase.from("platform_api_keys").insert({
      key_name: newKeyName.trim(),
      api_key: newKeyValue.trim(),
    });
    if (error) {
      toast.error("Không thể thêm key: " + error.message);
    } else {
      toast.success("Đã thêm API key!");
      setNewKeyName("");
      setNewKeyValue("");
      await fetchKeys();
    }
    setAddingKey(false);
  };

  const handleToggleKey = async (key: PlatformKey) => {
    const { error } = await supabase
      .from("platform_api_keys")
      .update({ is_active: !key.is_active })
      .eq("id", key.id);
    if (error) {
      toast.error("Không thể cập nhật trạng thái");
    } else {
      setKeys((prev) =>
        prev.map((k) => (k.id === key.id ? { ...k, is_active: !k.is_active } : k)),
      );
    }
  };

  const handleDeleteKey = async (id: string) => {
    const { error } = await supabase.from("platform_api_keys").delete().eq("id", id);
    if (error) {
      toast.error("Không thể xóa key");
    } else {
      setKeys((prev) => prev.filter((k) => k.id !== id));
      toast.success("Đã xóa API key");
    }
  };

  if (isLoading || checking) {
    return (
      <div className="flex-1 flex items-center justify-center bg-oled-base">
        <Loader2 size={24} className="animate-spin text-neon-purple" />
      </div>
    );
  }
  if (!user || !isAdmin) return <Navigate to="/" replace />;

  const activeCount = keys.filter((k) => k.is_active).length;

  return (
    <ScrollArea className="flex-1">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6 pb-24"
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/admin">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft size={20} />
            </Button>
          </Link>
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
            <Key className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Platform API Keys</h1>
            <p className="text-sm text-muted-foreground">
              Quản lý pool OpenRouter API keys — Edge Function xoay vòng giữa các key active
            </p>
          </div>
        </div>

        {/* Add new key */}
        <Card className="bg-oled-surface border-oled-border">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key size={16} className="text-amber-400" />
                <h2 className="text-sm font-bold text-foreground">Thêm API Key</h2>
              </div>
              <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-400 py-0 h-5">
                {activeCount} active
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Nhập OpenRouter API key. Khi user chat, Edge Function sẽ random chọn 1 key active từ pool.
            </p>
            <div className="flex gap-2">
              <Input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Tên (VD: Key #1)"
                className="bg-oled-elevated border-gray-border text-foreground text-sm h-9 flex-[0.3]"
              />
              <Input
                value={newKeyValue}
                onChange={(e) => setNewKeyValue(e.target.value)}
                placeholder="sk-or-v1-..."
                type="password"
                className="bg-oled-elevated border-gray-border text-foreground text-sm h-9 flex-[0.7] font-mono"
              />
              <Button
                size="sm"
                onClick={handleAddKey}
                disabled={addingKey}
                className="h-9 bg-amber-500 hover:bg-amber-600 text-white shrink-0"
              >
                {addingKey ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Keys list */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-neon-purple" /></div>
        ) : keys.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            Chưa có API key nào. Thêm key ở trên để bắt đầu.
          </div>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => (
              <Card key={k.id} className={`bg-oled-surface border-oled-border ${!k.is_active ? "opacity-50" : ""}`}>
                <CardContent className="p-3 flex items-center gap-3">
                  <button onClick={() => handleToggleKey(k)} className="shrink-0" title={k.is_active ? "Tắt" : "Bật"}>
                    {k.is_active ? (
                      <ToggleRight size={22} className="text-green-400" />
                    ) : (
                      <ToggleLeft size={22} className="text-muted-foreground" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{k.key_name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {showKeyId === k.id ? k.api_key : `${k.api_key.slice(0, 12)}...${k.api_key.slice(-4)}`}
                      </span>
                      <button onClick={() => setShowKeyId(showKeyId === k.id ? null : k.id)} className="text-muted-foreground hover:text-foreground">
                        {showKeyId === k.id ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                      <span>{k.request_count.toLocaleString()} requests</span>
                      {k.last_used_at && <span>· Last: {new Date(k.last_used_at).toLocaleDateString("vi-VN")}</span>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-red-400"
                    onClick={() => handleDeleteKey(k.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={() => { setLoading(true); fetchKeys().finally(() => setLoading(false)); }}
            className="text-xs text-muted-foreground hover:text-neon-blue">
            <RefreshCw size={12} className="mr-1.5" /> Làm mới
          </Button>
        </div>
      </motion.div>
    </ScrollArea>
  );
};

export default AdminPlatformKeysPage;
