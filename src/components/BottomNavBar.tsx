import { Home, MessageSquare, PlusCircle, Settings, User } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

const navItems = [
  { icon: Home, label: "Khám phá", path: "/" },
  { icon: MessageSquare, label: "Chat", path: "/chat" },
  { icon: PlusCircle, label: "Tạo", path: "/create" },
  { icon: Settings, label: "Cài đặt", path: "/settings" },
  { icon: User, label: "Hồ sơ", path: "/profile" },
];

const BottomNavBar = () => {
  const location = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 bg-oled-surface border-t border-gray-border flex items-center justify-around px-2">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        const Icon = item.icon;

        return (
          <NavLink key={item.path} to={item.path} className="flex-1">
            <motion.div
              whileTap={{ scale: 0.9 }}
              className="flex flex-col items-center gap-0.5"
            >
              <div
                className={`flex items-center justify-center w-10 h-8 rounded-lg transition-colors duration-200 ${
                  isActive
                    ? "text-neon-purple bg-neon-purple/10"
                    : "text-muted-foreground"
                }`}
              >
                <Icon size={20} />
              </div>
              <span
                className={`text-[10px] transition-colors duration-200 ${
                  isActive ? "text-neon-purple font-medium" : "text-muted-foreground"
                }`}
              >
                {item.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-indicator"
                  className="absolute bottom-1 w-8 h-[2px] rounded-full bg-neon-purple shadow-neon-purple"
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
