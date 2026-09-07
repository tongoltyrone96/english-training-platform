import { z } from "zod";

export const componentScoresSchema = z.object({
  meaning: z.number().min(0).max(100),
  pronunciation: z.number().min(0).max(100),
  grammar: z.number().min(0).max(100),
  naturalness: z.number().min(0).max(100),
  fluency: z.number().min(0).max(100),
  completeness: z.number().min(0).max(100),
});

export type ComponentScores = z.infer<typeof componentScoresSchema>;

const weights: Record<keyof ComponentScores, number> = {
  meaning: 0.35,
  pronunciation: 0.25,
  grammar: 0.15,
  naturalness: 0.1,
  fluency: 0.1,
  completeness: 0.05,
};

export function calculateFinalScore(input: ComponentScores): number {
  const scores = componentScoresSchema.parse(input);
  const weighted100 = Object.entries(weights).reduce(
    (total, [key, weight]) => total + scores[key as keyof ComponentScores] * weight,
    0,
  );
  return Math.round((weighted100 / 20) * 100) / 100;
}

export function isPassing(score: number, threshold = 4.5): boolean {
  return score >= threshold;
}
