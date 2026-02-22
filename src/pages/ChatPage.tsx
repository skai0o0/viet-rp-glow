import { useState, useRef, useEffect, useCallback } from "react";
import { Menu } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { ChatMessage, CharacterCard } from "@/types/character";
import { marinCharacter, mockMessages } from "@/data/mockData";
import { buildMessages } from "@/utils/promptBuilder";
import { streamChat, getApiKey } from "@/services/openRouter";
import { toast } from "sonner";
import ChatHeader from "@/components/ChatHeader";
import ChatSidebar from "@/components/ChatSidebar";
import ChatInput from "@/components/ChatInput";
import MessageBubble from "@/components/MessageBubble";
import TypingIndicator from "@/components/TypingIndicator";

const ChatPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeCharacter, setActiveCharacter] = useState<CharacterCard>(marinCharacter);
  const [messages, setMessages] = useState<ChatMessage[]>(mockMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const handleSend = useCallback((content: string) => {
    if (!getApiKey()) {
      toast.error("Vui lòng nhập API Key của OpenRouter trong phần Cài Đặt.", {
        action: {
          label: "Đi tới Cài Đặt",
          onClick: () => window.location.href = "/settings",
        },
      });
      return;
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);

    const assistantId = (Date.now() + 1).toString();
    let assistantContent = "";

    // Build messages for API
    const allMessages = [...messages, userMsg];
    const apiMessages = buildMessages(
      activeCharacter,
      allMessages.map((m) => ({ role: m.role, content: m.content }))
    );

    const controller = new AbortController();
    abortRef.current = controller;

    // Create initial empty assistant message
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
        onDone: () => {
          setIsStreaming(false);
          abortRef.current = null;
        },
        onError: (error) => {
          setIsStreaming(false);
          abortRef.current = null;
          // Remove empty assistant message on error
          if (!assistantContent) {
            setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          }
          toast.error(error);
        },
      },
      controller.signal
    );
  }, [messages, activeCharacter]);

  const handleSelectCharacter = (char: CharacterCard) => {
    // Abort ongoing stream
    abortRef.current?.abort();
    setIsStreaming(false);

    setActiveCharacter(char);
    const firstMsg: ChatMessage = {
      id: "first",
      role: "assistant",
      content: char.first_mes,
      timestamp: new Date(),
    };
    setMessages([firstMsg]);
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      <ChatSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeCharacter={activeCharacter}
        onSelectCharacter={handleSelectCharacter}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center bg-oled-base border-b border-gray-border">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1">
            <ChatHeader
              character={activeCharacter}
              onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
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
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                characterAvatar={activeCharacter.avatar}
                characterName={activeCharacter.name}
                isStreaming={isStreaming && msg.id === messages[messages.length - 1]?.id && msg.role === "assistant"}
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

export default ChatPage;
