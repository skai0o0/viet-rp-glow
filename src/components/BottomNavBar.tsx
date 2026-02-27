import { useState } from "react";
import { Home, MessageSquare, PlusCircle, Settings, User, LogOut, Key, UserCheck, UserX, ShieldCheck, FileText, Palette, ShieldAlert } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { upsertProfile } from "@/services/profileDb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { copyToClipboard } from "@/utils/clipboard";

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

  const [nsfwMode, setNsfwMode] = useState(() => localStorage.getItem("vietrp_nsfw_mode") === "true");

  const handleNsfwToggle = async (checked: boolean) => {
    setNsfwMode(checked);
    localStorage.setItem("vietrp_nsfw_mode", String(checked));
    if (user) {
      try {
        await upsertProfile(user.id, { nsfw_mode: checked });
        toast.success(checked ? "Đã bật NSFW" : "Đã tắt NSFW");
      } catch {
        toast.error("Không thể lưu cài đặt.");
      }
    }
  };

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
          onClick={async () => {
            try {
              const mod = await import("turndown");
              const TurndownService = mod.default ?? mod;
              const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
              const main = document.querySelector("main") || document.body;
              const md = td.turndown(main.innerHTML);
              await copyToClipboard(md);
              toast.success("Đã copy markdown vào clipboard");
            } catch (err) {
              console.error("Copy MD error:", err);
              toast.error("Không thể copy markdown");
            }
          }}
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
          <DropdownMenuContent side="top" align="center" className="bg-oled-elevated border-gray-border w-56 mb-2 z-50">
            <DropdownMenuItem onClick={() => navigate("/settings")} className="text-foreground focus:bg-oled-surface cursor-pointer">
              <Key size={14} className="mr-2" /> Thẻ API của tôi
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-gray-border" />
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Cài đặt hệ thống</DropdownMenuLabel>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-foreground focus:bg-oled-surface cursor-pointer">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={14} />
                  <span>NSFW</span>
                </div>
                <Switch checked={nsfwMode} onCheckedChange={handleNsfwToggle} className="scale-90" />
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem className="text-foreground/40 focus:bg-oled-surface cursor-default" disabled>
              <Palette size={14} className="mr-2" /> Theme: Cyberpunk (sắp ra mắt)
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
