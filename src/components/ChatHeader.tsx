import { Circle, Plus } from "lucide-react";
import { CharacterCard } from "@/types/character";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ChatHeaderProps {
  character: CharacterCard;
  onToggleSidebar: () => void;
  onNewChat?: () => void;
}

const ChatHeader = ({ character, onNewChat }: ChatHeaderProps) => {
  return (
    <header className="h-14 flex items-center justify-between pr-4 md:pr-6 bg-oled-base flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-oled-surface flex items-center justify-center text-neon-purple text-sm font-semibold border border-neon-purple/30">
          {character.avatar}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{character.name}</h2>
          <div className="flex items-center gap-1.5">
            <Circle
              size={6}
              className="fill-neon-purple text-neon-purple"
              style={{ filter: "drop-shadow(0 0 4px rgba(176, 38, 255, 0.6))" }}
            />
            <span className="text-[10px] text-muted-foreground">Đang hoạt động</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {onNewChat && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onNewChat}
                className="text-muted-foreground hover:text-neon-purple hover:bg-oled-surface h-8 w-8"
              >
                <Plus size={18} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Chat mới</TooltipContent>
          </Tooltip>
        )}
      </div>
    </header>
  );
};

export default ChatHeader;
