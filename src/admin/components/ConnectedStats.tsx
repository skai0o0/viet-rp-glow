import { useRef, useState, useEffect, useCallback, type ElementType, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface StatNode {
  id: string;
  icon: ElementType;
  label: string;
  value: string | number;
  color: string;
  sub?: string;
  children?: StatNode[];
}

interface ConnectedStatsProps {
  nodes: StatNode[];
  className?: string;
}

/* ─── Map tailwind text-* class to hex ─── */
function getColorValue(colorClass: string): string {
  const map: Record<string, string> = {
    "text-neon-purple": "#a855f7",
    "text-neon-blue": "#3b82f6",
    "text-neon-rose": "#f43f5e",
    "text-cyan-400": "#22d3ee",
    "text-green-400": "#4ade80",
    "text-pink-400": "#f472b6",
    "text-amber-400": "#fbbf24",
    "text-gray-400": "#9ca3af",
    "text-orange-400": "#fb923c",
    "text-yellow-400": "#facc15",
    "text-emerald-400": "#34d399",
    "text-teal-400": "#2dd4bf",
  };
  return map[colorClass] || "#a855f7";
}

/* ─── Single stat node card ─── */
const StatNodeCard = ({
  node,
  delay,
}: {
  node: StatNode;
  delay: number;
}) => {
  const hasChildren = node.children && node.children.length > 0;

  return (
    <motion.div
      data-node-id={node.id}
      data-node-color={node.color}
      initial={{ opacity: 0, scale: 0.9, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={cn(
        "relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl",
        "bg-oled-surface border transition-all duration-200",
        "hover:scale-[1.03] hover:shadow-lg",
        hasChildren ? "ring-1 ring-inset ring-white/[0.04]" : "",
      )}
      style={{
        borderColor: `${getColorValue(node.color)}33`,
      }}
    >
      <div
        className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
          node.color.replace("text-", "bg-") + "/10",
        )}
      >
        <node.icon size={16} className={node.color} />
      </div>
      <div className="min-w-0">
        <p className="text-base font-bold text-foreground leading-tight">{node.value}</p>
        <p className="text-[10px] text-muted-foreground truncate leading-tight">{node.label}</p>
        {node.sub && <p className="text-[9px] text-muted-foreground/50 leading-tight">{node.sub}</p>}
      </div>
    </motion.div>
  );
};

/* ─── SVG connector layer — draws curved lines between parent & child nodes ─── */
const ConnectorLayer = ({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
}) => {
  const [paths, setPaths] = useState<{ d: string; color: string; key: string }[]>([]);

  const recalc = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();

    const newPaths: typeof paths = [];
    const parentEls = container.querySelectorAll("[data-node-id]");

    parentEls.forEach((el) => {
      const parentId = el.getAttribute("data-node-id")!;
      const parentColor = el.getAttribute("data-node-color") || "text-neon-purple";
      // Find child wrapper (next sibling with data-children-of)
      const childWrapper = container.querySelector(`[data-children-of="${parentId}"]`);
      if (!childWrapper) return;

      const parentRect = el.getBoundingClientRect();
      const px = parentRect.left + parentRect.width / 2 - cRect.left;
      const py = parentRect.bottom - cRect.top;

      const childCards = childWrapper.querySelectorAll("[data-node-id]");
      childCards.forEach((childEl) => {
        const childRect = childEl.getBoundingClientRect();
        const cx = childRect.left + childRect.width / 2 - cRect.left;
        const cy = childRect.top - cRect.top;
        const midY = py + (cy - py) * 0.5;

        newPaths.push({
          d: `M ${px} ${py} C ${px} ${midY}, ${cx} ${midY}, ${cx} ${cy}`,
          color: getColorValue(parentColor),
          key: `${parentId}-${childEl.getAttribute("data-node-id")}`,
        });
      });
    });

    setPaths(newPaths);
  }, [containerRef]);

  useEffect(() => {
    const t = setTimeout(recalc, 80);
    window.addEventListener("resize", recalc);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", recalc);
    };
  }, [recalc]);

  if (paths.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ overflow: "visible", zIndex: 0 }}
    >
      {paths.map((p, i) => (
        <motion.path
          key={p.key}
          d={p.d}
          fill="none"
          stroke={p.color}
          strokeWidth={1.5}
          strokeOpacity={0.35}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 0.4 + i * 0.06, ease: "easeOut" }}
        />
      ))}
    </svg>
  );
};

/* ─── Recursive tree level ─── */
const TreeLevel = ({
  node,
  depth = 0,
  baseDelay = 0,
}: {
  node: StatNode;
  depth?: number;
  baseDelay?: number;
}) => {
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="flex flex-col items-center relative" style={{ zIndex: 1 }}>
      <StatNodeCard node={node} delay={baseDelay} />
      {hasChildren && (
        <>
          <div className="w-px h-5 bg-gradient-to-b from-gray-border/60 to-gray-border/20" />
          <div
            className="flex items-start justify-center gap-3 flex-wrap"
            data-children-of={node.id}
          >
            {node.children!.map((child, i) => (
              <div key={child.id} className="flex flex-col items-center">
                <div className="w-px h-4 bg-gradient-to-b from-gray-border/40 to-transparent" />
                <TreeLevel
                  node={child}
                  depth={depth + 1}
                  baseDelay={baseDelay + 0.12 + i * 0.06}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/* ─── Main exported component ─── */
const ConnectedStats = ({ nodes, className }: ConnectedStatsProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className={cn("relative flex flex-wrap justify-center gap-10", className)}
    >
      <ConnectorLayer containerRef={containerRef} />
      {nodes.map((node, i) => (
        <TreeLevel key={node.id} node={node} baseDelay={i * 0.2} />
      ))}
    </div>
  );
};

export { ConnectedStats };
export type { ConnectedStatsProps };
