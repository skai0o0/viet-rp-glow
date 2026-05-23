import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertTriangle, AlertCircle, Lightbulb, Wand2, ChevronDown, ChevronRight, Sparkles, CheckCircle2 } from "lucide-react";
import type { ValidationResult, Issue } from "@/lib/cardValidator";

export interface CardQualityScoreProps {
  validation: ValidationResult;
  onAutoFix?: () => void;
  onRepairField?: (issue: Issue) => void;
  repairingFields?: Set<string>;
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  return "text-red-400";
}

function scoreBarColor(score: number): string {
  if (score >= 80) return "bg-green-400";
  if (score >= 60) return "bg-yellow-400";
  return "bg-red-400";
}

function scoreGlow(score: number): string {
  if (score >= 80) return "shadow-[0_0_8px_rgba(74,222,128,0.3)]";
  if (score >= 60) return "shadow-[0_0_8px_rgba(250,204,21,0.3)]";
  return "shadow-[0_0_8px_rgba(248,113,113,0.3)]";
}

function IssueItem({
  issue,
  onRepair,
  isRepairing,
}: {
  issue: Issue;
  onRepair?: (issue: Issue) => void;
  isRepairing?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-2 py-1.5"
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs text-foreground/80 leading-relaxed">{issue.message}</p>
        <span className="text-[10px] text-muted-foreground/50 font-mono">{issue.field}</span>
      </div>
      {issue.autoFixable && (
        <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-neon-purple/10 text-neon-purple border border-neon-purple/20">
          Auto
        </span>
      )}
      {!issue.autoFixable && onRepair && (
        <button
          onClick={() => onRepair(issue)}
          disabled={isRepairing}
          className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium transition-all border bg-neon-blue/5 text-neon-blue border-neon-blue/20 hover:bg-neon-blue/10 hover:border-neon-blue/40 disabled:opacity-50"
        >
          {isRepairing ? (
            <Loader2 size={10} className="animate-spin" />
          ) : (
            <Sparkles size={10} />
          )}
          Sửa AI
        </button>
      )}
    </motion.div>
  );
}

export default function CardQualityScore({
  validation,
  onAutoFix,
  onRepairField,
  repairingFields,
}: CardQualityScoreProps) {
  const [errorsOpen, setErrorsOpen] = useState(true);
  const [warningsOpen, setWarningsOpen] = useState(true);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  const { score, errors, warnings, suggestions } = validation;
  const autoFixableCount = errors.filter((e) => e.autoFixable).length;
  const allGood = errors.length === 0 && warnings.length === 0;

  return (
    <div className="space-y-3">
      {/* Score bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            Chất lượng card
          </span>
          <span className={`text-sm font-bold font-mono ${scoreColor(score)}`}>
            {score}/100
          </span>
        </div>
        <div className={`h-2 rounded-full bg-oled-surface overflow-hidden ${scoreGlow(score)}`}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className={`h-full rounded-full ${scoreBarColor(score)}`}
          />
        </div>
      </div>

      {/* All good state */}
      {allGood && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-400/5 border border-green-400/10"
        >
          <CheckCircle2 size={14} className="text-green-400 shrink-0" />
          <span className="text-xs text-green-400/80">Card đạt chuẩn — sẵn sàng lưu.</span>
        </motion.div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="space-y-1">
          <button
            onClick={() => setErrorsOpen(!errorsOpen)}
            className="w-full flex items-center gap-1.5 px-1 py-1 rounded-md text-left hover:bg-oled-elevated transition-colors"
          >
            {errorsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <AlertCircle size={12} className="text-red-400 shrink-0" />
            <span className="text-xs text-red-400 font-semibold flex-1">
              {errors.length} lỗi
            </span>
            {autoFixableCount > 0 && (
              <span className="text-[10px] text-red-400/60">{autoFixableCount} auto</span>
            )}
          </button>
          <AnimatePresence>
            {errorsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="pl-5 overflow-hidden"
              >
                {errors.map((issue, i) => (
                  <IssueItem
                    key={`${issue.code}-${i}`}
                    issue={issue}
                    onRepair={onRepairField}
                    isRepairing={repairingFields?.has(issue.field)}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-1">
          <button
            onClick={() => setWarningsOpen(!warningsOpen)}
            className="w-full flex items-center gap-1.5 px-1 py-1 rounded-md text-left hover:bg-oled-elevated transition-colors"
          >
            {warningsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <AlertTriangle size={12} className="text-yellow-400 shrink-0" />
            <span className="text-xs text-yellow-400 font-semibold flex-1">
              {warnings.length} cảnh báo
            </span>
          </button>
          <AnimatePresence>
            {warningsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="pl-5 overflow-hidden"
              >
                {warnings.map((issue, i) => (
                  <IssueItem
                    key={`${issue.code}-${i}`}
                    issue={issue}
                    onRepair={onRepairField}
                    isRepairing={repairingFields?.has(issue.field)}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-1">
          <button
            onClick={() => setSuggestionsOpen(!suggestionsOpen)}
            className="w-full flex items-center gap-1.5 px-1 py-1 rounded-md text-left hover:bg-oled-elevated transition-colors"
          >
            {suggestionsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Lightbulb size={12} className="text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground font-semibold flex-1">
              {suggestions.length} gợi ý
            </span>
          </button>
          <AnimatePresence>
            {suggestionsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="pl-5 overflow-hidden"
              >
                {suggestions.map((issue, i) => (
                  <IssueItem
                    key={`${issue.code}-${i}`}
                    issue={issue}
                    onRepair={onRepairField}
                    isRepairing={repairingFields?.has(issue.field)}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Auto-fix button */}
      {autoFixableCount > 0 && onAutoFix && (
        <motion.button
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={onAutoFix}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border bg-neon-purple/5 text-neon-purple border-neon-purple/20 hover:bg-neon-purple/10 hover:border-neon-purple/40"
        >
          <Wand2 size={12} />
          Tự động sửa {autoFixableCount} lỗi
        </motion.button>
      )}
    </div>
  );
}
