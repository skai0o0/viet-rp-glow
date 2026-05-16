type BtnColor = "purple" | "blue" | "rose" | "green" | "amber" | "red";
type BtnVariant = "solid" | "outline" | "ghost";
type BtnSize = "sm" | "md";

const COLOR_MAP: Record<BtnColor, { solid: string; outline: string; ghost: string }> = {
  purple: {
    solid: "bg-neon-purple text-white hover:bg-neon-purple/80 shadow-neon-purple",
    outline: "bg-neon-purple/10 text-neon-purple border border-neon-purple/30 hover:bg-neon-purple/20",
    ghost: "text-neon-purple hover:bg-neon-purple/10",
  },
  blue: {
    solid: "bg-neon-blue text-black hover:bg-neon-blue/80 shadow-neon-blue",
    outline: "bg-neon-blue/10 text-neon-blue border border-neon-blue/30 hover:bg-neon-blue/20",
    ghost: "text-neon-blue hover:bg-neon-blue/10",
  },
  rose: {
    solid: "bg-neon-rose text-white hover:bg-neon-rose/80",
    outline: "bg-neon-rose/10 text-neon-rose border border-neon-rose/30 hover:bg-neon-rose/20",
    ghost: "text-neon-rose hover:bg-neon-rose/10",
  },
  green: {
    solid: "bg-neon-green text-black hover:bg-neon-green/80",
    outline: "bg-neon-green/10 text-neon-green border border-neon-green/30 hover:bg-neon-green/20",
    ghost: "text-neon-green hover:bg-neon-green/10",
  },
  amber: {
    solid: "bg-amber-500 text-black hover:bg-amber-500/80",
    outline: "bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20",
    ghost: "text-amber-400 hover:bg-amber-500/10",
  },
  red: {
    solid: "bg-red-500 text-white hover:bg-red-500/80",
    outline: "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20",
    ghost: "text-red-400 hover:bg-red-500/10",
  },
};

const SIZE_MAP: Record<BtnSize, string> = {
  sm: "px-2.5 py-1.5 text-xs rounded-lg",
  md: "px-4 py-2 text-sm rounded-xl",
};

export function adminBtn(
  color: BtnColor = "purple",
  variant: BtnVariant = "outline",
  size: BtnSize = "md",
): string {
  return [
    "font-medium transition-all duration-200 inline-flex items-center justify-center gap-2",
    COLOR_MAP[color][variant],
    SIZE_MAP[size],
  ].join(" ");
}
