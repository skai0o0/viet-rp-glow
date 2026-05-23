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

  it("includes global admin prompt", () => {
    const result = buildSystemPrompt(baseChar, "Alice");
    expect(result).toContain("Type A system prompt");
  });

  it("uses Type B prompt for multi-character card", () => {
    const char: CharacterCard = {
      ...baseChar,
      description: "--- [NPC1] ---\nFirst NPC.\n--- [NPC2] ---\nSecond NPC.",
    };
    const result = buildSystemPrompt(char, "Alice");
    expect(result).toContain("Type B system prompt");
  });

  it("includes character name, description, personality in prose", () => {
    const result = buildSystemPrompt(baseChar, "Alice");
    expect(result).toContain("TestChar");
    expect(result).toContain("A test character");
    expect(result).toContain("Friendly");
    expect(result).toContain("A test scenario");
  });

  it("injects character.system_prompt", () => {
    const char: CharacterCard = {
      ...baseChar,
      system_prompt: "Custom instruction for this character.",
    };
    const result = buildSystemPrompt(char, "Alice");
    expect(result).toContain("Custom instruction for this character.");
  });

  it("replaces macros in description", () => {
    const char: CharacterCard = {
      ...baseChar,
      description: "{{char}} is a test character for {{user}}.",
    };
    const result = buildSystemPrompt(char, "Alice");
    expect(result).toContain("TestChar is a test character for Alice.");
  });

  it("includes format rules", () => {
    const result = buildSystemPrompt(baseChar, "Alice");
    expect(result).toContain("(Suy nghĩ)");
    expect(result).toContain("*Hành động*");
    expect(result).toContain("\"Lời thoại\"");
  });

  it("includes NSFW instruction when nsfw mode is on", () => {
    localStorageMock["vietrp_nsfw_mode"] = "true";
    const result = buildSystemPrompt(baseChar, "Alice");
    expect(result).toContain("18+");
  });

  it("includes safe content instruction when nsfw mode is off", () => {
    localStorageMock["vietrp_nsfw_mode"] = "false";
    const result = buildSystemPrompt(baseChar, "Alice");
    expect(result).toContain("phù hợp");
  });

  it("does NOT contain XML tags", () => {
    const result = buildSystemPrompt(baseChar, "Alice");
    expect(result).not.toContain("<character_identity>");
    expect(result).not.toContain("<personality_traits>");
    expect(result).not.toContain("<current_scenario>");
    expect(result).not.toContain("<relationship_with_user>");
  });

  it("does NOT contain section headers", () => {
    const result = buildSystemPrompt(baseChar, "Alice");
    expect(result).not.toContain("--- CHARACTER DESCRIPTION ---");
    expect(result).not.toContain("--- PERSONALITY ---");
    expect(result).not.toContain("--- SCENARIO ---");
  });

  it("includes lorebook entries when keywords match", () => {
    const char: CharacterCard = {
      ...baseChar,
      character_book: {
        entries: [
          {
            keys: ["magic"],
            content: "Magic is powered by crystals.",
            enabled: true,
            insertion_order: 0,
            constant: false,
          },
        ],
      },
    };
    const result = buildSystemPrompt(char, "Alice", [
      { role: "user", content: "I use magic." },
    ]);
    expect(result).toContain("Magic is powered by crystals.");
  });

  it("skips disabled lorebook entries", () => {
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

  it("includes NPC info when activeNPCs provided", () => {
    const result = buildSystemPrompt(baseChar, "Alice", [], undefined, undefined, [
      { name: "Michael Jackson", description: "Vua nhạc pop" },
    ]);
    expect(result).toContain("Michael Jackson");
    expect(result).toContain("Vua nhạc pop");
  });

  it("includes memory summary and facts", () => {
    const result = buildSystemPrompt(baseChar, "Alice", [], "Previous events", ["Fact 1", "Fact 2"]);
    expect(result).toContain("Previous events");
    expect(result).toContain("Fact 1");
    expect(result).toContain("Fact 2");
  });

  it("replaces {{user}} and {{char}} in mes_example", () => {
    const char: CharacterCard = {
      ...baseChar,
      mes_example: "{{user}}: Hi\n{{char}}: Hello!",
    };
    const result = buildSystemPrompt(char, "Alice");
    expect(result).toContain("Alice: Hi");
    expect(result).toContain("TestChar: Hello!");
    expect(result).not.toContain("{{user}}");
    expect(result).not.toContain("{{char}}");
  });
});

describe("buildMessages", () => {
  beforeEach(() => {
    localStorageMock["vietrp_nsfw_mode"] = "false";
  });

  it("has exactly 1 system message at position [0]", () => {
    const messages = buildMessages(baseChar, [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello!" },
    ]);
    const systemMsgs = messages.filter((m) => m.role === "system");
    expect(systemMsgs).toHaveLength(1);
    expect(messages[0].role).toBe("system");
  });

  it("system message contains global prompt + character info", () => {
    const messages = buildMessages(baseChar, []);
    const sys = messages[0].content;
    expect(sys).toContain("Type A system prompt");
    expect(sys).toContain("TestChar");
    expect(sys).toContain("A test character");
  });

  it("persona trick: [1] = user '[Bắt đầu roleplay]', [2] = assistant first_mes", () => {
    const messages = buildMessages(baseChar, []);
    expect(messages[1]).toEqual({ role: "user", content: "[Bắt đầu roleplay]" });
    expect(messages[2]).toEqual({ role: "assistant", content: "Hello!" });
  });

  it("skips first_mes from history to avoid duplication", () => {
    const messages = buildMessages(baseChar, [
      { role: "assistant", content: "Hello!" },
      { role: "user", content: "Hi" },
    ]);
    // first_mes "Hello!" should appear only once (at [2])
    const helloCount = messages.filter((m) => m.content === "Hello!").length;
    expect(helloCount).toBe(1);
    // "Hi" should still be present
    expect(messages.some((m) => m.content === "Hi")).toBe(true);
  });

  it("adds history as-is when first_mes not in history", () => {
    const messages = buildMessages(baseChar, [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hey!" },
    ]);
    expect(messages.some((m) => m.content === "Hi")).toBe(true);
    expect(messages.some((m) => m.content === "Hey!")).toBe(true);
  });

  it("does NOT inject [System Note] into user messages", () => {
    const messages = buildMessages(baseChar, [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
      { role: "user", content: "How are you?" },
    ]);
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    expect(lastUser?.content).not.toContain("[System Note:");
    expect(lastUser?.content).toBe("How are you?");
  });

  it("does NOT inject NSFW jailbreak as separate message", () => {
    localStorageMock["vietrp_nsfw_mode"] = "true";
    const messages = buildMessages(baseChar, []);
    const systemMsgs = messages.filter((m) => m.role === "system");
    expect(systemMsgs).toHaveLength(1);
    expect(systemMsgs[0].content).not.toContain("NSFW jailbreak prompt injected.");
  });

  it("does NOT use XML tags in any message", () => {
    const messages = buildMessages(baseChar, []);
    for (const msg of messages) {
      expect(msg.content).not.toContain("<character_identity>");
      expect(msg.content).not.toContain("<personality_traits>");
      expect(msg.content).not.toContain("<active_npcs>");
      expect(msg.content).not.toContain("<user_persona>");
    }
  });

  it("appends prefill as last assistant message", () => {
    const prefill = "*nhìn bạn* \"Xin chào...";
    const messages = buildMessages(baseChar, [
      { role: "user", content: "Hello" },
    ], undefined, undefined, undefined, undefined, prefill);
    expect(messages[messages.length - 1].role).toBe("assistant");
    expect(messages[messages.length - 1].content).toBe(prefill);
  });

  it("trims trailing whitespace from prefill", () => {
    const messages = buildMessages(baseChar, [
      { role: "user", content: "Hello" },
    ], undefined, undefined, undefined, undefined, "  *waves* ");
    expect(messages[messages.length - 1].content).toBe("  *waves*");
  });

  it("uses Type B prompt when activeNPCs provided", () => {
    const messages = buildMessages(baseChar, [], undefined, undefined, undefined, undefined, undefined, [
      { name: "Michael Jackson" },
    ]);
    expect(messages[0].content).toContain("Type B system prompt");
  });

  it("uses Type A prompt when no activeNPCs", () => {
    const messages = buildMessages(baseChar, [], undefined, undefined, undefined, undefined, undefined, []);
    expect(messages[0].content).toContain("Type A system prompt");
  });

  it("includes NPC info in system prompt when activeNPCs provided", () => {
    const messages = buildMessages(baseChar, [], undefined, undefined, undefined, undefined, undefined, [
      { name: "Michael Jackson", description: "Vua nhạc pop" },
    ]);
    expect(messages[0].content).toContain("Michael Jackson");
    expect(messages[0].content).toContain("Vua nhạc pop");
  });

  it("includes memory in system prompt", () => {
    const messages = buildMessages(baseChar, [], undefined, undefined, "Previous events", ["Fact 1"]);
    expect(messages[0].content).toContain("Previous events");
    expect(messages[0].content).toContain("Fact 1");
  });

  it("adds cache_control only for Anthropic models", () => {
    const messages = buildMessages(baseChar, [], undefined, undefined, undefined, undefined, undefined, undefined, undefined, "anthropic/claude-sonnet");
    expect(messages[0].cache_control).toEqual({ type: "ephemeral" });
  });

  it("does NOT add cache_control for non-Anthropic models", () => {
    const messages = buildMessages(baseChar, [], undefined, undefined, undefined, undefined, undefined, undefined, undefined, "google/gemini-2.5-flash");
    expect(messages[0].cache_control).toBeUndefined();
  });

  // ── Placeholder replacement ──

  it("replaces {{user}} and {{char}} in first_mes", () => {
    const char: CharacterCard = {
      ...baseChar,
      first_mes: "*{{char}} nhìn {{user}}* \"Xin chào {{user}}!\"",
    };
    const messages = buildMessages(char, [], "Alice");
    const firstMes = messages[2];
    expect(firstMes.content).toContain("TestChar");
    expect(firstMes.content).toContain("Alice");
    expect(firstMes.content).not.toContain("{{char}}");
    expect(firstMes.content).not.toContain("{{user}}");
  });

  // ── Reminder injection ──

  it("injects reminder when history length > 6", () => {
    const history = Array.from({ length: 8 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `Message ${i}`,
    }));
    const messages = buildMessages(baseChar, history);
    const systemMsgs = messages.filter((m) => m.role === "system");
    expect(systemMsgs.length).toBeGreaterThanOrEqual(2);
    const reminder = systemMsgs.find((m) => m.content.includes("Nhớ: mày là TestChar"));
    expect(reminder).toBeTruthy();
    expect(reminder!.content).toContain("Format:");
    expect(reminder!.content).toContain("Không nói thay người chơi");
  });

  it("does NOT inject reminder when history length <= 6", () => {
    const history = Array.from({ length: 4 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `Message ${i}`,
    }));
    const messages = buildMessages(baseChar, history);
    const systemMsgs = messages.filter((m) => m.role === "system");
    expect(systemMsgs).toHaveLength(1); // only the main system prompt
  });

  it("reminder includes personality line when available", () => {
    const history = Array.from({ length: 8 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `Message ${i}`,
    }));
    const messages = buildMessages(baseChar, history);
    const reminder = messages.find((m) => m.role === "system" && m.content.includes("Nhớ:"));
    expect(reminder!.content).toContain("Friendly");
  });

  // ── Final message order verification ──

  it("message order: [0] system, [1] user, [2] assistant, [3+] history, reminder, last user", () => {
    // 7 messages: user, asst, user, asst, user, asst, user (last = current user msg)
    const history = Array.from({ length: 7 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `Msg ${i}`,
    }));
    const messages = buildMessages(baseChar, history);
    expect(messages[0].role).toBe("system");
    expect(messages[1]).toEqual({ role: "user", content: "[Bắt đầu roleplay]" });
    expect(messages[2].role).toBe("assistant");
    expect(messages[2].content).toBe("Hello!");
    // Reminder should be a system message somewhere after history
    const reminderIdx = messages.findIndex((m) => m.role === "system" && m.content.includes("Nhớ:"));
    expect(reminderIdx).toBeGreaterThan(2);
    // Last message should be the current user message
    const lastMsg = messages[messages.length - 1];
    expect(lastMsg.role).toBe("user");
    expect(lastMsg.content).toBe("Msg 6");
  });
});
