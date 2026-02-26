import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Loader2,
  Play,
  Trash2,
  Clock,
  Database,
  ChevronDown,
  Copy,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const HISTORY_KEY = "vietrp_sql_history";
const MAX_HISTORY = 20;

const SETUP_SQL = `-- Run this ONCE in Supabase SQL Editor to enable the in-app SQL editor
CREATE OR REPLACE FUNCTION exec_sql(query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  affected int;
  is_select boolean;
BEGIN
  -- Admin-only check via has_role
  IF NOT (SELECT has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  is_select := lower(trim(query)) ~ '^(select|with|explain)';

  IF is_select THEN
    EXECUTE format(
      'SELECT COALESCE(json_agg(row_to_json(t)), ''[]''::json) FROM (%s) t',
      query
    ) INTO result;
  ELSE
    EXECUTE query;
    GET DIAGNOSTICS affected = ROW_COUNT;
    result := json_build_object('affected_rows', affected, 'status', 'ok');
  END IF;

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM, 'detail', SQLSTATE);
END;
$$;`;

const PRESET_QUERIES = [
  {
    label: "Tat ca nhan vat (top 20)",
    sql: "SELECT id, name, message_count, rating, is_public, created_at FROM characters ORDER BY created_at DESC LIMIT 20",
  },
  {
    label: "Thong ke nguoi dung",
    sql: "SELECT id, display_name, nsfw_mode, created_at FROM profiles ORDER BY created_at DESC LIMIT 20",
  },
  {
    label: "Chat sessions gan day",
    sql: "SELECT id, character_id, user_id, title, created_at, updated_at FROM chat_sessions ORDER BY updated_at DESC LIMIT 20",
  },
  {
    label: "Top nhan vat theo tin nhan",
    sql: "SELECT id, name, message_count, rating FROM characters WHERE is_public = true ORDER BY message_count DESC LIMIT 10",
  },
  {
    label: "User favorites",
    sql: "SELECT uf.id, uf.user_id, uf.character_id, c.name as character_name, uf.created_at FROM user_favorites uf JOIN characters c ON c.id = uf.character_id ORDER BY uf.created_at DESC LIMIT 20",
  },
  {
    label: "Roadmap items",
    sql: "SELECT id, title, status, priority FROM roadmap_items ORDER BY priority ASC",
  },
];

function loadHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(history: string[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}

const AdminSqlEditorPage = () => {
  const { user, isLoading } = useAuth();
  const { isAdmin, checking } = useIsAdmin();

  const [sql, setSql] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [history, setHistory] = useState<string[]>(loadHistory);
  const [showHistory, setShowHistory] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Test if exec_sql function exists
    (supabase.rpc as any)("exec_sql", { query: "SELECT 1 as test" })
      .then(({ error: err }: { error: any }) => {
        if (err && (err.message.includes("could not find") || err.message.includes("function") || err.code === "PGRST202")) {
          setSetupNeeded(true);
        }
      });
  }, []);

  const executeQuery = useCallback(async () => {
    const trimmed = sql.trim();
    if (!trimmed || running) return;

    setRunning(true);
    setError(null);
    setResult(null);
    setElapsed(null);

    const start = performance.now();

    try {
      const { data, error: rpcError } = await (supabase.rpc as any)("exec_sql", {
        query: trimmed,
      });

      const ms = Math.round(performance.now() - start);
      setElapsed(ms);

      if (rpcError) {
        setError(rpcError.message);
        return;
      }

      if (data != null && typeof data === "object" && "error" in (data as Record<string, unknown>)) {
        const d = data as Record<string, unknown>;
        setError(`${d.error}${d.detail ? ` [${d.detail}]` : ""}`);
        return;
      }

      setResult(data);

      // Save to history
      setHistory((prev) => {
        const next = [trimmed, ...prev.filter((h) => h !== trimmed)].slice(0, MAX_HISTORY);
        saveHistory(next);
        return next;
      });
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setRunning(false);
    }
  }, [sql, running]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      executeQuery();
    }
  };

  const copySetupSql = async () => {
    await navigator.clipboard.writeText(SETUP_SQL);
    toast.success("Da copy SQL setup!");
  };

  if (isLoading || checking) {
    return (
      <div className="flex-1 flex items-center justify-center bg-oled-base">
        <Loader2 size={24} className="animate-spin text-neon-purple" />
      </div>
    );
  }

  if (!user || !isAdmin) return <Navigate to="/" replace />;

  const isArray = Array.isArray(result);
  const columns = isArray && result.length > 0 ? Object.keys(result[0]) : [];

  return (
    <ScrollArea className="flex-1">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 md:p-8 max-w-6xl mx-auto w-full space-y-4 pb-24"
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Database size={20} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">SQL Editor</h1>
            <p className="text-xs text-muted-foreground">
              Truy vấn Database từ Supabase trực tiếp từ website 
            </p>
          </div>
        </div>

        {/* Setup warning */}
        {setupNeeded && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle size={16} />
              <span className="text-sm font-semibold">Cần cài đặt hàm exec_sql</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Hãy chạy đoạn SQL bên dưới trong Supabase SQL Editor (trang web Supabase) để kích hoạt
              tính năng này. Chỉ cần chạy một lần duy nhất.
            </p>
            <div className="relative">
              <pre className="text-[11px] text-foreground/80 bg-oled-base border border-gray-border rounded-lg p-3 overflow-x-auto max-h-64 scrollbar-thin font-mono">
                {SETUP_SQL}
              </pre>
              <button
                onClick={copySetupSql}
                className="absolute top-2 right-2 p-1.5 rounded-md bg-oled-elevated border border-gray-border text-muted-foreground hover:text-foreground transition-colors"
              >
                <Copy size={12} />
              </button>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Presets */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowPresets(!showPresets); setShowHistory(false); }}
              className="border-gray-border text-muted-foreground hover:text-neon-blue hover:border-neon-blue/40 text-xs gap-1"
            >
              <Database size={12} />
              Preset
              <ChevronDown size={12} />
            </Button>
            {showPresets && (
              <div className="absolute top-full left-0 mt-1 z-50 w-72 bg-oled-surface border border-gray-border rounded-lg shadow-lg overflow-hidden">
                {PRESET_QUERIES.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSql(p.sql);
                      setShowPresets(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-oled-elevated transition-colors border-b border-gray-border last:border-0"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* History */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowHistory(!showHistory); setShowPresets(false); }}
              className="border-gray-border text-muted-foreground hover:text-neon-purple hover:border-neon-purple/40 text-xs gap-1"
            >
              <Clock size={12} />
              Lịch sử ({history.length})
              <ChevronDown size={12} />
            </Button>
            {showHistory && history.length > 0 && (
              <div className="absolute top-full left-0 mt-1 z-50 w-80 max-h-64 overflow-y-auto bg-oled-surface border border-gray-border rounded-lg shadow-lg scrollbar-thin">
                {history.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSql(h);
                      setShowHistory(false);
                    }}
                    className="w-full text-left px-3 py-2 text-[11px] text-foreground/80 hover:bg-oled-elevated transition-colors border-b border-gray-border last:border-0 font-mono truncate"
                  >
                    {h.slice(0, 120)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => { setSql(""); setResult(null); setError(null); setElapsed(null); }}
            className="border-gray-border text-muted-foreground hover:text-neon-rose hover:border-neon-rose/40 text-xs gap-1"
          >
            <Trash2 size={12} />
            Xoa
          </Button>

          <div className="flex-1" />

          {elapsed !== null && (
            <span className="text-[11px] text-muted-foreground">
              {elapsed}ms
            </span>
          )}
        </div>

        {/* SQL Input */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="-- Nhập SQL tại đây... (Ctrl+Enter để chạy)"
            spellCheck={false}
            rows={8}
            className="w-full bg-oled-base border border-gray-border rounded-xl p-4 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-neon-blue/50 resize-y min-h-[120px] scrollbar-thin"
          />
          <Button
            onClick={executeQuery}
            disabled={running || !sql.trim()}
            className="absolute bottom-3 right-3 bg-neon-blue hover:bg-neon-blue/80 text-white h-8 px-3 text-xs gap-1.5"
          >
            {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            {running ? "Đang chạy..." : "Chạy (Ctrl+Enter)"}
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-neon-rose/30 bg-neon-rose/5 p-4">
            <div className="flex items-center gap-2 text-neon-rose mb-1">
              <AlertTriangle size={14} />
              <span className="text-sm font-semibold">Lỗi</span>
            </div>
            <pre className="text-xs text-neon-rose/80 font-mono whitespace-pre-wrap">
              {error}
            </pre>
          </div>
        )}

        {/* Results */}
        {result !== null && !error && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {isArray
                  ? `${result.length} dòng`
                  : result?.affected_rows !== undefined
                    ? `${result.affected_rows} dòng bị ảnh hưởng`
                    : "Hoàn thành"}
              </span>
              {isArray && result.length > 0 && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
                    toast.success("Đã copy JSON!");
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  <Copy size={10} />
                  Copy JSON lại
                </button>
              )}
            </div>

            {isArray && result.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-gray-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-oled-elevated border-b border-gray-border">
                      {columns.map((col) => (
                        <th
                          key={col}
                          className="px-3 py-2 text-left text-muted-foreground font-semibold whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.map((row: any, i: number) => (
                      <tr
                        key={i}
                        className="border-b border-gray-border/50 hover:bg-oled-elevated/50 transition-colors"
                      >
                        {columns.map((col) => (
                          <td
                            key={col}
                            className="px-3 py-1.5 text-foreground/80 font-mono whitespace-nowrap max-w-[300px] truncate"
                            title={String(row[col] ?? "")}
                          >
                            {row[col] === null ? (
                              <span className="text-muted-foreground italic">null</span>
                            ) : typeof row[col] === "object" ? (
                              JSON.stringify(row[col])
                            ) : (
                              String(row[col])
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : isArray && result.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Không có kết quả
              </div>
            ) : (
              <pre className="text-xs text-foreground/80 bg-oled-base border border-gray-border rounded-xl p-4 font-mono">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        )}
      </motion.div>
    </ScrollArea>
  );
};

export default AdminSqlEditorPage;
