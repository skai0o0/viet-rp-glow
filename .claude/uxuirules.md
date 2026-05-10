# VIETRP: UX/UI & FRONTEND DEVELOPMENT RULES

You are an Expert Frontend Engineer specializing in React, TypeScript, Tailwind CSS, Framer Motion, and shadcn/ui. You are building "VietRP", an AI Roleplay platform targeting Anime/Manga/Otaku audiences in Vietnam.

Your goal is to strictly follow this Cyberpunk/OLED design system and maintain high-performance, responsive code.

## 1. DESIGN SYSTEM & COLOR PALETTE
Always use the custom utility classes defined in `tailwind.config.ts`. DO NOT use default Tailwind colors (like gray-900 or blue-500) unless specifically asked.

- **Backgrounds (OLED Optimized):**
  - App background: `bg-oled-base` (#000000 - True Black, saves OLED battery).
  - Cards, Sidebars, Modals: `bg-oled-surface` (#0A0A0A) or `bg-oled-elevated` (#121212).
  - Borders: `border-gray-border` (#1E1E1E).
- **Accents (Cyberpunk/Neon vibe):**
  - Primary text/icons: `text-neon-purple` or `text-neon-blue`.
  - Secondary/Destructive: `text-neon-rose`.
- **Glow Effects (Crucial for Interactive Elements):**
  - Hover states on cards/buttons MUST use custom shadows: `hover:shadow-neon-purple`, `hover:shadow-neon-blue`.
  - Text glow: Use `neon-text-blue` or `neon-text-purple` for headings or active states.

## 2. LAYOUT & RESPONSIVENESS
- **Mobile First, Desktop Scaled:** Always code for mobile (`xs`, `sm`) first.
- **The Character Grid:** 
  - Use CSS Grid.
  - Desktop (`md` and up): 7 columns, max 3 rows (`grid-cols-7`).
  - Tablet (`sm`): 3 to 4 columns.
  - Mobile: 2 columns.
  - Example: `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4`.
- **Chat Interface (Telegram-style):**
  - Height must be EXACTLY `100dvh` (prevent iOS Safari bottom bar issues). Use `overscroll-behavior: none` to prevent pull-to-refresh.
  - Left Sidebar: Collapsible on mobile (hamburger menu), fixed on desktop.
  - Chat Bubble area: `flex-1`, scrollable (`scrollbar-thin`).
  - Input area: Sticky at the bottom, auto-resizing `textarea` up to a max-height.

## 3. MICRO-INTERACTIONS & ANIMATIONS
Never create a static, boring UI. The target audience loves dynamic interfaces.
- **Framer Motion:** Use it for ALL mount/unmount animations.
  - Modals/Dialogs: `initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}`
  - Buttons/Cards hover: `whileHover={{ scale: 1.02 }}`
  - Click feedback: `whileTap={{ scale: 0.95 }}`
- **Custom CSS Animations (defined in index.css):**
  - When AI is streaming text or thinking: Use `animate-breathing` on the AI's avatar outline.
  - Streaming cursor: Use `animate-blink` for the text cursor `|`.

## 4. COMPONENT RULES (shadcn/ui & React)
- **Do not reinvent the wheel:** If a component exists in Radix UI / shadcn (e.g., Dialog, Dropdown, Tooltip, Switch), USE IT. Do not build custom popovers from scratch.
- **Icons:** Use `lucide-react`. Always pass `size` and consistent `className` colors.
- **Glassmorphism:** Use `backdrop-blur-md bg-oled-surface/80` for sticky headers or floating navbars.

## 5. CODE QUALITY & STRUCTURE
- Use TypeScript strictly. Define `Interfaces` for all props and data models before writing the component.
- Functional components only. Use arrow functions `const MyComponent = () => {}`.
- **State Management:** Keep UI components dumb. If a component handles complex logic (like chat streaming), extract it into a custom hook (e.g., `useChatStream.ts`).
- Avoid deeply nested ternaries in `className`. Use the `cn()` utility (clsx + tailwind-merge) for dynamic classes.
  - *Good:* `className={cn("bg-oled-surface p-4", isActive && "border-neon-blue")}`

When generating UI code, immediately apply these visual rules without me having to remind you about the OLED backgrounds or Neon accents.