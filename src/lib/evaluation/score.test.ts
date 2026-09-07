import { describe, expect, it } from "vitest";
import { calculateFinalScore, isPassing } from "./score";

describe("deterministic evaluation score", () => {
  it("applies the specified weights and converts to five points", () => {
    expect(calculateFinalScore({ meaning: 100, pronunciation: 80, grammar: 90, naturalness: 70, fluency: 60, completeness: 100 })).toBe(4.33);
  });
  it("uses the configured 4.5 pass boundary", () => {
    expect(isPassing(4.49)).toBe(false);
    expect(isPassing(4.5)).toBe(true);
  });
});
