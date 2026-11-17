# Audit & Modernization Plan for VietRP UI Transitions/Animations

This document outlines the current state of animations and transitions in the **viet-rp-glow** project, lists the visual issues (flashes, shifts, and lag), and proposes specific improvements to achieve a fluid, premium, and modern UX.

---

## 1. Key Animation Audit & Findings

### ⚙️ Page Transitions (`AppLayout.tsx`)
- **Current State:** Uses `AnimatePresence` with `mode="popLayout"`. Exit animation fades the departing page out (`exit={{ opacity: 0 }}`), but there is no entry animation specified.
- **Problem:** When navigating between pages, the entering page appears instantly (asymmetric snap), while the departing page fades out over 150ms. This results in visual stuttering and inconsistent transitions.
- **Proposed Solution:** Implement a symmetric cross-fade transition with a subtle vertical shift to give it a modern native-app feel.
  - Enter: `initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}`
  - Exit: `exit={{ opacity: 0, y: -6 }}`
  - Duration: `0.18s` with `easeOut` easing.

### 📝 Create Page Tab Switcher (`CreatePage.tsx`)
- **Current State:** Switching between the **Manual** character creation form and the **AI CharGen** panel.
- **Problem:** Toggling tabs uses Tailwind classes where the inactive tab has `absolute inset-x-0 bottom-0 top-0 overflow-hidden invisible pointer-events-none opacity-0` and the active tab has `flex-1 flex flex-col min-h-0 pointer-events-auto visible opacity-100`. Because the active tab is in-flow (`flex-1`) and the inactive tab is pulled out-of-flow (`absolute`), the parent container height recalculates, resulting in a single-frame layout shift (a sudden blink or flash).
- **Proposed Solution:** Make **both** tab containers `absolute inset-0 flex flex-col min-h-0` at all times, layered inside a parent wrapper that is `relative flex-1 min-h-0`. This forces both panels to occupy the exact same coordinate box, avoiding layout reflows and providing a 100% flicker-free transition.

### 💬 Left Chat Sidebar (`ChatSidebar.tsx`)
- **Current State:** On desktop screens, it is `relative` and mounts/unmounts inside `AnimatePresence`. On mobile screens, it is `fixed` (acting as a drawer overlay).
- **Problem:** Because it is `relative` on desktop, when it mounts/unmounts, the layout instantly reserves or releases its `280px` width. The chat pane instantly shifts by `280px`, and then the sidebar's `x` position animates in, creating an ugly layout jump.
- **Proposed Solution:** Make the sidebar width animate smoothly on desktop, while retaining the standard translate animation on mobile.
  - On mobile: slide in using transform `x` (GPU-accelerated overlay).
  - On desktop: animate the `width` from `0` to `280px` (with `overflow-hidden` so inner items don't wrap during the resize).

### ⚙️ Chat Settings Sidebar (`ChatPage.tsx`)
- **Current State:** Animates `width` from `0` to `288px` when toggled.
- **Problem:** To prevent text inside from wrapping during the animation, it uses an inner container with fixed width (`288px`). However, the transition can be improved to feel snappier and avoid continuous repaint lag on low-end devices.
- **Proposed Solution:** Adjust the transition duration and timing function. Ensure it uses `will-change: width` or a hardware-accelerated slide-out.

### 📱 iOS Safe Area Notch & Home Indicator Layout (`index.html` & `index.css`)
- **Problem:** On iOS device viewports, the bottom navigation or content doesn't stretch gracefully into the physical curved corners (the notch/home indicator area). Because `html` had no background color, any overscroll or safe area gaps default to browser light grey/white, causing the layout to look "pushed up" (nhích lên) and cut off.
- **Solution:** 
  1. Add `<meta name="theme-color" content="#000000" />` to `index.html` head to tint Safari UI.
  2. Set `html, body, #root { height: 100%; height: 100dvh; background-color: #000000; }` in `index.css` to force the document canvas to expand under the device notch seamlessly in oled-dark black.

---

## 2. Refactoring Tasks

1. **Refactor `AppLayout.tsx`:** Standardize page transitions to be symmetric, smooth, and modern. [COMPLETED]
2. **Refactor `CreatePage.tsx`:** Keep both tab containers absolutely positioned to remove the layout flash completely. [COMPLETED]
3. **Refactor `ChatSidebar.tsx`:** Introduce a dual-mode animation schema (slide-in overlay for mobile, smooth width expansion for desktop) to eliminate desktop layout jumps. [COMPLETED]
4. **Refactor `index.html` & `index.css`:** Set theme-color meta, and extend root/body container height + dark background to iOS safe areas. [COMPLETED]
