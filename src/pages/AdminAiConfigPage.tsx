import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Loader2,
  ShieldCheck,
  Plus,
  Trash2,
  Star,
  Search,
  Zap,
  BadgeCheck,
  DollarSign,
  Gift,
  GripVertical,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  Layers,
  Crown,
  Sparkles,
  Key,
  ToggleLeft,
  ToggleRight,
  Terminal,
  Wand2,
  Brain,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AdminPageShell, AdminSection } from "@/admin/components";
import {
  fetchAllowedModels,
  addAllowedModel,
  removeAllowedModel,
  toggleModelRecommended,
  AllowedModel,
  fetchGlobalSystemPrompt,
  saveGlobalSystemPrompt,
  fetchSamplingParameters,
  saveSamplingParameters,
  type SamplingParameters,
  fetchGlobalPromptTypeA,
  saveGlobalPromptTypeA,
  fetchGlobalPromptTypeB,
  saveGlobalPromptTypeB,
  fetchGlobalPostHistoryTypeA,
  saveGlobalPostHistoryTypeA,
  fetchGlobalPostHistoryTypeB,
  saveGlobalPostHistoryTypeB,
  fetchCharGenBrainstorm,
  saveCharGenBrainstorm,
  fetchCharGenClone,
  saveCharGenClone,
  fetchCharGenFormat,
  saveCharGenFormat,
  fetchCharGenBudget,
  saveCharGenBudget,
  type CharGenBudget,
  DEFAULT_CHAR_GEN_BUDGET,
  fetchMemoryArchivist,
  saveMemoryArchivist,
  fetchNsfwGatePrompt,
  saveNsfwGatePrompt,
  fetchNsfwJailbreakPrompt,
  saveNsfwJailbreakPrompt,
  fetchResponseStyles,
  saveResponseStyles,
  type ResponseStyle,
} from "@/services/globalSettingsDb";
import { createApproval } from "@/services/approvalService";
import {
  buildSystemPromptSections,
  type SystemPromptSection,
} from "@/utils/promptBuilder";
import { countTokens } from "@/utils/tokenizer";
import type { CharacterCard } from "@/types/character";
import { getPublicCharacters, getCharacterById, dbCharToCard } from "@/services/characterDb";
import {
  verifyApiKey,
  fetchOpenRouterModels,
  fetchMimoModels,
  fetchGoogleGenaiModels,
  getApiKey,
  setApiKey,
  markKeyVerified,
  verifyMimoApiKey,
  getMimoApiKey,
  setMimoApiKey,
  markMimoKeyVerified,
  getMimoEndpoint,
  setMimoEndpoint,
  verifyGoogleGenaiApiKey,
  getGoogleGenaiApiKey,
  setGoogleGenaiApiKey,
  markGoogleGenaiKeyVerified,
  getGoogleGenaiEndpoint,
  setGoogleGenaiEndpoint,
  syncKeysFromSupabase,
  type OpenRouterModel,
} from "@/services/openRouter";
import { supabase } from "@/integrations/supabase/client";

/* ── Platform Key type ───────────────────────────────────── */
interface PlatformKey {
  id: string;
  key_name: string;
  api_key: string;
  is_active: boolean;
  request_count: number;
  last_used_at: string | null;
  created_at: string;
}

/* ── Tier config ─────────────────────────────────────────── */
interface DbModelTier {
  id: string;
  tier_key: string;
  display_name: string;
  description: string;
  model_id: string;
  min_subscription: string;
  sort_order: number;
  is_active: boolean;
}

const TIER_META: Record<string, { icon: React.ElementType; color: string }> = {
  free:  { icon: Zap,      color: "text-neon-blue bg-neon-blue/10" },
  pro:   { icon: Crown,    color: "text-neon-purple bg-neon-purple/10" },
  ultra: { icon: Sparkles,  color: "text-neon-rose bg-neon-rose/10" },
};

const AdminAiConfigPage = () => {
  const { user, isLoading } = useAuth();
  const { isAdmin, isOp, canViewAdminHub, canEditAdminHub, checking } = useUserRole();

  // API verification
  const [testApiKey, setTestApiKey] = useState(() => getApiKey());
  const [showKey, setShowKey] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);

  // Xiaomi Mimo key verification
  const [testMimoKey, setTestMimoKey] = useState(() => getMimoApiKey());
  const [showMimoKey, setShowMimoKey] = useState(false);
  const [verifyingMimo, setVerifyingMimo] = useState(false);
  const [verifiedMimo, setVerifiedMimo] = useState<boolean | null>(null);
  const [savedMimo, setSavedMimo] = useState(false);

  // Xiaomi Mimo custom endpoint
  const [mimoEndpoint, setMimoEndpointState] = useState(() => getMimoEndpoint());
  const [savedMimoEndpoint, setSavedMimoEndpoint] = useState(false);

  // Google GenAI key verification
  const [testGoogleKey, setTestGoogleKey] = useState(() => getGoogleGenaiApiKey());
  const [showGoogleKey, setShowGoogleKey] = useState(false);
  const [verifyingGoogle, setVerifyingGoogle] = useState(false);
  const [verifiedGoogle, setVerifiedGoogle] = useState<boolean | null>(null);
  const [savedGoogle, setSavedGoogle] = useState(false);

  // Google GenAI custom endpoint
  const [googleEndpoint, setGoogleEndpointState] = useState(() => getGoogleGenaiEndpoint());
  const [savedGoogleEndpoint, setSavedGoogleEndpoint] = useState(false);

  // OpenRouter models (full list)
  const [allModels, setAllModels] = useState<OpenRouterModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // Mimo models (browse only)
  const [mimoModels, setMimoModels] = useState<OpenRouterModel[]>([]);
  const [loadingMimoModels, setLoadingMimoModels] = useState(false);

  // Google GenAI models (browse only)
  const [googleModels, setGoogleModels] = useState<OpenRouterModel[]>([]);
  const [loadingGoogleModels, setLoadingGoogleModels] = useState(false);

  // Model browser dropdown toggles
  const [openRouterBrowseOpen, setOpenRouterBrowseOpen] = useState(false);
  const [mimoBrowseOpen, setMimoBrowseOpen] = useState(false);
  const [googleBrowseOpen, setGoogleBrowseOpen] = useState(false);

  // Allowed models (admin-curated)
  const [allowedModels, setAllowedModels] = useState<AllowedModel[]>([]);
  const [loadingAllowed, setLoadingAllowed] = useState(true);

  // Search
  const [search, setSearch] = useState("");
  const [mimoSearch, setMimoSearch] = useState("");
  const [googleSearch, setGoogleSearch] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  // Model tiers (fixed 3: free, pro, ultra)
  const [tiers, setTiers] = useState<DbModelTier[]>([]);
  const [loadingTiers, setLoadingTiers] = useState(true);
  const [tierEdits, setTierEdits] = useState<Record<string, string>>({});
  const [savingTier, setSavingTier] = useState<string | null>(null);

  // Platform API Keys (admin-only)
  const [platformKeys, setPlatformKeys] = useState<PlatformKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [addingKey, setAddingKey] = useState(false);
  const [showKeyId, setShowKeyId] = useState<string | null>(null);

  // Global System Prompt
  const [prompt, setPrompt] = useState("");
  const [savingPrompt, setSavingPrompt] = useState(false);

  // Type-Specific Prompts
  const [promptTypeA, setPromptTypeA] = useState("");
  const [savingPromptTypeA, setSavingPromptTypeA] = useState(false);
  const [promptTypeB, setPromptTypeB] = useState("");
  const [savingPromptTypeB, setSavingPromptTypeB] = useState(false);
  const [postHistoryTypeA, setPostHistoryTypeA] = useState("");
  const [savingPostHistoryTypeA, setSavingPostHistoryTypeA] = useState(false);
  const [postHistoryTypeB, setPostHistoryTypeB] = useState("");
  const [savingPostHistoryTypeB, setSavingPostHistoryTypeB] = useState(false);

  // Sampling Parameters
  const [samplingParams, setSamplingParams] = useState<SamplingParameters>({
    temperature: 0.7,
    top_p: 0.9,
    top_k: 40,
    repetition_penalty: 1.0,
    max_tokens: 1500,
  });
  const [savingSamplingParams, setSavingSamplingParams] = useState(false);

  // Character Generation Prompts
  const [charGenBrainstorm, setCharGenBrainstorm] = useState("");
  const [savingCharGenBrainstorm, setSavingCharGenBrainstorm] = useState(false);
  const [charGenClone, setCharGenClone] = useState("");
  const [savingCharGenClone, setSavingCharGenClone] = useState(false);
  const [charGenFormat, setCharGenFormat] = useState("");
  const [savingCharGenFormat, setSavingCharGenFormat] = useState(false);
  const [charGenBudget, setCharGenBudget] = useState<CharGenBudget>(DEFAULT_CHAR_GEN_BUDGET);
  const [savingCharGenBudget, setSavingCharGenBudget] = useState(false);

  // Memory & NSFW Gate
  const [memoryArchivist, setMemoryArchivist] = useState("");
  const [savingMemoryArchivist, setSavingMemoryArchivist] = useState(false);
  const [nsfwGatePrompt, setNsfwGatePrompt] = useState("");
  const [savingNsfwGatePrompt, setSavingNsfwGatePrompt] = useState(false);
  const [nsfwJailbreakPrompt, setNsfwJailbreakPrompt] = useState("");
  const [savingNsfwJailbreakPrompt, setSavingNsfwJailbreakPrompt] = useState(false);

  // Response Styles
  const [responseStyles, setResponseStyles] = useState<ResponseStyle[]>([]);
  const [savingResponseStyles, setSavingResponseStyles] = useState(false);

  // System Prompt Inspector
  const [inspectorCharId, setInspectorCharId] = useState("");
  const [inspectorCharList, setInspectorCharList] = useState<{ id: string; name: string }[]>([]);
  const [inspectorSections, setInspectorSections] = useState<SystemPromptSection[]>([]);
  const [inspectorLoading, setInspectorLoading] = useState(false);
  const [inspectorNsfw, setInspectorNsfw] = useState(false);
  const [inspectorUserName, setInspectorUserName] = useState("User");
  const [inspectorCopied, setInspectorCopied] = useState(false);
  const [inspectorTokenCounts, setInspectorTokenCounts] = useState<{ total: number; perSection: number[] }>({ total: 0, perSection: [] });

  useEffect(() => {
    fetchAllowedModels().then((m) => {
      setAllowedModels(m);
      setLoadingAllowed(false);
    });
    supabase
      .from("model_tiers")
      .select("*")
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.warn("model_tiers query failed (table may not exist):", error.message);
        }
        setTiers((data ?? []) as DbModelTier[]);
        const edits: Record<string, string> = {};
        (data ?? []).forEach((t: any) => { edits[t.tier_key] = t.model_id; });
        setTierEdits(edits);
        setLoadingTiers(false);
      });
    fetchGlobalSystemPrompt().then(setPrompt);
    fetchSamplingParameters().then(setSamplingParams);
    fetchGlobalPromptTypeA().then(setPromptTypeA);
    fetchGlobalPromptTypeB().then(setPromptTypeB);
    fetchGlobalPostHistoryTypeA().then(setPostHistoryTypeA);
    fetchGlobalPostHistoryTypeB().then(setPostHistoryTypeB);
    fetchCharGenBrainstorm().then(setCharGenBrainstorm);
    fetchCharGenClone().then(setCharGenClone);
    fetchCharGenFormat().then(setCharGenFormat);
    fetchCharGenBudget().then(setCharGenBudget);
    fetchMemoryArchivist().then(setMemoryArchivist);
    fetchNsfwGatePrompt().then(setNsfwGatePrompt);
    fetchNsfwJailbreakPrompt().then(setNsfwJailbreakPrompt);
    fetchResponseStyles().then(setResponseStyles);
    // Sync BYOK keys from Supabase → populate localStorage + inputs
    if (user) {
      syncKeysFromSupabase(user.id).then(() => {
        setTestApiKey(getApiKey());
        setTestMimoKey(getMimoApiKey());
        setMimoEndpointState(getMimoEndpoint());
      });
    }
    if (isAdmin) {
      supabase
        .from("platform_api_keys")
        .select("*")
        .order("created_at", { ascending: true })
        .then(({ data, error }) => {
          if (!error) setPlatformKeys((data ?? []) as PlatformKey[]);
          setLoadingKeys(false);
        });
      getPublicCharacters().then((chars) => {
        setInspectorCharList(chars.map((c) => ({ id: c.id, name: c.name })));
      });
    }
  }, [isAdmin]);

  const handleSaveTierModel = async (tier: DbModelTier) => {
    const newModelId = (tierEdits[tier.tier_key] ?? tier.model_id).trim();
    if (!newModelId) { toast.error("Model ID không được để trống."); return; }
    setSavingTier(tier.tier_key);
    const { error } = await supabase
      .from("model_tiers")
      .update({ model_id: newModelId })
      .eq("id", tier.id);
    if (error) {
      toast.error("Không thể lưu: " + error.message);
    } else {
      setTiers((prev) => prev.map((t) => t.id === tier.id ? { ...t, model_id: newModelId } : t));
      toast.success(`Đã cập nhật ${tier.display_name} → ${newModelId}`);
    }
    setSavingTier(null);
  };

  const handleLoadModels = useCallback(async () => {
    setLoadingModels(true);
    try {
      const models = await fetchOpenRouterModels();
      setAllModels(models);
      if (models.length === 0) {
        toast.error("Không thể tải danh sách model từ OpenRouter.");
      } else {
        toast.success(`Đã tải ${models.length} model từ OpenRouter.`);
      }
    } catch {
      toast.error("Lỗi khi tải danh sách model.");
    } finally {
      setLoadingModels(false);
    }
  }, []);

  const handleLoadMimoModels = useCallback(async () => {
    setLoadingMimoModels(true);
    try {
      const models = await fetchMimoModels();
      setMimoModels(models);
      if (models.length === 0) {
        toast.error("Không thể tải danh sách model từ Mimo. Kiểm tra API Key.");
      }
    } catch {
      toast.error("Lỗi khi tải danh sách model Mimo.");
    } finally {
      setLoadingMimoModels(false);
    }
  }, []);

  const handleLoadGoogleModels = useCallback(async () => {
    setLoadingGoogleModels(true);
    try {
      const models = await fetchGoogleGenaiModels();
      setGoogleModels(models);
      if (models.length === 0) {
        toast.error("Không thể tải danh sách model từ Google GenAI. Kiểm tra API Key.");
      }
    } catch {
      toast.error("Lỗi khi tải danh sách model Google GenAI.");
    } finally {
      setLoadingGoogleModels(false);
    }
  }, []);

  const handleVerify = async () => {
    if (!testApiKey.trim()) {
      toast.error("Vui lòng nhập API Key để verify.");
      return;
    }
    setVerifying(true);
    setVerified(null);
    const result = await verifyApiKey(testApiKey);
    setVerifying(false);
    setVerified(result.valid);
    if (result.valid) {
      toast.success("API Key hợp lệ! ✓");
    } else {
      toast.error(result.error || "API Key không hợp lệ.");
    }
  };

  const handleSaveKey = () => {
    setApiKey(testApiKey.trim(), user?.id);
    if (verified === true) markKeyVerified();
    setSaved(true);
    toast.success("Đã lưu API Key!");
  };

  // ── Xiaomi Mimo handlers ──
  const handleVerifyMimo = async () => {
    if (!testMimoKey.trim()) {
      toast.error("Vui lòng nhập Mimo API Key để verify.");
      return;
    }
    setVerifyingMimo(true);
    setVerifiedMimo(null);
    const result = await verifyMimoApiKey(testMimoKey);
    setVerifyingMimo(false);
    setVerifiedMimo(result.valid);
    if (result.valid) {
      toast.success("Mimo API Key hợp lệ! ✓");
    } else {
      toast.error(result.error || "Mimo API Key không hợp lệ.");
    }
  };

  const handleSaveMimoKey = () => {
    setMimoApiKey(testMimoKey.trim(), user?.id);
    if (verifiedMimo === true) markMimoKeyVerified();
    setSavedMimo(true);
    toast.success("Đã lưu Mimo API Key!");
  };

  const handleSaveMimoEndpoint = () => {
    const url = mimoEndpoint.trim();
    if (!url) { toast.error("Endpoint không được để trống."); return; }
    try { new URL(url); } catch { toast.error("Endpoint không hợp lệ."); return; }
    setMimoEndpoint(url, user?.id);
    setSavedMimoEndpoint(true);
    toast.success("Đã lưu Mimo endpoint!");
  };

  // ── Google GenAI handlers ──
  const handleVerifyGoogle = async () => {
    if (!testGoogleKey.trim()) {
      toast.error("Vui lòng nhập Google GenAI API Key để verify.");
      return;
    }
    setVerifyingGoogle(true);
    setVerifiedGoogle(null);
    const result = await verifyGoogleGenaiApiKey(testGoogleKey);
    setVerifyingGoogle(false);
    setVerifiedGoogle(result.valid);
    if (result.valid) {
      toast.success("Google GenAI API Key hợp lệ!");
    } else {
      toast.error(result.error || "Google GenAI API Key không hợp lệ.");
    }
  };

  const handleSaveGoogleKey = () => {
    setGoogleGenaiApiKey(testGoogleKey.trim(), user?.id);
    if (verifiedGoogle === true) markGoogleGenaiKeyVerified();
    setSavedGoogle(true);
    toast.success("Đã lưu Google GenAI API Key!");
  };

  const handleSaveGoogleEndpoint = () => {
    const url = googleEndpoint.trim();
    if (!url) { toast.error("Endpoint không được để trống."); return; }
    try { new URL(url); } catch { toast.error("Endpoint không hợp lệ."); return; }
    setGoogleGenaiEndpoint(url, user?.id);
    setSavedGoogleEndpoint(true);
    toast.success("Đã lưu Google GenAI endpoint!");
  };

  // ── Platform Keys handlers (admin-only) ──
  const fetchPlatformKeys = useCallback(async () => {
    const { data, error } = await supabase
      .from("platform_api_keys")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Không thể tải danh sách API keys");
      return;
    }
    setPlatformKeys((data ?? []) as PlatformKey[]);
  }, []);

  const handleAddKey = async () => {
    if (!newKeyName.trim() || !newKeyValue.trim()) {
      toast.error("Vui lòng nhập tên và API key.");
      return;
    }
    setAddingKey(true);
    const { error } = await supabase.from("platform_api_keys").insert({
      key_name: newKeyName.trim(),
      api_key: newKeyValue.trim(),
    });
    if (error) {
      toast.error("Không thể thêm key: " + error.message);
    } else {
      toast.success("Đã thêm API key!");
      setNewKeyName("");
      setNewKeyValue("");
      await fetchPlatformKeys();
    }
    setAddingKey(false);
  };

  const handleToggleKey = async (key: PlatformKey) => {
    const { error } = await supabase
      .from("platform_api_keys")
      .update({ is_active: !key.is_active })
      .eq("id", key.id);
    if (error) {
      toast.error("Không thể cập nhật trạng thái");
    } else {
      setPlatformKeys((prev) =>
        prev.map((k) => (k.id === key.id ? { ...k, is_active: !k.is_active } : k)),
      );
    }
  };

  const handleDeleteKey = async (id: string) => {
    const { error } = await supabase.from("platform_api_keys").delete().eq("id", id);
    if (error) {
      toast.error("Không thể xóa key");
    } else {
      setPlatformKeys((prev) => prev.filter((k) => k.id !== id));
      toast.success("Đã xóa API key");
    }
  };

  // ── Global System Prompt handler ──
  const handleSavePrompt = async () => {
    setSavingPrompt(true);
    try {
      await saveGlobalSystemPrompt(prompt);
      toast.success("Đã lưu cấu hình thành công!");
    } catch {
      toast.error("Lưu cấu hình thất bại!");
    } finally {
      setSavingPrompt(false);
    }
  };

  // ── Type-Specific Prompt handlers ──
  const handleSavePromptTypeA = async () => {
    setSavingPromptTypeA(true);
    try {
      await saveGlobalPromptTypeA(promptTypeA);
      toast.success("Đã lưu System Prompt Type A!");
    } catch {
      toast.error("Lưu thất bại!");
    } finally {
      setSavingPromptTypeA(false);
    }
  };

  const handleSavePromptTypeB = async () => {
    setSavingPromptTypeB(true);
    try {
      await saveGlobalPromptTypeB(promptTypeB);
      toast.success("Đã lưu System Prompt Type B!");
    } catch {
      toast.error("Lưu thất bại!");
    } finally {
      setSavingPromptTypeB(false);
    }
  };

  const handleSavePostHistoryTypeA = async () => {
    setSavingPostHistoryTypeA(true);
    try {
      await saveGlobalPostHistoryTypeA(postHistoryTypeA);
      toast.success("Đã lưu Post-History Type A!");
    } catch {
      toast.error("Lưu thất bại!");
    } finally {
      setSavingPostHistoryTypeA(false);
    }
  };

  const handleSavePostHistoryTypeB = async () => {
    setSavingPostHistoryTypeB(true);
    try {
      await saveGlobalPostHistoryTypeB(postHistoryTypeB);
      toast.success("Đã lưu Post-History Type B!");
    } catch {
      toast.error("Lưu thất bại!");
    } finally {
      setSavingPostHistoryTypeB(false);
    }
  };

  // ── Sampling Parameters handler ──
  const handleSaveSamplingParams = async () => {
    setSavingSamplingParams(true);
    try {
      await saveSamplingParameters(samplingParams);
      toast.success("Đã lưu sampling parameters thành công!");
    } catch {
      toast.error("Lưu sampling parameters thất bại!");
    } finally {
      setSavingSamplingParams(false);
    }
  };

  // ── Char Gen Prompt handlers ──
  const handleSaveCharGenBrainstorm = async () => {
    setSavingCharGenBrainstorm(true);
    try {
      await saveCharGenBrainstorm(charGenBrainstorm);
      toast.success("Đã lưu Brainstorm Prompt!");
    } catch {
      toast.error("Lưu thất bại!");
    } finally {
      setSavingCharGenBrainstorm(false);
    }
  };

  const handleSaveCharGenClone = async () => {
    setSavingCharGenClone(true);
    try {
      await saveCharGenClone(charGenClone);
      toast.success("Đã lưu Clone Prompt!");
    } catch {
      toast.error("Lưu thất bại!");
    } finally {
      setSavingCharGenClone(false);
    }
  };

  const handleSaveCharGenFormat = async () => {
    setSavingCharGenFormat(true);
    try {
      await saveCharGenFormat(charGenFormat);
      toast.success("Đã lưu Format Prompt!");
    } catch {
      toast.error("Lưu thất bại!");
    } finally {
      setSavingCharGenFormat(false);
    }
  };

  const handleSaveCharGenBudget = async () => {
    setSavingCharGenBudget(true);
    try {
      await saveCharGenBudget(charGenBudget);
      toast.success("Đã lưu Budget Config!");
    } catch {
      toast.error("Lưu thất bại!");
    } finally {
      setSavingCharGenBudget(false);
    }
  };

  // ── Memory & NSFW Gate handlers ──
  const handleSaveMemoryArchivist = async () => {
    setSavingMemoryArchivist(true);
    try {
      await saveMemoryArchivist(memoryArchivist);
      toast.success("Đã lưu Memory Archivist Prompt!");
    } catch {
      toast.error("Lưu thất bại!");
    } finally {
      setSavingMemoryArchivist(false);
    }
  };

  const handleSaveNsfwGatePrompt = async () => {
    setSavingNsfwGatePrompt(true);
    try {
      await saveNsfwGatePrompt(nsfwGatePrompt);
      toast.success("Đã lưu NSFW Gate Prompt!");
    } catch {
      toast.error("Lưu thất bại!");
    } finally {
      setSavingNsfwGatePrompt(false);
    }
  };

  const handleSaveNsfwJailbreakPrompt = async () => {
    setSavingNsfwJailbreakPrompt(true);
    try {
      await saveNsfwJailbreakPrompt(nsfwJailbreakPrompt);
      toast.success("Đã lưu NSFW Jailbreak Prompt!");
    } catch {
      toast.error("Lưu thất bại!");
    } finally {
      setSavingNsfwJailbreakPrompt(false);
    }
  };

  // ── Response Styles handler ──
  const handleSaveResponseStyles = async () => {
    setSavingResponseStyles(true);
    try {
      await saveResponseStyles(responseStyles);
      toast.success("Đã lưu Response Styles!");
    } catch {
      toast.error("Lưu thất bại!");
    } finally {
      setSavingResponseStyles(false);
    }
  };

  const handleResponseStyleChange = (index: number, field: "label" | "prompt", value: string) => {
    setResponseStyles((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  // ── Overlap Detection ──
  const OVERLAP_PATTERNS: { id: string; label: string; keywords: RegExp[] }[] = [
    {
      id: "anti_puppet",
      label: "Anti-puppeting (không nói/viết/hành động thay {{user}})",
      keywords: [
        /không\s+(nói|viết|hành\s*động)\s+thay/i,
        /never\s+(write|speak|act)\s+(for|as)\s+\{\{user\}\}/i,
        /do\s+not\s+write\s+(for|as)\s+\{\{user\}\}/i,
        /không\s+được\s+(nói|viết)\s+thay/i,
      ],
    },
    {
      id: "format_spec",
      label: "Format spec ((Suy nghĩ) *Hành động* \"Lời thoại\")",
      keywords: [
        /\(suy\s*nghĩ\).*\*hành\s*động\*.*lời\s*thoại/i,
        /\(Thoughts?\).*\*Actions?\*.*Dialogue/i,
        /format.*suy\s*nghĩ.*hành\s*động.*lời\s*thoại/i,
      ],
    },
    {
      id: "stay_in_char",
      label: "Stay in character / giữ vai trò",
      keywords: [
        /stay\s+in\s+character/i,
        /giữ\s+(vai\s*trò|vai\s*diễn|tính\s*cách)/i,
        /giữ\s+vững\s+tính\s*cách/i,
        /never\s+break\s+(character|immersion)/i,
      ],
    },
    {
      id: "pacing",
      label: "Match energy / pacing",
      keywords: [
        /match\s+(năng\s*lượng|energy|pacing)/i,
        /điều\s*chỉnh.*pacing/i,
        /match.*{{user}}.*energy/i,
      ],
    },
    {
      id: "push_story",
      label: "Push story forward / đẩy câu chuyện",
      keywords: [
        /push\s+(the\s+)?story\s+forward/i,
        /đẩy\s+câu\s*chuyện/i,
        /never\s+summarize\s+or\s+repeat/i,
        /không\s+(tóm\s*tắt|lặp\s*lại)/i,
      ],
    },
  ];

  interface OverlapWarning {
    patternId: string;
    label: string;
    sectionIds: string[];
    sectionLabels: string[];
  }

  const detectOverlaps = (sections: SystemPromptSection[]): OverlapWarning[] => {
    const warnings: OverlapWarning[] = [];
    for (const pattern of OVERLAP_PATTERNS) {
      const matched: { id: string; label: string }[] = [];
      for (const section of sections) {
        const text = section.content.toLowerCase();
        if (pattern.keywords.some((kw) => kw.test(text))) {
          matched.push({ id: section.id, label: section.label });
        }
      }
      if (matched.length > 1) {
        warnings.push({
          patternId: pattern.id,
          label: pattern.label,
          sectionIds: matched.map((m) => m.id),
          sectionLabels: matched.map((m) => m.label),
        });
      }
    }
    return warnings;
  };

  // ── System Prompt Inspector ──
  const handleInspectPrompt = async () => {
    if (!inspectorCharId) {
      toast.error("Chọn một nhân vật trước!");
      return;
    }
    setInspectorLoading(true);
    try {
      const dbChar = await getCharacterById(inspectorCharId);
      const card = dbCharToCard(dbChar);
      const sections = buildSystemPromptSections(
        card as CharacterCard,
        inspectorUserName,
        [],
        undefined,
        undefined,
        undefined,
        { nsfw: inspectorNsfw },
      );
      setInspectorSections(sections);
      // Pre-compute token counts once (WASM tokenizer is expensive)
      const perSection = sections.map((s) => countTokens(s.content));
      const total = perSection.reduce((a, b) => a + b, 0);
      setInspectorTokenCounts({ total, perSection });
    } catch (err: any) {
      toast.error("Lỗi: " + (err.message || "Không thể tải nhân vật"));
    } finally {
      setInspectorLoading(false);
    }
  };

  const handleCopyInspectorMd = () => {
    if (inspectorSections.length === 0) return;
    const { total, perSection } = inspectorTokenCounts;
    const charName = inspectorCharList.find((c) => c.id === inspectorCharId)?.name || "?";
    const lines: string[] = [
      `# System Prompt Inspector — ${charName}`,
      "",
      `**User:** ${inspectorUserName} | **NSFW:** ${inspectorNsfw ? "ON" : "OFF"} | **Sections:** ${inspectorSections.length} | **Total:** ~${total} tokens`,
      "",
      "---",
      "",
    ];
    for (let i = 0; i < inspectorSections.length; i++) {
      const s = inspectorSections[i];
      lines.push(
        `## ${i + 1}. ${s.label}`,
        "",
        `> ${perSection[i] ?? "?"} tokens | ${s.content.length} chars`,
        "",
        "```",
        s.content,
        "```",
        "",
      );
    }
    const md = lines.join("\n");
    // Use textarea fallback for reliable copy (clipboard API can be slow/laggy with large text)
    const ta = document.createElement("textarea");
    ta.value = md;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    setInspectorCopied(true);
    setTimeout(() => setInspectorCopied(false), 2000);
  };

  const inspectorOverlaps = useMemo(
    () => (inspectorSections.length > 0 ? detectOverlaps(inspectorSections) : []),
    [inspectorSections]
  );

  const allowedModelIds = useMemo(
    () => new Set(allowedModels.map((m) => m.model_id)),
    [allowedModels]
  );

  const groupedAllowedModels = useMemo(() => {
    const groups: Record<string, AllowedModel[]> = {};
    for (const m of allowedModels) {
      const key = m.provider || "other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    }
    // Sort groups: mimo, google_genai, then alphabetical OpenRouter providers
    const order = ["mimo", "google_genai"];
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });
    return sortedKeys.map((key) => ({ provider: key, models: groups[key] }));
  }, [allowedModels]);

  const filteredModels = useMemo(() => {
    if (!search.trim()) return allModels;
    const q = search.toLowerCase();
    return allModels.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q)
    );
  }, [allModels, search]);

  const filteredMimoModels = useMemo(() => {
    if (!mimoSearch.trim()) return mimoModels;
    const q = mimoSearch.toLowerCase();
    return mimoModels.filter(
      (m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
    );
  }, [mimoModels, mimoSearch]);

  const filteredGoogleModels = useMemo(() => {
    if (!googleSearch.trim()) return googleModels;
    const q = googleSearch.toLowerCase();
    return googleModels.filter(
      (m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
    );
  }, [googleModels, googleSearch]);

  const handleAddModel = async (model: OpenRouterModel, sourceProvider?: string) => {
    if (allowedModelIds.has(model.id)) return;
    setAdding(model.id);
    try {
      const provider = sourceProvider || model.id.split("/")[0] || "";
      const isFree =
        model.pricing?.prompt === "0" && model.pricing?.completion === "0";

      const modelData = {
        model_id: model.id,
        model_name: model.name,
        provider,
        is_free: isFree,
        is_recommended: false,
        sort_order: allowedModels.length,
        description: "",
      };

      if (isOp && !isAdmin) {
        await createApproval(user!.id, `Thêm model: ${model.name}`, {
          action: "model_add",
          target_table: "allowed_models",
          data: modelData as Record<string, unknown>,
        });
        toast.success("Yêu cầu thêm model đã gửi cho Admin duyệt!");
        return;
      }

      const saved = await addAllowedModel(modelData);
      setAllowedModels((prev) => [...prev, saved]);
      toast.success(`Đã thêm: ${model.name}`);
    } catch (err: any) {
      if (err?.message?.includes("duplicate")) {
        toast.error("Model này đã có trong danh sách.");
      } else {
        toast.error("Không thể thêm model.");
      }
    } finally {
      setAdding(null);
    }
  };

  const handleRemoveModel = async (id: string) => {
    try {
      if (isOp && !isAdmin) {
        const model = allowedModels.find((m) => m.id === id);
        await createApproval(user!.id, `Xoá model: ${model?.model_name ?? id}`, {
          action: "model_remove",
          target_table: "allowed_models",
          target_id: id,
          data: {},
        });
        toast.success("Yêu cầu xoá model đã gửi cho Admin duyệt!");
        return;
      }
      await removeAllowedModel(id);
      setAllowedModels((prev) => prev.filter((m) => m.id !== id));
      toast.success("Đã xoá model.");
    } catch {
      toast.error("Không thể xoá model.");
    }
  };

  const handleToggleRecommended = async (model: AllowedModel) => {
    const newVal = !model.is_recommended;
    try {
      if (isOp && !isAdmin) {
        await createApproval(
          user!.id,
          `${newVal ? "Đề xuất" : "Bỏ đề xuất"} model: ${model.model_name}`,
          {
            action: "model_toggle_recommended",
            target_table: "allowed_models",
            target_id: model.id,
            data: { is_recommended: newVal },
          },
        );
        toast.success("Yêu cầu đã gửi cho Admin duyệt!");
        return;
      }
      await toggleModelRecommended(model.id, newVal);
      setAllowedModels((prev) =>
        prev.map((m) => (m.id === model.id ? { ...m, is_recommended: newVal } : m))
      );
    } catch {
      toast.error("Không thể cập nhật.");
    }
  };

  const formatPrice = (pricing?: { prompt?: string; completion?: string }) => {
    if (!pricing) return "N/A";
    const p = parseFloat(pricing.prompt || "0");
    const c = parseFloat(pricing.completion || "0");
    if (p === 0 && c === 0) return "Miễn phí";
    return `$${(p * 1e6).toFixed(2)} / $${(c * 1e6).toFixed(2)} per 1M tokens`;
  };

  if (isLoading || checking) {
    return (
      <div className="flex-1 flex items-center justify-center bg-oled-base">
        <Loader2 size={24} className="animate-spin text-neon-purple" />
      </div>
    );
  }

  if (!user || !canViewAdminHub) {
    return <Navigate to="/" replace />;
  }

  return (
    <AdminPageShell
      backTo="/admin"
      icon={Zap}
      iconGradient="bg-gradient-to-br from-neon-blue to-cyan-500"
      title="AI Configuration"
      subtitle="API Keys, Models, Prompts & Sampling"
    >

        {/* API Key Verification */}
        <Card className="bg-oled-surface border-oled-border">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-neon-blue shadow-neon-blue" />
              <h2 className="text-sm font-semibold text-foreground">Verify OpenRouter API Key</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Nhập API Key OpenRouter, verify để kiểm tra, rồi lưu (mã hoá) lên Supabase.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 min-w-0">
                <Input
                  type={showKey ? "text" : "password"}
                  value={testApiKey}
                  onChange={(e) => { setTestApiKey(e.target.value); setVerified(null); setSaved(false); }}
                  placeholder="sk-or-v1-..."
                  className="bg-oled-elevated border-gray-border text-foreground pr-10 focus:border-neon-blue focus:ring-neon-blue/30"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleVerify}
                  disabled={verifying || !testApiKey.trim()}
                  className={`flex-1 sm:flex-none sm:min-w-[100px] ${
                    verified === true
                      ? "bg-green-500/20 text-green-400 border-green-500/30"
                      : verified === false
                      ? "bg-destructive/20 text-destructive border-destructive/30"
                      : "bg-neon-blue/10 text-neon-blue border-neon-blue/30 hover:bg-neon-blue/20"
                  }`}
                  variant="outline"
                >
                  {verifying ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} className="mr-1" />}
                  {verified === true ? "Hợp lệ ✓" : verified === false ? "Lỗi ✗" : "Verify"}
                </Button>
                <Button
                  onClick={handleSaveKey}
                  disabled={verified !== true || saved}
                  className={`flex-1 sm:flex-none sm:min-w-[80px] ${
                    saved
                      ? "bg-green-500/20 text-green-400 border-green-500/30"
                      : "bg-neon-blue/10 text-neon-blue border-neon-blue/30 hover:bg-neon-blue/20"
                  }`}
                  variant="outline"
                >
                  <Save size={14} className="mr-1" />
                  {saved ? "Đã lưu" : "Lưu"}
                </Button>
              </div>
            </div>

            {/* Collapsible: Browse & Add OpenRouter Models */}
            <div className="pt-2 border-t border-gray-border/50">
              <button
                onClick={() => setOpenRouterBrowseOpen(!openRouterBrowseOpen)}
                className="w-full flex items-center gap-1.5 px-1 py-1.5 rounded-md text-left hover:bg-oled-elevated transition-colors"
              >
                {openRouterBrowseOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <Search size={12} className="text-amber-400" />
                <span className="text-xs text-amber-400 font-semibold flex-1">Tìm & thêm model</span>
                {allModels.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">{allModels.length} model</span>
                )}
              </button>

              {openRouterBrowseOpen && (
                <div className="pt-2 space-y-3">
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleLoadModels}
                      disabled={loadingModels}
                      variant="outline"
                      size="sm"
                      className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    >
                      {loadingModels ? (
                        <Loader2 size={14} className="animate-spin mr-1" />
                      ) : (
                        <RefreshCw size={14} className="mr-1" />
                      )}
                      {allModels.length > 0 ? "Tải lại" : "Tải danh sách"}
                    </Button>
                  </div>

                  {allModels.length > 0 && (
                    <>
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Tìm model theo tên hoặc ID..."
                          className="bg-oled-elevated border-gray-border text-foreground pl-9 text-xs focus:border-amber-500 focus:ring-amber-500/30"
                        />
                      </div>

                      <p className="text-[10px] text-muted-foreground">
                        {filteredModels.length} / {allModels.length} model. Click "+" để thêm vào danh sách cho phép.
                      </p>

                      <ScrollArea className="h-[40vh] md:h-[300px] pr-2">
                        <div className="space-y-1">
                          {filteredModels.map((model) => {
                            const isAdded = allowedModelIds.has(model.id);
                            const isFree = model.pricing?.prompt === "0" && model.pricing?.completion === "0";
                            return (
                              <div
                                key={model.id}
                                className={`flex items-center gap-2 rounded-xl px-3 py-2 transition-colors ${
                                  isAdded
                                    ? "bg-neon-purple/5 border border-neon-purple/20"
                                    : "bg-oled-elevated hover:bg-oled-elevated/80"
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-medium text-foreground truncate">
                                      {model.name}
                                    </span>
                                    {isFree && (
                                      <span className="text-[9px] font-bold bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full shrink-0">
                                        FREE
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] text-muted-foreground truncate">{model.id}</span>
                                    <span className="text-[10px] text-muted-foreground/50">·</span>
                                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                      <DollarSign size={8} />
                                      {formatPrice(model.pricing)}
                                    </span>
                                  </div>
                                </div>
                                {isAdded ? (
                                  <span className="text-[10px] text-neon-purple font-medium px-2 py-1 rounded-lg bg-neon-purple/10">
                                    Đã thêm
                                  </span>
                                ) : (
                                  <Button
                                    onClick={() => handleAddModel(model)}
                                    disabled={adding === model.id || !canEditAdminHub}
                                    size="sm"
                                    variant="ghost"
                                    className="h-10 w-10 md:h-8 md:w-8 p-0 text-muted-foreground hover:text-neon-purple hover:bg-neon-purple/10"
                                    title={!canEditAdminHub ? "Chỉ Admin/Op mới có quyền thêm model" : undefined}
                                  >
                                    {adding === model.id ? (
                                      <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                      <Plus size={16} />
                                    )}
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </>
                  )}

                  {allModels.length === 0 && !loadingModels && (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      Nhấn "Tải danh sách" để lấy model từ OpenRouter.
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Xiaomi Mimo API Key */}
        <Card className="bg-oled-surface border-oled-border">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-neon-rose shadow-[0_0_6px] shadow-neon-rose" />
              <h2 className="text-sm font-semibold text-foreground">Xiaomi Mimo API Key</h2>
              <Badge variant="outline" className="text-[10px] border-neon-rose/30 text-neon-rose py-0 h-5">
                Mod/Op/Admin
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              BYOK cho Xiaomi Mimo. Endpoint có thể tùy chỉnh bên dưới.
            </p>
            {/* Mimo API Endpoint */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={mimoEndpoint}
                onChange={(e) => { setMimoEndpointState(e.target.value); setSavedMimoEndpoint(false); }}
                placeholder="https://token-plan-sgp.xiaomimimo.com/v1"
                className="bg-oled-elevated border-gray-border text-foreground text-base md:text-xs font-mono focus:border-neon-rose focus:ring-neon-rose/30"
              />
              <Button
                onClick={handleSaveMimoEndpoint}
                disabled={savedMimoEndpoint}
                className={`sm:min-w-[80px] ${
                  savedMimoEndpoint
                    ? "bg-green-500/20 text-green-400 border-green-500/30"
                    : "bg-neon-rose/10 text-neon-rose border-neon-rose/30 hover:bg-neon-rose/20"
                }`}
                variant="outline"
              >
                <Save size={14} className="mr-1" />
                {savedMimoEndpoint ? "Đã lưu" : "Lưu"}
              </Button>
            </div>
            {/* Mimo API Key */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 min-w-0">
                <Input
                  type={showMimoKey ? "text" : "password"}
                  value={testMimoKey}
                  onChange={(e) => { setTestMimoKey(e.target.value); setVerifiedMimo(null); setSavedMimo(false); }}
                  placeholder="Nhập Xiaomi Mimo API Key..."
                  className="bg-oled-elevated border-gray-border text-foreground pr-10 focus:border-neon-rose focus:ring-neon-rose/30"
                />
                <button
                  type="button"
                  onClick={() => setShowMimoKey(!showMimoKey)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  {showMimoKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleVerifyMimo}
                  disabled={verifyingMimo || !testMimoKey.trim()}
                  className={`flex-1 sm:flex-none sm:min-w-[100px] ${
                    verifiedMimo === true
                      ? "bg-green-500/20 text-green-400 border-green-500/30"
                      : verifiedMimo === false
                      ? "bg-destructive/20 text-destructive border-destructive/30"
                      : "bg-neon-rose/10 text-neon-rose border-neon-rose/30 hover:bg-neon-rose/20"
                  }`}
                  variant="outline"
                >
                  {verifyingMimo ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} className="mr-1" />}
                  {verifiedMimo === true ? "Hợp lệ ✓" : verifiedMimo === false ? "Lỗi ✗" : "Verify"}
                </Button>
                <Button
                  onClick={handleSaveMimoKey}
                  disabled={verifiedMimo !== true || savedMimo}
                  className={`flex-1 sm:flex-none sm:min-w-[80px] ${
                    savedMimo
                      ? "bg-green-500/20 text-green-400 border-green-500/30"
                      : "bg-neon-rose/10 text-neon-rose border-neon-rose/30 hover:bg-neon-rose/20"
                  }`}
                  variant="outline"
                >
                  <Save size={14} className="mr-1" />
                  {savedMimo ? "Đã lưu" : "Lưu"}
                </Button>
              </div>
            </div>

            {/* Collapsible: Browse Mimo Models */}
            <div className="pt-2 border-t border-gray-border/50">
              <button
                onClick={() => {
                  setMimoBrowseOpen(!mimoBrowseOpen);
                  if (!mimoBrowseOpen && mimoModels.length === 0 && getMimoApiKey()) {
                    handleLoadMimoModels();
                  }
                }}
                className="w-full flex items-center gap-1.5 px-1 py-1.5 rounded-md text-left hover:bg-oled-elevated transition-colors"
              >
                {mimoBrowseOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <Search size={12} className="text-neon-rose" />
                <span className="text-xs text-neon-rose font-semibold flex-1">Danh sách model</span>
                {mimoModels.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">{mimoModels.length} model</span>
                )}
              </button>

              {mimoBrowseOpen && (
                <div className="pt-2 space-y-3">
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleLoadMimoModels}
                      disabled={loadingMimoModels}
                      variant="outline"
                      size="sm"
                      className="border-neon-rose/30 text-neon-rose hover:bg-neon-rose/10"
                    >
                      {loadingMimoModels ? (
                        <Loader2 size={14} className="animate-spin mr-1" />
                      ) : (
                        <RefreshCw size={14} className="mr-1" />
                      )}
                      {mimoModels.length > 0 ? "Tải lại" : "Tải danh sách"}
                    </Button>
                  </div>

                  {loadingMimoModels ? (
                    <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-neon-rose" /></div>
                  ) : mimoModels.length > 0 ? (
                    <>
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={mimoSearch}
                          onChange={(e) => setMimoSearch(e.target.value)}
                          placeholder="Tìm model theo tên hoặc ID..."
                          className="bg-oled-elevated border-gray-border text-foreground pl-9 text-xs focus:border-neon-rose focus:ring-neon-rose/30"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {filteredMimoModels.length} / {mimoModels.length} model
                      </p>
                      <ScrollArea className="h-[30vh] md:h-[200px] pr-2">
                        <div className="space-y-1">
                          {filteredMimoModels.map((model) => {
                          const isAdded = allowedModelIds.has(model.id);
                          return (
                            <div key={model.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${isAdded ? "bg-neon-purple/5 border border-neon-purple/20" : "bg-oled-elevated"}`}>
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-medium text-foreground truncate block">{model.name}</span>
                                <span className="text-[10px] text-muted-foreground truncate block">{model.id}</span>
                              </div>
                              {isAdded ? (
                                <span className="text-[10px] text-neon-purple font-medium px-2 py-1 rounded-lg bg-neon-purple/10 shrink-0">Đã thêm</span>
                              ) : (
                                <Button
                                  onClick={() => handleAddModel(model, "mimo")}
                                  disabled={adding === model.id || !canEditAdminHub}
                                  size="sm" variant="ghost"
                                  className="h-10 w-10 md:h-8 md:w-8 p-0 text-muted-foreground hover:text-neon-purple hover:bg-neon-purple/10 shrink-0"
                                  title={!canEditAdminHub ? "Chỉ Admin/Op mới có quyền thêm model" : undefined}
                                >
                                  {adding === model.id ? <Loader2 size={14} className="animate-spin" /> : <Plus size={16} />}
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      {getMimoApiKey() ? "Nhấn \"Tải danh sách\" để xem model." : "Nhập API Key ở trên trước."}
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Google GenAI API Key */}
        <Card className="bg-oled-surface border-oled-border">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400" />
              <h2 className="text-sm font-semibold text-foreground">Google GenAI API Key</h2>
              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 py-0 h-5">
                Mod/Op/Admin
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              BYOK cho Google Generative AI (Gemini). Endpoint có thể tùy chỉnh bên dưới.
            </p>
            {/* Google GenAI API Endpoint */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={googleEndpoint}
                onChange={(e) => { setGoogleEndpointState(e.target.value); setSavedGoogleEndpoint(false); }}
                placeholder="https://generativelanguage.googleapis.com/v1beta"
                className="bg-oled-elevated border-gray-border text-foreground text-base md:text-xs font-mono focus:border-emerald-500 focus:ring-emerald-500/30"
              />
              <Button
                onClick={handleSaveGoogleEndpoint}
                disabled={savedGoogleEndpoint}
                className={`sm:min-w-[80px] ${
                  savedGoogleEndpoint
                    ? "bg-green-500/20 text-green-400 border-green-500/30"
                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                }`}
                variant="outline"
              >
                <Save size={14} className="mr-1" />
                {savedGoogleEndpoint ? "Đã lưu" : "Lưu"}
              </Button>
            </div>
            {/* Google GenAI API Key */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 min-w-0">
                <Input
                  type={showGoogleKey ? "text" : "password"}
                  value={testGoogleKey}
                  onChange={(e) => { setTestGoogleKey(e.target.value); setVerifiedGoogle(null); setSavedGoogle(false); }}
                  placeholder="Nhập Google GenAI API Key..."
                  className="bg-oled-elevated border-gray-border text-foreground pr-10 focus:border-emerald-500 focus:ring-emerald-500/30"
                />
                <button
                  type="button"
                  onClick={() => setShowGoogleKey(!showGoogleKey)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  {showGoogleKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleVerifyGoogle}
                  disabled={verifyingGoogle || !testGoogleKey.trim()}
                  className={`flex-1 sm:flex-none sm:min-w-[100px] ${
                    verifiedGoogle === true
                      ? "bg-green-500/20 text-green-400 border-green-500/30"
                      : verifiedGoogle === false
                      ? "bg-destructive/20 text-destructive border-destructive/30"
                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                  }`}
                  variant="outline"
                >
                  {verifyingGoogle ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} className="mr-1" />}
                  {verifiedGoogle === true ? "Hợp lệ" : verifiedGoogle === false ? "Lỗi" : "Verify"}
                </Button>
                <Button
                  onClick={handleSaveGoogleKey}
                  disabled={verifiedGoogle !== true || savedGoogle}
                  className={`flex-1 sm:flex-none sm:min-w-[80px] ${
                    savedGoogle
                      ? "bg-green-500/20 text-green-400 border-green-500/30"
                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                  }`}
                  variant="outline"
                >
                  <Save size={14} className="mr-1" />
                  {savedGoogle ? "Đã lưu" : "Lưu"}
                </Button>
              </div>
            </div>

            {/* Collapsible: Browse Google GenAI Models */}
            <div className="pt-2 border-t border-gray-border/50">
              <button
                onClick={() => {
                  setGoogleBrowseOpen(!googleBrowseOpen);
                  if (!googleBrowseOpen && googleModels.length === 0 && getGoogleGenaiApiKey()) {
                    handleLoadGoogleModels();
                  }
                }}
                className="w-full flex items-center gap-1.5 px-1 py-1.5 rounded-md text-left hover:bg-oled-elevated transition-colors"
              >
                {googleBrowseOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <Search size={12} className="text-emerald-400" />
                <span className="text-xs text-emerald-400 font-semibold flex-1">Danh sách model</span>
                {googleModels.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">{googleModels.length} model</span>
                )}
              </button>

              {googleBrowseOpen && (
                <div className="pt-2 space-y-3">
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleLoadGoogleModels}
                      disabled={loadingGoogleModels}
                      variant="outline"
                      size="sm"
                      className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                    >
                      {loadingGoogleModels ? (
                        <Loader2 size={14} className="animate-spin mr-1" />
                      ) : (
                        <RefreshCw size={14} className="mr-1" />
                      )}
                      {googleModels.length > 0 ? "Tải lại" : "Tải danh sách"}
                    </Button>
                  </div>

                  {loadingGoogleModels ? (
                    <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-emerald-400" /></div>
                  ) : googleModels.length > 0 ? (
                    <>
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={googleSearch}
                          onChange={(e) => setGoogleSearch(e.target.value)}
                          placeholder="Tìm model theo tên hoặc ID..."
                          className="bg-oled-elevated border-gray-border text-foreground pl-9 text-xs focus:border-emerald-500 focus:ring-emerald-500/30"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {filteredGoogleModels.length} / {googleModels.length} model
                      </p>
                      <ScrollArea className="h-[30vh] md:h-[200px] pr-2">
                        <div className="space-y-1">
                          {filteredGoogleModels.map((model) => {
                          const isAdded = allowedModelIds.has(model.id);
                          return (
                            <div key={model.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${isAdded ? "bg-neon-purple/5 border border-neon-purple/20" : "bg-oled-elevated"}`}>
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-medium text-foreground truncate block">{model.name}</span>
                                <span className="text-[10px] text-muted-foreground truncate block">{model.id}</span>
                              </div>
                              {isAdded ? (
                                <span className="text-[10px] text-neon-purple font-medium px-2 py-1 rounded-lg bg-neon-purple/10 shrink-0">Đã thêm</span>
                              ) : (
                                <Button
                                  onClick={() => handleAddModel(model, "google_genai")}
                                  disabled={adding === model.id || !canEditAdminHub}
                                  size="sm" variant="ghost"
                                  className="h-10 w-10 md:h-8 md:w-8 p-0 text-muted-foreground hover:text-neon-purple hover:bg-neon-purple/10 shrink-0"
                                  title={!canEditAdminHub ? "Chỉ Admin/Op mới có quyền thêm model" : undefined}
                                >
                                  {adding === model.id ? <Loader2 size={14} className="animate-spin" /> : <Plus size={16} />}
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      {getGoogleGenaiApiKey() ? "Nhấn \"Tải danh sách\" để xem model." : "Nhập API Key ở trên trước."}
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ═══════ Platform API Keys (admin-only) ═══════ */}
        {isAdmin && (
          <Card className="bg-oled-surface border-oled-border">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px] shadow-amber-400" />
                <h2 className="text-sm font-semibold text-foreground">Platform API Keys</h2>
                <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400 py-0 h-5">
                  Admin only
                </Badge>
                <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-400 py-0 h-5">
                  {platformKeys.filter((k) => k.is_active).length} active
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Pool OpenRouter API keys — Edge Function xoay vòng giữa các key active khi user chat.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Tên (VD: Key #1)"
                  className="bg-oled-elevated border-gray-border text-foreground text-base md:text-sm h-10 md:h-9 sm:flex-[0.3]"
                />
                <Input
                  value={newKeyValue}
                  onChange={(e) => setNewKeyValue(e.target.value)}
                  placeholder="sk-or-v1-..."
                  type="password"
                  className="bg-oled-elevated border-gray-border text-foreground text-base md:text-sm h-10 md:h-9 sm:flex-[0.7] font-mono"
                />
                <Button
                  size="sm"
                  onClick={handleAddKey}
                  disabled={addingKey}
                  className="h-10 md:h-9 bg-amber-500 hover:bg-amber-600 text-white shrink-0"
                >
                  {addingKey ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                </Button>
              </div>

              {loadingKeys ? (
                <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-neon-purple" /></div>
              ) : platformKeys.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Chưa có API key nào. Thêm key ở trên.</p>
              ) : (
                <div className="space-y-2">
                  {platformKeys.map((k) => (
                    <div key={k.id} className={`flex items-center gap-3 bg-oled-elevated rounded-xl px-3 py-2.5 ${!k.is_active ? "opacity-50" : ""}`}>
                      <button onClick={() => handleToggleKey(k)} className="shrink-0" title={k.is_active ? "Tắt" : "Bật"}>
                        {k.is_active ? <ToggleRight size={22} className="text-green-400" /> : <ToggleLeft size={22} className="text-muted-foreground" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium text-foreground truncate">{k.key_name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono truncate">
                            {showKeyId === k.id ? k.api_key : `${k.api_key.slice(0, 12)}...${k.api_key.slice(-4)}`}
                          </span>
                          <button onClick={() => setShowKeyId(showKeyId === k.id ? null : k.id)} className="text-muted-foreground hover:text-foreground">
                            {showKeyId === k.id ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                          <span>{k.request_count.toLocaleString()} requests</span>
                          {k.last_used_at && <span>· Last: {new Date(k.last_used_at).toLocaleDateString("vi-VN")}</span>}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-9 w-9 md:h-7 md:w-7 text-muted-foreground hover:text-red-400" onClick={() => handleDeleteKey(k.id)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-center">
                <Button variant="ghost" size="sm" onClick={() => { setLoadingKeys(true); fetchPlatformKeys().finally(() => setLoadingKeys(false)); }}
                  className="text-xs text-muted-foreground hover:text-neon-blue">
                  <RefreshCw size={12} className="mr-1.5" /> Làm mới
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══════ Model Tiers (Fixed: free / pro / ultra) ═══════ */}
        <Card className="bg-oled-surface border-oled-border">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-neon-rose shadow-[0_0_6px] shadow-neon-rose" />
              <h2 className="text-sm font-semibold text-foreground">Model Tiers cho User</h2>
              <Badge variant="outline" className="text-[10px] border-neon-rose/30 text-neon-rose py-0 h-5">
                3 cố định
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              User thấy 3 tier này thay vì model thật. Nhập OpenRouter model ID cho mỗi tier.
            </p>

            {loadingTiers ? (
              <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-neon-purple" /></div>
            ) : (
              <div className="space-y-3">
                {tiers.map((tier) => {
                  const meta = TIER_META[tier.tier_key] || TIER_META.free;
                  const Icon = meta.icon;
                  const edited = (tierEdits[tier.tier_key] ?? tier.model_id) !== tier.model_id;

                  return (
                    <div key={tier.id} className="bg-oled-elevated rounded-xl p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}>
                          <Icon size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">{tier.display_name}</span>
                            {tier.min_subscription !== "free" && (
                              <span className="text-[9px] font-bold bg-neon-purple/20 text-neon-purple px-1.5 py-0.5 rounded-full">PRO</span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground">{tier.description}</p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                        <Input
                          value={tierEdits[tier.tier_key] ?? tier.model_id}
                          onChange={(e) => setTierEdits((prev) => ({ ...prev, [tier.tier_key]: e.target.value }))}
                          placeholder="google/gemini-2.0-flash-001"
                          className="bg-oled-base border-gray-border text-foreground text-base md:text-xs h-10 md:h-8 font-mono flex-1"
                          disabled={!isAdmin}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSaveTierModel(tier)}
                          disabled={!edited || savingTier === tier.tier_key || !isAdmin}
                          className="h-10 md:h-8 px-3 text-xs bg-neon-purple hover:bg-neon-purple/80 text-white disabled:opacity-30 sm:shrink-0"
                        >
                          {savingTier === tier.tier_key ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Allowed Models (Admin-Curated) */}
        <Card className="bg-oled-surface border-oled-border">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-neon-purple shadow-neon-purple" />
                <h2 className="text-sm font-semibold text-foreground">
                  Model cho phép ({allowedModels.length})
                </h2>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><Star size={10} className="text-yellow-500" /> Đề xuất</span>
                <span className="flex items-center gap-1"><Gift size={10} className="text-green-400" /> Miễn phí</span>
              </div>
            </div>

            {loadingAllowed ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
              </div>
            ) : allowedModels.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Chưa có model nào. Mở "Tìm & thêm model" trong mỗi card API Key ở trên.
              </p>
            ) : (
              <div className="space-y-4">
                {groupedAllowedModels.map((group) => {
                  const isMimo = group.provider === "mimo";
                  const isGoogle = group.provider === "google_genai";
                  const color = isMimo ? "text-neon-rose" : isGoogle ? "text-emerald-400" : "text-neon-purple";
                  const bg = isMimo ? "bg-neon-rose/10" : isGoogle ? "bg-emerald-500/10" : "bg-neon-purple/10";
                  const label = isMimo ? "Xiaomi Mimo" : isGoogle ? "Google GenAI" : group.provider;

                  return (
                    <div key={group.provider}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${color}`}>{label}</span>
                        <span className="text-[10px] text-muted-foreground">{group.models.length} model</span>
                      </div>
                      <div className="space-y-1.5">
                        {group.models.map((model) => (
                          <motion.div
                            key={model.id}
                            layout
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className="flex items-center gap-2 bg-oled-elevated rounded-xl px-3 py-2.5 group"
                          >
                            <GripVertical size={14} className="hidden sm:block text-muted-foreground/30 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium text-foreground truncate">{model.model_name}</span>
                                {model.is_recommended && (
                                  <BadgeCheck size={14} className="text-yellow-500 shrink-0" />
                                )}
                                {model.is_free && (
                                  <span className="text-[9px] font-bold bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full shrink-0">
                                    FREE
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground truncate">{model.model_id}</p>
                            </div>
                            <span className={`hidden sm:inline-flex text-[10px] ${color} ${bg} px-2 py-0.5 rounded-full shrink-0`}>
                              {label}
                            </span>
                            <button
                              onClick={() => handleToggleRecommended(model)}
                              className={`p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors ${
                                model.is_recommended
                                  ? "text-yellow-500 bg-yellow-500/10"
                                  : canEditAdminHub
                                  ? "text-muted-foreground/40 hover:text-yellow-500 hover:bg-yellow-500/10"
                                  : "text-muted-foreground/20 cursor-not-allowed"
                              }`}
                              title={!canEditAdminHub ? "Chỉ Admin/Op mới có quyền thay đổi" : model.is_recommended ? "Bỏ đề xuất" : "Đánh dấu đề xuất"}
                              disabled={!canEditAdminHub}
                            >
                              <Star size={14} />
                            </button>
                            <button
                              onClick={() => handleRemoveModel(model.id)}
                              className={`p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors ${
                                canEditAdminHub
                                  ? "text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
                                  : "text-muted-foreground/20 cursor-not-allowed"
                              }`}
                              title={canEditAdminHub ? "Xoá model" : "Chỉ Admin/Op mới có quyền xoá"}
                              disabled={!canEditAdminHub}
                            >
                              <Trash2 size={14} />
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══════ Type-Specific AI Prompts ═══════ */}
        <Card className="bg-oled-surface border-oled-border">
          <CardContent className="p-5 space-y-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-neon-blue shadow-[0_0_6px] shadow-neon-blue" />
              <h2 className="text-sm font-semibold text-foreground">AI Prompt Configuration</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Cấu hình prompt cho 2 loại card: <strong>Type A</strong> (1 nhân vật) và <strong>Type B</strong> (đa nhân vật/RPG).
              System sẽ tự động detect loại card và áp dụng prompt tương ứng.
            </p>

            {/* System Prompts */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Layers size={14} className="text-neon-blue" />
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">System Prompt</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Type A — Single Character
                  </Label>
                  <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                    Chỉ ghi: vai trò AI, tone, văn phong, quy tắc sáng tạo. Không lặp: anti-puppeting (đã ở Post-History), format spec (đã ở Format Rules).
                  </p>
                  <Textarea
                    rows={8}
                    value={promptTypeA}
                    onChange={(e) => setPromptTypeA(e.target.value)}
                    placeholder="System prompt cho card 1 nhân vật..."
                    className="bg-oled-base border-oled-border text-foreground font-mono text-sm resize-y min-h-[120px]"
                  />
                  <Button
                    size="sm"
                    onClick={handleSavePromptTypeA}
                    disabled={savingPromptTypeA}
                    className="bg-neon-blue/10 text-neon-blue border border-neon-blue/30 hover:bg-neon-blue/20"
                    variant="outline"
                  >
                    {savingPromptTypeA ? <Loader2 size={12} className="animate-spin mr-1" /> : <Save size={12} className="mr-1" />}
                    Lưu Type A
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Type B — Multi-Character / RPG
                  </Label>
                  <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                    Chỉ ghi: vai trò AI, quản lý đa nhân vật, chuyển cảnh, narrator rules. Không lặp: anti-puppeting, format spec, NPC voices (đã ở Post-History Type B).
                  </p>
                  <Textarea
                    rows={8}
                    value={promptTypeB}
                    onChange={(e) => setPromptTypeB(e.target.value)}
                    placeholder="System prompt cho card đa nhân vật/RPG..."
                    className="bg-oled-base border-oled-border text-foreground font-mono text-sm resize-y min-h-[120px]"
                  />
                  <Button
                    size="sm"
                    onClick={handleSavePromptTypeB}
                    disabled={savingPromptTypeB}
                    className="bg-neon-blue/10 text-neon-blue border border-neon-blue/30 hover:bg-neon-blue/20"
                    variant="outline"
                  >
                    {savingPromptTypeB ? <Loader2 size={12} className="animate-spin mr-1" /> : <Save size={12} className="mr-1" />}
                    Lưu Type B
                  </Button>
                </div>
              </div>
            </div>

            {/* Post-History Instructions */}
            <div className="space-y-4 pt-4 border-t border-oled-border">
              <div className="flex items-center gap-2">
                <Layers size={14} className="text-neon-purple" />
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Post-History Instructions</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Type A — Single Character
                  </Label>
                  <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                    Chỉ ghi: behavioral reinforcement (stay in character, match energy, push story). Không lặp: format spec (đã ở Format Rules), platform rules (đã ở System Prompt).
                  </p>
                  <Textarea
                    rows={6}
                    value={postHistoryTypeA}
                    onChange={(e) => setPostHistoryTypeA(e.target.value)}
                    placeholder="Post-history instructions cho Type A..."
                    className="bg-oled-base border-oled-border text-foreground font-mono text-sm resize-y min-h-[100px]"
                  />
                  <Button
                    size="sm"
                    onClick={handleSavePostHistoryTypeA}
                    disabled={savingPostHistoryTypeA}
                    className="bg-neon-purple/10 text-neon-purple border border-neon-purple/30 hover:bg-neon-purple/20"
                    variant="outline"
                  >
                    {savingPostHistoryTypeA ? <Loader2 size={12} className="animate-spin mr-1" /> : <Save size={12} className="mr-1" />}
                    Lưu Type A
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Type B — Multi-Character / RPG
                  </Label>
                  <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                    Chỉ ghi: NPC voices, inter-character dynamics, multi-char pacing. Không lặp: format spec, platform rules, basic anti-puppeting (đã ở Type A base).
                  </p>
                  <Textarea
                    rows={6}
                    value={postHistoryTypeB}
                    onChange={(e) => setPostHistoryTypeB(e.target.value)}
                    placeholder="Post-history instructions cho Type B..."
                    className="bg-oled-base border-oled-border text-foreground font-mono text-sm resize-y min-h-[100px]"
                  />
                  <Button
                    size="sm"
                    onClick={handleSavePostHistoryTypeB}
                    disabled={savingPostHistoryTypeB}
                    className="bg-neon-purple/10 text-neon-purple border border-neon-purple/30 hover:bg-neon-purple/20"
                    variant="outline"
                  >
                    {savingPostHistoryTypeB ? <Loader2 size={12} className="animate-spin mr-1" /> : <Save size={12} className="mr-1" />}
                    Lưu Type B
                  </Button>
                </div>
              </div>
            </div>

            {/* Legacy Fallback */}
            <div className="pt-4 border-t border-oled-border space-y-3">
              <p className="text-[10px] text-muted-foreground">
                <strong>Legacy Fallback:</strong> Nếu type-specific prompt trống, hệ thống sẽ dùng prompt bên dưới.
              </p>
              <Textarea
                rows={6}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Legacy global system prompt (fallback)..."
                className="bg-oled-base border-oled-border text-foreground font-mono text-sm resize-y min-h-[100px]"
              />
              <Button
                size="sm"
                onClick={handleSavePrompt}
                disabled={savingPrompt}
                className="bg-muted-foreground/10 text-muted-foreground border border-muted-foreground/30 hover:bg-muted-foreground/20"
                variant="outline"
              >
                {savingPrompt ? <Loader2 size={12} className="animate-spin mr-1" /> : <Save size={12} className="mr-1" />}
                Lưu Legacy Fallback
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ═══════ Sampling Parameters ═══════ */}
        <Card className="bg-oled-surface border-oled-border">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-neon-purple shadow-[0_0_6px] shadow-neon-purple" />
              <h2 className="text-sm font-semibold text-foreground">Sampling Parameters</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Các thông số này điều chỉnh <strong>độ sáng tạo</strong> và <strong>tính đa dạng</strong> của phản hồi AI. Giá trị cao = sáng tạo hơn, giá trị thấp = nhất quán hơn.
            </p>
            <div className="space-y-4">
              {/* Temperature */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground">Temperature (độ sáng tạo)</Label>
                  <span className="text-xs text-neon-purple font-mono">{samplingParams.temperature.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={samplingParams.temperature}
                  onChange={(e) => setSamplingParams({ ...samplingParams, temperature: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-oled-base rounded-lg appearance-none cursor-pointer accent-neon-purple"
                />
                <p className="text-[10px] text-muted-foreground">0.0 = Đáp ứng xác định / 2.0 = Cực kì sáng tạo</p>
              </div>

              {/* Top-P */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground">Top-P (Nucleus Sampling)</Label>
                  <span className="text-xs text-neon-purple font-mono">{samplingParams.top_p.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={samplingParams.top_p}
                  onChange={(e) => setSamplingParams({ ...samplingParams, top_p: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-oled-base rounded-lg appearance-none cursor-pointer accent-neon-purple"
                />
                <p className="text-[10px] text-muted-foreground">0.9 = Cân bằng sáng tạo & nhất quán / 1.0 = Không có giới hạn</p>
              </div>

              {/* Top-K */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground">Top-K (Diversity)</Label>
                  <span className="text-xs text-neon-purple font-mono">{Math.round(samplingParams.top_k)}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  value={samplingParams.top_k}
                  onChange={(e) => setSamplingParams({ ...samplingParams, top_k: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-oled-base rounded-lg appearance-none cursor-pointer accent-neon-purple"
                />
                <p className="text-[10px] text-muted-foreground">Số từ tốt nhất cần xem xét (40 = cân bằng tốt)</p>
              </div>

              {/* Repetition Penalty */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground">Repetition Penalty</Label>
                  <span className="text-xs text-neon-purple font-mono">{samplingParams.repetition_penalty.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="2"
                  step="0.05"
                  value={samplingParams.repetition_penalty}
                  onChange={(e) => setSamplingParams({ ...samplingParams, repetition_penalty: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-oled-base rounded-lg appearance-none cursor-pointer accent-neon-purple"
                />
                <p className="text-[10px] text-muted-foreground">1.0 = Không phạt / 1.2+ = Tránh lặp lại từ (tốt cho roleplay)</p>
              </div>

              {/* Max Output Tokens */}
              <div className="space-y-2 pt-2 border-t border-oled-border">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground">Max Output Tokens (độ dài phản hồi)</Label>
                  <span className="text-xs text-neon-purple font-mono">{Math.round(samplingParams.max_tokens)}</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="4096"
                  step="50"
                  value={samplingParams.max_tokens}
                  onChange={(e) => setSamplingParams({ ...samplingParams, max_tokens: parseInt(e.target.value) })}
                  className="w-full h-2 bg-oled-base rounded-lg appearance-none cursor-pointer accent-neon-purple"
                />
                <p className="text-[10px] text-muted-foreground">Giới hạn số token tối đa AI được phép sinh ra. 1500 = phù hợp roleplay / 4096 = phản hồi rất dài</p>
              </div>
            </div>

            <div className="bg-oled-base/50 border border-oled-border rounded-lg p-3 mt-4">
              <p className="text-[10px] text-muted-foreground">
                <strong>Gợi ý:</strong> Temperature 0.8-1.0 + Top-P 0.85-0.95 + Repetition Penalty 1.1-1.2 + Max Tokens 1500-2000 = Roleplay tốt với phản hồi đủ dài
              </p>
            </div>

            <Button
              onClick={handleSaveSamplingParams}
              disabled={savingSamplingParams}
              className="w-full bg-neon-purple hover:bg-neon-purple/80 text-white font-semibold"
            >
              {savingSamplingParams ? <Loader2 size={14} className="animate-spin mr-2" /> : <Save size={14} className="mr-2" />}
              Lưu Sampling Parameters
            </Button>
          </CardContent>
        </Card>

        {/* ═══════ Character Generation Prompts ═══════ */}
        <Card className="bg-oled-surface border-oled-border">
          <CardContent className="p-5 space-y-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-neon-blue shadow-[0_0_6px] shadow-neon-blue" />
              <Wand2 size={14} className="text-neon-blue" />
              <h2 className="text-sm font-semibold text-foreground">Character Generation Prompts</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Prompts dùng cho AI tạo nhân vật (cả trang Admin và User).
            </p>

            {/* Brainstorm Prompt */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Brainstorm — Creative Writer (Gen nhân vật mới)
              </Label>
              <Textarea
                rows={12}
                value={charGenBrainstorm}
                onChange={(e) => setCharGenBrainstorm(e.target.value)}
                placeholder="Prompt cho AI tạo nhân vật mới..."
                className="bg-oled-base border-oled-border text-foreground font-mono text-sm resize-y min-h-[180px]"
              />
              <Button
                size="sm"
                onClick={handleSaveCharGenBrainstorm}
                disabled={savingCharGenBrainstorm}
                className="bg-neon-blue/10 text-neon-blue border border-neon-blue/30 hover:bg-neon-blue/20"
                variant="outline"
              >
                {savingCharGenBrainstorm ? <Loader2 size={12} className="animate-spin mr-1" /> : <Save size={12} className="mr-1" />}
                Lưu Brainstorm
              </Button>
            </div>

            {/* Clone Prompt */}
            <div className="space-y-2 pt-4 border-t border-oled-border">
              <Label className="text-xs text-muted-foreground">
                Clone — Card Cloner (Sao chép từ nguồn)
              </Label>
              <Textarea
                rows={12}
                value={charGenClone}
                onChange={(e) => setCharGenClone(e.target.value)}
                placeholder="Prompt cho AI clone nhân vật..."
                className="bg-oled-base border-oled-border text-foreground font-mono text-sm resize-y min-h-[180px]"
              />
              <Button
                size="sm"
                onClick={handleSaveCharGenClone}
                disabled={savingCharGenClone}
                className="bg-neon-blue/10 text-neon-blue border border-neon-blue/30 hover:bg-neon-blue/20"
                variant="outline"
              >
                {savingCharGenClone ? <Loader2 size={12} className="animate-spin mr-1" /> : <Save size={12} className="mr-1" />}
                Lưu Clone
              </Button>
            </div>

            {/* Format Prompt */}
            <div className="space-y-2 pt-4 border-t border-oled-border">
              <Label className="text-xs text-muted-foreground">
                Format — JSON Formatter (Chuyển sang chara_card_v2)
              </Label>
              <Textarea
                rows={15}
                value={charGenFormat}
                onChange={(e) => setCharGenFormat(e.target.value)}
                placeholder="Prompt cho AI format JSON..."
                className="bg-oled-base border-oled-border text-foreground font-mono text-sm resize-y min-h-[220px]"
              />
              <Button
                size="sm"
                onClick={handleSaveCharGenFormat}
                disabled={savingCharGenFormat}
                className="bg-neon-blue/10 text-neon-blue border border-neon-blue/30 hover:bg-neon-blue/20"
                variant="outline"
              >
                {savingCharGenFormat ? <Loader2 size={12} className="animate-spin mr-1" /> : <Save size={12} className="mr-1" />}
                Lưu Format
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ═══════ Charagen Budget Config ═══════ */}
        <Card className="bg-oled-surface border-oled-border">
          <CardContent className="p-5 space-y-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-neon-blue shadow-[0_0_6px] shadow-neon-blue" />
              <Wand2 size={14} className="text-neon-blue" />
              <h2 className="text-sm font-semibold text-foreground">Charagen Budget Config</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Giới hạn token/char cho từng field khi AI tạo nhân vật. Giá trị injected vào system prompt dưới dạng FIELD TARGETS / FIELD LIMITS.
            </p>

            {/* Token limits grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {([
                { key: "description",   label: "Description",   tokenField: "maxTokens", charField: "maxChars" },
                { key: "personality",   label: "Personality",   tokenField: "maxTokens", charField: "maxChars" },
                { key: "scenario",      label: "Scenario",      tokenField: "maxTokens", charField: "maxChars" },
                { key: "first_mes",     label: "First Message", tokenField: "maxTokens", charField: "maxChars" },
                { key: "system_prompt", label: "System Prompt", tokenField: "maxTokens", charField: "maxChars" },
              ] as const).map(({ key, label, tokenField, charField }) => (
                <div key={key} className="bg-oled-base/50 border border-oled-border rounded-lg p-3 space-y-2">
                  <Label className="text-xs font-medium text-foreground">{label}</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Max Tokens</Label>
                      <Input
                        type="number"
                        min={50}
                        max={2000}
                        value={charGenBudget[key][tokenField]}
                        onChange={(e) => setCharGenBudget({
                          ...charGenBudget,
                          [key]: { ...charGenBudget[key], [tokenField]: parseInt(e.target.value) || 0 },
                        })}
                        className="bg-oled-base border-oled-border text-foreground h-8 text-sm font-mono"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Max Chars</Label>
                      <Input
                        type="number"
                        min={100}
                        max={8000}
                        value={charGenBudget[key][charField]}
                        onChange={(e) => setCharGenBudget({
                          ...charGenBudget,
                          [key]: { ...charGenBudget[key], [charField]: parseInt(e.target.value) || 0 },
                        })}
                        className="bg-oled-base border-oled-border text-foreground h-8 text-sm font-mono"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Creator Notes — chars only */}
              <div className="bg-oled-base/50 border border-oled-border rounded-lg p-3 space-y-2">
                <Label className="text-xs font-medium text-foreground">Creator Notes</Label>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Max Chars</Label>
                  <Input
                    type="number"
                    min={100}
                    max={2000}
                    value={charGenBudget.creator_notes.maxChars}
                    onChange={(e) => setCharGenBudget({
                      ...charGenBudget,
                      creator_notes: { maxChars: parseInt(e.target.value) || 0 },
                    })}
                    className="bg-oled-base border-oled-border text-foreground h-8 text-sm font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Mes Example pairs */}
            <div className="bg-oled-base/50 border border-oled-border rounded-lg p-3 space-y-2">
              <Label className="text-xs font-medium text-foreground">Mes Example — Dialogue Pairs</Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Min Pairs</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={charGenBudget.mes_example.minPairs}
                    onChange={(e) => setCharGenBudget({
                      ...charGenBudget,
                      mes_example: { ...charGenBudget.mes_example, minPairs: parseInt(e.target.value) || 0 },
                    })}
                    className="bg-oled-base border-oled-border text-foreground h-8 text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Ideal Pairs</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={charGenBudget.mes_example.idealPairs}
                    onChange={(e) => setCharGenBudget({
                      ...charGenBudget,
                      mes_example: { ...charGenBudget.mes_example, idealPairs: parseInt(e.target.value) || 0 },
                    })}
                    className="bg-oled-base border-oled-border text-foreground h-8 text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Max Pairs</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={charGenBudget.mes_example.maxPairs}
                    onChange={(e) => setCharGenBudget({
                      ...charGenBudget,
                      mes_example: { ...charGenBudget.mes_example, maxPairs: parseInt(e.target.value) || 0 },
                    })}
                    className="bg-oled-base border-oled-border text-foreground h-8 text-sm font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="bg-oled-base/50 border border-oled-border rounded-lg p-3 space-y-2">
              <Label className="text-xs font-medium text-foreground">Tags</Label>
              <div className="w-32 space-y-1">
                <Label className="text-[10px] text-muted-foreground">Max Items</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={charGenBudget.tags.maxItems}
                  onChange={(e) => setCharGenBudget({
                    ...charGenBudget,
                    tags: { maxItems: parseInt(e.target.value) || 0 },
                  })}
                  className="bg-oled-base border-oled-border text-foreground h-8 text-sm font-mono"
                />
              </div>
            </div>

            <Button
              onClick={handleSaveCharGenBudget}
              disabled={savingCharGenBudget}
              className="w-full bg-neon-blue hover:bg-neon-blue/80 text-white font-semibold"
            >
              {savingCharGenBudget ? <Loader2 size={14} className="animate-spin mr-2" /> : <Save size={14} className="mr-2" />}
              Lưu Budget Config
            </Button>
          </CardContent>
        </Card>

        {/* ═══════ Memory & Content Safety Prompts ═══════ */}
        <Card className="bg-oled-surface border-oled-border">
          <CardContent className="p-5 space-y-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400" />
              <Brain size={14} className="text-emerald-400" />
              <h2 className="text-sm font-semibold text-foreground">Memory & Content Safety</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Prompt tóm tắt ngữ cảnh chat và chính sách nội dung NSFW.
            </p>

            {/* Memory Archivist */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Memory Archivist — Tóm tắt ngữ cảnh chat
              </Label>
              <Textarea
                rows={8}
                value={memoryArchivist}
                onChange={(e) => setMemoryArchivist(e.target.value)}
                placeholder="Prompt cho AI tóm tắt ngữ cảnh..."
                className="bg-oled-base border-oled-border text-foreground font-mono text-sm resize-y min-h-[120px]"
              />
              <Button
                size="sm"
                onClick={handleSaveMemoryArchivist}
                disabled={savingMemoryArchivist}
                className="bg-emerald-400/10 text-emerald-400 border border-emerald-400/30 hover:bg-emerald-400/20"
                variant="outline"
              >
                {savingMemoryArchivist ? <Loader2 size={12} className="animate-spin mr-1" /> : <Save size={12} className="mr-1" />}
                Lưu Memory Archivist
              </Button>
            </div>

            {/* NSFW Gate */}
            <div className="space-y-2 pt-4 border-t border-oled-border">
              <Label className="text-xs text-muted-foreground">
                NSFW Gate — Chính sách nội dung (khi NSFW tắt)
              </Label>
              <Textarea
                rows={3}
                value={nsfwGatePrompt}
                onChange={(e) => setNsfwGatePrompt(e.target.value)}
                placeholder="System note khi NSFW bị tắt..."
                className="bg-oled-base border-oled-border text-foreground font-mono text-sm resize-y min-h-[60px]"
              />
              <p className="text-[10px] text-muted-foreground">
                Appended vào post-history khi user tắt NSFW mode. Để trống = không chặn.
              </p>
              <Button
                size="sm"
                onClick={handleSaveNsfwGatePrompt}
                disabled={savingNsfwGatePrompt}
                className="bg-emerald-400/10 text-emerald-400 border border-emerald-400/30 hover:bg-emerald-400/20"
                variant="outline"
              >
                {savingNsfwGatePrompt ? <Loader2 size={12} className="animate-spin mr-1" /> : <Save size={12} className="mr-1" />}
                Lưu NSFW Gate
              </Button>
            </div>

            {/* NSFW Jailbreak */}
            <div className="space-y-2 pt-4 border-t border-oled-border">
              <Label className="text-xs text-muted-foreground">
                NSFW Jailbreak — Prompt khi NSFW bật (inject ở đầu payload)
              </Label>
              <Textarea
                rows={3}
                value={nsfwJailbreakPrompt}
                onChange={(e) => setNsfwJailbreakPrompt(e.target.value)}
                placeholder="System prompt inject ở đầu khi NSFW mode bật..."
                className="bg-oled-base border-oled-border text-foreground font-mono text-sm resize-y min-h-[60px]"
              />
              <p className="text-[10px] text-muted-foreground">
                Inject vào Layer 1 (System Core) khi user bật NSFW mode. Để trống = không inject.
              </p>
              <Button
                size="sm"
                onClick={handleSaveNsfwJailbreakPrompt}
                disabled={savingNsfwJailbreakPrompt}
                className="bg-emerald-400/10 text-emerald-400 border border-emerald-400/30 hover:bg-emerald-400/20"
                variant="outline"
              >
                {savingNsfwJailbreakPrompt ? <Loader2 size={12} className="animate-spin mr-1" /> : <Save size={12} className="mr-1" />}
                Lưu NSFW Jailbreak
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ═══════ Response Styles ═══════ */}
        <Card className="bg-oled-surface border-oled-border">
          <CardContent className="p-5 space-y-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-neon-purple shadow-[0_0_6px] shadow-neon-purple" />
              <Sparkles size={14} className="text-neon-purple" />
              <h2 className="text-sm font-semibold text-foreground">Response Styles</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Tùy chọn phong cách trả lời cho user. Thay đổi ở đây cập nhật dropdown cho tất cả user.
            </p>
            <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
              Chỉ ghi: tone, độ dài, phong cách viết (ngắn gọn / chi tiết / match style). Không lặp: format spec, anti-puppeting, platform rules.
            </p>

            <div className="space-y-4">
              {responseStyles.map((style, index) => (
                <div key={style.value} className="bg-oled-elevated rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] border-neon-purple/30 text-neon-purple font-mono">
                      {style.value}
                    </Badge>
                    {style.value === "none" && (
                      <span className="text-[10px] text-muted-foreground">— không thêm prompt</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Label (hiển thị cho user)</Label>
                    <Input
                      value={style.label}
                      onChange={(e) => handleResponseStyleChange(index, "label", e.target.value)}
                      className="bg-oled-base border-oled-border text-foreground text-base md:text-xs h-10 md:h-8"
                    />
                  </div>
                  {style.value !== "none" && (
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Prompt (inject vào post-history)</Label>
                      <Textarea
                        rows={2}
                        value={style.prompt}
                        onChange={(e) => handleResponseStyleChange(index, "prompt", e.target.value)}
                        className="bg-oled-base border-oled-border text-foreground font-mono text-base md:text-xs resize-y min-h-[40px]"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Button
              onClick={handleSaveResponseStyles}
              disabled={savingResponseStyles}
              className="w-full bg-neon-purple hover:bg-neon-purple/80 text-white font-semibold"
            >
              {savingResponseStyles ? <Loader2 size={14} className="animate-spin mr-2" /> : <Save size={14} className="mr-2" />}
              Lưu Response Styles
            </Button>
          </CardContent>
        </Card>

        {/* ═══════ System Prompt Inspector (Admin Only) ═══════ */}
        <Card className="bg-oled-surface border-oled-border">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px] shadow-amber-400" />
              <Eye size={14} className="text-amber-400" />
              <h2 className="text-sm font-semibold text-foreground">System Prompt Inspector</h2>
              <Badge variant="outline" className="text-[10px] border-amber-400/30 text-amber-400">Admin Only</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Xem system prompt được assemble theo từng tầng. Chọn nhân vật → inspect.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Nhân vật</Label>
                <select
                  value={inspectorCharId}
                  onChange={(e) => setInspectorCharId(e.target.value)}
                  className="w-full h-8 bg-oled-base border border-oled-border rounded-md px-2 text-sm text-foreground"
                >
                  <option value="">-- Chọn nhân vật --</option>
                  {inspectorCharList.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">User Name</Label>
                <Input
                  value={inspectorUserName}
                  onChange={(e) => setInspectorUserName(e.target.value)}
                  className="bg-oled-base border-oled-border h-8 text-sm"
                />
              </div>
              <div className="space-y-1 flex items-end gap-2">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inspectorNsfw}
                    onChange={(e) => setInspectorNsfw(e.target.checked)}
                    className="accent-rose-500"
                  />
                  NSFW
                </label>
                <Button
                  size="sm"
                  onClick={handleInspectPrompt}
                  disabled={inspectorLoading || !inspectorCharId}
                  className="bg-amber-400/10 text-amber-400 border border-amber-400/30 hover:bg-amber-400/20"
                  variant="outline"
                >
                  {inspectorLoading ? <Loader2 size={12} className="animate-spin mr-1" /> : <Eye size={12} className="mr-1" />}
                  Inspect
                </Button>
              </div>
            </div>

            {inspectorSections.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-oled-border">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-foreground">
                    {inspectorSections.length} tầng — tổng {inspectorTokenCounts.total} tokens
                  </Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyInspectorMd}
                    className="h-6 px-2 text-[10px] border-oled-border text-muted-foreground hover:text-foreground"
                  >
                    {inspectorCopied ? <Check size={10} className="mr-1 text-emerald-400" /> : <Copy size={10} className="mr-1" />}
                    {inspectorCopied ? "Copied!" : "Copy Markdown"}
                  </Button>
                </div>

                {/* Overlap Warnings */}
                {inspectorOverlaps.length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-amber-400">Phát hiện trùng lặp ({inspectorOverlaps.length})</span>
                    </div>
                    {inspectorOverlaps.map((w) => (
                      <div key={w.patternId} className="text-[11px] text-amber-300/90">
                        <span className="font-medium">{w.label}</span>
                        <span className="text-amber-400/60"> — xuất hiện ở: </span>
                        <span className="font-mono">{w.sectionLabels.join(" + ")}</span>
                      </div>
                    ))}
                    <p className="text-[10px] text-amber-400/50">
                      Mẹo: mỗi instruction chỉ nên nằm ở 1 tầng. Xem trách nhiệm của từng tầng ở phần mô tả bên dưới mỗi textarea.
                    </p>
                  </div>
                )}

                {inspectorSections.map((section, i) => (
                  <details key={section.id} className="bg-oled-base/50 border border-oled-border rounded-lg">
                    <summary className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-oled-base/80 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground w-5">{i + 1}</span>
                        <span className="text-xs font-medium text-foreground">{section.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[9px] font-mono border-oled-border text-muted-foreground">
                          {inspectorTokenCounts.perSection[i] ?? "?"} tok
                        </Badge>
                        <Badge variant="outline" className="text-[9px] font-mono border-oled-border text-muted-foreground">
                          {section.content.length} chr
                        </Badge>
                      </div>
                    </summary>
                    <div className="px-3 pb-3">
                      <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-oled-base rounded p-2 max-h-[300px] overflow-y-auto">
                        {section.content}
                      </pre>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
    </AdminPageShell>
  );
};

export default AdminAiConfigPage;
