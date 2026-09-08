import { randomInt } from "node:crypto";

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = randomInt(index + 1);
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

/**
 * Prefer questions that are new both to the learner and to today's team.
 * The fallback buckets ensure a session can still be created after the pool
 * has been exhausted, while never duplicating a sentence inside one session.
 */
export function selectTrainingSentenceIds(
  sentenceIds: string[],
  questionCount: number,
  userHistoryIds: ReadonlySet<string>,
  assignedTodayIds: ReadonlySet<string>,
) {
  const buckets = [
    sentenceIds.filter((id) => !userHistoryIds.has(id) && !assignedTodayIds.has(id)),
    sentenceIds.filter((id) => userHistoryIds.has(id) && !assignedTodayIds.has(id)),
    sentenceIds.filter((id) => !userHistoryIds.has(id) && assignedTodayIds.has(id)),
    sentenceIds.filter((id) => userHistoryIds.has(id) && assignedTodayIds.has(id)),
  ];
  const selected: string[] = [];
  for (const bucket of buckets) {
    for (const id of shuffle(bucket)) {
      if (selected.length >= questionCount) return selected;
      selected.push(id);
    }
  }
  return selected;
}
