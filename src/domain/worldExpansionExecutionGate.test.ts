import { describe, expect, it } from "vitest";
import { resolveWorldExpansionExecutionGate } from "./worldExpansionExecutionGate";

describe("world expansion execution gate", () => {
  it("requires explicit approval before a ready structural action is executable", () => {
    expect(resolveWorldExpansionExecutionGate([
      { worldId: "scadrial", action: "expand-structure" },
      { worldId: "sel", action: "await-catalog" },
      { worldId: "taldain", action: "blocked" },
    ], [{ worldId: "scadrial", approved: true }])).toEqual([
      { worldId: "scadrial", executable: true, reason: "approved" },
      { worldId: "sel", executable: false, reason: "awaiting-catalog" },
      { worldId: "taldain", executable: false, reason: "blocked" },
    ]);
  });

  it("fails closed when approvals contain unknown worlds", () => {
    expect(resolveWorldExpansionExecutionGate([
      { worldId: "scadrial", action: "expand-structure" },
    ], [{ worldId: "unknown", approved: true }])).toEqual([
      { worldId: "scadrial", executable: false, reason: "blocked" },
    ]);
  });

  it("does not execute an expandable world without approval", () => {
    expect(resolveWorldExpansionExecutionGate([
      { worldId: "scadrial", action: "expand-structure" },
    ], [])).toEqual([
      { worldId: "scadrial", executable: false, reason: "missing-approval" },
    ]);
  });
});
