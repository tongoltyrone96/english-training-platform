export type WeeklyInput = { userId: string; name: string; trainingScores: number[]; completionDays: number; testScore: number | null; completedAt: number | null };
export type LeaderboardRow = WeeklyInput & { trainingAverage: number; completionRate: number; overall: number; rank: number; formal: boolean };

const round = (value: number) => Math.round(value * 100) / 100;

export function buildLeaderboard(inputs: WeeklyInput[], formal: boolean): LeaderboardRow[] {
  const rows = inputs.map((input) => {
    const trainingAverage = input.trainingScores.length ? input.trainingScores.reduce((sum, value) => sum + value, 0) / input.trainingScores.length : 0;
    const completionRate = Math.min(input.completionDays / 5, 1) * 100;
    const trainingPercent = trainingAverage / 5 * 100;
    const overall = formal ? trainingPercent * 0.5 + completionRate * 0.25 + ((input.testScore ?? 0) / 5 * 100) * 0.25 : trainingPercent * 0.7 + completionRate * 0.3;
    return { ...input, trainingAverage: round(trainingAverage), completionRate: round(completionRate), overall: round(overall), rank: 0, formal };
  });
  rows.sort((a, b) => b.overall - a.overall || b.completionDays - a.completionDays || (b.testScore ?? -1) - (a.testScore ?? -1) || (a.completedAt ?? Infinity) - (b.completedAt ?? Infinity));
  for (let index = 0; index < rows.length; index++) {
    const previous = rows[index - 1]; const row = rows[index];
    const tied = previous && previous.overall === row.overall && previous.completionDays === row.completionDays && previous.testScore === row.testScore && previous.completedAt === row.completedAt;
    row.rank = tied ? previous.rank : index + 1;
  }
  return rows;
}
