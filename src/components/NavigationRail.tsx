import { Home, MessageSquare, PlusCircle, Settings, User, LogOut, Key, UserCheck, UserX, ShieldCheck } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

const topItems = [
  { icon: Home, label: "Khám phá", path: "/" },
  { icon: MessageSquare, label: "Cuộc trò chuyện", path: "/chat" },
  { icon: PlusCircle, label: "Tạo nhân vật", path: "/create" },
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
  const { user, logout } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    toast.success("Đã đăng xuất");
    navigate("/");
  };

  return (
    <nav className="hidden md:flex flex-col items-center w-16 h-screen bg-oled-surface border-r border-gray-border py-4 flex-shrink-0">
      {/* Brand */}
      <NavLink to="/" className="mb-6 block">
        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
          <img
            src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ29FmznIurzWTiRoFHhR9CTJJWVTLAaV3gtw&s"
            alt="VietRP Logo"
            className="w-8 h-8 rounded-lg object-cover"
          />
        </motion.div>
      </NavLink>

      {/* Top items */}
      <div className="flex flex-col items-center gap-2 flex-1">
        {topItems.map((item) => (
          <NavItem key={item.path} item={item} />
        ))}
      </div>

      {/* Bottom items */}
      <div className="flex flex-col items-center gap-2">
        {/* Admin Hub - only for admins */}
        {isAdmin && (
          <Tooltip>
            <TooltipTrigger asChild>
              <NavLink to="/admin" className="block">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-colors duration-200 ${
                    location.pathname.startsWith("/admin")
                      ? "text-neon-rose shadow-neon-rose bg-neon-rose/10"
                      : "text-neon-rose/60 hover:text-neon-rose hover:bg-neon-rose/10"
                  }`}
                >
                  <ShieldCheck size={20} />
                  {location.pathname.startsWith("/admin") && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute -left-[14px] w-[3px] h-5 rounded-r-full bg-neon-rose shadow-neon-rose"
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    />
                  )}
                </motion.div>
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-oled-elevated border-gray-border text-foreground">
              Admin Hub
            </TooltipContent>
          </Tooltip>
        )}
        {/* Settings dropdown */}
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-colors duration-200 ${
                  location.pathname === "/settings"
                    ? "text-neon-purple shadow-neon-purple bg-neon-purple/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-oled-elevated"
                }`}
              >
                <Settings size={20} />
              </motion.button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="bg-oled-elevated border-gray-border w-52 z-50">
              <DropdownMenuItem onClick={() => navigate("/settings")} className="text-foreground focus:bg-oled-surface cursor-pointer">
                <Key size={14} className="mr-2" /> Thẻ API của tôi
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-border" />
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Trạng thái</DropdownMenuLabel>
              <DropdownMenuItem className="text-foreground focus:bg-oled-surface cursor-pointer">
                <UserCheck size={14} className="mr-2 text-neon-blue" /> Hướng ngoại (Online)
              </DropdownMenuItem>
              <DropdownMenuItem className="text-foreground focus:bg-oled-surface cursor-pointer">
                <UserX size={14} className="mr-2 text-muted-foreground" /> Hướng nội (Ẩn)
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-border" />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:bg-destructive/10 cursor-pointer">
                <LogOut size={14} className="mr-2" /> Đăng xuất
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <NavItem item={{ icon: Settings, label: "Cài đặt", path: "/settings" }} />
        )}

        {/* Profile - direct link */}
        {user ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <NavLink to="/profile" className="block">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-colors duration-200 ${
                    location.pathname === "/profile"
                      ? "text-neon-purple shadow-neon-purple bg-neon-purple/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-oled-elevated"
                  }`}
                >
                  <User size={20} />
                  {location.pathname === "/profile" && (
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
              Hồ sơ
            </TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <NavLink to="/auth" className="block">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center justify-center w-10 h-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-oled-elevated transition-colors"
                >
                  <User size={20} />
                </motion.div>
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-oled-elevated border-gray-border text-foreground">
              Đăng nhập
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </nav>
  );
};

export default NavigationRail;
