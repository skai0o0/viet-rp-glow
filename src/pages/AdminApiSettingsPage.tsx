import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  ShieldCheck,
  Plus,
  Trash2,
  Star,
  Search,
  ArrowLeft,
  Zap,
  BadgeCheck,
  DollarSign,
  Gift,
  GripVertical,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  fetchAllowedModels,
  addAllowedModel,
  removeAllowedModel,
  toggleModelRecommended,
  AllowedModel,
} from "@/services/globalSettingsDb";
import {
  verifyApiKey,
  fetchOpenRouterModels,
  type OpenRouterModel,
} from "@/services/openRouter";

const AdminApiSettingsPage = () => {
  const { user, isLoading } = useAuth();
  const { isAdmin, checking } = useIsAdmin();

  // API verification
  const [testApiKey, setTestApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);

  // OpenRouter models (full list)
  const [allModels, setAllModels] = useState<OpenRouterModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // Allowed models (admin-curated)
  const [allowedModels, setAllowedModels] = useState<AllowedModel[]>([]);
  const [loadingAllowed, setLoadingAllowed] = useState(true);

  // Search
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    fetchAllowedModels().then((m) => {
      setAllowedModels(m);
      setLoadingAllowed(false);
    });
  }, []);

  const handleLoadModels = useCallback(async () => {
    setLoadingModels(true);
    try {
      const models = await fetchOpenRouterModels();
      setAllModels(models);
      if (models.length === 0) {
        toast.error("Không thể tải danh sách model từ OpenRouter.");
      } else {
        toast.success(`Đã tải ${models.length} model từ OpenRouter.`);
      }
    } catch {
      toast.error("Lỗi khi tải danh sách model.");
    } finally {
      setLoadingModels(false);
    }
  }, []);

  const handleVerify = async () => {
    if (!testApiKey.trim()) {
      toast.error("Vui lòng nhập API Key để verify.");
      return;
    }
    setVerifying(true);
    setVerified(null);
    const result = await verifyApiKey(testApiKey);
    setVerifying(false);
    setVerified(result.valid);
    if (result.valid) {
      toast.success("API Key hợp lệ! ✓");
    } else {
      toast.error(result.error || "API Key không hợp lệ.");
    }
  };

  const allowedModelIds = useMemo(
    () => new Set(allowedModels.map((m) => m.model_id)),
    [allowedModels]
  );

  const filteredModels = useMemo(() => {
    if (!search.trim()) return allModels;
    const q = search.toLowerCase();
    return allModels.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q)
    );
  }, [allModels, search]);

  const handleAddModel = async (model: OpenRouterModel) => {
    if (allowedModelIds.has(model.id)) return;
    setAdding(model.id);
    try {
      // Extract provider from model ID (e.g. "google/gemini-pro" → "google")
      const provider = model.id.split("/")[0] || "";
      const isFree =
        model.pricing?.prompt === "0" && model.pricing?.completion === "0";

      const saved = await addAllowedModel({
        model_id: model.id,
        model_name: model.name,
        provider,
        is_free: isFree,
        sort_order: allowedModels.length,
      });
      setAllowedModels((prev) => [...prev, saved]);
      toast.success(`Đã thêm: ${model.name}`);
    } catch (err: any) {
      if (err?.message?.includes("duplicate")) {
        toast.error("Model này đã có trong danh sách.");
      } else {
        toast.error("Không thể thêm model.");
      }
    } finally {
      setAdding(null);
    }
  };

  const handleRemoveModel = async (id: string) => {
    try {
      await removeAllowedModel(id);
      setAllowedModels((prev) => prev.filter((m) => m.id !== id));
      toast.success("Đã xoá model.");
    } catch {
      toast.error("Không thể xoá model.");
    }
  };

  const handleToggleRecommended = async (model: AllowedModel) => {
    const newVal = !model.is_recommended;
    try {
      await toggleModelRecommended(model.id, newVal);
      setAllowedModels((prev) =>
        prev.map((m) => (m.id === model.id ? { ...m, is_recommended: newVal } : m))
      );
    } catch {
      toast.error("Không thể cập nhật.");
    }
  };

  const formatPrice = (pricing?: { prompt?: string; completion?: string }) => {
    if (!pricing) return "N/A";
    const p = parseFloat(pricing.prompt || "0");
    const c = parseFloat(pricing.completion || "0");
    if (p === 0 && c === 0) return "Miễn phí";
    return `$${(p * 1e6).toFixed(2)} / $${(c * 1e6).toFixed(2)} per 1M tokens`;
  };

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
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
            <Zap className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">API Global Settings</h1>
            <p className="text-sm text-muted-foreground">
              Verify API & quản lý danh sách model cho người dùng
            </p>
          </div>
        </div>

        {/* API Key Verification */}
        <Card className="bg-oled-surface border-oled-border">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-neon-blue shadow-neon-blue" />
              <h2 className="text-sm font-semibold text-foreground">Verify OpenRouter API Key</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Kiểm tra API Key có hợp lệ trước khi hướng dẫn người dùng. Key này KHÔNG được lưu trữ.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showKey ? "text" : "password"}
                  value={testApiKey}
                  onChange={(e) => { setTestApiKey(e.target.value); setVerified(null); }}
                  placeholder="sk-or-v1-..."
                  className="bg-oled-elevated border-gray-border text-foreground pr-10 focus:border-neon-blue focus:ring-neon-blue/30"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <Button
                onClick={handleVerify}
                disabled={verifying || !testApiKey.trim()}
                className={`min-w-[100px] ${
                  verified === true
                    ? "bg-green-500/20 text-green-400 border-green-500/30"
                    : verified === false
                    ? "bg-destructive/20 text-destructive border-destructive/30"
                    : "bg-neon-blue/10 text-neon-blue border-neon-blue/30 hover:bg-neon-blue/20"
                }`}
                variant="outline"
              >
                {verifying ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} className="mr-1" />}
                {verified === true ? "Hợp lệ ✓" : verified === false ? "Lỗi ✗" : "Verify"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Allowed Models (Admin-Curated) */}
        <Card className="bg-oled-surface border-oled-border">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-neon-purple shadow-neon-purple" />
                <h2 className="text-sm font-semibold text-foreground">
                  Model cho phép ({allowedModels.length})
                </h2>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><Star size={10} className="text-yellow-500" /> Đề xuất</span>
                <span className="flex items-center gap-1"><Gift size={10} className="text-green-400" /> Miễn phí</span>
              </div>
            </div>

            {loadingAllowed ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
              </div>
            ) : allowedModels.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Chưa có model nào. Tải danh sách từ OpenRouter bên dưới để thêm.
              </p>
            ) : (
              <div className="space-y-1.5">
                {allowedModels.map((model) => (
                  <motion.div
                    key={model.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="flex items-center gap-2 bg-oled-elevated rounded-xl px-3 py-2.5 group"
                  >
                    <GripVertical size={14} className="text-muted-foreground/30 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-foreground truncate">{model.model_name}</span>
                        {model.is_recommended && (
                          <BadgeCheck size={14} className="text-yellow-500 shrink-0" />
                        )}
                        {model.is_free && (
                          <span className="text-[9px] font-bold bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full shrink-0">
                            FREE
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{model.model_id}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground bg-oled-base px-2 py-0.5 rounded-full shrink-0">
                      {model.provider}
                    </span>
                    <button
                      onClick={() => handleToggleRecommended(model)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        model.is_recommended
                          ? "text-yellow-500 bg-yellow-500/10"
                          : "text-muted-foreground/40 hover:text-yellow-500 hover:bg-yellow-500/10"
                      }`}
                      title={model.is_recommended ? "Bỏ đề xuất" : "Đánh dấu đề xuất"}
                    >
                      <Star size={14} />
                    </button>
                    <button
                      onClick={() => handleRemoveModel(model.id)}
                      className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Xoá model"
                    >
                      <Trash2 size={14} />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Browse & Add Models from OpenRouter */}
        <Card className="bg-oled-surface border-oled-border">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <h2 className="text-sm font-semibold text-foreground">
                  Tìm & thêm model từ OpenRouter
                </h2>
              </div>
              <Button
                onClick={handleLoadModels}
                disabled={loadingModels}
                variant="outline"
                size="sm"
                className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              >
                {loadingModels ? (
                  <Loader2 size={14} className="animate-spin mr-1" />
                ) : (
                  <RefreshCw size={14} className="mr-1" />
                )}
                {allModels.length > 0 ? "Tải lại" : "Tải danh sách"}
              </Button>
            </div>

            {allModels.length > 0 && (
              <>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm model theo tên hoặc ID..."
                    className="bg-oled-elevated border-gray-border text-foreground pl-9 focus:border-amber-500 focus:ring-amber-500/30"
                  />
                </div>

                <p className="text-[10px] text-muted-foreground">
                  Hiển thị {filteredModels.length} / {allModels.length} model. Click "+" để thêm vào danh sách cho phép.
                </p>

                <ScrollArea className="h-[400px] pr-2">
                  <div className="space-y-1">
                    {filteredModels.map((model) => {
                      const isAdded = allowedModelIds.has(model.id);
                      const isFree = model.pricing?.prompt === "0" && model.pricing?.completion === "0";
                      return (
                        <div
                          key={model.id}
                          className={`flex items-center gap-2 rounded-xl px-3 py-2 transition-colors ${
                            isAdded
                              ? "bg-neon-purple/5 border border-neon-purple/20"
                              : "bg-oled-elevated hover:bg-oled-elevated/80"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium text-foreground truncate">
                                {model.name}
                              </span>
                              {isFree && (
                                <span className="text-[9px] font-bold bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full shrink-0">
                                  FREE
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-muted-foreground truncate">{model.id}</span>
                              <span className="text-[10px] text-muted-foreground/50">·</span>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <DollarSign size={8} />
                                {formatPrice(model.pricing)}
                              </span>
                            </div>
                          </div>
                          {isAdded ? (
                            <span className="text-[10px] text-neon-purple font-medium px-2 py-1 rounded-lg bg-neon-purple/10">
                              Đã thêm
                            </span>
                          ) : (
                            <Button
                              onClick={() => handleAddModel(model)}
                              disabled={adding === model.id}
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-neon-purple hover:bg-neon-purple/10"
                            >
                              {adding === model.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Plus size={16} />
                              )}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </>
            )}

            {allModels.length === 0 && !loadingModels && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nhấn "Tải danh sách" để lấy tất cả model khả dụng từ OpenRouter.
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </ScrollArea>
  );
};

export default AdminApiSettingsPage;
