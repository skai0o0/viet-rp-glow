import { Home, MessageSquare, PlusCircle, Settings, User } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const topItems = [
  { icon: Home, label: "Khám phá", path: "/" },
  { icon: MessageSquare, label: "Cuộc trò chuyện", path: "/chat" },
  { icon: PlusCircle, label: "Tạo nhân vật", path: "/create" },
];

const bottomItems = [
  { icon: Settings, label: "Cài đặt", path: "/settings" },
  { icon: User, label: "Hồ sơ", path: "/profile" },
];

const NavItem = ({
  item,
}: {
  item: { icon: React.ElementType; label: string; path: string };
}) => {
  const location = useLocation();
  const isActive = location.pathname === item.path;
  const Icon = item.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavLink to={item.path} className="block">
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-colors duration-200 ${
              isActive
                ? "text-neon-purple shadow-neon-purple bg-neon-purple/10"
                : "text-muted-foreground hover:text-foreground hover:bg-oled-elevated"
            }`}
          >
            <Icon size={20} />
            {isActive && (
              <motion.div
                layoutId="nav-indicator"
                className="absolute -left-[14px] w-[3px] h-5 rounded-r-full bg-neon-purple shadow-neon-purple"
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              />
            )}
          </motion.div>
        </NavLink>
      </TooltipTrigger>
      <TooltipContent side="right" className="bg-oled-elevated border-gray-border text-foreground">
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
};

const NavigationRail = () => {
  return (
    <nav className="hidden md:flex flex-col items-center w-16 h-screen bg-oled-surface border-r border-gray-border py-4 flex-shrink-0">
      {/* Brand */}
      <div className="mb-6">
        <span className="text-xs font-bold text-neon-purple neon-text-purple">V</span>
      </div>

      {/* Top items */}
      <div className="flex flex-col items-center gap-2 flex-1">
        {topItems.map((item) => (
          <NavItem key={item.path} item={item} />
        ))}
      </div>

      {/* Bottom items */}
      <div className="flex flex-col items-center gap-2">
        {bottomItems.map((item) => (
          <NavItem key={item.path} item={item} />
        ))}
      </div>
    </nav>
  );
};

export default NavigationRail;
