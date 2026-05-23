import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface TypingIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  avatarChar?: string;
  text?: string;
}

const TypingIndicator = React.forwardRef<HTMLDivElement, TypingIndicatorProps>(
  ({ avatarChar = "M", text = "đang nhập", className, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("flex gap-3 px-4 md:px-6", className)}
        {...props}
      >
        <div className="w-8 h-8 rounded-full bg-oled-surface flex items-center justify-center text-neon-purple text-sm font-semibold border border-neon-purple/30 animate-breathing flex-shrink-0">
          {avatarChar}
        </div>
        <div className="bg-oled-surface rounded-2xl px-4 py-3 flex items-center gap-1">
          <span className="text-neon-purple/80 text-sm font-mono">
            {text}
          </span>
          <span className="text-neon-purple animate-blink font-mono text-sm">|</span>
        </div>
      </motion.div>
    );
  }
);

TypingIndicator.displayName = "TypingIndicator";

export default TypingIndicator;
