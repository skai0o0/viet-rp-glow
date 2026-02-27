import { useState } from "react";
import { Home, MessageSquare, PlusCircle, Settings, User, LogOut, Key, UserCheck, UserX, ShieldCheck, FileText, Palette, ShieldAlert } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Switch } from "@/components/ui/switch";
import { upsertProfile } from "@/services/profileDb";
import logoImg from "@/assets/logo.png";
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
    <nav className="hidden md:flex flex-col items-center w-16 h-[100dvh] bg-oled-surface border-r border-gray-border py-4 flex-shrink-0">
      {/* Brand */}
      <NavLink to="/" className="mb-6 block">
        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
          <img
            src={logoImg}
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
        {/* Export Markdown - only for admins on chat pages */}
        {isAdmin && (
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={async () => {
                  try {
                    const mod = await import("turndown");
                    const TurndownService = mod.default ?? mod;
                    const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
                    const main = document.querySelector("main") || document.body;
                    const md = td.turndown(main.innerHTML);
                    await navigator.clipboard.writeText(md);
                    toast.success("Đã copy markdown vào clipboard");
                  } catch (err) {
                    console.error("Copy MD error:", err);
                    toast.error("Không thể copy markdown");
                  }
                }}
                className="relative flex items-center justify-center w-10 h-10 rounded-xl transition-colors duration-200 text-neon-rose/60 hover:text-neon-rose hover:bg-neon-rose/10"
              >
                <FileText size={20} />
              </motion.button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-oled-elevated border-gray-border text-foreground">
              Copy Markdown
            </TooltipContent>
          </Tooltip>
        )}

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
            <DropdownMenuContent side="right" align="end" className="bg-oled-elevated border-gray-border w-56 z-50">
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
