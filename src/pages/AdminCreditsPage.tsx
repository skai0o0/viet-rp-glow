import { useState, useEffect, useCallback } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  Coins,
  Users,
  Search,
  Gift,
  History,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchUserListWithCredits,
  grantCredits,
  fetchCreditHistory,
  type UserWithCredits,
  type CreditTransaction,
} from "@/services/creditDb";
import { AdminPageShell, AdminStatCard, AdminSection, AdminIconButton } from "@/admin/components";

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin: { label: "Admin", color: "bg-neon-rose/20 text-neon-rose" },
  op: { label: "Operator", color: "bg-neon-blue/20 text-neon-blue" },
  moderator: { label: "Moderator", color: "bg-yellow-400/20 text-yellow-400" },
  user: { label: "User", color: "bg-muted text-muted-foreground" },
};

const AdminCreditsPage = () => {
  const { isAdminOrOp, checking } = useUserRole();
  const [users, setUsers] = useState<UserWithCredits[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [grantTarget, setGrantTarget] = useState<UserWithCredits | null>(null);
  const [grantAmount, setGrantAmount] = useState("");
  const [grantDesc, setGrantDesc] = useState("");
  const [granting, setGranting] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<UserWithCredits | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const data = await fetchUserListWithCredits();
    setUsers(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  if (checking) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  if (!isAdminOrOp) {
    return <Navigate to="/" replace />;
  }

  const filtered = users.filter((u) =>
    u.display_name.toLowerCase().includes(search.toLowerCase()) ||
    u.user_id.includes(search)
  );

  const totalCredits = users.reduce((sum, u) => sum + u.balance, 0);

  const handleGrant = async () => {
    const amount = parseInt(grantAmount, 10);
    if (!amount || amount <= 0) {
      toast.error("Số credit phải lớn hơn 0");
      return;
    }
    if (!grantTarget) return;

    setGranting(true);
    const result = await grantCredits(grantTarget.user_id, amount, grantDesc || "Admin grant");
    setGranting(false);

    if (result.success) {
      toast.success(`Đã cấp ${amount} credit cho ${grantTarget.display_name}. Số dư mới: ${result.newBalance}`);
      setGrantTarget(null);
      setGrantAmount("");
      setGrantDesc("");
      loadUsers();
    } else {
      toast.error(result.error || "Không thể cấp credit");
    }
  };

  const openHistory = async (user: UserWithCredits) => {
    setHistoryTarget(user);
    setHistoryLoading(true);
    const txns = await fetchCreditHistory(user.user_id, 30);
    setTransactions(txns);
    setHistoryLoading(false);
  };

  return (
    <AdminPageShell
      backTo="/admin"
      icon={Coins}
      title="Quản lý Credit"
      subtitle="Cấp và quản lý credit cho user và moderator."
      actions={
        <AdminIconButton
          icon={RefreshCw}
          label="Tải lại"
          variant="outline"
          onClick={loadUsers}
        />
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AdminStatCard icon={Users} label="Tổng user" value={users.length} color="text-neon-blue" delay={0} />
        <AdminStatCard icon={Coins} label="Tổng credit" value={totalCredits.toLocaleString()} color="text-neon-purple" delay={0.05} />
        <AdminStatCard icon={TrendingUp} label="User có credit" value={users.filter((u) => u.balance > 0).length} color="text-neon-green" delay={0.1} />
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Tìm theo tên hoặc user ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-oled-surface border-gray-border text-foreground"
        />
      </div>

      {/* User Table */}
      <AdminSection title="Danh sách người dùng" icon={Users}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-neon-purple" size={24} />
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Tên</TableHead>
                    <TableHead className="text-muted-foreground">Vai trò</TableHead>
                    <TableHead className="text-muted-foreground text-right">Credit</TableHead>
                    <TableHead className="text-muted-foreground text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Không tìm thấy người dùng.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((u) => {
                      const roleInfo = ROLE_LABELS[u.role] ?? ROLE_LABELS.user;
                      return (
                        <TableRow key={u.user_id} className="border-gray-border hover:bg-oled-elevated/50">
                          <TableCell>
                            <div className="font-medium text-foreground">{u.display_name}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">{u.user_id.slice(0, 8)}...</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={`text-[10px] ${roleInfo.color}`}>
                              {roleInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`font-mono font-semibold ${u.balance > 0 ? "text-neon-purple" : "text-muted-foreground"}`}>
                              {u.balance.toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-neon-purple hover:text-neon-purple hover:bg-neon-purple/10 h-8 px-2"
                                onClick={() => setGrantTarget(u)}
                              >
                                <Gift size={14} className="mr-1" />
                                Grant
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-foreground hover:bg-oled-elevated h-8 px-2"
                                onClick={() => openHistory(u)}
                              >
                                <History size={14} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        )}
      </AdminSection>

      {/* Grant Dialog */}
      <Dialog open={!!grantTarget} onOpenChange={(open) => { if (!open) setGrantTarget(null); }}>
        <DialogContent className="bg-oled-elevated border-gray-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Gift size={18} className="text-neon-purple" />
              Cấp Credit cho {grantTarget?.display_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-foreground">Số credit</Label>
              <Input
                type="number"
                min="1"
                placeholder="Nhập số credit..."
                value={grantAmount}
                onChange={(e) => setGrantAmount(e.target.value)}
                className="bg-oled-surface border-gray-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Ghi chú (tuỳ chọn)</Label>
              <Input
                placeholder="VD: Thưởng sự kiện, hoàn credit..."
                value={grantDesc}
                onChange={(e) => setGrantDesc(e.target.value)}
                className="bg-oled-surface border-gray-border text-foreground"
              />
            </div>
            {grantTarget && (
              <div className="text-xs text-muted-foreground">
                Số dư hiện tại: <span className="text-foreground font-mono font-semibold">{grantTarget.balance.toLocaleString()}</span> credit
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGrantTarget(null)} className="text-muted-foreground">
              Huỷ
            </Button>
            <Button
              onClick={handleGrant}
              disabled={granting}
              className="bg-neon-purple text-primary-foreground hover:shadow-neon-purple"
            >
              {granting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Gift size={14} className="mr-1.5" />}
              Cấp Credit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={!!historyTarget} onOpenChange={(open) => { if (!open) setHistoryTarget(null); }}>
        <DialogContent className="bg-oled-elevated border-gray-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <History size={18} className="text-neon-blue" />
              Lịch sử giao dịch — {historyTarget?.display_name}
            </DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-neon-blue" size={24} />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">Chưa có giao dịch nào.</div>
          ) : (
            <ScrollArea className="max-h-[50vh]">
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-oled-surface border border-gray-border">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground truncate">{tx.description}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(tx.created_at).toLocaleString("vi-VN")} · {tx.type}
                      </div>
                    </div>
                    <div className="text-right ml-3">
                      <div className={`font-mono font-semibold text-sm ${tx.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Còn: {tx.balance_after.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  );
};

export default AdminCreditsPage;
