import { useState, useEffect, useMemo } from "react";
import { filterByNsfw } from "@/utils/nsfwFilter";
import { Link, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Compass, ArrowRight, Sparkles, Search, Filter, X } from "lucide-react";
import AppFooter from "@/components/AppFooter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import CharacterCard from "@/components/CharacterCard";
import CharacterPreviewDialog from "@/components/CharacterPreviewDialog";
import { getPublicCharacters, CharacterSummary } from "@/services/characterDb";
import { useAuth } from "@/contexts/AuthContext";
import { getActiveBanner, BannerData } from "@/services/bannerDb";

const HomePage = () => {
  const [tagFilter, setTagFilter] = useState("");
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<BannerData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [previewChar, setPreviewChar] = useState<CharacterSummary | null>(null);

  const visibleCharacters = useMemo(() => filterByNsfw(characters), [characters]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    visibleCharacters.forEach((c) => c.tags?.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [visibleCharacters]);

  const filteredCharacters = useMemo(() => {
    return visibleCharacters.filter((c) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.short_summary?.toLowerCase().includes(q) ||
        c.tags?.some((t) => t.toLowerCase().includes(q));
      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.every((st) => c.tags?.includes(st));
      return matchesSearch && matchesTags;
    });
  }, [visibleCharacters, searchQuery, selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  useEffect(() => {
    getPublicCharacters()
      .then(setCharacters)
      .catch(() => setCharacters([]))
      .finally(() => setLoading(false));
    getActiveBanner()
      .then(setBanner)
      .catch(() => setBanner(null));
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
          {/* Background effects */}
          <div
            className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{
              boxShadow:
                "inset 0 0 60px rgba(176,38,255,0.06), 0 0 40px rgba(176,38,255,0.08)",
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 70% 60% at 30% 50%, rgba(176,38,255,0.1) 0%, transparent 70%)",
            }}
          />
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
          <div className="absolute bottom-0 left-0 w-20 h-20 pointer-events-none">
            <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-neon-blue/40 to-transparent" />
            <div className="absolute bottom-0 left-0 h-full w-[1px] bg-gradient-to-t from-neon-blue/40 to-transparent" />
          </div>

          {/* Content: Left text + Right trapezoid image */}
          <div className="relative z-10 flex flex-col md:flex-row items-stretch min-h-[320px]">
            {/* Left side - Text content */}
            <div className="flex-1 flex flex-col justify-center py-12 sm:py-16 px-6 sm:px-10">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="w-12 h-12 rounded-xl bg-neon-purple/10 border border-neon-purple/30 flex items-center justify-center mb-5"
              >
                <Sparkles className="text-neon-purple" size={22} />
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-left"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--neon-blue)) 0%, hsl(var(--neon-purple)) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {banner?.title || "VietRP — Vũ trụ Roleplay của riêng người Việt"}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.45 }}
                className="mt-4 text-muted-foreground max-w-lg text-sm sm:text-base text-left"
              >
                {banner?.subtitle || "Khởi tạo thực tại, kết nối vô cực. Trải nghiệm trò chuyện với AI không giới hạn, bảo mật và hoàn toàn riêng tư."}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="mt-6 flex flex-col sm:flex-row gap-3"
              >
                <Button
                  onClick={handleStartNow}
                  className="bg-neon-purple text-white hover:shadow-neon-purple hover:scale-105 transition-all duration-200 px-5 h-10 text-sm"
                >
                  <Sparkles size={16} className="mr-2" />
                  Bắt đầu ngay
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-gray-border text-muted-foreground hover:border-neon-blue hover:text-neon-blue hover:shadow-neon-blue transition-all duration-200 px-5 h-10 text-sm bg-transparent"
                >
                  <Link to="/create">
                    <ArrowRight size={16} className="mr-2" />
                    Tạo nhân vật
                  </Link>
                </Button>
              </motion.div>
            </div>

            {/* Right side - Trapezoid image area */}
            <div className="relative w-full md:w-[40%] lg:w-[38%] min-h-[200px] md:min-h-0 overflow-hidden">
              <div
                className="absolute inset-0"
                style={{
                  clipPath: "polygon(15% 0%, 100% 0%, 100% 100%, 0% 100%)",
                }}
              >
                {banner?.image_url ? (
                  <img
                    src={banner.image_url}
                    alt="Banner"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full"
                    style={{
                      background:
                        "linear-gradient(135deg, hsl(var(--neon-purple) / 0.15) 0%, hsl(var(--neon-blue) / 0.1) 50%, hsl(var(--neon-purple) / 0.05) 100%)",
                    }}
                  >
                    <div className="w-full h-full flex items-center justify-center opacity-20">
                      <Sparkles size={64} className="text-neon-purple" />
                    </div>
                  </div>
                )}
              </div>
              <div
                className="absolute inset-0 pointer-events-none hidden md:block"
                style={{
                  background: "linear-gradient(90deg, hsl(var(--oled-surface)) 0%, transparent 20%)",
                }}
              />
            </div>
          </div>
        </motion.div>
      </section>

      {/* Announcement Banner */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="rounded-2xl border border-neon-blue/20 bg-oled-surface/80 backdrop-blur-sm px-5 py-4"
        >
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="text-neon-blue font-semibold mr-1.5">📢 Sắp ra mắt:</span>
            Hỗ trợ <span className="text-foreground font-medium">OpenAI</span> và{" "}
            <span className="text-foreground font-medium">Google GenAI</span> đang được phát triển.{" "}
            <span className="text-foreground font-medium">LM Studio</span> &{" "}
            <span className="text-foreground font-medium">Ollama</span>{" "}
            <span className="italic text-muted-foreground/70">— đang cân nhắc 🤔</span>
          </p>
        </motion.div>
      </section>

      {/* Discover Section */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-16 pb-10">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8"
        >
          <div className="flex items-center gap-3">
            <Compass className="text-secondary" size={24} />
            <h2 className="text-2xl font-bold text-foreground neon-text-purple whitespace-nowrap">
              Khám Phá Nhân Vật Nổi Bật
            </h2>
          </div>

          <div className="flex items-center gap-2 sm:ml-auto w-full sm:w-auto">
            {/* Tag filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={`relative shrink-0 border-gray-border bg-oled-surface hover:border-neon-blue hover:text-neon-blue ${selectedTags.length > 0 ? "border-neon-purple text-neon-purple" : "text-muted-foreground"}`}
                >
                  <Filter size={16} />
                  {selectedTags.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-neon-purple text-[10px] text-white flex items-center justify-center">
                      {selectedTags.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-72 bg-oled-surface border-gray-border p-3"
                align="end"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-foreground">Lọc theo tag</p>
                  {selectedTags.length > 0 && (
                    <button
                      onClick={() => setSelectedTags([])}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Xoá tất cả
                    </button>
                  )}
                </div>
                <div className="relative mb-2">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={tagFilter}
                    onChange={(e) => setTagFilter(e.target.value)}
                    placeholder="Tìm tag..."
                    className="w-full h-8 pl-8 pr-3 rounded-md bg-oled-base border border-gray-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-neon-blue transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto scrollbar-thin">
                  {allTags
                    .filter((t) => t.toLowerCase().includes(tagFilter.toLowerCase()))
                    .map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`flex items-center gap-2 w-full text-left text-xs px-2.5 py-1.5 rounded-md transition-colors ${
                        selectedTags.includes(tag)
                          ? "bg-neon-purple/20 text-neon-purple"
                          : "text-muted-foreground hover:bg-oled-elevated hover:text-foreground"
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 ${
                        selectedTags.includes(tag) ? "border-neon-purple bg-neon-purple" : "border-gray-border"
                      }`}>
                        {selectedTags.includes(tag) && <span className="text-[8px] text-white">✓</span>}
                      </span>
                      {tag}
                    </button>
                  ))}
                  {allTags.filter((t) => t.toLowerCase().includes(tagFilter.toLowerCase())).length === 0 && (
                    <p className="text-xs text-muted-foreground py-2 text-center">Không có tag nào</p>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Search input */}
            <div className="relative flex-1 sm:w-64 sm:flex-none">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm nhân vật..."
                className="w-full h-9 pl-9 pr-8 rounded-lg bg-oled-surface border border-gray-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-neon-blue transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Active tag filters */}
        {selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {selectedTags.map((tag) => (
              <Badge
                key={tag}
                className="bg-neon-purple/20 border-neon-purple text-neon-purple cursor-pointer text-xs gap-1"
                onClick={() => toggleTag(tag)}
              >
                {tag}
                <X size={12} />
              </Badge>
            ))}
          </div>
        )}

        <div className="grid gap-3 sm:gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
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
            : filteredCharacters.length === 0
              ? (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Compass size={48} className="mb-4 opacity-30" />
                  <p className="text-lg">
                    {characters.length === 0 ? "Chưa có nhân vật nào" : "Không tìm thấy nhân vật phù hợp"}
                  </p>
                  <p className="text-sm mt-1">
                    {characters.length === 0
                      ? "Hãy tạo nhân vật đầu tiên cho cộng đồng!"
                      : "Thử thay đổi từ khoá hoặc bộ lọc"}
                  </p>
                </div>
              )
              : filteredCharacters.map((char, i) => (
                <motion.div
                  key={char.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.55 + i * 0.07 }}
                >
                  <CharacterCard character={char} onClick={() => setPreviewChar(char)} />
                </motion.div>
              ))
          }
        </div>
      </section>

      <AppFooter />

      {previewChar && createPortal(
        <CharacterPreviewDialog character={previewChar} onClose={() => setPreviewChar(null)} />,
        document.body
      )}
    </div>
  );
};

export default HomePage;
