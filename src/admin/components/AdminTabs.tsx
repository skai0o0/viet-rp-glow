import { ReactNode, ElementType } from "react";
import { cn } from "@/lib/utils";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

interface AdminTab {
  value: string;
  label: string;
  icon?: ElementType;
  color?: string;
  badge?: number;
}

interface AdminTabsProps {
  tabs: AdminTab[];
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}

const AdminTabs = ({
  tabs,
  value,
  onValueChange,
  children,
  className,
}: AdminTabsProps) => {
  return (
    <Tabs value={value} onValueChange={onValueChange} className={cn("w-full", className)}>
      <TabsList className="bg-oled-surface border border-gray-border overflow-x-auto justify-start w-full no-scrollbar h-auto p-1 gap-1">
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={cn(
                "shrink-0 text-xs px-3 py-2 min-h-[40px] data-[state=active]:bg-neon-purple/20 data-[state=active]:text-neon-purple",
                tab.color && `data-[state=active]:bg-${tab.color}/20 data-[state=active]:text-${tab.color}`,
              )}
            >
              {TabIcon && <TabIcon size={14} className="mr-1.5" />}
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="ml-1.5 text-[10px] bg-neon-purple/20 text-neon-purple px-1.5 py-0.5 rounded-full">
                  {tab.badge}
                </span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {children}
    </Tabs>
  );
};

AdminTabs.displayName = "AdminTabs";

export { AdminTabs, TabsContent };
export type { AdminTab, AdminTabsProps };
