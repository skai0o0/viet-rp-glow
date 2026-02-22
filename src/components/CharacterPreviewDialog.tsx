import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send } from "lucide-react";
import { CharacterSummary } from "@/services/characterDb";

interface CharacterPreviewDialogProps {
  character: CharacterSummary | null;
  onClose: () => void;
}

const CharacterPreviewDialog = ({ character, onClose }: CharacterPreviewDialogProps) => {
  const navigate = useNavigate();

  if (!character) return null;

  const initial = character.name?.charAt(0)?.toUpperCase() || "?";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xl flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="relative w-full max-w-md max-h-[90vh] overflow-y-auto scrollbar-thin rounded-2xl border border-gray-border bg-oled-surface shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="sticky top-3 ml-auto mr-3 z-10 w-8 h-8 rounded-full bg-oled-base/80 border border-gray-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>

          {/* Avatar Image */}
          <div className="relative w-full aspect-square overflow-hidden -mt-8">
            {character.avatar_url ? (
              <img src={character.avatar_url} alt={character.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-oled-elevated to-oled-base flex items-center justify-center">
                <span className="text-7xl font-bold text-secondary">{initial}</span>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-oled-surface to-transparent" />
          </div>

          {/* Info */}
          <div className="p-5 -mt-10 relative space-y-4">
            <h2 className="text-2xl font-bold text-foreground">{character.name}</h2>

            {character.description && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Mô tả</h4>
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                  {character.description}
                </p>
              </div>
            )}

            {character.short_summary && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Tóm tắt</h4>
                <p className="text-sm text-foreground/80 leading-relaxed">
                  {character.short_summary}
                </p>
              </div>
            )}

            {character.tags && character.tags.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {character.tags.map((tag) => (
                    <span key={tag} className="text-xs bg-oled-elevated text-primary rounded-full px-3 py-1 border border-gray-border">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Chat button */}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => navigate(`/chat/${character.id}`)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-neon-purple text-white font-medium text-sm hover:bg-neon-purple/80 hover:shadow-neon-purple transition-all duration-200"
              >
                Chat
                <Send size={16} />
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CharacterPreviewDialog;
