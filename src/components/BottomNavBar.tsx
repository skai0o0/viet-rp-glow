import { Home, MessageSquare, PlusCircle, Settings, User, LogOut, Key, UserCheck, UserX, ShieldCheck, FileText } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { icon: Home, label: "Khám phá", path: "/" },
  { icon: MessageSquare, label: "Chat", path: "/chat" },
  { icon: PlusCircle, label: "Tạo", path: "/create" },
];

const BottomNavBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isAdmin } = useIsAdmin();

  const handleLogout = async () => {
    await logout();
    toast.success("Đã đăng xuất");
    navigate("/");
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-oled-surface border-t border-gray-border flex items-center justify-around px-2" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', height: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}>
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

      {/* Export Markdown - only for admins on chat pages */}
      {isAdmin && (
        <button
          className="flex-1"
          onClick={() => window.dispatchEvent(new CustomEvent("export-chat-markdown"))}
        >
          <motion.div
            whileTap={{ scale: 0.9 }}
            className="flex flex-col items-center gap-0.5"
          >
            <div className="flex items-center justify-center w-10 h-8 rounded-lg text-neon-rose/60 transition-colors duration-200">
              <FileText size={20} />
            </div>
            <span className="text-[10px] text-neon-rose/60">MD</span>
          </motion.div>
        </button>
      )}

      {/* Admin Hub - only for admins */}
      {isAdmin && (
        <NavLink to="/admin" className="flex-1">
          <motion.div
            whileTap={{ scale: 0.9 }}
            className="flex flex-col items-center gap-0.5"
          >
            <div
              className={`flex items-center justify-center w-10 h-8 rounded-lg transition-colors duration-200 ${
                location.pathname.startsWith("/admin")
                  ? "text-neon-rose bg-neon-rose/10"
                  : "text-neon-rose/60"
              }`}
            >
              <ShieldCheck size={20} />
            </div>
            <span
              className={`text-[10px] transition-colors duration-200 ${
                location.pathname.startsWith("/admin") ? "text-neon-rose font-medium" : "text-neon-rose/60"
              }`}
            >
              Admin
            </span>
          </motion.div>
        </NavLink>
      )}

      {/* Settings dropdown */}
      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex-1">
              <motion.div
                whileTap={{ scale: 0.9 }}
                className="flex flex-col items-center gap-0.5"
              >
                <div
                  className={`flex items-center justify-center w-10 h-8 rounded-lg transition-colors duration-200 ${
                    location.pathname === "/settings"
                      ? "text-neon-purple bg-neon-purple/10"
                      : "text-muted-foreground"
                  }`}
                >
                  <Settings size={20} />
                </div>
                <span
                  className={`text-[10px] transition-colors duration-200 ${
                    location.pathname === "/settings" ? "text-neon-purple font-medium" : "text-muted-foreground"
                  }`}
                >
                  Cài đặt
                </span>
              </motion.div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="center" className="bg-oled-elevated border-gray-border w-52 mb-2 z-50">
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
        <NavLink to="/settings" className="flex-1">
          <motion.div
            whileTap={{ scale: 0.9 }}
            className="flex flex-col items-center gap-0.5"
          >
            <div className="flex items-center justify-center w-10 h-8 rounded-lg text-muted-foreground transition-colors duration-200">
              <Settings size={20} />
            </div>
            <span className="text-[10px] text-muted-foreground">Cài đặt</span>
          </motion.div>
        </NavLink>
      )}

      {/* Profile - direct link */}
      {user ? (
        <NavLink to="/profile" className="flex-1">
          <motion.div
            whileTap={{ scale: 0.9 }}
            className="flex flex-col items-center gap-0.5"
          >
            <div
              className={`flex items-center justify-center w-10 h-8 rounded-lg transition-colors duration-200 ${
                location.pathname === "/profile"
                  ? "text-neon-purple bg-neon-purple/10"
                  : "text-muted-foreground"
              }`}
            >
              <User size={20} />
            </div>
            <span
              className={`text-[10px] transition-colors duration-200 ${
                location.pathname === "/profile" ? "text-neon-purple font-medium" : "text-muted-foreground"
              }`}
            >
              Hồ sơ
            </span>
          </motion.div>
        </NavLink>
      ) : (
        <NavLink to="/auth" className="flex-1">
          <motion.div
            whileTap={{ scale: 0.9 }}
            className="flex flex-col items-center gap-0.5"
          >
            <div className="flex items-center justify-center w-10 h-8 rounded-lg text-muted-foreground transition-colors duration-200">
              <User size={20} />
            </div>
            <span className="text-[10px] text-muted-foreground">Đăng nhập</span>
          </motion.div>
        </NavLink>
      )}
    </nav>
  );
};

export default BottomNavBar;
