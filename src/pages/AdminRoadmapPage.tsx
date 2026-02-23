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
      { title: "Hệ thống xác thực người dùng", description: "Đăng ký, đăng nhập, quản lý phiên", status: "done" },
      { title: "Tạo & quản lý nhân vật", description: "CRUD nhân vật với TavernCardV2", status: "done" },
      { title: "Chat cơ bản với AI", description: "Gửi/nhận tin nhắn qua OpenRouter", status: "done" },
      { title: "Trang Admin cơ bản", description: "Global system prompt, import JSON", status: "done" },
    ],
  },
  {
    phase: "Phase 2",
    label: "Trải nghiệm người dùng",
    items: [
      { title: "Giao diện responsive", description: "Tối ưu mobile, tablet, desktop", status: "done" },
      { title: "Profile & cài đặt cá nhân", description: "Tên hiển thị, mô tả, NSFW mode", status: "done" },
      { title: "Quản lý lịch sử chat", description: "Nhiều phiên chat, xoá phiên", status: "done" },
      { title: "Banner sự kiện", description: "Hiển thị banner theo dịp đặc biệt", status: "done" },
    ],
  },
  {
    phase: "Phase 3",
    label: "Nâng cao & Mở rộng",
    items: [
      { title: "Hub nhân vật công khai", description: "Duyệt & tìm kiếm nhân vật cộng đồng", status: "in-progress" },
      { title: "Hệ thống tag & lọc", description: "Phân loại nhân vật theo thể loại", status: "in-progress" },
      { title: "Roadmap phát triển", description: "Trang hiển thị lộ trình cho admin", status: "in-progress" },
      { title: "Tối ưu prompt builder", description: "Cải thiện chất lượng hội thoại", status: "planned" },
    ],
  },
  {
    phase: "Phase 4",
    label: "Tương lai",
    items: [
      { title: "Hệ thống thông báo", description: "Thông báo real-time cho người dùng", status: "planned" },
      { title: "Chia sẻ nhân vật qua link", description: "Chia sẻ & clone nhân vật", status: "planned" },
      { title: "Đa ngôn ngữ (i18n)", description: "Hỗ trợ tiếng Anh & các ngôn ngữ khác", status: "planned" },
      { title: "API công khai", description: "REST API cho developer bên ngoài", status: "planned" },
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
