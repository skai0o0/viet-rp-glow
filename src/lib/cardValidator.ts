import { TavernCardV2Data } from "@/types/taverncard";
import { countTokens } from "@/utils/tokenizer";
import { CARD_FIELD_BUDGET, FORMAT_RULES, detectPronouns } from "./cardSchema";

export interface Issue {
  field: string;
  code: string;
  message: string;
  autoFixable: boolean;
}

export interface ValidationResult {
  valid: boolean;
  score: number;
  errors: Issue[];
  warnings: Issue[];
  suggestions: Issue[];
}

export function validateCard(card: TavernCardV2Data): ValidationResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const suggestions: Issue[] = [];

  // ── ERRORS (blocking) ──

  if (!card.name?.trim()) {
    errors.push({
      field: "name",
      code: "NO_NAME",
      message: "Nhân vật chưa có tên.",
      autoFixable: false,
    });
  }

  const descTokens = countTokens(card.description || "");
  if (descTokens > CARD_FIELD_BUDGET.description.maxTokens) {
    errors.push({
      field: "description",
      code: "DESCRIPTION_TOO_LONG",
      message: `Description quá dài (${descTokens} tokens). Tối đa ${CARD_FIELD_BUDGET.description.maxTokens} tokens.`,
      autoFixable: true,
    });
  }

  if (!card.description?.trim()) {
    errors.push({
      field: "description",
      code: "DESCRIPTION_EMPTY",
      message: "Description trống — cần mô tả nhân vật.",
      autoFixable: false,
    });
  }

  // first_mes is a greeting
  const firstMes = card.first_mes?.trim() || "";
  const isGreeting = FORMAT_RULES.first_mes_forbidden_starts.some((s) =>
    firstMes.startsWith(s)
  );
  if (firstMes && isGreeting) {
    errors.push({
      field: "first_mes",
      code: "FIRST_MES_IS_GREETING",
      message:
        'First message không được bắt đầu bằng lời chào. Phải là một cảnh mở đầu in-character.',
      autoFixable: false,
    });
  }

  // mes_example too few pairs
  const startCount = (card.mes_example?.match(/<START>/gi) || []).length;
  if (card.mes_example && startCount < CARD_FIELD_BUDGET.mes_example.minPairs) {
    errors.push({
      field: "mes_example",
      code: "MES_EXAMPLE_TOO_FEW",
      message: `Chỉ có ${startCount} đoạn hội thoại mẫu. Cần ít nhất ${CARD_FIELD_BUDGET.mes_example.minPairs}, lý tưởng là ${CARD_FIELD_BUDGET.mes_example.idealPairs}+.`,
      autoFixable: false,
    });
  }

  // ── WARNINGS (non-blocking) ──

  const persTokens = countTokens(card.personality || "");
  if (persTokens > CARD_FIELD_BUDGET.personality.maxTokens) {
    warnings.push({
      field: "personality",
      code: "PERSONALITY_TOO_LONG",
      message: `Personality ${persTokens} tokens — nên < ${CARD_FIELD_BUDGET.personality.maxTokens} tokens, chỉ giữ traits cốt lõi.`,
      autoFixable: true,
    });
  }

  if (!card.scenario || card.scenario.trim().length < 50) {
    warnings.push({
      field: "scenario",
      code: "SCENARIO_EMPTY",
      message: "Scenario quá ngắn hoặc trống. Nên mô tả bối cảnh gặp mặt mặc định.",
      autoFixable: false,
    });
  }

  const sysTokens = countTokens(card.system_prompt || "");
  if (sysTokens > CARD_FIELD_BUDGET.system_prompt.maxTokens) {
    warnings.push({
      field: "system_prompt",
      code: "SYSTEM_PROMPT_TOO_LONG",
      message: `System prompt ${sysTokens} tokens — nên < ${CARD_FIELD_BUDGET.system_prompt.maxTokens} tokens.`,
      autoFixable: true,
    });
  }

  // mes_example missing action format
  const hasActionFormat = /\*[^*]+\*/.test(card.mes_example || "");
  if (card.mes_example && !hasActionFormat) {
    warnings.push({
      field: "mes_example",
      code: "MES_EXAMPLE_NO_ACTIONS",
      message:
        'Hội thoại mẫu thiếu *hành động*. Nên có đủ 3 thành phần: (Suy nghĩ) *Hành động* "Lời thoại".',
      autoFixable: false,
    });
  }

  // Pronoun mismatch
  const mesPronouns = detectPronouns(card.mes_example || "");
  const sysPronouns = detectPronouns(card.system_prompt || "");
  if (mesPronouns && sysPronouns && mesPronouns !== sysPronouns) {
    warnings.push({
      field: "system_prompt",
      code: "PRONOUN_MISMATCH",
      message: `Xưng hô không nhất quán: mes_example dùng "${mesPronouns}" nhưng system_prompt dùng "${sysPronouns}".`,
      autoFixable: false,
    });
  }

  // first_mes too long
  const firstMesTokens = countTokens(firstMes);
  if (firstMesTokens > CARD_FIELD_BUDGET.first_mes.maxTokens) {
    warnings.push({
      field: "first_mes",
      code: "FIRST_MES_TOO_LONG",
      message: `First message ${firstMesTokens} tokens — nên < ${CARD_FIELD_BUDGET.first_mes.maxTokens} tokens.`,
      autoFixable: true,
    });
  }

  // ── SUGGESTIONS ──

  if (!card.creator_notes?.trim()) {
    suggestions.push({
      field: "creator_notes",
      code: "NO_CREATOR_NOTES",
      message: "Thêm creator notes để người dùng hiểu cách dùng card này.",
      autoFixable: false,
    });
  }

  if (!card.tags || card.tags.length === 0) {
    suggestions.push({
      field: "tags",
      code: "NO_TAGS",
      message: "Thêm tags để card dễ tìm kiếm hơn.",
      autoFixable: false,
    });
  }

  // ── Score ──
  const errorPenalty = errors.length * 20;
  const warningPenalty = warnings.length * 7;
  const score = Math.max(0, 100 - errorPenalty - warningPenalty);

  return {
    valid: errors.length === 0,
    score,
    errors,
    warnings,
    suggestions,
  };
}
