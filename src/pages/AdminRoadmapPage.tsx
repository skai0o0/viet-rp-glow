import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import { Loader2, Map, CheckCircle2, Circle, Clock, Plus, Pencil, Trash2, Save, X, Rocket, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createApproval, type ApprovalPayload } from "@/services/approvalService";
import {
  fetchSubscriptionPlan,
  saveSubscriptionPlan,
  type PlanPhase,
  type PlanPhaseStatus,
} from "@/services/globalSettingsDb";
import { AdminPageShell, AdminSection } from "@/admin/components";

type Status = "done" | "in-progress" | "planned";

interface RoadmapItem {
  id: string;
  phase: string;
  phase_label: string;
  title: string;
  description: string;
  status: Status;
  sort_order: number;
}

interface RoadmapPhase {
  phase: string;
  label: string;
  items: RoadmapItem[];
}

const statusConfig: Record<Status, { icon: React.ElementType; label: string; color: string }> = {
  done: { icon: CheckCircle2, label: "Hoàn thành", color: "text-green-400" },
  "in-progress": { icon: Clock, label: "Đang làm", color: "text-yellow-400" },
  planned: { icon: Circle, label: "Dự kiến", color: "text-muted-foreground" },
};

const planStatusConfig: Record<PlanPhaseStatus, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  done: { icon: CheckCircle2, label: "Hoàn thành", color: "text-green-400", bg: "bg-green-400/10 border-green-400/30" },
  "in-progress": { icon: Clock, label: "Đang làm", color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/30" },
  planned: { icon: Circle, label: "Dự kiến", color: "text-muted-foreground", bg: "bg-muted/10 border-gray-border" },
};

const emptyItem: Omit<RoadmapItem, "id"> = {
  phase: "",
  phase_label: "",
  title: "",
  description: "",
  status: "planned",
  sort_order: 0,
};

const AdminRoadmapPage = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { isAdmin, isOp, canViewAdminHub, canEditAdminHub, checking: checkingRole } = useUserRole();
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<RoadmapItem> & typeof emptyItem>(emptyItem);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Subscription Plan Board
  const [planPhases, setPlanPhases] = useState<PlanPhase[]>([]);
  const [planExpanded, setPlanExpanded] = useState(false);
  const [editingPhase, setEditingPhase] = useState<PlanPhase | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);

  const fetchItems = useCallback(async () => {
    const { data, error } = await supabase
      .from("roadmap_items")
      .select("*")
      .order("sort_order", { ascending: true });
    if (!error && data) {
      setItems(data.map(d => ({ ...d, status: d.status as Status })));
    }
    setLoading(false);
  }, []);

  const loadPlan = useCallback(async () => {
    const plan = await fetchSubscriptionPlan();
    setPlanPhases(plan);
  }, []);

  useEffect(() => { fetchItems(); loadPlan(); }, [fetchItems, loadPlan]);

  const handlePlanStatusToggle = async (phaseId: number) => {
    const cycle: PlanPhaseStatus[] = ["planned", "in-progress", "done"];
    const updated = planPhases.map((p) => {
      if (p.id !== phaseId) return p;
      const nextIdx = (cycle.indexOf(p.status) + 1) % cycle.length;
      return { ...p, status: cycle[nextIdx] };
    });
    setPlanPhases(updated);
    try {
      await saveSubscriptionPlan(updated);
    } catch {
      toast.error("Không thể lưu trạng thái.");
      loadPlan();
    }
  };

  const handleSavePhaseEdit = async () => {
    if (!editingPhase) return;
    setSavingPlan(true);
    const updated = planPhases.map((p) => (p.id === editingPhase.id ? editingPhase : p));
    try {
      await saveSubscriptionPlan(updated);
      setPlanPhases(updated);
      setEditingPhase(null);
      toast.success("Đã lưu thay đổi!");
    } catch {
      toast.error("Không thể lưu.");
    } finally {
      setSavingPlan(false);
    }
  };

  // Group items by phase
  const phases: RoadmapPhase[] = [];
  const phaseMap: Record<string, RoadmapPhase> = {};
  for (const item of items) {
    let phase = phaseMap[item.phase];
    if (!phase) {
      phase = { phase: item.phase, label: item.phase_label, items: [] };
      phaseMap[item.phase] = phase;
      phases.push(phase);
    }
    phase.items.push(item);
  }

  if (authLoading || checkingRole) {
    return (
      <div className="flex-1 flex items-center justify-center bg-oled-base">
        <Loader2 size={24} className="animate-spin text-neon-purple" />
      </div>
    );
  }

  if (!user || !canViewAdminHub) {
    return <Navigate to="/" replace />;
  }

  const openAdd = () => {
    // Pre-fill phase from last item
    const lastPhase = phases[phases.length - 1];
    const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) + 1 : 0;
    setEditingItem({
      ...emptyItem,
      phase: lastPhase?.phase || "Phase 1",
      phase_label: lastPhase?.label || "",
      sort_order: maxOrder,
    });
    setDialogOpen(true);
  };

  const openEdit = (item: RoadmapItem) => {
    setEditingItem({ ...item });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingItem.title.trim()) {
      toast.error("Tiêu đề không được để trống");
      return;
    }
    setSaving(true);
    const itemData = {
      phase: editingItem.phase,
      phase_label: editingItem.phase_label,
      title: editingItem.title,
      description: editingItem.description,
      status: editingItem.status,
      sort_order: editingItem.sort_order,
    };
    try {
      const isEdit = "id" in editingItem && editingItem.id;

      if (isOp && !isAdmin) {
        const payload: ApprovalPayload = {
          action: isEdit ? "roadmap_edit" : "roadmap_add",
          target_table: "roadmap_items",
          target_id: isEdit ? editingItem.id : undefined,
          data: itemData as Record<string, unknown>,
        };
        await createApproval(
          user!.id,
          `${isEdit ? "Sửa" : "Thêm"} roadmap: ${editingItem.title}`,
          payload,
        );
        toast.success("Yêu cầu đã gửi cho Admin duyệt!");
        setDialogOpen(false);
        return;
      }

      if (isEdit) {
        const { error } = await supabase
          .from("roadmap_items")
          .update(itemData)
          .eq("id", editingItem.id!);
        if (error) throw error;
        toast.success("Đã cập nhật!");
      } else {
        const { error } = await supabase
          .from("roadmap_items")
          .insert(itemData);
        if (error) throw error;
        toast.success("Đã thêm mục mới!");
      }
      setDialogOpen(false);
      fetchItems();
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi lưu");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (isOp && !isAdmin) {
      try {
        const item = items.find((i) => i.id === id);
        await createApproval(user!.id, `Xoá roadmap: ${item?.title ?? id}`, {
          action: "roadmap_delete",
          target_table: "roadmap_items",
          target_id: id,
          data: {},
        });
        toast.success("Yêu cầu xoá đã gửi cho Admin duyệt!");
      } catch (err: any) {
        toast.error(err.message || "Không thể gửi yêu cầu");
      }
      setDeleteConfirm(null);
      return;
    }
    const { error } = await supabase.from("roadmap_items").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Đã xoá!");
      fetchItems();
    }
    setDeleteConfirm(null);
  };

  const handleStatusToggle = async (item: RoadmapItem) => {
    const cycle: Status[] = ["planned", "in-progress", "done"];
    const nextIdx = (cycle.indexOf(item.status) + 1) % cycle.length;
    const newStatus = cycle[nextIdx];

    if (isOp && !isAdmin) {
      try {
        await createApproval(user!.id, `Đổi trạng thái roadmap: ${item.title} → ${newStatus}`, {
          action: "roadmap_status_toggle",
          target_table: "roadmap_items",
          target_id: item.id,
          data: { status: newStatus },
        });
        toast.success("Yêu cầu đổi trạng thái đã gửi cho Admin duyệt!");
      } catch (err: any) {
        toast.error(err.message || "Không thể gửi yêu cầu");
      }
      return;
    }

    const { error } = await supabase
      .from("roadmap_items")
      .update({ status: newStatus })
      .eq("id", item.id);
    if (!error) fetchItems();
  };

  return (
    <AdminPageShell
      backTo="/admin"
      icon={Map}
      title="Roadmap phát triển"
      subtitle="Quản lý các mốc phát triển sản phẩm"
      maxWidth="max-w-4xl"
      actions={
        <Button onClick={openAdd} size="sm" className="bg-neon-purple hover:bg-neon-purple/80 text-white" disabled={!canEditAdminHub} title={!canEditAdminHub ? "Chỉ Admin/Op mới có quyền thêm" : ""}>
          <Plus size={14} className="mr-1" /> Thêm mục
        </Button>
      }
      headerExtra={
        <div className="flex flex-wrap gap-4 text-sm">
          {Object.entries(statusConfig).map(([key, { icon: Icon, label, color }]) => (
            <span key={key} className={`flex items-center gap-1.5 ${color}`}>
              <Icon size={14} /> {label}
            </span>
          ))}
        </div>
      }
    >
      {/* Subscription Plan Board */}
      <AdminSection
          icon={Rocket}
          title="Subscription System"
          description="BYOK Chat + Credit System + Role Permissions"
          dotColor="bg-neon-blue"
          badge={{
            label: `${planPhases.filter(p => p.status === "done").length}/${planPhases.length} hoàn thành`,
            color: "bg-green-400/15 text-green-400 border border-green-500/30",
          }}
          headerAction={
            <button
              onClick={() => setPlanExpanded(!planExpanded)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-oled-elevated transition-colors"
            >
              <ChevronDown size={16} className={`transition-transform duration-200 ${planExpanded ? "rotate-180" : ""}`} />
            </button>
          }
        >
          {/* Progress bar */}
          <div className="w-full h-2 bg-oled-base rounded-full overflow-hidden flex gap-0.5">
            {planPhases.map((phase) => (
              <div
                key={phase.id}
                className={`flex-1 rounded-full transition-colors duration-300 ${
                  phase.status === "done"
                    ? "bg-green-400"
                    : phase.status === "in-progress"
                    ? "bg-yellow-400 animate-pulse"
                    : "bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>

          {/* Compact phase chips */}
          <div className="flex flex-wrap gap-1.5">
            {planPhases.map((phase) => {
              const { icon: StatusIcon, color } = planStatusConfig[phase.status];
              return (
                <button
                  key={phase.id}
                  onClick={() => isAdmin && handlePlanStatusToggle(phase.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] transition-all ${
                    isAdmin ? "hover:scale-105 cursor-pointer" : "cursor-default"
                  } ${planStatusConfig[phase.status].bg}`}
                  title={isAdmin ? `Click để đổi trạng thái · ${phase.title}` : phase.title}
                >
                  <StatusIcon size={12} className={color} />
                  <span className="text-foreground font-medium">P{phase.id}</span>
                </button>
              );
            })}
          </div>

          {/* Expanded details */}
          <AnimatePresence>
            {planExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="space-y-2 pt-2 border-t border-gray-border">
                  {planPhases.map((phase) => {
                    const { icon: StatusIcon, color } = planStatusConfig[phase.status];
                    const isEditing = editingPhase?.id === phase.id;

                    if (isEditing) {
                      return (
                        <div key={phase.id} className="bg-oled-base rounded-xl p-3 space-y-2 border border-neon-purple/20">
                          <div className="flex items-center gap-2">
                            <Input
                              value={editingPhase.title}
                              onChange={(e) => setEditingPhase({ ...editingPhase, title: e.target.value })}
                              className="bg-oled-elevated border-gray-border text-foreground text-sm h-8 flex-1"
                            />
                            <Select
                              value={editingPhase.status}
                              onValueChange={(v) => setEditingPhase({ ...editingPhase, status: v as PlanPhaseStatus })}
                            >
                              <SelectTrigger className="w-32 h-8 bg-oled-elevated border-gray-border text-foreground text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="done">Hoàn thành</SelectItem>
                                <SelectItem value="in-progress">Đang làm</SelectItem>
                                <SelectItem value="planned">Dự kiến</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Input
                            value={editingPhase.description}
                            onChange={(e) => setEditingPhase({ ...editingPhase, description: e.target.value })}
                            placeholder="Mô tả..."
                            className="bg-oled-elevated border-gray-border text-foreground text-xs h-8"
                          />
                          <Textarea
                            value={editingPhase.details.join("\n")}
                            onChange={(e) => setEditingPhase({ ...editingPhase, details: e.target.value.split("\n") })}
                            rows={3}
                            className="bg-oled-elevated border-gray-border text-foreground text-xs font-mono resize-none"
                          />
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => setEditingPhase(null)} className="h-7 text-xs">
                              <X size={12} className="mr-1" /> Huỷ
                            </Button>
                            <Button size="sm" onClick={handleSavePhaseEdit} disabled={savingPlan} className="h-7 text-xs bg-neon-purple hover:bg-neon-purple/80 text-white">
                              {savingPlan ? <Loader2 size={12} className="animate-spin mr-1" /> : <Save size={12} className="mr-1" />}
                              Lưu
                            </Button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={phase.id}
                        className="bg-oled-base rounded-xl p-3 group hover:border-neon-blue/20 border border-transparent transition-colors"
                      >
                        <div className="flex items-start gap-2">
                          <button
                            onClick={() => handlePlanStatusToggle(phase.id)}
                            className="mt-0.5 shrink-0 hover:scale-125 transition-transform"
                            title="Click để đổi trạng thái"
                          >
                            <StatusIcon size={16} className={color} />
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-neon-blue/30 text-neon-blue shrink-0">
                                Phase {phase.id}
                              </Badge>
                              <span className="text-sm font-medium text-foreground truncate">{phase.title}</span>
                              {isAdmin && (
                                <button
                                  onClick={() => setEditingPhase({ ...phase })}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-neon-blue"
                                >
                                  <Pencil size={11} />
                                </button>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{phase.description}</p>
                            <ul className="mt-1.5 space-y-0.5">
                              {phase.details.map((d, i) => {
                                const isPending = d.startsWith("~");
                                const display = isPending ? d.slice(1) : d;
                                return (
                                  <li key={i} className={`text-[10px] flex items-start gap-1.5 ${
                                    isPending ? "text-muted-foreground/30 italic" : "text-muted-foreground/70"
                                  }`}>
                                    <span className={`mt-px ${isPending ? "text-neon-purple/30" : "text-neon-blue/50"}`}>
                                      {isPending ? "◇" : "›"}
                                    </span>
                                    <span>{display}</span>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </AdminSection>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin text-neon-purple" />
          </div>
        ) : (
          phases.map((phase, i) => (
            <motion.div
              key={phase.phase}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
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
                    <Card key={item.id} className="bg-oled-surface border-oled-border group relative">
                      <CardHeader className="p-3 pb-1">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <button
                            onClick={() => canEditAdminHub ? handleStatusToggle(item) : undefined}
                            disabled={!canEditAdminHub}
                            className={`shrink-0 transition-transform ${canEditAdminHub ? "hover:scale-125 cursor-pointer" : "cursor-default opacity-60"}`}
                            title={canEditAdminHub ? "Click để đổi trạng thái" : "Chỉ Admin/Op mới có quyền thay đổi"}
                          >
                            <StatusIcon size={14} className={color} />
                          </button>
                          <span className="text-foreground flex-1">{item.title}</span>
                          {canEditAdminHub && (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                              <button onClick={() => openEdit(item)} className="text-muted-foreground hover:text-neon-blue">
                                <Pencil size={12} />
                              </button>
                              <button onClick={() => setDeleteConfirm(item.id)} className="text-muted-foreground hover:text-red-400">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
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
          ))
        )}

        {/* Edit/Add Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="bg-oled-surface border-oled-border max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {editingItem.id ? "Chỉnh sửa mục" : "Thêm mục mới"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Phase</Label>
                  <Input
                    value={editingItem.phase}
                    onChange={e => setEditingItem(p => ({ ...p, phase: e.target.value }))}
                    placeholder="Phase 1"
                    className="bg-oled-base border-oled-border text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Nhãn Phase</Label>
                  <Input
                    value={editingItem.phase_label}
                    onChange={e => setEditingItem(p => ({ ...p, phase_label: e.target.value }))}
                    placeholder="Nền tảng cốt lõi"
                    className="bg-oled-base border-oled-border text-foreground"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Tiêu đề</Label>
                <Input
                  value={editingItem.title}
                  onChange={e => setEditingItem(p => ({ ...p, title: e.target.value }))}
                  placeholder="Tên tính năng"
                  className="bg-oled-base border-oled-border text-foreground"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Mô tả</Label>
                <Textarea
                  value={editingItem.description}
                  onChange={e => setEditingItem(p => ({ ...p, description: e.target.value }))}
                  placeholder="Mô tả chi tiết"
                  className="bg-oled-base border-oled-border text-foreground min-h-[80px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Trạng thái</Label>
                  <Select
                    value={editingItem.status}
                    onValueChange={v => setEditingItem(p => ({ ...p, status: v as Status }))}
                  >
                    <SelectTrigger className="bg-oled-base border-oled-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="done">✅ Hoàn thành</SelectItem>
                      <SelectItem value="in-progress">🔨 Đang làm</SelectItem>
                      <SelectItem value="planned">⭕ Dự kiến</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Thứ tự</Label>
                  <Input
                    type="number"
                    value={editingItem.sort_order}
                    onChange={e => setEditingItem(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
                    className="bg-oled-base border-oled-border text-foreground"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>Huỷ</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-neon-purple hover:bg-neon-purple/80 text-white">
                {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
                Lưu
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirm Dialog */}
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="bg-oled-surface border-oled-border max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-foreground">Xác nhận xoá</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Bạn có chắc muốn xoá mục này khỏi roadmap?</p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Huỷ</Button>
              <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
                <Trash2 size={14} className="mr-1" /> Xoá
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </AdminPageShell>
  );
};

export default AdminRoadmapPage;
