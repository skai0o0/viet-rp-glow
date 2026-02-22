import { useState, useRef, useEffect } from "react";
import { Menu } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { ChatMessage, CharacterCard } from "@/types/character";
import { marinCharacter, mockMessages } from "@/data/mockData";
import ChatHeader from "@/components/ChatHeader";
import ChatSidebar from "@/components/ChatSidebar";
import ChatInput from "@/components/ChatInput";
import MessageBubble from "@/components/MessageBubble";
import TypingIndicator from "@/components/TypingIndicator";

const Index = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeCharacter, setActiveCharacter] = useState<CharacterCard>(marinCharacter);
  const [messages, setMessages] = useState<ChatMessage[]>(mockMessages);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = (content: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Waaaa cậu giỏi quá đi! 🎉 Mình rất vui khi nghe cậu nói vậy. Để mình nghĩ xem nên bắt đầu từ đâu nhé... À, cậu thích nhân vật nào trong anime gần đây không? Mình có thể gợi ý bộ cosplay phù hợp cho cậu! ✨",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 2000);
  };

  const handleSelectCharacter = (char: CharacterCard) => {
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
    <div className="h-screen flex bg-oled-base overflow-hidden">
      {/* Sidebar */}
      <ChatSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeCharacter={activeCharacter}
        onSelectCharacter={handleSelectCharacter}
      />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header with menu button */}
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

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin py-4 space-y-4">
          {/* Scenario banner */}
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
              />
            ))}
          </AnimatePresence>

          {isTyping && <TypingIndicator />}
        </div>

        {/* Input */}
        <ChatInput onSend={handleSend} disabled={isTyping} />
      </div>
    </div>
  );
};

export default Index;
