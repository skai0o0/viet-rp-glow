import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Settings, Eye, EyeOff, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  getApiKey,
  setApiKey,
  getModel,
  setModel,
  AVAILABLE_MODELS,
} from "@/services/openRouter";

const SettingsPage = () => {
  const [apiKey, setApiKeyState] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [model, setModelState] = useState<string>(AVAILABLE_MODELS[0].id);

  useEffect(() => {
    setApiKeyState(getApiKey());
    setModelState(getModel());
  }, []);

  const handleSaveKey = () => {
    setApiKey(apiKey);
    toast.success("Đã lưu API Key thành công!");
  };

  const handleModelChange = (value: string) => {
    setModelState(value);
    setModel(value);
    toast.success("Đã thay đổi model AI!");
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
            <h2 className="text-sm font-semibold text-foreground">
              Kết nối AI
            </h2>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">
              OpenRouter API Key
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKeyState(e.target.value)}
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
                onClick={handleSaveKey}
                className="px-4 rounded-xl bg-neon-purple/10 border border-neon-purple/30 text-neon-purple text-sm font-medium hover:shadow-neon-purple transition-all duration-300 flex items-center gap-1.5"
              >
                <Check size={14} />
                Lưu
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Lấy API Key tại{" "}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neon-blue hover:underline"
              >
                openrouter.ai/keys
              </a>
              . Key được lưu trữ cục bộ trên trình duyệt của bạn.
            </p>
          </div>

          {/* Model Selector */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Model AI</label>
            <Select value={model} onValueChange={handleModelChange}>
              <SelectTrigger className="bg-oled-elevated border-gray-border text-foreground focus:border-neon-purple focus:ring-neon-purple/30">
                <SelectValue placeholder="Chọn model..." />
              </SelectTrigger>
              <SelectContent className="bg-oled-elevated border-gray-border">
                {AVAILABLE_MODELS.map((m) => (
                  <SelectItem
                    key={m.id}
                    value={m.id}
                    className="text-foreground focus:bg-neon-purple/10 focus:text-foreground"
                  >
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Chọn model phù hợp với nhu cầu roleplay của bạn.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SettingsPage;
