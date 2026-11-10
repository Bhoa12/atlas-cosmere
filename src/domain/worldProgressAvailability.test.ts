import { describe, expect, it } from "vitest";
import { resolveWorldProgressAvailability } from "./worldProgressAvailability";

describe("resolveWorldProgressAvailability", () => {
  it("derives explicit availability without editorial inference", () => {
    expect(resolveWorldProgressAvailability({ status: "valid", milestones: [
      { worldId: "sel", milestone: "not-started" },
      { worldId: "scadrial", milestone: "started" },
      { worldId: "nalthis", milestone: "complete" },
    ] })).toEqual({ status: "valid", worlds: [
      { worldId: "nalthis", available: true },
      { worldId: "scadrial", available: true },
      { worldId: "sel", available: false },
    ] });
  });

  it("blocks duplicate or malformed milestone metadata", () => {
    expect(resolveWorldProgressAvailability({ status: "valid", milestones: [
      { worldId: "taldain", milestone: "started" },
      { worldId: "taldain", milestone: "complete" },
    ] })).toEqual({ status: "blocked", worlds: [] });
    expect(resolveWorldProgressAvailability({ status: "valid", milestones: [
      { worldId: "sel", milestone: "unknown" as never },
    ] })).toEqual({ status: "blocked", worlds: [] });
  });

  it("blocks padded identifiers instead of silently normalizing metadata", () => {
    expect(resolveWorldProgressAvailability({ status: "valid", milestones: [
      { worldId: "sel", milestone: "started" },
      { worldId: " sel ", milestone: "complete" },
    ] })).toEqual({ status: "blocked", worlds: [] });
  });

  it("blocks upstream failures", () => {
    expect(resolveWorldProgressAvailability({ status: "blocked", milestones: [] }))
      .toEqual({ status: "blocked", worlds: [] });
  });
});
