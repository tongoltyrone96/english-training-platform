"use server";

import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/authz";
import { isoWeekKey, zonedDateParts } from "@/lib/time";
import { getTrainingDestination } from "@/lib/start-training";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type SciTechRatingState = { ok?: string; error?: string };

export async function submitSciTechRatingAction(_: SciTechRatingState, formData: FormData): Promise<SciTechRatingState> {
  const user = await requireUser();
  const parsed = z.object({ presentationId: z.string().cuid(), score: z.coerce.number().min(0).max(5).multipleOf(0.1) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a score between 0 and 5 in 0.1 increments." };
  const settings = await db.appSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  const now = zonedDateParts(new Date(), settings.timeZone);
  const today = new Date(Date.UTC(now.year, now.month - 1, now.day));
  const presentation = await db.sciTechPresentation.findUnique({ where: { id: parsed.data.presentationId }, select: { id: true, presenterId: true, localDate: true, eligibleEvaluatorCount: true, ratings: { where: { evaluatorId: user.id }, select: { id: true } } } });
  if (!presentation || presentation.localDate.getTime() !== today.getTime()) return { error: "This assessment is not available today." };
  if (presentation.presenterId === user.id) return { error: "Presenters cannot rate their own presentation." };
  if (presentation.ratings.length) return { error: "Your score has already been submitted and cannot be changed." };
  try {
    const eligibleEvaluatorCount = presentation.eligibleEvaluatorCount ?? Math.max((await db.user.count({ where: { status: "ACTIVE" } })) - 1, 0);
    await db.$transaction(async (tx) => {
      if (presentation.eligibleEvaluatorCount === null) await tx.sciTechPresentation.update({ where: { id: presentation.id }, data: { eligibleEvaluatorCount } });
      await tx.sciTechRating.create({ data: { presentationId: presentation.id, evaluatorId: user.id, score: parsed.data.score } });
    });
  }
  catch { return { error: "Your score has already been submitted and cannot be changed." }; }
  revalidatePath("/dashboard");
  return { ok: "Your score has been submitted." };
}

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) { const swap = randomInt(index + 1); [result[index], result[swap]] = [result[swap], result[index]]; }
  return result;
}

export async function startTrainingAction() {
  redirect(await getTrainingDestination());
}

export async function startExamAction() {
  const user = await requireUser();
  const settings = await db.appSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  const now = new Date();
  if (zonedDateParts(now, settings.timeZone).weekday !== "Sat") redirect("/dashboard?notice=test-saturday-only");
  const exam = await db.exam.findFirst({ where: { active: true }, include: { questions: { orderBy: { position: "asc" } } } });
  if (!exam || exam.questions.length !== exam.questionCount) redirect("/dashboard?notice=no-active-exam");
  const weekKey = isoWeekKey(now, settings.timeZone);
  const prior = await db.examAttempt.findUnique({ where: { userId_examId_weekKey: { userId: user.id, examId: exam.id, weekKey } } });
  if (prior) redirect(`/test/${prior.id}`);
  try {
    const attempt = await db.examAttempt.create({ data: { userId: user.id, examId: exam.id, weekKey, questionOrder: shuffle(exam.questions.map((question) => question.id)) } });
    redirect(`/test/${attempt.id}`);
  } catch {
    const raced = await db.examAttempt.findUnique({ where: { userId_examId_weekKey: { userId: user.id, examId: exam.id, weekKey } } });
    if (raced) redirect(`/test/${raced.id}`);
    redirect("/dashboard?notice=test-start-failed");
  }
}
