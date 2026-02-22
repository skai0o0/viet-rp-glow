import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PlusCircle, Sparkles, X, Plus, Trash2, ChevronDown, ChevronUp, BookOpen, Save, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  TavernCardV2,
  TavernCardV2Data,
  CharacterBook,
  CharacterBookEntry,
  createEmptyTavernCard,
  createEmptyBookEntry,
} from "@/types/taverncard";

const fieldLabel = "text-sm font-medium text-foreground";
const fieldHint = "text-xs text-muted-foreground mt-1";
const inputStyle =
  "bg-oled-surface border-gray-border text-foreground placeholder:text-muted-foreground focus:border-neon-purple focus:ring-neon-purple/30";
const textareaStyle = `${inputStyle} min-h-[120px] font-mono text-xs leading-relaxed`;
const sectionCard =
  "rounded-xl border border-gray-border bg-oled-surface/50 p-4 space-y-4";

const CreatePage = () => {
  const [card, setCard] = useState<TavernCardV2>(createEmptyTavernCard());
  const [tagInput, setTagInput] = useState("");
  const [greetingDraft, setGreetingDraft] = useState("");
  const [bookOpen, setBookOpen] = useState(false);

  const data = card.data;

  const updateData = (patch: Partial<TavernCardV2Data>) => {
    setCard((prev) => ({ ...prev, data: { ...prev.data, ...patch } }));
  };

  // Tags
  const addTag = () => {
    const t = tagInput.trim();
    if (t && !data.tags.includes(t)) {
      updateData({ tags: [...data.tags, t] });
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    updateData({ tags: data.tags.filter((t) => t !== tag) });
  };

  // Alternate greetings
  const addGreeting = () => {
    const g = greetingDraft.trim();
    if (g) {
      updateData({ alternate_greetings: [...data.alternate_greetings, g] });
      setGreetingDraft("");
    }
  };

  const removeGreeting = (idx: number) => {
    updateData({
      alternate_greetings: data.alternate_greetings.filter((_, i) => i !== idx),
    });
  };

  // Character book
  const initBook = () => {
    if (!data.character_book) {
      updateData({
        character_book: {
          name: "",
          description: "",
          scan_depth: 50,
          token_budget: 500,
          recursive_scanning: false,
          extensions: {},
          entries: [],
        },
      });
    }
    setBookOpen(true);
  };

  const updateBook = (patch: Partial<CharacterBook>) => {
    if (!data.character_book) return;
    updateData({ character_book: { ...data.character_book, ...patch } });
  };

  const addBookEntry = () => {
    if (!data.character_book) return;
    const newId = data.character_book.entries.length;
    updateBook({ entries: [...data.character_book.entries, createEmptyBookEntry(newId)] });
  };

  const updateBookEntry = (idx: number, patch: Partial<CharacterBookEntry>) => {
    if (!data.character_book) return;
    const entries = [...data.character_book.entries];
    entries[idx] = { ...entries[idx], ...patch };
    updateBook({ entries });
  };

  const removeBookEntry = (idx: number) => {
    if (!data.character_book) return;
    updateBook({ entries: data.character_book.entries.filter((_, i) => i !== idx) });
  };

  const handleExportJSON = () => {
    if (!data.name.trim()) {
      toast({ title: "Lỗi", description: "Vui lòng nhập tên nhân vật trước khi xuất.", variant: "destructive" });
      return;
    }
    const blob = new Blob([JSON.stringify(card, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.name.replace(/\s+/g, "_")}_v2.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Đã xuất!", description: `${data.name}_v2.json đã được tải về.` });
  };

  const handlePreview = () => {
    console.log("TavernCardV2 Preview:", JSON.stringify(card, null, 2));
    toast({ title: "Xem trước", description: "Dữ liệu JSON đã được ghi ra Console." });
  };

  return (
    <div className="flex-1 flex flex-col bg-oled-base overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-gray-border bg-oled-surface/60 backdrop-blur-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-neon-purple/10 border border-neon-purple/20 flex items-center justify-center">
            <PlusCircle className="text-neon-purple" size={18} />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground">Tạo Nhân Vật</h1>
            <p className="text-xs text-muted-foreground">TavernCard V2 Spec</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePreview} className="border-gray-border text-muted-foreground hover:text-foreground hover:border-neon-blue">
            <Eye size={14} />
            <span className="hidden sm:inline ml-1">Xem trước</span>
          </Button>
          <Button size="sm" onClick={handleExportJSON} className="bg-neon-purple hover:bg-neon-purple/80 text-white shadow-neon-purple">
            <Save size={14} />
            <span className="hidden sm:inline ml-1">Xuất JSON</span>
          </Button>
        </div>
      </div>

      {/* Form Body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 pb-24 md:pb-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="max-w-2xl mx-auto space-y-6"
        >
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="w-full bg-oled-surface border border-gray-border h-auto flex-wrap">
              <TabsTrigger value="basic" className="data-[state=active]:bg-neon-purple/20 data-[state=active]:text-neon-purple text-xs flex-1">
                Cơ bản
              </TabsTrigger>
              <TabsTrigger value="advanced" className="data-[state=active]:bg-neon-purple/20 data-[state=active]:text-neon-purple text-xs flex-1">
                Nâng cao
              </TabsTrigger>
              <TabsTrigger value="greetings" className="data-[state=active]:bg-neon-purple/20 data-[state=active]:text-neon-purple text-xs flex-1">
                Lời chào
              </TabsTrigger>
              <TabsTrigger value="lorebook" className="data-[state=active]:bg-neon-purple/20 data-[state=active]:text-neon-purple text-xs flex-1">
                Lorebook
              </TabsTrigger>
            </TabsList>

            {/* ===== BASIC TAB ===== */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className={sectionCard}>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} className="text-neon-purple" />
                  <span className="text-sm font-semibold text-foreground">Thông tin chính</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className={fieldLabel}>Tên nhân vật *</Label>
                    <Input
                      value={data.name}
                      onChange={(e) => updateData({ name: e.target.value })}
                      placeholder="VD: Marin Kitagawa"
                      className={inputStyle}
                    />
                  </div>
                  <div>
                    <Label className={fieldLabel}>Phiên bản</Label>
                    <Input
                      value={data.character_version}
                      onChange={(e) => updateData({ character_version: e.target.value })}
                      placeholder="1.0"
                      className={inputStyle}
                    />
                  </div>
                </div>

                <div>
                  <Label className={fieldLabel}>Mô tả (Description)</Label>
                  <p className={fieldHint}>Mô tả chi tiết về nhân vật: ngoại hình, lịch sử, đặc điểm nổi bật.</p>
                  <Textarea
                    value={data.description}
                    onChange={(e) => updateData({ description: e.target.value })}
                    placeholder="{{char}} là một cô gái cosplayer nổi tiếng..."
                    className={textareaStyle}
                  />
                </div>

                <div>
                  <Label className={fieldLabel}>Tính cách (Personality)</Label>
                  <p className={fieldHint}>Tóm tắt tính cách: đặc điểm, thói quen, cách nói chuyện.</p>
                  <Textarea
                    value={data.personality}
                    onChange={(e) => updateData({ personality: e.target.value })}
                    placeholder="Vui vẻ, nhiệt tình, thẳng thắn..."
                    className={textareaStyle}
                  />
                </div>

                <div>
                  <Label className={fieldLabel}>Kịch bản (Scenario)</Label>
                  <p className={fieldHint}>Bối cảnh và tình huống ban đầu của cuộc trò chuyện.</p>
                  <Textarea
                    value={data.scenario}
                    onChange={(e) => updateData({ scenario: e.target.value })}
                    placeholder="Bạn gặp {{char}} tại một quán cà phê..."
                    className={textareaStyle}
                  />
                </div>
              </div>

              {/* Tags */}
              <div className={sectionCard}>
                <Label className={fieldLabel}>Thẻ (Tags)</Label>
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                    placeholder="Nhập tag rồi Enter..."
                    className={`${inputStyle} flex-1`}
                  />
                  <Button variant="outline" size="icon" onClick={addTag} className="border-gray-border hover:border-neon-purple shrink-0">
                    <Plus size={14} />
                  </Button>
                </div>
                {data.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {data.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="bg-neon-purple/15 text-neon-purple border-neon-purple/30 text-xs cursor-pointer hover:bg-neon-purple/25" onClick={() => removeTag(tag)}>
                        {tag} <X size={10} className="ml-1" />
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className={fieldLabel}>Người tạo (Creator)</Label>
                    <Input
                      value={data.creator}
                      onChange={(e) => updateData({ creator: e.target.value })}
                      placeholder="Tên / nickname của bạn"
                      className={inputStyle}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ===== ADVANCED TAB ===== */}
            <TabsContent value="advanced" className="space-y-4 mt-4">
              <div className={sectionCard}>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} className="text-neon-blue" />
                  <span className="text-sm font-semibold text-foreground">Cấu hình Prompt</span>
                </div>

                <div>
                  <Label className={fieldLabel}>System Prompt</Label>
                  <p className={fieldHint}>Prompt hệ thống — hướng dẫn AI cách hành xử cho nhân vật này.</p>
                  <Textarea
                    value={data.system_prompt}
                    onChange={(e) => updateData({ system_prompt: e.target.value })}
                    placeholder="Bạn là {{char}}, hãy luôn nhập vai và không bao giờ thoát ra..."
                    className={textareaStyle}
                  />
                </div>

                <div>
                  <Label className={fieldLabel}>Post-History Instructions</Label>
                  <p className={fieldHint}>Chèn vào cuối lịch sử hội thoại, trước lượt trả lời của AI.</p>
                  <Textarea
                    value={data.post_history_instructions}
                    onChange={(e) => updateData({ post_history_instructions: e.target.value })}
                    placeholder="[Hãy viết tối thiểu 3 đoạn văn mỗi lượt...]"
                    className={textareaStyle}
                  />
                </div>

                <div>
                  <Label className={fieldLabel}>Ví dụ Hội thoại (mes_example)</Label>
                  <p className={fieldHint}>
                    Định dạng: {"<START>"} để bắt đầu mỗi đoạn ví dụ. Dùng {`{{char}}`} và {`{{user}}`}.
                  </p>
                  <Textarea
                    value={data.mes_example}
                    onChange={(e) => updateData({ mes_example: e.target.value })}
                    placeholder={"<START>\n{{user}}: Chào buổi sáng!\n{{char}}: Ê ê! Chào cậu~ ✨"}
                    className={`${textareaStyle} min-h-[160px]`}
                  />
                </div>

                <div>
                  <Label className={fieldLabel}>Ghi chú Tác giả (Creator Notes)</Label>
                  <p className={fieldHint}>Ghi chú riêng dành cho người dùng thẻ, không ảnh hưởng đến AI.</p>
                  <Textarea
                    value={data.creator_notes}
                    onChange={(e) => updateData({ creator_notes: e.target.value })}
                    placeholder="Nhân vật này hoạt động tốt nhất với mô hình Claude..."
                    className={inputStyle}
                  />
                </div>
              </div>
            </TabsContent>

            {/* ===== GREETINGS TAB ===== */}
            <TabsContent value="greetings" className="space-y-4 mt-4">
              <div className={sectionCard}>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} className="text-neon-purple" />
                  <span className="text-sm font-semibold text-foreground">Lời chào đầu tiên</span>
                </div>

                <div>
                  <Label className={fieldLabel}>First Message (first_mes) *</Label>
                  <p className={fieldHint}>Tin nhắn đầu tiên AI gửi khi bắt đầu cuộc trò chuyện mới.</p>
                  <Textarea
                    value={data.first_mes}
                    onChange={(e) => updateData({ first_mes: e.target.value })}
                    placeholder="*{{char}} ngoảnh đầu lại và mỉm cười* Ê! Cuối cùng cũng gặp được cậu rồi~"
                    className={`${textareaStyle} min-h-[140px]`}
                  />
                </div>
              </div>

              <div className={sectionCard}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-neon-blue" />
                    <span className="text-sm font-semibold text-foreground">Lời chào thay thế</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{data.alternate_greetings.length} lời chào</span>
                </div>

                <p className={fieldHint}>Các lời chào khác nhau — người dùng có thể chọn ngẫu nhiên hoặc theo sở thích.</p>

                <AnimatePresence>
                  {data.alternate_greetings.map((g, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="relative group"
                    >
                      <div className="rounded-lg border border-gray-border bg-oled-base p-3 pr-10">
                        <p className="text-xs text-muted-foreground mb-1">Lời chào #{i + 1}</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{g}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeGreeting(i)}
                        className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={12} />
                      </Button>
                    </motion.div>
                  ))}
                </AnimatePresence>

                <Textarea
                  value={greetingDraft}
                  onChange={(e) => setGreetingDraft(e.target.value)}
                  placeholder="Viết một lời chào thay thế..."
                  className={`${textareaStyle} min-h-[100px]`}
                />
                <Button variant="outline" onClick={addGreeting} disabled={!greetingDraft.trim()} className="border-gray-border hover:border-neon-purple text-muted-foreground hover:text-foreground w-full">
                  <Plus size={14} className="mr-1" /> Thêm lời chào
                </Button>
              </div>
            </TabsContent>

            {/* ===== LOREBOOK TAB ===== */}
            <TabsContent value="lorebook" className="space-y-4 mt-4">
              {!data.character_book ? (
                <div className={sectionCard}>
                  <div className="text-center py-8 space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-neon-blue/10 border border-neon-blue/20 flex items-center justify-center mx-auto">
                      <BookOpen className="text-neon-blue" size={24} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-1">Character Book / Lorebook</h3>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        Thêm các mục kiến thức (lore entries) để AI tự động nhớ bối cảnh khi gặp từ khóa nhất định.
                      </p>
                    </div>
                    <Button onClick={initBook} variant="outline" className="border-neon-blue/30 text-neon-blue hover:bg-neon-blue/10">
                      <BookOpen size={14} className="mr-1" /> Khởi tạo Lorebook
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Book settings */}
                  <div className={sectionCard}>
                    <div className="flex items-center gap-2 mb-2 cursor-pointer" onClick={() => setBookOpen(!bookOpen)}>
                      <BookOpen size={14} className="text-neon-blue" />
                      <span className="text-sm font-semibold text-foreground flex-1">Cài đặt Lorebook</span>
                      {bookOpen ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                    </div>

                    <AnimatePresence>
                      {bookOpen && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-3 overflow-hidden">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <Label className={fieldLabel}>Tên Lorebook</Label>
                              <Input value={data.character_book.name || ""} onChange={(e) => updateBook({ name: e.target.value })} placeholder="VD: Thế giới của Marin" className={inputStyle} />
                            </div>
                            <div>
                              <Label className={fieldLabel}>Scan Depth</Label>
                              <Input type="number" value={data.character_book.scan_depth || 50} onChange={(e) => updateBook({ scan_depth: Number(e.target.value) })} className={inputStyle} />
                            </div>
                            <div>
                              <Label className={fieldLabel}>Token Budget</Label>
                              <Input type="number" value={data.character_book.token_budget || 500} onChange={(e) => updateBook({ token_budget: Number(e.target.value) })} className={inputStyle} />
                            </div>
                            <div className="flex items-center gap-3 pt-5">
                              <Switch checked={data.character_book.recursive_scanning || false} onCheckedChange={(v) => updateBook({ recursive_scanning: v })} />
                              <Label className="text-xs text-muted-foreground">Recursive Scanning</Label>
                            </div>
                          </div>
                          <div>
                            <Label className={fieldLabel}>Mô tả</Label>
                            <Textarea value={data.character_book.description || ""} onChange={(e) => updateBook({ description: e.target.value })} placeholder="Mô tả ngắn về Lorebook..." className={inputStyle} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Entries */}
                  <div className={sectionCard}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-foreground">Mục lore ({data.character_book.entries.length})</span>
                      <Button variant="outline" size="sm" onClick={addBookEntry} className="border-gray-border hover:border-neon-blue text-muted-foreground hover:text-foreground">
                        <Plus size={12} className="mr-1" /> Thêm mục
                      </Button>
                    </div>

                    <AnimatePresence>
                      {data.character_book.entries.map((entry, idx) => (
                        <LoreEntryCard key={idx} entry={entry} idx={idx} onUpdate={(p) => updateBookEntry(idx, p)} onRemove={() => removeBookEntry(idx)} />
                      ))}
                    </AnimatePresence>

                    {data.character_book.entries.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-6">Chưa có mục lore nào. Nhấn "Thêm mục" để bắt đầu.</p>
                    )}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
};

// Sub-component for a single lore entry
const LoreEntryCard = ({
  entry,
  idx,
  onUpdate,
  onRemove,
}: {
  entry: CharacterBookEntry;
  idx: number;
  onUpdate: (patch: Partial<CharacterBookEntry>) => void;
  onRemove: () => void;
}) => {
  const [open, setOpen] = useState(true);
  const [keyInput, setKeyInput] = useState("");

  const addKey = (field: "keys" | "secondary_keys") => {
    const k = keyInput.trim();
    if (k) {
      const existing = entry[field] || [];
      if (!existing.includes(k)) onUpdate({ [field]: [...existing, k] });
      setKeyInput("");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="rounded-lg border border-gray-border bg-oled-base overflow-hidden"
    >
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer" onClick={() => setOpen(!open)}>
        <div className={`w-2 h-2 rounded-full ${entry.enabled ? "bg-neon-blue" : "bg-muted-foreground"}`} />
        <span className="text-xs font-medium text-foreground flex-1 truncate">
          {entry.name || `Mục #${idx + 1}`}
        </span>
        <span className="text-[10px] text-muted-foreground">P:{entry.priority}</span>
        {open ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-3 pb-3 space-y-3 border-t border-gray-border pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Tên mục</Label>
                  <Input value={entry.name || ""} onChange={(e) => onUpdate({ name: e.target.value })} className="bg-oled-surface border-gray-border text-foreground text-xs h-8" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Ưu tiên</Label>
                  <Input type="number" value={entry.priority || 10} onChange={(e) => onUpdate({ priority: Number(e.target.value) })} className="bg-oled-surface border-gray-border text-foreground text-xs h-8" />
                </div>
              </div>

              {/* Keys */}
              <div>
                <Label className="text-xs text-muted-foreground">Từ khóa chính (Keys)</Label>
                <div className="flex gap-1.5 flex-wrap mt-1">
                  {entry.keys.map((k, ki) => (
                    <Badge key={ki} variant="outline" className="text-[10px] border-neon-blue/30 text-neon-blue cursor-pointer hover:bg-neon-blue/10" onClick={() => onUpdate({ keys: entry.keys.filter((_, i) => i !== ki) })}>
                      {k} <X size={8} className="ml-0.5" />
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-1.5 mt-1.5">
                  <Input
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKey("keys"))}
                    placeholder="Thêm keyword..."
                    className="bg-oled-surface border-gray-border text-foreground text-xs h-7 flex-1"
                  />
                  <Button variant="ghost" size="icon" onClick={() => addKey("keys")} className="h-7 w-7 text-muted-foreground">
                    <Plus size={10} />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div>
                <Label className="text-xs text-muted-foreground">Nội dung</Label>
                <Textarea value={entry.content} onChange={(e) => onUpdate({ content: e.target.value })} placeholder="Kiến thức AI sẽ nhớ khi gặp từ khóa..." className="bg-oled-surface border-gray-border text-foreground text-xs min-h-[80px] font-mono" />
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={entry.enabled} onCheckedChange={(v) => onUpdate({ enabled: v })} className="scale-75" />
                  <span className="text-[10px] text-muted-foreground">Bật</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={entry.constant || false} onCheckedChange={(v) => onUpdate({ constant: v })} className="scale-75" />
                  <span className="text-[10px] text-muted-foreground">Constant</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={entry.selective || false} onCheckedChange={(v) => onUpdate({ selective: v })} className="scale-75" />
                  <span className="text-[10px] text-muted-foreground">Selective</span>
                </div>
                <Select value={entry.position || "before_char"} onValueChange={(v) => onUpdate({ position: v as 'before_char' | 'after_char' })}>
                  <SelectTrigger className="h-6 text-[10px] w-[110px] bg-oled-surface border-gray-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-oled-elevated border-gray-border">
                    <SelectItem value="before_char" className="text-xs">Before Char</SelectItem>
                    <SelectItem value="after_char" className="text-xs">After Char</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={onRemove} className="text-destructive hover:bg-destructive/10 text-xs h-7">
                  <Trash2 size={10} className="mr-1" /> Xóa mục
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default CreatePage;
