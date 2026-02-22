import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { ChatMessage, CharacterCard } from "@/types/character";
import { buildMessages } from "@/utils/promptBuilder";
import { streamChat, getApiKey } from "@/services/openRouter";
import { getCharacterById, dbCharToCard, CharacterSummary } from "@/services/characterDb";
import {
  getUserSessions,
  createSession,
  deleteSession,
  getSessionMessages,
  addMessage,
  deleteLastAssistantMessage,
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
import { Button } from "@/components/ui/button";

const ChatPage = () => {
  const { characterId } = useParams<{ characterId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeCharacter, setActiveCharacter] = useState<CharacterCard | null>(null);
  const [activeCharId, setActiveCharId] = useState<string | null>(characterId || null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessions, setSessions] = useState<DbChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [charMap, setCharMap] = useState<Map<string, CharacterSummary>>(new Map());

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Sessions filtered by active character
  const charSessions = useMemo(
    () => (activeCharId ? sessions.filter((s) => s.character_id === activeCharId) : []),
    [sessions, activeCharId]
  );

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

  // Auto-create or load session when character loaded
  useEffect(() => {
    if (!user || !activeCharId || !activeCharacter) return;
    if (activeSessionId) return;

    const existing = sessions.filter((s) => s.character_id === activeCharId);
    if (existing.length > 0) {
      loadSession(existing[0].id);
    } else {
      handleNewChat();
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

    try {
      const session = await createSession(user.id, activeCharId, activeCharacter.name);
      const firstMsg = await addMessage(session.id, "assistant", activeCharacter.first_mes);
      setActiveSessionId(session.id);
      setMessages([
        {
          id: firstMsg.id,
          role: "assistant",
          content: activeCharacter.first_mes,
          timestamp: new Date(firstMsg.created_at),
        },
      ]);
      setSessions((prev) => [session, ...prev]);
    } catch {
      toast.error("Không thể tạo cuộc trò chuyện mới");
    }
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

  // Branch chat at a specific message index
  const handleBranch = useCallback(
    async (messageIndex: number) => {
      if (!user || !activeCharId || !activeSessionId) return;

      const toastId = toast.loading("Đang tạo nhánh mới...");

      try {
        const branchNum = charSessions.length + 1;
        const branchTitle = `Nhánh ${branchNum} — ${new Date().toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })}`;

        const msgSnapshot = messages.map((m) => ({ role: m.role, content: m.content }));

        const newSession = await branchChatSession(
          activeSessionId,
          user.id,
          activeCharId,
          msgSnapshot,
          messageIndex,
          branchTitle
        );

        setSessions((prev) => [newSession, ...prev]);

        // Load the new branch
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
          action: {
            label: "Đi tới Cài Đặt",
            onClick: () => navigate("/settings"),
          },
        });
        return;
      }
      if (!activeSessionId || !activeCharacter) return;

      const savedUserMsg = await addMessage(activeSessionId, "user", content);
      const userMsg: ChatMessage = {
        id: savedUserMsg.id,
        role: "user",
        content,
        timestamp: new Date(savedUserMsg.created_at),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);

      const assistantId = "streaming-" + Date.now();
      let assistantContent = "";

      const allMessages = [...messages, userMsg];
      const apiMessages = buildMessages(
        activeCharacter,
        allMessages.map((m) => ({ role: m.role, content: m.content }))
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
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: assistantContent } : m
              )
            );
          },
          onDone: async () => {
            setIsStreaming(false);
            abortRef.current = null;
            if (assistantContent) {
              const saved = await addMessage(activeSessionId, "assistant", assistantContent);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, id: saved.id, timestamp: new Date(saved.created_at) }
                    : m
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
    [messages, activeCharacter, activeSessionId, navigate]
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
      withoutLast.map((m) => ({ role: m.role, content: m.content }))
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
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: assistantContent } : m
            )
          );
        },
        onDone: async () => {
          setIsStreaming(false);
          abortRef.current = null;
          if (assistantContent) {
            const saved = await addMessage(activeSessionId, "assistant", assistantContent);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, id: saved.id, timestamp: new Date(saved.created_at) }
                  : m
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
  }, [messages, activeCharacter, activeSessionId, isStreaming]);

  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return i;
    }
    return -1;
  })();

  // Handle session selection (from sidebar or header dropdown)
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
              id: dbChar.id,
              name: dbChar.name,
              avatar_url: dbChar.avatar_url,
              short_summary: dbChar.short_summary,
              tags: dbChar.tags,
              description: dbChar.description,
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

  // No character selected state
  if (!activeCharacter) {
    return (
      <div className="flex-1 flex overflow-hidden">
        <ChatSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          sessions={sessions}
          characters={charMap}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onNewChat={() => {}}
          onDeleteSession={handleDeleteSession}
        />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="absolute top-4 left-4 p-2 text-muted-foreground hover:text-foreground transition-colors md:hidden"
          >
            <Menu size={20} />
          </button>
          <MessageSquareIcon />
          <p className="text-lg font-medium">Chọn nhân vật để bắt đầu trò chuyện</p>
          <Button
            variant="outline"
            className="border-gray-border text-muted-foreground hover:border-neon-purple hover:text-neon-purple"
            onClick={() => navigate("/")}
          >
            Khám phá nhân vật
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      <ChatSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        sessions={sessions}
        characters={charMap}
        activeSessionId={activeSessionId}
        onSelectSession={(id) => {
          handleSelectSession(id);
          setSidebarOpen(false);
        }}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        characterName={activeCharacter.name}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center bg-oled-base border-b border-gray-border">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1">
            <ChatHeader
              character={activeCharacter}
              onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
              onNewChat={handleNewChat}
              sessions={charSessions}
              activeSessionId={activeSessionId}
              onSelectSession={handleSelectSession}
            />
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin py-4 space-y-4">
          {activeCharacter.scenario && (
            <div className="mx-4 md:mx-6 p-3 rounded-xl bg-oled-surface border border-gray-border">
              <p className="text-[11px] text-muted-foreground">
                <span className="text-neon-purple font-medium">Kịch bản:</span>{" "}
                {activeCharacter.scenario}
              </p>
            </div>
          )}

          <AnimatePresence>
            {messages.map((msg, idx) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                characterAvatar={activeCharacter.avatar}
                characterName={activeCharacter.name}
                isStreaming={
                  isStreaming &&
                  msg.id === messages[messages.length - 1]?.id &&
                  msg.role === "assistant"
                }
                isLastAssistant={idx === lastAssistantIdx}
                onRegenerate={handleRegenerate}
                onBranch={() => handleBranch(idx)}
              />
            ))}
          </AnimatePresence>

          {isStreaming && messages[messages.length - 1]?.content === "" && (
            <TypingIndicator />
          )}
        </div>

        <ChatInput onSend={handleSend} disabled={isStreaming} />
      </div>
    </div>
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
