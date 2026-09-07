import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getActiveUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { calculateFinalScore } from "@/lib/evaluation/score";
import { evaluateAnswer } from "@/lib/evaluation/evaluate";
import { consumeRateLimit } from "@/lib/rate-limit";

const fieldsSchema = z.object({ sessionId: z.string().cuid(), itemId: z.string().cuid(), idempotencyKey: z.string().uuid(), durationMs: z.coerce.number().int().min(0).max(300_000).optional(), rms: z.coerce.number().nonnegative().finite().optional(), peak: z.coerce.number().nonnegative().finite().optional(), voicedMs: z.coerce.number().int().min(0).max(300_000).optional(), sampleRate: z.coerce.number().int().min(8_000).max(192_000).optional() });
const allowedAudioTypes = ["audio/webm", "audio/ogg", "audio/mp4", "audio/wav"];
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await getActiveUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!(await consumeRateLimit("training-evaluation", user.id, 12, 60_000))) return NextResponse.json({ error: "평가 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  const form = await request.formData();
  const fields = fieldsSchema.safeParse(Object.fromEntries(form));
  const audio = form.get("audio");
  if (!fields.success || !(audio instanceof File)) return NextResponse.json({ error: "잘못된 제출 요청입니다." }, { status: 400 });
  if (audio.size < 200) return NextResponse.json({ error: "No audio was captured. Hold the button while speaking, then release it." }, { status: 415 });
  if (audio.size > 10 * 1024 * 1024 || !allowedAudioTypes.some((type) => audio.type.startsWith(type))) return NextResponse.json({ error: "This browser's audio format is not supported." }, { status: 415 });
  const diagnosticsComplete = fields.data.durationMs !== undefined && fields.data.voicedMs !== undefined && fields.data.rms !== undefined && fields.data.peak !== undefined;
  if (diagnosticsComplete && (fields.data.durationMs! < 500 || fields.data.voicedMs! < 250 || fields.data.rms! < 0.0015 || fields.data.peak! < 0.015)) return NextResponse.json({ error: "No clear voice reached the microphone. Check the input level and try again." }, { status: 415 });

  const prior = await db.trainingAttempt.findUnique({ where: { idempotencyKey: fields.data.idempotencyKey }, include: { evaluation: true } });
  if (prior) {
    if (prior.userId !== user.id) return NextResponse.json({ error: "접근할 수 없습니다." }, { status: 403 });
    return NextResponse.json(prior.evaluation ? { transcript: prior.evaluation.transcript, finalScore: Number(prior.evaluation.finalScore), passed: prior.evaluation.passed, feedbackKo: prior.evaluation.feedbackKo, mock: prior.evaluation.languageModelVersion === "mock-v1" } : { error: "평가가 완료되지 않았습니다." }, { status: prior.evaluation ? 200 : 409 });
  }

  const item = await db.trainingSessionItem.findFirst({ where: { id: fields.data.itemId, sessionId: fields.data.sessionId, passedAt: null, session: { userId: user.id, status: "ACTIVE" } }, include: { session: { include: { _count: { select: { items: true } } } }, sentence: true } });
  if (!item || item.position !== item.session.currentPosition) return NextResponse.json({ error: "현재 풀 수 있는 문제가 아닙니다." }, { status: 409 });

  const attempt = await db.trainingAttempt.create({ data: { userId: user.id, sessionItemId: item.id, idempotencyKey: fields.data.idempotencyKey, status: "EVALUATING", startedAt: new Date() } });
  const settings = item.session.settingsSnapshot as { passScore?: string };
  const isMock = process.env.EVALUATION_MODE === "mock";
  let evaluation;
  try {
    const audioBytes = new Uint8Array(await audio.arrayBuffer());
    if (isMock) {
      const scores = { meaning: 92, pronunciation: 92, grammar: 92, naturalness: 92, fluency: 92, completeness: 92 };
      const finalScore = calculateFinalScore(scores);
      evaluation = { scores, finalScore, passed: finalScore >= Number(settings.passScore ?? 4.5), transcript: "[개발용 mock transcript]", correctedAnswer: item.sentence.primaryAnswer, feedbackKo: "개발용 mock 평가입니다. 실제 발음 또는 의미 평가 결과가 아닙니다.", missingMeanings: [] as string[], detectedIssues: [] as string[], speechDetails: { words: [] }, promptVersion: "mock-v1", speechProviderVersion: "mock-v1", languageModelVersion: "mock-v1", processingMs: 0 };
    } else {
      const result = await evaluateAnswer({ audio: audioBytes, korean: item.sentence.korean, primaryAnswer: item.sentence.primaryAnswer, alternateAnswers: item.sentence.alternateAnswers, keywords: item.sentence.keywords, passScore: Number(settings.passScore ?? 4.5) });
      evaluation = { scores: result.scores, finalScore: result.finalScore, passed: result.passed, transcript: result.speech.transcript, correctedAnswer: result.language.correctedAnswer, feedbackKo: result.language.feedbackKo, missingMeanings: result.language.missingMeanings, detectedIssues: result.language.detectedIssues, speechDetails: { prosody: result.speech.prosody, words: result.speech.words, capture: { durationMs: fields.data.durationMs ?? null, rms: fields.data.rms ?? null, peak: fields.data.peak ?? null, voicedMs: fields.data.voicedMs ?? null, sampleRate: fields.data.sampleRate ?? null, bytes: audio.size, mimeType: audio.type } }, promptVersion: result.language.promptVersion, speechProviderVersion: result.speech.providerVersion, languageModelVersion: result.language.modelVersion, processingMs: result.processingMs };
    }
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 80) : "EVALUATION_FAILED";
    await db.trainingAttempt.update({ where: { id: attempt.id }, data: { status: "ERROR", errorCode: code } });
    const userMessage = code.includes("NOT_CONFIGURED") ? "Groq 음성 인식 설정이 필요합니다." : code.includes("TRANSCODE") ? "녹음 파일을 처리할 수 없습니다. 다시 녹음해 주세요." : code.includes("RECOGNITION") || code.includes("NO_SPEECH") ? "음성을 인식하지 못했습니다. 조용한 곳에서 다시 말해 주세요." : "평가 서비스가 응답하지 않았습니다. 잠시 후 다시 시도해 주세요.";
    return NextResponse.json({ error: userMessage }, { status: 502 });
  }

  const isLast = item.position + 1 >= item.session._count.items;
  await db.$transaction(async (tx) => {
    await tx.evaluationResult.create({ data: { trainingAttemptId: attempt.id, transcript: evaluation.transcript, meaningScore: evaluation.scores.meaning, pronunciationScore: evaluation.scores.pronunciation, grammarScore: evaluation.scores.grammar, naturalnessScore: evaluation.scores.naturalness, fluencyScore: evaluation.scores.fluency, completenessScore: evaluation.scores.completeness, finalScore: evaluation.finalScore, passed: evaluation.passed, correctedAnswer: evaluation.correctedAnswer, feedbackKo: evaluation.feedbackKo, missingMeanings: evaluation.missingMeanings, detectedIssues: evaluation.detectedIssues, speechDetails: evaluation.speechDetails, sentenceSnapshot: { korean: item.sentence.korean, primaryAnswer: item.sentence.primaryAnswer, alternateAnswers: item.sentence.alternateAnswers, keywords: item.sentence.keywords }, settingsSnapshot: item.session.settingsSnapshot as Prisma.InputJsonValue, promptVersion: evaluation.promptVersion, speechProviderVersion: evaluation.speechProviderVersion, languageModelVersion: evaluation.languageModelVersion, processingMs: evaluation.processingMs } });
    await tx.trainingAttempt.update({ where: { id: attempt.id }, data: { status: evaluation.passed ? "PASSED" : "RETRY_REQUIRED" } });
    if (evaluation.passed) {
      await tx.trainingSessionItem.update({ where: { id: item.id }, data: { passedAt: new Date() } });
      await tx.trainingSession.update({ where: { id: item.sessionId }, data: { currentPosition: { increment: 1 }, ...(isLast ? { status: "COMPLETED", completedAt: new Date() } : {}) } });
      await tx.dailyProgress.update({ where: { userId_localDate: { userId: user.id, localDate: item.session.localDate } }, data: { passedCount: { increment: 1 }, ...(isLast ? { goalAchieved: true, achievedAt: new Date() } : {}) } });
    }
  });
  return NextResponse.json({ transcript: evaluation.transcript, finalScore: evaluation.finalScore, passed: evaluation.passed, feedbackKo: evaluation.feedbackKo, scores: evaluation.scores, missingMeanings: evaluation.missingMeanings, detectedIssues: evaluation.detectedIssues, speechProviderVersion: evaluation.speechProviderVersion, mock: isMock });
}
