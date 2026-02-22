import { motion } from "framer-motion";
import { User } from "lucide-react";

const ProfilePage = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-oled-base p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-oled-elevated border border-gray-border flex items-center justify-center mx-auto mb-6">
          <User className="text-muted-foreground" size={28} />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Hồ Sơ
        </h1>
        <p className="text-sm text-muted-foreground max-w-md">
          Quản lý tài khoản và thông tin cá nhân của bạn.
        </p>
      </motion.div>
    </div>
  );
};

export default ProfilePage;
