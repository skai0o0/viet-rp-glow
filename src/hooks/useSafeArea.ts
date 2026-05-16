import { useEffect } from "react";

export function useSafeArea() {
  useEffect(() => {
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as any).MSStream;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator &&
        (window.navigator as any).standalone);

    if (isIOS && isStandalone) {
      document.documentElement.style.setProperty("--ios-pwa-pad", "47px");
    } else {
      document.documentElement.style.setProperty("--ios-pwa-pad", "0px");
    }
  }, []);
}
