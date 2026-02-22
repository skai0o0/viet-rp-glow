import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Compass, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import CharacterCard from "@/components/CharacterCard";
import { getPublicCharacters, CharacterSummary } from "@/services/characterDb";
import { useAuth } from "@/contexts/AuthContext";

const HomePage = () => {
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    getPublicCharacters()
      .then(setCharacters)
      .catch(() => setCharacters([]))
      .finally(() => setLoading(false));
  }, []);

  const handleStartNow = () => {
    if (user) {
      navigate("/chat");
    } else {
      navigate("/auth", { state: { from: "/chat" } });
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-oled-base overflow-y-auto scrollbar-thin">
      {/* Hero Banner */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative rounded-3xl border border-neon-purple/20 bg-oled-surface overflow-hidden"
        >
          {/* Animated border glow */}
          <div
            className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{
              boxShadow:
                "inset 0 0 60px rgba(176,38,255,0.06), 0 0 40px rgba(176,38,255,0.08)",
            }}
          />
          {/* Radial glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 70% 60% at 50% 30%, rgba(176,38,255,0.1) 0%, transparent 70%)",
            }}
          />
          {/* Grid pattern */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.035]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(176,38,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(176,38,255,0.5) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
          {/* Corner accents */}
          <div className="absolute top-0 left-0 w-20 h-20 pointer-events-none">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-neon-purple/60 to-transparent" />
            <div className="absolute top-0 left-0 h-full w-[1px] bg-gradient-to-b from-neon-purple/60 to-transparent" />
          </div>
          <div className="absolute top-0 right-0 w-20 h-20 pointer-events-none">
            <div className="absolute top-0 right-0 w-full h-[1px] bg-gradient-to-l from-neon-blue/60 to-transparent" />
            <div className="absolute top-0 right-0 h-full w-[1px] bg-gradient-to-b from-neon-blue/60 to-transparent" />
          </div>
          <div className="absolute bottom-0 left-0 w-20 h-20 pointer-events-none">
            <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-neon-blue/40 to-transparent" />
            <div className="absolute bottom-0 left-0 h-full w-[1px] bg-gradient-to-t from-neon-blue/40 to-transparent" />
          </div>
          <div className="absolute bottom-0 right-0 w-20 h-20 pointer-events-none">
            <div className="absolute bottom-0 right-0 w-full h-[1px] bg-gradient-to-l from-neon-purple/40 to-transparent" />
            <div className="absolute bottom-0 right-0 h-full w-[1px] bg-gradient-to-t from-neon-purple/40 to-transparent" />
          </div>

          {/* Content */}
          <div className="relative z-10 py-16 sm:py-20 px-6 sm:px-10 flex flex-col items-center text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="w-14 h-14 rounded-2xl bg-neon-purple/10 border border-neon-purple/30 flex items-center justify-center mb-6"
            >
              <Sparkles className="text-neon-purple" size={24} />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight"
              style={{
                background: "linear-gradient(135deg, #00F0FF 0%, #B026FF 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              VietRP — Vũ trụ Roleplay của riêng người Việt
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.45 }}
              className="mt-4 text-muted-foreground max-w-2xl mx-auto text-base sm:text-lg"
            >
              Khởi tạo thực tại, kết nối vô cực. Trải nghiệm trò chuyện với AI
              không giới hạn, bảo mật và hoàn toàn riêng tư.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="mt-8 flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Button
                onClick={handleStartNow}
                className="bg-neon-purple text-white hover:shadow-neon-purple hover:scale-105 transition-all duration-200 px-6 h-11 text-base"
              >
                <Sparkles size={18} className="mr-2" />
                Bắt đầu ngay
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-gray-border text-muted-foreground hover:border-neon-blue hover:text-neon-blue hover:shadow-neon-blue transition-all duration-200 px-6 h-11 text-base bg-transparent"
              >
                <Link to="/create">
                  <ArrowRight size={18} className="mr-2" />
                  Tạo nhân vật
                </Link>
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Discover Section */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-16 pb-10">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="flex items-center gap-3 mb-8"
        >
          <Compass className="text-secondary" size={24} />
          <h2 className="text-2xl font-bold text-foreground neon-text-purple">
            Khám Phá Nhân Vật Nổi Bật
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-oled-surface rounded-2xl border border-gray-border overflow-hidden"
                >
                  <Skeleton className="aspect-[4/3] w-full bg-oled-elevated" />
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-5 w-3/4 bg-oled-elevated" />
                    <Skeleton className="h-4 w-full bg-oled-elevated" />
                    <div className="flex gap-2 pt-1">
                      <Skeleton className="h-6 w-14 rounded-full bg-oled-elevated" />
                      <Skeleton className="h-6 w-16 rounded-full bg-oled-elevated" />
                    </div>
                  </div>
                </div>
              ))
            : characters.length === 0
              ? (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Compass size={48} className="mb-4 opacity-30" />
                  <p className="text-lg">Chưa có nhân vật nào</p>
                  <p className="text-sm mt-1">Hãy tạo nhân vật đầu tiên cho cộng đồng!</p>
                </div>
              )
              : characters.map((char, i) => (
                <motion.div
                  key={char.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.55 + i * 0.07 }}
                >
                  <CharacterCard character={char} />
                </motion.div>
              ))
          }
        </div>
      </section>
    </div>
  );
};

export default HomePage;
