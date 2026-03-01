import { useState, useEffect, useCallback } from "react";

/** Custom event name dispatched when NSFW mode changes */
export const NSFW_MODE_CHANGE_EVENT = "nsfw-mode-change";

/** Read current NSFW mode from localStorage */
function readNsfwMode(): boolean {
  return localStorage.getItem("vietrp_nsfw_mode") === "true";
}

/**
 * Dispatch a custom event to notify all listeners that NSFW mode changed.
 * Call this after writing to localStorage.
 */
export function dispatchNsfwModeChange() {
  window.dispatchEvent(new CustomEvent(NSFW_MODE_CHANGE_EVENT));
}

/**
 * Reactive hook that returns the current NSFW mode and updates
 * whenever it changes (via the custom event dispatched by the toggle).
 */
export function useNsfwMode(): boolean {
  const [nsfwMode, setNsfwMode] = useState(readNsfwMode);

  useEffect(() => {
    const handler = () => setNsfwMode(readNsfwMode());
    window.addEventListener(NSFW_MODE_CHANGE_EVENT, handler);
    return () => window.removeEventListener(NSFW_MODE_CHANGE_EVENT, handler);
  }, []);

  return nsfwMode;
}
