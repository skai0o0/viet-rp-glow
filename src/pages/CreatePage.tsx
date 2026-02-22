import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PlusCircle, Sparkles, X, Plus, Trash2, ChevronDown, ChevronUp, BookOpen, Save, Eye, Loader2, Upload, ImagePlus } from "lucide-react";
import { readJsonFile } from "@/utils/importCharacterJson";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { createCharacter } from "@/services/characterDb";
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
  const navigate = useNavigate();
  const [card, setCard] = useState<TavernCardV2>(createEmptyTavernCard());
  const [tagInput, setTagInput] = useState("");
  const [greetingDraft, setGreetingDraft] = useState("");
  const [bookOpen, setBookOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Feature flag: set to true to show import button for all users
  const SHOW_IMPORT_FOR_ALL = false;

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await readJsonFile(file);
      setCard(imported);
      toast({ title: "Import thành công! 🎉", description: `Đã tải dữ liệu nhân vật "${imported.data.name}".` });
    } catch (err: any) {
      toast({ title: "Lỗi Import", description: err.message, variant: "destructive" });
    } finally {
      if (jsonInputRef.current) jsonInputRef.current.value = "";
    }
  };

  const data = card.data;

  const updateData = (patch: Partial<TavernCardV2Data>) => {
    setCard((prev) => ({ ...prev, data: { ...prev.data, ...patch } }));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Lỗi", description: "Ảnh quá lớn (tối đa 5MB).", variant: "destructive" });
      return;
    }
    setAvatarFile(file);
    const url = URL.createObjectURL(file);
    setAvatarPreview(url);
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

  const handleSave = async () => {
    if (!data.name.trim()) {
      toast({ title: "Lỗi", description: "Vui lòng nhập tên nhân vật trước khi lưu.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        toast({ title: "Lỗi", description: "Bạn cần đăng nhập để lưu nhân vật.", variant: "destructive" });
        setIsSaving(false);
        return;
      }

      let avatarUrl: string | null = null;
      if (avatarFile) {
        const userId = session.session.user.id;
        const ext = avatarFile.name.split(".").pop() || "png";
        const filePath = `${userId}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("character-avatars")
          .upload(filePath, avatarFile, { upsert: true });
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage
          .from("character-avatars")
          .getPublicUrl(filePath);
        avatarUrl = urlData.publicUrl;
      }

      const saved = await createCharacter(card, session.session.user.id, isPublic, undefined, avatarUrl);
      toast({ title: "Thành công! 🎉", description: "Tạo nhân vật thành công!" });
      navigate(`/chat/${saved.id}`);
    } catch (err: any) {
      toast({ title: "Lỗi", description: err.message || "Không thể lưu nhân vật.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreview = () => {
    setShowPreview((prev) => !prev);
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
          {SHOW_IMPORT_FOR_ALL && (
            <>
              <input ref={jsonInputRef} type="file" accept=".json" className="hidden" onChange={handleImportJson} />
              <Button variant="outline" size="sm" onClick={() => jsonInputRef.current?.click()} className="border-gray-border text-muted-foreground hover:text-foreground hover:border-neon-blue">
                <Upload size={14} />
                <span className="hidden sm:inline ml-1">Import JSON</span>
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={handlePreview} className="border-gray-border text-muted-foreground hover:text-foreground hover:border-neon-blue">
            <Eye size={14} />
            <span className="hidden sm:inline ml-1">Xem trước</span>
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-neon-purple hover:bg-neon-purple/80 text-white shadow-neon-purple">
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span className="hidden sm:inline ml-1">{isSaving ? "Đang lưu..." : "Lưu Nhân Vật"}</span>
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
              <TabsTrigger value="lorebook" className="data-[state=active]:bg-neon-purple/20 data-[state=active]:text-neon-purple text-xs flex-1">
                Lorebook
              </TabsTrigger>
            </TabsList>

            {/* ===== BASIC TAB ===== */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              {/* Avatar Upload */}
              <div className={sectionCard}>
                <div className="flex items-center gap-2 mb-2">
                  <ImagePlus size={14} className="text-neon-purple" />
                  <span className="text-sm font-semibold text-foreground">Ảnh đại diện</span>
                </div>
                <div className="flex items-center gap-4">
                  <div
                    onClick={() => avatarInputRef.current?.click()}
                    className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-border hover:border-neon-purple/50 bg-oled-elevated flex items-center justify-center cursor-pointer transition-colors overflow-hidden group"
                  >
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-muted-foreground group-hover:text-neon-purple transition-colors">
                        <ImagePlus size={24} />
                        <span className="text-[10px]">Tải ảnh</span>
                      </div>
                    )}
                  </div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">JPG, PNG, WebP — Tối đa 5MB</p>
                    {avatarPreview && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setAvatarFile(null); setAvatarPreview(null); }}
                        className="text-xs text-muted-foreground hover:text-destructive mt-1 h-7 px-2"
                      >
                        <X size={12} className="mr-1" /> Xóa ảnh
                      </Button>
                    )}
                  </div>
                </div>
              </div>

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
                      placeholder="VD: Nguyễn Thị Bé"
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
                    placeholder="VD: {{char}} là một cô gái sống tại Sài Gòn, tính tình vui vẻ..."
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
                    placeholder="VD: Bạn gặp {{char}} tại một quán cà phê..."
                    className={textareaStyle}
                  />
                </div>

                <div>
                  <Label className={fieldLabel}>Lời chào đầu tiên (first_mes) *</Label>
                  <p className={fieldHint}>Tin nhắn đầu tiên AI gửi khi bắt đầu cuộc trò chuyện mới.</p>
                  <Textarea
                    value={data.first_mes}
                    onChange={(e) => updateData({ first_mes: e.target.value })}
                    placeholder="VD: *{{char}} ngoảnh đầu lại và mỉm cười* Ê! Cuối cùng cũng gặp được cậu rồi~"
                    className={`${textareaStyle} min-h-[140px]`}
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

                {/* Public toggle */}
                <div className="flex items-center justify-between rounded-lg border border-gray-border bg-oled-base p-3">
                  <div>
                    <Label className={fieldLabel}>Công khai nhân vật</Label>
                    <p className={fieldHint}>Cho phép mọi người xem và trò chuyện với nhân vật này trên trang Khám Phá.</p>
                  </div>
                  <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                </div>

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
                    placeholder="VD: Bạn là {{char}}, hãy luôn nhập vai và không bao giờ thoát ra..."
                    className={textareaStyle}
                  />
                </div>

                <div>
                  <Label className={fieldLabel}>Post-History Instructions</Label>
                  <p className={fieldHint}>Chèn vào cuối lịch sử hội thoại, trước lượt trả lời của AI.</p>
                  <Textarea
                    value={data.post_history_instructions}
                    onChange={(e) => updateData({ post_history_instructions: e.target.value })}
                    placeholder="VD: [Hãy viết tối thiểu 3 đoạn văn mỗi lượt...]"
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
                    placeholder={"VD:\n<START>\n{{user}}: Chào buổi sáng!\n{{char}}: Ê ê! Chào cậu~ ✨"}
                    className={`${textareaStyle} min-h-[160px]`}
                  />
                </div>

                <div>
                  <Label className={fieldLabel}>Ghi chú Tác giả (Creator Notes)</Label>
                  <p className={fieldHint}>Ghi chú riêng dành cho người dùng thẻ, không ảnh hưởng đến AI.</p>
                  <Textarea
                    value={data.creator_notes}
                    onChange={(e) => updateData({ creator_notes: e.target.value })}
                    placeholder="VD: Nhân vật này hoạt động tốt nhất với mô hình Claude..."
                    className={inputStyle}
                  />
                </div>

                {/* Alternate Greetings */}
                <div className="flex items-center justify-between mb-2 mt-2">
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
                              <Input value={data.character_book.name || ""} onChange={(e) => updateBook({ name: e.target.value })} placeholder="VD: Thế giới của nhân vật" className={inputStyle} />
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
                              <Label className="text-xs text-muted-foreground">Quét đệ quy</Label>
                            </div>
                          </div>
                          <div>
                            <Label className={fieldLabel}>Mô tả</Label>
                            <Textarea value={data.character_book.description || ""} onChange={(e) => updateBook({ description: e.target.value })} placeholder="VD: Mô tả ngắn về Lorebook..." className={inputStyle} />
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

          {/* Live Preview Panel */}
          <AnimatePresence>
            {showPreview && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className={sectionCard}>
                  <div className="flex items-center gap-2 mb-3">
                    <Eye size={14} className="text-neon-blue" />
                    <span className="text-sm font-semibold text-foreground">Xem trước Card</span>
                  </div>
                  <div className="max-w-xs mx-auto">
                    <div className="bg-oled-surface rounded-2xl border border-gray-border overflow-hidden shadow-lg">
                      {/* Image Section */}
                      <div className="relative aspect-[4/3] w-full overflow-hidden">
                        {avatarPreview ? (
                          <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-oled-elevated to-oled-base flex items-center justify-center">
                            <span className="text-4xl font-bold text-secondary">
                              {data.name?.charAt(0)?.toUpperCase() || "?"}
                            </span>
                          </div>
                        )}
                      </div>
                      {/* Info Section */}
                      <div className="p-4">
                        <h3 className="text-lg font-bold text-foreground truncate">
                          {data.name || "Tên nhân vật"}
                        </h3>
                        {data.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {data.description.slice(0, 200)}
                          </p>
                        )}
                        {data.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {data.tags.slice(0, 5).map((tag) => (
                              <span key={tag} className="text-xs bg-oled-elevated text-primary rounded-full px-2 py-1">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
                    placeholder="Thêm từ khóa..."
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
                <Textarea value={entry.content} onChange={(e) => onUpdate({ content: e.target.value })} placeholder="VD: Kiến thức AI sẽ nhớ khi gặp từ khóa..." className="bg-oled-surface border-gray-border text-foreground text-xs min-h-[80px] font-mono" />
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={entry.enabled} onCheckedChange={(v) => onUpdate({ enabled: v })} className="scale-75" />
                  <span className="text-[10px] text-muted-foreground">Bật</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={entry.constant || false} onCheckedChange={(v) => onUpdate({ constant: v })} className="scale-75" />
                  <span className="text-[10px] text-muted-foreground">Luôn bật</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={entry.selective || false} onCheckedChange={(v) => onUpdate({ selective: v })} className="scale-75" />
                  <span className="text-[10px] text-muted-foreground">Chọn lọc</span>
                </div>
                <Select value={entry.position || "before_char"} onValueChange={(v) => onUpdate({ position: v as 'before_char' | 'after_char' })}>
                  <SelectTrigger className="h-6 text-[10px] w-[110px] bg-oled-surface border-gray-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-oled-elevated border-gray-border">
                    <SelectItem value="before_char" className="text-xs">Trước nhân vật</SelectItem>
                    <SelectItem value="after_char" className="text-xs">Sau nhân vật</SelectItem>
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
