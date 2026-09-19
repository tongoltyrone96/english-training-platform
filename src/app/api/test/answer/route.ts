import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { calculateFinalScore } from "@/lib/evaluation/score";
import { evaluateAnswer } from "@/lib/evaluation/evaluate";
import { consumeRateLimit } from "@/lib/rate-limit";

const fieldsSchema = z.object({ attemptId: z.string().cuid(), questionId: z.string().cuid(), position: z.coerce.number().int().min(0), idempotencyKey: z.string().uuid() });
const allowedAudioTypes = ["audio/webm", "audio/ogg", "audio/mp4", "audio/wav"];
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await getActiveUser(); if (!user) return NextResponse.json({ error: "You need to sign in." }, { status: 401 });
  if (!(await consumeRateLimit("test-evaluation", user.id, 12, 60_000))) return NextResponse.json({ error: "Too many evaluation requests. Please try again shortly." }, { status: 429 });
  const form = await request.formData(); const fields = fieldsSchema.safeParse(Object.fromEntries(form)); const audio = form.get("audio");
  if (!fields.success || !(audio instanceof File)) return NextResponse.json({ error: "The submission request is invalid." }, { status: 400 });
  if (audio.size < 200 || audio.size > 10 * 1024 * 1024 || !allowedAudioTypes.some((type) => audio.type.startsWith(type))) return NextResponse.json({ error: "The audio is empty or in an unsupported format." }, { status: 415 });
  const prior = await db.examAnswer.findUnique({ where: { idempotencyKey: fields.data.idempotencyKey }, include: { examAttempt: true } });
  if (prior) return prior.examAttempt.userId === user.id ? NextResponse.json({ completed: prior.examAttempt.status === "COMPLETED" }) : NextResponse.json({ error: "You cannot access this." }, { status: 403 });
  const attempt = await db.examAttempt.findFirst({ where: { id: fields.data.attemptId, userId: user.id, status: "IN_PROGRESS" }, include: { exam: true, answers: { where: { evaluation: { isNot: null } }, select: { position: true } } } });
  const currentPosition = attempt?.answers.length ?? -1;
  if (!attempt || fields.data.position !== currentPosition || attempt.questionOrder[currentPosition] !== fields.data.questionId) return NextResponse.json({ error: "This does not match the current test question." }, { status: 409 });
  const question = await db.examQuestion.findFirst({ where: { id: fields.data.questionId, examId: attempt.examId }, include: { sentence: true } });
  if (!question) return NextResponse.json({ error: "The test question could not be found." }, { status: 404 });
  const failedAnswer = await db.examAnswer.findFirst({ where: { examAttemptId: attempt.id, position: currentPosition, status: "ERROR" } });
  const answer = failedAnswer ? await db.examAnswer.update({ where: { id: failedAnswer.id }, data: { idempotencyKey: fields.data.idempotencyKey, status: "EVALUATING", errorCode: null } }) : await db.examAnswer.create({ data: { examAttemptId: attempt.id, examQuestionId: question.id, position: currentPosition, idempotencyKey: fields.data.idempotencyKey, status: "EVALUATING" } });
  const isMock = process.env.EVALUATION_MODE === "mock"; let evaluation;
  try {
    const audioBytes = new Uint8Array(await audio.arrayBuffer());
    if (isMock) { const scores = { meaning: 92, pronunciation: 92, grammar: 92, naturalness: 92, fluency: 92, completeness: 92 }; const finalScore = calculateFinalScore(scores); evaluation = { scores, finalScore, passed: finalScore >= Number(attempt.exam.passScore), transcript: "[development mock transcript]", correctedAnswer: question.sentence.primaryAnswer, feedbackKo: "This is a development mock evaluation.", missingMeanings: [] as string[], detectedIssues: [] as string[], speechDetails: { words: [] }, promptVersion: "mock-v1", speechProviderVersion: "mock-v1", languageModelVersion: "mock-v1", processingMs: 0 }; }
    else { const result = await evaluateAnswer({ audio: audioBytes, korean: question.sentence.korean, primaryAnswer: question.sentence.primaryAnswer, alternateAnswers: question.sentence.alternateAnswers, keywords: question.sentence.keywords, passScore: Number(attempt.exam.passScore) }); evaluation = { scores: result.scores, finalScore: result.finalScore, passed: result.passed, transcript: result.speech.transcript, correctedAnswer: result.language.correctedAnswer, feedbackKo: result.language.feedbackKo, missingMeanings: result.language.missingMeanings, detectedIssues: result.language.detectedIssues, speechDetails: { prosody: result.speech.prosody, words: result.speech.words }, promptVersion: result.language.promptVersion, speechProviderVersion: result.speech.providerVersion, languageModelVersion: result.language.modelVersion, processingMs: result.processingMs }; }
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 80) : "EVALUATION_FAILED"; await db.examAnswer.update({ where: { id: answer.id }, data: { status: "ERROR", errorCode: code } });
    return NextResponse.json({ error: code.includes("RECOGNITION") || code.includes("NO_SPEECH") ? "We could not recognise any speech. Please record again." : "The evaluation service did not respond. Please try again." }, { status: 502 });
  }
  const completed = currentPosition + 1 >= attempt.questionOrder.length;
  await db.$transaction(async (tx) => {
    await tx.evaluationResult.create({ data: { examAnswerId: answer.id, transcript: evaluation.transcript, meaningScore: evaluation.scores.meaning, pronunciationScore: evaluation.scores.pronunciation, grammarScore: evaluation.scores.grammar, naturalnessScore: evaluation.scores.naturalness, fluencyScore: evaluation.scores.fluency, completenessScore: evaluation.scores.completeness, finalScore: evaluation.finalScore, passed: evaluation.passed, correctedAnswer: evaluation.correctedAnswer, feedbackKo: evaluation.feedbackKo, missingMeanings: evaluation.missingMeanings, detectedIssues: evaluation.detectedIssues, speechDetails: evaluation.speechDetails, sentenceSnapshot: { korean: question.sentence.korean, primaryAnswer: question.sentence.primaryAnswer, alternateAnswers: question.sentence.alternateAnswers, keywords: question.sentence.keywords }, settingsSnapshot: { timeLimitSec: attempt.exam.timeLimitSec, passScore: attempt.exam.passScore.toString(), weekKey: attempt.weekKey }, promptVersion: evaluation.promptVersion, speechProviderVersion: evaluation.speechProviderVersion, languageModelVersion: evaluation.languageModelVersion, processingMs: evaluation.processingMs } });
    await tx.examAnswer.update({ where: { id: answer.id }, data: { status: evaluation.passed ? "PASSED" : "RETRY_REQUIRED" } });
    if (completed) { const results = await tx.evaluationResult.findMany({ where: { examAnswer: { examAttemptId: attempt.id } }, select: { finalScore: true } }); const average = Math.round(results.reduce((sum, result) => sum + Number(result.finalScore), 0) / results.length * 100) / 100; await tx.examAttempt.update({ where: { id: attempt.id }, data: { status: "COMPLETED", completedAt: new Date(), finalScore: average, passed: average >= Number(attempt.exam.passScore) } }); }
  });
  return NextResponse.json({ completed });
}
