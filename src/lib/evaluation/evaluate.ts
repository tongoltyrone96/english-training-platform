import "server-only";
import { GroqSpeechAssessmentProvider } from "./groq-provider";
import { GroqLanguageEvaluationProvider } from "./groq-language-provider";
import { calculateFinalScore, isPassing } from "./score";
import { hasRecognizableSpeech } from "./transcript";

export async function evaluateAnswer(input: { audio: Uint8Array; korean: string; primaryAnswer: string; alternateAnswers: string[]; keywords: string[]; passScore: number }) {
  const started = performance.now();
  const speech = await new GroqSpeechAssessmentProvider().assess(input.audio, input.primaryAnswer);
  if (!hasRecognizableSpeech(speech.transcript)) throw new Error("NO_SPEECH_RECOGNIZED");
  const language = await new GroqLanguageEvaluationProvider().evaluate({ korean: input.korean, referenceAnswers: [input.primaryAnswer, ...input.alternateAnswers], keywords: input.keywords, transcript: speech.transcript });
  const scores = { meaning: language.meaning, pronunciation: speech.pronunciation, grammar: language.grammar, naturalness: language.naturalness, fluency: speech.fluency, completeness: speech.completeness };
  const finalScore = calculateFinalScore(scores);
  return { speech, language, scores, finalScore, passed: isPassing(finalScore, input.passScore), processingMs: Math.round(performance.now() - started) };
}
