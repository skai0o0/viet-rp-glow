import { useState } from "react";
import { Settings2, X, RotateCcw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TierSelector from "@/components/TierSelector";
import ModelCombobox from "@/components/ModelCombobox";
import { getSelectedTier, setSelectedTier, getModel, setModel } from "@/services/openRouter";

const STORAGE_KEY_MAX_TOKENS = "vietrp_max_tokens";
const STORAGE_KEY_RESPONSE_STYLE = "vietrp_response_style";

export const RESPONSE_STYLES: { value: string; label: string; prompt: string }[] = [
  { value: "none", label: "Mặc định (không thêm)", prompt: "" },
  {
    value: "short",
    label: "Trả lời ngắn gọn, thẳng chủ đề",
    prompt: "[System Note: Write a short, direct response. Avoid unnecessary fluff or overly long descriptions.]",
  },
  {
    value: "detailed",
    label: "Trả lời sâu, mô tả kĩ càng",
    prompt: "[System Note: Write a highly detailed response. Emphasize sensory details, deep internal thoughts, and elaborate physical actions.]",
  },
  {
    value: "match_char",
    label: "Trả lời theo tin nhắn đầu tiên của {{char}}",
    prompt: "[System Note: Strictly match the tone, length, and formatting style of {{char}}'s first message.]",
  },
  {
    value: "match_user",
    label: "Trả lời theo tin nhắn đầu tiên của {{user}}",
    prompt: "[System Note: Strictly match the tone, length, and formatting style of the user's first message.]",
  },
];

export function getMaxTokens(): number {
  const stored = localStorage.getItem(STORAGE_KEY_MAX_TOKENS);
  return stored ? parseInt(stored, 10) : 800;
}

export function setMaxTokens(val: number) {
  localStorage.setItem(STORAGE_KEY_MAX_TOKENS, String(val));
}

export function getResponseStyle(): string {
  return localStorage.getItem(STORAGE_KEY_RESPONSE_STYLE) || "none";
}

export function setResponseStyle(val: string) {
  localStorage.setItem(STORAGE_KEY_RESPONSE_STYLE, val);
}

export function getResponseStylePrompt(): string {
  const style = getResponseStyle();
  return RESPONSE_STYLES.find((s) => s.value === style)?.prompt || "";
}

interface GenerationSettingsProps {
  scenario: string;
  onScenarioChange: (val: string) => void;
  onClose?: () => void;
  defaultScenario?: string;
  customFirstMes?: string;
  onCustomFirstMesChange?: (val: string) => void;
  isPendingChat?: boolean;
  defaultFirstMes?: string;
  userTier?: string;
  isByok?: boolean;
}

const GenerationSettings = ({
  scenario,
  onScenarioChange,
  onClose,
  defaultScenario,
  customFirstMes,
  onCustomFirstMesChange,
  isPendingChat,
  defaultFirstMes,
  userTier,
  isByok = false,
}: GenerationSettingsProps) => {
  const [selectedTier, setSelectedTierState] = useState(getSelectedTier());
  const [selectedModel, setSelectedModel] = useState(getModel());
  const [maxTokens, setMaxTokensState] = useState(getMaxTokens());
  const [responseStyle, setResponseStyleState] = useState(getResponseStyle());

  const handleTierChange = (val: string) => {
    setSelectedTierState(val);
    setSelectedTier(val);
  };

  const handleMaxTokensChange = (val: number[]) => {
    const v = val[0];
    setMaxTokensState(v);
    setMaxTokens(v);
  };

  const handleStyleChange = (val: string) => {
    setResponseStyleState(val);
    setResponseStyle(val);
  };

  return (
    <div className="h-full flex flex-col bg-oled-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-border">
        <div className="flex items-center gap-2">
          <Settings2 size={16} className="text-neon-purple" />
          <h3 className="text-sm font-semibold text-foreground">Điều khiển thế giới</h3>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="p-4 space-y-6">
          {/* Response Style */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Phong cách trả lời
            </Label>
            <Select value={responseStyle} onValueChange={handleStyleChange}>
              <SelectTrigger className="bg-oled-elevated border-gray-border text-foreground text-xs focus:ring-neon-purple focus:border-neon-purple">
                <SelectValue placeholder="Chọn phong cách" />
              </SelectTrigger>
              <SelectContent className="bg-oled-elevated border-gray-border">
                {RESPONSE_STYLES.map((s) => (
                  <SelectItem key={s.value} value={s.value} className="text-xs text-foreground focus:bg-muted">
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Scenario Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Bối cảnh hiện tại (Scenario)
              </Label>
              {defaultScenario !== undefined && scenario !== defaultScenario && (
                <button
                  onClick={() => onScenarioChange(defaultScenario)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] text-neon-purple/70 hover:text-neon-purple hover:bg-neon-purple/10 border border-transparent hover:border-neon-purple/30 transition-all duration-200"
                >
                  <RotateCcw size={10} />
                  Đặt lại
                </button>
              )}
            </div>
            <Textarea
              value={scenario}
              onChange={(e) => onScenarioChange(e.target.value)}
              placeholder="Mô tả bối cảnh câu chuyện..."
              className="bg-oled-elevated border-gray-border text-foreground text-xs min-h-[100px] resize-none focus:border-neon-purple focus:ring-neon-purple placeholder:text-muted-foreground/50"
            />
          </div>

          {/* First Message Editor — only visible for pending (new) chats */}
          {isPendingChat && onCustomFirstMesChange && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Tùy chỉnh lời chào
              </Label>
              <div className="flex items-center gap-2">
                <button className="px-2.5 py-1 text-[11px] rounded-lg bg-neon-blue/10 text-neon-blue border border-neon-blue/30 font-medium">
                  Nhập tay
                </button>
                <div className="relative">
                  <button
                    disabled
                    className="px-2.5 py-1 text-[11px] rounded-lg bg-oled-elevated text-muted-foreground/50 border border-gray-border cursor-not-allowed"
                  >
                    Tạo bằng AI
                  </button>
                  <span className="absolute -top-2 -right-2 text-[8px] px-1 py-0.5 rounded-full bg-neon-rose/20 text-neon-rose font-medium whitespace-nowrap leading-none">
                    Sắp ra mắt
                  </span>
                </div>
              </div>
              <textarea
                value={customFirstMes ?? ""}
                onChange={(e) => onCustomFirstMesChange(e.target.value)}
                className="w-full bg-oled-base border border-gray-border/30 focus:border-neon-blue text-foreground/90 rounded-lg p-3 text-base md:text-sm resize-none outline-none min-h-[120px] max-h-[300px] scrollbar-thin transition-colors duration-200 placeholder:text-muted-foreground/50"
                placeholder="Nhập lời chào mở đầu tùy chỉnh..."
              />
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground/50 leading-tight">
                  Chỉnh sửa trước khi bắt đầu chat
                </p>
                {customFirstMes !== defaultFirstMes && (
                  <button
                    onClick={() => onCustomFirstMesChange!(defaultFirstMes || "")}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] text-neon-blue/70 hover:text-neon-blue hover:bg-neon-blue/10 border border-transparent hover:border-neon-blue/30 transition-all duration-200 shrink-0"
                  >
                    <RotateCcw size={10} />
                    Đặt lại
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Model / Tier Switcher */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              {isByok ? "Model AI" : "Chất lượng AI"}
            </Label>
            {isByok ? (
              <ModelCombobox
                value={selectedModel}
                onValueChange={(val) => {
                  setSelectedModel(val);
                  setModel(val);
                }}
                userTier="all"
              />
            ) : (
              <TierSelector value={selectedTier} onValueChange={handleTierChange} userTier={userTier} />
            )}
          </div>

          {/* Max Tokens Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Độ dài tối đa (Max Tokens)
              </Label>
              <span className="text-xs font-mono text-neon-blue">{maxTokens}</span>
            </div>
            <Slider
              value={[maxTokens]}
              onValueChange={handleMaxTokensChange}
              min={100}
              max={4096}
              step={50}
              className="[&_[role=slider]]:border-neon-purple [&_[role=slider]]:bg-oled-elevated [&_.range]:bg-neon-purple"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>100</span>
              <span>4096</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenerationSettings;
