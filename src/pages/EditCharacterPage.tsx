import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Sparkles, X, Plus, Trash2, ChevronDown, ChevronUp, BookOpen, Save, Eye, Loader2, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getCharacterById, updateCharacter } from "@/services/characterDb";
import { compressAvatar } from "@/utils/imageOptimization";
import {
  TavernCardV2,
  TavernCardV2Data,
  CharacterBook,
  CharacterBookEntry,
  createEmptyTavernCard,
  createEmptyBookEntry,
} from "@/types/taverncard";
import { Skeleton } from "@/components/ui/skeleton";

const fieldLabel = "text-sm font-medium text-foreground";
const fieldHint = "text-xs text-muted-foreground mt-1";
const inputStyle =
  "bg-oled-surface border-gray-border text-foreground placeholder:text-muted-foreground focus:border-neon-purple focus:ring-neon-purple/30";
const textareaStyle = `${inputStyle} min-h-[120px] font-mono text-xs leading-relaxed`;
const sectionCard =
  "rounded-xl border border-gray-border bg-oled-surface/50 p-4 space-y-4";

const EditCharacterPage = () => {
  const navigate = useNavigate();
  const { characterId } = useParams<{ characterId: string }>();
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<TavernCardV2>(createEmptyTavernCard());
  const [tagInput, setTagInput] = useState("");
  const [greetingDraft, setGreetingDraft] = useState("");
  const [bookOpen, setBookOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [existingAvatarUrl, setExistingAvatarUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!characterId) return;
    getCharacterById(characterId)
      .then((char) => {
        setCard({
          spec: "chara_card_v2",
          spec_version: "2.0",
          data: {
            name: char.name,
            description: char.description,
            personality: char.personality,
            scenario: char.scenario,
            first_mes: char.first_mes,
            mes_example: char.mes_example,
            creator_notes: char.creator_notes,
            system_prompt: char.system_prompt,
            post_history_instructions: char.post_history_instructions,
            alternate_greetings: char.alternate_greetings || [],
            character_book: char.character_book as CharacterBook | undefined,
            tags: char.tags || [],
            creator: char.creator,
            character_version: char.character_version,
            extensions: (char.extensions as Record<string, any>) || {},
          },
        });
        setIsPublic(char.is_public);
        setExistingAvatarUrl(char.avatar_url);
        if (char.avatar_url) setAvatarPreview(char.avatar_url);
      })
      .catch(() => {
        toast({ title: "Lỗi", description: "Không thể tải nhân vật.", variant: "destructive" });
        navigate("/profile");
      })
      .finally(() => setLoading(false));
  }, [characterId]);

  const data = card.data;

  const updateData = (patch: Partial<TavernCardV2Data>) => {
    setCard((prev) => ({ ...prev, data: { ...prev.data, ...patch } }));
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Lỗi", description: "Ảnh quá lớn (tối đa 5MB).", variant: "destructive" });
      return;
    }
    try {
      const compressed = await compressAvatar(file);
      setAvatarFile(compressed);
      setAvatarPreview(URL.createObjectURL(compressed));
    } catch {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !data.tags.includes(t)) updateData({ tags: [...data.tags, t] });
    setTagInput("");
  };

  const removeTag = (tag: string) => updateData({ tags: data.tags.filter((t) => t !== tag) });

  const addGreeting = () => {
    const g = greetingDraft.trim();
    if (g) {
      updateData({ alternate_greetings: [...data.alternate_greetings, g] });
      setGreetingDraft("");
    }
  };

  const removeGreeting = (idx: number) => {
    updateData({ alternate_greetings: data.alternate_greetings.filter((_, i) => i !== idx) });
  };

  const initBook = () => {
    if (!data.character_book) {
      updateData({
        character_book: { name: "", description: "", scan_depth: 50, token_budget: 500, recursive_scanning: false, extensions: {}, entries: [] },
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
    updateBook({ entries: [...data.character_book.entries, createEmptyBookEntry(data.character_book.entries.length)] });
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
    if (!characterId) return;
    if (!data.name.trim()) {
      toast({ title: "Lỗi", description: "Vui lòng nhập tên nhân vật.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      let avatarUrl: string | null | undefined = undefined; // undefined = don't change
      if (avatarFile) {
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session?.user) throw new Error("Chưa đăng nhập");
        const userId = session.session.user.id;
        const ext = "webp";
        const filePath = `${userId}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("character-avatars")
          .upload(filePath, avatarFile, { upsert: true });
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("character-avatars").getPublicUrl(filePath);
        avatarUrl = urlData.publicUrl;
      }

      await updateCharacter(characterId, card, isPublic, undefined, avatarUrl);
      toast({ title: "Thành công! 🎉", description: "Đã cập nhật nhân vật!" });
      navigate("/profile");
    } catch (err: any) {
      toast({ title: "Lỗi", description: err.message || "Không thể cập nhật.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col bg-oled-base p-6 space-y-4">
        <Skeleton className="h-10 w-48 bg-oled-elevated" />
        <Skeleton className="h-64 w-full bg-oled-elevated rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-oled-base overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-gray-border bg-oled-surface/60 backdrop-blur-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-neon-blue/10 border border-neon-blue/20 flex items-center justify-center">
            <Pencil className="text-neon-blue" size={18} />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground">Chỉnh Sửa Nhân Vật</h1>
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{data.name || "Đang tải..."}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)} className="border-gray-border text-muted-foreground hover:text-foreground hover:border-neon-blue">
            <Eye size={14} />
            <span className="hidden sm:inline ml-1">Xem trước</span>
          </Button>
        </div>
      </div>

      {/* Form Body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 pb-24 md:pb-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="max-w-2xl mx-auto space-y-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="w-full bg-oled-surface border border-gray-border h-auto flex-wrap">
              <TabsTrigger value="basic" className="data-[state=active]:bg-neon-purple/20 data-[state=active]:text-neon-purple text-xs flex-1">Cơ bản</TabsTrigger>
              <TabsTrigger value="advanced" className="data-[state=active]:bg-neon-purple/20 data-[state=active]:text-neon-purple text-xs flex-1">Nâng cao</TabsTrigger>
              <TabsTrigger value="lorebook" className="data-[state=active]:bg-neon-purple/20 data-[state=active]:text-neon-purple text-xs flex-1">Lorebook</TabsTrigger>
            </TabsList>

            {/* ===== BASIC TAB ===== */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              {/* Avatar */}
              <div className={sectionCard}>
                <div className="flex items-center gap-2 mb-2">
                  <ImagePlus size={14} className="text-neon-purple" />
                  <span className="text-sm font-semibold text-foreground">Ảnh đại diện</span>
                </div>
                <div className="flex items-center gap-4">
                  <div onClick={() => avatarInputRef.current?.click()} className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-border hover:border-neon-purple/50 bg-oled-elevated flex items-center justify-center cursor-pointer transition-colors overflow-hidden group">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-muted-foreground group-hover:text-neon-purple transition-colors">
                        <ImagePlus size={24} />
                        <span className="text-[10px]">Tải ảnh</span>
                      </div>
                    )}
                  </div>
                  <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">JPG, PNG, WebP — Tối đa 5MB</p>
                    {avatarPreview && (
                      <Button variant="ghost" size="sm" onClick={() => { setAvatarFile(null); setAvatarPreview(null); }} className="text-xs text-muted-foreground hover:text-destructive mt-1 h-7 px-2">
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
                    <Input value={data.name} onChange={(e) => updateData({ name: e.target.value })} placeholder="VD: Nguyễn Thị Bé" className={inputStyle} />
                  </div>
                  <div>
                    <Label className={fieldLabel}>Phiên bản</Label>
                    <Input value={data.character_version} onChange={(e) => updateData({ character_version: e.target.value })} placeholder="1.0" className={inputStyle} />
                  </div>
                </div>

                <div>
                  <Label className={fieldLabel}>Mô tả (Description)</Label>
                  <p className={fieldHint}>Mô tả chi tiết về nhân vật.</p>
                  <Textarea value={data.description} onChange={(e) => updateData({ description: e.target.value })} placeholder="Mô tả nhân vật..." className={textareaStyle} />
                </div>

                <div>
                  <Label className={fieldLabel}>Tính cách (Personality)</Label>
                  <Textarea value={data.personality} onChange={(e) => updateData({ personality: e.target.value })} placeholder="Tính cách..." className={textareaStyle} />
                </div>

                <div>
                  <Label className={fieldLabel}>Kịch bản (Scenario)</Label>
                  <Textarea value={data.scenario} onChange={(e) => updateData({ scenario: e.target.value })} placeholder="Bối cảnh..." className={textareaStyle} />
                </div>

                <div>
                  <Label className={fieldLabel}>Lời chào đầu tiên (first_mes) *</Label>
                  <Textarea value={data.first_mes} onChange={(e) => updateData({ first_mes: e.target.value })} placeholder="Lời chào..." className={`${textareaStyle} min-h-[140px]`} />
                </div>
              </div>

              {/* Tags */}
              <div className={sectionCard}>
                <Label className={fieldLabel}>Thẻ (Tags)</Label>
                <div className="flex gap-2">
                  <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())} placeholder="Nhập tag rồi Enter..." className={`${inputStyle} flex-1`} />
                  <Button variant="outline" size="icon" onClick={addTag} className="border-gray-border hover:border-neon-purple shrink-0"><Plus size={14} /></Button>
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

                <div className="flex items-center justify-between rounded-lg border border-gray-border bg-oled-base p-3">
                  <div>
                    <Label className={fieldLabel}>Công khai nhân vật</Label>
                    <p className={fieldHint}>Cho phép mọi người xem trên trang Khám Phá.</p>
                  </div>
                  <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className={fieldLabel}>Người tạo (Creator)</Label>
                    <Input value={data.creator} onChange={(e) => updateData({ creator: e.target.value })} placeholder="Tên / nickname" className={inputStyle} />
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
                  <Textarea value={data.system_prompt} onChange={(e) => updateData({ system_prompt: e.target.value })} placeholder="System prompt..." className={textareaStyle} />
                </div>

                <div>
                  <Label className={fieldLabel}>Post-History Instructions</Label>
                  <Textarea value={data.post_history_instructions} onChange={(e) => updateData({ post_history_instructions: e.target.value })} placeholder="Post-history..." className={textareaStyle} />
                </div>

                <div>
                  <Label className={fieldLabel}>Ví dụ Hội thoại (mes_example)</Label>
                  <Textarea value={data.mes_example} onChange={(e) => updateData({ mes_example: e.target.value })} placeholder="Ví dụ hội thoại..." className={`${textareaStyle} min-h-[160px]`} />
                </div>

                <div>
                  <Label className={fieldLabel}>Ghi chú Tác giả</Label>
                  <Textarea value={data.creator_notes} onChange={(e) => updateData({ creator_notes: e.target.value })} placeholder="Ghi chú..." className={inputStyle} />
                </div>

                {/* Alternate Greetings */}
                <div className="flex items-center justify-between mb-2 mt-2">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-neon-blue" />
                    <span className="text-sm font-semibold text-foreground">Lời chào thay thế</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{data.alternate_greetings.length} lời chào</span>
                </div>

                <AnimatePresence>
                  {data.alternate_greetings.map((g, i) => (
                    <motion.div key={i} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="relative group">
                      <div className="rounded-lg border border-gray-border bg-oled-base p-3 pr-10">
                        <p className="text-xs text-muted-foreground mb-1">Lời chào #{i + 1}</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{g}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeGreeting(i)} className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={12} />
                      </Button>
                    </motion.div>
                  ))}
                </AnimatePresence>

                <Textarea value={greetingDraft} onChange={(e) => setGreetingDraft(e.target.value)} placeholder="Viết một lời chào thay thế..." className={`${textareaStyle} min-h-[100px]`} />
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
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto">Thêm các mục kiến thức để AI tự động nhớ bối cảnh.</p>
                    </div>
                    <Button onClick={initBook} variant="outline" className="border-neon-blue/30 text-neon-blue hover:bg-neon-blue/10">
                      <BookOpen size={14} className="mr-1" /> Khởi tạo Lorebook
                    </Button>
                  </div>
                </div>
              ) : (
                <>
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
                              <Input value={data.character_book.name || ""} onChange={(e) => updateBook({ name: e.target.value })} className={inputStyle} />
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
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

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
                      <p className="text-xs text-muted-foreground text-center py-6">Chưa có mục lore nào.</p>
                    )}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>

          {/* Preview Dialog */}
          {showPreview && createPortal(
            <AnimatePresence>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xl flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 25 }} className="relative w-full max-w-md max-h-[90vh] overflow-y-auto scrollbar-thin rounded-2xl border border-gray-border bg-oled-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setShowPreview(false)} className="sticky top-3 ml-auto mr-3 z-10 w-8 h-8 rounded-full bg-oled-base/80 border border-gray-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                    <X size={16} />
                  </button>
                  <div className="relative w-full aspect-square overflow-hidden -mt-8">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-oled-elevated to-oled-base flex items-center justify-center">
                        <span className="text-7xl font-bold text-secondary">{data.name?.charAt(0)?.toUpperCase() || "?"}</span>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-oled-surface to-transparent" />
                  </div>
                  <div className="p-5 -mt-10 relative space-y-4">
                    <h2 className="text-2xl font-bold text-foreground">{data.name || "Tên nhân vật"}</h2>
                    {data.description && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Mô tả</h4>
                        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{data.description}</p>
                      </div>
                    )}
                    {data.tags.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tags</h4>
                        <div className="flex flex-wrap gap-2">
                          {data.tags.map((tag) => (
                            <span key={tag} className="text-xs bg-oled-elevated text-primary rounded-full px-3 py-1 border border-gray-border">{tag}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex justify-end pt-2">
                      <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-neon-blue text-white font-medium text-sm hover:bg-neon-blue/80 hover:shadow-neon-blue transition-all duration-200 disabled:opacity-50">
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {isSaving ? "Đang lưu..." : "Cập Nhật Nhân Vật"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </AnimatePresence>,
            document.body
          )}
        </motion.div>
      </div>
    </div>
  );
};

// Lore entry sub-component
const LoreEntryCard = ({ entry, idx, onUpdate, onRemove }: { entry: CharacterBookEntry; idx: number; onUpdate: (patch: Partial<CharacterBookEntry>) => void; onRemove: () => void }) => {
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
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="rounded-lg border border-gray-border bg-oled-base overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer" onClick={() => setOpen(!open)}>
        <div className={`w-2 h-2 rounded-full ${entry.enabled ? "bg-neon-blue" : "bg-muted-foreground"}`} />
        <span className="text-xs font-medium text-foreground flex-1 truncate">{entry.name || `Mục #${idx + 1}`}</span>
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
              <div>
                <Label className="text-xs text-muted-foreground">Từ khóa kích hoạt</Label>
                <div className="flex gap-2">
                  <Input value={keyInput} onChange={(e) => setKeyInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKey("keys"))} placeholder="Nhập từ khóa..." className="bg-oled-surface border-gray-border text-foreground text-xs h-8 flex-1" />
                  <Button variant="outline" size="icon" onClick={() => addKey("keys")} className="h-8 w-8 border-gray-border"><Plus size={12} /></Button>
                </div>
                {entry.keys.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {entry.keys.map((k) => (
                      <Badge key={k} variant="secondary" className="text-[10px] bg-neon-blue/10 text-neon-blue cursor-pointer" onClick={() => onUpdate({ keys: entry.keys.filter((x) => x !== k) })}>
                        {k} <X size={8} className="ml-0.5" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Nội dung</Label>
                <Textarea value={entry.content} onChange={(e) => onUpdate({ content: e.target.value })} className="bg-oled-surface border-gray-border text-foreground text-xs min-h-[80px]" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch checked={entry.enabled} onCheckedChange={(v) => onUpdate({ enabled: v })} />
                  <span className="text-xs text-muted-foreground">Bật</span>
                </div>
                <Button variant="ghost" size="sm" onClick={onRemove} className="text-destructive hover:text-destructive h-7 px-2 text-xs"><Trash2 size={12} className="mr-1" /> Xóa</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default EditCharacterPage;
