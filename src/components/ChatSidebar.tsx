import { MessageSquare, Plus, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { sampleCharacters } from "@/data/mockData";
import { CharacterCard } from "@/types/character";

interface ChatSidebarProps {
  open: boolean;
  onClose: () => void;
  activeCharacter: CharacterCard;
  onSelectCharacter: (char: CharacterCard) => void;
}

const ChatSidebar = ({ open, onClose, activeCharacter, onSelectCharacter }: ChatSidebarProps) => {
  return (
    <>
      {/* Overlay for mobile */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed md:relative z-50 w-[280px] h-full bg-oled-surface border-r border-gray-border flex flex-col"
          >
            {/* Sidebar header */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-gray-border flex-shrink-0">
              <h1 className="text-sm font-bold">
                <span className="text-neon-blue neon-text-blue">Viet</span>
                <span className="text-neon-purple neon-text-purple">RP</span>
              </h1>
              <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-oled-elevated transition-colors md:hidden">
                <X size={18} />
              </button>
            </div>

            {/* New chat button */}
            <div className="p-3">
              <button className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-border text-sm text-muted-foreground hover:text-foreground hover:border-neon-purple/50 hover:shadow-neon-purple transition-all duration-300">
                <Plus size={16} />
                <span>Cuộc trò chuyện mới</span>
              </button>
            </div>

            {/* Character list */}
            <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-2 mb-2">
                Nhân vật
              </p>
              {sampleCharacters.map((char) => (
                <button
                  key={char.name}
                  onClick={() => {
                    onSelectCharacter(char);
                    onClose();
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 mb-1 ${
                    activeCharacter.name === char.name
                      ? "bg-oled-elevated border border-neon-purple/20"
                      : "hover:bg-oled-elevated"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
                    activeCharacter.name === char.name
                      ? "bg-neon-purple/20 text-neon-purple border border-neon-purple/30"
                      : "bg-oled-elevated text-muted-foreground"
                  }`}>
                    {char.avatar}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{char.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{char.tags.join(" · ")}</p>
                  </div>
                  <MessageSquare size={14} className="text-muted-foreground flex-shrink-0 ml-auto" />
                </button>
              ))}
            </div>

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
