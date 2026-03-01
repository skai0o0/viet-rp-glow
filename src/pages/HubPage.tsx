import { useMemo, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { filterByNsfw } from "@/utils/nsfwFilter";
import { useNsfwMode } from "@/hooks/useNsfwMode";
import { motion } from "framer-motion";
import { Compass, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import CharacterCard from "@/components/CharacterCard";
import CharacterPreviewDialog from "@/components/CharacterPreviewDialog";
import { CharacterSummary, getPublicCharactersPaginated } from "@/services/characterDb";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import { useAuth } from "@/contexts/AuthContext";
import { getFavoritedIds } from "@/services/favoriteDb";

const HubPage = () => {
  const [search, setSearch] = useState("");
  const [previewChar, setPreviewChar] = useState<CharacterSummary | null>(null);
  const { user } = useAuth();
  const [favIds, setFavIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) getFavoritedIds().then(setFavIds).catch(() => {});
  }, [user]);

  const handleFavToggle = useCallback((id: string, newState: boolean) => {
    setFavIds((prev) => {
      const next = new Set(prev);
      if (newState) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["public-characters"],
    queryFn: ({ pageParam = 0 }) => getPublicCharactersPaginated(pageParam),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length : undefined,
    initialPageParam: 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { ref: bottomRef, inView } = useInView({ threshold: 0 });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allCharacters = useMemo(
    () => data?.pages.flatMap((p) => p.data) ?? [],
    [data]
  );

  const nsfwMode = useNsfwMode();
  const visibleCharacters = useMemo(() => filterByNsfw(allCharacters, nsfwMode), [allCharacters, nsfwMode]);

  const filtered = useMemo(() => {
    if (!search.trim()) return visibleCharacters;
    const q = search.toLowerCase();
    return visibleCharacters.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.short_summary?.toLowerCase().includes(q) ||
        c.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }, [visibleCharacters, search]);

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
        {isLoading
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
              <CharacterCard
                key={char.id}
                character={char}
                onClick={() => setPreviewChar(char)}
                isFavorited={favIds.has(char.id)}
                onFavoriteToggle={user ? handleFavToggle : undefined}
              />
            ))
        }
      </div>

      {/* Infinite scroll sentinel & loader */}
      {!isLoading && hasNextPage && (
        <div ref={bottomRef} className="flex justify-center py-6">
          {isFetchingNextPage && (
            <Loader2 size={24} className="animate-spin text-primary" />
          )}
        </div>
      )}

      {previewChar && createPortal(
        <CharacterPreviewDialog
          character={previewChar}
          onClose={() => setPreviewChar(null)}
          isFavorited={favIds.has(previewChar.id)}
          onFavoriteToggle={user ? handleFavToggle : undefined}
        />,
        document.body
      )}
    </div>
  );
};

export default HubPage;
