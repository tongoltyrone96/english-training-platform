import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/authz";
import { dateOnlyUtc, zonedDateParts } from "@/lib/time";

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = randomInt(index + 1);
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

export async function getTrainingDestination() {
  const user = await requireUser();
  const settings = await db.appSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  const today = zonedDateParts(new Date(), settings.timeZone);
  if (today.weekday === "Sun") return "/dashboard?notice=rest-day";

  const localDate = dateOnlyUtc(today.year, today.month, today.day);
  const existing = await db.trainingSession.findUnique({ where: { userId_localDate: { userId: user.id, localDate } } });
  if (existing) return `/training/${existing.id}`;

  const sentences = await db.sentence.findMany({
    where: { active: true, usage: { in: ["TRAINING", "BOTH"] } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  const selected = shuffle(sentences).slice(0, settings.trainingQuestionCount);
  if (selected.length === 0) return "/dashboard?notice=no-sentences";

  try {
    const session = await db.$transaction(async (tx) => {
      const created = await tx.trainingSession.create({
        data: {
          userId: user.id,
          localDate,
          settingsSnapshot: {
            questionCount: selected.length,
            timeLimitSec: settings.trainingTimeLimitSec,
            passScore: settings.trainingPassScore.toString(),
            randomOrder: settings.trainingRandomOrder,
            autoAdvance: settings.trainingAutoAdvance,
          },
          items: { create: selected.map((sentence, position) => ({ sentenceId: sentence.id, position })) },
        },
      });
      await tx.dailyProgress.upsert({
        where: { userId_localDate: { userId: user.id, localDate } },
        create: { userId: user.id, localDate, assignedCount: selected.length },
        update: { assignedCount: selected.length },
      });
      return created;
    });
    return `/training/${session.id}`;
  } catch {
    const raced = await db.trainingSession.findUnique({ where: { userId_localDate: { userId: user.id, localDate } } });
    return raced ? `/training/${raced.id}` : "/dashboard?notice=start-failed";
  }
}
