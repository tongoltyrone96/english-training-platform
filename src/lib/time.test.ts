import { describe, expect, it } from "vitest";
import { isoWeekKey } from "./time";

describe("ISO week key", () => {
  it("uses the ISO week-year at New Year boundaries", () => {
    expect(isoWeekKey(new Date("2021-01-01T12:00:00Z"), "UTC")).toBe("2020-W53");
    expect(isoWeekKey(new Date("2021-01-04T12:00:00Z"), "UTC")).toBe("2021-W01");
  });
  it("uses the configured operating timezone", () => {
    expect(isoWeekKey(new Date("2024-12-29T23:30:00Z"), "Asia/Seoul")).toBe("2025-W01");
  });
});
