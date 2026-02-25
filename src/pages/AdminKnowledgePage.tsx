import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Navigate } from "react-router-dom";
import {
  Loader2,
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Save,
  Copy,
  FileText,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface KnowledgeItem {
  id: string;
  title: string;
  description: string;
  content: string;
  category: string;
  created_at: string;
  updated_at: string;
}

const categoryConfig: Record<string, { label: string; color: string }> = {
  prompt: { label: "Prompt", color: "border-neon-blue text-neon-blue" },
  guide: { label: "Hướng dẫn", color: "border-neon-purple text-neon-purple" },
  template: { label: "Template", color: "border-neon-rose text-neon-rose" },
  general: { label: "Chung", color: "border-gray-500 text-gray-400" },
};

const emptyItem = {
  title: "",
  description: "",
  content: "",
  category: "general",
};

const AdminKnowledgePage = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { isAdmin, checking: checkingRole } = useIsAdmin();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<
    Partial<KnowledgeItem> & typeof emptyItem
  >(emptyItem);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    const { data, error } = await supabase
      .from("knowledge_base")
      .select("*")
      .order("updated_at", { ascending: false });
    if (!error && data) {
      setItems(data as KnowledgeItem[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  if (authLoading || checkingRole) {
    return (
      <div className="flex-1 flex items-center justify-center bg-oled-base">
        <Loader2 size={24} className="animate-spin text-neon-purple" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  const filtered = items.filter((item) => {
    const matchesSearch =
      !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      filterCategory === "all" || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const openAdd = () => {
    setEditingItem({ ...emptyItem });
    setDialogOpen(true);
  };

  const openEdit = (item: KnowledgeItem) => {
    setEditingItem({ ...item });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingItem.title.trim()) {
      toast.error("Tiêu đề không được để trống");
      return;
    }
    if (!editingItem.content.trim()) {
      toast.error("Nội dung không được để trống");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: editingItem.title,
        description: editingItem.description,
        content: editingItem.content,
        category: editingItem.category,
      };
      if ("id" in editingItem && editingItem.id) {
        const { error } = await supabase
          .from("knowledge_base")
          .update(payload)
          .eq("id", editingItem.id);
        if (error) throw error;
        toast.success("Đã cập nhật!");
      } else {
        const { error } = await supabase.from("knowledge_base").insert(payload);
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
    const { error } = await supabase
      .from("knowledge_base")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Đã xoá!");
      if (expandedId === id) setExpandedId(null);
      fetchItems();
    }
    setDeleteConfirm(null);
  };

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Đã copy nội dung!");
    } catch {
      toast.error("Không thể copy");
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <ScrollArea className="flex-1">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 md:p-8 max-w-4xl mx-auto w-full space-y-6 pb-24"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="text-neon-blue" size={28} />
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Knowledge Base
              </h1>
              <p className="text-xs text-muted-foreground">
                Kho kiến thức & prompt hệ thống
              </p>
            </div>
          </div>
          <Button
            onClick={openAdd}
            size="sm"
            className="bg-neon-purple hover:bg-neon-purple/80 text-white"
          >
            <Plus size={14} className="mr-1" /> Thêm mục
          </Button>
        </div>

        {/* Search & Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Tìm kiếm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-oled-surface border-oled-border text-foreground"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[140px] bg-oled-surface border-oled-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="prompt">Prompt</SelectItem>
              <SelectItem value="guide">Hướng dẫn</SelectItem>
              <SelectItem value="template">Template</SelectItem>
              <SelectItem value="general">Chung</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>{items.length} mục tổng</span>
          <span>·</span>
          <span>{filtered.length} hiển thị</span>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin text-neon-purple" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              {items.length === 0
                ? "Chưa có mục nào. Bấm "Thêm mục" để bắt đầu."
                : "Không tìm thấy kết quả."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {filtered.map((item, i) => {
                const catCfg = categoryConfig[item.category] || categoryConfig.general;
                const isExpanded = expandedId === item.id;
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <Card className="bg-oled-surface border-oled-border group">
                      <CardContent className="p-0">
                        {/* Header row */}
                        <button
                          onClick={() =>
                            setExpandedId(isExpanded ? null : item.id)
                          }
                          className="w-full p-4 flex items-start gap-3 text-left"
                        >
                          <div className="w-9 h-9 rounded-lg bg-oled-elevated flex items-center justify-center shrink-0 mt-0.5">
                            <FileText size={16} className="text-neon-blue" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-sm font-semibold text-foreground truncate">
                                {item.title}
                              </h3>
                              <Badge
                                variant="outline"
                                className={`text-[10px] shrink-0 ${catCfg.color}`}
                              >
                                {catCfg.label}
                              </Badge>
                            </div>
                            {item.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {item.description}
                              </p>
                            )}
                            <p className="text-[10px] text-muted-foreground/60 mt-1">
                              Cập nhật: {formatDate(item.updated_at)}
                            </p>
                          </div>
                          <div className="shrink-0 text-muted-foreground">
                            {isExpanded ? (
                              <ChevronUp size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                          </div>
                        </button>

                        {/* Expanded content */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4 space-y-3">
                                <pre className="bg-oled-base border border-oled-border rounded-lg p-3 text-xs text-gray-300 font-mono whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto">
                                  {item.content}
                                </pre>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleCopy(item.content)}
                                    className="border-neon-blue/30 text-neon-blue hover:bg-neon-blue/10"
                                  >
                                    <Copy size={12} className="mr-1" /> Copy
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openEdit(item)}
                                    className="border-neon-purple/30 text-neon-purple hover:bg-neon-purple/10"
                                  >
                                    <Pencil size={12} className="mr-1" />{" "}
                                    Chỉnh sửa
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setDeleteConfirm(item.id)}
                                    className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                                  >
                                    <Trash2 size={12} className="mr-1" /> Xoá
                                  </Button>
                                </div>
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

        {/* Edit/Add Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="bg-oled-surface border-oled-border max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {editingItem.id ? "Chỉnh sửa" : "Thêm mục mới"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Tiêu đề *
                  </Label>
                  <Input
                    value={editingItem.title}
                    onChange={(e) =>
                      setEditingItem((p) => ({ ...p, title: e.target.value }))
                    }
                    placeholder="VD: System Prompt tạo Character Card"
                    className="bg-oled-base border-oled-border text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Phân loại
                  </Label>
                  <Select
                    value={editingItem.category}
                    onValueChange={(v) =>
                      setEditingItem((p) => ({ ...p, category: v }))
                    }
                  >
                    <SelectTrigger className="bg-oled-base border-oled-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prompt">Prompt</SelectItem>
                      <SelectItem value="guide">Hướng dẫn</SelectItem>
                      <SelectItem value="template">Template</SelectItem>
                      <SelectItem value="general">Chung</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Mô tả</Label>
                <Input
                  value={editingItem.description}
                  onChange={(e) =>
                    setEditingItem((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Mô tả ngắn gọn mục đích của file này"
                  className="bg-oled-base border-oled-border text-foreground"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Nội dung *
                </Label>
                <Textarea
                  value={editingItem.content}
                  onChange={(e) =>
                    setEditingItem((p) => ({ ...p, content: e.target.value }))
                  }
                  placeholder="Nhập nội dung file tại đây..."
                  className="bg-oled-base border-oled-border text-foreground font-mono text-xs resize-y min-h-[300px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                Huỷ
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-neon-purple hover:bg-neon-purple/80 text-white"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin mr-1" />
                ) : (
                  <Save size={14} className="mr-1" />
                )}
                Lưu
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirm Dialog */}
        <Dialog
          open={!!deleteConfirm}
          onOpenChange={() => setDeleteConfirm(null)}
        >
          <DialogContent className="bg-oled-surface border-oled-border max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                Xác nhận xoá
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Bạn có chắc muốn xoá mục này khỏi Knowledge Base?
            </p>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setDeleteConfirm(null)}
              >
                Huỷ
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              >
                <Trash2 size={14} className="mr-1" /> Xoá
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </ScrollArea>
  );
};

export default AdminKnowledgePage;
