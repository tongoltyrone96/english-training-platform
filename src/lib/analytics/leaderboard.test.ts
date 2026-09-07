import { describe, expect, it } from "vitest";
import { buildLeaderboard } from "./leaderboard";

const users = [
  { userId: "a", name: "A", trainingScores: [5, 4], completionDays: 4, testScore: 4, completedAt: 20 },
  { userId: "b", name: "B", trainingScores: [4.5], completionDays: 5, testScore: 5, completedAt: 10 },
];

describe("weekly leaderboard", () => {
  it("uses the weekday provisional formula", () => expect(buildLeaderboard(users, false).find((row) => row.userId === "a")?.overall).toBe(87));
  it("uses the formal formula after Saturday", () => expect(buildLeaderboard(users, true)[0].userId).toBe("b"));
  it("assigns a shared rank only after all tie breakers remain equal", () => {
    const tied = buildLeaderboard([{ ...users[0], userId: "a" }, { ...users[0], userId: "c" }], true);
    expect(tied.map((row) => row.rank)).toEqual([1, 1]);
  });
});
