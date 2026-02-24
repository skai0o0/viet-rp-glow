import { useState } from "react";
import { motion } from "framer-motion";
import { MessageSquare, Star } from "lucide-react";
import { CharacterSummary } from "@/services/characterDb";
import { isCharacterNsfw } from "@/utils/nsfwFilter";
import { Badge } from "@/components/ui/badge";

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

interface CharacterCardProps {
  character: CharacterSummary;
  onClick?: () => void;
}

const CharacterCard = ({ character, onClick }: CharacterCardProps) => {
  const initial = character.name?.charAt(0)?.toUpperCase() || "?";
  const nsfw = isCharacterNsfw(character);
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="bg-oled-surface rounded-xl sm:rounded-2xl border border-gray-border overflow-hidden cursor-pointer hover:shadow-neon-purple hover:border-secondary hover:scale-[1.02] transition-all duration-200 h-[260px] sm:h-[280px] flex flex-col"
      onClick={onClick}
    >
      {/* Image Section */}
      <div className="relative aspect-[4/3] w-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-oled-elevated to-oled-base">
        {character.avatar_url ? (
          <>
            {/* Placeholder shown until image loads */}
            {!imgLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-4xl font-bold text-secondary/30">{initial}</span>
              </div>
            )}
            <img
              src={character.avatar_url}
              alt={character.name}
              className={`w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl font-bold text-secondary">{initial}</span>
          </div>
        )}
        {nsfw && (
          <Badge className="absolute bottom-2 right-2 bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5 font-bold uppercase tracking-wider">
            NSFW
          </Badge>
        )}
      </div>

      {/* Info Section */}
      <div className="p-2 sm:p-3 flex-1 min-h-0 overflow-hidden flex flex-col">
        <h3 className="text-sm sm:text-base font-bold text-foreground truncate">
          {character.name}
        </h3>
        {character.short_summary && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {character.short_summary}
          </p>
        )}

        <div className="mt-auto flex items-end justify-between gap-1 pt-1.5">
          {character.tags && character.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1 min-w-0 overflow-hidden">
              {character.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] sm:text-xs bg-oled-elevated text-primary rounded-full px-1.5 py-0.5 truncate max-w-[72px]"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : <div />}

          <div className="flex items-center gap-2 shrink-0">
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <MessageSquare size={10} className="text-neon-blue/60" />
              {formatCount(character.message_count ?? 0)}
            </span>
            {(character.rating ?? 0) > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-yellow-500/80">
                <Star size={10} className="fill-yellow-500/80" />
                {Number(character.rating).toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default CharacterCard;
