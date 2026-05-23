import React from "react";
import { useNsfwMode, dispatchNsfwModeChange } from "@/hooks/useNsfwMode";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface NsfwToggleProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  description?: string;
  onChange?: (enabled: boolean) => void;
}

const NsfwToggle = React.forwardRef<HTMLDivElement, NsfwToggleProps>(
  ({ label = "Chế độ NSFW", description, onChange, className, ...props }, ref) => {
    const nsfwMode = useNsfwMode();

    const handleToggle = (checked: boolean) => {
      localStorage.setItem("vietrp_nsfw_mode", String(checked));
      dispatchNsfwModeChange();
      onChange?.(checked);
    };

    return (
      <div ref={ref} className={cn("flex items-center gap-2", className)} {...props}>
        <Switch checked={nsfwMode} onCheckedChange={handleToggle} />
        <Label>{label}</Label>
        {description && (
          <span className="text-xs text-muted-foreground">{description}</span>
        )}
      </div>
    );
  }
);

NsfwToggle.displayName = "NsfwToggle";

export default NsfwToggle;
