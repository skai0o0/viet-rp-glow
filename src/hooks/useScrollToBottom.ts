import { useRef, useEffect, useCallback, useState } from "react";

interface ScrollToBottomOptions {
  /** Pixel threshold to consider "near bottom" */
  threshold?: number;
  /** Dependencies that trigger auto-scroll (e.g. messages array) */
  deps?: unknown[];
}

export function useScrollToBottom({ threshold = 120, deps = [] }: ScrollToBottomOptions = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showButton, setShowButton] = useState(false);
  const isUserNearBottom = useRef(true);

  const checkScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isUserNearBottom.current = fromBottom < threshold;
    setShowButton(!isUserNearBottom.current);
  }, [threshold]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // Auto-scroll when deps change (new message arrives)
  useEffect(() => {
    if (isUserNearBottom.current) {
      requestAnimationFrame(() => scrollToBottom("instant"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // Listen for scroll events
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    checkScroll();
    return () => el.removeEventListener("scroll", checkScroll);
  }, [checkScroll]);

  return { containerRef, showButton, scrollToBottom, checkScroll };
}
