import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { filterByNsfw } from "@/utils/nsfwFilter";
import { motion } from "framer-motion";
import { Compass, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import CharacterCard from "@/components/CharacterCard";
import CharacterPreviewDialog from "@/components/CharacterPreviewDialog";
import { getPublicCharacters, CharacterSummary } from "@/services/characterDb";

const HubPage = () => {
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [previewChar, setPreviewChar] = useState<CharacterSummary | null>(null);

  useEffect(() => {
    getPublicCharacters()
      .then(setCharacters)
      .catch(() => setCharacters([]))
      .finally(() => setLoading(false));
  }, []);

  const visibleCharacters = useMemo(() => filterByNsfw(characters), [characters]);

  const filtered = visibleCharacters.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.short_summary?.toLowerCase().includes(search.toLowerCase()) ||
    c.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex-1 flex flex-col bg-oled-base overflow-y-auto scrollbar-thin">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <Compass className="text-secondary" size={24} />
          <h1 className="text-2xl font-bold text-foreground neon-text-purple">
            Khám Phá Nhân Vật
          </h1>
        </motion.div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input
            placeholder="Tìm kiếm nhân vật..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-oled-surface border-gray-border focus-visible:ring-primary focus-visible:border-primary"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="px-6 pb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-oled-surface rounded-2xl border border-gray-border overflow-hidden">
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
          : filtered.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Compass size={48} className="mb-4 opacity-30" />
                <p className="text-lg">Không tìm thấy nhân vật nào</p>
                <p className="text-sm mt-1">Hãy thử từ khóa khác hoặc tạo nhân vật mới</p>
              </div>
            )
          : filtered.map((char) => (
              <CharacterCard key={char.id} character={char} onClick={() => setPreviewChar(char)} />
            ))
        }
      </div>

      {previewChar && createPortal(
        <CharacterPreviewDialog character={previewChar} onClose={() => setPreviewChar(null)} />,
        document.body
      )}
    </div>
  );
};

export default HubPage;
