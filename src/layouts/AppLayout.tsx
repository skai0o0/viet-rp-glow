import { Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import NavigationRail from "@/components/NavigationRail";
import BottomNavBar from "@/components/BottomNavBar";

const pageTransition = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.2, ease: "easeOut" },
};

const AppLayout = () => {
  const location = useLocation();

  return (
    <div className="h-[100dvh] flex bg-oled-base overflow-hidden overscroll-none [-webkit-tap-highlight-color:transparent] pt-[env(safe-area-inset-top)]">
      {/* Desktop Navigation Rail */}
      <NavigationRail />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            initial={pageTransition.initial}
            animate={pageTransition.animate}
            exit={pageTransition.exit}
            transition={pageTransition.transition}
            className="flex-1 flex flex-col min-h-0"
          >
            <Outlet />
          </motion.main>
        </AnimatePresence>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNavBar />
    </div>
  );
};

export default AppLayout;
