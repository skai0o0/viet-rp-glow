import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Coins, RefreshCw, Package, History, ArrowRight, ArrowDownLeft, ArrowUpRight, Gift, ShoppingCart, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useUserCredits } from "@/hooks/useUserCredits";
import { useUserRole } from "@/hooks/useUserRole";
import { fetchCreditHistory, fetchCreditPackages, type CreditTransaction, type CreditPackage } from "@/services/creditDb";

const TX_TYPE_LABELS: Record<string, string> = {
  purchase: "Mua credit",
  subscription: "Gói đăng ký",
  usage: "Sử dụng",
  admin_grant: "Admin cấp",
  refund: "Hoàn tiền",
};

const TX_TYPE_ICONS: Record<string, typeof ArrowDownLeft> = {
  purchase: ShoppingCart,
  subscription: Package,
  usage: ArrowUpRight,
  admin_grant: Gift,
  refund: ArrowDownLeft,
};

const CreditsPage = () => {
  const { balance, loading: balanceLoading, refresh: refreshBalance } = useUserCredits();
  const { isAdminOrOp } = useUserRole();
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [pkgLoading, setPkgLoading] = useState(true);

  const loadData = useCallback(async () => {
    setTxLoading(true);
    setPkgLoading(true);
    const [tx, pkgs] = await Promise.all([fetchCreditHistory(), fetchCreditPackages()]);
    setTransactions(tx);
    setPackages(pkgs);
    setTxLoading(false);
    setPkgLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = async () => {
    await refreshBalance();
    await loadData();
    toast.success("Đã làm mới!");
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin bg-oled-base p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-lg mx-auto space-y-6"
      >
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-oled-elevated border border-gray-border flex items-center justify-center mx-auto mb-6">
            <Coins className="text-neon-purple" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Credit</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý credit và mua thêm khi cần.
          </p>
        </div>

        {/* Balance Card */}
        <div className="bg-oled-surface border border-gray-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-neon-purple shadow-neon-purple" />
              <h2 className="text-sm font-semibold text-foreground">Số dư</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="h-7 px-2 text-muted-foreground hover:text-foreground"
            >
              <RefreshCw size={14} className={balanceLoading ? "animate-spin" : ""} />
            </Button>
          </div>

          <div className="flex items-center justify-center py-4">
            <div className="text-center">
              <div className="flex items-center gap-2 justify-center">
                <Coins size={32} className="text-neon-purple" />
                <span className="text-4xl font-bold font-mono text-foreground">
                  {balanceLoading ? "..." : balance.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">credit khả dụng</p>
            </div>
          </div>

          {/* Info */}
          <div className="bg-oled-elevated rounded-xl p-3">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Credit được sử dụng khi hết lượt chat hàng ngày. Mỗi tin nhắn tốn 1 credit. Credit không giới hạn thời gian sử dụng.
            </p>
          </div>
        </div>

        {/* Credit Packages */}
        <div className="bg-oled-surface border border-gray-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-neon-blue shadow-neon-blue" />
            <h2 className="text-sm font-semibold text-foreground">Gói credit</h2>
          </div>

          {pkgLoading ? (
            <div className="flex items-center justify-center py-6">
              <RefreshCw size={20} className="animate-spin text-neon-blue" />
            </div>
          ) : packages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Chưa có gói credit nào.
            </p>
          ) : (
            <div className="space-y-3">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-oled-elevated border border-gray-border"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-neon-blue/10 flex items-center justify-center">
                      <Package size={18} className="text-neon-blue" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{pkg.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {pkg.credits.toLocaleString()} credit
                        {pkg.discount_percent > 0 && (
                          <span className="ml-1 text-neon-purple">(-{pkg.discount_percent}%)</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold font-mono text-foreground">
                      {pkg.price.toLocaleString()}đ
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px] text-neon-blue hover:text-neon-purple"
                      onClick={() => toast.info("Liên hệ admin để mua credit.")}
                    >
                      Mua
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Contact admin CTA */}
          <div className="bg-gradient-to-r from-neon-blue/10 via-oled-elevated to-neon-purple/10 rounded-xl p-4 border border-neon-blue/20">
            <p className="text-xs text-muted-foreground text-center">
              Để mua credit, vui lòng liên hệ admin qua fanpage hoặc Discord.
            </p>
          </div>
        </div>

        {/* Transaction History */}
        <div className="bg-oled-surface border border-gray-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-neon-rose shadow-neon-rose" />
              <h2 className="text-sm font-semibold text-foreground">Lịch sử giao dịch</h2>
            </div>
            {isAdminOrOp && (
              <Link to="/admin/credits">
                <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] text-muted-foreground hover:text-neon-purple">
                  Quản lý <ArrowRight size={12} className="ml-1" />
                </Button>
              </Link>
            )}
          </div>

          {txLoading ? (
            <div className="flex items-center justify-center py-6">
              <RefreshCw size={20} className="animate-spin text-neon-rose" />
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Chưa có giao dịch nào.
            </p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => {
                const Icon = TX_TYPE_ICONS[tx.type] || ArrowDownLeft;
                const isPositive = tx.amount > 0;
                return (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-oled-elevated border border-gray-border"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isPositive ? "bg-green-500/10" : "bg-red-500/10"
                    }`}>
                      <Icon size={14} className={isPositive ? "text-green-400" : "text-red-400"} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {TX_TYPE_LABELS[tx.type] || tx.type}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {tx.description}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xs font-mono font-bold ${
                        isPositive ? "text-green-400" : "text-red-400"
                      }`}>
                        {isPositive ? "+" : ""}{tx.amount}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {tx.balance_after.toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Link to Settings */}
        <Link to="/settings">
          <Button
            variant="outline"
            className="w-full border-gray-border text-foreground hover:border-neon-purple hover:text-neon-purple"
          >
            <Settings size={16} className="mr-2" />
            Cài đặt & Gói đăng ký
          </Button>
        </Link>
      </motion.div>
    </div>
  );
};

export default CreditsPage;
