import { Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import NavigationRail from "@/components/NavigationRail";
import BottomNavBar from "@/components/BottomNavBar";

const AppLayout = () => {
  const location = useLocation();

  return (
    <div className="h-[100dvh] flex bg-oled-base overflow-clip overscroll-none [-webkit-tap-highlight-color:transparent]">
      {/* Desktop Navigation Rail */}
      <NavigationRail />

      {/* Main content area */}
      <div
        className="flex-1 flex flex-col min-w-0 md:!pb-0"
        style={{ paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <AnimatePresence mode="popLayout">
          <motion.main
            key={location.pathname}
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
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
