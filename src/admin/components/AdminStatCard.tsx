import { forwardRef, ElementType } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface AdminStatCardProps {
  icon: ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  delay?: number;
  size?: "sm" | "lg";
  className?: string;
}

const AdminStatCard = forwardRef<HTMLDivElement, AdminStatCardProps>(
  ({ icon: Icon, label, value, sub, color, delay = 0, size = "sm", className }, ref) => {
    const isLg = size === "lg";

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay }}
      >
        <Card
          ref={ref}
          className={cn(
            "bg-oled-surface border-gray-border transition-all duration-200 hover:border-neon-purple/20",
            className,
          )}
        >
          <CardContent className={cn("p-4", isLg ? "p-5" : "p-3")}>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "rounded-xl flex items-center justify-center shrink-0",
                  isLg ? "w-11 h-11" : "w-9 h-9",
                  color.replace("text-", "bg-") + "/10",
                )}
              >
                <Icon size={isLg ? 20 : 16} className={color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("font-bold text-foreground", isLg ? "text-2xl" : "text-lg")}>
                  {value}
                </p>
                <p className="text-xs text-muted-foreground truncate">{label}</p>
                {sub && isLg && (
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  },
);

AdminStatCard.displayName = "AdminStatCard";

export { AdminStatCard };
export type { AdminStatCardProps };
