import { describe, expect, it } from "vitest";
import { resolveCatalogExpansionPlan } from "./catalogExpansionPlan";

describe("catalog expansion plan", () => {
  it("orders explicit priorities and maps readiness conservatively", () => {
    expect(resolveCatalogExpansionPlan([
      { worldId: "scadrial", status: "ready" },
      { worldId: "sel", status: "cataloged" },
      { worldId: "taldain", status: "blocked" },
    ], [
      { worldId: "sel", priority: 2 },
      { worldId: "scadrial", priority: 1 },
      { worldId: "taldain", priority: 3 },
    ])).toEqual({
      status: "valid",
      entries: [
        { worldId: "scadrial", priority: 1, status: "ready", action: "expand-structure" },
        { worldId: "sel", priority: 2, status: "cataloged", action: "await-catalog" },
        { worldId: "taldain", priority: 3, status: "blocked", action: "blocked" },
      ],
    });
  });

  it("fails closed when priorities are duplicated or incomplete", () => {
    expect(resolveCatalogExpansionPlan([
      { worldId: "scadrial", status: "ready" },
      { worldId: "sel", status: "ready" },
    ], [
      { worldId: "scadrial", priority: 1 },
      { worldId: "sel", priority: 1 },
    ])).toEqual({ status: "blocked", entries: [] });

    expect(resolveCatalogExpansionPlan([
      { worldId: "scadrial", status: "ready" },
      { worldId: "sel", status: "ready" },
    ], [
      { worldId: "scadrial", priority: 1 },
    ])).toEqual({ status: "blocked", entries: [] });
  });
});
