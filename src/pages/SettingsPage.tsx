import { motion } from "framer-motion";
import { Settings } from "lucide-react";

const SettingsPage = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-oled-base p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-oled-elevated border border-gray-border flex items-center justify-center mx-auto mb-6">
          <Settings className="text-muted-foreground" size={28} />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Cài Đặt
        </h1>
        <p className="text-sm text-muted-foreground max-w-md">
          Tuỳ chỉnh trải nghiệm VietRP của bạn.
        </p>
      </motion.div>
    </div>
  );
};

export default SettingsPage;
