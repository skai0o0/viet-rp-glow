import { motion } from "framer-motion";
import { ShieldAlert, Baby, Bot, UserCog, Scale } from "lucide-react";

const sections = [
  {
    icon: Baby,
    title: "1. Giới hạn độ tuổi (Nghiêm ngặt)",
    content: `Nền tảng này KHÔNG DÀNH CHO TRẺ EM. Bằng việc truy cập và sử dụng dịch vụ, bạn xác nhận và cam kết mình đã đủ 18 tuổi trở lên (hoặc độ tuổi trưởng thành theo quy định pháp luật tại quốc gia của bạn). Nếu bạn dưới 18 tuổi, vui lòng rời khỏi trang web ngay lập tức.`,
  },
  {
    icon: Bot,
    title: "2. Bản chất của Nội dung AI (Hư cấu 100%)",
    content: `Tất cả các nhân vật, đoạn hội thoại, tình huống và bối cảnh (Scenario) trên VietRP đều là sản phẩm của trí tưởng tượng và trí tuệ nhân tạo (AI).\n\nChúng KHÔNG đại diện cho người thật, sự kiện có thật hay bất kỳ tổ chức nào.\n\nCác quan điểm, phát ngôn hay hành động của AI không phản ánh quan điểm, đạo đức hay chính sách của đội ngũ phát triển VietRP.`,
  },
  {
    icon: UserCog,
    title: "3. Trách nhiệm của Người dùng (BYOK & Nội dung tự tạo)",
    content: `VietRP đóng vai trò là một giao diện (Client) trung gian. Chúng tôi không lưu trữ, phân phối hay chủ động tạo ra các nội dung vi phạm pháp luật.\n\nNgười dùng tự chịu trách nhiệm hoàn toàn về các đoạn hội thoại, thẻ nhân vật (Character Cards) mà mình tạo ra, tải lên hoặc lưu trữ.\n\nNgười dùng tự cung cấp và chịu trách nhiệm về API Key (OpenRouter, OpenAI, v.v.) của mình. Chúng tôi không can thiệp vào dữ liệu được truyền tải qua API của bạn.\n\nNghiêm cấm sử dụng nền tảng để tạo ra, mô phỏng hoặc chia sẻ các nội dung liên quan đến: Lạm dụng trẻ em (CSAM), bạo lực đời thực phi pháp, khủng bố, hoặc sử dụng hình ảnh người thật mà không có sự cho phép. Nếu phát hiện, tài khoản sẽ bị khóa vĩnh viễn không cần báo trước.`,
  },
  {
    icon: Scale,
    title: "4. Miễn trừ trách nhiệm pháp lý",
    content: `Bạn đồng ý sử dụng VietRP với rủi ro tự chịu. Đội ngũ phát triển VietRP sẽ KHÔNG chịu bất kỳ trách nhiệm pháp lý nào đối với:\n\n• Sự tổn thương tâm lý, cảm xúc hoặc những hậu quả phát sinh từ việc bạn tương tác với các nhân vật AI.\n\n• Việc lộ lọt API Key hoặc dữ liệu cá nhân do thiết bị của bạn bị tấn công hoặc do chính sách của bên cung cấp API thứ ba.\n\n• Bất kỳ khiếu nại, tranh chấp nào từ bên thứ ba liên quan đến nội dung bạn tự tạo ra trên nền tảng.\n\nBằng việc tiếp tục sử dụng web, bạn đồng ý vô điều kiện với toàn bộ các điều khoản trên.`,
  },
];

const TermsPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-destructive/10 mb-4">
            <ShieldAlert className="w-7 h-7 text-destructive" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Tuyên Bố Miễn Trừ Trách Nhiệm & Điều Khoản Sử Dụng
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">VietRP</p>
        </motion.div>

        <div className="space-y-6">
          {sections.map((section, i) => {
            const Icon = section.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="rounded-xl border border-border bg-card p-5 sm:p-6"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted">
                    <Icon className="w-5 h-5 text-foreground" />
                  </div>
                  <h2 className="text-base sm:text-lg font-semibold text-foreground">
                    {section.title}
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {section.content}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
