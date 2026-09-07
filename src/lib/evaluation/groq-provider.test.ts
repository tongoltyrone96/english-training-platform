import { describe, expect, it } from "vitest";
import { scoreGroqTranscript } from "./groq-score";

describe("scoreGroqTranscript", () => {
  it("awards high proxy scores to an accurate, fluent transcript", () => {
    const words = [
      { word: "please", start: 0, end: 0.3 }, { word: "share", start: 0.35, end: 0.65 },
      { word: "the", start: 0.7, end: 0.85 }, { word: "current", start: 0.9, end: 1.2 },
      { word: "progress", start: 1.25, end: 1.65 },
    ];
    const result = scoreGroqTranscript("Please share the current progress.", "Please share the current progress.", words, -0.05);
    expect(result.pronunciation).toBeGreaterThan(95);
    expect(result.completeness).toBe(100);
    expect(result.fluency).toBeGreaterThan(90);
  });

  it("penalizes missing words", () => {
    const result = scoreGroqTranscript("Please share the current progress.", "Share progress.", [], -0.7);
    expect(result.completeness).toBeLessThan(50);
    expect(result.pronunciation).toBeLessThan(70);
  });
});
