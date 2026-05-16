import { forwardRef, ButtonHTMLAttributes, ElementType } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const iconButtonVariants = cva(
  "inline-flex items-center justify-center rounded-xl transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-neon-purple/50 disabled:opacity-40 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        ghost: "hover:bg-oled-elevated",
        outline: "border border-gray-border hover:border-neon-purple/30 hover:bg-oled-elevated",
        solid: "bg-neon-purple text-white hover:bg-neon-purple/80 shadow-neon-purple",
      },
      color: {
        default: "",
        purple: "",
        blue: "",
        rose: "",
        green: "",
        amber: "",
        red: "",
      },
      size: {
        sm: "min-w-[36px] min-h-[36px] w-9 h-9",
        md: "min-w-[44px] min-h-[44px] w-11 h-11",
      },
    },
    compoundVariants: [
      // Ghost color variants
      { variant: "ghost", color: "purple", className: "text-neon-purple hover:bg-neon-purple/10" },
      { variant: "ghost", color: "blue", className: "text-neon-blue hover:bg-neon-blue/10" },
      { variant: "ghost", color: "rose", className: "text-neon-rose hover:bg-neon-rose/10" },
      { variant: "ghost", color: "green", className: "text-neon-green hover:bg-neon-green/10" },
      { variant: "ghost", color: "amber", className: "text-amber-400 hover:bg-amber-500/10" },
      { variant: "ghost", color: "red", className: "text-red-400 hover:bg-red-500/10" },
      { variant: "ghost", color: "default", className: "text-muted-foreground hover:text-foreground" },
      // Outline color variants
      { variant: "outline", color: "purple", className: "text-neon-purple border-neon-purple/30" },
      { variant: "outline", color: "blue", className: "text-neon-blue border-neon-blue/30" },
      { variant: "outline", color: "rose", className: "text-neon-rose border-neon-rose/30" },
      { variant: "outline", color: "green", className: "text-neon-green border-neon-green/30" },
      { variant: "outline", color: "default", className: "text-muted-foreground" },
    ],
    defaultVariants: {
      variant: "ghost",
      color: "default",
      size: "md",
    },
  },
);

interface AdminIconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  icon: ElementType;
  label: string;
}

const AdminIconButton = forwardRef<HTMLButtonElement, AdminIconButtonProps>(
  ({ icon: Icon, label, variant, color, size, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        aria-label={label}
        className={cn(iconButtonVariants({ variant, color, size }), className)}
        {...props}
      >
        <Icon size={size === "sm" ? 16 : 18} />
      </button>
    );
  },
);

AdminIconButton.displayName = "AdminIconButton";

export { AdminIconButton, iconButtonVariants };
export type { AdminIconButtonProps };
