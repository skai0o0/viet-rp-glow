import { useState, useRef, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { toast } from "sonner";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Loader2,
  ImagePlus,
  Eye,
  Save,
  CheckCircle2,
  X,
  Sparkles,
  Settings,
  ChevronLeft,
  ChevronRight,
  Flame,
  User,
  Shield,
  HelpCircle,
  Target,
  Smile,
  Sliders,
  Wrench,
  FileText,
  RefreshCw,
  RotateCcw,
  Copy,
  Globe,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createCharacter } from "@/services/characterDb";
import { compressAvatar } from "@/utils/imageOptimization";
import {
  getApiKeyForProvider,
  getModel,
  setModel,
  getActiveProvider,
  setActiveProvider,
  formatPrefixedModelId,
  parsePrefixedModelId,
  type Provider,
} from "@/services/openRouter";
import { runCharGenPipeline, type CharGenPhase } from "@/services/charGenService";
import { TavernCardV2 } from "@/types/taverncard";
import { normalizeCard } from "@/lib/cardNormalizer";
import { validateCard, type ValidationResult, type Issue } from "@/lib/cardValidator";
import { repairCardField } from "@/lib/cardRepair";
import CardQualityScore from "@/components/CardQualityScore";
import ModelCombobox from "@/components/ModelCombobox";
import {
  getCharGenBrainstorm,
  getCharGenClone,
  getCharGenFormat,
  fetchAllowedModels,
} from "@/services/globalSettingsDb";
import AppFooter from "@/components/AppFooter";

// --- Trait deck definitions ---
interface Trait {
  label: string;
  emoji: string;
  tag: string;
}

const TRAIT_DECK: Trait[] = [
  { label: "Lạnh lùng", emoji: "🧊", tag: "cold" },
  { label: "Dịu dàng", emoji: "🌸", tag: "gentle" },
  { label: "Tsundere", emoji: "🔥", tag: "tsundere" },
  { label: "Bí ẩn", emoji: "🌑", tag: "mysterious" },
  { label: "Vui vẻ", emoji: "☀️", tag: "cheerful" },
  { label: "Trầm tư", emoji: "🌊", tag: "brooding" },
  { label: "Thao túng", emoji: "🕸️", tag: "manipulative" },
  { label: "Thẳng thắn", emoji: "⚡", tag: "blunt" },
  { label: "Yandere", emoji: "💘", tag: "yandere" },
  { label: "Mạnh mẽ", emoji: "🦁", tag: "stoic" },
  { label: "Tinh nghịch", emoji: "🦊", tag: "mischievous" },
  { label: "Lo lắng", emoji: "🐇", tag: "anxious" },
  { label: "Kiêu ngạo", emoji: "👑", tag: "arrogant" },
  { label: "Ngoan ngoãn", emoji: "🐑", tag: "submissive" },
  { label: "Nổi loạn", emoji: "🎸", tag: "rebellious" },
  { label: "Trung thành", emoji: "🐕", tag: "loyal" },
  { label: "Trí tuệ", emoji: "📚", tag: "intellectual" },
  { label: "Quyến rũ", emoji: "💋", tag: "seductive" },
  { label: "Hài hước", emoji: "🤡", tag: "humorous" },
  { label: "Nhút nhát", emoji: "🙈", tag: "shy" },
  { label: "Độc ác", emoji: "👿", tag: "sadistic" },
  { label: "Chữa lành", emoji: "🌱", tag: "healing" },
  { label: "Lập dị", emoji: "🧪", tag: "eccentric" },
  { label: "Tham vọng", emoji: "💎", tag: "ambitious" },
];

const TOTAL_STEPS = 7;

interface Franchise {
  id: string;
  name: string;
  emoji: string;
  color: string;
  image: string;
  desc: string;
  characters: { name: string; emoji: string; desc: string; image: string }[];
}

const FRANCHISES: Franchise[] = [
  {
    id: "genshin",
    name: "Genshin Impact",
    emoji: "🍀",
    color: "#4ade80",
    image: "/images/franchises/genshin.png",
    desc: "Thế giới Teyvat kỳ ảo với cuộc hành trình tìm lại người thân.",
    characters: [
      { name: "Raiden Shogun", emoji: "⚡", desc: "Lôi Thần tôn kính của Inazuma", image: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&q=80" },
      { name: "Furina", emoji: "💧", desc: "Cựu Thủy Thần đầy kịch tính của Fontaine", image: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80" },
      { name: "Zhongli", emoji: "🪨", desc: "Nham Vương Đế Quân trầm ổn", image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80" },
      { name: "Hu Tao", emoji: "🔥", desc: "Đường chủ Vãng Sinh Đường tinh nghịch", image: "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=400&q=80" },
    ]
  },
  {
    id: "starrail",
    name: "Honkai: Star Rail",
    emoji: "🚂",
    color: "#38bdf8",
    image: "/images/franchises/starrail.png",
    desc: "Chuyến tàu ngân hà khai phá những bí ẩn thần thoại vũ trụ.",
    characters: [
      { name: "Kafka", emoji: "🕸️", desc: "Thợ Săn Stellaron bí ẩn, quyến rũ", image: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&q=80" },
      { name: "Acheron", emoji: "💜", desc: "Kẻ Tự Vong Ca lạnh lùng, mạnh mẽ", image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&q=80" },
      { name: "March 7th", emoji: "❄️", desc: "Cô nàng năng động, nhí nhảnh", image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80" },
      { name: "Firefly", emoji: "🔥", desc: "Thành viên Thợ Săn Stellaron ấm áp", image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80" },
    ]
  },
  {
    id: "lol",
    name: "League of Legends",
    emoji: "⚔️",
    color: "#fbbf24",
    image: "/images/franchises/lol.png",
    desc: "Đấu trường công lý huyền thoại của thế giới Runeterra.",
    characters: [
      { name: "Yasuo", emoji: "🌪️", desc: "Kẻ Bất Dung Thế phong trần", image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80" },
      { name: "Ahri", emoji: "🦊", desc: "Hồ Ly Chín Đuôi quyến rũ", image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80" },
      { name: "Jinx", emoji: "🚀", desc: "Khẩu Pháo Nổi Loạn điên cuồng", image: "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=400&q=80" },
      { name: "Zed", emoji: "👥", desc: "Chúa Tể Bóng Tối lạnh lùng", image: "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=400&q=80" },
    ]
  },
  {
    id: "naruto",
    name: "Naruto",
    emoji: "🍥",
    color: "#f97316",
    image: "/images/franchises/naruto.png",
    desc: "Hành trình nhẫn giả kiên cường bảo vệ hòa bình thế giới.",
    characters: [
      { name: "Naruto Uzumaki", emoji: "🦊", desc: "Hokage Đệ Thất kiên cường", image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80" },
      { name: "Sasuke Uchiha", emoji: "⚡", desc: "Tộc nhân Uchiha cô độc", image: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&q=80" },
      { name: "Kakashi Hatake", emoji: "👁️", desc: "Ninja Sao Chép đáng kính", image: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&q=80" },
      { name: "Itachi Uchiha", emoji: "🐦", desc: "Người bảo vệ thầm lặng của Lá", image: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&q=80" },
    ]
  },
  {
    id: "onepiece",
    name: "One Piece",
    emoji: "👒",
    color: "#facc15",
    image: "/images/franchises/onepiece.png",
    desc: "Cuộc phiêu lưu tìm kiếm kho báu đại hải trình vĩ đại.",
    characters: [
      { name: "Monkey D. Luffy", emoji: "👒", desc: "Vua Hải Tặc tương lai", image: "https://images.unsplash.com/photo-1513956589380-bad6acb9b9d4?w=400&q=80" },
      { name: "Roronoa Zoro", emoji: "⚔️", desc: "Kiếm sĩ phái Tam Kiếm lạnh lùng", image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&q=80" },
      { name: "Nami", emoji: "🍊", desc: "Hoa tiêu thông minh, quyến rũ", image: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&q=80" },
      { name: "Portgas D. Ace", emoji: "🔥", desc: "Hỏa Quyền nhiệt huyết", image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&q=80" },
    ]
  },
  {
    id: "demonslayer",
    name: "Demon Slayer",
    emoji: "🗡️",
    color: "#e11d48",
    image: "/images/franchises/demonslayer.png",
    desc: "Hành trình diệt quỷ cứu người đầy xúc động và quả cảm.",
    characters: [
      { name: "Kamado Tanjiro", emoji: "🌊", desc: "Kiếm sĩ diệt quỷ nhân từ", image: "https://images.unsplash.com/photo-1504257404291-170c89596e51?w=400&q=80" },
      { name: "Kamado Nezuko", emoji: "🎋", desc: "Cô em gái hóa quỷ đáng yêu", image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&q=80" },
      { name: "Kyojuro Rengoku", emoji: "🔥", desc: "Viêm Trụ nhiệt huyết, quả cảm", image: "https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=400&q=80" },
      { name: "Kochou Shinobu", emoji: "🦋", desc: "Trùng Trụ dịu dàng nhưng sắc sảo", image: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&q=80" },
    ]
  },
  {
    id: "marvel",
    name: "Marvel Universe",
    emoji: "🦸",
    color: "#ef4444",
    image: "/images/franchises/marvel.png",
    desc: "Biệt đội siêu anh hùng bảo vệ hòa bình đa vũ trụ.",
    characters: [
      { name: "Iron Man", emoji: "🤖", desc: "Tỷ phú công nghệ thiên tài", image: "https://images.unsplash.com/photo-1520155707862-5b32817385d5?w=400&q=80" },
      { name: "Spider-Man", emoji: "🕸️", desc: "Người Nhện thân thiện của hàng xóm", image: "https://images.unsplash.com/photo-1512484776495-a09d92e87c3b?w=400&q=80" },
      { name: "Loki", emoji: "👑", desc: "Vị thần lừa lọc đầy biến số", image: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&q=80" },
      { name: "Wanda Maximoff", emoji: "🔮", desc: "Phù thủy Scarlet sở hữu ma thuật hỗn mang", image: "https://images.unsplash.com/photo-1509783236416-c9ad59bae472?w=400&q=80" },
    ]
  },
  {
    id: "harrypotter",
    name: "Harry Potter",
    emoji: "⚡",
    color: "#a855f7",
    image: "/images/franchises/harrypotter.png",
    desc: "Thế giới phù thủy Hogwarts huyền bí và đầy phép thuật.",
    characters: [
      { name: "Harry Potter", emoji: "⚡", desc: "Cậu bé sống sót chống lại Hắc Ám", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80" },
      { name: "Hermione Granger", emoji: "📚", desc: "Cô phù thủy thông minh nhất thế hệ", image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80" },
      { name: "Severus Snape", emoji: "🧪", desc: "Độc dược sư thầm lặng, nội tâm phức tạp", image: "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?w=400&q=80" },
      { name: "Lord Voldemort", emoji: "🐍", desc: "Chúa tể Hắc Ám tàn bạo", image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80" },
    ]
  },
  {
    id: "jujutsu",
    name: "Jujutsu Kaisen",
    emoji: "🔮",
    color: "#ec4899",
    image: "/images/franchises/jujutsu.png",
    desc: "Cuộc chiến chú thuật chống lại nguyền hồn nguy hiểm.",
    characters: [
      { name: "Gojo Satoru", emoji: "👁️", desc: "Chú thuật sư mạnh nhất thời hiện đại", image: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400&q=80" },
      { name: "Ryomen Sukuna", emoji: "💀", desc: "Ngự Điện Nguyền Vương tàn bạo", image: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&q=80" },
      { name: "Megumi Fushiguro", emoji: "🐺", desc: "Thức thần sư trầm tính", image: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=400&q=80" },
      { name: "Nobara Kugisaki", emoji: "🔨", desc: "Cô gái cá tính, thẳng thắn", image: "https://images.unsplash.com/photo-1514846226882-28b324ef7f28?w=400&q=80" },
    ]
  },
  {
    id: "fate",
    name: "Fate Series",
    emoji: "🌟",
    color: "#6366f1",
    image: "/images/franchises/fate.png",
    desc: "Cuộc chiến Chén Thánh tranh đoạt điều ước của các anh linh.",
    characters: [
      { name: "Saber (Artoria Pendragon)", emoji: "🗡️", desc: "Vua Hiệp Sĩ kiêu hãnh", image: "https://images.unsplash.com/photo-1548142813-c348350df52b?w=400&q=80" },
      { name: "Archer (Emiya)", emoji: "🏹", desc: "Anh linh hộ vệ đầy trăn trở", image: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=400&q=80" },
      { name: "Gilgamesh", emoji: "👑", desc: "Anh Hùng Vương kiêu ngạo", image: "https://images.unsplash.com/photo-1499996860823-5214fcc65f8f?w=400&q=80" },
      { name: "Rin Tohsaka", emoji: "💎", desc: "Gia chủ Tohsaka tài năng, Tsundere", image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80" },
    ]
  }
];

const getCharacterDefaults = (charName: string) => {
  const map: Record<string, { gender: string; role: string }> = {
    "Raiden Shogun": { gender: "Nữ", role: "Chính diện" },
    "Furina": { gender: "Nữ", role: "Comic relief" },
    "Zhongli": { gender: "Nam", role: "Mentor" },
    "Hu Tao": { gender: "Nữ", role: "Comic relief" },
    "Kafka": { gender: "Nữ", role: "Morally grey" },
    "Acheron": { gender: "Nữ", role: "Huyền bí" },
    "March 7th": { gender: "Nữ", role: "Comic relief" },
    "Firefly": { gender: "Nữ", role: "Chính diện" },
    "Yasuo": { gender: "Nam", role: "Morally grey" },
    "Ahri": { gender: "Nữ", role: "Huyền bí" },
    "Jinx": { gender: "Nữ", role: "Comic relief" },
    "Zed": { gender: "Nam", role: "Phản diện" },
    "Naruto Uzumaki": { gender: "Nam", role: "Chính diện" },
    "Sasuke Uchiha": { gender: "Nam", role: "Morally grey" },
    "Kakashi Hatake": { gender: "Nam", role: "Mentor" },
    "Itachi Uchiha": { gender: "Nam", role: "Morally grey" },
    "Monkey D. Luffy": { gender: "Nam", role: "Chính diện" },
    "Roronoa Zoro": { gender: "Nam", role: "Chính diện" },
    "Nami": { gender: "Nữ", role: "Comic relief" },
    "Portgas D. Ace": { gender: "Nam", role: "Chính diện" },
    "Kamado Tanjiro": { gender: "Nam", role: "Chính diện" },
    "Kamado Nezuko": { gender: "Nữ", role: "Huyền bí" },
    "Kyojuro Rengoku": { gender: "Nam", role: "Mentor" },
    "Kochou Shinobu": { gender: "Nữ", role: "Mentor" },
    "Iron Man": { gender: "Nam", role: "Chính diện" },
    "Spider-Man": { gender: "Nam", role: "Chính diện" },
    "Loki": { gender: "Nam", role: "Morally grey" },
    "Wanda Maximoff": { gender: "Nữ", role: "Morally grey" },
    "Harry Potter": { gender: "Nam", role: "Chính diện" },
    "Hermione Granger": { gender: "Nữ", role: "Mentor" },
    "Severus Snape": { gender: "Nam", role: "Morally grey" },
    "Lord Voldemort": { gender: "Nam", role: "Phản diện" },
    "Gojo Satoru": { gender: "Nam", role: "Mentor" },
    "Ryomen Sukuna": { gender: "Nam", role: "Phản diện" },
    "Megumi Fushiguro": { gender: "Nam", role: "Chính diện" },
    "Nobara Kugisaki": { gender: "Nữ", role: "Chính diện" },
    "Saber (Artoria Pendragon)": { gender: "Nữ", role: "Chính diện" },
    "Archer (Emiya)": { gender: "Nam", role: "Morally grey" },
    "Gilgamesh": { gender: "Nam", role: "Phản diện" },
    "Rin Tohsaka": { gender: "Nữ", role: "Chính diện" },
  };
  return map[charName] || { gender: "Nam", role: "Chính diện" };
};

let globalAudioCtx: AudioContext | null = null;

const playTickSound = () => {
  try {
    if (!globalAudioCtx) {
      globalAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (globalAudioCtx.state === "suspended") {
      globalAudioCtx.resume();
    }
    const osc = globalAudioCtx.createOscillator();
    const gainNode = globalAudioCtx.createGain();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, globalAudioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, globalAudioCtx.currentTime + 0.04);
    
    gainNode.gain.setValueAtTime(0.04, globalAudioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, globalAudioCtx.currentTime + 0.04);
    
    osc.connect(gainNode);
    gainNode.connect(globalAudioCtx.destination);
    
    osc.start();
    osc.stop(globalAudioCtx.currentTime + 0.04);
  } catch (err) {
    // blocked or unavailable
  }
};

interface LazyCharGenContentProps {
  onActionsChange?: (actions: ReactNode) => void;
}

export default function LazyCharGenContent({ onActionsChange }: LazyCharGenContentProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [mode, setMode] = useState<"create" | "clone" | "rpg" | "sim">("create");
  const [gender, setGender] = useState("Nam");
  const [role, setRole] = useState("Chính diện");
  const [traits, setTraits] = useState<Trait[]>([]);
  const [traitIndex, setTraitIndex] = useState(0);
  const [dark, setDark] = useState(50);
  const [tsun, setTsun] = useState(50);
  const [verbal, setVerbal] = useState(50);
  const [nsfw, setNsfw] = useState(false);
  const [multiChar, setMultiChar] = useState(false);
  const [rpgMode, setRpgMode] = useState(false);
  const [extraLore, setExtraLore] = useState("");

  // Cloned character selection states
  const [selectedFranchiseId, setSelectedFranchiseId] = useState("genshin");
  const [clonedChar, setClonedChar] = useState<{ franchise: string; name: string } | null>(null);
  const [spinning, setSpinning] = useState(false);
  const rouletteX = useMotionValue(0);
  const rouletteContainerRef = useRef<HTMLDivElement>(null);
  const [dragConstraints, setDragConstraints] = useState({ left: -10000, right: 10000 });
  const rouletteInitialized = useRef(false);
  const selectedFranchiseIdRef = useRef(selectedFranchiseId);
  const spinningRef = useRef(spinning);

  // Cloned character selection carousel states
  const charTrackRef = useRef<HTMLDivElement>(null);
  const [charDragConstraints, setCharDragConstraints] = useState({ left: -1000, right: 0 });
  const charX = useMotionValue(0);

  const activeFranchise = useMemo(() => FRANCHISES.find(f => f.id === selectedFranchiseId), [selectedFranchiseId]);

  const repeatedCharacters = useMemo(() => {
    if (!activeFranchise) return [];
    let list = [];
    for (let i = 0; i < 10; i++) {
      list.push(...activeFranchise.characters);
    }
    return list;
  }, [activeFranchise]);

  useEffect(() => {
    selectedFranchiseIdRef.current = selectedFranchiseId;
  }, [selectedFranchiseId]);

  useEffect(() => {
    spinningRef.current = spinning;
  }, [spinning]);

  useEffect(() => {
    const track = charTrackRef.current;
    if (!track || !activeFranchise) return;

    const CHAR_CARD_WIDTH = 140; // 130px width + 10px gap
    
    const updateConstraints = () => {
      const containerWidth = track.parentElement?.clientWidth || 0;
      const itemCount = repeatedCharacters.length;
      if (itemCount === 0) return;
      
      const centerOffset = containerWidth / 2;
      const maxScroll = centerOffset - CHAR_CARD_WIDTH / 2; // centers index 0
      const minScroll = centerOffset - ((itemCount - 1) * CHAR_CARD_WIDTH + CHAR_CARD_WIDTH / 2); // centers last index
      
      setCharDragConstraints({ left: minScroll, right: maxScroll });
    };

    updateConstraints();

    // Center on the 5th copy (index 16)
    const containerWidth = track.parentElement?.clientWidth || 0;
    const initialIdx = 16;
    const initialX = containerWidth / 2 - (initialIdx * CHAR_CARD_WIDTH + CHAR_CARD_WIDTH / 2);
    charX.set(initialX);

    // Set default cloned character to the first character of the franchise initially
    const defaultChar = activeFranchise.characters[0];
    if (defaultChar) {
      setClonedChar({ name: defaultChar.name, franchise: activeFranchise.name });
      const defaults = getCharacterDefaults(defaultChar.name);
      setGender(defaults.gender);
      setRole(defaults.role);
    }

    const observer = new ResizeObserver(() => {
      updateConstraints();
    });
    if (track.parentElement) {
      observer.observe(track.parentElement);
    }
    
    window.addEventListener("resize", updateConstraints);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateConstraints);
    };
  }, [selectedFranchiseId, activeFranchise, repeatedCharacters.length, charX]);

  const handleCharDragEnd = (event: any, info: any) => {
    if (!charTrackRef.current || !activeFranchise) return;
    const containerWidth = charTrackRef.current.parentElement?.clientWidth || 0;
    const centerOffset = containerWidth / 2;
    const currentX = charX.get();
    
    const CHAR_CARD_WIDTH = 140; // 130px width + 10px gap
    const rawIdx = Math.round((centerOffset - currentX - CHAR_CARD_WIDTH / 2) / CHAR_CARD_WIDTH);
    const safeIdx = Math.max(0, Math.min(repeatedCharacters.length - 1, rawIdx));
    
    const targetX = centerOffset - (safeIdx * CHAR_CARD_WIDTH + CHAR_CARD_WIDTH / 2);
    animate(charX, targetX, {
      type: "spring",
      stiffness: 200,
      damping: 25
    });
    
    const selectedCharObj = repeatedCharacters[safeIdx];
    if (selectedCharObj) {
      setClonedChar({ name: selectedCharObj.name, franchise: activeFranchise.name });
      const defaults = getCharacterDefaults(selectedCharObj.name);
      setGender(defaults.gender);
      setRole(defaults.role);
      toast.success(`Hồ sơ đã đồng bộ: ${selectedCharObj.name}`);
    }
  };

  useEffect(() => {
    let lastTickIdx = -1;
    const CHAR_CARD_WIDTH = 140; // 130px width + 10px gap
    const unsubscribe = charX.on("change", (latest) => {
      if (!charTrackRef.current) return;
      const containerWidth = charTrackRef.current.parentElement?.clientWidth || 0;
      const centerOffset = containerWidth / 2;
      const currentIdx = Math.round((centerOffset - latest - CHAR_CARD_WIDTH / 2) / CHAR_CARD_WIDTH);
      if (currentIdx !== lastTickIdx && currentIdx >= 0 && currentIdx < repeatedCharacters.length) {
        lastTickIdx = currentIdx;
        playTickSound();
      }
    });
    return () => unsubscribe();
  }, [repeatedCharacters.length, charX]);

  useEffect(() => {
    if (currentStep !== 1) {
      rouletteInitialized.current = false;
    }
  }, [currentStep]);

  const rouletteItems = useMemo(() => {
    let list: Franchise[] = [];
    for (let i = 0; i < 8; i++) {
      list = [...list, ...FRANCHISES];
    }
    return list;
  }, []);

  // Generation status
  const [phase, setPhase] = useState<CharGenPhase>("idle");
  const [draftProfile, setDraftProfile] = useState("");
  const [generatedCard, setGeneratedCard] = useState<TavernCardV2 | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [renameFrom, setRenameFrom] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // Validation
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [repairingFields, setRepairingFields] = useState<Set<string>>(new Set());

  // Model settings
  const [activeProvider, setActiveProviderState] = useState<Provider>(() => getActiveProvider());
  const [selectedModel, setSelectedModel] = useState<string>(() => getModel());
  const [modelSettingsOpen, setModelSettingsOpen] = useState(false);
  const [draftPreviewOpen, setDraftPreviewOpen] = useState(false);

  // Avatar upload
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Tinder swipe animation variables for Framer Motion
  const swipeX = useMotionValue(0);
  const swipeRotate = useTransform(swipeX, [-200, 200], [-30, 30]);
  const swipeOpacity = useTransform(swipeX, [-200, -100, 0, 100, 200], [0.3, 1, 1, 1, 0.3]);

  // Sync actions menu in header
  useEffect(() => {
    if (!onActionsChange) return;
    onActionsChange(
      <>
        {generatedCard && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setReviewOpen(!reviewOpen)}
            className="border-gray-border text-muted-foreground hover:text-foreground"
          >
            <Eye size={14} className="mr-1" />
            <span>Xem thẻ</span>
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setModelSettingsOpen(true)}
          className="border-gray-border text-muted-foreground hover:text-foreground"
        >
          <Settings size={14} className="mr-1" />
          <span className="hidden sm:inline">Model: </span>
          <span className="font-mono text-xs text-primary max-w-[120px] truncate ml-0.5">
            {selectedModel.includes("/") ? selectedModel.split("/")[1] : selectedModel}
          </span>
        </Button>
      </>
    );
  }, [onActionsChange, generatedCard, reviewOpen, selectedModel]);

  // Model change hooks
  const handleModelChange = useCallback((value: string) => {
    setSelectedModel(value);
    const { provider } = parsePrefixedModelId(value);
    const resolvedProvider = provider ?? "openrouter";
    setActiveProviderState(resolvedProvider);
    setActiveProvider(resolvedProvider);
  }, []);

  const handleProviderChange = useCallback(
    async (newProvider: Provider) => {
      setActiveProviderState(newProvider);
      setActiveProvider(newProvider);
      const parsed = parsePrefixedModelId(selectedModel);
      const currentModelProvider = parsed.provider ?? "openrouter";
      if (currentModelProvider !== newProvider) {
        try {
          const allowed = await fetchAllowedModels();
          const matching = allowed.find((m) => {
            const mSource =
              m.provider === "google" || m.provider === "google_genai" ? "google_genai" : m.provider;
            return mSource === newProvider;
          });
          if (matching) {
            const isNonOR =
              matching.provider === "mimo" ||
              matching.provider === "google_genai" ||
              matching.provider === "google";
            const source = isNonOR
              ? matching.provider === "google"
                ? "google_genai"
                : matching.provider
              : "openrouter";
            const newModelId = isNonOR
              ? formatPrefixedModelId(source as any, matching.model_id)
              : matching.model_id;
            setSelectedModel(newModelId);
          } else {
            let fallbackModel = "google/gemini-2.5-flash";
            if (newProvider === "mimo") fallbackModel = "mimo::gpt-4o";
            else if (newProvider === "google_genai") fallbackModel = "google_genai::gemini-2.5-flash";
            setSelectedModel(fallbackModel);
          }
        } catch (err) {
          console.error("Error setting default model for provider:", err);
        }
      }
    },
    [selectedModel]
  );

  // Tinder Swipe Handlers
  const handleDragEnd = (event: any, info: any) => {
    const threshold = 100;
    const currentTrait = TRAIT_DECK[traitIndex];
    if (!currentTrait) {
      swipeX.set(0);
      return;
    }

    if (info.offset.x > threshold) {
      if (!traits.some((t) => t.tag === currentTrait.tag)) {
        setTraits((prev) => [...prev, currentTrait]);
        toast.success(`Đã chọn: ${currentTrait.label}`);
      }
      setTraitIndex((prev) => prev + 1);
    } else if (info.offset.x < -threshold) {
      setTraitIndex((prev) => prev + 1);
    }
    swipeX.set(0);
  };

  const removeTrait = (tag: string) => {
    setTraits((prev) => prev.filter((t) => t.tag !== tag));
  };

  const CARD_WIDTH = 138; // 130px width + 8px gap

  const rouletteRefCallback = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      rouletteContainerRef.current = node;
    }
  }, []);

  const lastWidthRef = useRef<number>(0);

  useEffect(() => {
    const container = rouletteContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width || (entry.target as HTMLElement).clientWidth || 0;
        // Ignore sub-pixel changes under 1px to prevent button/layout HMR shifts from resetting alignment
        if (width > 0 && Math.abs(width - lastWidthRef.current) > 1) {
          lastWidthRef.current = width;
          const startIdx = 2 * FRANCHISES.length;
          const endIdx = 6 * FRANCHISES.length - 1;
          const maxScroll = width / 2 - (startIdx * CARD_WIDTH + CARD_WIDTH / 2);
          const minScroll = width / 2 - (endIdx * CARD_WIDTH + CARD_WIDTH / 2);
          setDragConstraints({ left: minScroll, right: maxScroll });

          if (!rouletteInitialized.current) {
            rouletteInitialized.current = true;
            const baseIdx = FRANCHISES.findIndex((f) => f.id === selectedFranchiseIdRef.current);
            if (baseIdx !== -1) {
              const targetIdx = 3 * FRANCHISES.length + baseIdx;
              const targetX = width / 2 - (targetIdx * CARD_WIDTH + CARD_WIDTH / 2);
              rouletteX.set(targetX);
            }
          } else if (!spinningRef.current) {
            // Keep the selected item centered on size change
            const baseIdx = FRANCHISES.findIndex((f) => f.id === selectedFranchiseIdRef.current);
            if (baseIdx !== -1) {
              const targetIdx = 3 * FRANCHISES.length + baseIdx;
              const targetX = width / 2 - (targetIdx * CARD_WIDTH + CARD_WIDTH / 2);
              rouletteX.set(targetX);
            }
          }
        }
      }
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, [rouletteItems, rouletteX]);

  useEffect(() => {
    let lastTickIdx = -1;
    const unsubscribe = rouletteX.on("change", (latest) => {
      if (!rouletteContainerRef.current) return;
      const containerWidth = rouletteContainerRef.current.clientWidth || 0;
      const centerOffset = containerWidth / 2;
      const currentIdx = Math.round((centerOffset - latest - CARD_WIDTH / 2) / CARD_WIDTH);
      if (currentIdx !== lastTickIdx && currentIdx >= 0 && currentIdx < rouletteItems.length) {
        lastTickIdx = currentIdx;
        playTickSound();
      }
    });
    return () => unsubscribe();
  }, [rouletteItems.length]);

  const handleRouletteDragEnd = (event: any, info: any) => {
    const containerWidth = rouletteContainerRef.current?.clientWidth || 0;
    const centerOffset = containerWidth / 2;
    const currentX = rouletteX.get();
    
    const rawIdx = Math.round((centerOffset - currentX - CARD_WIDTH / 2) / CARD_WIDTH);
    const startIdx = 2 * FRANCHISES.length;
    const endIdx = 6 * FRANCHISES.length - 1;
    const safeIdx = Math.max(startIdx, Math.min(endIdx, rawIdx));
    const targetX = centerOffset - (safeIdx * CARD_WIDTH + CARD_WIDTH / 2);
    
    animate(rouletteX, targetX, {
      type: "spring",
      stiffness: 200,
      damping: 25
    });
    
    const selectedFranchise = rouletteItems[safeIdx];
    setSelectedFranchiseId(selectedFranchise.id);
  };

  const handleSpin = () => {
    if (spinning) return;
    setSpinning(true);
    
    const containerWidth = rouletteContainerRef.current?.clientWidth || 0;
    const centerOffset = containerWidth / 2;
    
    const targetFranchiseIdx = Math.floor(Math.random() * FRANCHISES.length);
    // Spin to landing in the 5th copy (index range 40-49)
    const targetIdx = 4 * FRANCHISES.length + targetFranchiseIdx;
    
    const perfectX = centerOffset - (targetIdx * CARD_WIDTH + CARD_WIDTH / 2);
    const randomOffset = (Math.random() - 0.5) * (CARD_WIDTH * 0.5);
    const finalX = perfectX + randomOffset;
    
    animate(rouletteX, finalX, {
      type: "tween",
      duration: 4.0,
      ease: [0.15, 0.85, 0.35, 1], // CS2 case opening deceleration curve
      onComplete: () => {
        setSpinning(false);
        const selectedFranchise = rouletteItems[targetIdx];
        setSelectedFranchiseId(selectedFranchise.id);
        toast.success(`Hạ cánh bối cảnh: ${selectedFranchise.name}`);
      }
    });
  };

  const handleGenerate = async () => {
    if (phase !== "idle") return;

    if (!getApiKeyForProvider(activeProvider)) {
      const label =
        activeProvider === "mimo"
          ? "Xiaomi Mimo"
          : activeProvider === "google_genai"
            ? "Google GenAI"
            : "OpenRouter";
      toast.error(`Chưa nhập API Key ${label}. Vào Cài đặt để thêm.`);
      return;
    }

    setGeneratedCard(null);
    setValidation(null);

    const controller = new AbortController();
    abortRef.current = controller;

    const modeLabel =
      mode === "create"
        ? "Tạo mới hoàn toàn (Original Character)"
        : mode === "clone"
          ? "Sao chép tính cách/thông tin có sẵn"
          : mode === "rpg"
            ? "Thế giới RPG thế vai"
            : "Mô phỏng tình huống (Simulation)";

    const compiledInput = [
      `### BẮT ĐẦU TẠO NHÂN VẬT CHẤT LƯỢNG CAO ###`,
      `- Kiểu thiết lập: ${modeLabel}`,
      mode === "clone" && clonedChar
        ? `- Nhân vật gốc cần clone (Franchise): ${clonedChar.name} (thuộc bối cảnh/tác phẩm: ${clonedChar.franchise})`
        : "",
      `- Giới tính sinh học / Cách xưng hô: ${gender}`,
      `- Vai trò trong cốt truyện: ${role}`,
      `- Bộ tính cách chính đã chọn: ${traits.map((t) => `${t.label} (${t.tag})`).join(", ") || "Chưa thiết lập"}`,
      `- Cân chỉnh Hành vi Chat & Diễn đạt (0% -> 100%):`,
      `  * Ngữ khí xưng hô (Thân mật vs Trang trọng): ${dark}% (0% là suồng sã/thân mật/ngang hàng, 100% là trang trọng/kính cẩn/lịch thiệp)`,
      `  * Tần suất tả hành động (Chỉ thoại vs Tả chi tiết trong *): ${tsun}% (0% chỉ thoại thuần túy ít tả hành động, 100% là tả hành động/cử chỉ/bối cảnh cực kỳ chi tiết trong dấu *)`,
      `  * Độ dài & Dung lượng tin (Kiệm lời vs Nhiều lời): ${verbal}% (0% là kiệm lời/súc tích/phản hồi ngắn, 100% là phản hồi dài dòng/chi tiết/nhiều câu thoại)`,
      `- Cài đặt đặc biệt:`,
      `  * NSFW/Adult: ${nsfw ? "CHO PHÉP" : "KHÔNG CHO PHÉP"}`,
      `  * Đa nhân vật trong 1 card (Multi-char Group): ${multiChar ? "CÓ" : "KHÔNG"}`,
      `  * Chế độ RPG thế giới ảo (RPG stats/skills): ${rpgMode ? "KÍCH HOẠT" : "TẤT"}`,
      extraLore.trim() ? `\n- TÀI LIỆU LORE BỔ SUNG KHÔNG GÕ CHỮ (Copy-paste):\n${extraLore.trim()}` : "",
    ].filter(Boolean).join("\n");

    const userMsgs = [{ role: "user" as const, content: compiledInput }];

    try {
      await runCharGenPipeline(
        {
          userMessages: userMsgs,
          brainstormSystemPrompt: mode === "clone" ? getCharGenClone() : getCharGenBrainstorm(),
          formatSystemPrompt: getCharGenFormat(),
          provider: activeProvider,
          signal: controller.signal,
          skipBrainstorm: false,
        },
        {
          onPhaseChange: (p) => setPhase(p),
          onDraftReady: (draft) => setDraftProfile(draft),
          onSuccess: (card) => {
            const normalized = normalizeCard(card.data);
            const valResult = validateCard(normalized);
            setValidation(valResult);
            setGeneratedCard({ ...card, data: normalized });
            setRenameFrom(normalized.name);
            setReviewOpen(true);
            toast.success("Sinh nhân vật thành công!");
          },
          onError: (err, step) => {
            toast.error(`Lỗi tại bước ${step}: ${err}`);
          },
        }
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Tạo thất bại.");
    }
  };

  const handleAbort = () => {
    abortRef.current?.abort();
    setPhase("idle");
  };

  const handleSave = async () => {
    if (!generatedCard || !user) return;
    if (!generatedCard.data.name.trim()) {
      toast.error("Tên nhân vật là bắt buộc.");
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
        const { data: urlData } = supabase.storage.from("character-avatars").getPublicUrl(filePath);
        avatarUrl = urlData.publicUrl;
      }

      const saved = await createCharacter(generatedCard, user.id, !nsfw, undefined, avatarUrl);
      toast.success(`Đã lưu: ${saved.name}`);
      navigate(`/character/${saved.id}`);
    } catch (err: any) {
      toast.error(err.message || "Lưu nhân vật thất bại!");
    } finally {
      setPublishing(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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

  const updateCardData = (patch: Partial<typeof generatedCard.data>) => {
    if (!generatedCard) return;
    const updated = { ...generatedCard, data: { ...generatedCard.data, ...patch } };
    setGeneratedCard(updated);

    const valResult = validateCard(updated.data);
    setValidation(valResult);
  };

  const nextStep = () => {
    if (currentStep < TOTAL_STEPS - 1) setCurrentStep((s) => s + 1);
  };
  const prevStep = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };
  const resetAll = () => {
    setMode("create");
    setGender("Nam");
    setRole("Chính diện");
    setTraits([]);
    setTraitIndex(0);
    setDark(50);
    setTsun(50);
    setVerbal(50);
    setNsfw(false);
    setMultiChar(false);
    setRpgMode(false);
    setExtraLore("");
    setGeneratedCard(null);
    setValidation(null);
    setReviewOpen(false);
    setCurrentStep(0);
    clearAvatar();
    swipeX.set(0);
    setDraftPreviewOpen(false);
    setClonedChar(null);
    setSelectedFranchiseId("genshin");
    setSpinning(false);
    rouletteX.set(0);
  };

  const handleAutoFix = () => {
    if (!generatedCard) return;
    const normalized = normalizeCard(generatedCard.data);
    updateCardData(normalized);
    toast.success("Đã áp dụng tự động chuẩn hóa.");
  };

  const handleRepairField = async (issue: Issue) => {
    if (!generatedCard) return;
    setRepairingFields((prev) => {
      const copy = new Set(prev);
      copy.add(issue.field);
      return copy;
    });
    try {
      const patch = await repairCardField(generatedCard.data, issue);
      if (patch) {
        updateCardData(patch);
        toast.success(`Đã tự động sửa trường: ${issue.field}`);
      }
    } catch (err: any) {
      toast.error(`Sửa trường lỗi: ${err.message || err}`);
    } finally {
      setRepairingFields((prev) => {
        const copy = new Set(prev);
        copy.delete(issue.field);
        return copy;
      });
    }
  };

  const FLOW_NODES = [
    { label: "KIỂU TẠO", desc: "Mode tạo card", icon: <Target size={14} />, step: 0 },
    { label: "CƠ BẢN", desc: "Giới tính & Vai", icon: <User size={14} />, step: 1 },
    { label: "TÍNH CÁCH", desc: "Swipe chọn", icon: <Smile size={14} />, step: 2 },
    { label: "HÀNH VI CHAT", desc: "Tông giọng & độ dài", icon: <Sliders size={14} />, step: 3 },
    { label: "NÂNG CAO", desc: "Toggles on/off", icon: <Wrench size={14} />, step: 4 },
    { label: "BỔ SUNG", desc: "Dán raw text", icon: <FileText size={14} />, step: 5 },
    { label: "XUẤT BẢN", desc: "Sinh & Duyệt", icon: <CheckCircle2 size={14} />, step: 6 },
  ];

  const renderDraftPreviewCard = () => {
    return (
      <div className="bg-oled-surface border border-gray-border rounded-2xl overflow-hidden shadow-2xl relative">
        {/* Header mockup banner */}
        <div className="bg-gradient-to-r from-neon-purple/20 to-neon-blue/20 px-4 py-3 border-b border-gray-border flex items-center justify-between">
          <span className="text-[10px] font-bold text-foreground/80 tracking-wider uppercase flex items-center gap-1.5">
            <Flame size={12} className="text-neon-purple animate-pulse" />
            Bản phác thảo nhân vật
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-[9px] text-emerald-400 font-mono font-bold uppercase">Real-time Sync</span>
          </span>
        </div>

        {/* Avatar placeholder / visual preview */}
        <div className="relative aspect-[4/3] bg-oled-base overflow-hidden flex items-center justify-center border-b border-gray-border">
          {(() => {
            if (avatarPreview) {
              return <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />;
            }
            if (mode === "clone" && clonedChar) {
              const activeFranchise = FRANCHISES.find(f => f.name === clonedChar.franchise);
              const activeCharObj = activeFranchise?.characters.find(c => c.name === clonedChar.name);
              if (activeCharObj?.image) {
                return (
                  <img
                    src={activeCharObj.image}
                    alt={clonedChar.name}
                    className="w-full h-full object-cover transition-opacity duration-300 animate-fade-in"
                  />
                );
              }
            }
            return (
              <div className="absolute inset-0 bg-gradient-to-br from-oled-elevated to-oled-base flex flex-col items-center justify-center gap-3">
                <div className="w-16 h-16 rounded-full bg-neon-purple/10 border border-neon-purple/30 flex items-center justify-center shadow-lg shadow-neon-purple/10 animate-breathing">
                  <User className="text-neon-purple" size={32} />
                </div>
                <div className="text-center space-y-0.5 px-3">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block truncate max-w-[180px]">
                    {mode === "clone" && clonedChar ? `Clone: ${clonedChar.name}` : "Ảnh đại diện"}
                  </span>
                  <p className="text-[9px] text-muted-foreground/50 truncate max-w-[180px]">
                    {mode === "clone" && clonedChar ? `Vũ trụ: ${clonedChar.franchise}` : "Tải lên trong bước phê duyệt"}
                  </p>
                </div>
              </div>
            );
          })()}
          {/* Edge gradients */}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-oled-surface to-transparent" />
        </div>

        {/* Mock Character Profile fields */}
        <div className="p-5 space-y-4">
          {/* Card Metadata info */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-neon-purple/15 text-neon-purple border border-neon-purple/30 font-bold uppercase font-sans">
              {mode === "create" ? "OC" : mode === "clone" ? "Clone" : mode === "rpg" ? "RPG" : "Sim"}
            </span>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-neon-blue/15 text-neon-blue border border-neon-blue/30 font-bold uppercase font-sans">
              {gender}
            </span>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-oled-elevated text-muted-foreground border border-gray-border font-bold uppercase font-sans">
              {role.split(" ")[1] || role}
            </span>
            {nsfw && (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-neon-rose/15 text-neon-rose border border-neon-rose/30 font-bold uppercase ml-auto font-sans">
                NSFW
              </span>
            )}
          </div>

          {/* Live sliders display (balance visualization) */}
          <div className="space-y-2 pt-1 border-t border-gray-border/60">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Phong cách hội thoại</span>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-oled-base/40 border border-gray-border/40 rounded-lg p-2 text-center">
                <div className="text-[9px] text-muted-foreground font-semibold">Trang trọng</div>
                <div className="text-xs font-bold text-neon-purple font-mono mt-0.5">{dark}%</div>
              </div>
              <div className="bg-oled-base/40 border border-gray-border/40 rounded-lg p-2 text-center">
                <div className="text-[9px] text-muted-foreground font-semibold">Tả hành động</div>
                <div className="text-xs font-bold text-neon-purple font-mono mt-0.5">{tsun}%</div>
              </div>
              <div className="bg-oled-base/40 border border-gray-border/40 rounded-lg p-2 text-center">
                <div className="text-[9px] text-muted-foreground font-semibold">Dung lượng tin</div>
                <div className="text-xs font-bold text-neon-purple font-mono mt-0.5">{verbal}%</div>
              </div>
            </div>
          </div>

          {/* Live traits selected display */}
          <div className="space-y-1.5 border-t border-gray-border/60 pt-3">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
              Tính cách của nhân vật ({traits.length})
            </span>
            <div className="flex flex-wrap gap-1">
              {traits.length === 0 ? (
                <span className="text-[10px] text-muted-foreground/30 italic">Lướt swipe thẻ để chọn tính cách...</span>
              ) : (
                traits.map((t) => (
                  <span
                    key={t.tag}
                    className="px-2 py-0.5 rounded bg-oled-elevated border border-gray-border text-[10px] text-foreground/80 flex items-center gap-1"
                  >
                    <span>{t.label}</span>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Clone detail check */}
          {mode === "clone" && clonedChar && (
            <div className="flex items-center gap-1.5 border-t border-gray-border/60 pt-3 text-[10px] text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-neon-purple animate-pulse" />
              <span className="truncate">Gốc: <b className="text-foreground">{clonedChar.name}</b> ({clonedChar.franchise})</span>
            </div>
          )}

          {/* Additional lore check */}
          {extraLore.trim() && (
            <div className="flex items-center gap-1.5 border-t border-gray-border/60 pt-3 text-[10px] text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-neon-blue" />
              <span>Lore bổ sung: <b>{extraLore.trim().length} kí tự</b> được tích hợp.</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-oled-base overflow-y-auto scrollbar-thin">
      {/* Flow Diagram (Stepper / Header) */}
      <div className="shrink-0 border-b border-gray-border bg-oled-surface/30 py-2 px-4 sticky top-0 z-30 backdrop-blur-md">
        <div className="flex items-center gap-1.5 justify-between min-w-[700px] max-w-7xl mx-auto overflow-x-auto no-scrollbar">
          {FLOW_NODES.map((node, i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <button
                onClick={() => {
                  if (phase === "idle") setCurrentStep(node.step);
                }}
                disabled={phase !== "idle"}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-center transition-all ${
                  currentStep === node.step
                    ? "bg-neon-purple/10 border-neon-purple text-neon-purple shadow-[0_0_8px_rgba(176,38,255,0.2)]"
                    : i < currentStep
                      ? "bg-oled-elevated/40 border-gray-border/60 text-muted-foreground/60"
                      : "bg-transparent border-transparent text-muted-foreground/40 hover:text-muted-foreground"
                }`}
              >
                <span className="text-sm shrink-0">{node.icon}</span>
                <span className="text-[10px] font-bold tracking-wider uppercase truncate">{node.label}</span>
              </button>
              {i < FLOW_NODES.length - 1 && (
                <span className="text-muted-foreground/20 px-1.5 text-xs shrink-0">→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Responsive Grid Layout (Landscape Widescreen Structure) */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-none">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Current Wizard step interface */}
          <div className="lg:col-span-7 space-y-6">
            {phase !== "idle" ? (
              /* Generating status card */
              <div className="bg-oled-surface border border-gray-border rounded-2xl p-8 space-y-6 text-center shadow-xl animate-pulse">
                <div className="relative w-16 h-16 mx-auto">
                  <Loader2 size={64} className="animate-spin text-neon-purple absolute inset-0" />
                  <Sparkles size={24} className="text-neon-blue absolute inset-5" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-bold text-xl text-foreground">
                    {phase === "brainstorming" ? "Đang Lên Ý Tưởng Nhân Vật..." : "Đang Thiết Kế Thẻ Tavern..."}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed px-6">
                    {phase === "brainstorming"
                      ? "Mô hình AI đang kết hợp giới tính, vai trò và bộ tính cách đã vuốt chọn để thiết kế câu chuyện lý lịch phong phú."
                      : "Đang tổ chức và chuẩn hóa thông tin sinh được vào định dạng JSON TavernCard V2 chuẩn mực..."}
                  </p>
                </div>

                {draftProfile && phase === "formatting" && (
                  <div className="text-left bg-oled-base border border-gray-border p-4 rounded-xl max-h-48 overflow-y-auto text-[10px] text-muted-foreground/80 font-mono whitespace-pre-wrap">
                    {draftProfile}
                  </div>
                )}

                <Button variant="destructive" size="sm" onClick={handleAbort} className="w-full h-10 font-bold">
                  Hủy quá trình tạo nhanh
                </Button>
              </div>
            ) : (
              /* Step layout selection panels */
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="bg-oled-surface border border-gray-border rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5"
                >
                  {currentStep === 0 && (
                    /* Step 0: Character Creation Mode */
                    <>
                      <div className="flex flex-col items-center justify-center text-center border-b border-gray-border/40 pb-2.5">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neon-purple/20 text-neon-purple font-mono uppercase font-bold tracking-wider shrink-0">
                            Bước 01/07
                          </span>
                          <h3 className="font-bold text-sm text-foreground">
                            Lựa chọn kiểu thiết lập
                          </h3>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Chọn bối cảnh nền tảng cho nhân vật mới.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        {[
                          { key: "create", title: "Tạo mới (OC)", desc: "Xây dựng nhân vật gốc mới tinh", icon: <Sparkles className="text-neon-purple" size={24} /> },
                          { key: "clone", title: "Clone nhân vật", desc: "Dựa trên truyện, anime, phim có sẵn", icon: <Copy className="text-neon-blue" size={24} /> },
                          { key: "rpg", title: "RPG World", desc: "Phục vụ thế giới trò chơi, kịch bản", icon: <Shield className="text-secondary" size={24} /> },
                          { key: "sim", title: "Simulation", desc: "Mô phỏng tình huống cụ thể", icon: <Globe className="text-muted-foreground" size={24} /> },
                        ].map((item) => (
                          <button
                            key={item.key}
                            onClick={() => setMode(item.key as any)}
                            className={`p-4 rounded-2xl border text-left flex flex-col items-start gap-2 transition-all ${
                              mode === item.key
                                ? "border-neon-purple bg-neon-purple/5 shadow-[0_0_8px_rgba(176,38,255,0.1)]"
                                : "border-gray-border bg-oled-base/40 hover:border-gray-border/80"
                            }`}
                          >
                            <div className="shrink-0">{item.icon}</div>
                            <div className="text-sm font-bold">{item.title}</div>
                            <div className="text-[10px] text-muted-foreground leading-snug">{item.desc}</div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {currentStep === 1 && (
                    mode === "clone" ? (
                      /* Step 1: Clone Franchise & Character select */
                      <>
                        <div className="flex flex-col items-center justify-center text-center border-b border-gray-border/40 pb-2">
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-neon-purple/20 text-neon-purple font-mono uppercase font-bold tracking-wider shrink-0">
                              Bước 02/07
                            </span>
                            <h3 className="font-bold text-sm text-foreground">
                              Clone nhân vật: Chọn vũ trụ &amp; nhân vật gốc
                            </h3>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Kéo lướt hoặc nhấn Quay để chọn Franchise, sau đó chọn nhân vật bên dưới.
                          </p>
                        </div>
                        <div className="space-y-4 pt-2">
                          
                          {/* CS2 Case Roulette Viewport */}
                          <div
                            ref={rouletteRefCallback}
                            className="relative w-full overflow-hidden border border-gray-border/60 bg-oled-base/40 rounded-2xl h-[225px] flex items-center select-none"
                          >
                            {/* Target Pointer vertical line & carets */}
                            <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 z-20 pointer-events-none flex flex-col items-center justify-between h-full py-1.5">
                              <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-neon-purple filter drop-shadow-[0_0_3px_#b026ff]" />
                              <div className="w-[1.5px] h-[calc(100%-14px)] bg-neon-purple shadow-[0_0_8px_#b026ff]" />
                              <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[5px] border-b-neon-purple filter drop-shadow-[0_0_3px_#b026ff]" />
                            </div>
                            
                            {/* Scrollable track */}
                            <motion.div
                              drag="x"
                              dragConstraints={dragConstraints}
                              dragElastic={0.15}
                              onDragEnd={handleRouletteDragEnd}
                              style={{ x: rouletteX }}
                              className="flex gap-2 items-center px-4 cursor-grab active:cursor-grabbing shrink-0"
                            >
                              {rouletteItems.map((item, idx) => {
                                const isSelected = item.id === selectedFranchiseId;
                                return (
                                  <button
                                    key={`${item.id}-${idx}`}
                                    onClick={() => {
                                      if (spinning) return;
                                      setSelectedFranchiseId(item.id);
                                      const containerWidth = rouletteContainerRef.current?.clientWidth || 0;
                                      const targetX = containerWidth / 2 - (idx * CARD_WIDTH + CARD_WIDTH / 2);
                                      animate(rouletteX, targetX, {
                                        type: "spring",
                                        stiffness: 200,
                                        damping: 25
                                      });
                                    }}
                                    className={`w-[130px] h-[190px] shrink-0 border rounded-2xl flex flex-col overflow-hidden transition-all duration-300 focus-visible:outline-none relative select-none cursor-pointer group hover:-translate-y-1 ${
                                      isSelected
                                        ? "border-secondary bg-oled-surface shadow-neon-purple scale-105 z-10 opacity-100"
                                        : "border-gray-border bg-oled-surface/40 opacity-70 hover:opacity-100 hover:border-gray-border/80 hover:shadow-neon-purple/20"
                                    }`}
                                  >
                                    {/* Image Section */}
                                    <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-oled-elevated to-oled-base overflow-hidden border-b border-gray-border/30 flex-shrink-0">
                                      <img
                                        src={item.image}
                                        alt={item.name}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 pointer-events-none"
                                        loading="lazy"
                                      />
                                      {/* Gradient Overlay */}
                                      <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                                    </div>

                                    {/* Info Section */}
                                    <div className="p-2 flex-1 flex flex-col justify-between min-h-0 overflow-hidden bg-oled-surface/50">
                                      <div className="space-y-0.5 text-left">
                                        <div className="text-[11px] font-bold text-foreground truncate leading-tight group-hover:text-secondary transition-colors duration-200">
                                          {item.name}
                                        </div>
                                        <p className="text-[9px] text-muted-foreground line-clamp-2 leading-snug mt-0.5">
                                          {item.desc}
                                        </p>
                                      </div>

                                      <div className="mt-auto">
                                        <div className="flex items-center justify-between gap-1 pt-1">
                                          {/* First Character Tag */}
                                          <div className="flex min-w-0 overflow-hidden">
                                            {item.characters[0] && (
                                              <span className="text-[8px] bg-oled-elevated text-primary rounded-full px-1.5 py-0.5 truncate max-w-[65px] font-medium border border-gray-border/30">
                                                {item.characters[0].name.split(" ")[0]}
                                              </span>
                                            )}
                                          </div>
                                          {/* Character Count */}
                                          <div className="flex items-center gap-0.5 shrink-0 text-[9px] text-muted-foreground font-semibold">
                                            <User size={9} className="text-neon-blue/60" />
                                            <span>{item.characters.length}</span>
                                          </div>
                                        </div>
                                        {/* Bottom Accent line */}
                                        <div
                                          className="h-[2px] rounded-full w-full mt-1.5 shrink-0 transition-all duration-300 group-hover:shadow-[0_0_8px_currentColor]"
                                          style={{ backgroundColor: item.color, color: item.color }}
                                        />
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </motion.div>
                          </div>

                          {/* Spin & Info controls */}
                          <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
                              <span>Đang chọn:</span>
                              {(() => {
                                const active = FRANCHISES.find(f => f.id === selectedFranchiseId);
                                return active ? (
                                  <span className="text-neon-purple font-bold">
                                    {active.name}
                                  </span>
                                ) : (
                                  <span>Không rõ</span>
                                );
                              })()}
                            </div>
                            <Button
                              size="sm"
                              disabled={spinning}
                              onClick={handleSpin}
                              className="bg-neon-purple hover:bg-neon-purple/80 text-white shadow-neon-purple h-8 font-bold text-xs"
                            >
                              {spinning ? <Loader2 size={12} className="animate-spin mr-1" /> : <RefreshCw size={12} className="mr-1" />}
                              Quay ngẫu nhiên
                            </Button>
                          </div>

                          {/* Characters selection carousel */}
                          <div className="space-y-2.5 pt-2 border-t border-gray-border/60">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Chọn nhân vật gốc</label>
                              <span className="text-[9px] text-muted-foreground">Lướt vuốt ngang hoặc nhấn để chọn</span>
                            </div>
                            {(() => {
                              const activeFranchise = FRANCHISES.find(f => f.id === selectedFranchiseId);
                              if (!activeFranchise) return <p className="text-xs text-muted-foreground italic">Vui lòng chọn vũ trụ để hiển thị nhân vật.</p>;
                              return (
                                <div className="relative w-full overflow-hidden border border-gray-border/60 bg-oled-base/40 rounded-2xl h-[225px] flex items-center select-none">
                                  <motion.div
                                    ref={charTrackRef}
                                    drag="x"
                                    dragConstraints={charDragConstraints}
                                    dragElastic={0.15}
                                    style={{ x: charX }}
                                    onDragEnd={handleCharDragEnd}
                                    className="flex gap-2.5 items-center px-4 cursor-grab active:cursor-grabbing shrink-0"
                                  >
                                    {repeatedCharacters.map((char, idx) => {
                                      const isSelected = clonedChar?.name === char.name && clonedChar?.franchise === activeFranchise.name;
                                      return (
                                        <button
                                          key={`${char.name}-${idx}`}
                                          onClick={() => {
                                            setClonedChar({ name: char.name, franchise: activeFranchise.name });
                                            const defaults = getCharacterDefaults(char.name);
                                            setGender(defaults.gender);
                                            setRole(defaults.role);
                                            toast.success(`Hồ sơ đã đồng bộ: ${char.name}`);

                                            // Snap to center
                                            if (charTrackRef.current) {
                                              const containerWidth = charTrackRef.current.parentElement?.clientWidth || 0;
                                              const centerOffset = containerWidth / 2;
                                              const CHAR_CARD_WIDTH = 140;
                                              const targetX = centerOffset - (idx * CHAR_CARD_WIDTH + CHAR_CARD_WIDTH / 2);
                                              animate(charX, targetX, {
                                                type: "spring",
                                                stiffness: 200,
                                                damping: 25
                                              });
                                            }
                                          }}
                                          className={`w-[130px] h-[190px] shrink-0 border rounded-2xl flex flex-col overflow-hidden transition-all duration-300 focus-visible:outline-none relative select-none cursor-pointer group hover:-translate-y-1 ${
                                            isSelected
                                              ? "border-secondary bg-oled-surface shadow-neon-purple scale-105 z-10 opacity-100"
                                              : "border-gray-border bg-oled-surface/40 opacity-70 hover:opacity-100 hover:border-gray-border/80 hover:shadow-neon-purple/20"
                                          }`}
                                        >
                                          {/* Image Section */}
                                          <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-oled-elevated to-oled-base overflow-hidden border-b border-gray-border/30 flex-shrink-0">
                                            <img
                                              src={char.image}
                                              alt={char.name}
                                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 pointer-events-none"
                                              loading="lazy"
                                            />
                                            {/* Gradient Overlay */}
                                            <div className="absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                                          </div>

                                          {/* Info Section */}
                                          <div className="p-2 flex-1 flex flex-col justify-between min-h-0 overflow-hidden bg-oled-surface/50 w-full">
                                            <div className="space-y-0.5 text-left w-full">
                                              <div className="text-[11px] font-bold text-foreground truncate leading-tight group-hover:text-secondary transition-colors duration-200">
                                                {char.name}
                                              </div>
                                              <p className="text-[9px] text-muted-foreground line-clamp-2 leading-snug mt-0.5">
                                                {char.desc}
                                              </p>
                                            </div>
                                            
                                            {/* Bottom Color Accent line */}
                                            <div
                                              className="h-[2px] rounded-full w-full mt-2 shrink-0 transition-all duration-300 group-hover:shadow-[0_0_8px_currentColor]"
                                              style={{ backgroundColor: activeFranchise.color, color: activeFranchise.color }}
                                            />
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </motion.div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </>
                    ) : (
                      /* Step 1: Identity & Roles */
                      <>
                        <div className="flex flex-col items-center justify-center text-center border-b border-gray-border/40 pb-2.5">
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-neon-purple/20 text-neon-purple font-mono uppercase font-bold tracking-wider shrink-0">
                              Bước 02/07
                            </span>
                            <h3 className="font-bold text-sm text-foreground">
                              Giới tính &amp; Xu thế cốt truyện
                            </h3>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Khai báo giới tính sinh học và vai trò truyện.
                          </p>
                        </div>
                        <div className="space-y-6 pt-2">
                          <div className="space-y-2.5">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                              Giới tính sinh học / Cách xưng hô
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {["Nam", "Nữ", "Phi nhị phân", "Đa nhân vật"].map((g) => (
                                <button
                                  key={g}
                                  onClick={() => setGender(g)}
                                  className={`px-4 py-2 rounded-full text-xs font-medium border transition-all ${
                                    gender === g
                                      ? "border-neon-purple bg-neon-purple/15 text-neon-purple"
                                      : "border-gray-border bg-oled-base/50 text-muted-foreground"
                                  }`}
                                >
                                  {g}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-2.5">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                              Vai trò trong thế giới cốt truyện
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {[
                                "Chính diện",
                                "Phản diện",
                                "Morally grey",
                                "Comic relief",
                                "Huyền bí",
                                "Mentor",
                              ].map((r) => (
                                <button
                                  key={r}
                                  onClick={() => setRole(r)}
                                  className={`px-4 py-2 rounded-full text-xs font-medium border transition-all ${
                                    role === r
                                      ? "border-neon-purple bg-neon-purple/15 text-neon-purple"
                                      : "border-gray-border bg-oled-base/50 text-muted-foreground"
                                  }`}
                                >
                                  {r}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </>
                    )
                  )}

                  {currentStep === 2 && (
                    /* Step 2: Swipe deck cards */
                    <>
                      <div className="flex flex-col items-center justify-center text-center border-b border-gray-border/40 pb-2.5">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neon-purple/20 text-neon-purple font-mono uppercase font-bold tracking-wider shrink-0">
                            Bước 03/07
                          </span>
                          <h3 className="font-bold text-sm text-foreground">
                            Vuốt Chọn Tính Cách
                          </h3>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Vuốt card sang phải để chọn tính cách, trái để từ chối.
                        </p>
                      </div>

                      <div className="relative h-48 w-64 mx-auto flex items-center justify-center select-none touch-none py-2">
                        {/* Shadow card behind */}
                        {traitIndex < TRAIT_DECK.length - 1 && (
                          <div className="absolute inset-x-8 inset-y-1 bg-oled-base border border-gray-border/60 rounded-2xl flex flex-col items-center justify-center gap-1.5 opacity-30 scale-[0.93] translate-y-3 blur-[0.5px] pointer-events-none">
                            <Smile className="text-muted-foreground/30" size={32} />
                            <span className="text-sm font-semibold">{TRAIT_DECK[traitIndex + 1].label}</span>
                            <span className="text-[10px] font-mono opacity-50">{TRAIT_DECK[traitIndex + 1].tag}</span>
                          </div>
                        )}

                        {/* Top swipable card */}
                        {traitIndex < TRAIT_DECK.length ? (
                          <motion.div
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            onDragEnd={handleDragEnd}
                            style={{ x: swipeX, rotate: swipeRotate, opacity: swipeOpacity }}
                            className="absolute inset-0 bg-oled-elevated border-2 border-gray-border rounded-2xl flex flex-col items-center justify-center gap-2 cursor-grab active:cursor-grabbing shadow-2xl z-10"
                          >
                            <Smile className="text-neon-purple animate-pulse" size={44} />
                            <span className="text-base font-bold text-foreground">
                              {TRAIT_DECK[traitIndex].label}
                            </span>
                            <span className="text-[10px] text-muted-foreground/60 font-mono tracking-wider">
                              {TRAIT_DECK[traitIndex].tag}
                            </span>
                          </motion.div>
                        ) : (
                          <div className="absolute inset-0 border border-dashed border-gray-border rounded-2xl flex flex-col items-center justify-center gap-1 text-center p-4">
                            <CheckCircle2 className="text-neon-purple" size={28} />
                            <span className="text-xs font-semibold text-foreground mt-1.5">Đã xem hết bộ thẻ tính cách!</span>
                            <span className="text-[10px] text-muted-foreground">Ấn Tiếp theo để tiến hành cân chỉnh</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold uppercase tracking-wider px-2">
                        <span className="text-neon-rose font-bold">← Bỏ qua</span>
                        <span className="font-mono text-xs">
                          Thẻ số {Math.min(traitIndex + 1, TRAIT_DECK.length)}/{TRAIT_DECK.length}
                        </span>
                        <span className="text-neon-blue font-bold">Chọn nhận →</span>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          Tính cách đã thu nạp ({traits.length})
                        </label>
                        <div className="flex flex-wrap gap-1.5 min-h-[44px] p-2.5 rounded-xl bg-oled-base/40 border border-gray-border/60">
                          {traits.length === 0 ? (
                            <span className="text-xs text-muted-foreground/40 italic flex items-center h-6">Chưa có tính cách nào được vuốt giữ...</span>
                          ) : (
                            traits.map((t) => (
                              <button
                                key={t.tag}
                                onClick={() => removeTrait(t.tag)}
                                className="flex items-center gap-1 px-3 py-1 rounded-full text-xs border border-neon-purple/20 bg-neon-purple/5 hover:bg-neon-purple/10 text-neon-purple transition-all"
                              >
                                <span>{t.label}</span>
                                <X size={10} className="opacity-60 ml-0.5" />
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {currentStep === 3 && (
                    /* Step 3: Range balance sliders */
                    <>
                      <div className="flex flex-col items-center justify-center text-center border-b border-gray-border/40 pb-2.5">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neon-purple/20 text-neon-purple font-mono uppercase font-bold tracking-wider shrink-0">
                            Bước 04/07
                          </span>
                          <h3 className="font-bold text-sm text-foreground">
                            Phong Cách &amp; Hành Vi Chat
                          </h3>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Cân chỉnh ngữ khí hội thoại, cách hành văn và độ dài tin nhắn.
                        </p>
                      </div>
                      <div className="space-y-5 py-2">
                        <div className="space-y-2.5">
                          <div className="flex justify-between text-xs font-bold uppercase tracking-wide">
                            <span className="text-muted-foreground">Thân mật / Suồng sã</span>
                            <span className="text-neon-purple font-mono">{dark}%</span>
                            <span className="text-muted-foreground">Trang trọng / Kính cẩn</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={dark}
                            onChange={(e) => setDark(Number(e.target.value))}
                            className="w-full h-1.5 rounded-lg bg-gray-border accent-neon-purple cursor-pointer outline-none"
                          />
                        </div>

                        <div className="space-y-2.5">
                          <div className="flex justify-between text-xs font-bold uppercase tracking-wide">
                            <span className="text-muted-foreground">Chỉ thoại thuần túy</span>
                            <span className="text-neon-purple font-mono">{tsun}%</span>
                            <span className="text-muted-foreground">Tả hành động cử chỉ (*)</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={tsun}
                            onChange={(e) => setTsun(Number(e.target.value))}
                            className="w-full h-1.5 rounded-lg bg-gray-border accent-neon-purple cursor-pointer outline-none"
                          />
                        </div>

                        <div className="space-y-2.5">
                          <div className="flex justify-between text-xs font-bold uppercase tracking-wide">
                            <span className="text-muted-foreground">Kiệm lời / Ngắn gọn</span>
                            <span className="text-neon-purple font-mono">{verbal}%</span>
                            <span className="text-muted-foreground">Nhiều lời / Chi tiết</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={verbal}
                            onChange={(e) => setVerbal(Number(e.target.value))}
                            className="w-full h-1.5 rounded-lg bg-gray-border accent-neon-purple cursor-pointer outline-none"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {currentStep === 4 && (
                    /* Step 4: Settings switches */
                    <>
                      <div className="flex flex-col items-center justify-center text-center border-b border-gray-border/40 pb-2.5">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neon-purple/20 text-neon-purple font-mono uppercase font-bold tracking-wider shrink-0">
                            Bước 05/07
                          </span>
                          <h3 className="font-bold text-sm text-foreground">
                            Tùy Chọn Chức Năng Đặc Biệt
                          </h3>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Tinh chỉnh cấu hình hành vi của AI.
                        </p>
                      </div>
                      <div className="space-y-3">
                        <div
                          onClick={() => setNsfw(!nsfw)}
                          className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                            nsfw ? "border-neon-purple bg-neon-purple/5" : "border-gray-border bg-oled-base/40"
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="text-xs font-bold">Cho phép nội dung người lớn (NSFW)</div>
                            <div className="text-[9px] text-muted-foreground leading-snug">
                              AI có thể tham gia vào ngôn từ hoặc hành động người lớn.
                            </div>
                          </div>
                          <Switch checked={nsfw} onCheckedChange={setNsfw} />
                        </div>

                        <div
                          onClick={() => setMultiChar(!multiChar)}
                          className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                            multiChar ? "border-neon-purple bg-neon-purple/5" : "border-gray-border bg-oled-base/40"
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="text-xs font-bold">Quản lý nhiều nhân vật (Multi-char)</div>
                            <div className="text-[9px] text-muted-foreground leading-snug">
                              Thiết lập card chứa nhiều nhân vật hội thoại cùng lúc.
                            </div>
                          </div>
                          <Switch checked={multiChar} onCheckedChange={setMultiChar} />
                        </div>

                        <div
                          onClick={() => setRpgMode(!rpgMode)}
                          className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                            rpgMode ? "border-neon-purple bg-neon-purple/5" : "border-gray-border bg-oled-base/40"
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="text-xs font-bold">Chế độ Game nhập vai (RPG World)</div>
                            <div className="text-[9px] text-muted-foreground leading-snug">
                              AI sẽ tạo sẵn stats bảng chỉ số, kỹ năng hành động cho card.
                            </div>
                          </div>
                          <Switch checked={rpgMode} onCheckedChange={setRpgMode} />
                        </div>
                      </div>
                    </>
                  )}

                  {currentStep === 5 && (
                    /* Step 5: Optional lore paste block */
                    <>
                      <div className="flex flex-col items-center justify-center text-center border-b border-gray-border/40 pb-2.5">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neon-purple/20 text-neon-purple font-mono uppercase font-bold tracking-wider shrink-0">
                            Bước 06/07
                          </span>
                          <h3 className="font-bold text-sm text-foreground">
                            Dữ Liệu Lore Gốc (Tùy Chọn)
                          </h3>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          AI tự động học hỏi từ thông tin Wiki, fanfic, tiểu sử bạn cung cấp.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Textarea
                          value={extraLore}
                          onChange={(e) => setExtraLore(e.target.value)}
                          placeholder="Ví dụ: 'Nhân vật tên Kai, xuất thân kiếm sĩ đế quốc, có thói quen gãi tai khi bối rối, cực kì trung thành...'"
                          className="bg-oled-base border-gray-border text-foreground placeholder:text-muted-foreground/30 focus-visible:ring-neon-purple/40 min-h-[160px] text-xs resize-y leading-relaxed"
                        />
                      </div>
                    </>
                  )}

                  {currentStep === 6 && (
                    /* Step 6: Confirmation generate screen */
                    <>
                      <div className="flex flex-col items-center justify-center text-center border-b border-gray-border/40 pb-2.5">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neon-purple/20 text-neon-purple font-mono uppercase font-bold tracking-wider shrink-0">
                            Bước 07/07
                          </span>
                          <h3 className="font-bold text-sm text-foreground">
                            Hoàn Tất Cấu Hình &amp; Sinh AI
                          </h3>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Bấm nút dưới để bắt đầu sinh thẻ TavernCard V2 bằng AI.
                        </p>
                      </div>

                      <div className="p-4 rounded-xl border border-gray-border bg-oled-base/60 space-y-2.5">
                        <div className="flex items-center justify-between text-xs border-b border-gray-border/60 pb-1.5">
                          <span className="text-muted-foreground">Phương pháp tạo:</span>
                          <span className="font-semibold text-primary capitalize">{mode}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs border-b border-gray-border/60 pb-1.5">
                          <span className="text-muted-foreground">Cách xưng hô & Xu thế:</span>
                          <span className="font-semibold text-primary">{role} · {gender}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs border-b border-gray-border/60 pb-1.5">
                          <span className="text-muted-foreground">Tính cách đã chọn:</span>
                          <span className="font-semibold text-primary">{traits.length} tính cách</span>
                        </div>
                        <div className="flex items-center justify-between text-xs pb-0.5">
                          <span className="text-muted-foreground">Phong cách chat:</span>
                          <span className="font-mono text-[10px] text-primary">
                            {dark}% Trang trọng / {tsun}% Tả hành động / {verbal}% Dài
                          </span>
                        </div>
                      </div>

                      <Button
                        onClick={handleGenerate}
                        className="w-full bg-neon-purple hover:bg-neon-purple/80 text-white font-bold h-12 shadow-neon-purple hover:shadow-[0_0_12px_var(--tw-shadow-color)] hover:shadow-neon-purple text-sm"
                      >
                        <Sparkles size={16} className="mr-1.5" /> Khởi Tạo Nhân Vật Bằng AI
                      </Button>
                    </>
                  )}

                  {/* Wizard Controls */}
                  <div className="flex gap-3 pt-3 border-t border-gray-border/60">
                    <Button
                      variant="ghost"
                      onClick={prevStep}
                      disabled={currentStep === 0}
                      className="flex-1 border-gray-border"
                    >
                      <ChevronLeft size={16} className="mr-0.5" /> Quay lại
                    </Button>
                    <Button
                      variant="outline"
                      onClick={resetAll}
                      className="border-gray-border text-neon-rose hover:bg-neon-rose/5 flex items-center gap-1"
                    >
                      <RotateCcw size={14} /> Reset
                    </Button>
                    {currentStep < TOTAL_STEPS - 1 && (
                      <Button
                        onClick={nextStep}
                        disabled={currentStep === 1 && mode === "clone" && !clonedChar}
                        className="flex-1 bg-neon-purple text-white hover:bg-neon-purple/90"
                      >
                        Tiếp theo <ChevronRight size={16} className="ml-0.5" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </div>

          {/* Right Column: Live synced character card mockup (Landscape layout structure) */}
          <div className="hidden lg:block lg:col-span-5 lg:sticky lg:top-[100px] space-y-4">
            {renderDraftPreviewCard()}
          </div>
        </div>
      </section>

      {/* Floating Preview Button on Mobile/Tablet */}
      <AnimatePresence>
        {!reviewOpen && phase === "idle" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="lg:hidden fixed bottom-20 right-6 z-40"
          >
            <Button
              onClick={() => setDraftPreviewOpen(true)}
              className="rounded-full w-12 h-12 bg-neon-purple text-white shadow-lg shadow-neon-purple/40 hover:bg-neon-purple/90 flex items-center justify-center border border-neon-purple/20"
              title="Xem bản phác"
            >
              <Eye size={20} />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Draft Preview Sheet for Mobile/Tablet */}
      <Sheet open={draftPreviewOpen} onOpenChange={setDraftPreviewOpen}>
        <SheetContent side="bottom" className="bg-oled-surface border-t border-gray-border p-0 h-[80vh] overflow-y-auto scrollbar-thin">
          <div className="p-4 flex justify-between items-center border-b border-gray-border">
            <h3 className="font-bold text-sm text-foreground">Bản phác thảo nhân vật</h3>
            <Button variant="ghost" size="icon" onClick={() => setDraftPreviewOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X size={16} />
            </Button>
          </div>
          <div className="p-5">
            {renderDraftPreviewCard()}
          </div>
        </SheetContent>
      </Sheet>

      <AppFooter />

      {/* Model select modal */}
      <Sheet open={modelSettingsOpen} onOpenChange={setModelSettingsOpen}>
        <SheetContent side="bottom" className="bg-oled-surface border-t border-gray-border p-6 h-auto">
          <div className="max-w-md mx-auto space-y-4 pb-6">
            <h3 className="font-bold text-base text-foreground">Cấu hình Mô Hình AI</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-semibold uppercase">API Provider</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["openrouter", "mimo", "google_genai"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => handleProviderChange(p)}
                      className={`p-2 rounded-lg border text-xs text-center font-bold capitalize transition-all ${
                        activeProvider === p
                          ? "border-neon-purple bg-neon-purple/10 text-neon-purple"
                          : "border-gray-border bg-oled-base/40 text-muted-foreground"
                      }`}
                    >
                      {p === "google_genai" ? "Google AI" : p === "mimo" ? "Mimo" : "OpenRouter"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-semibold uppercase">Mô hình hoạt động</label>
                <ModelCombobox
                  provider={activeProvider}
                  value={selectedModel}
                  onChange={handleModelChange}
                />
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Review Dialog */}
      <AnimatePresence>
        {reviewOpen && generatedCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.94 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.94 }}
              className="bg-oled-surface border border-gray-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-gray-border flex items-center justify-between shrink-0">
                <div className="space-y-0.5">
                  <h4 className="font-bold text-foreground flex items-center gap-1.5">
                    <Sparkles size={16} className="text-neon-purple" />
                    Hồ Sơ Nhân Vật AI Sinh
                  </h4>
                  <p className="text-[10px] text-muted-foreground">
                    Cập nhật và tải lên Avatar để hoàn thành lưu thẻ.
                  </p>
                </div>
                <button
                  onClick={() => setReviewOpen(false)}
                  className="p-1.5 rounded-lg border border-gray-border text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form elements */}
              <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-4">
                {validation && (
                  <CardQualityScore
                    validation={validation}
                    onAutoFix={handleAutoFix}
                    onRepairField={handleRepairField}
                    repairingFields={repairingFields}
                  />
                )}

                {/* Avatar & Name */}
                <div className="flex flex-col sm:flex-row gap-4 border-b border-gray-border/60 pb-4">
                  <div className="flex flex-col items-center">
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                    <button
                      onClick={() => avatarInputRef.current?.click()}
                      className="w-24 h-24 rounded-full border border-gray-border overflow-hidden bg-oled-base flex flex-col items-center justify-center text-muted-foreground hover:border-neon-purple/50 transition-all shrink-0"
                    >
                      {(() => {
                        if (avatarPreview) {
                          return <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />;
                        }
                        if (mode === "clone" && clonedChar) {
                          const activeFranchise = FRANCHISES.find(f => f.name === clonedChar.franchise);
                          const activeCharObj = activeFranchise?.characters.find(c => c.name === clonedChar.name);
                          if (activeCharObj?.image) {
                            return <img src={activeCharObj.image} alt={clonedChar.name} className="w-full h-full object-cover" />;
                          }
                        }
                        return (
                          <>
                            <ImagePlus size={24} className="mb-1" />
                            <span className="text-[9px]">Avatar</span>
                          </>
                        );
                      })()}
                    </button>
                    {avatarPreview && (
                      <button
                        onClick={clearAvatar}
                        className="mt-1.5 text-[9px] text-neon-rose hover:underline"
                      >
                        Xóa ảnh
                      </button>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                      Tên nhân vật (Name)
                    </label>
                    <input
                      type="text"
                      value={generatedCard.data.name}
                      onChange={(e) => updateCardData({ name: e.target.value })}
                      className="w-full bg-oled-base border border-gray-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:border-neon-purple outline-none"
                    />
                  </div>
                </div>

                {/* Fields details */}
                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                      Mô tả nhân vật (Description)
                    </label>
                    <Textarea
                      value={generatedCard.data.description}
                      onChange={(e) => updateCardData({ description: e.target.value })}
                      className="bg-oled-base text-foreground text-xs min-h-[120px] leading-relaxed"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                      Hồ sơ tính cách (Personality)
                    </label>
                    <Textarea
                      value={generatedCard.data.personality}
                      onChange={(e) => updateCardData({ personality: e.target.value })}
                      className="bg-oled-base text-foreground text-xs min-h-[80px]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                      Bối cảnh kịch bản (Scenario)
                    </label>
                    <Textarea
                      value={generatedCard.data.scenario}
                      onChange={(e) => updateCardData({ scenario: e.target.value })}
                      className="bg-oled-base text-foreground text-xs min-h-[60px]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                      Lời chào đầu tiên (First Message)
                    </label>
                    <Textarea
                      value={generatedCard.data.first_mes}
                      onChange={(e) => updateCardData({ first_mes: e.target.value })}
                      className="bg-oled-base text-foreground text-xs min-h-[100px] leading-relaxed"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                      Ví dụ hội thoại (Message Examples)
                    </label>
                    <Textarea
                      value={generatedCard.data.mes_example}
                      onChange={(e) => updateCardData({ mes_example: e.target.value })}
                      className="bg-oled-base text-foreground text-xs min-h-[120px] font-mono leading-relaxed"
                    />
                  </div>
                </div>
              </div>

              {/* Save Controls */}
              <div className="px-5 py-4 border-t border-gray-border bg-oled-base flex items-center justify-between shrink-0">
                <Button variant="ghost" onClick={() => setReviewOpen(false)} className="border-gray-border">
                  Quay lại sửa
                </Button>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSave}
                    disabled={publishing}
                    className="bg-neon-purple hover:bg-neon-purple/80 text-white font-bold"
                  >
                    {publishing ? (
                      <Loader2 size={14} className="animate-spin mr-1.5" />
                    ) : (
                      <Save size={14} className="mr-1.5" />
                    )}
                    {publishing ? "Đang lưu..." : "Lưu Nhân Vật"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
