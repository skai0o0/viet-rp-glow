import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Loader2, Map, CheckCircle2, Circle, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

const ADMIN_EMAILS = ["hoangskai0o0nam2006@gmail.com"];
function isAdmin(email?: string): boolean {
  return !!email && ADMIN_EMAILS.includes(email);
}

type Status = "done" | "in-progress" | "planned";

interface RoadmapItem {
  title: string;
  description: string;
  status: Status;
}

interface RoadmapPhase {
  phase: string;
  label: string;
  items: RoadmapItem[];
}

const roadmap: RoadmapPhase[] = [
  {
    phase: "Phase 1",
    label: "Nền tảng cốt lõi",
    items: [
      { title: "Xác thực người dùng", description: "Đăng ký, đăng nhập, quản lý phiên với Supabase Auth", status: "done" },
      { title: "Tạo nhân vật (TavernCardV2)", description: "Form tạo đầy đủ: tên, mô tả, personality, scenario, first message, alternate greetings", status: "done" },
      { title: "Chỉnh sửa nhân vật", description: "Sửa mọi trường của nhân vật đã tạo, upload avatar", status: "done" },
      { title: "Import nhân vật từ JSON", description: "Nhập file TavernCardV2 JSON để tạo nhân vật nhanh", status: "done" },
      { title: "Chat AI qua OpenRouter", description: "Streaming chat, chọn model, cấu hình API key", status: "done" },
      { title: "Lưu trữ dữ liệu cloud", description: "Nhân vật, chat sessions, messages lưu trên Supabase", status: "done" },
    ],
  },
  {
    phase: "Phase 2",
    label: "Chat nâng cao",
    items: [
      { title: "Nhiều phiên chat", description: "Tạo, chuyển, xoá nhiều phiên chat cho mỗi nhân vật", status: "done" },
      { title: "Sidebar lịch sử chat", description: "Danh sách phiên chat với tìm kiếm & quản lý", status: "done" },
      { title: "Chỉnh sửa & xoá tin nhắn", description: "Sửa, xoá từng tin nhắn, regenerate phản hồi AI", status: "done" },
      { title: "Branch chat session", description: "Tạo nhánh hội thoại mới từ một điểm bất kỳ", status: "done" },
      { title: "Generation Settings", description: "Tuỳ chỉnh max tokens, phong cách trả lời, chọn model trong chat", status: "done" },
      { title: "System prompt nâng cao", description: "Prompt builder tự động: persona, scenario, character book, macros {{user}}/{{char}}", status: "done" },
      { title: "Character Book (Lorebook)", description: "Quản lý world info entries với keywords & conditions", status: "done" },
    ],
  },
  {
    phase: "Phase 3",
    label: "Trải nghiệm người dùng",
    items: [
      { title: "Giao diện responsive", description: "Navigation rail (desktop), bottom nav (mobile), auto-fill grid layout", status: "done" },
      { title: "Profile cá nhân", description: "Tên hiển thị, mô tả bản thân, quản lý nhân vật của tôi", status: "done" },
      { title: "Cài đặt API & Model", description: "Nhập OpenRouter API key, verify key, chọn model mặc định", status: "done" },
      { title: "NSFW Filter", description: "Lọc nhân vật NSFW theo tags & keywords, toggle NSFW mode", status: "done" },
      { title: "Banner sự kiện", description: "Hiển thị banner quảng bá theo dịp đặc biệt từ database", status: "done" },
      { title: "Tìm kiếm & lọc nhân vật", description: "Search bar, filter theo tags trên trang chủ", status: "done" },
      { title: "Preview nhân vật", description: "Dialog xem trước thông tin nhân vật trước khi chat", status: "done" },
    ],
  },
  {
    phase: "Phase 4",
    label: "Quản trị & Hệ thống",
    items: [
      { title: "Trang Admin", description: "Dashboard quản trị với kiểm soát truy cập theo email", status: "done" },
      { title: "Global System Prompt", description: "Prompt âm thầm áp dụng cho mọi cuộc trò chuyện", status: "done" },
      { title: "Admin import nhân vật", description: "Import JSON tạo nhân vật công khai từ admin", status: "done" },
      { title: "Roadmap phát triển", description: "Trang hiển thị lộ trình tính năng cho admin", status: "done" },
      { title: "Protected routes", description: "Bảo vệ trang Create, Settings, Profile, Admin", status: "done" },
    ],
  },
  {
    phase: "Phase 5",
    label: "Dự kiến tương lai",
    items: [
      { title: "Hub nhân vật cộng đồng", description: "Duyệt, tìm kiếm & clone nhân vật từ cộng đồng", status: "in-progress" },
      { title: "Chia sẻ nhân vật qua link", description: "Tạo link chia sẻ & cho phép clone nhân vật", status: "planned" },
      { title: "Hệ thống thông báo", description: "Thông báo real-time cho người dùng", status: "planned" },
      { title: "Đa ngôn ngữ (i18n)", description: "Hỗ trợ tiếng Anh & các ngôn ngữ khác", status: "planned" },
      { title: "Nhóm chat & multi-character", description: "Chat với nhiều nhân vật trong cùng một phiên", status: "planned" },
      { title: "Voice & TTS", description: "Đọc phản hồi AI bằng giọng nói", status: "planned" },
    ],
  },
];

const statusConfig: Record<Status, { icon: React.ElementType; label: string; color: string }> = {
  done: { icon: CheckCircle2, label: "Hoàn thành", color: "text-green-400" },
  "in-progress": { icon: Clock, label: "Đang làm", color: "text-yellow-400" },
  planned: { icon: Circle, label: "Dự kiến", color: "text-muted-foreground" },
};

const AdminRoadmapPage = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-oled-base">
        <Loader2 size={24} className="animate-spin text-neon-purple" />
      </div>
    );
  }

  if (!user || !isAdmin(user.email)) {
    return <Navigate to="/" replace />;
  }

  return (
    <ScrollArea className="flex-1">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 md:p-8 max-w-4xl mx-auto w-full space-y-8 pb-24"
      >
        <div className="flex items-center gap-3">
          <Map className="text-neon-blue" size={28} />
          <h1 className="text-2xl font-bold text-foreground">Roadmap phát triển</h1>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          {Object.entries(statusConfig).map(([key, { icon: Icon, label, color }]) => (
            <span key={key} className={`flex items-center gap-1.5 ${color}`}>
              <Icon size={14} /> {label}
            </span>
          ))}
        </div>

        {roadmap.map((phase, i) => (
          <motion.div
            key={phase.phase}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="border-neon-purple text-neon-purple text-xs">
                {phase.phase}
              </Badge>
              <span className="text-sm font-semibold text-foreground">{phase.label}</span>
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
              {phase.items.map((item) => {
                const { icon: StatusIcon, color } = statusConfig[item.status];
                return (
                  <Card key={item.title} className="bg-oled-surface border-oled-border">
                    <CardHeader className="p-3 pb-1">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <StatusIcon size={14} className={color} />
                        <span className="text-foreground">{item.title}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </ScrollArea>
  );
};

export default AdminRoadmapPage;
