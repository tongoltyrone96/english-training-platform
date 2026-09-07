import { describe, expect, it } from "vitest";
import { hasRecognizableSpeech, isLikelySilenceHallucination } from "./transcript";

describe("hasRecognizableSpeech", () => {
  it("rejects empty and punctuation-only Whisper output", () => {
    expect(hasRecognizableSpeech("")).toBe(false);
    expect(hasRecognizableSpeech(". ... !" )).toBe(false);
  });

  it("accepts actual speech text", () => {
    expect(hasRecognizableSpeech("Please review this by Friday.")).toBe(true);
    expect(hasRecognizableSpeech("2026")).toBe(true);
  });

  it("rejects a low-confidence generic hallucination for a long prompt", () => {
    expect(isLikelySilenceHallucination("Thank you.", "As a result deployment time dropped from forty minutes to five minutes.", 0)).toBe(true);
    expect(isLikelySilenceHallucination("Thank you.", "Thank you very much.", 100)).toBe(false);
  });
});
