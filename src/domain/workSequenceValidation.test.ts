import { describe, expect, it } from "vitest";
import { validateWorkSequences } from "./workSequenceValidation";

const work = (id: string, worldId: string, sequence: number) => ({
  id,
  worldId,
  title: id,
  sequence,
  format: "novel" as const,
  units: [],
});

describe("validateWorkSequences", () => {
  it("accepts unique positive sequences within each world", () => {
    expect(validateWorkSequences([
      work("a", "scadrial", 1),
      work("b", "scadrial", 2),
      work("c", "sel", 1),
    ])).toEqual([]);
  });

  it("reports invalid sequence metadata without repairing it", () => {
    expect(validateWorkSequences([work("a", "sel", 0)])).toEqual([
      { code: "invalid_sequence", worldId: "sel", workId: "a", sequence: 0 },
    ]);
  });

  it("reports duplicate declared sequences only within the same world", () => {
    expect(validateWorkSequences([
      work("a", "nalthis", 1),
      work("b", "nalthis", 1),
      work("c", "taldain", 1),
    ])).toContainEqual({
      code: "duplicate_sequence",
      worldId: "nalthis",
      workId: "b",
      conflictingWorkId: "a",
      sequence: 1,
    });
  });
});
