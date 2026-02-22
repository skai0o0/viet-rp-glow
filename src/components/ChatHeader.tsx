import { Settings, Circle } from "lucide-react";
import { CharacterCard } from "@/types/character";

interface ChatHeaderProps {
  character: CharacterCard;
  onToggleSidebar: () => void;
}

const ChatHeader = ({ character }: ChatHeaderProps) => {
  return (
    <header className="h-14 flex items-center justify-between pr-4 md:pr-6 bg-oled-base flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-oled-surface flex items-center justify-center text-neon-purple text-sm font-semibold border border-neon-purple/30">
          {character.avatar}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{character.name}</h2>
          <div className="flex items-center gap-1.5">
            <Circle size={6} className="fill-neon-purple text-neon-purple" style={{ filter: "drop-shadow(0 0 4px rgba(176, 38, 255, 0.6))" }} />
            <span className="text-[10px] text-muted-foreground">Đang hoạt động</span>
          </div>
        </div>
      </div>

      <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-oled-surface transition-colors">
        <Settings size={18} />
      </button>
    </header>
  );
};

export default ChatHeader;
