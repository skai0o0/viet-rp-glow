import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, Trash2, Eye, EyeOff, Check, Loader2, ShieldCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getMyProfile, upsertProfile, setCachedUserPersona } from "@/services/profileDb";
import { getMyCharacters, CharacterSummary } from "@/services/characterDb";
import { supabase } from "@/integrations/supabase/client";
import {
  getApiKey,
  setApiKey,
  getModel,
  setModel,
  AVAILABLE_MODELS,
  verifyApiKey,
} from "@/services/openRouter";
import CharacterCard from "@/components/CharacterCard";
import ModelCombobox from "@/components/ModelCombobox";
import { Link } from "react-router-dom";

const ProfilePage = () => {
  const { user } = useAuth();

  // Persona state
  const [displayName, setDisplayName] = useState("");
  const [userDescription, setUserDescription] = useState("");
  const [nsfwMode, setNsfwMode] = useState(false);
  const [savingPersona, setSavingPersona] = useState(false);

  // Characters state
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [loadingChars, setLoadingChars] = useState(true);

  // Settings state
  const [apiKeyVal, setApiKeyVal] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [model, setModelState] = useState<string>(AVAILABLE_MODELS[0].id);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;

    // Load profile
    getMyProfile().then((p) => {
      if (p) {
        setDisplayName(p.display_name);
        setUserDescription(p.user_description);
        setNsfwMode(p.nsfw_mode);
      }
    });

    // Load characters
    getMyCharacters()
      .then(setCharacters)
      .catch(() => setCharacters([]))
      .finally(() => setLoadingChars(false));

    // Load settings
    setApiKeyVal(getApiKey());
    setModelState(getModel());
  }, [user]);

  const handleSavePersona = async () => {
    if (!user) return;
    setSavingPersona(true);
    try {
      await upsertProfile(user.id, {
        display_name: displayName,
        user_description: userDescription,
        nsfw_mode: nsfwMode,
      });
      setCachedUserPersona(displayName, userDescription);
      toast.success("Đã lưu hồ sơ Roleplay!");
    } catch {
      toast.error("Không thể lưu hồ sơ.");
    } finally {
      setSavingPersona(false);
    }
  };

  const handleDeleteCharacter = async (id: string) => {
    const { error } = await supabase.from("characters").delete().eq("id", id);
    if (error) {
      toast.error("Không thể xoá nhân vật.");
      return;
    }
    setCharacters((prev) => prev.filter((c) => c.id !== id));
    toast.success("Đã xoá nhân vật.");
  };


  const handleVerifyKey = async () => {
    if (!apiKeyVal.trim()) {
      toast.error("Vui lòng nhập API Key trước.");
      return;
    }
    setVerifying(true);
    setVerified(null);
    const result = await verifyApiKey(apiKeyVal);
    setVerifying(false);
    setVerified(result.valid);
    if (result.valid) {
      toast.success("API Key hợp lệ! ✓");
    } else {
      toast.error(result.error || "API Key không hợp lệ.");
    }
  };

  const handleSaveKey = () => {
    setApiKey(apiKeyVal);
    toast.success("Đã lưu API Key!");
  };

  const handleModelChange = (value: string) => {
    setModelState(value);
    setModel(value);
  };

  const avatarInitial = (user?.email?.charAt(0) || "U").toUpperCase();

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin bg-oled-base">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-4"
        >
          <div className="w-16 h-16 rounded-full bg-oled-elevated border border-gray-border flex items-center justify-center text-2xl font-bold text-neon-purple">
            {avatarInitial}
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {displayName || user?.email || "Người dùng"}
            </h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="persona" className="w-full">
          <TabsList className="w-full bg-oled-surface border border-gray-border rounded-xl h-11">
            <TabsTrigger
              value="persona"
              className="flex-1 data-[state=active]:bg-neon-purple/15 data-[state=active]:text-neon-purple rounded-lg text-sm"
            >
              Hồ sơ Roleplay
            </TabsTrigger>
            <TabsTrigger
              value="characters"
              className="flex-1 data-[state=active]:bg-neon-purple/15 data-[state=active]:text-neon-purple rounded-lg text-sm"
            >
              Nhân vật của tôi
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="flex-1 data-[state=active]:bg-neon-purple/15 data-[state=active]:text-neon-purple rounded-lg text-sm"
            >
              Cài đặt hệ thống
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Persona */}
          <TabsContent value="persona" className="mt-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-oled-surface border border-gray-border rounded-2xl p-5 space-y-5"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-neon-blue shadow-neon-blue" />
                <h2 className="text-sm font-semibold text-foreground">Persona Roleplay</h2>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Tên hiển thị</label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Tên của bạn trong RP..."
                  className="bg-oled-elevated border-gray-border text-foreground focus:border-neon-blue focus:ring-neon-blue/30"
                />
                <p className="text-[10px] text-muted-foreground">
                  Tên này sẽ thay thế {"{{user}}"} trong mọi cuộc hội thoại.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Mô tả bản thân</label>
                <Textarea
                  value={userDescription}
                  onChange={(e) => setUserDescription(e.target.value)}
                  placeholder="Mô tả ngoại hình, giới tính, phong cách của bạn..."
                  rows={4}
                  className="bg-oled-elevated border-gray-border text-foreground focus:border-neon-blue focus:ring-neon-blue/30 resize-none"
                />
                <p className="text-[10px] text-muted-foreground">
                  Mô tả ngoại hình, giới tính, phong cách của bạn để AI nhận diện đúng. VD: Một nam thanh niên cao 1m80, mặc áo khoác đen...
                </p>
              </div>

              <Button
                onClick={handleSavePersona}
                disabled={savingPersona}
                className="w-full bg-neon-blue text-primary-foreground hover:shadow-neon-blue hover:scale-[1.02] transition-all duration-200"
              >
                {savingPersona ? <Loader2 size={16} className="animate-spin mr-2" /> : <Check size={16} className="mr-2" />}
                Lưu Persona
              </Button>
            </motion.div>
          </TabsContent>

          {/* TAB 2: My Characters */}
          <TabsContent value="characters" className="mt-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {loadingChars ? (
                <div className="flex justify-center py-16">
                  <Loader2 size={24} className="animate-spin text-neon-purple" />
                </div>
              ) : characters.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <User size={48} className="mx-auto mb-4 opacity-30" />
                  <p>Bạn chưa tạo nhân vật nào.</p>
                  <Button asChild variant="outline" className="mt-4 border-gray-border text-muted-foreground hover:border-neon-purple hover:text-neon-purple">
                    <Link to="/create">Tạo nhân vật đầu tiên</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {characters.map((char) => (
                    <div key={char.id} className="relative group">
                      <CharacterCard character={char} />
                      {/* Overlay actions */}
                      <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="p-2 rounded-xl bg-oled-base/80 backdrop-blur border border-destructive/40 text-destructive hover:bg-destructive/20 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-oled-surface border-gray-border">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-foreground">Xoá nhân vật?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Hành động này không thể hoàn tác. Nhân vật "{char.name}" sẽ bị xoá vĩnh viễn.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="bg-oled-elevated border-gray-border text-foreground">Huỷ</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteCharacter(char.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Xoá
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </TabsContent>

          {/* TAB 3: System Settings */}
          <TabsContent value="settings" className="mt-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* API Key */}
              <div className="bg-oled-surface border border-gray-border rounded-2xl p-5 space-y-5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-neon-purple shadow-neon-purple" />
                  <h2 className="text-sm font-semibold text-foreground">Kết nối AI</h2>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">OpenRouter API Key</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showKey ? "text" : "password"}
                        value={apiKeyVal}
                        onChange={(e) => {
                          setApiKeyVal(e.target.value);
                          setVerified(null);
                        }}
                        placeholder="sk-or-v1-..."
                        className="bg-oled-elevated border-gray-border text-foreground pr-10 focus:border-neon-purple focus:ring-neon-purple/30"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <button
                      onClick={handleVerifyKey}
                      disabled={verifying}
                      className={`px-3 rounded-xl border text-sm font-medium transition-all duration-300 flex items-center gap-1.5 ${
                        verified === true
                          ? "bg-green-500/10 border-green-500/30 text-green-400"
                          : verified === false
                          ? "bg-destructive/10 border-destructive/30 text-destructive"
                          : "bg-neon-blue/10 border-neon-blue/30 text-neon-blue hover:shadow-neon-blue"
                      }`}
                    >
                      {verifying ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <ShieldCheck size={14} />
                      )}
                      {verified === true ? "OK" : "Verify"}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Lấy API Key tại{" "}
                    <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-neon-blue hover:underline">
                      openrouter.ai/keys
                    </a>
                    . Key được lưu trữ cục bộ.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Model AI</label>
                  <ModelCombobox value={model} onValueChange={handleModelChange} />
                </div>

                {/* Save button at bottom */}
                <Button
                  onClick={handleSaveKey}
                  className="w-full bg-neon-purple text-primary-foreground hover:shadow-neon-purple hover:scale-[1.02] transition-all duration-200"
                >
                  <Check size={16} className="mr-2" />
                  Lưu cài đặt
                </Button>
              </div>

              {/* Toggles */}
              <div className="bg-oled-surface border border-gray-border rounded-2xl p-5 space-y-5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-neon-blue shadow-neon-blue" />
                  <h2 className="text-sm font-semibold text-foreground">Tùy chỉnh</h2>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground">Chế độ NSFW</p>
                    <p className="text-[10px] text-muted-foreground">Cho phép nội dung người lớn trong RP.</p>
                  </div>
                  <Switch
                    checked={nsfwMode}
                    onCheckedChange={async (checked) => {
                      setNsfwMode(checked);
                      if (user) {
                        await upsertProfile(user.id, { nsfw_mode: checked });
                        toast.success(checked ? "Đã bật NSFW" : "Đã tắt NSFW");
                      }
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Theme Color</label>
                  <Select defaultValue="cyberpunk">
                    <SelectTrigger className="bg-oled-elevated border-gray-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-oled-elevated border-gray-border">
                      <SelectItem value="cyberpunk" className="text-foreground focus:bg-neon-purple/10">Cyberpunk OLED</SelectItem>
                      <SelectItem value="midnight" className="text-foreground focus:bg-neon-purple/10">Midnight Blue</SelectItem>
                      <SelectItem value="sakura" className="text-foreground focus:bg-neon-purple/10">Sakura Pink</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">Thay đổi giao diện màu sắc (sắp ra mắt).</p>
                </div>
              </div>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ProfilePage;
