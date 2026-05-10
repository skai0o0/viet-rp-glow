import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildMessages, buildSystemPrompt, detectCardType } from "@/utils/promptBuilder";
import type { CharacterCard } from "@/types/character";

// Mock dependencies
vi.mock("@/services/profileDb", () => ({
  getCachedUserPersona: () => ({
    displayName: "TestUser",
    gender: null,
    sexuality: null,
    userDescription: null,
  }),
  buildIdentityString: () => "",
}));

vi.mock("@/services/globalSettingsDb", () => ({
  getGlobalSystemPrompt: () => "Global prompt",
  getGlobalPromptTypeA: () => "Type A system prompt",
  getGlobalPromptTypeB: () => "Type B system prompt",
  getGlobalPostHistoryTypeA: () => "Type A post-history",
  getGlobalPostHistoryTypeB: () => "Type B post-history",
}));

vi.mock("@/components/GenerationSettings", () => ({
  getResponseStylePrompt: () => "",
}));

// Mock localStorage
const localStorageMock: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (k: string) => localStorageMock[k] ?? null,
  setItem: (k: string, v: string) => { localStorageMock[k] = v; },
  removeItem: (k: string) => { delete localStorageMock[k]; },
});

const baseChar: CharacterCard = {
  name: "TestChar",
  description: "A test character",
  personality: "Friendly",
  first_mes: "Hello!",
  scenario: "A test scenario",
  avatar: "T",
  tags: ["test"],
};

describe("detectCardType", () => {
  it("returns 'type_a' for a simple single-character card", () => {
    expect(detectCardType(baseChar)).toBe("type_a");
  });

  it("returns 'type_b' when description contains --- [Name] --- pattern", () => {
    const char: CharacterCard = {
      ...baseChar,
      description: "--- [Thy Ngân] ---\nA mysterious merchant.\n--- [Linh] ---\nA traveling warrior.",
    };
    expect(detectCardType(char)).toBe("type_b");
  });

  it("returns 'type_b' when character_book has entries", () => {
    const char: CharacterCard = {
      ...baseChar,
      character_book: {
        entries: [
          {
            keys: ["kingdom"],
            content: "The kingdom has 5 provinces.",
            enabled: true,
            insertion_order: 0,
            constant: true,
          },
        ],
      },
    };
    expect(detectCardType(char)).toBe("type_b");
  });

  it("returns 'type_a' when character_book has zero entries", () => {
    const char: CharacterCard = {
      ...baseChar,
      character_book: { entries: [] },
    };
    expect(detectCardType(char)).toBe("type_a");
  });
});

describe("buildSystemPrompt", () => {
  beforeEach(() => {
    localStorageMock["vietrp_nsfw_mode"] = "false";
  });

  it("uses Type A prompt for a Type A character", () => {
    const result = buildSystemPrompt(baseChar, "Alice");
    expect(result).toContain("Type A system prompt");
  });

  it("uses Type B prompt for a character with --- [Name] --- in description", () => {
    const char: CharacterCard = {
      ...baseChar,
      description: "--- [NPC1] ---\nFirst NPC.\n--- [NPC2] ---\nSecond NPC.",
    };
    const result = buildSystemPrompt(char, "Alice");
    expect(result).toContain("Type B system prompt");
  });

  it("uses Type B prompt for a character with lorebook entries", () => {
    const char: CharacterCard = {
      ...baseChar,
      character_book: {
        entries: [
          {
            keys: ["magic"],
            content: "Magic is powered by crystals.",
            enabled: true,
            insertion_order: 0,
            constant: true,
            position: "before_char",
          },
        ],
      },
    };
    const result = buildSystemPrompt(char, "Alice");
    expect(result).toContain("Type B system prompt");
  });

  it("does NOT inject character.system_prompt", () => {
    const char: CharacterCard = {
      ...baseChar,
      system_prompt: "This should NOT appear in the prompt.",
    };
    const result = buildSystemPrompt(char, "Alice");
    expect(result).not.toContain("This should NOT appear in the prompt.");
  });

  it("includes character info sections", () => {
    const result = buildSystemPrompt(baseChar, "Alice");
    expect(result).toContain("A test character");
    expect(result).toContain("Friendly");
    expect(result).toContain("A test scenario");
  });

  it("injects lorebook entries with position 'before_char' before character info", () => {
    const char: CharacterCard = {
      ...baseChar,
      character_book: {
        entries: [
          {
            keys: ["magic"],
            content: "Magic is powered by crystals.",
            enabled: true,
            insertion_order: 0,
            constant: true,
            position: "before_char",
          },
        ],
      },
    };
    const result = buildSystemPrompt(char, "Alice");
    const magicIdx = result.indexOf("Magic is powered by crystals.");
    const charIdx = result.indexOf("--- CHARACTER DESCRIPTION ---");
    expect(magicIdx).toBeGreaterThan(-1);
    expect(magicIdx).toBeLessThan(charIdx);
    expect(result).toContain("--- WORLD INFO ---");
  });

  it("injects lorebook entries with position 'after_char' after character info", () => {
    const char: CharacterCard = {
      ...baseChar,
      character_book: {
        entries: [
          {
            keys: ["kingdom"],
            content: "The kingdom has 5 provinces.",
            enabled: true,
            insertion_order: 0,
            constant: true,
            position: "after_char",
          },
        ],
      },
    };
    const result = buildSystemPrompt(char, "Alice");
    const charIdx = result.indexOf("--- CHARACTER DESCRIPTION ---");
    const kingdomIdx = result.indexOf("The kingdom has 5 provinces.");
    expect(kingdomIdx).toBeGreaterThan(charIdx);
    expect(result).toContain("--- SUPPLEMENTAL INFO ---");
  });

  it("skips disabled entries", () => {
    const char: CharacterCard = {
      ...baseChar,
      character_book: {
        entries: [
          {
            keys: ["test"],
            content: "This should not appear.",
            enabled: false,
            insertion_order: 0,
            constant: true,
          },
        ],
      },
    };
    const result = buildSystemPrompt(char, "Alice");
    expect(result).not.toContain("This should not appear.");
  });

  it("does not inject triggered entries when no keywords match", () => {
    const char: CharacterCard = {
      ...baseChar,
      character_book: {
        entries: [
          {
            keys: ["dragon"],
            content: "Dragons are extinct.",
            enabled: true,
            insertion_order: 0,
            constant: false,
          },
        ],
      },
    };
    const result = buildSystemPrompt(char, "Alice", [
      { role: "user", content: "Hello there" },
    ]);
    expect(result).not.toContain("Dragons are extinct.");
  });
});

describe("buildMessages", () => {
  beforeEach(() => {
    localStorageMock["vietrp_nsfw_mode"] = "false";
  });

  it("returns system prompt + chat history messages", () => {
    const messages = buildMessages(baseChar, [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello!" },
    ]);
    expect(messages[0].role).toBe("system");
    expect(messages.some((m) => m.content === "Hi")).toBe(true);
    expect(messages.some((m) => m.content === "Hello!")).toBe(true);
  });

  it("includes Type A post-history instructions for Type A character", () => {
    const messages = buildMessages(baseChar, []);
    const postSystem = [...messages].reverse().find((m) => m.role === "system");
    expect(postSystem?.content).toContain("Type A post-history");
  });

  it("includes Type B post-history instructions for Type B character", () => {
    const char: CharacterCard = {
      ...baseChar,
      description: "--- [NPC1] ---\nFirst.\n--- [NPC2] ---\nSecond.",
    };
    const messages = buildMessages(char, []);
    const postSystem = [...messages].reverse().find((m) => m.role === "system");
    expect(postSystem?.content).toContain("Type B post-history");
  });

  it("adds NSFW gate when nsfw mode is off", () => {
    localStorageMock["vietrp_nsfw_mode"] = "false";
    const messages = buildMessages(baseChar, []);
    const lastSystem = [...messages].reverse().find((m) => m.role === "system");
    expect(lastSystem?.content).toContain("NSFW");
  });

  it("does not add NSFW gate when nsfw mode is on", () => {
    localStorageMock["vietrp_nsfw_mode"] = "true";
    const messages = buildMessages(baseChar, []);
    const systemMsgs = messages.filter((m) => m.role === "system");
    const hasNsfw = systemMsgs.some((m) => m.content.includes("NSFW"));
    expect(hasNsfw).toBe(false);
  });
});
