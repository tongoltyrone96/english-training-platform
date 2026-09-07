import "server-only";
import { z } from "zod";
import { languageEvaluationJsonSchema, languageEvaluationSchema } from "./language-schema";
import type { LanguageEvaluation, LanguageEvaluationProvider } from "./providers";

export const LANGUAGE_PROMPT_VERSION = "language-rubric-v1";
const SYSTEM_PROMPT = `You evaluate an English learner's spoken answer to a Korean prompt.
Score meaning accuracy, grammar, and naturalness independently from 0 to 100.
Accept semantically equivalent wording; never require literal string matching.
Meaning dominates: penalize missing facts, reversed polarity, wrong subject/object, tense that changes meaning, or non-English output.
Minor grammar mistakes should not erase correct meaning. Keep Korean feedback concise, specific, and encouraging.
Return only the fields required by the supplied schema.`;

const responseSchema = z.object({
  model: z.string(),
  choices: z.array(z.object({
    message: z.object({ content: z.string().nullable() }),
  })).min(1),
});

export class GroqLanguageEvaluationProvider implements LanguageEvaluationProvider {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(options: { apiKey?: string; model?: string } = {}) {
    const apiKey = options.apiKey ?? process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_NOT_CONFIGURED");
    this.apiKey = apiKey;
    this.model = options.model ?? process.env.GROQ_LANGUAGE_MODEL ?? "openai/gpt-oss-20b";
  }

  async evaluate(input: { korean: string; referenceAnswers: string[]; keywords: string[]; transcript: string }): Promise<LanguageEvaluation> {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(input) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "language_evaluation",
            strict: true,
            schema: languageEvaluationJsonSchema,
          },
        },
        reasoning_effort: "low",
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`GROQ_LANGUAGE_HTTP_${response.status}`);

    const envelope = responseSchema.safeParse(await response.json());
    if (!envelope.success) throw new Error("GROQ_LANGUAGE_RESPONSE_MISMATCH");
    const content = envelope.data.choices[0]?.message.content;
    if (!content) throw new Error("GROQ_LANGUAGE_EMPTY_RESPONSE");

    let json: unknown;
    try { json = JSON.parse(content); } catch { throw new Error("GROQ_LANGUAGE_INVALID_JSON"); }
    const parsed = languageEvaluationSchema.safeParse(json);
    if (!parsed.success) throw new Error("GROQ_LANGUAGE_SCHEMA_MISMATCH");

    return {
      meaning: parsed.data.meaningScore,
      grammar: parsed.data.grammarScore,
      naturalness: parsed.data.naturalnessScore,
      correctedAnswer: parsed.data.correctedAnswer,
      feedbackKo: parsed.data.feedbackKo,
      missingMeanings: parsed.data.missingMeanings,
      detectedIssues: parsed.data.detectedIssues,
      modelVersion: `groq:${envelope.data.model}`,
      promptVersion: LANGUAGE_PROMPT_VERSION,
    };
  }
}
