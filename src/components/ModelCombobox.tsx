import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Loader2, Star, Gift, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  fetchOpenRouterModels,
  AVAILABLE_MODELS,
  type OpenRouterModel,
} from "@/services/openRouter";
import { fetchAllowedModels, type AllowedModel } from "@/services/globalSettingsDb";

interface ModelComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
}

type DisplayModel = {
  id: string;
  name: string;
  is_recommended?: boolean;
  is_free?: boolean;
  provider?: string;
};

const ModelCombobox = ({ value, onValueChange }: ModelComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [adminModels, setAdminModels] = useState<AllowedModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAdminModels, setHasAdminModels] = useState(false);

  useEffect(() => {
    // Try to load admin-curated models first
    fetchAllowedModels()
      .then((allowed) => {
        if (allowed.length > 0) {
          setAdminModels(allowed);
          setHasAdminModels(true);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // If admin curated models exist, use those. Otherwise fallback.
  const recommendedModels: DisplayModel[] = hasAdminModels
    ? adminModels
        .filter((m) => m.is_recommended)
        .map((m) => ({
          id: m.model_id,
          name: m.model_name,
          is_recommended: true,
          is_free: m.is_free,
          provider: m.provider,
        }))
    : [];

  const otherModels: DisplayModel[] = hasAdminModels
    ? adminModels
        .filter((m) => !m.is_recommended)
        .map((m) => ({
          id: m.model_id,
          name: m.model_name,
          is_recommended: false,
          is_free: m.is_free,
          provider: m.provider,
        }))
    : AVAILABLE_MODELS.map((m) => ({ id: m.id, name: m.label }));

  const allDisplayModels = [...recommendedModels, ...otherModels];
  const selectedLabel = allDisplayModels.find((m) => m.id === value)?.name || value;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
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
              {allDisplayModels.find((m) => m.id === value)?.is_recommended && (
                <BadgeCheck size={14} className="text-yellow-500 shrink-0" />
              )}
              {allDisplayModels.find((m) => m.id === value)?.is_free && (
                <span className="text-[9px] font-bold bg-green-500/20 text-green-400 px-1 py-0 rounded-full shrink-0">
                  FREE
                </span>
              )}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-oled-elevated border-gray-border z-50" align="start">
        <Command className="bg-oled-elevated">
          <CommandInput
            placeholder="Tìm model..."
            className="text-foreground"
          />
          <CommandList className="max-h-60">
            <CommandEmpty className="text-muted-foreground">
              Không tìm thấy model nào.
            </CommandEmpty>

            {/* Recommended models section */}
            {recommendedModels.length > 0 && (
              <CommandGroup heading="⭐ Đề xuất">
                {recommendedModels.map((m) => (
                  <CommandItem
                    key={m.id}
                    value={m.name}
                    onSelect={() => {
                      onValueChange(m.id);
                      setOpen(false);
                    }}
                    className="text-foreground data-[selected=true]:bg-neon-purple/10 cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === m.id ? "opacity-100 text-neon-purple" : "opacity-0"
                      )}
                    />
                    <span className="truncate flex-1">{m.name}</span>
                    {m.is_free && (
                      <span className="text-[9px] font-bold bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full ml-1">
                        FREE
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {recommendedModels.length > 0 && otherModels.length > 0 && (
              <CommandSeparator />
            )}

            {/* All other allowed models */}
            <CommandGroup heading={hasAdminModels ? "Tất cả model" : "Model mặc định"}>
              {otherModels.map((m) => (
                <CommandItem
                  key={m.id}
                  value={m.name}
                  onSelect={() => {
                    onValueChange(m.id);
                    setOpen(false);
                  }}
                  className="text-foreground data-[selected=true]:bg-neon-purple/10 cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === m.id ? "opacity-100 text-neon-purple" : "opacity-0"
                    )}
                  />
                  <span className="truncate flex-1">{m.name}</span>
                  {m.is_free && (
                    <span className="text-[9px] font-bold bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full ml-1">
                      FREE
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        {hasAdminModels && (
          <div className="px-3 py-1.5 border-t border-gray-border">
            <p className="text-[10px] text-muted-foreground">
              {allDisplayModels.length} model được admin cho phép
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default ModelCombobox;
