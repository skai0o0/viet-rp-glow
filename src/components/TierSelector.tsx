import { useState, useEffect } from "react";
import { Loader2, Zap, Crown, Sparkles, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchModelTiers, type ModelTier } from "@/services/openRouter";

interface TierSelectorProps {
  value: string;
  onValueChange: (tierKey: string) => void;
  userTier?: string;
}

const TIER_ICONS: Record<string, React.ElementType> = {
  free: Zap,
  pro: Crown,
  ultra: Sparkles,
};

const TIER_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  free: {
    bg: "bg-neon-blue/10",
    border: "border-neon-blue/30",
    text: "text-neon-blue",
    glow: "hover:shadow-[0_0_12px_rgba(59,130,246,0.15)]",
  },
  pro: {
    bg: "bg-neon-purple/10",
    border: "border-neon-purple/30",
    text: "text-neon-purple",
    glow: "hover:shadow-[0_0_12px_rgba(168,85,247,0.15)]",
  },
  ultra: {
    bg: "bg-neon-rose/10",
    border: "border-neon-rose/30",
    text: "text-neon-rose",
    glow: "hover:shadow-[0_0_12px_rgba(244,63,94,0.15)]",
  },
};

const DEFAULT_COLOR = TIER_COLORS.free;

const TierSelector = ({ value, onValueChange, userTier = "free" }: TierSelectorProps) => {
  const [tiers, setTiers] = useState<ModelTier[]>([]);
  const [loading, setLoading] = useState(true);

  const isFreeUser = userTier === "free";

  useEffect(() => {
    fetchModelTiers()
      .then(setTiers)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 size={18} className="animate-spin text-neon-purple" />
      </div>
    );
  }

  if (tiers.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-4">
        Chưa có tier nào được cấu hình.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tiers.map((tier) => {
        const isSelected = value === tier.tier_key;
        const isLocked = isFreeUser && tier.min_subscription !== "free";
        const colors = TIER_COLORS[tier.tier_key] || DEFAULT_COLOR;
        const Icon = TIER_ICONS[tier.tier_key] || Zap;

        return (
          <button
            key={tier.id}
            type="button"
            disabled={isLocked}
            onClick={() => !isLocked && onValueChange(tier.tier_key)}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-200",
              isSelected
                ? `${colors.bg} ${colors.border} ring-1 ring-inset ${colors.border}`
                : "bg-oled-elevated border-gray-border",
              isLocked
                ? "opacity-40 cursor-not-allowed"
                : `cursor-pointer ${colors.glow} hover:border-opacity-60`,
            )}
          >
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                isSelected ? colors.bg : "bg-oled-surface",
              )}
            >
              {isLocked ? (
                <Lock size={18} className="text-muted-foreground" />
              ) : (
                <Icon size={18} className={isSelected ? colors.text : "text-muted-foreground"} />
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-sm font-semibold",
                    isSelected ? colors.text : "text-foreground",
                  )}
                >
                  {tier.display_name}
                </span>
                {tier.min_subscription !== "free" && (
                  <span className="text-[9px] font-bold bg-neon-purple/20 text-neon-purple px-1.5 py-0.5 rounded-full">
                    PRO
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground truncate">{tier.description}</p>
            </div>
            {isSelected && (
              <div className={cn("w-2 h-2 rounded-full shrink-0", colors.text.replace("text-", "bg-"))} />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default TierSelector;
