import { Outlet } from "react-router-dom";
import NavigationRail from "@/components/NavigationRail";
import BottomNavBar from "@/components/BottomNavBar";

const AppLayout = () => {
  return (
    <div className="h-screen flex bg-oled-base overflow-hidden">
      {/* Desktop Navigation Rail */}
      <NavigationRail />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <Outlet />
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNavBar />
    </div>
  );
};

export default AppLayout;
