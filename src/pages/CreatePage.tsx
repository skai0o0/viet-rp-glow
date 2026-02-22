import { motion } from "framer-motion";
import { PlusCircle } from "lucide-react";

const CreatePage = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-oled-base p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-neon-blue/10 border border-neon-blue/20 flex items-center justify-center mx-auto mb-6">
          <PlusCircle className="text-neon-blue" size={28} />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2 neon-text-blue">
          Tạo Nhân Vật Mới
        </h1>
        <p className="text-sm text-muted-foreground max-w-md">
          Thiết kế nhân vật roleplay của riêng bạn với tính cách, kịch bản và phong cách độc đáo.
        </p>
      </motion.div>
    </div>
  );
};

export default CreatePage;
