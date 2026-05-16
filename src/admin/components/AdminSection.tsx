import { forwardRef, ReactNode, ElementType } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AdminSectionProps {
  icon?: ElementType;
  title: string;
  description?: string;
  badge?: { label: string; color?: string };
  headerAction?: ReactNode;
  children: ReactNode;
  dotColor?: string;
  className?: string;
}

const AdminSection = forwardRef<HTMLDivElement, AdminSectionProps>(
  (
    {
      icon: Icon,
      title,
      description,
      badge,
      headerAction,
      children,
      dotColor = "bg-neon-purple",
      className,
    },
    ref,
  ) => {
    return (
      <Card ref={ref} className={cn("bg-oled-surface border-gray-border", className)}>
        <CardHeader className="p-5 pb-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={cn("w-2 h-2 rounded-full shrink-0", dotColor)} />
              {Icon && <Icon size={16} className="text-muted-foreground shrink-0" />}
              <CardTitle className="text-base font-semibold text-foreground truncate">
                {title}
              </CardTitle>
              {badge && (
                <span
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0",
                    badge.color || "bg-neon-purple/15 text-neon-purple",
                  )}
                >
                  {badge.label}
                </span>
              )}
            </div>
            {headerAction && (
              <div className="shrink-0">{headerAction}</div>
            )}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground mt-1.5 ml-4.5">{description}</p>
          )}
        </CardHeader>
        <CardContent className="p-5 space-y-4">{children}</CardContent>
      </Card>
    );
  },
);

AdminSection.displayName = "AdminSection";

export { AdminSection };
export type { AdminSectionProps };
