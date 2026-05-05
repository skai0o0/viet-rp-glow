import { Home, MessageSquare, PlusCircle, Settings, User } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

const navItems = [
  { icon: Home, label: "Khám phá", path: "/" },
  { icon: MessageSquare, label: "Chat", path: "/chat" },
  { icon: PlusCircle, label: "Tạo", path: "/create" },
  { icon: User, label: "Hồ sơ", path: "/profile" },
  { icon: Settings, label: "Cài đặt", path: "/settings" },
];

const BottomNavBar = () => {
  const location = useLocation();

  const isItemActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-oled-surface/95 backdrop-blur-lg border-t border-gray-border flex items-center justify-around px-1"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        height: "calc(3.5rem + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {navItems.map((item) => {
        const isActive = isItemActive(item.path);
        const Icon = item.icon;

        return (
          <NavLink key={item.path} to={item.path} className="flex-1">
            <motion.div
              whileTap={{ scale: 0.85 }}
              className="flex flex-col items-center gap-0.5 py-1"
            >
              <div
                className={`flex items-center justify-center w-10 h-8 rounded-lg transition-colors duration-200 ${
                  isActive
                    ? "text-neon-purple bg-neon-purple/10"
                    : "text-muted-foreground active:text-foreground"
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
              </div>
              <span
                className={`text-[10px] leading-tight transition-colors duration-200 ${
                  isActive ? "text-neon-purple font-medium" : "text-muted-foreground"
                }`}
              >
                {item.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-indicator"
                  className="absolute bottom-1 w-6 h-[2px] rounded-full bg-neon-purple shadow-neon-purple"
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                />
              )}
            </motion.div>
          </NavLink>
        );
      })}
    </nav>
  );
};

export default BottomNavBar;
