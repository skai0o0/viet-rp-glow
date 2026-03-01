import { useState, useRef, useEffect, useCallback } from "react";
import { Send, LogIn } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

const ChatInput = ({ onSend, disabled }: ChatInputProps) => {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      // Small delay to let the DOM settle (e.g. after streaming ends)
      const t = setTimeout(() => textareaRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [disabled]);

  const handleSend = () => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue("");
    // Re-focus immediately after sending
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
      <div
        className={`flex items-end gap-2 bg-oled-surface rounded-2xl px-4 py-2 border transition-all duration-300 ${
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
          className="flex-1 bg-transparent text-foreground text-base md:text-sm resize-none outline-none placeholder:text-muted-foreground py-1.5 scrollbar-thin"
          style={{ minHeight: "48px", maxHeight: "160px" }}
        />
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          className="p-2.5 rounded-xl text-neon-purple transition-all duration-200 hover:shadow-neon-purple hover:bg-neon-purple/10 disabled:opacity-30 disabled:hover:shadow-none flex-shrink-0 active:scale-90"
        >
          <Send size={20} />
        </motion.button>
      </div>
      <p className="text-[10px] text-muted-foreground text-center mt-2 hidden md:block">
        VietRP có thể tạo ra nội dung không chính xác. Hãy sử dụng có trách nhiệm.
      </p>
    </div>
  );
};

export default ChatInput;
