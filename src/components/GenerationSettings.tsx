import { useState } from "react";
import { Settings2, X, RotateCcw, Brain, Sparkles, Zap, Loader2, ChevronDown, ChevronRight } from "lucide-react";
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
import {
  getSelectedTier, setSelectedTier, getModel, setModel,
  getActiveProvider, setActiveProvider, type Provider,
} from "@/services/openRouter";
import { getCachedSamplingParameters, DEFAULT_MAX_TOKENS, getCachedResponseStyles } from "@/services/globalSettingsDb";

const STORAGE_KEY_MAX_TOKENS = "vietrp_max_tokens";
const STORAGE_KEY_RESPONSE_STYLE = "vietrp_response_style";

export function getMaxTokens(): number {
  const stored = localStorage.getItem(STORAGE_KEY_MAX_TOKENS);
  if (stored) return parseInt(stored, 10);
  return getCachedSamplingParameters().max_tokens ?? DEFAULT_MAX_TOKENS;
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
  return getCachedResponseStyles().find((s) => s.value === style)?.prompt || "";
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
  /** Rolling summary of current session (from chat memory system) */
  summary?: string;
  /** Key facts extracted from current session */
  facts?: string[];
  /** Whether the current user can view memory (admin/op) */
  canViewMemory?: boolean;
  /** Manual force-summarize trigger (admin/op/mod BYOK) */
  onForceSummarize?: () => Promise<void>;
  /** Whether a summarize operation is in progress */
  isSummarizing?: boolean;
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
  summary,
  facts,
  canViewMemory,
  onForceSummarize,
  isSummarizing,
}: GenerationSettingsProps) => {
  const hasMemory = !!summary || (facts && facts.length > 0);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [forceSummarizeOpen, setForceSummarizeOpen] = useState(false);
  const [selectedTier, setSelectedTierState] = useState(getSelectedTier());
  const [selectedModel, setSelectedModel] = useState(getModel());
  const [maxTokens, setMaxTokensState] = useState(getMaxTokens());
  const [responseStyle, setResponseStyleState] = useState(getResponseStyle());
  const [activeProvider, setActiveProviderState] = useState<Provider>(getActiveProvider());

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
                {getCachedResponseStyles().map((s) => (
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

          {/* Provider Selector — only for BYOK users */}
          {isByok && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                API Provider
              </Label>
              <div className="flex gap-1.5">
                {([
                  { id: "openrouter" as Provider, label: "OpenRouter" },
                  { id: "mimo" as Provider, label: "Xiaomi Mimo" },
                ]).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActiveProviderState(p.id);
                      setActiveProvider(p.id);
                    }}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border ${
                      activeProvider === p.id
                        ? p.id === "mimo"
                          ? "bg-neon-rose/15 border-neon-rose/40 text-neon-rose"
                          : "bg-neon-purple/15 border-neon-purple/40 text-neon-purple"
                        : "bg-oled-elevated border-gray-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
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
                provider={activeProvider}
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

          {/* Chat Memory (admin/op/mod BYOK only) */}
          {canViewMemory && (
            <div className="border-t border-gray-border pt-4 space-y-2">
              {/* Toggle: Rolling Summary */}
              <button
                onClick={() => setMemoryOpen(!memoryOpen)}
                className="w-full flex items-center gap-1.5 px-1 py-1 rounded-md text-left hover:bg-oled-elevated transition-colors"
              >
                {memoryOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <Sparkles size={12} className="text-emerald-400" />
                <Label className="text-xs text-emerald-400 uppercase tracking-wider font-semibold cursor-pointer flex-1">
                  Rolling Summary
                </Label>
                {summary && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
              </button>

              {memoryOpen && (
                <div className="pl-5">
                  {!summary && (
                    <p className="text-[11px] text-muted-foreground/60 italic">
                      Chưa có summary cho session này.
                    </p>
                  )}
                  {summary && (
                    <div className="text-[11px] text-foreground/70 leading-relaxed bg-oled-base rounded-lg p-2.5 border border-emerald-400/10 whitespace-pre-wrap">
                      {summary}
                    </div>
                  )}
                </div>
              )}

              {/* Toggle: Key Facts */}
              <button
                onClick={() => setForceSummarizeOpen(!forceSummarizeOpen)}
                className="w-full flex items-center gap-1.5 px-1 py-1 rounded-md text-left hover:bg-oled-elevated transition-colors"
              >
                {forceSummarizeOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <Brain size={12} className="text-teal-400" />
                <Label className="text-xs text-teal-400 uppercase tracking-wider font-semibold cursor-pointer flex-1">
                  Key Facts
                </Label>
                {facts && facts.length > 0 && (
                  <span className="text-[10px] text-teal-400/60">{facts.length}</span>
                )}
              </button>

              {forceSummarizeOpen && (
                <div className="pl-5">
                  {(!facts || facts.length === 0) && (
                    <p className="text-[11px] text-muted-foreground/60 italic">
                      Chưa có key facts cho session này.
                    </p>
                  )}
                  {facts && facts.length > 0 && (
                    <ul className="space-y-1">
                      {facts.map((fact, i) => (
                        <li key={i} className="text-[11px] text-foreground/70 flex items-start gap-1.5">
                          <span className="text-teal-400/60 mt-0.5">-</span>
                          <span>{fact}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Force Summarize Button — always visible */}
              {onForceSummarize && (
                <button
                  onClick={onForceSummarize}
                  disabled={isSummarizing}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium transition-all duration-200 border disabled:opacity-50 disabled:cursor-not-allowed bg-yellow-400/5 text-yellow-400 border-yellow-400/20 hover:bg-yellow-400/10 hover:border-yellow-400/40"
                >
                  {isSummarizing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                  <span>{isSummarizing ? "Đang tóm tắt..." : "Ép tóm tắt ngữ cảnh"}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GenerationSettings;
