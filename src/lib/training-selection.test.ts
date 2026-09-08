import { describe, expect, it } from "vitest";
import { selectTrainingSentenceIds } from "./training-selection";

describe("selectTrainingSentenceIds", () => {
  it("prefers questions unseen by the user and unused by the team today", () => {
    const selected = selectTrainingSentenceIds(
      ["a", "b", "c", "d", "e"],
      2,
      new Set(["a"]),
      new Set(["b"]),
    );
    expect(selected).toHaveLength(2);
    expect(selected.every((id) => ["c", "d", "e"].includes(id))).toBe(true);
  });

  it("uses fallback buckets without duplicating a question", () => {
    const selected = selectTrainingSentenceIds(
      ["a", "b", "c"],
      3,
      new Set(["a", "b", "c"]),
      new Set(["a", "b", "c"]),
    );
    expect(new Set(selected).size).toBe(3);
    expect(selected).toHaveLength(3);
  });
});
