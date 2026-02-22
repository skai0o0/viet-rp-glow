import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Settings, Eye, EyeOff, Check, Loader2, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getApiKey,
  setApiKey,
  getModel,
  setModel,
  AVAILABLE_MODELS,
  verifyApiKey,
} from "@/services/openRouter";
import ModelCombobox from "@/components/ModelCombobox";

const SettingsPage = () => {
  const navigate = useNavigate();
  const [apiKey, setApiKeyState] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(AVAILABLE_MODELS[0].id);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    setApiKeyState(getApiKey());
    setSelectedModel(getModel());
  }, []);

  const handleVerify = async () => {
    if (!apiKey.trim()) {
      toast.error("Vui lòng nhập API Key trước.");
      return;
    }
    setVerifying(true);
    setVerified(null);
    const result = await verifyApiKey(apiKey);
    setVerifying(false);
    setVerified(result.valid);
    if (result.valid) {
      toast.success("API Key hợp lệ! ✓");
    } else {
      toast.error(result.error || "API Key không hợp lệ.");
    }
  };

  const handleModelChange = (value: string) => {
    setSelectedModel(value);
    setModel(value);
    toast.success("Đã thay đổi model AI!");
  };

  const handleSave = () => {
    setApiKey(apiKey);
    toast.success("Đã lưu cài đặt!");
    navigate("/");
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin bg-oled-base p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-lg mx-auto space-y-8"
      >
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-oled-elevated border border-gray-border flex items-center justify-center mx-auto mb-6">
            <Settings className="text-muted-foreground" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Cài Đặt</h1>
          <p className="text-sm text-muted-foreground">
            Tuỳ chỉnh trải nghiệm VietRP của bạn.
          </p>
        </div>

        {/* AI Connection */}
        <div className="bg-oled-surface border border-gray-border rounded-2xl p-5 space-y-5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-neon-purple shadow-neon-purple" />
            <h2 className="text-sm font-semibold text-foreground">Kết nối AI</h2>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">OpenRouter API Key</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKeyState(e.target.value);
                    setVerified(null);
                  }}
                  placeholder="sk-or-v1-..."
                  className="bg-oled-elevated border-gray-border text-foreground pr-10 focus:border-neon-purple focus:ring-neon-purple/30"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button
                onClick={handleVerify}
                disabled={verifying}
                className={`px-3 rounded-xl border text-sm font-medium transition-all duration-300 flex items-center gap-1.5 ${
                  verified === true
                    ? "bg-green-500/10 border-green-500/30 text-green-400"
                    : verified === false
                    ? "bg-destructive/10 border-destructive/30 text-destructive"
                    : "bg-neon-blue/10 border-neon-blue/30 text-neon-blue hover:shadow-neon-blue"
                }`}
              >
                {verifying ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                {verified === true ? "OK" : "Verify"}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Lấy API Key tại{" "}
              <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-neon-blue hover:underline">
                openrouter.ai/keys
              </a>
              . Key được lưu trữ cục bộ trên trình duyệt của bạn.
            </p>
          </div>

          {/* Model Selector */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Model AI</label>
            <ModelCombobox value={selectedModel} onValueChange={handleModelChange} />
            <p className="text-[10px] text-muted-foreground">
              Chọn model phù hợp với nhu cầu roleplay của bạn.
            </p>
          </div>

          {/* Save button */}
          <Button
            onClick={handleSave}
            className="w-full bg-neon-purple text-primary-foreground hover:shadow-neon-purple hover:scale-[1.02] transition-all duration-200"
          >
            <Check size={16} className="mr-2" />
            Lưu cài đặt
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default SettingsPage;
