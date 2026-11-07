import { describe, expect, it } from "vitest";
import { resolveReadingProgressSnapshot } from "./readingProgressSnapshot";

const units = [{ id: "u1", order: 1 }, { id: "u2", order: 2 }, { id: "u3", order: 3 }];

describe("resolveReadingProgressSnapshot", () => {
  it("reports the first declared unit before reading starts", () => {
    expect(resolveReadingProgressSnapshot({ units, completedUnitIds: [] })).toMatchObject({ status: "not-started", nextUnitId: "u1", declaredUnits: 3 });
  });
  it("reports the next unit after a contiguous prefix", () => {
    expect(resolveReadingProgressSnapshot({ units, completedUnitIds: ["u1"] })).toMatchObject({ status: "in-progress", nextUnitId: "u2", completedUnits: 1 });
  });
  it("does not expose a next unit after completion", () => {
    expect(resolveReadingProgressSnapshot({ units, completedUnitIds: ["u1", "u2", "u3"] })).toMatchObject({ status: "complete", nextUnitId: null });
  });
  it("fails closed for skipped or malformed progress", () => {
    expect(resolveReadingProgressSnapshot({ units, completedUnitIds: ["u2"] }).status).toBe("blocked");
  });
});
