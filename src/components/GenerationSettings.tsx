import { useState, useEffect } from "react";
import { Settings2, X } from "lucide-react";
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
import ModelCombobox from "@/components/ModelCombobox";
import { getModel, setModel } from "@/services/openRouter";
import { ScrollArea } from "@/components/ui/scroll-area";

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
}

const GenerationSettings = ({ scenario, onScenarioChange, onClose }: GenerationSettingsProps) => {
  const [selectedModel, setSelectedModel] = useState(getModel());
  const [maxTokens, setMaxTokensState] = useState(getMaxTokens());
  const [responseStyle, setResponseStyleState] = useState(getResponseStyle());

  const handleModelChange = (val: string) => {
    setSelectedModel(val);
    setModel(val);
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
    <div className="h-full flex flex-col bg-oled-surface">
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

      <ScrollArea className="flex-1">
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
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Bối cảnh hiện tại (Scenario)
            </Label>
            <Textarea
              value={scenario}
              onChange={(e) => onScenarioChange(e.target.value)}
              placeholder="Mô tả bối cảnh câu chuyện..."
              className="bg-oled-elevated border-gray-border text-foreground text-xs min-h-[100px] resize-none focus:border-neon-purple focus:ring-neon-purple placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Model Switcher */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Mô hình AI (Model)
            </Label>
            <ModelCombobox value={selectedModel} onValueChange={handleModelChange} />
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
      </ScrollArea>
    </div>
  );
};

export default GenerationSettings;
