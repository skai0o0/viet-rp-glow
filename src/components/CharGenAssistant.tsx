import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wand2, Sparkles } from "lucide-react";

interface CharGenAssistantProps {
  visible: boolean;
  onSelectSuggestion: (prompt: string) => void;
}

const SUGGESTIONS = [
  {
    emoji: "anime",
    label: "Nhân vật Anime",
    prompt: "Tạo nhân vật dựa trên nhân vật Anime yêu thích. Tính cách: , Bối cảnh: . Giữ nguyên đặc điểm gốc nhưng viết bằng tiếng Việt.",
  },
  {
    emoji: "movie",
    label: "Nhân vật phim/truyện",
    prompt: "Tạo nhân vật dựa trên nhân vật từ phim hoặc truyện. Tính cách: , Bối cảnh: .",
  },
  {
    emoji: "oc",
    label: "Tạo OC mới",
    prompt: "Tạo một nhân vật OC hoàn toàn mới với ý tưởng như sau: ",
  },
];

const EMOJI_MAP: Record<string, string> = {
  anime: "⚔️",
  movie: "🎬",
  oc: "✨",
};

const STORAGE_KEY = "chargen_assistant_dismissed";

const CharGenAssistant = ({ visible, onSelectSuggestion }: CharGenAssistantProps) => {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!visible) {
      setStep(0);
    }
  }, [visible]);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(STORAGE_KEY, "true");
    } catch { /* ignore */ }
  };

  const handleSelect = (prompt: string) => {
    onSelectSuggestion(prompt);
    handleDismiss();
  };

  if (!visible || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 w-[calc(100vw-2rem)] max-w-xs"
      >
        <div className="bg-oled-surface border border-gray-border rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-border bg-gradient-to-r from-neon-purple/10 to-neon-rose/10">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-neon-purple to-neon-rose flex items-center justify-center">
                <Wand2 size={13} className="text-white" />
              </div>
              <span className="text-sm font-semibold text-foreground">Tạo nhân vật AI</span>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-oled-base transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Content */}
          <div className="p-3 space-y-2">
            {step === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-2"
              >
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Bạn muốn tạo card từ nhân vật Anime?
                </p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => handleSelect(s.prompt)}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-xs bg-oled-base border border-oled-border text-muted-foreground hover:text-neon-purple hover:border-neon-purple/40 transition-all duration-200 flex items-center gap-2.5"
                  >
                    <span className="text-base">{EMOJI_MAP[s.emoji]}</span>
                    <span>{s.label}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-gray-border bg-oled-base/50">
            <p className="text-[10px] text-muted-foreground text-center">
              <Sparkles size={9} className="inline mr-1 opacity-50" />
              Click để điền prompt, bạn có thể chỉnh sửa trước khi gửi
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CharGenAssistant;
