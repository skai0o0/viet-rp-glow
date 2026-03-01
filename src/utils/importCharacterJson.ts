import JSON5 from "json5";
import { TavernCardV2, TavernCardV2Data, createEmptyTavernCard } from "@/types/taverncard";

/**
 * Parse a JSON file/object into a TavernCardV2 structure.
 * Supports both TavernCardV2 format (with spec/data wrapper) and flat character data.
 */
export function parseTavernCardJson(json: unknown): TavernCardV2 {
  if (!json || typeof json !== "object") {
    throw new Error("File JSON không hợp lệ.");
  }

  const obj = json as Record<string, any>;

  // Full TavernCardV2 format
  if (obj.spec === "chara_card_v2" && obj.data) {
    return {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: mapToCardData(obj.data),
    };
  }

  // Flat format (just the data fields)
  if (obj.name && (obj.description !== undefined || obj.first_mes !== undefined)) {
    return {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: mapToCardData(obj),
    };
  }

  throw new Error("Không nhận diện được định dạng character card. Cần TavernCardV2 hoặc flat JSON với trường 'name'.");
}

function mapToCardData(raw: Record<string, any>): TavernCardV2Data {
  const empty = createEmptyTavernCard().data;
  return {
    name: String(raw.name ?? empty.name),
    description: String(raw.description ?? empty.description),
    personality: String(raw.personality ?? empty.personality),
    scenario: String(raw.scenario ?? empty.scenario),
    first_mes: String(raw.first_mes ?? empty.first_mes),
    mes_example: String(raw.mes_example ?? empty.mes_example),
    creator_notes: String(raw.creator_notes ?? empty.creator_notes),
    system_prompt: String(raw.system_prompt ?? empty.system_prompt),
    post_history_instructions: String(raw.post_history_instructions ?? empty.post_history_instructions),
    alternate_greetings: Array.isArray(raw.alternate_greetings) ? raw.alternate_greetings.map(String) : [],
    character_book: raw.character_book ?? undefined,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    creator: String(raw.creator ?? empty.creator),
    character_version: String(raw.character_version ?? empty.character_version),
    extensions: raw.extensions && typeof raw.extensions === "object" ? raw.extensions : {},
  };
}

/**
 * Read a File object as JSON and parse it into TavernCardV2.
 */
export function readJsonFile(file: File): Promise<TavernCardV2> {
  return new Promise((resolve, reject) => {
    if (!file.name.endsWith(".json")) {
      reject(new Error("Chỉ hỗ trợ file .json"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON5.parse(reader.result as string);
        resolve(parseTavernCardJson(json));
      } catch (e: any) {
        reject(new Error(e.message || "Không thể đọc file JSON."));
      }
    };
    reader.onerror = () => reject(new Error("Lỗi khi đọc file."));
    reader.readAsText(file);
  });
}
