import { describe, expect, it } from "vitest";
import { resolveWorldExpansionQueue } from "./worldExpansionQueue";

describe("resolveWorldExpansionQueue", () => {
  it("orders explicit priorities without treating cataloged worlds as ready", () => {
    expect(resolveWorldExpansionQueue(
      [
        { status: "cataloged", worldId: "sel", workCount: 1, verifiedStructure: false },
        { status: "structure-ready", worldId: "scadrial", workCount: 2, verifiedStructure: true },
      ],
      [
        { worldId: "sel", priority: 2 },
        { worldId: "scadrial", priority: 1 },
      ],
    )).toEqual({
      status: "valid",
      entries: [
        { worldId: "scadrial", priority: 1, status: "structure-ready", eligible: true },
        { worldId: "sel", priority: 2, status: "cataloged", eligible: false },
      ],
    });
  });

  it("blocks incomplete, duplicate, or malformed priority graphs fail-closed", () => {
    expect(resolveWorldExpansionQueue(
      [{ status: "cataloged", worldId: "sel", workCount: 1, verifiedStructure: false }],
      [],
    )).toEqual({ status: "blocked", entries: [] });

    expect(resolveWorldExpansionQueue(
      [
        { status: "cataloged", worldId: "sel", workCount: 1, verifiedStructure: false },
        { status: "cataloged", worldId: "nalthis", workCount: 1, verifiedStructure: false },
      ],
      [
        { worldId: "sel", priority: 1 },
        { worldId: "nalthis", priority: 1 },
      ],
    )).toEqual({ status: "blocked", entries: [] });

    expect(resolveWorldExpansionQueue(
      [{ status: "cataloged", worldId: "sel", workCount: 1, verifiedStructure: false }],
      [
        { worldId: "sel", priority: 1 },
        { worldId: "sel", priority: 2 },
      ],
    )).toEqual({ status: "blocked", entries: [] });

    expect(resolveWorldExpansionQueue(
      [{ status: "cataloged", worldId: "sel", workCount: 1, verifiedStructure: false }],
      [{ worldId: "sel", priority: -1 }],
    )).toEqual({ status: "blocked", entries: [] });
  });
});
