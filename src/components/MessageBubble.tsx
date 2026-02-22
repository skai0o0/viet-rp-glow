import { motion } from "framer-motion";
import { ChatMessage } from "@/types/character";

interface MessageBubbleProps {
  message: ChatMessage;
  characterAvatar?: string;
  characterName?: string;
}

const MessageBubble = ({ message, characterAvatar, characterName }: MessageBubbleProps) => {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`flex gap-3 px-4 md:px-6 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {/* AI Avatar */}
      {!isUser && (
        <div className="flex-shrink-0 mt-1">
          <div className="w-8 h-8 rounded-full bg-oled-surface flex items-center justify-center text-neon-purple text-sm font-semibold border border-neon-purple/30 animate-breathing">
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
          {message.content}
        </div>

        {/* Timestamp */}
        <span className="text-[10px] text-muted-foreground mt-1 px-1 block">
          {message.timestamp.toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </motion.div>
  );
};

export default MessageBubble;
