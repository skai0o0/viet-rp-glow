import { ElementType, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminDataListProps<T extends Record<string, unknown>> {
  data: T[];
  loading?: boolean;
  emptyIcon?: ElementType;
  emptyMessage?: string;
  renderItem: (item: T, index: number) => ReactNode;
  keyExtractor: (item: T) => string;
  className?: string;
}

function AdminDataListInner<T extends Record<string, unknown>>(
  {
    data,
    loading,
    emptyIcon: EmptyIcon,
    emptyMessage = "Không có dữ liệu",
    renderItem,
    keyExtractor,
    className,
  }: AdminDataListProps<T>,
) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-neon-purple" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        {EmptyIcon && <EmptyIcon size={32} className="mb-3 opacity-30" />}
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <AnimatePresence mode="popLayout">
        {data.map((item, index) => (
          <motion.div
            key={keyExtractor(item)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.18, delay: index * 0.03 }}
          >
            {renderItem(item, index)}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Workaround for generic components in JSX — TypeScript needs a named forwardRef wrapper
const AdminDataList = AdminDataListInner as <T extends Record<string, unknown>>(
  props: AdminDataListProps<T>,
) => ReactNode;

export { AdminDataList };
export type { AdminDataListProps };
