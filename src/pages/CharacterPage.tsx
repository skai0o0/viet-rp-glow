import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Send,
  Share2,
  Heart,
  Star,
  MessageSquare,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { getCharacterById, DbCharacter } from "@/services/characterDb";
import { replaceMacros } from "@/utils/promptBuilder";
import { getCachedUserPersona } from "@/services/profileDb";
import { toggleFavorite, getFavoritedIds } from "@/services/favoriteDb";
import { rateCharacter, getMyRating } from "@/services/ratingDb";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

const CharacterPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [character, setCharacter] = useState<DbCharacter | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getCharacterById(id)
      .then((c) => {
        if (!c.is_public) {
          setNotFound(true);
        } else {
          setCharacter(c);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id || !user) return;
    getFavoritedIds().then((ids) => setIsFav(ids.has(id))).catch(() => {});
    getMyRating(id).then(setMyRating).catch(() => {});
  }, [id, user]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-oled-base">
        <Loader2 size={28} className="animate-spin text-neon-purple" />
      </div>
    );
  }

  if (notFound || !character) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-oled-base text-muted-foreground gap-4">
        <p className="text-lg">Nhan vat khong ton tai hoac khong cong khai.</p>
        <Button variant="outline" onClick={() => navigate("/")} className="border-gray-border">
          <ArrowLeft size={14} className="mr-2" /> Ve trang chu
        </Button>
      </div>
    );
  }

  const initial = character.name?.charAt(0)?.toUpperCase() || "?";
  const persona = getCachedUserPersona().displayName;
  const displayRating = hoverRating || myRating;

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Da copy link chia se!");
    } catch {
      toast.error("Khong the copy link");
    }
  };

  const handleFav = async () => {
    if (!user) {
      toast.error("Dang nhap de yeu thich nhan vat");
      return;
    }
    const newState = await toggleFavorite(character.id);
    setIsFav(newState);
  };

  const handleRate = async (value: number) => {
    if (!user) {
      toast.error("Dang nhap de danh gia");
      return;
    }
    await rateCharacter(character.id, value);
    setMyRating(value);
    toast.success("Da danh gia!");
  };

  return (
    <div className="flex-1 flex flex-col bg-oled-base overflow-y-auto scrollbar-thin">
      {/* Hero image */}
      <div className="relative w-full max-h-[50vh] aspect-[3/2] overflow-hidden bg-gradient-to-br from-oled-elevated to-oled-base">
        {character.avatar_url ? (
          <img
            src={character.avatar_url}
            alt={character.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-8xl font-bold text-secondary/30">{initial}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-oled-base via-transparent to-transparent" />

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-oled-base/70 backdrop-blur border border-gray-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
      </div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto w-full px-4 sm:px-6 -mt-16 relative z-10 pb-16 space-y-6"
      >
        {/* Name + stats */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">{character.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              boi {character.creator || "Unknown"} · v{character.character_version || "1.0"}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <MessageSquare size={14} className="text-neon-blue" />
              {formatCount(character.message_count ?? 0)}
            </span>
            {(character.rating ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-sm text-yellow-500">
                <Star size={14} className="fill-yellow-500" />
                {Number(character.rating).toFixed(1)}
              </span>
            )}
          </div>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => handleRate(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-0.5 transition-transform hover:scale-125"
            >
              <Star
                size={20}
                className={
                  star <= displayRating
                    ? "fill-yellow-500 text-yellow-500"
                    : "text-gray-600"
                }
              />
            </button>
          ))}
          <span className="text-xs text-muted-foreground ml-2">
            {myRating > 0 ? `Ban da danh gia ${myRating} sao` : "Danh gia nhan vat nay"}
          </span>
        </div>

        {/* Tags */}
        {character.tags && character.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {character.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-oled-surface text-primary rounded-full px-3 py-1 border border-gray-border"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        {character.description && (
          <div className="bg-oled-surface border border-gray-border rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Mo ta
            </h3>
            <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
              {replaceMacros(character.description, character.name, persona)}
            </p>
          </div>
        )}

        {/* Personality */}
        {character.personality && (
          <div className="bg-oled-surface border border-gray-border rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Tinh cach
            </h3>
            <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
              {replaceMacros(character.personality, character.name, persona)}
            </p>
          </div>
        )}

        {/* Scenario */}
        {character.scenario && (
          <div className="bg-oled-surface border border-gray-border rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Boi canh
            </h3>
            <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
              {replaceMacros(character.scenario, character.name, persona)}
            </p>
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={() => navigate(`/chat/${character.id}`)}
            className="flex-1 bg-neon-purple text-white hover:bg-neon-purple/80 hover:shadow-neon-purple h-11 text-sm font-semibold"
          >
            <Send size={16} className="mr-2" />
            Chat ngay
          </Button>
          <button
            onClick={handleFav}
            className={`w-11 h-11 rounded-xl border flex items-center justify-center transition-colors ${
              isFav
                ? "border-neon-rose/40 bg-neon-rose/10 text-neon-rose"
                : "border-gray-border text-muted-foreground hover:border-neon-rose/40 hover:text-neon-rose"
            }`}
          >
            <Heart size={18} className={isFav ? "fill-neon-rose" : ""} />
          </button>
          <button
            onClick={handleShare}
            className="w-11 h-11 rounded-xl border border-gray-border text-muted-foreground flex items-center justify-center hover:border-neon-blue/40 hover:text-neon-blue transition-colors"
          >
            <Share2 size={18} />
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default CharacterPage;
