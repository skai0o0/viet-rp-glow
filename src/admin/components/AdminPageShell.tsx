import { ReactNode, ElementType } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface AdminPageShellProps {
  backTo?: string;
  icon: ElementType;
  iconGradient?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  headerExtra?: ReactNode;
  children: ReactNode;
  maxWidth?: string;
  className?: string;
}

const AdminPageShell = ({
  backTo,
  icon: Icon,
  iconGradient = "bg-gradient-to-br from-neon-blue to-neon-purple",
  title,
  subtitle,
  actions,
  headerExtra,
  children,
  maxWidth = "max-w-5xl",
  className,
}: AdminPageShellProps) => {
  return (
    <ScrollArea className="flex-1">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className={cn(
          "p-4 md:p-8 mx-auto w-full space-y-6 pb-24",
          maxWidth,
          className,
        )}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-30 bg-oled-base/80 backdrop-blur-xl -mx-4 md:-mx-8 px-4 md:px-8 pt-4 pb-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {backTo && (
                <Link
                  to={backTo}
                  className="h-11 w-11 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-oled-elevated transition-colors shrink-0"
                >
                  <ArrowLeft size={20} />
                </Link>
              )}
              <div
                className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                  iconGradient,
                )}
              >
                <Icon size={22} className="text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-foreground truncate">{title}</h1>
                {subtitle && (
                  <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
                )}
              </div>
            </div>
            {actions && (
              <div className="flex items-center gap-2 shrink-0">{actions}</div>
            )}
          </div>
          {headerExtra && <div>{headerExtra}</div>}
        </div>

        {/* Page content */}
        {children}
      </motion.div>
    </ScrollArea>
  );
};

AdminPageShell.displayName = "AdminPageShell";

export { AdminPageShell };
export type { AdminPageShellProps };
