import { useState, useEffect, useMemo } from "react";
import { Check, ChevronsUpDown, Loader2, BadgeCheck, Lock, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AVAILABLE_MODELS,
  formatPrefixedModelId,
} from "@/services/openRouter";
import { fetchAllowedModels, type AllowedModel } from "@/services/globalSettingsDb";
import { useIsMobile } from "@/hooks/use-mobile";

export interface ModelComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  userTier?: string;
}

type DisplayModel = {
  id: string;
  name: string;
  is_recommended?: boolean;
  is_free?: boolean;
  source?: string;
};

const SOURCE_LABELS: Record<string, string> = {
  openrouter: "OpenRouter",
  mimo: "Xiaomi Mimo",
  google_genai: "Google GenAI",
};

const ModelCombobox = ({ value, onValueChange, userTier = "free" }: ModelComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [adminModels, setAdminModels] = useState<AllowedModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAdminModels, setHasAdminModels] = useState(false);
  const isMobile = useIsMobile();

  const isFreeUser = userTier === "free";

  useEffect(() => {
    setLoading(true);
    fetchAllowedModels()
      .then((allowed) => {
        if (allowed.length > 0) {
          setAdminModels(allowed);
          setHasAdminModels(true);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Build unified model list grouped by source
  const { recommended, bySource } = useMemo(() => {
    const recommended: DisplayModel[] = [];
    const bySource: Record<string, DisplayModel[]> = {};

    if (hasAdminModels) {
      for (const m of adminModels) {
        const isNonOR = m.provider === "mimo" || m.provider === "google_genai" || m.provider === "google";
        const source = isNonOR ? (m.provider === "google" ? "google_genai" : m.provider) : "openrouter";
        const dm: DisplayModel = {
          id: isNonOR ? formatPrefixedModelId(source as any, m.model_id) : m.model_id,
          name: m.model_name,
          is_recommended: m.is_recommended,
          is_free: m.is_free,
          source,
        };
        if (m.is_recommended) {
          recommended.push(dm);
        } else {
          if (!bySource[source]) bySource[source] = [];
          bySource[source].push(dm);
        }
      }
    } else {
      bySource.openrouter = AVAILABLE_MODELS.map((m) => ({
        id: m.id,
        name: m.label,
        source: "openrouter",
      }));
    }

    return { recommended, bySource };
  }, [adminModels, hasAdminModels]);

  const allDisplayModels = useMemo(() => {
    const others = Object.values(bySource).flat();
    return [...recommended, ...others];
  }, [recommended, bySource]);

  const selectedModel = allDisplayModels.find((m) => m.id === value);
  const selectedLabel = selectedModel?.name || value;

  const isModelLocked = (model: DisplayModel) =>
    model.source === "openrouter" && isFreeUser && hasAdminModels && !model.is_free;

  const handleSelect = (model: DisplayModel) => {
    if (isModelLocked(model)) return;
    onValueChange(model.id);
    setOpen(false);
    setSearch("");
  };

  const sourceOrder = ["openrouter", "mimo", "google_genai"];

  // Filtered + grouped models
  const { filteredRecommended, filteredBySource } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const match = (m: DisplayModel) => !q || m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q);

    const filteredRecommended = recommended.filter(match);
    const filteredBySource: Record<string, DisplayModel[]> = {};
    for (const src of sourceOrder) {
      const models = bySource[src];
      if (models) {
        const filtered = models.filter(match);
        if (filtered.length > 0) filteredBySource[src] = filtered;
      }
    }
    return { filteredRecommended, filteredBySource };
  }, [recommended, bySource, search]);

  const hasResults = filteredRecommended.length > 0 || Object.values(filteredBySource).some((arr) => arr.length > 0);

  const triggerButton = (
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={open}
      className="w-full justify-between bg-oled-elevated border-gray-border text-foreground hover:bg-oled-elevated/80 focus:border-neon-purple focus:ring-neon-purple/30"
    >
      {loading ? (
        <span className="flex items-center gap-2 text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> Đang tải...
        </span>
      ) : (
        <span className="truncate flex items-center gap-1.5">
          {selectedLabel}
          {selectedModel?.is_recommended && (
            <BadgeCheck size={14} className="text-yellow-500 shrink-0" />
          )}
          {selectedModel?.is_free && (
            <span className="text-[9px] font-bold bg-green-500/20 text-green-400 px-1 py-0 rounded-full shrink-0">
              FREE
            </span>
          )}
        </span>
      )}
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  );

  const renderModelItem = (m: DisplayModel) => {
    const locked = isModelLocked(m);
    return (
      <CommandItem
        key={m.id}
        value={`${m.name} ${m.id}`}
        onSelect={() => handleSelect(m)}
        className={cn(
          "text-foreground cursor-pointer",
          locked ? "opacity-50 cursor-not-allowed" : "data-[selected=true]:bg-neon-purple/10"
        )}
        disabled={locked}
      >
        {locked ? (
          <Lock className="mr-2 h-4 w-4 text-muted-foreground" />
        ) : (
          <Check
            className={cn(
              "mr-2 h-4 w-4",
              value === m.id ? "opacity-100 text-neon-purple" : "opacity-0"
            )}
          />
        )}
        <span className={cn("truncate flex-1", locked && "text-muted-foreground")}>{m.name}</span>
        {m.is_free ? (
          <span className="text-[9px] font-bold bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full ml-1 shrink-0">
            FREE
          </span>
        ) : m.source === "openrouter" && hasAdminModels ? (
          <span className="text-[9px] font-bold bg-neon-purple/20 text-neon-purple px-1.5 py-0.5 rounded-full ml-1 shrink-0">
            PRO
          </span>
        ) : null}
      </CommandItem>
    );
  };

  const renderModelList = () => (
    <>
      {/* Search input */}
      <div className="flex items-center border-b px-3">
        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm model..."
          className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground text-foreground"
          autoFocus
        />
      </div>

      <CommandList className="max-h-[60vh] md:max-h-60">
        {!hasResults && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Không tìm thấy model nào.
          </div>
        )}

        {/* Recommended */}
        {filteredRecommended.length > 0 && (
          <CommandGroup heading="⭐ Đề xuất">
            {filteredRecommended.map(renderModelItem)}
          </CommandGroup>
        )}

        {/* Per-source groups */}
        {Object.entries(filteredBySource).map(([src, models]) => (
          <CommandGroup key={src} heading={SOURCE_LABELS[src] || src}>
            {models.map(renderModelItem)}
          </CommandGroup>
        ))}
      </CommandList>

      <div className="px-3 py-1.5 border-t border-gray-border">
        <p className="text-[10px] text-muted-foreground">
          {allDisplayModels.length} model khả dụng
          {isFreeUser && hasAdminModels && (
            <span> · {allDisplayModels.filter((m) => m.is_free).length} miễn phí</span>
          )}
        </p>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <>
        <div onClick={() => setOpen(true)}>{triggerButton}</div>
        <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(""); }}>
          <SheetContent
            side="bottom"
            className="p-0 bg-oled-elevated border-gray-border rounded-t-2xl max-h-[80vh] flex flex-col"
          >
            <SheetTitle className="sr-only">Chọn model</SheetTitle>
            <Command shouldFilter={false} className="bg-oled-elevated flex-1 overflow-hidden">
              {renderModelList()}
            </Command>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(""); }}>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-oled-elevated border-gray-border z-50" align="start">
        <Command shouldFilter={false} className="bg-oled-elevated">
          {renderModelList()}
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default ModelCombobox;
