import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  ArrowLeft,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  RefreshCw,
  FileText,
  User,
  Filter,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type ApprovalStatus = "pending" | "approved" | "rejected";
type ApprovalType = "card_create" | "card_edit" | "admin_edit";

interface ApprovalItem {
  id: string;
  user_id: string;
  type: ApprovalType;
  title: string;
  payload: Record<string, unknown>;
  status: ApprovalStatus;
  reviewer_id: string | null;
  reviewer_note: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  // joined
  submitter_name?: string;
  reviewer_name?: string;
}

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */
const statusConfig: Record<ApprovalStatus, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  pending: { icon: Clock, label: "Chờ duyệt", color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/30 text-yellow-400" },
  approved: { icon: CheckCircle2, label: "Đã duyệt", color: "text-green-400", bg: "bg-green-400/10 border-green-400/30 text-green-400" },
  rejected: { icon: XCircle, label: "Từ chối", color: "text-red-400", bg: "bg-red-400/10 border-red-400/30 text-red-400" },
};

const typeConfig: Record<ApprovalType, { label: string; color: string }> = {
  card_create: { label: "Tạo nhân vật", color: "border-neon-purple/30 text-neon-purple" },
  card_edit: { label: "Sửa nhân vật", color: "border-neon-blue/30 text-neon-blue" },
  admin_edit: { label: "Sửa cài đặt", color: "border-neon-rose/30 text-neon-rose" },
};

/* ------------------------------------------------------------------ */
/*  Helper                                                             */
/* ------------------------------------------------------------------ */
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return new Date(dateStr).toLocaleDateString("vi-VN");
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
const AdminApprovalsPage = () => {
  const { user, isLoading } = useAuth();
  const { isAdmin, isAdminOrOp, isOp, checking } = useUserRole();

  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | ApprovalStatus>("all");
  const [filterType, setFilterType] = useState<"all" | ApprovalType>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Review dialog
  const [reviewDialog, setReviewDialog] = useState<{ item: ApprovalItem; action: "approved" | "rejected" } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* ---------- Fetch ---------- */
  const fetchItems = useCallback(async () => {
    try {
      let query = supabase
        .from("pending_approvals")
        .select("*")
        .order("created_at", { ascending: false });

      // Op chỉ thấy approvals của mình
      if (isOp && !isAdmin) {
        query = query.eq("user_id", user!.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch display names for submitters
      const userIds = [...new Set((data || []).map((d) => d.user_id))];
      const reviewerIds = [...new Set((data || []).filter((d) => d.reviewer_id).map((d) => d.reviewer_id!))];
      const allIds = [...new Set([...userIds, ...reviewerIds])];

      let nameMap: Record<string, string> = {};
      if (allIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", allIds);
        if (profiles) {
          nameMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name || "Unknown"]));
        }
      }

      setItems(
        (data || []).map((d) => ({
          ...d,
          payload: (typeof d.payload === "object" && d.payload !== null ? d.payload : {}) as Record<string, unknown>,
          submitter_name: nameMap[d.user_id] || "Unknown",
          reviewer_name: d.reviewer_id ? nameMap[d.reviewer_id] || "Unknown" : undefined,
        }))
      );
    } catch (err) {
      console.error("Fetch approvals error:", err);
      toast.error("Không thể tải danh sách yêu cầu");
    }
  }, [isOp, isAdmin, user]);

  useEffect(() => {
    if (!isAdminOrOp) return;
    setLoading(true);
    fetchItems().finally(() => setLoading(false));
  }, [isAdminOrOp, fetchItems]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchItems();
    setRefreshing(false);
    toast.success("Đã cập nhật!");
  };

  /* ---------- Review ---------- */
  const handleReview = async () => {
    if (!reviewDialog || !user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("pending_approvals")
        .update({
          status: reviewDialog.action,
          reviewer_id: user.id,
          reviewer_note: reviewNote.trim() || "",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", reviewDialog.item.id);

      if (error) throw error;

      toast.success(reviewDialog.action === "approved" ? "Đã duyệt yêu cầu!" : "Đã từ chối yêu cầu!");
      setReviewDialog(null);
      setReviewNote("");
      await fetchItems();
    } catch (err) {
      console.error("Review error:", err);
      toast.error("Không thể cập nhật trạng thái");
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------- Filters ---------- */
  const filtered = items.filter((item) => {
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    if (filterType !== "all" && item.type !== filterType) return false;
    return true;
  });

  const pendingCount = items.filter((i) => i.status === "pending").length;

  /* ---------- Guards ---------- */
  if (isLoading || checking) {
    return (
      <div className="flex-1 flex items-center justify-center bg-oled-base">
        <Loader2 size={24} className="animate-spin text-neon-purple" />
      </div>
    );
  }

  if (!user || !isAdminOrOp) return <Navigate to="/" replace />;

  /* ---------- Render ---------- */
  return (
    <ScrollArea className="flex-1">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6 pb-24"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft size={20} />
              </Button>
            </Link>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
              <ClipboardCheck className="text-white" size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">Approval Queue</h1>
                {pendingCount > 0 && (
                  <Badge className="bg-yellow-400/20 text-yellow-400 border-yellow-400/30 text-xs">
                    {pendingCount} chờ duyệt
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {isAdmin ? "Duyệt yêu cầu chỉnh sửa từ Operator" : "Theo dõi yêu cầu chỉnh sửa của bạn"}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="text-muted-foreground hover:text-neon-blue"
          >
            <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
            <SelectTrigger className="w-36 h-8 bg-oled-surface border-oled-border text-foreground text-xs">
              <Filter size={12} className="mr-1 text-muted-foreground" />
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả trạng thái</SelectItem>
              <SelectItem value="pending">🟡 Chờ duyệt</SelectItem>
              <SelectItem value="approved">🟢 Đã duyệt</SelectItem>
              <SelectItem value="rejected">🔴 Từ chối</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
            <SelectTrigger className="w-36 h-8 bg-oled-surface border-oled-border text-foreground text-xs">
              <FileText size={12} className="mr-1 text-muted-foreground" />
              <SelectValue placeholder="Loại" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả loại</SelectItem>
              <SelectItem value="card_create">Tạo nhân vật</SelectItem>
              <SelectItem value="card_edit">Sửa nhân vật</SelectItem>
              <SelectItem value="admin_edit">Sửa cài đặt</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex-1" />

          <div className="flex gap-1.5 text-xs text-muted-foreground items-center">
            <span>{filtered.length} kết quả</span>
            {filterStatus !== "all" || filterType !== "all" ? (
              <button
                onClick={() => { setFilterStatus("all"); setFilterType("all"); }}
                className="text-neon-purple hover:underline ml-1"
              >
                Xóa lọc
              </button>
            ) : null}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-neon-purple" />
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-oled-elevated flex items-center justify-center mb-4">
              <ClipboardCheck size={28} className="text-muted-foreground" />
            </div>
            <p className="text-foreground font-medium">
              {items.length === 0 ? "Chưa có yêu cầu nào" : "Không có kết quả phù hợp"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {items.length === 0
                ? isOp
                  ? "Khi bạn submit thay đổi, yêu cầu sẽ xuất hiện ở đây"
                  : "Chưa có Operator nào gửi yêu cầu chỉnh sửa"
                : "Thử thay đổi bộ lọc để xem thêm"}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filtered.map((item, i) => {
                const sc = statusConfig[item.status];
                const tc = typeConfig[item.type];
                const StatusIcon = sc.icon;
                const isExpanded = expandedId === item.id;

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ delay: i * 0.03 }}
                    layout
                  >
                    <Card className="bg-oled-surface border-oled-border overflow-hidden">
                      {/* Top color accent for pending */}
                      {item.status === "pending" && (
                        <div className="h-[2px] bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400" />
                      )}

                      <CardContent className="p-4">
                        {/* Main row */}
                        <div className="flex items-start gap-3">
                          {/* Status icon */}
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${sc.color} bg-oled-elevated`}>
                            <StatusIcon size={16} />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-foreground truncate">
                                {item.title || "(Không có tiêu đề)"}
                              </span>
                              <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${tc.color}`}>
                                {tc.label}
                              </Badge>
                              <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${sc.bg}`}>
                                {sc.label}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                              <User size={10} />
                              <span>{item.submitter_name}</span>
                              <span>·</span>
                              <span>{timeAgo(item.created_at)}</span>
                              {item.reviewer_name && (
                                <>
                                  <span>·</span>
                                  <span>
                                    Reviewed by <span className="text-foreground">{item.reviewer_name}</span>
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Reviewer note */}
                            {item.reviewer_note && item.status !== "pending" && (
                              <div className="mt-2 text-xs text-muted-foreground bg-oled-elevated rounded-lg px-3 py-2 border border-gray-border">
                                <span className="text-foreground/60 font-medium">Ghi chú: </span>
                                {item.reviewer_note}
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Expand payload */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => setExpandedId(isExpanded ? null : item.id)}
                            >
                              <ChevronDown size={14} className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                            </Button>

                            {/* Admin review buttons */}
                            {isAdmin && item.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                                  onClick={() => { setReviewDialog({ item, action: "approved" }); setReviewNote(""); }}
                                >
                                  <CheckCircle2 size={12} className="mr-1" /> Duyệt
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                                  onClick={() => { setReviewDialog({ item, action: "rejected" }); setReviewNote(""); }}
                                >
                                  <XCircle size={12} className="mr-1" /> Từ chối
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Expanded payload */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-3 pt-3 border-t border-gray-border">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Payload dữ liệu</p>
                                <pre className="bg-oled-base rounded-lg p-3 text-xs text-foreground/80 font-mono overflow-x-auto max-h-64 whitespace-pre-wrap break-words">
                                  {JSON.stringify(item.payload, null, 2)}
                                </pre>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Stats footer */}
        {items.length > 0 && (
          <div className="flex justify-center gap-4 text-xs text-muted-foreground pt-2">
            <span className="flex items-center gap-1"><Clock size={10} className="text-yellow-400" /> {items.filter(i => i.status === "pending").length} chờ</span>
            <span className="flex items-center gap-1"><CheckCircle2 size={10} className="text-green-400" /> {items.filter(i => i.status === "approved").length} duyệt</span>
            <span className="flex items-center gap-1"><XCircle size={10} className="text-red-400" /> {items.filter(i => i.status === "rejected").length} từ chối</span>
          </div>
        )}
      </motion.div>

      {/* Review Dialog */}
      <Dialog open={!!reviewDialog} onOpenChange={() => setReviewDialog(null)}>
        <DialogContent className="bg-oled-elevated border-gray-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              {reviewDialog?.action === "approved" ? (
                <><CheckCircle2 size={18} className="text-green-400" /> Duyệt yêu cầu</>
              ) : (
                <><XCircle size={18} className="text-red-400" /> Từ chối yêu cầu</>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Item info */}
            <div className="bg-oled-base rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium text-foreground">{reviewDialog?.item.title}</p>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <User size={10} />
                <span>{reviewDialog?.item.submitter_name}</span>
                <span>·</span>
                <span>{reviewDialog?.item.type && typeConfig[reviewDialog.item.type]?.label}</span>
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Ghi chú {reviewDialog?.action === "rejected" ? "(lý do từ chối)" : "(tùy chọn)"}
              </label>
              <Textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder={reviewDialog?.action === "approved" ? "Ghi chú cho người gửi..." : "Lý do từ chối..."}
                className="bg-oled-base border-oled-border text-foreground text-sm resize-none"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setReviewDialog(null)}
              disabled={submitting}
              className="text-muted-foreground"
            >
              Hủy
            </Button>
            <Button
              onClick={handleReview}
              disabled={submitting}
              className={
                reviewDialog?.action === "approved"
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin mr-1" />
              ) : reviewDialog?.action === "approved" ? (
                <CheckCircle2 size={14} className="mr-1" />
              ) : (
                <XCircle size={14} className="mr-1" />
              )}
              {reviewDialog?.action === "approved" ? "Xác nhận duyệt" : "Xác nhận từ chối"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
};

export default AdminApprovalsPage;
