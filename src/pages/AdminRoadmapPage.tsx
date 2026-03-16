import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import { Loader2, Map, CheckCircle2, Circle, Clock, Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
  const { isAdmin, canViewAdminHub, canEditAdminHub, checking: checkingRole } = useUserRole();
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<RoadmapItem> & typeof emptyItem>(emptyItem);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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

  useEffect(() => { fetchItems(); }, [fetchItems]);

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
    try {
      if ("id" in editingItem && editingItem.id) {
        // Update
        const { error } = await supabase
          .from("roadmap_items")
          .update({
            phase: editingItem.phase,
            phase_label: editingItem.phase_label,
            title: editingItem.title,
            description: editingItem.description,
            status: editingItem.status,
            sort_order: editingItem.sort_order,
          })
          .eq("id", editingItem.id);
        if (error) throw error;
        toast.success("Đã cập nhật!");
      } else {
        // Insert
        const { error } = await supabase
          .from("roadmap_items")
          .insert({
            phase: editingItem.phase,
            phase_label: editingItem.phase_label,
            title: editingItem.title,
            description: editingItem.description,
            status: editingItem.status,
            sort_order: editingItem.sort_order,
          });
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
    const { error } = await supabase
      .from("roadmap_items")
      .update({ status: cycle[nextIdx] })
      .eq("id", item.id);
    if (!error) fetchItems();
  };

  return (
    <ScrollArea className="flex-1">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 md:p-8 max-w-4xl mx-auto w-full space-y-8 pb-24"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Map className="text-neon-blue" size={28} />
            <h1 className="text-2xl font-bold text-foreground">Roadmap phát triển</h1>
          </div>
          <Button onClick={openAdd} size="sm" className="bg-neon-purple hover:bg-neon-purple/80 text-white" disabled={!canEditAdminHub} title={!canEditAdminHub ? "Chỉ Admin/Op mới có quyền thêm" : ""}>
            <Plus size={14} className="mr-1" /> Thêm mục
          </Button>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          {Object.entries(statusConfig).map(([key, { icon: Icon, label, color }]) => (
            <span key={key} className={`flex items-center gap-1.5 ${color}`}>
              <Icon size={14} /> {label}
            </span>
          ))}
        </div>

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
                          {isAdmin && (
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
      </motion.div>
    </ScrollArea>
  );
};

export default AdminRoadmapPage;
