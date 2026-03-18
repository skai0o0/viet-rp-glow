import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Loader2, BadgeCheck, Lock } from "lucide-react";
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
  AVAILABLE_MODELS,
} from "@/services/openRouter";
import { fetchAllowedModels, type AllowedModel } from "@/services/globalSettingsDb";

interface ModelComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  userTier?: string;
}

type DisplayModel = {
  id: string;
  name: string;
  is_recommended?: boolean;
  is_free?: boolean;
  provider?: string;
};

const ModelCombobox = ({ value, onValueChange, userTier = "free" }: ModelComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [adminModels, setAdminModels] = useState<AllowedModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAdminModels, setHasAdminModels] = useState(false);

  const isFreeUser = userTier === "free";

  useEffect(() => {
    fetchAllowedModels()
      .then((allowed) => {
        if (allowed.length > 0) {
          setAdminModels(allowed);
          setHasAdminModels(true);
        }
      })
      .finally(() => setLoading(false));
  }, []);

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

  const isModelLocked = (model: DisplayModel) => isFreeUser && hasAdminModels && !model.is_free;

  const handleSelect = (model: DisplayModel) => {
    if (isModelLocked(model)) return;
    onValueChange(model.id);
    setOpen(false);
  };

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

            {recommendedModels.length > 0 && (
              <CommandGroup heading="⭐ Đề xuất">
                {recommendedModels.map((m) => {
                  const locked = isModelLocked(m);
                  return (
                    <CommandItem
                      key={m.id}
                      value={m.name}
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
                        <span className="text-[9px] font-bold bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full ml-1">
                          FREE
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold bg-neon-purple/20 text-neon-purple px-1.5 py-0.5 rounded-full ml-1">
                          PRO
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {recommendedModels.length > 0 && otherModels.length > 0 && (
              <CommandSeparator />
            )}

            <CommandGroup heading={hasAdminModels ? "Tất cả model" : "Model mặc định"}>
              {otherModels.map((m) => {
                const locked = isModelLocked(m);
                return (
                  <CommandItem
                    key={m.id}
                    value={m.name}
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
                      <span className="text-[9px] font-bold bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full ml-1">
                        FREE
                      </span>
                    ) : hasAdminModels ? (
                      <span className="text-[9px] font-bold bg-neon-purple/20 text-neon-purple px-1.5 py-0.5 rounded-full ml-1">
                        PRO
                      </span>
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        {hasAdminModels && (
          <div className="px-3 py-1.5 border-t border-gray-border">
            <p className="text-[10px] text-muted-foreground">
              {isFreeUser
                ? `${allDisplayModels.filter((m) => m.is_free).length} model miễn phí · Nâng cấp Pro để dùng tất cả`
                : `${allDisplayModels.length} model khả dụng`}
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default ModelCombobox;
