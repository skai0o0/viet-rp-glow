import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import RoleplayMessage from "@/components/RoleplayMessage";
import { useIsMobile } from "@/hooks/use-mobile";
import { copyToClipboard } from "@/utils/clipboard";
import {
  Loader2,
  ArrowLeft,
  Wand2,
  Send,
  ImagePlus,
  Eye,
  Save,
  CheckCircle2,
  X,
  RotateCcw,
  Sparkles,
  User,
  Bot,
  Upload,
  History,
  Clock,
  ExternalLink,
  Pencil,
  Trash,
  ClipboardPaste,
  Copy,
  Check,
  PanelRightClose,
  PanelRightOpen,
  ArrowRightLeft,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createCharacter, type DbCharacter } from "@/services/characterDb";
import { compressAvatar } from "@/utils/imageOptimization";
import { getApiKeyForProvider, getModel, getActiveProvider, type Provider } from "@/services/openRouter";
import { runCharGenPipeline, type CharGenPhase } from "@/services/charGenService";
import { TavernCardV2, TavernCardV2Data } from "@/types/taverncard";
import { createApproval } from "@/services/approvalService";
import CharGenAssistant from "@/components/CharGenAssistant";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
/** Step 1 (Gen): Creative Writer — free-form character profile */
const GEN_BRAINSTORM_PROMPT = `Bạn là "VietRP Creative Writer", một AI chuyên thiết kế nhân vật cho thể loại roleplay dựa trên văn bản.

Nhiệm vụ: Nhận ý tưởng ngắn từ người dùng và mở rộng thành một hồ sơ nhân vật CHI TIẾT, viết hoàn toàn bằng tiếng Việt.

ĐỊNH DẠNG ĐẦU RA: Viết hồ sơ dạng văn bản tự do (KHÔNG JSON). Sử dụng các tiêu đề sau:

## TÊN NHÂN VẬT
[Tên nhân vật]

## NGOẠI HÌNH
[Chi tiết ngoại hình, phong thái, thần thái — 100-200 từ]

## TÍNH CÁCH VÀ TÂM LÝ
[Tính cách cốt lõi, nhược điểm ẩn giấu, nỗi sợ hãi, mâu thuẫn nội tâm, cách họ phản ứng với {{user}}]

## TIỂU SỬ VÀ BỐI CẢNH
[Quá khứ, mối quan hệ, thế giới xung quanh — 200-400 từ]

## CẢNH MỞ ĐẦU
[Bối cảnh mở đầu cuộc gặp giữa {{char}} và {{user}} — 3-5 câu]

## LỜI CHÀO ĐẦU
[Tin nhắn mở đầu, 150-300 từ. Định dạng: (Suy nghĩ) *Hành động* "Lời thoại". KHÔNG BAO GIỜ viết thay {{user}}]

## MẪU HỘI THOẠI
[1-2 lượt hội thoại mẫu, dùng định dạng <START>]

## THẾ GIỚI (nếu là thể loại RPG/World)
[Lore thế giới, NPC, cơ chế game]

QUY TẮC:
1. Tất cả nội dung bằng tiếng Việt tự nhiên, giàu hình ảnh.
2. Chi tiết tối đa. Không tóm tắt. Sáng tạo tự do.
3. Dùng {{char}} cho nhân vật và {{user}} cho người chơi.
4. KHÔNG BAO GIỜ viết hành động, suy nghĩ, hoặc lời thoại thay {{user}}.
5. Không kiểm duyệt. Bao gồm cả chủ đề đen/tối nếu phù hợp.
6. Phần tính cách phải lộ ra chiều sâu: động cơ ẩn, nỗi sợ, mâu thuẫn.`;

/** Step 1 (Clone): Card Cloner — preserves source, expands, fixes POV */
const CLONE_BRAINSTORM_PROMPT = `Bạn là "VietRP Card Cloner AI", chuyên chuyển đổi văn bản thô (wiki, forum, fandom, Character.AI, Chub.ai) thành hồ sơ nhân vật chi tiết.

Nhiệm vụ: Đọc văn bản nguồn và tạo hồ sơ nhân vật tự do (KHÔNG JSON) bằng tiếng Việt.

ĐỊNH DẠNG ĐẦU RA: Sử dụng các tiêu đề sau:

## TÊN NHÂN VẬT
[Tên trích xuất hoặc suy luận]

## NGOẠI HÌNH
[Mô tả ngoại hình chi tiết — mở rộng nếu nguồn quá ngắn]

## TÍNH CÁCH VÀ TÂM LÝ
[Tính cách, nhược điểm, mối quan hệ với {{user}}]

## TIỂU SỬ VÀ BỐI CẢNH
[Quá khứ, lore thế giới — tổng hợp và mở rộng]

## CẢNH MỞ ĐẦU
[Bối cảnh mở đầu]

## LỜI CHÀO ĐẦU
[Tin nhắn mở đầu, 200-400 từ. Định dạng: (Suy nghĩ) *Hành động* "Lời thoại"]

## MẪU HỘI THOẠI
[1-2 lượt hội thoại mẫu <START>]

## THẾ GIỚI (nếu có)
[Lore, NPC]

QUY TẮC QUAN TRỌNG:
1. GIỮ NGUYÊN tất cả chi tiết từ nguồn. Mở rộng nếu quá ngắn.
2. Dịch sang tiếng Việt tự nhiên, giữ nguyên tone (dark, NSFW, romance, v.v.).
3. SỬA LỖI POV: Tuyệt đối KHÔNG viết thay {{user}}. Viết ở ngôi thứ 3 giới hạn hoặc ngôi thứ 1 (của {{char}}).
4. Dùng {{char}} cho nhân vật, {{user}} cho người chơi.
5. Không kiểm duyệt. Giữ nguyên chủ đề NSFW/tối nếu có trong nguồn.`;

/** Step 2 (shared): JSON Formatter — strict chara_card_v2 output */
const FORMAT_PROMPT = `Bạn là một trình tạo JSON chính xác. Nhiệm vụ duy nhất là chuyển đổi hồ sơ nhân vật thành JSON chara_card_v2 hợp lệ.

Chỉ xuất JSON thuần bắt đầu bằng { và kết thúc bằng }. Không markdown, không giải thích.

JSON phải có cấu trúc chính xác:
{
  "spec": "chara_card_v2",
  "spec_version": "2.0",
  "data": {
    "name": "...",
    "description": "...",
    "personality": "...",
    "scenario": "...",
    "first_mes": "...",
    "mes_example": "...",
    "system_prompt": "...",
    "post_history_instructions": "...",
    "alternate_greetings": ["..."],
    "character_book": [],
    "tags": ["..."],
    "creator": "VietRP Charagen AI",
    "creator_notes": "Generated dynamically by VietRP Charagen AI.",
    "character_version": "1.0",
    "extensions": {}
  }
}

ÁNH XẠ TRƯỜNG từ hồ sơ:
- "name": Từ section TÊN NHÂN VẬT.
- "description": Gộp NGOẠI HÌNH + TIỂU SỬ VÀ BỐI CẢNH (300-500 từ).
- "personality": Từ TÍNH CÁCH VÀ TÂM LÝ.
- "scenario": Từ CẢNH MỞ ĐẦU.
- "first_mes": Từ LỜI CHÀO ĐẦU. Định dạng: (Suy nghĩ) *Hành động* "Lời thoại". KHÔNG viết thay {{user}}.
- "mes_example": Từ MẪU HỘI THOẠI. Dùng định dạng <START>.
- "system_prompt": "Bạn là {{char}}. [tóm tắt tính cách]. Luôn giữ vai trò. Không bao giờ viết thay {{user}}. Phản hồi tự nhiên, bám sát tính cách."
- "post_history_instructions": PHẢI bao gồm ĐẦY ĐỦ 5 chỉ dẫn (gộp thành 1 đoạn):
  1. Giữ format: (Suy nghĩ) *Hành động* "Lời thoại". Tối đa 1-3 thành phần mỗi phản hồi.
  2. Giữ vững tính cách và vai trò của {{char}}. Không bao giờ hành động, suy nghĩ, hoặc nói thay {{user}}.
  3. Quan sát giọng văn và phong cách viết của {{user}}. Tự động điều chỉnh nhưng LUÔN giữ giọng riêng của {{char}}.
  4. Phản ánh đúng cảm xúc của {{char}} trước hành động {{user}} — tự nhiên và nhất quán.
  5. Đẩy câu chuyện tiến triển. Mỗi phản hồi mở ra tình huống mới — không lặp lại.
- "tags": 5-10 tag liên quan.
- "alternate_greetings": 2-3 lời chào thay thế (bối cảnh/tone khác nhau).
- "character_book": [] (trừ khi là thế giới multi-character, tạo 2-3 entries).
- Cố định: "creator": "VietRP Charagen AI", "character_version": "1.0", "spec": "chara_card_v2", "spec_version": "2.0".

QUY TẮC JSON NGHIÊM NGẶT:
- Chuỗi phải escape đúng (\\n cho newline, \\" cho dấu nháy trong).
- Không có dấu phẩy thừa.
- Tất cả nội dung sáng tạo bằng tiếng Việt.`;

type ChatMsg = { role: "user" | "assistant"; content: string };

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
const UserCharGenPage = () => {
  const { user, isLoading } = useAuth();
  const { isAdmin, checking } = useUserRole();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Panel state
  const [reviewOpen, setReviewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Chat state
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<CharGenPhase>("idle");
  const [cloneMode, setCloneMode] = useState(false);
  const [draftProfile, setDraftProfile] = useState("");
  const [skipBrainstorm, setSkipBrainstorm] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Generated card
  const [generatedCard, setGeneratedCard] = useState<TavernCardV2 | null>(null);
  const [renameFrom, setRenameFrom] = useState("");

  // History
  const [historyChars, setHistoryChars] = useState<DbCharacter[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from("characters")
        .select("*")
        .eq("creator", "VietRP Charagen AI")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setHistoryChars((data ?? []) as DbCharacter[]);
    } catch (err) {
      console.error("[CharGen] history fetch error:", err);
      toast.error("Không thể tải lịch sử.");
    } finally {
      setHistoryLoading(false);
    }
  }, [user]);

  const handleDeleteChar = async (id: string, name: string) => {
    if (!confirm(`Xoá nhân vật "${name}"? Hành động này không thể hoàn tác.`)) return;
    setDeletingId(id);
    try {
      const { error } = await supabase.from("characters").delete().eq("id", id);
      if (error) throw error;
      setHistoryChars((prev) => prev.filter((c) => c.id !== id));
      toast.success(`Đã xoá: ${name}`);
    } catch (err: any) {
      toast.error(err.message || "Xoá thất bại!");
    } finally {
      setDeletingId(null);
    }
  };

  // Fetch history when opening history panel
  useEffect(() => {
    if (historyOpen) fetchHistory();
  }, [historyOpen, fetchHistory]);

  // Avatar
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Publishing
  const [isPublic, setIsPublic] = useState(true);
  const [publishing, setPublishing] = useState(false);

  // Model settings (use default, no picker for users)
  const [activeProvider] = useState<Provider>(() => getActiveProvider());
  const selectedModel = getModel();

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase]);

  /* ---------- Send message to LLM ---------- */
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || phase !== "idle") return;

    if (!getApiKeyForProvider(activeProvider)) {
      const providerLabel = activeProvider === "mimo" ? "Xiaomi Mimo" : "OpenRouter";
      toast.error(`Chưa nhập API Key ${providerLabel}. Vào Cài đặt để thêm.`);
      return;
    }

    const userMsg: ChatMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");

    const controller = new AbortController();
    abortRef.current = controller;

    const brainstormPrompt = cloneMode ? CLONE_BRAINSTORM_PROMPT : GEN_BRAINSTORM_PROMPT;

    await runCharGenPipeline(
      {
        userMessages: newMessages,
        brainstormSystemPrompt: brainstormPrompt,
        formatSystemPrompt: FORMAT_PROMPT,
        provider: activeProvider,
        signal: controller.signal,
        skipBrainstorm: cloneMode && skipBrainstorm,
      },
      {
        onPhaseChange: setPhase,
        onDraftReady: (draft) => {
          setDraftProfile(draft);
          setMessages((prev) => [...prev, { role: "assistant", content: draft }]);
        },
        onSuccess: (card) => {
          setGeneratedCard(card);
          setRenameFrom(card.data.name);
          setReviewOpen(true);
          toast.success(`Đã tạo card: ${card.data.name}`, { description: "Đang mở panel duyệt card." });
          fetchHistory();
        },
        onError: (error, failedStep) => {
          toast.error(error);
          if (failedStep === "formatting") {
            // Draft was already added as a message — keep it visible
          }
        },
      },
    );
  }, [input, phase, messages, cloneMode, skipBrainstorm, fetchHistory, user, activeProvider]);

  const handleStop = () => {
    abortRef.current?.abort();
    setPhase("idle");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* ---------- Avatar ---------- */
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ảnh quá lớn (tối đa 5MB).");
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

  const clearAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

  /* ---------- Edit generated card fields ---------- */
  const updateCardData = (patch: Partial<TavernCardV2Data>) => {
    if (!generatedCard) return;
    setGeneratedCard({ ...generatedCard, data: { ...generatedCard.data, ...patch } });
  };

  /* ---------- Global rename ---------- */
  const handleGlobalRename = () => {
    if (!generatedCard || !renameFrom || renameFrom === generatedCard.data.name) return;
    const oldName = renameFrom;
    const newName = generatedCard.data.name;
    if (!newName.trim()) {
      toast.error("Tên mới không được để trống!");
      return;
    }
    const r = (text: string) => text.replaceAll(oldName, newName);
    setGeneratedCard({
      ...generatedCard,
      data: {
        ...generatedCard.data,
        description: r(generatedCard.data.description),
        personality: r(generatedCard.data.personality),
        scenario: r(generatedCard.data.scenario),
        first_mes: r(generatedCard.data.first_mes),
        mes_example: r(generatedCard.data.mes_example),
        system_prompt: r(generatedCard.data.system_prompt),
        creator_notes: r(generatedCard.data.creator_notes),
        post_history_instructions: r(generatedCard.data.post_history_instructions),
      },
    });
    setRenameFrom(newName);
    toast.success(`Đã đổi "${oldName}" → "${newName}" trên toàn bộ card`);
  };

  /* ---------- Publish (approval flow for non-admin) ---------- */
  const handlePublish = async () => {
    if (!generatedCard || !user) return;
    if (!generatedCard.data.name.trim()) {
      toast.error("Nhân vật thiếu tên!");
      return;
    }

    setPublishing(true);
    try {
      let avatarUrl: string | null = null;
      if (avatarFile) {
        const filePath = `${user.id}/${Date.now()}.webp`;
        const { error: uploadErr } = await supabase.storage
          .from("character-avatars")
          .upload(filePath, avatarFile, { upsert: true });
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage
          .from("character-avatars")
          .getPublicUrl(filePath);
        avatarUrl = urlData.publicUrl;
      }

      if (isAdmin || !isPublic) {
        // Admin hoặc private card: publish trực tiếp
        const saved = await createCharacter(generatedCard, user.id, isPublic, undefined, avatarUrl);
        toast.success(isPublic ? `Đã xuất bản: ${saved.name}` : `Đã lưu: ${saved.name}`);
        navigate(`/character/${saved.id}`);
      } else {
        // Public card từ user thường: gửi duyệt
        await createApproval(
          user.id,
          `Tạo nhân vật AI: ${generatedCard.data.name}`,
          {
            action: "card_create",
            target_table: "characters",
            data: {
              card: generatedCard as unknown as Record<string, unknown>,
              owner_id: user.id,
              is_public: isPublic,
              avatar_url: avatarUrl,
            },
          },
        );
        toast.success("Đã gửi duyệt!", {
          description: `"${generatedCard.data.name}" đang chờ admin phê duyệt.`,
        });
        navigate("/");
      }
    } catch (err: any) {
      toast.error(err.message || "Xuất bản thất bại!");
    } finally {
      setPublishing(false);
    }
  };

  /* ---------- Reset all ---------- */
  const handleReset = () => {
    setMessages([]);
    setPhase("idle");
    setDraftProfile("");
    setSkipBrainstorm(false);
    setGeneratedCard(null);
    setRenameFrom("");
    setReviewOpen(false);
    setHistoryOpen(false);
    clearAvatar();
    setInput("");
    setCloneMode(false);
    setIsPublic(true);
  };

  /* ---------- Copy message ---------- */
  const handleCopyMsg = (idx: number, content: string) => {
    copyToClipboard(content);
    setCopiedIdx(idx);
    toast.success("Đã sao chép");
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  /* ---------- Guards ---------- */
  if (isLoading || checking) {
    return (
      <div className="flex-1 flex items-center justify-center bg-oled-base">
        <Loader2 size={24} className="animate-spin text-neon-purple" />
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;

  const cardFieldLabel = "text-xs font-medium text-muted-foreground uppercase tracking-wider";
  const cardTextarea =
    "bg-oled-base border-oled-border text-foreground font-mono text-xs resize-y min-h-[80px]";

  /* ---------- Review Panel Content ---------- */
  const reviewContent = (() => {
    if (!generatedCard) return null;
    return (
    <div className="h-full flex flex-col bg-oled-base">
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-border">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-400" />
          <h3 className="text-sm font-bold text-foreground">Duyệt & Gửi</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setReviewOpen(false)} className="text-muted-foreground hover:text-foreground h-8 w-8">
          <X size={16} />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        {/* Avatar + Name */}
        <div className="flex items-start gap-3">
          <div className="shrink-0">
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="w-20 h-20 rounded-2xl bg-oled-surface border-2 border-dashed border-oled-border hover:border-neon-purple/50 transition-colors flex items-center justify-center overflow-hidden group"
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground group-hover:text-neon-purple transition-colors">
                  <ImagePlus size={20} />
                  <span className="text-[9px]">Avatar</span>
                </div>
              )}
            </button>
            {avatarPreview && (
              <button onClick={clearAvatar} className="mt-1 text-[10px] text-neon-rose hover:underline w-full text-center">
                Xoá ảnh
              </button>
            )}
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <Label className={cardFieldLabel}>Tên nhân vật</Label>
              <div className="flex gap-1.5 mt-1">
                <Input
                  value={generatedCard.data.name}
                  onChange={(e) => updateCardData({ name: e.target.value })}
                  className="bg-oled-surface border-oled-border text-foreground text-sm font-bold h-9 flex-1"
                />
                {renameFrom && renameFrom !== generatedCard.data.name && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleGlobalRename}
                        className="h-9 w-9 shrink-0 border-neon-purple/50 text-neon-purple hover:bg-neon-purple/10"
                      >
                        <ArrowRightLeft size={14} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="text-xs">Đổi tất cả "{renameFrom}" → "{generatedCard.data.name}"</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {generatedCard.data.tags.map((tag, i) => (
                <Badge key={i} variant="outline" className="border-oled-border text-muted-foreground text-[10px] group cursor-default px-1.5 py-0">
                  {tag}
                  <button
                    onClick={() => updateCardData({ tags: generatedCard.data.tags.filter((_, idx) => idx !== i) })}
                    className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={8} />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Tabbed fields */}
        <Tabs defaultValue="core" className="w-full">
          <TabsList className="w-full bg-oled-surface border border-oled-border h-8">
            <TabsTrigger value="core" className="data-[state=active]:bg-neon-purple/20 data-[state=active]:text-neon-purple text-[11px] flex-1">
              Cốt lõi
            </TabsTrigger>
            <TabsTrigger value="rp" className="data-[state=active]:bg-neon-purple/20 data-[state=active]:text-neon-purple text-[11px] flex-1">
              RP Setup
            </TabsTrigger>
            <TabsTrigger value="meta" className="data-[state=active]:bg-neon-purple/20 data-[state=active]:text-neon-purple text-[11px] flex-1">
              Meta
            </TabsTrigger>
          </TabsList>

          <TabsContent value="core" className="space-y-3 mt-3">
            <div>
              <Label className={cardFieldLabel}>Description</Label>
              <Textarea value={generatedCard.data.description} onChange={(e) => updateCardData({ description: e.target.value })} className={`${cardTextarea} min-h-[160px] mt-1`} />
            </div>
            <div>
              <Label className={cardFieldLabel}>Personality</Label>
              <Textarea value={generatedCard.data.personality} onChange={(e) => updateCardData({ personality: e.target.value })} className={`${cardTextarea} min-h-[120px] mt-1`} />
            </div>
          </TabsContent>

          <TabsContent value="rp" className="space-y-3 mt-3">
            <div>
              <Label className={cardFieldLabel}>Scenario</Label>
              <Textarea value={generatedCard.data.scenario} onChange={(e) => updateCardData({ scenario: e.target.value })} className={`${cardTextarea} mt-1`} />
            </div>
            <div>
              <Label className={cardFieldLabel}>First Message</Label>
              <Textarea value={generatedCard.data.first_mes} onChange={(e) => updateCardData({ first_mes: e.target.value })} className={`${cardTextarea} min-h-[120px] mt-1`} />
            </div>
            <div>
              <Label className={cardFieldLabel}>Message Examples</Label>
              <Textarea value={generatedCard.data.mes_example} onChange={(e) => updateCardData({ mes_example: e.target.value })} className={`${cardTextarea} mt-1`} />
            </div>
          </TabsContent>

          <TabsContent value="meta" className="space-y-3 mt-3">
            <div>
              <Label className={cardFieldLabel}>System Prompt</Label>
              <Textarea value={generatedCard.data.system_prompt} onChange={(e) => updateCardData({ system_prompt: e.target.value })} className={`${cardTextarea} mt-1`} />
            </div>
            <div>
              <Label className={cardFieldLabel}>Creator Notes</Label>
              <Textarea value={generatedCard.data.creator_notes} onChange={(e) => updateCardData({ creator_notes: e.target.value })} className={`${cardTextarea} mt-1`} />
            </div>
            <div>
              <Label className={cardFieldLabel}>Post History Instructions</Label>
              <Textarea value={generatedCard.data.post_history_instructions} onChange={(e) => updateCardData({ post_history_instructions: e.target.value })} className={`${cardTextarea} mt-1`} />
            </div>
          </TabsContent>
        </Tabs>

        {/* Publish controls */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Công khai</p>
              <p className="text-[11px] text-muted-foreground">Hiển thị trên Hub</p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
          <Button
            onClick={handlePublish}
            disabled={publishing}
            className="w-full bg-gradient-to-r from-neon-purple to-neon-blue hover:opacity-90 text-white font-semibold"
          >
            {publishing ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
            {isAdmin ? (publishing ? "Đang xuất bản..." : "Xuất bản lên VietRP") : (publishing ? "Đang gửi..." : "Gửi duyệt")}
          </Button>
          {!isAdmin && (
            <p className="text-[10px] text-muted-foreground text-center">
              Card sẽ được gửi cho admin duyệt trước khi xuất bản
            </p>
          )}
        </div>
      </div>
    </div>
    );
  })();

  /* ---------- History Panel Content ---------- */
  const historyContent = (
    <div className="h-full flex flex-col bg-oled-base">
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-border">
        <div className="flex items-center gap-2">
          <History size={16} className="text-neon-blue" />
          <h3 className="text-sm font-bold text-foreground">Lịch sử tạo Card</h3>
          <Badge variant="outline" className="border-oled-border text-muted-foreground text-[10px] px-1.5 py-0">
            {historyChars.length}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={fetchHistory} disabled={historyLoading} className="text-muted-foreground hover:text-neon-blue h-8 w-8">
            <RotateCcw size={14} className={historyLoading ? "animate-spin" : ""} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setHistoryOpen(false)} className="text-muted-foreground hover:text-foreground h-8 w-8">
            <X size={16} />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2">
        {historyLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-neon-purple" />
          </div>
        ) : historyChars.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-oled-surface flex items-center justify-center">
              <Sparkles size={20} className="text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-xs">Chưa có card nào.</p>
          </div>
        ) : (
          historyChars.map((char) => (
            <div key={char.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-oled-border bg-oled-surface hover:border-neon-purple/30 transition-colors group">
              <div className="w-10 h-10 rounded-lg bg-oled-base overflow-hidden shrink-0 flex items-center justify-center">
                {char.avatar_url ? (
                  <img src={char.avatar_url} alt={char.name} className="w-full h-full object-cover" />
                ) : (
                  <Sparkles size={14} className="text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{char.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="outline" className={`text-[9px] px-1 py-0 ${char.is_public ? "border-green-400/40 text-green-400" : "border-gray-500/40 text-gray-400"}`}>
                    {char.is_public ? "Public" : "Private"}
                  </Badge>
                  <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                    <Clock size={8} />
                    {new Date(char.created_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-neon-blue" onClick={() => navigate(`/character/${char.id}`)}>
                  <ExternalLink size={12} />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-neon-purple" onClick={() => navigate(`/edit/${char.id}`)}>
                  <Pencil size={12} />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-neon-rose" onClick={() => handleDeleteChar(char.id, char.name)} disabled={deletingId === char.id}>
                  {deletingId === char.id ? <Loader2 size={12} className="animate-spin" /> : <Trash size={12} />}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  /* ---------- Render ---------- */
  return (
    <div className="flex-1 flex flex-col bg-oled-base overflow-hidden">
      {/* ═══════ Header ═══════ */}
      <div className="shrink-0 flex items-center bg-oled-base border-b border-gray-border">
        <Link to="/create" className="p-3 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center gap-2.5 flex-1 min-w-0 py-2">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
            cloneMode
              ? "bg-gradient-to-br from-neon-rose to-orange-500"
              : "bg-gradient-to-br from-neon-purple to-neon-rose"
          }`}>
            {cloneMode ? <ClipboardPaste className="text-white" size={15} /> : <Wand2 className="text-white" size={15} />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-foreground truncate">
                {cloneMode ? "Clone Mode" : "Tạo nhân vật AI"}
              </h1>
              {generatedCard && (
                <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[10px] px-1.5 py-0 shrink-0">
                  Card sẵn sàng
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {cloneMode ? "Dán mô tả → AI chuyển thành card" : "Mô tả ý tưởng → AI tạo Character Card"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5 pr-2 shrink-0">
          {/* Review panel toggle */}
          {generatedCard && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setReviewOpen(!reviewOpen)}
                  className={`p-2 transition-colors ${reviewOpen ? "text-green-400" : "text-muted-foreground hover:text-green-400"}`}
                >
                  {reviewOpen ? <PanelRightClose size={18} /> : <Eye size={18} />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-oled-surface border-gray-border text-foreground">
                {reviewOpen ? "Đóng panel duyệt" : "Duyệt & Chỉnh sửa"}
              </TooltipContent>
            </Tooltip>
          )}
          {/* Clone mode toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  const next = !cloneMode;
                  setCloneMode(next);
                  if (next && messages.length === 0) {
                    toast.info("Clone Mode bật!", { description: "Dán mô tả nhân vật từ bất kỳ nguồn nào, AI sẽ tạo card." });
                  } else if (!next) {
                    toast.info("Clone Mode tắt");
                  }
                }}
                disabled={phase !== "idle"}
                className={`p-2 transition-all ${
                  cloneMode
                    ? "text-neon-rose drop-shadow-[0_0_6px_rgba(255,38,100,0.4)]"
                    : "text-muted-foreground hover:text-neon-rose"
                }`}
              >
                <ClipboardPaste size={18} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-oled-surface border-gray-border text-foreground">
              {cloneMode ? "Tắt Clone Mode" : "Clone Mode — Dán text từ web"}
            </TooltipContent>
          </Tooltip>
          {/* Skip Brainstorm toggle — only visible in clone mode */}
          {cloneMode && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setSkipBrainstorm(!skipBrainstorm)}
                  disabled={phase !== "idle"}
                  className={`px-2 py-1 text-[11px] rounded-lg font-medium transition-all border ${
                    skipBrainstorm
                      ? "bg-neon-blue/15 border-neon-blue/40 text-neon-blue"
                      : "bg-oled-elevated border-gray-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {skipBrainstorm ? "Skip Brainstorm" : "Brainstorm"}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-oled-surface border-gray-border text-foreground">
                {skipBrainstorm ? "Bỏ brainstorm → chuyển thẳng sang JSON" : "Brainstorm trước khi tạo JSON"}
              </TooltipContent>
            </Tooltip>
          )}
          {/* History */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setHistoryOpen(true)}
                className="p-2 text-muted-foreground hover:text-neon-blue transition-colors"
              >
                <History size={18} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-oled-surface border-gray-border text-foreground">Lịch sử card</TooltipContent>
          </Tooltip>
          {/* Reset */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={handleReset} className="p-2 text-muted-foreground hover:text-neon-rose transition-colors">
                <RotateCcw size={18} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-oled-surface border-gray-border text-foreground">Làm mới</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Tab bar */}
      <div className="shrink-0 px-3 py-2 border-b border-gray-border bg-oled-surface/30">
        <Tabs value="ai" className="w-full max-w-md">
          <TabsList className="w-full bg-oled-surface border border-gray-border h-auto">
            <TabsTrigger value="manual" asChild className="flex-1 data-[state=active]:bg-neon-purple/20 data-[state=active]:text-neon-purple">
              <Link to="/create">Tạo Card</Link>
            </TabsTrigger>
            <TabsTrigger value="ai" asChild className="flex-1 data-[state=active]:bg-neon-purple/20 data-[state=active]:text-neon-purple">
              <Link to="/create-ai">AI Charagen</Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ═══════ Main content area ═══════ */}
      <div className="flex-1 flex overflow-hidden">
        {/* ─── Chat column ─── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages scroll area */}
          <div className="flex-1 overflow-y-auto scrollbar-thin py-4 space-y-4">
            {/* Empty state */}
            {messages.length === 0 && phase === "idle" && (
              <div className="flex flex-col items-center justify-center h-full gap-5 px-4">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={`w-20 h-20 rounded-3xl flex items-center justify-center ${
                    cloneMode
                      ? "bg-gradient-to-br from-neon-rose/20 to-orange-500/20 shadow-[0_0_30px_rgba(255,38,100,0.1)]"
                      : "bg-gradient-to-br from-neon-purple/20 to-neon-rose/20 shadow-[0_0_30px_rgba(176,38,255,0.1)]"
                  }`}
                >
                  {cloneMode ? (
                    <ClipboardPaste size={32} className="text-neon-rose" />
                  ) : (
                    <Wand2 size={32} className="text-neon-purple" />
                  )}
                </motion.div>
                <div className="text-center">
                  <p className="text-foreground font-semibold text-lg">
                    {cloneMode ? "Dán mô tả nhân vật" : "Mô tả nhân vật bạn muốn tạo"}
                  </p>
                  <p className="text-muted-foreground text-sm mt-1.5 max-w-md mx-auto">
                    {cloneMode
                      ? "Paste text từ wiki, web, forum... AI sẽ tự động phân tích và tạo thành Character Card"
                      : "Mô tả ý tưởng, tính cách, ngoại hình — AI sẽ tạo Character Card cho bạn"
                    }
                  </p>
                </div>
                {/* Instruction box */}
                <div className={`max-w-lg w-full rounded-xl border px-4 py-3 text-xs leading-relaxed ${
                  cloneMode
                    ? "bg-neon-rose/5 border-neon-rose/20 text-muted-foreground"
                    : "bg-neon-purple/5 border-neon-purple/20 text-muted-foreground"
                }`}>
                  {cloneMode ? (
                    <p>
                      <span className="font-medium text-foreground/80">Ví dụ:</span> Dán toàn bộ text từ bất kỳ nguồn nào — wiki, Fandom, Character.AI, Chub.ai, forum — AI sẽ tự động phân tích và chuyển thành Character Card đầy đủ.
                    </p>
                  ) : (
                    <p>
                      <span className="font-medium text-foreground/80">Ví dụ:</span>{" "}
                      <span className="text-neon-purple/80">[Nhân vật]</span> Một nữ sát thủ 25 tuổi, mái tóc đen dài ngang eo, đôi mắt xám lạnh như thép.{" "}
                      <span className="text-neon-purple/80">[Tính cách]</span> Lạnh lùng, ít nói, nhưng có soft spot cho trẻ con.{" "}
                      <span className="text-neon-purple/80">[Bối cảnh]</span> Thành phố cyberpunk năm 2087.{" "}
                      <span className="text-foreground/60">Bạn viết tự do — AI sẽ tự bổ sung chi tiết còn thiếu.</span>
                    </p>
                  )}
                </div>

                {!cloneMode ? (
                  <div className="flex flex-wrap gap-2 justify-center mt-1 max-w-lg">
                    {[
                      "Nữ chiến binh Samurai trầm lặng",
                      "Tiểu thư yandere giàu có",
                      "Bác sĩ ma cà rồng 500 tuổi",
                      "Thám tử tư lạnh lùng Sài Gòn",
                    ].map((s) => (
                      <motion.button
                        key={s}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setInput(s)}
                        className="px-3.5 py-2 rounded-xl text-xs bg-oled-surface border border-oled-border text-muted-foreground hover:text-neon-purple hover:border-neon-purple/40 transition-all duration-200"
                      >
                        <Sparkles size={10} className="inline mr-1.5 opacity-50" />
                        {s}
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 justify-center text-[11px] text-muted-foreground mt-1">
                    {["Wiki pages", "Fandom", "Character.AI", "Chub.ai", "Forum posts", "Bất kỳ nguồn nào"].map((s) => (
                      <span key={s} className="px-2.5 py-1 rounded-full bg-oled-surface border border-oled-border">{s}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Message bubbles */}
            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className={`group flex gap-3 px-4 md:px-6 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex-shrink-0 mt-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border ${
                        cloneMode
                          ? "bg-neon-rose/10 border-neon-rose/30 text-neon-rose"
                          : "bg-neon-purple/10 border-neon-purple/30 text-neon-purple"
                      }`}>
                        <Bot size={14} />
                      </div>
                    </div>
                  )}

                  <div className={`max-w-[80%] md:max-w-[70%] ${msg.role === "user" ? "order-first" : ""}`}>
                    {msg.role === "assistant" && (
                      <span className={`text-[11px] ml-1 mb-1 block font-medium ${cloneMode ? "text-neon-rose/70" : "text-neon-purple/70"}`}>
                        {cloneMode ? "Clone AI" : "Card Generator"}
                      </span>
                    )}

                    <div
                      className={`rounded-2xl px-4 py-3 text-sm leading-relaxed transition-all duration-300 ${
                        msg.role === "user"
                          ? "bg-transparent border border-gray-border text-foreground hover:border-neon-blue hover:shadow-neon-blue"
                          : "bg-oled-surface text-foreground/90"
                      }`}
                      style={
                        msg.role !== "user"
                          ? {
                              background: cloneMode
                                ? "linear-gradient(135deg, rgba(255, 38, 100, 0.05) 0%, #0A0A0A 100%)"
                                : "linear-gradient(135deg, rgba(176, 38, 255, 0.05) 0%, #0A0A0A 100%)",
                            }
                          : undefined
                      }
                    >
                      {msg.role === "assistant" ? (
                        <span className="whitespace-pre-wrap">
                          <RoleplayMessage text={msg.content} />
                        </span>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 mt-1 px-1">
                      {msg.content && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleCopyMsg(i, msg.content)}
                                className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {copiedIdx === i ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-oled-surface border-gray-border text-foreground text-xs">
                              Sao chép
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                    </div>
                  </div>

                  {msg.role === "user" && (
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-8 h-8 rounded-full bg-neon-blue/10 flex items-center justify-center border border-neon-blue/30">
                        <User size={14} className="text-neon-blue" />
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Phase-aware loading indicator */}
            {phase === "brainstorming" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3 px-4 md:px-6"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border animate-breathing ${
                  cloneMode ? "bg-neon-rose/10 border-neon-rose/30 text-neon-rose" : "bg-neon-purple/10 border-neon-purple/30 text-neon-purple"
                }`}>
                  <Bot size={14} />
                </div>
                <div className="bg-oled-surface rounded-2xl px-4 py-3 flex items-center gap-2">
                  <Loader2 size={14} className={`animate-spin ${cloneMode ? "text-neon-rose" : "text-neon-purple"}`} />
                  <span className={`text-sm ${cloneMode ? "text-neon-rose/80" : "text-neon-purple/80"}`}>
                    {cloneMode ? "Đang phân tích mô tả nhân vật..." : "Đang phác thảo tâm lý và tiểu sử nhân vật..."}
                  </span>
                </div>
              </motion.div>
            )}

            {phase === "formatting" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3 px-4 md:px-6"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border animate-breathing ${
                  cloneMode ? "bg-neon-rose/10 border-neon-rose/30 text-neon-rose" : "bg-neon-purple/10 border-neon-purple/30 text-neon-purple"
                }`}>
                  <Bot size={14} />
                </div>
                <div className="bg-oled-surface rounded-2xl px-4 py-3 flex items-center gap-2">
                  <Loader2 size={14} className={`animate-spin ${cloneMode ? "text-neon-rose" : "text-neon-purple"}`} />
                  <span className={`text-sm ${cloneMode ? "text-neon-rose/80" : "text-neon-purple/80"}`}>
                    Đang đóng gói dữ liệu thẻ (JSON)...
                  </span>
                </div>
              </motion.div>
            )}

            {/* Card detected notification */}
            {generatedCard && !reviewOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="flex justify-center px-4"
              >
                <button
                  onClick={() => setReviewOpen(true)}
                  className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-sm font-medium transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 hover:shadow-[0_0_20px_rgba(34,197,94,0.15)]"
                >
                  <CheckCircle2 size={16} />
                  Card đã sẵn sàng — Nhấn để duyệt "{generatedCard.data.name}"
                  <PanelRightOpen size={14} className="opacity-50" />
                </button>
              </motion.div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* ─── Input bar ─── */}
          <div className="p-3 md:p-4 bg-oled-base border-t border-gray-border" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
            <div className="max-w-3xl mx-auto">
              <div
                className={`flex items-end gap-2 bg-oled-surface rounded-2xl px-4 py-2 border transition-all duration-300 ${
                  cloneMode
                    ? "border-neon-rose/30 focus-within:border-neon-rose focus-within:shadow-[0_0_12px_rgba(255,38,100,0.15)]"
                    : "border-gray-border focus-within:border-neon-purple focus-within:shadow-neon-purple"
                }`}
              >
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={cloneMode ? "Dán mô tả nhân vật từ website, wiki, forum..." : "Mô tả ý tưởng nhân vật..."}
                  disabled={phase !== "idle"}
                  rows={1}
                  className="flex-1 bg-transparent text-foreground text-base md:text-sm resize-none outline-none placeholder:text-muted-foreground py-1.5 scrollbar-thin"
                  style={{ minHeight: "40px", maxHeight: "160px" }}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = "auto";
                    el.style.height = Math.min(el.scrollHeight, 160) + "px";
                  }}
                />
                <div className="flex items-center gap-1 pb-0.5">
                  {phase !== "idle" ? (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleStop}
                      className="p-2.5 rounded-xl text-neon-rose transition-all duration-200 hover:bg-neon-rose/10"
                    >
                      <X size={20} />
                    </motion.button>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSend}
                      disabled={!input.trim()}
                      className={`p-2.5 rounded-xl transition-all duration-200 disabled:opacity-30 ${
                        cloneMode
                          ? "text-neon-rose hover:bg-neon-rose/10 hover:shadow-[0_0_12px_rgba(255,38,100,0.2)]"
                          : "text-neon-purple hover:bg-neon-purple/10 hover:shadow-neon-purple"
                      }`}
                    >
                      <Send size={20} />
                    </motion.button>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-2 hidden md:block">
                {cloneMode ? "Dán text → AI phân tích & tạo card tự động" : "Mô tả chi tiết để AI tạo card chất lượng cao hơn"}
              </p>
            </div>
          </div>
        </div>

        {/* ─── Desktop Review Panel ─── */}
        <AnimatePresence>
          {!isMobile && reviewOpen && generatedCard && (
            <motion.div
              key="review-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 380, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="border-l border-gray-border overflow-hidden"
              style={{ flexShrink: 0, maxWidth: 380 }}
            >
              <div style={{ width: 380 }} className="h-full">
                {reviewContent}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══════ Mobile Review Sheet ═══════ */}
      {isMobile && (
        <Sheet open={reviewOpen && !!generatedCard} onOpenChange={(open) => { if (!open) setReviewOpen(false); }}>
          <SheetContent side="right" className="p-0 w-[90vw] max-w-md bg-oled-base border-gray-border">
            {reviewContent}
          </SheetContent>
        </Sheet>
      )}

      {/* ═══════ History Sheet ═══════ */}
      <Sheet open={historyOpen} onOpenChange={(open) => { if (!open) setHistoryOpen(false); }}>
        <SheetContent side="right" className="p-0 w-[90vw] max-w-md bg-oled-base border-gray-border">
          {historyContent}
        </SheetContent>
      </Sheet>

      {/* ═══════ Assistant Popup ═══════ */}
      <CharGenAssistant
        visible={messages.length === 0 && phase === "idle"}
        onSelectSuggestion={(prompt) => setInput(prompt)}
      />
    </div>
  );
};

export default UserCharGenPage;
