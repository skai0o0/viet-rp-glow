import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, Trash2, Check, Loader2, Pencil, Heart } from "lucide-react";
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
import { getMyFavorites, toggleFavorite } from "@/services/favoriteDb";
import { supabase } from "@/integrations/supabase/client";
import CharacterCard from "@/components/CharacterCard";
import { Link, useNavigate } from "react-router-dom";

const ProfilePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Persona state
  const [displayName, setDisplayName] = useState("");
  const [userDescription, setUserDescription] = useState("");
  const [nsfwMode, setNsfwMode] = useState(false);
  const [savingPersona, setSavingPersona] = useState(false);

  // Characters state
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [loadingChars, setLoadingChars] = useState(true);

  // Favorites state
  const [favorites, setFavorites] = useState<CharacterSummary[]>([]);
  const [loadingFavs, setLoadingFavs] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Load profile
    getMyProfile().then((p) => {
      if (p) {
        setDisplayName(p.display_name);
        setUserDescription(p.user_description);
        setNsfwMode(p.nsfw_mode);
        localStorage.setItem("vietrp_nsfw_mode", String(p.nsfw_mode));
      }
    });

    // Load characters
    getMyCharacters()
      .then(setCharacters)
      .catch(() => setCharacters([]))
      .finally(() => setLoadingChars(false));

    // Load favorites
    getMyFavorites()
      .then(setFavorites)
      .catch(() => setFavorites([]))
      .finally(() => setLoadingFavs(false));
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
              value="favorites"
              className="flex-1 data-[state=active]:bg-neon-purple/15 data-[state=active]:text-neon-purple rounded-lg text-sm"
            >
              Yêu thích
            </TabsTrigger>
            <TabsTrigger
              value="characters"
              className="flex-1 data-[state=active]:bg-neon-purple/15 data-[state=active]:text-neon-purple rounded-lg text-sm"
            >
              Nhân vật
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

          {/* TAB: Favorites */}
          <TabsContent value="favorites" className="mt-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {loadingFavs ? (
                <div className="flex justify-center py-16">
                  <Loader2 size={24} className="animate-spin text-neon-rose" />
                </div>
              ) : favorites.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Heart size={48} className="mx-auto mb-4 opacity-30" />
                  <p>Chưa yêu thích nhân vật nào.</p>
                  <p className="text-xs mt-1">Bấm vào biểu tượng tim trên card nhân vật để thêm vào danh sách yêu thích.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
                  {favorites.map((char) => (
                    <div key={char.id} className="relative group">
                      <CharacterCard
                        character={char}
                        onClick={() => navigate(`/chat/${char.id}`)}
                        isFavorited={true}
                        onFavoriteToggle={async (id) => {
                          await toggleFavorite(id);
                          setFavorites((prev) => prev.filter((c) => c.id !== id));
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
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
                <div className="grid gap-3 sm:gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
                  {characters.map((char) => (
                    <div key={char.id} className="relative group">
                      <CharacterCard character={char} />
                        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => navigate(`/edit/${char.id}`)}
                            className="p-2 rounded-xl bg-oled-base/80 backdrop-blur border border-neon-blue/40 text-neon-blue hover:bg-neon-blue/20 transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
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
                      localStorage.setItem("vietrp_nsfw_mode", String(checked));
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
