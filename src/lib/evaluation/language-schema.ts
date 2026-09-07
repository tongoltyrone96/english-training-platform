import { z } from "zod";

export const languageEvaluationSchema = z.object({
  meaningScore: z.number().min(0).max(100),
  grammarScore: z.number().min(0).max(100),
  naturalnessScore: z.number().min(0).max(100),
  correctedAnswer: z.string().max(1000),
  feedbackKo: z.string().min(1).max(1500),
  missingMeanings: z.array(z.string().max(200)).max(20),
  detectedIssues: z.array(z.string().max(200)).max(20),
}).strict();

export const languageEvaluationJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    meaningScore: { type: "number", minimum: 0, maximum: 100 },
    grammarScore: { type: "number", minimum: 0, maximum: 100 },
    naturalnessScore: { type: "number", minimum: 0, maximum: 100 },
    correctedAnswer: { type: "string" },
    feedbackKo: { type: "string" },
    missingMeanings: { type: "array", items: { type: "string" } },
    detectedIssues: { type: "array", items: { type: "string" } },
  },
  required: ["meaningScore", "grammarScore", "naturalnessScore", "correctedAnswer", "feedbackKo", "missingMeanings", "detectedIssues"],
} as const;
