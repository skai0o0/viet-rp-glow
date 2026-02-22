import { useState } from "react";
import { motion } from "framer-motion";
import { RotateCcw, Trash2, Copy, Check } from "lucide-react";
import { ChatMessage } from "@/types/character";
import { toast } from "sonner";

interface MessageBubbleProps {
  message: ChatMessage;
  characterAvatar?: string;
  characterName?: string;
  isStreaming?: boolean;
  isLastAssistant?: boolean;
  onRegenerate?: () => void;
  onDelete?: (messageId: string) => void;
}

const MessageBubble = ({
  message,
  characterAvatar,
  characterName,
  isStreaming,
  isLastAssistant,
  onRegenerate,
  onDelete,
}: MessageBubbleProps) => {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    toast.success("Đã sao chép");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`group flex gap-3 px-4 md:px-6 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {/* AI Avatar */}
      {!isUser && (
        <div className="flex-shrink-0 mt-1">
          <div
            className={`w-8 h-8 rounded-full bg-oled-surface flex items-center justify-center text-neon-purple text-sm font-semibold border border-neon-purple/30 ${isStreaming ? "animate-breathing" : ""}`}
          >
            {characterAvatar || "AI"}
          </div>
        </div>
      )}

      <div className={`max-w-[80%] md:max-w-[70%] ${isUser ? "order-first" : ""}`}>
        {/* Name label */}
        {!isUser && characterName && (
          <span className="text-xs text-neon-purple/70 ml-1 mb-1 block font-medium">
            {characterName}
          </span>
        )}

        {/* Bubble */}
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed transition-all duration-300 ${
            isUser
              ? "bg-transparent border border-gray-border text-foreground hover:border-neon-blue hover:shadow-neon-blue"
              : "bg-oled-surface text-foreground/90"
          }`}
          style={
            !isUser
              ? {
                  background:
                    "linear-gradient(135deg, rgba(176, 38, 255, 0.05) 0%, #0A0A0A 100%)",
                }
              : undefined
          }
        >
          <span className="whitespace-pre-wrap">{message.content}</span>
          {isStreaming && !isUser && (
            <span className="text-neon-purple animate-blink font-mono ml-0.5">|</span>
          )}
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-1 mt-1 px-1">
          <span className="text-[10px] text-muted-foreground">
            {message.timestamp.toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>

          {!isStreaming && message.content && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
              <button
                onClick={handleCopy}
                className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                title="Sao chép"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>

              {!isUser && isLastAssistant && onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="p-1 rounded text-muted-foreground hover:text-neon-purple transition-colors"
                  title="Tạo lại"
                >
                  <RotateCcw size={12} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default MessageBubble;
