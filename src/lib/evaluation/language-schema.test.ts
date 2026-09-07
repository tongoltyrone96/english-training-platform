import { describe, expect, it } from "vitest";
import { languageEvaluationSchema } from "./language-schema";

describe("language evaluation schema", () => {
  const valid = { meaningScore: 96, grammarScore: 94, naturalnessScore: 91, correctedAnswer: "I wake up early.", feedbackKo: "정확합니다.", missingMeanings: [], detectedIssues: [] };
  it("accepts the bounded contract", () => expect(languageEvaluationSchema.safeParse(valid).success).toBe(true));
  it("rejects out-of-range and extra output", () => expect(languageEvaluationSchema.safeParse({ ...valid, meaningScore: 101, finalScore: 5 }).success).toBe(false));
});
