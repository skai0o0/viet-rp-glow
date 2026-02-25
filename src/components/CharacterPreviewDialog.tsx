import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Heart, Star, Share2, MessageSquare } from "lucide-react";
import { replaceMacros } from "@/utils/promptBuilder";
import { getCachedUserPersona } from "@/services/profileDb";
import { CharacterSummary } from "@/services/characterDb";
import { toggleFavorite } from "@/services/favoriteDb";
import { rateCharacter, getMyRating } from "@/services/ratingDb";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

interface CharacterPreviewDialogProps {
  character: CharacterSummary | null;
  onClose: () => void;
  isFavorited?: boolean;
  onFavoriteToggle?: (id: string, newState: boolean) => void;
}

const CharacterPreviewDialog = ({
  character,
  onClose,
  isFavorited,
  onFavoriteToggle,
}: CharacterPreviewDialogProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [myRating, setMyRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  useEffect(() => {
    if (character && user) {
      getMyRating(character.id).then(setMyRating).catch(() => {});
    }
  }, [character, user]);

  if (!character) return null;

  const initial = character.name?.charAt(0)?.toUpperCase() || "?";

  const handleFav = async () => {
    if (favLoading) return;
    setFavLoading(true);
    try {
      const newState = await toggleFavorite(character.id);
      onFavoriteToggle?.(character.id, newState);
    } catch {
      toast.error("Đăng nhập để yêu thích nhân vật");
    } finally {
      setFavLoading(false);
    }
  };

  const handleRate = async (value: number) => {
    if (!user) {
      toast.error("Đăng nhập để đánh giá");
      return;
    }
    if (ratingLoading) return;
    setRatingLoading(true);
    try {
      await rateCharacter(character.id, value);
      setMyRating(value);
      toast.success("Đã đánh giá!");
    } catch {
      toast.error("Không thể đánh giá");
    } finally {
      setRatingLoading(false);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/character/${character.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Đã copy link chia sẻ!");
    } catch {
      toast.error("Không thể copy link");
    }
  };

  const displayRating = hoverRating || myRating;

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
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-2xl font-bold text-foreground">{character.name}</h2>
              <div className="flex items-center gap-1.5 shrink-0 mt-1">
                <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                  <MessageSquare size={12} className="text-neon-blue/60" />
                  {formatCount(character.message_count ?? 0)}
                </span>
              </div>
            </div>

            {/* Star rating */}
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleRate(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-0.5 transition-transform hover:scale-125"
                  disabled={ratingLoading}
                >
                  <Star
                    size={18}
                    className={
                      star <= displayRating
                        ? "fill-yellow-500 text-yellow-500"
                        : "text-gray-600"
                    }
                  />
                </button>
              ))}
              {(character.rating ?? 0) > 0 && (
                <span className="text-xs text-muted-foreground ml-1">
                  {Number(character.rating).toFixed(1)}
                </span>
              )}
            </div>

            {character.description && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Mo ta</h4>
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                  {replaceMacros(character.description, character.name, getCachedUserPersona().displayName)}
                </p>
              </div>
            )}

            {character.short_summary && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Tom tat</h4>
                <p className="text-sm text-foreground/80 leading-relaxed">
                  {replaceMacros(character.short_summary, character.name, getCachedUserPersona().displayName)}
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

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                {onFavoriteToggle && (
                  <button
                    onClick={handleFav}
                    disabled={favLoading}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-gray-border text-sm hover:border-neon-rose/40 hover:bg-neon-rose/10 transition-colors"
                  >
                    <Heart
                      size={14}
                      className={isFavorited ? "fill-neon-rose text-neon-rose" : "text-muted-foreground"}
                    />
                  </button>
                )}
                <button
                  onClick={handleShare}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-gray-border text-sm text-muted-foreground hover:border-neon-blue/40 hover:text-neon-blue hover:bg-neon-blue/10 transition-colors"
                >
                  <Share2 size={14} />
                </button>
              </div>
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
