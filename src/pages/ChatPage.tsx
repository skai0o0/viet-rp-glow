import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getCachedUserPersona } from "@/services/profileDb";
import { Menu, Settings2, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { ChatMessage, CharacterCard } from "@/types/character";
import { buildMessages, replaceMacros } from "@/utils/promptBuilder";
import { streamChat, getApiKey } from "@/services/openRouter";
import { getCharacterById, dbCharToCard, CharacterSummary } from "@/services/characterDb";
import {
  getUserSessions,
  createSession,
  deleteSession,
  getSessionMessages,
  addMessage,
  deleteLastAssistantMessage,
  deleteMessage,
  updateMessage,
  branchChatSession,
  DbChatSession,
} from "@/services/chatDb";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ChatHeader from "@/components/ChatHeader";
import ChatSidebar from "@/components/ChatSidebar";
import ChatInput from "@/components/ChatInput";
import MessageBubble from "@/components/MessageBubble";
import TypingIndicator from "@/components/TypingIndicator";
import GenerationSettings from "@/components/GenerationSettings";
import CharacterPreviewDialog from "@/components/CharacterPreviewDialog";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

const ChatPage = () => {
  const { characterId } = useParams<{ characterId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeCharacter, setActiveCharacter] = useState<CharacterCard | null>(null);
  const [activeCharId, setActiveCharId] = useState<string | null>(characterId || null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessions, setSessions] = useState<DbChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [charMap, setCharMap] = useState<Map<string, CharacterSummary>>(new Map());
  const [scenarioOverride, setScenarioOverride] = useState("");
  const [previewChar, setPreviewChar] = useState<CharacterSummary | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const charSessions = useMemo(
    () => (activeCharId ? sessions.filter((s) => s.character_id === activeCharId) : []),
    [sessions, activeCharId]
  );

  // Listen for admin markdown export event
  useEffect(() => {
    const handleExportMarkdown = () => {
      if (!activeCharacter || messages.length === 0) {
        toast.error("Không có tin nhắn để xuất");
        return;
      }
      const persona = getCachedUserPersona();
      const userName = persona.displayName || "User";
      const charName = activeCharacter.name;
      
      const lines: string[] = [];
      lines.push(`# ${charName}`);
      lines.push(`> ${activeCharacter.description || ""}`);
      lines.push("");
      lines.push(`**Scenario:** ${activeCharacter.scenario || "N/A"}`);
      lines.push("");
      lines.push("---");
      lines.push("");
      
      for (const msg of messages) {
        const name = msg.role === "user" ? userName : charName;
        lines.push(`**${name}:**`);
        lines.push(msg.content);
        lines.push("");
      }
      
      const md = lines.join("\n");
      navigator.clipboard.writeText(md).then(() => {
        toast.success("Đã copy markdown vào clipboard");
      }).catch(() => {
        toast.error("Không thể copy vào clipboard");
      });
    };

    window.addEventListener("export-chat-markdown", handleExportMarkdown);
    return () => window.removeEventListener("export-chat-markdown", handleExportMarkdown);
  }, [activeCharacter, messages]);

  // Sync scenario when character loads
  useEffect(() => {
    if (activeCharacter) {
      setScenarioOverride(activeCharacter.scenario || "");
    }
  }, [activeCharacter]);

  // Load character from URL param
  useEffect(() => {
    if (!characterId) return;
    setActiveCharId(characterId);
    getCharacterById(characterId)
      .then((dbChar) => {
        const card = dbCharToCard(dbChar);
        setActiveCharacter(card);
        setCharMap((prev) => {
          const next = new Map(prev);
          next.set(characterId, {
            id: dbChar.id,
            name: dbChar.name,
            avatar_url: dbChar.avatar_url,
            short_summary: dbChar.short_summary,
            tags: dbChar.tags,
            description: dbChar.description,
          });
          return next;
        });
      })
      .catch(() => toast.error("Không thể tải nhân vật này"));
  }, [characterId]);

  // Load sessions when user changes
  useEffect(() => {
    if (!user) return;
    getUserSessions()
      .then(setSessions)
      .catch(() => setSessions([]));
  }, [user]);

  // Populate charMap for all sessions' characters
  useEffect(() => {
    if (sessions.length === 0) return;
    const unknownIds = [...new Set(sessions.map((s) => s.character_id))].filter((id) => !charMap.has(id));
    if (unknownIds.length === 0) return;
    Promise.all(unknownIds.map((id) => getCharacterById(id).catch(() => null))).then((chars) => {
      setCharMap((prev) => {
        const next = new Map(prev);
        chars.forEach((c) => {
          if (c) next.set(c.id, { id: c.id, name: c.name, avatar_url: c.avatar_url, short_summary: c.short_summary, tags: c.tags, description: c.description });
        });
        return next;
      });
    });
  }, [sessions]);

  // Auto-load existing session or show first_mes locally (no DB creation yet)
  useEffect(() => {
    if (!user || !activeCharId || !activeCharacter) return;
    if (activeSessionId) return;

    const existing = sessions.filter((s) => s.character_id === activeCharId);
    if (existing.length > 0) {
      loadSession(existing[0].id);
    } else {
      // Show first message locally without creating a DB session
      setMessages([
        {
          id: "pending-first-mes",
          role: "assistant",
          content: activeCharacter.first_mes,
          timestamp: new Date(),
        },
      ]);
    }
  }, [user, activeCharId, activeCharacter, sessions.length]);

  const loadSession = async (sessionId: string) => {
    try {
      const msgs = await getSessionMessages(sessionId);
      setActiveSessionId(sessionId);
      setMessages(
        msgs.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          timestamp: new Date(m.created_at),
        }))
      );
    } catch {
      toast.error("Không thể tải tin nhắn");
    }
  };

  const handleNewChat = async () => {
    if (!user || !activeCharId || !activeCharacter) return;
    abortRef.current?.abort();
    setIsStreaming(false);
    setActiveSessionId(null);

    // Show first message locally without creating a DB session
    setMessages([
      {
        id: "pending-first-mes",
        role: "assistant",
        content: activeCharacter.first_mes,
        timestamp: new Date(),
      },
    ]);
  };

  // Helper: ensure a session exists in DB, creating one if needed (on first user message)
  const ensureSession = async (): Promise<string> => {
    if (activeSessionId) return activeSessionId;
    if (!user || !activeCharId || !activeCharacter) throw new Error("Missing data");

    const session = await createSession(user.id, activeCharId, activeCharacter.name);
    await addMessage(session.id, "assistant", activeCharacter.first_mes);
    setActiveSessionId(session.id);
    setSessions((prev) => [session, ...prev]);
    setMessages((prev) =>
      prev.map((m) => (m.id === "pending-first-mes" ? { ...m, id: session.id + "-first" } : m))
    );
    return session.id;
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([]);
        const remaining = sessions.filter((s) => s.id !== sessionId);
        if (remaining.length > 0) {
          loadSession(remaining[0].id);
        }
      }
      toast.success("Đã xoá cuộc trò chuyện");
    } catch {
      toast.error("Không thể xoá cuộc trò chuyện");
    }
  };

  const handleBranch = useCallback(
    async (messageIndex: number) => {
      if (!user || !activeCharId || !activeSessionId) return;
      const toastId = toast.loading("Đang tạo nhánh mới...");
      try {
        const branchNum = charSessions.length + 1;
        const branchTitle = `Nhánh ${branchNum} — ${new Date().toLocaleDateString("vi-VN", {
          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
        })}`;
        const msgSnapshot = messages.map((m) => ({ role: m.role, content: m.content }));
        const newSession = await branchChatSession(
          activeSessionId, user.id, activeCharId, msgSnapshot, messageIndex, branchTitle
        );
        setSessions((prev) => [newSession, ...prev]);
        await loadSession(newSession.id);
        toast.success("Đã tạo nhánh mới!", { id: toastId });
      } catch {
        toast.error("Không thể tạo nhánh", { id: toastId });
      }
    },
    [user, activeCharId, activeSessionId, messages, charSessions.length]
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const handleSend = useCallback(
    async (content: string) => {
      if (!getApiKey()) {
        toast.error("Vui lòng nhập API Key của OpenRouter trong phần Cài Đặt.", {
          action: { label: "Đi tới Cài Đặt", onClick: () => navigate("/settings") },
        });
        return;
      }
      if (!activeCharacter) return;

      // Ensure session exists in DB (creates on first user message)
      let sessionId: string;
      try {
        sessionId = await ensureSession();
      } catch {
        toast.error("Không thể tạo cuộc trò chuyện");
        return;
      }

      const savedUserMsg = await addMessage(sessionId, "user", content);
      const userMsg: ChatMessage = {
        id: savedUserMsg.id, role: "user", content, timestamp: new Date(savedUserMsg.created_at),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);

      const assistantId = "streaming-" + Date.now();
      let assistantContent = "";

      const allMessages = [...messages, userMsg];
      const apiMessages = buildMessages(
        activeCharacter,
        allMessages.map((m) => ({ role: m.role, content: m.content })),
        undefined,
        scenarioOverride
      );

      const controller = new AbortController();
      abortRef.current = controller;

      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", timestamp: new Date() },
      ]);

      streamChat(
        apiMessages,
        {
          onDelta: (text) => {
            assistantContent += text;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: assistantContent } : m))
            );
          },
          onDone: async () => {
            setIsStreaming(false);
            abortRef.current = null;
            if (assistantContent) {
              const saved = await addMessage(sessionId, "assistant", assistantContent);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, id: saved.id, timestamp: new Date(saved.created_at) } : m
                )
              );
            } else {
              // Remove empty assistant message if stream produced no content
              setMessages((prev) => prev.filter((m) => m.id !== assistantId));
            }
          },
          onError: (error) => {
            setIsStreaming(false);
            abortRef.current = null;
            if (!assistantContent) {
              setMessages((prev) => prev.filter((m) => m.id !== assistantId));
            }
            toast.error(error);
          },
        },
        controller.signal
      );
    },
    [messages, activeCharacter, activeSessionId, activeCharId, user, navigate, scenarioOverride]
  );

  const handleRegenerate = useCallback(async () => {
    if (!activeSessionId || !activeCharacter || isStreaming) return;
    await deleteLastAssistantMessage(activeSessionId);
    const withoutLast = messages.slice(0, -1);
    setMessages(withoutLast);
    setIsStreaming(true);

    const assistantId = "streaming-" + Date.now();
    let assistantContent = "";

    const apiMessages = buildMessages(
      activeCharacter,
      withoutLast.map((m) => ({ role: m.role, content: m.content })),
      undefined,
      scenarioOverride
    );

    const controller = new AbortController();
    abortRef.current = controller;

    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", timestamp: new Date() },
    ]);

    streamChat(
      apiMessages,
      {
        onDelta: (text) => {
          assistantContent += text;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: assistantContent } : m))
          );
        },
        onDone: async () => {
          setIsStreaming(false);
          abortRef.current = null;
          if (assistantContent) {
            const saved = await addMessage(activeSessionId, "assistant", assistantContent);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, id: saved.id, timestamp: new Date(saved.created_at) } : m
              )
            );
          }
        },
        onError: (error) => {
          setIsStreaming(false);
          abortRef.current = null;
          if (!assistantContent) {
            setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          }
          toast.error(error);
        },
      },
      controller.signal
    );
  }, [messages, activeCharacter, activeSessionId, isStreaming, scenarioOverride]);

  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return i;
    }
    return -1;
  })();

  const lastUserIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") return i;
    }
    return -1;
  })();

  const handleDeleteMessage = useCallback(
    async (msgId: string) => {
      try {
        await deleteMessage(msgId);
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
        toast.success("Đã xóa tin nhắn");
      } catch {
        toast.error("Không thể xóa tin nhắn");
      }
    },
    []
  );

  const handleEditAndResend = useCallback(
    async (msgIndex: number, newContent: string) => {
      if (!activeSessionId || !activeCharacter || isStreaming) return;
      const msg = messages[msgIndex];

      // Update the user message in DB
      await updateMessage(msg.id, newContent);

      // Delete the following assistant message if it exists
      const nextMsg = messages[msgIndex + 1];
      if (nextMsg && nextMsg.role === "assistant") {
        await deleteMessage(nextMsg.id);
      }

      // Update state: replace user msg content, remove following assistant msg
      const updatedMessages = messages.map((m, i) =>
        i === msgIndex ? { ...m, content: newContent } : m
      ).filter((_, i) => !(i === msgIndex + 1 && nextMsg?.role === "assistant"));

      setMessages(updatedMessages);

      // Now regenerate
      setIsStreaming(true);
      const assistantId = "streaming-" + Date.now();
      let assistantContent = "";

      const apiMessages = buildMessages(
        activeCharacter,
        updatedMessages.map((m) => ({ role: m.role, content: m.content })),
        undefined,
        scenarioOverride
      );

      const controller = new AbortController();
      abortRef.current = controller;

      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", timestamp: new Date() },
      ]);

      streamChat(
        apiMessages,
        {
          onDelta: (text) => {
            assistantContent += text;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: assistantContent } : m))
            );
          },
          onDone: async () => {
            setIsStreaming(false);
            abortRef.current = null;
            if (assistantContent) {
              const saved = await addMessage(activeSessionId, "assistant", assistantContent);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, id: saved.id, timestamp: new Date(saved.created_at) } : m
                )
              );
            }
          },
          onError: (error) => {
            setIsStreaming(false);
            abortRef.current = null;
            if (!assistantContent) {
              setMessages((prev) => prev.filter((m) => m.id !== assistantId));
            }
            toast.error(error);
          },
        },
        controller.signal
      );
    },
    [messages, activeCharacter, activeSessionId, isStreaming, scenarioOverride]
  );

  const handleSelectSession = useCallback(
    (id: string) => {
      const session = sessions.find((s) => s.id === id);
      if (!session) return;
      if (session.character_id !== activeCharId) {
        setActiveCharId(session.character_id);
        getCharacterById(session.character_id).then((dbChar) => {
          setActiveCharacter(dbCharToCard(dbChar));
          setCharMap((prev) => {
            const next = new Map(prev);
            next.set(dbChar.id, {
              id: dbChar.id, name: dbChar.name, avatar_url: dbChar.avatar_url,
              short_summary: dbChar.short_summary, tags: dbChar.tags, description: dbChar.description,
            });
            return next;
          });
          loadSession(id);
        });
      } else {
        loadSession(id);
      }
    },
    [sessions, activeCharId]
  );

  // Settings sidebar content
  const settingsContent = activeCharacter ? (
    <GenerationSettings
      scenario={scenarioOverride}
      onScenarioChange={setScenarioOverride}
      onClose={isMobile ? () => setSettingsOpen(false) : undefined}
    />
  ) : null;

  // No character selected — show all sessions list
  if (!activeCharacter) {
    return (
      <div className="flex-1 flex overflow-hidden">
        <ChatSidebar
          open={sidebarOpen} onClose={() => setSidebarOpen(false)}
          sessions={sessions} characters={charMap} activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession} onNewChat={() => {}} onDeleteSession={handleDeleteSession}
        />
        <div className="flex-1 flex flex-col">
          <div className="h-14 flex items-center px-4 md:px-6 border-b border-gray-border flex-shrink-0">
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 mr-2 text-muted-foreground hover:text-foreground transition-colors md:hidden">
              <Menu size={20} />
            </button>
            <h1 className="text-sm font-bold">
              <span className="text-neon-blue neon-text-blue">Cuộc trò chuyện</span>
            </h1>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-4 md:p-6">
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                <MessageSquareIcon />
                <p className="text-lg font-medium">Chưa có cuộc trò chuyện nào</p>
                <Button variant="outline"
                  className="border-gray-border text-muted-foreground hover:border-neon-purple hover:text-neon-purple"
                  onClick={() => navigate("/")}>
                  Khám phá nhân vật
                </Button>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto space-y-2">
                {sessions.map((session) => {
                  const char = charMap.get(session.character_id);
                  const initial = char?.name?.charAt(0)?.toUpperCase() || "?";
                  const displayTitle = session.title || char?.name || "Cuộc trò chuyện";
                  const timeStr = new Date(session.updated_at).toLocaleDateString("vi-VN", {
                    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                  });

                  return (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-border bg-oled-surface hover:bg-oled-elevated hover:border-neon-purple/30 transition-all duration-200 cursor-pointer active:scale-[0.98]"
                      onClick={() => {
                        handleSelectSession(session.id);
                        if (!characterId) {
                          navigate(`/chat/${session.character_id}`);
                        }
                      }}
                    >
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold bg-oled-elevated text-neon-purple border border-neon-purple/20 flex-shrink-0">
                        {initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{displayTitle}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {char?.name || "..."} · {timeStr}
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                        className="p-1.5 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="flex-1 flex overflow-hidden">
      <ChatSidebar
        open={sidebarOpen} onClose={() => setSidebarOpen(false)}
        sessions={sessions} characters={charMap} activeSessionId={activeSessionId}
        onSelectSession={(id) => { handleSelectSession(id); setSidebarOpen(false); }}
        onNewChat={handleNewChat} onDeleteSession={handleDeleteSession}
        characterName={activeCharacter.name}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex items-center bg-oled-base border-b border-gray-border">
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-4 text-muted-foreground hover:text-foreground transition-colors">
            <Menu size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <ChatHeader character={activeCharacter} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
              onNewChat={handleNewChat} sessions={charSessions} activeSessionId={activeSessionId}
              onSelectSession={handleSelectSession}
              onNameClick={() => {
                if (activeCharId) {
                  const summary = charMap.get(activeCharId);
                  if (summary) setPreviewChar(summary);
                }
              }} />
          </div>
          {/* Settings toggle button */}
          <button onClick={() => setSettingsOpen(!settingsOpen)}
            className={`p-4 transition-colors ${settingsOpen ? "text-neon-purple" : "text-muted-foreground hover:text-foreground"}`}>
            <Settings2 size={20} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Chat messages area */}
          <div className="flex-1 flex flex-col min-w-0">
            <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin py-4 space-y-4">
              {activeCharacter.scenario && !scenarioOverride && (
                <div className="mx-4 md:mx-6 p-3 rounded-xl bg-oled-surface border border-gray-border">
                  <p className="text-[11px] text-muted-foreground">
                    <span className="text-neon-purple font-medium">Kịch bản:</span>{" "}
                    {replaceMacros(activeCharacter.scenario, activeCharacter.name, getCachedUserPersona().displayName)}
                  </p>
                </div>
              )}
              {scenarioOverride && (
                <div className="mx-4 md:mx-6 p-3 rounded-xl bg-oled-surface border border-gray-border">
                  <p className="text-[11px] text-muted-foreground">
                    <span className="text-neon-purple font-medium">Kịch bản:</span>{" "}
                    {replaceMacros(scenarioOverride, activeCharacter.name, getCachedUserPersona().displayName)}
                  </p>
                </div>
              )}

              <AnimatePresence>
                {messages.map((msg, idx) => (
                  <MessageBubble key={msg.id} message={msg}
                    characterAvatar={activeCharacter.avatar} characterName={activeCharacter.name}
                    userName={getCachedUserPersona().displayName}
                    isStreaming={isStreaming && msg.id === messages[messages.length - 1]?.id && msg.role === "assistant"}
                    isLastAssistant={idx === lastAssistantIdx}
                    isLastUser={idx === lastUserIdx}
                    onRegenerate={handleRegenerate} onBranch={() => handleBranch(idx)}
                    onDelete={() => handleDeleteMessage(msg.id)}
                    onEdit={(newContent) => handleEditAndResend(idx, newContent)} />
                ))}
              </AnimatePresence>

              {isStreaming && messages[messages.length - 1]?.content === "" && <TypingIndicator />}
            </div>

            <ChatInput onSend={handleSend} disabled={isStreaming} />
          </div>

          {/* Desktop/Tablet right sidebar with animation */}
          <AnimatePresence>
            {!isMobile && settingsOpen && (
              <motion.div
                key="settings-sidebar"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 288, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="border-l border-gray-border overflow-hidden"
                style={{ flexShrink: 0, maxWidth: 288 }}
              >
                <div style={{ width: 288 }} className="h-full">
                  {settingsContent}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile settings drawer */}
      {isMobile && (
        <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
          <SheetContent side="right" className="p-0 w-80 bg-oled-surface border-gray-border">
            {settingsContent}
          </SheetContent>
        </Sheet>
      )}
    </div>
    {previewChar && createPortal(
      <CharacterPreviewDialog character={previewChar} onClose={() => setPreviewChar(null)} />,
      document.body
    )}
    </>
  );
};

const MessageSquareIcon = () => (
  <div className="w-16 h-16 rounded-2xl bg-oled-surface border border-gray-border flex items-center justify-center">
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-neon-purple/50">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  </div>
);

export default ChatPage;
