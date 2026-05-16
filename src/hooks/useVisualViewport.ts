import { useEffect, useState } from "react";

/**
 * Track visual viewport height to handle iOS keyboard.
 * On iOS, window.innerHeight doesn't change when keyboard opens,
 * but visualViewport.height does.
 */
export function useVisualViewportHeight(): number {
  const [height, setHeight] = useState(
    () => window.visualViewport?.height ?? window.innerHeight
  );

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handler = () => setHeight(vv.height);
    vv.addEventListener("resize", handler);
    return () => vv.removeEventListener("resize", handler);
  }, []);

  return height;
}
