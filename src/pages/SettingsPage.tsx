import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Settings, Check, Loader2, Info, Crown, Zap, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getSelectedTier, setSelectedTier } from "@/services/openRouter";
import { useChatQuota } from "@/hooks/useChatQuota";
import TierSelector from "@/components/TierSelector";
import { useUserRole } from "@/hooks/useUserRole";
import { deriveChatAccess } from "@/utils/chatAccess";

const SettingsPage = () => {
  const navigate = useNavigate();
  const [tier, setTier] = useState("free");
  const { quota, loading: quotaLoading } = useChatQuota();
  const { role } = useUserRole();
  const { isSubscriptionUser, effectiveQuota } = useMemo(
    () => deriveChatAccess(role, quota),
    [role, quota],
  );

  useEffect(() => {
    setTier(getSelectedTier());
  }, []);

  const handleSave = () => {
    setSelectedTier(tier);
    toast.success("Đã lưu cài đặt!");
    navigate("/");
  };

  const isByok = !isSubscriptionUser;
  const isPro = isByok || effectiveQuota.tier === "all" || effectiveQuota.plan_name === "Pro";
  const quotaPercent = isSubscriptionUser && effectiveQuota.limit > 0
    ? Math.round((effectiveQuota.used / effectiveQuota.limit) * 100)
    : 0;

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin bg-oled-base p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-lg mx-auto space-y-8"
      >
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-oled-elevated border border-gray-border flex items-center justify-center mx-auto mb-6">
            <Settings className="text-muted-foreground" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Cài Đặt</h1>
          <p className="text-sm text-muted-foreground">
            Tuỳ chỉnh trải nghiệm VietRP của bạn.
          </p>
        </div>

        {/* Subscription Info Card */}
        <div className="bg-oled-surface border border-gray-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isPro ? "bg-neon-purple shadow-neon-purple" : "bg-neon-blue shadow-neon-blue"}`} />
            <h2 className="text-sm font-semibold text-foreground">Gói đăng ký</h2>
          </div>

          {quotaLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={20} className="animate-spin text-neon-purple" />
            </div>
          ) : !isSubscriptionUser ? (
            <div className="text-sm text-muted-foreground">
              Vai trò <span className="text-foreground font-semibold">{role}</span> sử dụng API Key riêng (BYOK) — không giới hạn tin nhắn. Quản lý key tại <span className="text-neon-purple font-medium">Admin Hub → API Global Settings</span>.
            </div>
          ) : (
            <>
              {/* Plan badge */}
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  isPro
                    ? "bg-gradient-to-br from-neon-purple to-neon-blue"
                    : "bg-oled-elevated border border-gray-border"
                }`}>
                  {isPro ? <Crown size={22} className="text-white" /> : <Zap size={22} className="text-muted-foreground" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-foreground">{effectiveQuota.plan_name}</span>
                    {isPro && (
                      <span className="text-[9px] font-bold bg-neon-purple/20 text-neon-purple px-1.5 py-0.5 rounded-full">
                        PRO
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isPro ? "Truy cập tất cả tier, 200 tin nhắn/ngày" : "VietRP Free tier, 20 tin nhắn/ngày"}
                  </p>
                </div>
              </div>

              {/* Quota progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <MessageSquare size={12} />
                    Tin nhắn hôm nay
                  </span>
                  <span className={`font-medium ${
                    effectiveQuota.remaining <= 0 ? "text-red-400" : effectiveQuota.remaining <= 5 ? "text-amber-400" : "text-foreground"
                  }`}>
                    {effectiveQuota.used}/{effectiveQuota.limit}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-oled-elevated overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(quotaPercent, 100)}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className={`h-full rounded-full ${
                      quotaPercent >= 100
                        ? "bg-red-500"
                        : quotaPercent >= 80
                          ? "bg-amber-500"
                          : "bg-neon-blue"
                    }`}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Còn lại <span className="text-foreground font-medium">{effectiveQuota.remaining}</span> tin nhắn. Reset lúc 00:00 mỗi ngày.
                </p>
              </div>

              {/* Upgrade CTA */}
              {!isPro && (
                <div className="bg-gradient-to-r from-neon-purple/10 via-oled-elevated to-neon-blue/10 rounded-xl p-4 border border-neon-purple/20">
                  <div className="flex items-start gap-3">
                    <Crown size={18} className="text-neon-purple mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Nâng cấp lên Pro</p>
                      <ul className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
                        <li>200 tin nhắn/ngày (gấp 10 lần)</li>
                        <li>Truy cập VietRP Pro & Ultra tier</li>
                        <li>Ưu tiên hỗ trợ</li>
                      </ul>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full mt-3 bg-neon-purple text-primary-foreground hover:shadow-neon-purple"
                    onClick={() => toast.info("Liên hệ admin để nâng cấp gói Pro.")}
                  >
                    <Crown size={14} className="mr-1.5" />
                    Liên hệ nâng cấp
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Tier Selector */}
        <div className="bg-oled-surface border border-gray-border rounded-2xl p-5 space-y-5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-neon-blue shadow-neon-blue" />
            <h2 className="text-sm font-semibold text-foreground">Chất lượng AI</h2>
          </div>

          <TierSelector value={tier} onValueChange={setTier} userTier={effectiveQuota.tier} />

          <div className="bg-oled-elevated rounded-xl p-3">
            <div className="flex items-start gap-1.5">
              <Info size={12} className="text-neon-blue mt-0.5 shrink-0" />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                {isPro
                  ? "Bạn có quyền truy cập tất cả tier. Chọn tier phù hợp nhất cho trải nghiệm roleplay."
                  : "Gói Free chỉ sử dụng được VietRP Free. Nâng cấp Pro để dùng tier cao hơn."
                }
              </p>
            </div>
          </div>

          {/* Save button */}
          <Button
            onClick={handleSave}
            className="w-full bg-neon-purple text-primary-foreground hover:shadow-neon-purple hover:scale-[1.02] transition-all duration-200"
          >
            <Check size={16} className="mr-2" />
            Lưu cài đặt
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default SettingsPage;
