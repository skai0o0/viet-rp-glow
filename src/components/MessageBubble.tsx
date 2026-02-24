import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Copy, Check, GitBranch, Trash2, Edit2 } from "lucide-react";
import { ChatMessage } from "@/types/character";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import RoleplayMessage from "@/components/RoleplayMessage";

interface MessageBubbleProps {
  message: ChatMessage;
  characterAvatar?: string;
  characterName?: string;
  userName?: string;
  isStreaming?: boolean;
  isLastAssistant?: boolean;
  isLastUser?: boolean;
  onRegenerate?: () => void;
  onBranch?: () => void;
  onDelete?: () => void;
  onEdit?: (newContent: string) => void;
}

const MessageBubble = ({
  message,
  characterAvatar,
  characterName,
  userName,
  isStreaming,
  isLastAssistant,
  isLastUser,
  onRegenerate,
  onBranch,
  onDelete,
  onEdit,
}: MessageBubbleProps) => {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [editing]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    toast.success("Đã sao chép");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartEdit = () => {
    setEditContent(message.content);
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditContent(message.content);
  };

  const handleResend = () => {
    if (!editContent.trim()) return;
    setEditing(false);
    onEdit?.(editContent.trim());
  };

  const handleTextareaInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0, overflow: "hidden" }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`group flex gap-3 px-4 md:px-6 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {/* AI Avatar */}
      {!isUser && (
        <div className="flex-shrink-0 mt-1">
          {characterAvatar && characterAvatar.startsWith("http") ? (
            <img
              src={characterAvatar}
              alt={characterName || "AI"}
              className={`w-8 h-8 rounded-full object-cover border border-neon-purple/30 ${isStreaming ? "animate-breathing" : ""}`}
            />
          ) : (
            <div
              className={`w-8 h-8 rounded-full bg-oled-surface flex items-center justify-center text-neon-purple text-sm font-semibold border border-neon-purple/30 ${isStreaming ? "animate-breathing" : ""}`}
            >
              {characterAvatar || characterName?.charAt(0) || "AI"}
            </div>
          )}
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
          {editing ? (
            <div className="space-y-2">
              <textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onInput={handleTextareaInput}
                className="w-full bg-oled-elevated border border-neon-blue/50 rounded-lg px-3 py-2 text-base md:text-sm text-foreground resize-none focus:outline-none focus:border-neon-blue focus:shadow-[0_0_8px_rgba(0,170,255,0.3)] transition-all"
                rows={2}
              />
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={handleCancelEdit}
                  className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors rounded"
                >
                  Hủy
                </button>
                <button
                  onClick={handleResend}
                  className="px-3 py-1 text-xs bg-neon-blue text-white rounded hover:bg-neon-blue/80 transition-colors font-medium"
                >
                  Gửi lại
                </button>
              </div>
            </div>
          ) : (
            <>
              <span className="whitespace-pre-wrap"><RoleplayMessage text={message.content} charName={characterName} userName={userName} /></span>
              {isStreaming && !isUser && (
                <span className="text-neon-purple animate-blink font-mono ml-0.5">|</span>
              )}
            </>
          )}
        </div>

        {/* Actions row */}
        {!editing && (
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

                {/* Edit - only for last user message */}
                {isUser && isLastUser && onEdit && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleStartEdit}
                        className="p-1 rounded text-muted-foreground hover:text-neon-blue hover:drop-shadow-[0_0_4px_rgba(0,170,255,0.5)] transition-all"
                      >
                        <Edit2 size={12} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-oled-surface border-gray-border text-foreground">
                      Chỉnh sửa & gửi lại
                    </TooltipContent>
                  </Tooltip>
                )}

                {/* Delete */}
                {onDelete && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={onDelete}
                        className="p-1 rounded text-muted-foreground hover:text-neon-rose hover:drop-shadow-[0_0_4px_rgba(255,38,100,0.5)] transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-oled-surface border-gray-border text-foreground">
                      Xóa tin nhắn
                    </TooltipContent>
                  </Tooltip>
                )}

                {!isUser && isLastAssistant && onRegenerate && (
                  <button
                    onClick={onRegenerate}
                    className="p-1 rounded text-muted-foreground hover:text-neon-purple transition-colors"
                    title="Tạo lại"
                  >
                    <RotateCcw size={12} />
                  </button>
                )}

                {onBranch && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={onBranch}
                        className="p-1 rounded text-muted-foreground hover:text-neon-blue transition-colors"
                      >
                        <GitBranch size={12} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-oled-surface border-gray-border text-foreground">
                      Tạo nhánh trò chuyện từ đây
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default MessageBubble;
