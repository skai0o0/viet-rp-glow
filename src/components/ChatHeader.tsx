import { Circle, ChevronDown, GitBranch } from "lucide-react";
import { CharacterCard } from "@/types/character";
import { replaceMacros } from "@/utils/promptBuilder";
import { getCachedUserPersona } from "@/services/profileDb";
import { DbChatSession } from "@/services/chatDb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

interface ChatHeaderProps {
  character: CharacterCard;
  onToggleSidebar: () => void;
  onNewChat?: () => void;
  sessions?: DbChatSession[];
  activeSessionId?: string | null;
  onSelectSession?: (sessionId: string) => void;
  onNameClick?: () => void;
}

const ChatHeader = ({
  character,
  onNewChat,
  sessions = [],
  activeSessionId,
  onSelectSession,
  onNameClick,
}: ChatHeaderProps) => {
  // Filter sessions for current character (already filtered in parent usually)
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const sessionCount = sessions.length;

  return (
    <header className="h-14 flex items-center bg-oled-base flex-shrink-0">
      <div className="flex items-center gap-3">
        {character.avatar && character.avatar.startsWith("http") ? (
          <img
            src={character.avatar}
            alt={character.name}
            className="w-8 h-8 rounded-full object-cover border border-neon-purple/30"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-oled-surface flex items-center justify-center text-neon-purple text-sm font-semibold border border-neon-purple/30">
            {character.avatar || character.name?.charAt(0) || "AI"}
          </div>
        )}
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-semibold text-foreground cursor-pointer hover:text-primary transition-colors" onClick={onNameClick}>{character.name}</h2>

            {/* Branch switcher dropdown */}
            {sessionCount > 1 && onSelectSession && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] text-muted-foreground bg-oled-elevated border border-gray-border hover:border-neon-purple/40 hover:text-neon-purple transition-colors">
                    <GitBranch size={10} />
                    <span>{sessionCount}</span>
                    <ChevronDown size={10} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-64 bg-oled-surface border-gray-border z-[100]"
                >
                  <DropdownMenuLabel className="text-[11px] text-muted-foreground font-normal">
                    Nhánh trò chuyện
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-gray-border" />
                  <div className="max-h-60 overflow-y-auto scrollbar-thin">
                    {sessions.map((session) => {
                      const isActive = session.id === activeSessionId;
                      const date = new Date(session.created_at).toLocaleDateString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      return (
                        <DropdownMenuItem
                          key={session.id}
                          onClick={() => onSelectSession(session.id)}
                          className={`flex items-center gap-2 cursor-pointer ${
                            isActive
                              ? "bg-neon-purple/10 text-neon-purple"
                              : "text-foreground hover:bg-oled-elevated"
                          }`}
                        >
                          <GitBranch size={12} className={isActive ? "text-neon-purple" : "text-muted-foreground"} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">
                              {session.title || "Cuộc trò chuyện"}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{date}</p>
                          </div>
                          {isActive && (
                            <div className="w-1.5 h-1.5 rounded-full bg-neon-purple shrink-0" />
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <Circle
              size={6}
              className="fill-neon-purple text-neon-purple shrink-0"
              style={{ filter: "drop-shadow(0 0 4px rgba(176, 38, 255, 0.6))" }}
            />
            <span className="text-[10px] text-muted-foreground truncate max-w-[120px] sm:max-w-[200px] md:max-w-[50vw]">
              {replaceMacros(character.description || "Đang hoạt động", character.name, getCachedUserPersona().displayName || "User")}
            </span>
          </div>
        </div>
      </div>

    </header>
  );
};

export default ChatHeader;
