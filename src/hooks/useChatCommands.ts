import { useState, useEffect, useRef } from "react";

export interface CommandDef {
  name: string;
  usage: string;
  description: string;
}

const COMMANDS: CommandDef[] = [
  { name: "/cmd", usage: "/cmd ", description: "Instruct AI 1 lượt (tôi → {{user}}, cô ấy → {{char}})" },
  { name: "/debug", usage: "/debug ", description: "Admin: đính kèm debug parse vào reply kế tiếp" },
  { name: "/addnpc", usage: "/addnpc Tên [- mô tả]", description: "Thêm NPC vào cuộc trò chuyện" },
  { name: "/removenpc", usage: "/removenpc Tên", description: "Xóa NPC khỏi cuộc trò chuyện" },
  { name: "/listnpc", usage: "/listnpc", description: "Xem danh sách NPC đang active" },
  { name: "/clearnpc", usage: "/clearnpc", description: "Xóa tất cả NPC" },
];

const CMD_HISTORY_KEY = "vietrp_cmd_history";
const CMD_HISTORY_MAX = 20;

function loadCmdHistory(): string[] {
  try {
    const raw = localStorage.getItem(CMD_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCmdToHistory(cmd: string) {
  const history = loadCmdHistory().filter((h) => h !== cmd);
  history.unshift(cmd);
  if (history.length > CMD_HISTORY_MAX) history.length = CMD_HISTORY_MAX;
  localStorage.setItem(CMD_HISTORY_KEY, JSON.stringify(history));
}

interface UseChatCommandsOptions {
  inputValue: string;
  focused: boolean;
  onSelectCommand: (usage: string) => void;
  onSelectHistory: (entry: string) => void;
}

export function useChatCommands({
  inputValue,
  focused,
  onSelectCommand,
  onSelectHistory,
}: UseChatCommandsOptions) {
  const [showCommands, setShowCommands] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const commandListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCmdHistory(loadCmdHistory());
  }, []);

  const query = inputValue.trim().toLowerCase();
  const filteredHistory = cmdHistory.filter((h) => {
    if (query.length <= 1) return true;
    return h.toLowerCase().startsWith(query);
  });
  const filteredCommands = COMMANDS.filter((cmd) => {
    if (query.length <= 1) return true;
    return cmd.name.toLowerCase().startsWith(query) || cmd.usage.toLowerCase().includes(query);
  });

  const totalItems = filteredHistory.length + filteredCommands.length;

  useEffect(() => {
    const trimmed = inputValue.trim();
    if (trimmed.startsWith("/") && !trimmed.includes(" ") && focused) {
      setCmdHistory(loadCmdHistory());
      setShowCommands(true);
      setSelectedIdx(0);
    } else {
      setShowCommands(false);
    }
  }, [inputValue, focused]);

  useEffect(() => {
    if (!commandListRef.current) return;
    const selected = commandListRef.current.querySelector(`[data-cmd-idx="${selectedIdx}"]`);
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIdx]);

  const handleSelectItem = (idx: number) => {
    if (idx < filteredHistory.length) {
      onSelectHistory(filteredHistory[idx]);
    } else {
      const cmd = filteredCommands[idx - filteredHistory.length];
      if (cmd) onSelectCommand(cmd.usage);
    }
    setShowCommands(false);
  };

  const handleCommandKeyDown = (e: React.KeyboardEvent): boolean => {
    if (!showCommands || totalItems === 0) return false;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((prev) => (prev + 1) % totalItems);
      return true;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((prev) => (prev - 1 + totalItems) % totalItems);
      return true;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      handleSelectItem(selectedIdx);
      return true;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setShowCommands(false);
      return true;
    }

    return false;
  };

  return {
    showCommands,
    selectedIdx,
    setSelectedIdx,
    filteredHistory,
    filteredCommands,
    totalItems,
    commandListRef,
    handleCommandKeyDown,
    handleSelectItem,
  };
}
