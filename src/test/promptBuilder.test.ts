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
  getNsfwGatePrompt: () => "NSFW content is not allowed.",
  getNsfwJailbreakPrompt: () => "NSFW jailbreak prompt injected.",
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

  it("injects triggered entries when keywords match (case-insensitive)", () => {
    const char: CharacterCard = {
      ...baseChar,
      character_book: {
        entries: [
          {
            keys: ["Dragon"],
            content: "Dragons are extinct.",
            enabled: true,
            insertion_order: 0,
            constant: false,
          },
        ],
      },
    };
    const result = buildSystemPrompt(char, "Alice", [
      { role: "user", content: "I see a dragon in the distance." },
    ]);
    expect(result).toContain("Dragons are extinct.");
  });

  it("injects case_sensitive entries when exact case matches", () => {
    const char: CharacterCard = {
      ...baseChar,
      character_book: {
        entries: [
          {
            keys: ["Dragon"],
            content: "Dragons are extinct.",
            enabled: true,
            insertion_order: 0,
            constant: false,
            case_sensitive: true,
          },
        ],
      },
    };
    const result = buildSystemPrompt(char, "Alice", [
      { role: "user", content: "I see a Dragon in the distance." },
    ]);
    expect(result).toContain("Dragons are extinct.");
  });

  it("does NOT inject case_sensitive entries when case does not match", () => {
    const char: CharacterCard = {
      ...baseChar,
      character_book: {
        entries: [
          {
            keys: ["Dragon"],
            content: "Dragons are extinct.",
            enabled: true,
            insertion_order: 0,
            constant: false,
            case_sensitive: true,
          },
        ],
      },
    };
    const result = buildSystemPrompt(char, "Alice", [
      { role: "user", content: "I see a dragon in the distance." },
    ]);
    expect(result).not.toContain("Dragons are extinct.");
  });

  it("injects selective entries when both primary and secondary keys match", () => {
    const char: CharacterCard = {
      ...baseChar,
      character_book: {
        entries: [
          {
            keys: ["magic"],
            content: "Magic requires a catalyst.",
            enabled: true,
            insertion_order: 0,
            constant: false,
            selective: true,
            secondary_keys: ["catalyst"],
          },
        ],
      },
    };
    const result = buildSystemPrompt(char, "Alice", [
      { role: "user", content: "I use magic with a catalyst." },
    ]);
    expect(result).toContain("Magic requires a catalyst.");
  });

  it("does NOT inject selective entries when only primary key matches", () => {
    const char: CharacterCard = {
      ...baseChar,
      character_book: {
        entries: [
          {
            keys: ["magic"],
            content: "Magic requires a catalyst.",
            enabled: true,
            insertion_order: 0,
            constant: false,
            selective: true,
            secondary_keys: ["catalyst"],
          },
        ],
      },
    };
    const result = buildSystemPrompt(char, "Alice", [
      { role: "user", content: "I use magic." },
    ]);
    expect(result).not.toContain("Magic requires a catalyst.");
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
    // User message has anchor appended, so check it starts with "Hi"
    const userMsg = messages.find((m) => m.role === "user");
    expect(userMsg?.content).toContain("Hi");
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
    expect(lastSystem?.content).toContain("NSFW content is not allowed.");
  });

  it("does not add NSFW gate when nsfw mode is on", () => {
    localStorageMock["vietrp_nsfw_mode"] = "true";
    const messages = buildMessages(baseChar, []);
    const systemMsgs = messages.filter((m) => m.role === "system");
    const hasNsfwGate = systemMsgs.some((m) => m.content.includes("NSFW content is not allowed."));
    expect(hasNsfwGate).toBe(false);
  });

  it("injects NSFW jailbreak at Layer 1 when nsfw mode is on", () => {
    localStorageMock["vietrp_nsfw_mode"] = "true";
    const messages = buildMessages(baseChar, []);
    const firstSystem = messages.find((m) => m.role === "system");
    const secondSystem = messages.filter((m) => m.role === "system")[1];
    expect(firstSystem?.content).toContain("Type A system prompt");
    expect(secondSystem?.content).toContain("NSFW jailbreak prompt injected.");
  });

  it("does not inject NSFW jailbreak when nsfw mode is off", () => {
    localStorageMock["vietrp_nsfw_mode"] = "false";
    const messages = buildMessages(baseChar, []);
    const systemMsgs = messages.filter((m) => m.role === "system");
    const hasJailbreak = systemMsgs.some((m) => m.content.includes("NSFW jailbreak prompt injected."));
    expect(hasJailbreak).toBe(false);
  });

  it("appends prefill as last assistant message", () => {
    const prefill = "*nhìn bạn* \"Xin chào...";
    const messages = buildMessages(baseChar, [
      { role: "user", content: "Hello" },
    ], undefined, undefined, undefined, undefined, prefill);
    expect(messages[messages.length - 1].role).toBe("assistant");
    expect(messages[messages.length - 1].content).toBe(prefill);
  });

  it("includes character_identity with macro-replaced fields", () => {
    const char: CharacterCard = {
      ...baseChar,
      description: "{{char}} is a test character for {{user}}.",
    };
    const messages = buildMessages(char, [], "Alice");
    const charSheet = messages.find((m) => m.role === "system" && m.content.includes("<character_identity>"));
    expect(charSheet?.content).toContain("TestChar is a test character for Alice.");
    expect(charSheet?.content).toContain("<relationship_with_user>");
  });

  it("includes MEMORY ARCHIVE when summary and facts provided", () => {
    const messages = buildMessages(baseChar, [], undefined, undefined, "Previous events", ["Fact 1", "Fact 2"]);
    const memory = messages.find((m) => m.role === "system" && m.content.includes("[MEMORY ARCHIVE]"));
    expect(memory?.content).toContain("Previous events");
    expect(memory?.content).toContain("- Fact 1");
    expect(memory?.content).toContain("- Fact 2");
  });

  it("merges post-history into last user message (not a separate system message)", () => {
    const messages = buildMessages(baseChar, [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
      { role: "user", content: "How are you?" },
    ]);
    // The last user message should contain the post-history anchor
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    expect(lastUser?.content).toContain("[System Note:");
    expect(lastUser?.content).toContain("Type A post-history");
    expect(lastUser?.content).toContain("How are you?"); // original content preserved
    // No separate system message at the end (before prefill)
    const lastMsg = messages[messages.length - 1];
    expect(lastMsg.role).not.toBe("system");
  });

  it("falls back to system message when no user messages exist", () => {
    const messages = buildMessages(baseChar, []);
    const lastSystem = [...messages].reverse().find((m) => m.role === "system");
    expect(lastSystem?.content).toContain("Type A post-history");
  });

  it("trims trailing whitespace from prefill", () => {
    const messages = buildMessages(baseChar, [
      { role: "user", content: "Hello" },
    ], undefined, undefined, undefined, undefined, "  *waves* ");
    expect(messages[messages.length - 1].content).toBe("  *waves*");
  });
});
