import { motion } from "framer-motion";
import { CharacterSummary } from "@/services/characterDb";

interface CharacterCardProps {
  character: CharacterSummary;
  onClick?: () => void;
}

const CharacterCard = ({ character, onClick }: CharacterCardProps) => {
  const initial = character.name?.charAt(0)?.toUpperCase() || "?";

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="bg-oled-surface rounded-2xl border border-gray-border overflow-hidden cursor-pointer hover:shadow-neon-purple hover:border-secondary hover:scale-[1.02] transition-all duration-200"
      onClick={onClick}
    >
      {/* Image Section */}
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {character.avatar_url ? (
          <img
            src={character.avatar_url}
            alt={character.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-oled-elevated to-oled-base flex items-center justify-center">
            <span className="text-4xl font-bold text-secondary">{initial}</span>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="p-4">
        <h3 className="text-lg font-bold text-foreground truncate">
          {character.name}
        </h3>
        {character.short_summary && (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
            {character.short_summary}
          </p>
        )}
        {character.tags && character.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {character.tags.slice(0, 5).map((tag) => (
              <span
                key={tag}
                className="text-xs bg-oled-elevated text-primary rounded-full px-2 py-1"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default CharacterCard;
