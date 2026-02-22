import { motion } from "framer-motion";
import { Compass } from "lucide-react";

const HomePage = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-oled-base p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-neon-purple/10 border border-neon-purple/20 flex items-center justify-center mx-auto mb-6">
          <Compass className="text-neon-purple" size={28} />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2 neon-text-purple">
          Khu vực Khám Phá Nhân Vật
        </h1>
        <p className="text-sm text-muted-foreground max-w-md">
          Khám phá hàng ngàn nhân vật roleplay độc đáo được tạo bởi cộng đồng VietRP.
        </p>
      </motion.div>
    </div>
  );
};

export default HomePage;
