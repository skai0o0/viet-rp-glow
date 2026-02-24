import { useState } from "react";
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

  const handleSend = () => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue("");
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
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="Nhập tin nhắn..."
          rows={1}
          disabled={disabled}
          className="flex-1 bg-transparent text-foreground text-base md:text-sm resize-none outline-none placeholder:text-muted-foreground py-1.5 max-h-32 scrollbar-thin"
          style={{ minHeight: "24px" }}
        />
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          className="p-2 rounded-xl text-neon-purple transition-all duration-200 hover:shadow-neon-purple hover:bg-neon-purple/10 disabled:opacity-30 disabled:hover:shadow-none flex-shrink-0"
        >
          <Send size={18} />
        </motion.button>
      </div>
      <p className="text-[10px] text-muted-foreground text-center mt-2">
        VietRP có thể tạo ra nội dung không chính xác. Hãy sử dụng có trách nhiệm.
      </p>
    </div>
  );
};

export default ChatInput;
