import { motion } from "framer-motion";

const TypingIndicator = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 px-4 md:px-6"
    >
      <div className="w-8 h-8 rounded-full bg-oled-surface flex items-center justify-center text-neon-purple text-sm font-semibold border border-neon-purple/30 animate-breathing flex-shrink-0">
        M
      </div>
      <div className="bg-oled-surface rounded-2xl px-4 py-3 flex items-center gap-1">
        <span className="text-neon-purple/80 text-sm font-mono">
          đang nhập
        </span>
        <span className="text-neon-purple animate-blink font-mono text-sm">|</span>
      </div>
    </motion.div>
  );
};

export default TypingIndicator;
