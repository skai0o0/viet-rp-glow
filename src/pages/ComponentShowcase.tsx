import { useState } from "react";
import { motion } from "framer-motion";
import { Wand2, Sparkles, Eye, EyeOff } from "lucide-react";
import type { CharacterSummary } from "@/services/characterDb";
import type { ChatMessage } from "@/types/character";

import CharacterCard from "@/components/CharacterCard";
import ChatInput from "@/components/ChatInput";
import MessageBubble from "@/components/MessageBubble";
import RoleplayMessage from "@/components/RoleplayMessage";
import TypingIndicator from "@/components/TypingIndicator";
import CharGenAssistant from "@/components/CharGenAssistant";
import NsfwToggle from "@/components/NsfwToggle";
import AppFooter from "@/components/AppFooter";
import CreatePageHeader from "@/components/CreatePageHeader";
import { Badge } from "@/components/ui/badge";

// ─── Mock Data ──────────────────────────────────────────────

const MOCK_CHARACTERS: CharacterSummary[] = [
  {
    id: "1",
    name: "Yuki Tanaka",
    avatar_url: null,
    short_summary: "Một nữ pháp sư băng giá đến từ thế giới fantasy",
    tags: ["anime", "fantasy", "magic"],
    description: "Yuki là một pháp sư băng giá xinh đẹp...",
    message_count: 12400,
    rating: 4.8,
  },
  {
    id: "2",
    name: "Dark Knight",
    avatar_url: null,
    short_summary: "Hiệp sĩ bóng tối bảo vệ công lý",
    tags: ["dark", "action"],
    description: "Một hiệp sĩ bí ẩn...",
    message_count: 8500,
    rating: 4.5,
  },
  {
    id: "3",
    name: "NSFW Character",
    avatar_url: null,
    short_summary: "Nhân vật test NSFW",
    tags: ["nsfw", "mature"],
    description: "...",
    message_count: 500,
    rating: 3.2,
  },
];

const now = new Date();

const MOCK_MESSAGES: ChatMessage[] = [
  { id: "1", role: "system", content: "Cuộc trò chuyện mới đã bắt đầu", timestamp: now },
  {
    id: "2",
    role: "assistant",
    content: '*Yuki mỉm cười nhẹ nhàng* "Xin chào! Tôi là Yuki, một pháp sư băng giá. Rất vui được gặp bạn!" \n\n(Ánh mắt cô ấy lấp lánh như những bông tuyết)',
    timestamp: new Date(now.getTime() + 1000),
  },
  {
    id: "3",
    role: "user",
    content: "Chào Yuki! Bạn có thể dạy tôi phép thuật không?",
    timestamp: new Date(now.getTime() + 2000),
  },
  {
    id: "4",
    role: "assistant",
    content: '*Yuki gật đầu* "Tất nhiên rồi! Trước tiên, bạn cần học cách cảm nhận mana trong cơ thể mình."\n\n*Vung tay nhẹ, tạo ra một đám mây tuyết nhỏ*\n\nĐây là phép thuật cơ bản nhất - **Băng Tinh**. Bạn thử xem!\n\n```python\n# Công thức phép băng\ndef ice_crystal(mana_level):\n    return mana_level * 0.8 + "❄️"\n```',
    timestamp: new Date(now.getTime() + 3000),
  },
  {
    id: "5",
    role: "user",
    content: "/cmd Tôi muốn thử cast spell",
    timestamp: new Date(now.getTime() + 4000),
  },
];

// ─── Section Component ──────────────────────────────────────

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-4">
    <h2 className="text-lg font-bold text-foreground border-b border-gray-border pb-2">{title}</h2>
    {children}
  </div>
);

const Showcase = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
    <div className="p-4 rounded-xl border border-gray-border bg-oled-base/50">
      {children}
    </div>
  </div>
);

// ─── Main Page ──────────────────────────────────────────────

const ComponentShowcase = () => {
  const [showCharGen, setShowCharGen] = useState(false);
  const [favIds, setFavIds] = useState<Set<string>>(new Set(["2"]));
  const [chatDisabled, setChatDisabled] = useState(false);

  const handleFavToggle = (id: string, newState: boolean) => {
    setFavIds((prev) => {
      const next = new Set(prev);
      if (newState) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-oled-base">
      <CreatePageHeader
        icon={<Sparkles size={16} className="text-white" />}
        title="Component Library"
        subtitle="VietRP Component Showcase"
        rightActions={
          <button
            onClick={() => setShowCharGen(!showCharGen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-neon-purple/10 border border-neon-purple/30 text-neon-purple hover:bg-neon-purple/20 transition-colors"
          >
            <Wand2 size={12} />
            CharGen
          </button>
        }
      />

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-12">
        {/* CharacterCard */}
        <Section title="CharacterCard">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Showcase label="Default">
              <CharacterCard
                character={MOCK_CHARACTERS[0]}
                onClick={() => {}}
                isFavorited={favIds.has(MOCK_CHARACTERS[0].id)}
                onFavoriteToggle={handleFavToggle}
              />
            </Showcase>
            <Showcase label="Favorited">
              <CharacterCard
                character={MOCK_CHARACTERS[1]}
                onClick={() => {}}
                isFavorited={favIds.has(MOCK_CHARACTERS[1].id)}
                onFavoriteToggle={handleFavToggle}
              />
            </Showcase>
            <Showcase label="NSFW Badge">
              <CharacterCard
                character={MOCK_CHARACTERS[2]}
                onClick={() => {}}
                isNsfw={true}
              />
            </Showcase>
          </div>
        </Section>

        {/* RoleplayMessage */}
        <Section title="RoleplayMessage">
          <div className="space-y-4">
            <Showcase label="Dialogue + Action + Thought">
              <div className="text-sm leading-relaxed">
                <RoleplayMessage
                  text={'*Yuki mỉm cười nhẹ nhàng* "Xin chào! Tôi là Yuki." (Cô ấy có vẻ vui)\n\nĐây là text thường.'}
                  charName="Yuki"
                  userName="Player"
                />
              </div>
            </Showcase>
            <Showcase label="Code Block + Inline Code">
              <div className="text-sm leading-relaxed">
                <RoleplayMessage
                  text={'Sử dụng `spell.cast()` để tung phép.\n\n```python\ndef cast_spell(mana):\n    return mana * 2\n```\n\nHoặc dùng **bold** và *italic*.'}
                />
              </div>
            </Showcase>
            <Showcase label="Markdown Table">
              <div className="text-sm leading-relaxed">
                <RoleplayMessage
                  text={'| Spell | Mana | Damage |\n|-------|------|--------|\n| Ice Shard | 10 | 50 |\n| Frost Nova | 30 | 120 |\n| Blizzard | 50 | 200 |'}
                />
              </div>
            </Showcase>
            <Showcase label="Macro Replacement">
              <div className="text-sm leading-relaxed">
                <RoleplayMessage
                  text={'*{{char}} nhìn {{user}} với ánh mắt tò mò* "Bạn tên gì vậy?"'}
                  charName="Yuki"
                  userName="Minh"
                />
              </div>
            </Showcase>
          </div>
        </Section>

        {/* MessageBubble */}
        <Section title="MessageBubble">
          <div className="space-y-2 max-w-lg">
            <Showcase label="System Message">
              <MessageBubble message={MOCK_MESSAGES[0]} />
            </Showcase>
            <Showcase label="Assistant Message">
              <MessageBubble
                message={MOCK_MESSAGES[1]}
                characterName="Yuki"
                characterAvatar="Y"
              />
            </Showcase>
            <Showcase label="User Message">
              <MessageBubble message={MOCK_MESSAGES[2]} />
            </Showcase>
            <Showcase label="Assistant with Code Block">
              <MessageBubble
                message={MOCK_MESSAGES[3]}
                characterName="Yuki"
                characterAvatar="Y"
                isLastAssistant={true}
                onRegenerate={() => {}}
                onBranch={() => {}}
              />
            </Showcase>
            <Showcase label="User /cmd Prefix">
              <MessageBubble message={MOCK_MESSAGES[4]} isLastUser={true} onEdit={() => {}} />
            </Showcase>
            <Showcase label="Streaming">
              <MessageBubble
                message={{ id: "s1", role: "assistant", content: "Đang suy nghĩ...", timestamp: now }}
                characterName="Yuki"
                characterAvatar="Y"
                isStreaming={true}
              />
            </Showcase>
          </div>
        </Section>

        {/* TypingIndicator */}
        <Section title="TypingIndicator">
          <div className="flex flex-wrap gap-6">
            <Showcase label="Default">
              <TypingIndicator />
            </Showcase>
            <Showcase label="Custom Avatar & Text">
              <TypingIndicator avatarChar="Y" text="đang suy nghĩ" />
            </Showcase>
          </div>
        </Section>

        {/* ChatInput */}
        <Section title="ChatInput">
          <div className="space-y-4">
            <Showcase label="Authenticated (try typing /)">
              <div className="max-w-lg">
                <ChatInput
                  onSend={(msg) => console.log("send:", msg)}
                  disabled={chatDisabled}
                  isAuthenticated={true}
                />
              </div>
            </Showcase>
            <Showcase label="Not Authenticated">
              <div className="max-w-lg">
                <ChatInput
                  onSend={() => {}}
                  isAuthenticated={false}
                  onAuthRequired={() => alert("Navigate to /auth")}
                />
              </div>
            </Showcase>
            <Showcase label="Disabled">
              <div className="max-w-lg">
                <ChatInput
                  onSend={() => {}}
                  disabled={true}
                  isAuthenticated={true}
                />
              </div>
            </Showcase>
          </div>
        </Section>

        {/* NsfwToggle */}
        <Section title="NsfwToggle">
          <div className="flex flex-wrap gap-6">
            <Showcase label="Default">
              <NsfwToggle />
            </Showcase>
            <Showcase label="Custom Label">
              <NsfwToggle
                label="Hiện nội dung 18+"
                description="Bật để xem nhân vật NSFW"
              />
            </Showcase>
          </div>
        </Section>

        {/* CharGenAssistant */}
        <Section title="CharGenAssistant">
          <Showcase label="Click button in header to toggle (or use below)">
            <button
              onClick={() => setShowCharGen(!showCharGen)}
              className="px-4 py-2 rounded-lg text-sm bg-neon-purple/10 border border-neon-purple/30 text-neon-purple hover:bg-neon-purple/20 transition-colors"
            >
              {showCharGen ? "Hide" : "Show"} CharGenAssistant
            </button>
            <p className="text-xs text-muted-foreground mt-2">
              Component renders as a fixed-position overlay (bottom-right corner)
            </p>
          </Showcase>
        </Section>

        {/* CreatePageHeader */}
        <Section title="CreatePageHeader">
          <Showcase label="Default">
            <CreatePageHeader
              icon={<Wand2 size={16} className="text-white" />}
              title="Tạo nhân vật mới"
              subtitle="Tạo card nhân vật cho VietRP"
              rightActions={
                <button className="px-3 py-1.5 rounded-lg text-xs bg-neon-blue/10 text-neon-blue border border-neon-blue/30">
                  Lưu
                </button>
              }
            />
          </Showcase>
        </Section>

        {/* AppFooter */}
        <Section title="AppFooter">
          <Showcase label="Default">
            <AppFooter />
          </Showcase>
        </Section>

        {/* Props Interfaces */}
        <Section title="Exported Props Interfaces">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {[
              "CharacterCardProps",
              "ChatInputProps",
              "RoleplayMessageProps",
              "MessageBubbleProps",
              "TypingIndicatorProps",
              "CharGenAssistantProps",
              "NsfwToggleProps",
              "CreatePageHeaderProps",
              "ChatHeaderProps",
              "ChatSidebarProps",
              "CharacterPreviewDialogProps",
              "ModelComboboxProps",
              "TierSelectorProps",
              "GenerationSettingsProps",
              "AiCharGenContentProps",
            ].map((name) => (
              <Badge
                key={name}
                variant="outline"
                className="justify-start font-mono text-xs py-1.5 px-3"
              >
                {name}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Import from <code className="px-1.5 py-0.5 rounded bg-oled-elevated border border-oled-border text-neon-blue font-mono text-[0.9em]">{"@/components"}</code>
          </p>
        </Section>
      </div>

      {/* CharGenAssistant overlay */}
      <CharGenAssistant
        visible={showCharGen}
        onSelectSuggestion={(prompt) => {
          console.log("Selected:", prompt);
          setShowCharGen(false);
        }}
      />
    </div>
  );
};

export default ComponentShowcase;
