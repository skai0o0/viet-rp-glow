import { describe, expect, it, vi, beforeEach } from "vitest";
import { hasNsfwContent, isNsfwCharacter, isCharacterNsfw, filterByNsfw } from "@/utils/nsfwFilter";

// Mock localStorage
const localStorageMock: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (k: string) => localStorageMock[k] ?? null,
  setItem: (k: string, v: string) => { localStorageMock[k] = v; },
  removeItem: (k: string) => { delete localStorageMock[k]; },
});

describe("hasNsfwContent", () => {
  it("returns false for empty/null input", () => {
    expect(hasNsfwContent(null, undefined, "")).toBe(false);
  });

  it("detects NSFW substring keywords", () => {
    expect(hasNsfwContent("This is an erotic story")).toBe(true);
    expect(hasNsfwContent("Contains hentai content")).toBe(true);
    expect(hasNsfwContent("Normal text about cooking")).toBe(false);
  });

  it("detects NSFW boundary keywords", () => {
    expect(hasNsfwContent("The word sex appears")).toBe(true);
    expect(hasNsfwContent("Unisex clothing")).toBe(false); // boundary check
  });

  it("detects Vietnamese NSFW keywords", () => {
    expect(hasNsfwContent("Nội dung khiêu dâm")).toBe(true);
    expect(hasNsfwContent("Khỏa thân trong phim")).toBe(true);
  });

  it("checks across multiple text inputs", () => {
    expect(hasNsfwContent("Normal name", "Normal desc", "erotic content")).toBe(true);
    expect(hasNsfwContent("Safe", "Also safe", "Still safe")).toBe(false);
  });
});

describe("isNsfwCharacter", () => {
  it("returns false for empty tags", () => {
    expect(isNsfwCharacter([])).toBe(false);
    expect(isNsfwCharacter(null)).toBe(false);
    expect(isNsfwCharacter(undefined)).toBe(false);
  });

  it("detects NSFW tags", () => {
    expect(isNsfwCharacter(["nsfw"])).toBe(true);
    expect(isNsfwCharacter(["18+"])).toBe(true);
    expect(isNsfwCharacter(["fantasy", "nsfw"])).toBe(true);
  });

  it("is case-insensitive for tags", () => {
    expect(isNsfwCharacter(["NSFW"])).toBe(true);
    expect(isNsfwCharacter(["Nsfw"])).toBe(true);
  });

  it("returns false for safe tags", () => {
    expect(isNsfwCharacter(["fantasy", "adventure"])).toBe(false);
    expect(isNsfwCharacter(["romance"])).toBe(false);
  });
});

describe("isCharacterNsfw", () => {
  it("detects NSFW by tags", () => {
    expect(isCharacterNsfw({ tags: ["nsfw"], name: "Safe", description: "Safe" })).toBe(true);
  });

  it("detects NSFW by content when tags are safe", () => {
    expect(isCharacterNsfw({ tags: ["fantasy"], name: "Erotic Hero", description: "Normal" })).toBe(true);
  });

  it("returns false for completely safe character", () => {
    expect(isCharacterNsfw({ tags: ["fantasy"], name: "Knight", description: "A brave knight" })).toBe(false);
  });
});

describe("filterByNsfw", () => {
  beforeEach(() => {
    localStorageMock["vietrp_nsfw_mode"] = "false";
  });

  const chars = [
    { id: "1", name: "Safe Hero", tags: ["fantasy"], description: "A brave knight" },
    { id: "2", name: "NSFW Char", tags: ["nsfw"], description: "Explicit content" },
    { id: "3", name: "Normal", tags: ["adventure"], description: "An adventure story" },
  ];

  it("filters out NSFW characters when nsfw mode is off", () => {
    const result = filterByNsfw(chars, false);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toEqual(["1", "3"]);
  });

  it("returns all characters when nsfw mode is on", () => {
    const result = filterByNsfw(chars, true);
    expect(result).toHaveLength(3);
  });
});
