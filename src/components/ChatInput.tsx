import { useState } from "react";
import { Send } from "lucide-react";
import { motion } from "framer-motion";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

const ChatInput = ({ onSend, disabled }: ChatInputProps) => {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);

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

  return (
    <div className="p-3 md:p-4 bg-oled-base border-t border-gray-border">
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
          className="flex-1 bg-transparent text-foreground text-sm resize-none outline-none placeholder:text-muted-foreground py-1.5 max-h-32 scrollbar-thin"
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
