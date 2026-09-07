import { db } from "@/lib/db";
import { buildLeaderboard } from "./leaderboard";
import { isoWeekDateBounds, isoWeekKey, zonedDateParts } from "@/lib/time";

export async function getWeeklyTeamStats(date: Date, timeZone: string) {
  const bounds = isoWeekDateBounds(date, timeZone); const weekKey = isoWeekKey(date, timeZone);
  const previousDate = new Date(date); previousDate.setUTCDate(previousDate.getUTCDate() - 7); const previousBounds = isoWeekDateBounds(previousDate, timeZone);
  const [users, progress, evaluations, exams, sessions, previousEvaluations, presentations] = await Promise.all([
    db.user.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.dailyProgress.findMany({ where: { localDate: { gte: bounds.start, lt: bounds.end } }, select: { userId: true, localDate: true, goalAchieved: true, adminPassed: true, adminScore: true } }),
    db.evaluationResult.findMany({ where: { trainingAttempt: { sessionItem: { session: { localDate: { gte: bounds.start, lt: bounds.end } } } } }, select: { finalScore: true, trainingAttempt: { select: { userId: true, sessionItem: { select: { session: { select: { localDate: true } } } } } } } }),
    db.examAttempt.findMany({ where: { weekKey, status: "COMPLETED" }, select: { userId: true, finalScore: true } }),
    db.trainingSession.findMany({ where: { localDate: { gte: bounds.start, lt: bounds.end }, status: "COMPLETED" }, select: { userId: true, completedAt: true } }),
    db.evaluationResult.findMany({ where: { trainingAttempt: { sessionItem: { session: { localDate: { gte: previousBounds.start, lt: previousBounds.end } } } } }, select: { finalScore: true, trainingAttempt: { select: { userId: true } } } }),
    db.sciTechPresentation.findMany({ where: { localDate: { gte: bounds.start, lt: bounds.end } }, orderBy: { localDate: "asc" }, select: { id: true, localDate: true, eligibleEvaluatorCount: true, presenter: { select: { id: true, name: true } }, ratings: { select: { score: true } } } }),
  ]);
  const dayScores = new Map<string, number[]>();
  for (const evaluation of evaluations) { const attempt = evaluation.trainingAttempt; if (!attempt) continue; const key = `${attempt.userId}:${attempt.sessionItem.session.localDate.toISOString().slice(0,10)}`; const values = dayScores.get(key) ?? []; values.push(Number(evaluation.finalScore)); dayScores.set(key, values); }
  for (const item of progress) if (item.adminScore !== null) dayScores.set(`${item.userId}:${item.localDate.toISOString().slice(0,10)}`, [Number(item.adminScore)]);
  const weekday = zonedDateParts(date, timeZone).weekday; const formal = weekday === "Sat" || weekday === "Sun";
  const inputs = users.map((user) => { const exam = exams.find((item) => item.userId === user.id); const trainingScores = [...dayScores.entries()].filter(([key]) => key.startsWith(`${user.id}:`)).flatMap(([, scores]) => scores); return { userId: user.id, name: user.name, trainingScores, completionDays: progress.filter((item) => item.userId === user.id && (item.adminPassed ?? item.goalAchieved)).length, testScore: exam?.finalScore == null ? null : Number(exam.finalScore), completedAt: sessions.filter((item) => item.userId === user.id && item.completedAt).reduce<number | null>((latest, item) => Math.max(latest ?? 0, item.completedAt!.getTime()), null) }; });
  const leaderboard = buildLeaderboard(inputs, false).map((row) => { const prior = previousEvaluations.filter((item) => item.trainingAttempt?.userId === row.userId).map((item) => Number(item.finalScore)); const previousAverage = prior.length ? prior.reduce((sum, value) => sum + value, 0) / prior.length : null; return { ...row, formal, change: previousAverage === null ? null : Math.round((row.trainingAverage - previousAverage) * 100) / 100 }; });
  const trends = Array.from({ length: 7 }, (_, offset) => { const day = new Date(bounds.start); day.setUTCDate(day.getUTCDate() + offset); const dateKey = day.toISOString().slice(0,10); return { day: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][offset], ...Object.fromEntries(users.map((user) => { const scores = dayScores.get(`${user.id}:${dateKey}`) ?? []; return [user.name, scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length * 100) / 100 : null]; })) }; });
  const presentationAverages = users.map((user) => {
    const userPresentations = presentations.filter((presentation) => presentation.presenter.id === user.id);
    const ratings = userPresentations.flatMap((presentation) => presentation.ratings);
    const scoreTotal = ratings.reduce((sum, rating) => sum + Number(rating.score), 0);
    const evaluatorCount = userPresentations.reduce((sum, presentation) => sum + (presentation.eligibleEvaluatorCount ?? Math.max(users.length - 1, 0)), 0);
    return {
      presenterId: user.id,
      presenter: user.name,
      average: ratings.length && evaluatorCount ? Math.round((scoreTotal / evaluatorCount) * 100) / 100 : null,
      ratingCount: ratings.length,
      evaluatorCount,
    };
  });
  return { leaderboard, trends, presentationAverages, formal, weekKey };
}
