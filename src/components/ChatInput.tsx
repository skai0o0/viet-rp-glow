import { useState, useRef, useEffect, useCallback } from "react";
import { Send, LogIn, Quote } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

// ─── Command Definitions ─────────────────────────────────────
interface CommandDef {
  name: string;
  usage: string;
  description: string;
}

const COMMANDS: CommandDef[] = [
  { name: "/cmd", usage: "/cmd ", description: "Instruct AI 1 lượt (tôi → {{user}}, cô ấy → {{char}})" },
  { name: "/debug", usage: "/debug ", description: "Admin: đính kèm debug parse vào reply kế tiếp" },
  { name: "/addnpc", usage: "/addnpc Tên [- mô tả]", description: "Thêm NPC vào cuộc trò chuyện" },
  { name: "/removenpc", usage: "/removenpc Tên", description: "Xóa NPC khỏi cuộc trò chuyện" },
  { name: "/listnpc", usage: "/listnpc", description: "Xem danh sách NPC đang active" },
  { name: "/clearnpc", usage: "/clearnpc", description: "Xóa tất cả NPC" },
];

// ─── Command History ─────────────────────────────────────────
const CMD_HISTORY_KEY = "vietrp_cmd_history";
const CMD_HISTORY_MAX = 20;

function loadCmdHistory(): string[] {
  try {
    const raw = localStorage.getItem(CMD_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCmdToHistory(cmd: string) {
  const history = loadCmdHistory().filter((h) => h !== cmd);
  history.unshift(cmd);
  if (history.length > CMD_HISTORY_MAX) history.length = CMD_HISTORY_MAX;
  localStorage.setItem(CMD_HISTORY_KEY, JSON.stringify(history));
}

interface ChatInputProps {
  onSend: (message: string, prefillText?: string) => void;
  disabled?: boolean;
}

const ChatInput = ({ onSend, disabled }: ChatInputProps) => {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [prefillActive, setPrefillActive] = useState(false);
  const [prefillText, setPrefillText] = useState("");
  const { user } = useAuth();
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prefillInputRef = useRef<HTMLInputElement>(null);

  // Command popup state
  const [showCommands, setShowCommands] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const commandListRef = useRef<HTMLDivElement>(null);

  // Load history on mount
  useEffect(() => {
    setCmdHistory(loadCmdHistory());
  }, []);

  // Filtered history & commands based on current input
  const query = value.trim().toLowerCase();
  const filteredHistory = cmdHistory.filter((h) => {
    if (query.length <= 1) return true;
    return h.toLowerCase().startsWith(query);
  });
  const filteredCommands = COMMANDS.filter((cmd) => {
    if (query.length <= 1) return true;
    return cmd.name.toLowerCase().startsWith(query) || cmd.usage.toLowerCase().includes(query);
  });

  // Total items for navigation
  const totalItems = filteredHistory.length + filteredCommands.length;

  // Show/hide command popup & refresh history when user types /
  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed.startsWith("/") && !trimmed.includes(" ") && focused) {
      setCmdHistory(loadCmdHistory());
      setShowCommands(true);
      setSelectedIdx(0);
    } else {
      setShowCommands(false);
    }
  }, [value, focused]);

  // Scroll selected item into view
  useEffect(() => {
    if (!commandListRef.current) return;
    const selected = commandListRef.current.querySelector(`[data-cmd-idx="${selectedIdx}"]`);
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIdx]);

  // Auto-resize textarea height based on content
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  // Focus textarea on mount & after streaming finishes
  useEffect(() => {
    if (!disabled) {
      const t = setTimeout(() => textareaRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [disabled]);

  const handleSend = () => {
    if (!value.trim() || disabled) return;
    const prefill = prefillActive && prefillText.trim() ? prefillText.trim() : undefined;
    onSend(value.trim(), prefill);
    setValue("");
    setPrefillText("");
    setShowCommands(false);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  };

  const handleSelectItem = (idx: number) => {
    if (idx < filteredHistory.length) {
      // Selected a history entry — fill input with full text
      setValue(filteredHistory[idx]);
    } else {
      // Selected a command — autocomplete usage
      const cmd = filteredCommands[idx - filteredHistory.length];
      if (cmd) setValue(cmd.usage);
    }
    setShowCommands(false);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Command popup navigation
    if (showCommands && totalItems > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((prev) => (prev + 1) % totalItems);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((prev) => (prev - 1 + totalItems) % totalItems);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        handleSelectItem(selectedIdx);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowCommands(false);
        return;
      }
    }

    // Normal send
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!user) {
    return (
      <div className="p-3 md:p-4 bg-oled-base border-t border-gray-border" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate("/auth", { state: { from: "/chat" } })}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-neon-blue/10 border border-neon-blue/30 text-neon-blue font-medium text-sm shadow-[0_0_12px_rgba(0,240,255,0.15)] hover:shadow-[0_0_20px_rgba(0,240,255,0.3)] transition-all duration-300"
        >
          <LogIn size={18} />
          Vui lòng đăng nhập để bắt đầu trò chuyện
        </motion.button>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 bg-oled-base border-t border-gray-border" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
      {/* Command popup */}
      <AnimatePresence>
        {showCommands && totalItems > 0 && (
          <motion.div
            ref={commandListRef}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="mb-2 rounded-xl border border-gray-border bg-oled-elevated shadow-lg overflow-hidden max-h-56 overflow-y-auto scrollbar-thin"
          >
            {/* Recent history */}
            {filteredHistory.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-[10px] text-muted-foreground/40 uppercase tracking-wider">
                  Gần đây
                </div>
                {filteredHistory.map((entry, idx) => (
                  <button
                    key={"h-" + idx}
                    data-cmd-idx={idx}
                    onMouseDown={(e) => { e.preventDefault(); handleSelectItem(idx); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                      idx === selectedIdx
                        ? "bg-neon-purple/15 text-neon-purple"
                        : "text-foreground/80 hover:bg-oled-surface"
                    }`}
                  >
                    <span className="font-mono text-xs text-foreground/60 truncate">
                      {entry}
                    </span>
                  </button>
                ))}
              </>
            )}

            {/* Commands */}
            {filteredCommands.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-[10px] text-muted-foreground/40 uppercase tracking-wider border-t border-gray-border/20">
                  Lệnh
                </div>
                {filteredCommands.map((cmd, i) => {
                  const idx = filteredHistory.length + i;
                  return (
                    <button
                      key={cmd.name}
                      data-cmd-idx={idx}
                      onMouseDown={(e) => { e.preventDefault(); handleSelectItem(idx); }}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                        idx === selectedIdx
                          ? "bg-neon-purple/15 text-neon-purple"
                          : "text-foreground/80 hover:bg-oled-surface"
                      }`}
                    >
                      <span className="font-mono text-sm font-semibold text-neon-blue min-w-[90px]">
                        {cmd.name}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {cmd.description}
                      </span>
                      <span className="ml-auto text-[10px] text-muted-foreground/50 font-mono hidden sm:block">
                        {cmd.usage}
                      </span>
                    </button>
                  );
                })}
              </>
            )}

            {/* Hint bar */}
            <div className="flex items-center gap-3 px-3 py-1.5 border-t border-gray-border/30 bg-oled-surface/30">
              <span className="text-[10px] text-muted-foreground/50">
                <kbd className="px-1 py-0.5 rounded bg-oled-surface text-[9px] font-mono">↑↓</kbd> điều hướng
                <kbd className="px-1 py-0.5 rounded bg-oled-surface text-[9px] font-mono ml-2">Tab</kbd> chọn
                <kbd className="px-1 py-0.5 rounded bg-oled-surface text-[9px] font-mono ml-2">Esc</kbd> đóng
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prefill input bar */}
      {prefillActive && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-2"
        >
          <input
            ref={prefillInputRef}
            value={prefillText}
            onChange={(e) => setPrefillText(e.target.value)}
            placeholder="Nhập hành động mớm lời cho AI..."
            disabled={disabled}
            className="w-full bg-oled-elevated border border-neon-purple/30 rounded-xl px-3 py-1.5 text-base md:text-xs text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-neon-purple/60 transition-colors"
          />
        </motion.div>
      )}
      <div
        className={`flex items-center gap-2 bg-oled-surface rounded-2xl px-4 py-2 border transition-all duration-300 ${
          focused
            ? "border-neon-purple shadow-neon-purple"
            : "border-gray-border"
        }`}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="Nhập tin nhắn..."
          rows={1}
          disabled={disabled}
          enterKeyHint="send"
          className="flex-1 bg-transparent text-foreground text-base md:text-sm resize-none outline-none placeholder:text-muted-foreground py-1 scrollbar-thin"
          style={{ minHeight: "40px", maxHeight: "160px" }}
        />
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          className="p-2.5 rounded-xl text-neon-purple transition-all duration-200 hover:shadow-neon-purple hover:bg-neon-purple/10 disabled:opacity-30 disabled:hover:shadow-none flex-shrink-0 active:scale-90 flex items-center justify-center"
        >
          <Send size={20} />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setPrefillActive(!prefillActive);
            if (!prefillActive) {
              setTimeout(() => prefillInputRef.current?.focus(), 100);
            }
          }}
          disabled={disabled}
          className={`p-2 rounded-lg transition-all duration-200 flex-shrink-0 flex items-center gap-0.5 ${
            prefillActive
              ? "text-neon-purple bg-neon-purple/15 shadow-[0_0_8px_rgba(176,38,255,0.2)]"
              : "text-muted-foreground hover:text-neon-purple/60 hover:bg-neon-purple/5"
          }`}
          aria-label="Mớm lời cho AI (Prefill)"
        >
          <Quote size={16} />
          <span className="text-[10px] hidden sm:block">Mớm lời</span>
        </motion.button>
      </div>
      <p className="text-[10px] text-muted-foreground text-center mt-2 hidden md:block">
        VietRP có thể tạo ra nội dung không chính xác. Hãy sử dụng có trách nhiệm.
      </p>
    </div>
  );
};

export default ChatInput;

export { saveCmdToHistory };
