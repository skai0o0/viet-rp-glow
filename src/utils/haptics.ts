type HapticStyle = "light" | "medium" | "heavy" | "success" | "warning" | "error";

const DURATIONS: Record<HapticStyle, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 30,
  success: [10, 30, 10],
  warning: [20, 50, 20],
  error: [30, 50, 30, 50, 30],
};

export function haptic(style: HapticStyle = "light") {
  const vib = navigator.vibrate;
  if (!vib) return;

  const pattern = DURATIONS[style];
  if (Array.isArray(pattern)) {
    navigator.vibrate(pattern);
  } else {
    navigator.vibrate(pattern);
  }
}
