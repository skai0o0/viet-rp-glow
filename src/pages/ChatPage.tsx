import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getCachedUserPersona, isProfileIncomplete } from "@/services/profileDb";
import { Menu, Settings2, Trash2, PenLine, Search, X, ChevronUp, ChevronDown, ChevronRight, Plus, AlertTriangle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { ChatMessage, CharacterCard } from "@/types/character";
import { buildMessages, replaceMacros, truncateMessages } from "@/utils/promptBuilder";
import { streamChat, streamChatViaProxy } from "@/services/openRouter";
import { useChatQuota } from "@/hooks/useChatQuota";
import { copyToClipboard } from "@/utils/clipboard";
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
import { useUserRole } from "@/hooks/useUserRole";
import { useChatMemory } from "@/hooks/useChatMemory";
import { forceGenerateSummary } from "@/services/memoryManager";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useUserCredits } from "@/hooks/useUserCredits";
import { useCredits } from "@/services/creditDb";
import { deriveChatAccess } from "@/utils/chatAccess";

const ChatPage = () => {
  const { characterId } = useParams<{ characterId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const { quota, refresh: refreshQuota } = useChatQuota();
  const { balance: creditBalance, refresh: refreshCredits } = useUserCredits();
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [creditExceeded, setCreditExceeded] = useState(false);
  const { role } = useUserRole();
  const { summary, facts, loadMemory, clearMemory, triggerSummarize } = useChatMemory();
  const { track } = useAnalytics();
  const { isSubscriptionUser, effectiveQuota } = useMemo(
    () => deriveChatAccess(role, quota),
    [role, quota]
  );

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeCharacter, setActiveCharacter] = useState<CharacterCard | null>(null);
  const [activeCharId, setActiveCharId] = useState<string | null>(characterId || null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessions, setSessions] = useState<DbChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [charMap, setCharMap] = useState<Map<string, CharacterSummary>>(new Map());
  const [scenarioOverride, setScenarioOverride] = useState("");
  const [previewChar, setPreviewChar] = useState<CharacterSummary | null>(null);
  const [customFirstMes, setCustomFirstMes] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const usedCreditRef = useRef(false);
  const customFirstMesRef = useRef("");
  const messagesRef = useRef<ChatMessage[]>([]);
  const lastStreamRef = useRef<{ apiMessages: any[]; assistantId: string } | null>(null);
  const prefillRef = useRef<string | undefined>(undefined);
  const [streamError, setStreamError] = useState<string | null>(null);

  // Message search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchIdx, setSearchIdx] = useState(0);

  useEffect(() => {
    if (!isSubscriptionUser) {
      setQuotaExceeded(false);
      return;
    }
    if (effectiveQuota.remaining <= 0) {
      setQuotaExceeded(true);
    }
  }, [isSubscriptionUser, effectiveQuota.remaining]);

  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return messages
      .map((m, i) => (m.content.toLowerCase().includes(q) ? i : -1))
      .filter((i) => i !== -1);
  }, [messages, searchQuery]);

  const searchMatchIds = useMemo(
    () => new Set(searchMatches.map((i) => messages[i]?.id)),
    [searchMatches, messages],
  );

  const charSessions = useMemo(
    () => (activeCharId ? sessions.filter((s) => s.character_id === activeCharId) : []),
    [sessions, activeCharId]
  );

  // Tree view: group sessions by character, sorted by most recent activity
  const characterGroups = useMemo(() => {
    const groupMap = new Map<string, { characterId: string; sessions: DbChatSession[]; latestUpdate: string }>();
    for (const session of sessions) {
      const existing = groupMap.get(session.character_id);
      if (existing) {
        existing.sessions.push(session);
        if (session.updated_at > existing.latestUpdate) {
          existing.latestUpdate = session.updated_at;
        }
      } else {
        groupMap.set(session.character_id, {
          characterId: session.character_id,
          sessions: [session],
          latestUpdate: session.updated_at,
        });
      }
    }
    // Sort sessions within each group by updated_at desc
    for (const group of groupMap.values()) {
      group.sessions.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }
    // Sort groups by most recent activity
    return Array.from(groupMap.values()).sort(
      (a, b) => new Date(b.latestUpdate).getTime() - new Date(a.latestUpdate).getTime()
    );
  }, [sessions]);

  // Expand the most recent character group by default
  const [expandedChars, setExpandedChars] = useState<Set<string>>(new Set());
  const toggleCharExpand = useCallback((charId: string) => {
    setExpandedChars((prev) => {
      const next = new Set(prev);
      if (next.has(charId)) next.delete(charId);
      else next.add(charId);
      return next;
    });
  }, []);

  // Auto-expand first group when groups change
  useEffect(() => {
    if (characterGroups.length > 0 && expandedChars.size === 0) {
      setExpandedChars(new Set([characterGroups[0].characterId]));
    }
  }, [characterGroups]);

  const isPendingChat = !activeSessionId && !!activeCharacter && messages.length > 0 && messages[0]?.id === "pending-first-mes";

  const handleCustomFirstMesChange = useCallback((value: string) => {
    setCustomFirstMes(value);
    customFirstMesRef.current = value;
    setMessages(prev =>
      prev.map(m => m.id === "pending-first-mes" ? { ...m, content: value } : m)
    );
  }, []);

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
      copyToClipboard(md).then(() => {
        toast.success("Đã copy markdown vào clipboard");
      }).catch(() => {
        toast.error("Không thể copy vào clipboard");
      });
    };

    window.addEventListener("export-chat-markdown", handleExportMarkdown);
    return () => window.removeEventListener("export-chat-markdown", handleExportMarkdown);
  }, [activeCharacter, messages]);

  // Sync scenario + first message when character loads
  useEffect(() => {
    if (activeCharacter) {
      setScenarioOverride(activeCharacter.scenario || "");
      setCustomFirstMes(activeCharacter.first_mes || "");
      customFirstMesRef.current = activeCharacter.first_mes || "";
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
            message_count: dbChar.message_count,
            rating: dbChar.rating,
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
          if (c) next.set(c.id, { id: c.id, name: c.name, avatar_url: c.avatar_url, short_summary: c.short_summary, tags: c.tags, description: c.description, message_count: c.message_count, rating: c.rating });
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
      loadMemory(sessionId);
    } catch {
      toast.error("Không thể tải tin nhắn");
    }
  };

  const handleNewChat = async () => {
    if (!user || !activeCharId || !activeCharacter) return;
    abortRef.current?.abort();
    setIsStreaming(false);
    setActiveSessionId(null);
    clearMemory();
    setCustomFirstMes(activeCharacter.first_mes);
    customFirstMesRef.current = activeCharacter.first_mes;

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
    const firstMesContent = customFirstMesRef.current || activeCharacter.first_mes;
    await addMessage(session.id, "assistant", firstMesContent);
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
      // message_count tự động giảm qua DB trigger khi CASCADE DELETE chat_messages

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
    async (content: string, prefillText?: string) => {
      if (!user) {
        toast.error("Vui lòng đăng nhập để chat.");
        return;
      }

      usedCreditRef.current = false;
      if (isSubscriptionUser && effectiveQuota.remaining <= 0) {
        // Hết daily quota → thử dùng credit
        const creditOk = await useCredits("chat_message", 1);
        if (!creditOk) {
          setCreditExceeded(true);
          setQuotaExceeded(true);
          return;
        }
        usedCreditRef.current = true;
        refreshCredits();
      }

      if (!activeCharacter) return;

      let sessionId: string;
      try {
        sessionId = await ensureSession();
      } catch {
        toast.error("Không thể tạo cuộc trò chuyện");
        return;
      }

      let savedUserMsg;
      try {
        savedUserMsg = await addMessage(sessionId, "user", content);
      } catch {
        toast.error("Không thể gửi tin nhắn");
        return;
      }
      const userMsg: ChatMessage = {
        id: savedUserMsg.id, role: "user", content, timestamp: new Date(savedUserMsg.created_at),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);

      const assistantId = "streaming-" + Date.now();
      let assistantContent = "";

      const allMessages = [...messagesRef.current, userMsg];
      prefillRef.current = prefillText;
      const rawMessages = buildMessages(
        activeCharacter,
        allMessages.map((m) => ({ role: m.role, content: m.content })),
        undefined,
        scenarioOverride,
        summary,
        facts,
        prefillText,
      );
      const apiMessages = truncateMessages(rawMessages);

      const controller = new AbortController();
      abortRef.current = controller;

      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", timestamp: new Date() },
      ]);

      setStreamError(null);
      lastStreamRef.current = { apiMessages, assistantId };

      // Debug log for admin/op/mod to verify rolling_summary + truncation
      if (role === "admin" || role === "op" || role === "moderator") {
        console.log("🚀 [DEBUG] Final Payload sent to LLM:", JSON.stringify(apiMessages, null, 2));
      }

      const streamFn = isSubscriptionUser
        ? (msgs: Parameters<typeof streamChatViaProxy>[0], cbs: Parameters<typeof streamChatViaProxy>[1], sig?: AbortSignal) =>
            streamChatViaProxy(msgs, cbs, sig, undefined, usedCreditRef.current)
        : streamChat;

      let prefillSent = false;

      streamFn(
        apiMessages,
        {
          onDelta: (text) => {
            if (prefillRef.current && !prefillSent) {
              assistantContent = prefillRef.current + text;
              prefillSent = true;
            } else {
              assistantContent += text;
            }
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.id === assistantId) {
                return [...prev.slice(0, -1), { ...last, content: assistantContent }];
              }
              return prev.map((m) => (m.id === assistantId ? { ...m, content: assistantContent } : m));
            });
          },
          onDone: async () => {
            setIsStreaming(false);
            abortRef.current = null;
            lastStreamRef.current = null;
            prefillRef.current = undefined;
            if (assistantContent) {
              const saved = await addMessage(sessionId, "assistant", assistantContent);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, id: saved.id, timestamp: new Date(saved.created_at) } : m
                )
              );
              triggerSummarize(sessionId, messagesRef.current);
              track("chat_message_sent", { characterId: activeCharId, isSubscriptionUser });
            } else {
              setMessages((prev) => prev.filter((m) => m.id !== assistantId));
            }
            if (isSubscriptionUser) {
              refreshQuota();
              if (usedCreditRef.current) {
                refreshCredits();
                setQuotaExceeded(false);
                setCreditExceeded(false);
              }
            }
          },
          onError: (error) => {
            setIsStreaming(false);
            abortRef.current = null;
            if (!assistantContent) {
              setMessages((prev) => prev.filter((m) => m.id !== assistantId));
            }
            if (error === "__QUOTA_EXCEEDED__" && isSubscriptionUser) {
              setQuotaExceeded(true);
              refreshQuota();
            } else {
              setStreamError(error);
              toast.error(error);
            }
          },
        },
        controller.signal
      );
    },
    [
      activeCharacter,
      activeSessionId,
      activeCharId,
      user,
      navigate,
      scenarioOverride,
      effectiveQuota.remaining,
      refreshQuota,
      refreshCredits,
      isSubscriptionUser,
      summary,
      facts,
    ]
  );

  const handleRegenerate = useCallback(async () => {
    if (!activeSessionId || !activeCharacter || isStreaming) return;
    await deleteLastAssistantMessage(activeSessionId);
    const withoutLast = messages.slice(0, -1);

    // Credit pre-check for subscription users with exhausted quota
    usedCreditRef.current = false;
    if (isSubscriptionUser && effectiveQuota.remaining <= 0) {
      const creditOk = await useCredits("chat_message", 1);
      if (!creditOk) {
        setCreditExceeded(true);
        setQuotaExceeded(true);
        return;
      }
      usedCreditRef.current = true;
      refreshCredits();
    }

    setMessages(withoutLast);
    setIsStreaming(true);

    const assistantId = "streaming-" + Date.now();
    let assistantContent = "";

    const apiMessages = truncateMessages(buildMessages(
      activeCharacter,
      withoutLast.map((m) => ({ role: m.role, content: m.content })),
      undefined,
      scenarioOverride,
      summary,
      facts,
      prefillRef.current,
    ));

    const controller = new AbortController();
    abortRef.current = controller;

    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", timestamp: new Date() },
    ]);

    setStreamError(null);
    lastStreamRef.current = { apiMessages, assistantId };

    const streamFn = isSubscriptionUser
      ? (msgs: Parameters<typeof streamChatViaProxy>[0], cbs: Parameters<typeof streamChatViaProxy>[1], sig?: AbortSignal) =>
          streamChatViaProxy(msgs, cbs, sig, undefined, usedCreditRef.current)
      : streamChat;

    let prefillSent = false;

    streamFn(
      apiMessages,
      {
        onDelta: (text) => {
          if (prefillRef.current && !prefillSent) {
            assistantContent = prefillRef.current + text;
            prefillSent = true;
          } else {
            assistantContent += text;
          }
          assistantContent += text;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.id === assistantId) {
              return [...prev.slice(0, -1), { ...last, content: assistantContent }];
            }
            return prev.map((m) => (m.id === assistantId ? { ...m, content: assistantContent } : m));
          });
        },
        onDone: async () => {
          setIsStreaming(false);
          abortRef.current = null;
          lastStreamRef.current = null;
          if (assistantContent) {
            const saved = await addMessage(activeSessionId, "assistant", assistantContent);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, id: saved.id, timestamp: new Date(saved.created_at) } : m
              )
            );
            triggerSummarize(activeSessionId, messagesRef.current);
          }
          if (isSubscriptionUser) {
            refreshQuota();
            if (usedCreditRef.current) {
              refreshCredits();
              setQuotaExceeded(false);
              setCreditExceeded(false);
            }
          }
        },
        onError: (error) => {
          setIsStreaming(false);
          abortRef.current = null;
          if (!assistantContent) {
            setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          }
          if (error === "__QUOTA_EXCEEDED__" && isSubscriptionUser) {
            setQuotaExceeded(true);
            setCreditExceeded(true);
            refreshQuota();
          } else {
            setStreamError(error);
            toast.error(error);
          }
        },
      },
      controller.signal
    );
  }, [messages, activeCharacter, activeSessionId, isStreaming, scenarioOverride, refreshQuota, refreshCredits, isSubscriptionUser, summary, facts]);

  // ── Force Summarize (admin/op/mod BYOK manual trigger) ──
  const canForceSummarize = (role === "admin" || role === "op" || role === "moderator") && !isSubscriptionUser;

  const handleForceSummarize = useCallback(async () => {
    if (!activeSessionId || isSummarizing) return;
    setIsSummarizing(true);
    try {
      const newSummary = await toast.promise(
        forceGenerateSummary(activeSessionId, messagesRef.current, summary ?? null),
        {
          loading: "Đang tóm tắt ngữ cảnh bằng model của bạn...",
          success: "Đã tóm tắt ngữ cảnh thành công!",
          error: (err) => `Tóm tắt thất bại: ${err?.message || "Unknown error"}`,
        },
      );
      if (newSummary) {
        console.log("[handleForceSummarize] Summary generated, reloading memory...");
        await loadMemory(activeSessionId);
      }
    } catch (err) {
      console.error("[handleForceSummarize] Error:", err);
    } finally {
      setIsSummarizing(false);
    }
  }, [activeSessionId, summary, isSummarizing, loadMemory]);

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
        // message_count tự động giảm qua DB trigger khi DELETE chat_messages
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

      // Credit pre-check for subscription users with exhausted quota
      usedCreditRef.current = false;
      if (isSubscriptionUser && effectiveQuota.remaining <= 0) {
        const creditOk = await useCredits("chat_message", 1);
        if (!creditOk) {
          setCreditExceeded(true);
          setQuotaExceeded(true);
          return;
        }
        usedCreditRef.current = true;
        refreshCredits();
      }

      // Now regenerate
      setIsStreaming(true);
      const assistantId = "streaming-" + Date.now();
      let assistantContent = "";

      const apiMessages = truncateMessages(buildMessages(
        activeCharacter,
        updatedMessages.map((m) => ({ role: m.role, content: m.content })),
        undefined,
        scenarioOverride,
        summary,
        facts,
        prefillRef.current,
      ));

      const controller = new AbortController();
      abortRef.current = controller;

      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", timestamp: new Date() },
      ]);

      setStreamError(null);
      lastStreamRef.current = { apiMessages, assistantId };

      const streamFn = isSubscriptionUser
        ? (msgs: Parameters<typeof streamChatViaProxy>[0], cbs: Parameters<typeof streamChatViaProxy>[1], sig?: AbortSignal) =>
            streamChatViaProxy(msgs, cbs, sig, undefined, usedCreditRef.current)
        : streamChat;

      let prefillSent = false;

      streamFn(
        apiMessages,
        {
          onDelta: (text) => {
            if (prefillRef.current && !prefillSent) {
              assistantContent = prefillRef.current + text;
              prefillSent = true;
            } else {
              assistantContent += text;
            }
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.id === assistantId) {
                return [...prev.slice(0, -1), { ...last, content: assistantContent }];
              }
              return prev.map((m) => (m.id === assistantId ? { ...m, content: assistantContent } : m));
            });
          },
          onDone: async () => {
            setIsStreaming(false);
            abortRef.current = null;
            lastStreamRef.current = null;
            if (assistantContent) {
              const saved = await addMessage(activeSessionId, "assistant", assistantContent);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, id: saved.id, timestamp: new Date(saved.created_at) } : m
                )
              );
              triggerSummarize(activeSessionId, messagesRef.current);
            }
            if (isSubscriptionUser) {
              refreshQuota();
              if (usedCreditRef.current) {
                refreshCredits();
                setQuotaExceeded(false);
                setCreditExceeded(false);
              }
            }
          },
          onError: (error) => {
            setIsStreaming(false);
            abortRef.current = null;
            if (!assistantContent) {
              setMessages((prev) => prev.filter((m) => m.id !== assistantId));
            }
            if (error === "__QUOTA_EXCEEDED__" && isSubscriptionUser) {
              setQuotaExceeded(true);
              setCreditExceeded(true);
              refreshQuota();
            } else {
              setStreamError(error);
              toast.error(error);
            }
          },
        },
        controller.signal
      );
    },
    [messages, activeCharacter, activeSessionId, isStreaming, scenarioOverride, refreshQuota, refreshCredits, isSubscriptionUser, summary, facts]
  );

  const handleRetry = useCallback(async () => {
    if (!lastStreamRef.current || isStreaming) return;
    const { apiMessages } = lastStreamRef.current;

    // Credit pre-check for subscription users with exhausted quota
    usedCreditRef.current = false;
    if (isSubscriptionUser && effectiveQuota.remaining <= 0) {
      const creditOk = await useCredits("chat_message", 1);
      if (!creditOk) {
        setCreditExceeded(true);
        setQuotaExceeded(true);
        return;
      }
      usedCreditRef.current = true;
      refreshCredits();
    }

    setIsStreaming(true);
    setStreamError(null);

    const assistantId = "streaming-" + Date.now();
    let assistantContent = "";

    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", timestamp: new Date() },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;
    lastStreamRef.current = { apiMessages, assistantId };

    const streamFn = isSubscriptionUser
      ? (msgs: Parameters<typeof streamChatViaProxy>[0], cbs: Parameters<typeof streamChatViaProxy>[1], sig?: AbortSignal) =>
          streamChatViaProxy(msgs, cbs, sig, undefined, usedCreditRef.current)
      : streamChat;

    let prefillSent = false;

    streamFn(
      apiMessages,
      {
        onDelta: (text) => {
          if (prefillRef.current && !prefillSent) {
            assistantContent = prefillRef.current + text;
            prefillSent = true;
          } else {
            assistantContent += text;
          }
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.id === assistantId) {
              return [...prev.slice(0, -1), { ...last, content: assistantContent }];
            }
            return prev.map((m) => (m.id === assistantId ? { ...m, content: assistantContent } : m));
          });
        },
        onDone: async () => {
          setIsStreaming(false);
          abortRef.current = null;
          lastStreamRef.current = null;
          if (assistantContent && activeSessionId) {
            const saved = await addMessage(activeSessionId, "assistant", assistantContent);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, id: saved.id, timestamp: new Date(saved.created_at) } : m
              )
            );
          }
          if (isSubscriptionUser) {
            refreshQuota();
            if (usedCreditRef.current) {
              refreshCredits();
              setQuotaExceeded(false);
              setCreditExceeded(false);
            }
          }
        },
        onError: (error) => {
          setIsStreaming(false);
          abortRef.current = null;
          if (!assistantContent) {
            setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          }
          if (error === "__QUOTA_EXCEEDED__" && isSubscriptionUser) {
            setQuotaExceeded(true);
            setCreditExceeded(true);
            refreshQuota();
          } else {
            setStreamError(error);
            toast.error(error);
          }
        },
      },
      controller.signal
    );
  }, [isStreaming, activeSessionId, isSubscriptionUser, refreshQuota, refreshCredits]);

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
              message_count: dbChar.message_count, rating: dbChar.rating,
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
  const canViewMemory = canForceSummarize && !!activeSessionId;
  const settingsContent = activeCharacter ? (
    <GenerationSettings
      scenario={scenarioOverride}
      onScenarioChange={setScenarioOverride}
      onClose={undefined}
      defaultScenario={activeCharacter.scenario || ""}
      customFirstMes={customFirstMes}
      onCustomFirstMesChange={handleCustomFirstMesChange}
      isPendingChat={isPendingChat}
      defaultFirstMes={activeCharacter.first_mes}
      userTier={effectiveQuota.tier}
      isByok={!isSubscriptionUser}
      summary={canViewMemory ? summary : undefined}
      facts={canViewMemory ? facts : undefined}
      canViewMemory={canViewMemory}
      onForceSummarize={canForceSummarize ? handleForceSummarize : undefined}
      isSummarizing={isSummarizing}
    />
  ) : null;

  const quotaBadgeText = isSubscriptionUser
    ? `${effectiveQuota.remaining}/${effectiveQuota.limit}`
    : role.toUpperCase();

  const quotaBadgeClass = isSubscriptionUser
    ? effectiveQuota.remaining <= 0
      ? "bg-red-500/10 border-red-500/30 text-red-400"
      : effectiveQuota.remaining <= 5
        ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
        : "bg-neon-blue/10 border-neon-blue/30 text-neon-blue"
    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";

  // No character selected — show all sessions list
  if (!activeCharacter) {
    return (
      <div className="flex-1 flex overflow-hidden min-w-0">
        <ChatSidebar
          open={sidebarOpen} onClose={() => setSidebarOpen(false)}
          sessions={sessions} characters={charMap} activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession} onNewChat={() => {}} onDeleteSession={handleDeleteSession}
        />
        <div className="flex-1 flex flex-col min-w-0">
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
              <div className="max-w-4xl mx-auto space-y-3">
                {characterGroups.map((group) => {
                  const char = charMap.get(group.characterId);
                  const initial = char?.name?.charAt(0)?.toUpperCase() || "?";
                  const isExpanded = expandedChars.has(group.characterId);
                  const latestTimeStr = new Date(group.latestUpdate).toLocaleDateString("vi-VN", {
                    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                  });

                  return (
                    <div key={group.characterId} className="rounded-xl border border-gray-border bg-oled-surface overflow-hidden">
                      {/* Character header */}
                      <motion.button
                        whileTap={{ scale: 0.99 }}
                        onClick={() => toggleCharExpand(group.characterId)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-oled-elevated transition-colors text-left"
                      >
                        {char?.avatar_url && char.avatar_url.startsWith("http") ? (
                          <img
                            src={char.avatar_url}
                            alt={char.name}
                            className="w-10 h-10 rounded-full object-cover border border-neon-purple/20 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold bg-oled-elevated text-neon-purple border border-neon-purple/20 flex-shrink-0">
                            {initial}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-foreground truncate">{char?.name || "Nhân vật"}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {group.sessions.length} cuộc trò chuyện · Hoạt động: {latestTimeStr}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] bg-neon-purple/15 text-neon-purple border border-neon-purple/30 px-1.5 py-0.5 rounded-full font-medium">
                            {group.sessions.length}
                          </span>
                          <motion.div
                            animate={{ rotate: isExpanded ? 90 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronRight size={16} className="text-muted-foreground" />
                          </motion.div>
                        </div>
                      </motion.button>

                      {/* Sessions list (collapsible) */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="border-t border-gray-border/50 px-2 py-1.5 space-y-1">
                              {group.sessions.map((session) => {
                                const displayTitle = session.title || char?.name || "Cuộc trò chuyện";
                                const timeStr = new Date(session.updated_at).toLocaleDateString("vi-VN", {
                                  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                                });

                                return (
                                  <motion.div
                                    key={session.id}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="group flex items-center gap-3 pl-10 pr-3 py-2.5 rounded-lg hover:bg-oled-elevated cursor-pointer transition-colors relative active:scale-[0.98]"
                                    onClick={() => {
                                      handleSelectSession(session.id);
                                      if (!characterId) {
                                        navigate(`/chat/${session.character_id}`);
                                      }
                                    }}
                                  >
                                    {/* Timeline dot */}
                                    <div className="absolute left-[18px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-gray-border group-hover:bg-neon-purple/60 transition-colors" />

                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm text-foreground truncate">{displayTitle}</p>
                                      <p className="text-[10px] text-muted-foreground">{timeStr}</p>
                                    </div>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                                      className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded text-muted-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100 active:text-red-400 hover:text-red-400 transition-all"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </motion.div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
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
    <div className="flex-1 flex overflow-hidden min-w-0">
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
          <div className="flex items-center gap-1 pr-2 shrink-0">
            {/* Quota badge */}
            <div className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${quotaBadgeClass}`}>
              {quotaBadgeText}
            </div>
            {/* New chat */}
            <button onClick={handleNewChat}
              className="p-2 text-muted-foreground hover:text-neon-purple transition-colors">
              <Plus size={18} />
            </button>
            {/* Search toggle */}
            <button onClick={() => { setSearchOpen(!searchOpen); setSearchQuery(""); setSearchIdx(0); }}
              className={`p-2 transition-colors ${searchOpen ? "text-neon-blue" : "text-muted-foreground hover:text-foreground"}`}>
              <Search size={18} />
            </button>
            {/* Settings toggle */}
            <button onClick={() => setSettingsOpen(!settingsOpen)}
              className={`p-2 transition-colors ${settingsOpen ? "text-neon-purple" : "text-muted-foreground hover:text-foreground"}`}>
              <Settings2 size={18} />
            </button>
          </div>
        </div>

        {/* Search bar */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden border-b border-gray-border bg-oled-surface"
            >
              <div className="flex items-center gap-2 px-4 py-2">
                <Search size={14} className="text-muted-foreground shrink-0" />
                <input
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setSearchIdx(0); }}
                  placeholder="Tìm kiếm tin nhắn..."
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && searchMatches.length > 0) {
                      const next = (searchIdx + 1) % searchMatches.length;
                      setSearchIdx(next);
                      document.getElementById(`msg-${messages[searchMatches[next]]?.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                    } else if (e.key === "Escape") {
                      setSearchOpen(false);
                      setSearchQuery("");
                    }
                  }}
                />
                {searchQuery && (
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {searchMatches.length > 0 ? `${searchIdx + 1}/${searchMatches.length}` : "0"}
                  </span>
                )}
                {searchMatches.length > 1 && (
                  <>
                    <button
                      onClick={() => {
                        const prev = (searchIdx - 1 + searchMatches.length) % searchMatches.length;
                        setSearchIdx(prev);
                        document.getElementById(`msg-${messages[searchMatches[prev]]?.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      onClick={() => {
                        const next = (searchIdx + 1) % searchMatches.length;
                        setSearchIdx(next);
                        document.getElementById(`msg-${messages[searchMatches[next]]?.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </>
                )}
                <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="p-1 text-muted-foreground hover:text-foreground">
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 flex overflow-hidden min-w-0">
          {/* Chat messages area */}
          <div className="flex-1 flex flex-col min-w-0">
            <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin py-4 space-y-4">
              {/* Profile incomplete caution */}
              {(() => {
                const profileCheck = isProfileIncomplete();
                return profileCheck.incomplete ? (
                  <button
                    onClick={() => navigate("/profile")}
                    className="mx-4 md:mx-6 flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/15 hover:border-amber-500/60 transition-all"
                  >
                    <AlertTriangle size={16} className="shrink-0" />
                    <div className="text-left">
                      <p className="text-xs font-medium">Hồ sơ Roleplay chưa đầy đủ</p>
                      <p className="text-[10px] text-amber-400/70">Thiếu: {profileCheck.missing.join(", ")} — Bấm để cập nhật</p>
                    </div>
                  </button>
                ) : null;
              })()}

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

              {isPendingChat && !settingsOpen && (
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="mx-4 md:mx-6 flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-neon-blue/30 bg-neon-blue/5 text-[11px] text-neon-blue/80 hover:border-neon-blue/60 hover:text-neon-blue transition-colors"
                >
                  <PenLine size={12} />
                  <span>Bấm vào đây hoặc biểu tượng ⚙️ để tùy chỉnh lời chào & bối cảnh</span>
                </button>
              )}

              <AnimatePresence>
                {messages.map((msg, idx) => (
                  <div key={msg.id} id={`msg-${msg.id}`} className={searchMatchIds.has(msg.id) ? "ring-1 ring-neon-blue/50 rounded-xl mx-2" : ""}>
                  <MessageBubble message={msg}
                    characterAvatar={activeCharacter.avatar} characterName={activeCharacter.name}
                    userName={getCachedUserPersona().displayName}
                    isStreaming={isStreaming && msg.id === messages[messages.length - 1]?.id && msg.role === "assistant"}
                    isLastAssistant={idx === lastAssistantIdx}
                    isLastUser={idx === lastUserIdx}
                    onRegenerate={handleRegenerate} onBranch={() => handleBranch(idx)}
                    onDelete={() => handleDeleteMessage(msg.id)}
                    onEdit={(newContent) => handleEditAndResend(idx, newContent)} />
                  </div>
                ))}
              </AnimatePresence>

              {isStreaming && messages[messages.length - 1]?.content === "" && <TypingIndicator />}
            </div>

            {isSubscriptionUser && quotaExceeded && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-4 md:mx-6 mb-2 p-4 rounded-2xl border border-neon-purple/30 bg-gradient-to-r from-neon-purple/10 via-oled-surface to-neon-blue/10"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-neon-purple/20 flex items-center justify-center shrink-0">
                    <AlertTriangle size={20} className="text-neon-purple" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {creditExceeded ? "Hết lượt chat & credit!" : "Hết lượt chat hôm nay!"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {creditExceeded
                        ? `Bạn đã dùng hết ${effectiveQuota.limit} tin nhắn và không còn credit. Liên hệ admin để mua thêm credit hoặc chờ reset lúc 00:00.`
                        : `Bạn đã dùng hết ${effectiveQuota.limit} tin nhắn trong gói ${effectiveQuota.plan_name}. Nâng cấp Pro để tăng giới hạn tin nhắn mỗi ngày.`
                      }
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="bg-neon-purple text-primary-foreground hover:shadow-neon-purple shrink-0"
                    onClick={() => navigate(creditExceeded ? "/credits" : "/settings")}
                  >
                    {creditExceeded ? "Mua credit" : "Nâng cấp"}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Stream error retry */}
            {streamError && !isStreaming && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-4 md:mx-6 mb-2 p-3 rounded-xl border border-red-500/30 bg-red-500/10 flex items-center gap-3"
              >
                <AlertTriangle size={16} className="text-red-400 shrink-0" />
                <p className="text-xs text-red-400 flex-1">Lỗi khi gửi tin nhắn. Thử lại?</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-500/30 text-red-400 hover:bg-red-500/20 h-7 px-3"
                  onClick={handleRetry}
                >
                  Thử lại
                </Button>
              </motion.div>
            )}

            <ChatInput onSend={handleSend} disabled={isStreaming || (isSubscriptionUser && quotaExceeded)} />
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
