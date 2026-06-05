import { describe, it, expect } from "vitest";
import { trimToTokens } from "@/lib/cardNormalizer";

describe("trimToTokens", () => {
  it("keeps text untouched if it is within token budget", () => {
    const text = "Hello world. This is a sentence. And another one.";
    // Let's set a very high budget
    expect(trimToTokens(text, 1000)).toBe(text);
  });

  it("truncates at the end of the last complete sentence that fits", () => {
    const text = "First sentence. Second sentence. Third sentence.";
    // Let's set a budget that allows around ~8 tokens.
    // "First sentence." is 3 words, "Second sentence." is 3 words.
    // If the budget fits "First sentence. Second sentence." but not the third:
    // We expect it to return exactly "First sentence. Second sentence."
    const result = trimToTokens(text, 8);
    expect(result).toBe("First sentence. Second sentence.");
  });

  it("falls back to raw truncation + ellipsis if even the first sentence is too long", () => {
    const text = "AnExtremelyLongSentenceWithoutAnyPunctuationThatWillExceedTheBudgetQuiteEasily.";
    // Let's set a very small budget
    const result = trimToTokens(text, 5);
    expect(result.endsWith("...")).toBe(true);
  });

  it("handles newlines and paragraph breaks correctly", () => {
    const text = "Paragraph one.\n\nParagraph two.\nParagraph three.";
    // Budget fits Paragraph 1 and 2, but not 3
    const result = trimToTokens(text, 10);
    expect(result).toBe("Paragraph one.\n\nParagraph two.");
  });
});
