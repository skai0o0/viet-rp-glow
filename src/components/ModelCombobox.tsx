import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
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

interface ModelComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
}

const ModelCombobox = ({ value, onValueChange }: ModelComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOpenRouterModels().then((m) => {
      setModels(m);
      setLoading(false);
    });
  }, []);

  const displayModels = models.length > 0
    ? models
    : AVAILABLE_MODELS.map((m) => ({ id: m.id, name: m.label }));

  const selectedLabel = displayModels.find((m) => m.id === value)?.name || value;

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
            <span className="truncate">{selectedLabel}</span>
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
            <CommandGroup>
              {displayModels.map((m) => (
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
                  <span className="truncate">{m.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        {models.length > 0 && (
          <div className="px-3 py-1.5 border-t border-gray-border">
            <p className="text-[10px] text-muted-foreground">{models.length} model khả dụng</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default ModelCombobox;
