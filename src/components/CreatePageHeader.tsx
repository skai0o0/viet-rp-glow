import type { ReactNode } from "react";

interface CreatePageHeaderProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  rightActions?: ReactNode;
}

const CreatePageHeader = ({ icon, title, subtitle, rightActions }: CreatePageHeaderProps) => (
  <div className="shrink-0 safe-header-pt safe-header-h pb-2 px-4 border-b border-gray-border bg-oled-surface/60 backdrop-blur-sm flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-neon-purple to-neon-rose flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <h1 className="text-sm font-bold text-foreground truncate">{title}</h1>
        <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
      </div>
    </div>
    {rightActions && (
      <div className="flex items-center gap-1 shrink-0">
        {rightActions}
      </div>
    )}
  </div>
);

export default CreatePageHeader;
