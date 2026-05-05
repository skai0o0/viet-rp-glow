import { useState } from "react";
import { MessageSquare, Plus, X, Trash2, MoreVertical, Brain, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DbChatSession } from "@/services/chatDb";
import { CharacterSummary } from "@/services/characterDb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ChatSidebarProps {
  open: boolean;
  onClose: () => void;
  sessions: DbChatSession[];
  characters: Map<string, CharacterSummary>;
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => void;
  characterName?: string;
  /** Rolling summary of current session (from chat memory system) */
  summary?: string;
  /** Key facts extracted from current session */
  facts?: string[];
  /** Whether the current user can view memory (admin/op) */
  canViewMemory?: boolean;
}

const ChatSidebar = ({
  open,
  onClose,
  sessions,
  characters,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  characterName,
  summary,
  facts,
  canViewMemory,
}: ChatSidebarProps) => {
  const [memoryOpen, setMemoryOpen] = useState(false);
  const hasMemory = !!summary || (facts && facts.length > 0);

  return (
    <>
      {/* Overlay for mobile */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ x: "-100%", opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
            className="fixed md:relative z-50 w-[280px] h-full bg-oled-surface border-r border-gray-border flex flex-col"
          >
            {/* Sidebar header */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-gray-border flex-shrink-0">
              <h1 className="text-sm font-bold">
                <span className="text-neon-blue neon-text-blue">Viet</span>
                <span className="text-neon-purple neon-text-purple">RP</span>
              </h1>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-oled-elevated transition-colors md:hidden"
              >
                <X size={18} />
              </button>
            </div>

            {/* New chat button */}
            <div className="p-3">
              <button
                onClick={() => {
                  onNewChat();
                  onClose();
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-border text-sm text-muted-foreground hover:text-foreground hover:border-neon-purple/50 hover:shadow-neon-purple transition-all duration-300"
              >
                <Plus size={16} />
                <span>Cuộc trò chuyện mới</span>
              </button>
            </div>

            {/* Session list */}
            <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-3">
              {characterName && (
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-2 mb-2">
                  Chat với {characterName}
                </p>
              )}
              {!characterName && (
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-2 mb-2">
                  Lịch sử trò chuyện
                </p>
              )}

              {sessions.length === 0 && (
                <div className="px-3 py-8 text-center">
                  <MessageSquare size={24} className="mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">Chưa có cuộc trò chuyện nào</p>
                </div>
              )}

              {sessions.map((session) => {
                const char = characters.get(session.character_id);
                const initial = char?.name?.charAt(0)?.toUpperCase() || "?";
                const isActive = activeSessionId === session.id;
                const displayTitle = session.title || char?.name || "Cuộc trò chuyện";
                const timeStr = new Date(session.updated_at).toLocaleDateString("vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                });

                return (
                  <div
                    key={session.id}
                    className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 mb-1 cursor-pointer ${
                      isActive
                        ? "bg-oled-elevated border border-neon-purple/20"
                        : "hover:bg-oled-elevated border border-transparent"
                    }`}
                    onClick={() => {
                      onSelectSession(session.id);
                      onClose();
                    }}
                  >
                    {char?.avatar_url && char.avatar_url.startsWith("http") ? (
                      <img
                        src={char.avatar_url}
                        alt={char.name}
                        className={`w-9 h-9 rounded-full object-cover flex-shrink-0 ${
                          isActive ? "border border-neon-purple/30" : ""
                        }`}
                      />
                    ) : (
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
                          isActive
                            ? "bg-neon-purple/20 text-neon-purple border border-neon-purple/30"
                            : "bg-oled-elevated text-muted-foreground"
                        }`}
                      >
                        {initial}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {displayTitle}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {char?.name} · {timeStr}
                      </p>
                    </div>

                    {/* Actions dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity"
                        >
                          <MoreVertical size={14} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="bg-oled-surface border-gray-border"
                      >
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSession(session.id);
                          }}
                          className="text-red-400 focus:text-red-400 focus:bg-red-400/10"
                        >
                          <Trash2 size={14} className="mr-2" />
                          Xoá cuộc trò chuyện
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>

            {/* Memory section (admin/op only) */}
            {canViewMemory && activeSessionId && (
              <div className="border-t border-gray-border">
                <button
                  onClick={() => setMemoryOpen(!memoryOpen)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Brain size={14} className="text-emerald-400" />
                  <span className="font-medium flex-1 text-left">Chat Memory</span>
                  {hasMemory && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  )}
                  {memoryOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>

                <AnimatePresence>
                  {memoryOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-3 space-y-3 max-h-[40vh] overflow-y-auto scrollbar-thin">
                        {!hasMemory && (
                          <p className="text-[11px] text-muted-foreground/60 italic">
                            Chưa có dữ liệu memory cho session này.
                          </p>
                        )}

                        {/* Rolling Summary */}
                        {summary && (
                          <div>
                            <div className="flex items-center gap-1.5 mb-1">
                              <Sparkles size={10} className="text-emerald-400" />
                              <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                                Rolling Summary
                              </span>
                            </div>
                            <div className="text-[11px] text-foreground/70 leading-relaxed bg-oled-base rounded-lg p-2.5 border border-emerald-400/10 whitespace-pre-wrap">
                              {summary}
                            </div>
                          </div>
                        )}

                        {/* Key Facts */}
                        {facts && facts.length > 0 && (
                          <div>
                            <div className="flex items-center gap-1.5 mb-1">
                              <Brain size={10} className="text-teal-400" />
                              <span className="text-[10px] font-semibold text-teal-400 uppercase tracking-wider">
                                Key Facts ({facts.length})
                              </span>
                            </div>
                            <ul className="space-y-1">
                              {facts.map((fact, i) => (
                                <li key={i} className="text-[11px] text-foreground/70 flex items-start gap-1.5">
                                  <span className="text-teal-400/60 mt-0.5">-</span>
                                  <span>{fact}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Footer */}
            <div className="p-3 border-t border-gray-border">
              <p className="text-[10px] text-muted-foreground text-center">
                VietRP v0.1 · Cyberpunk Edition
              </p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChatSidebar;
