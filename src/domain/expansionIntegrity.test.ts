import { describe, expect, it } from "vitest";
import { validateExpansionIntegrity } from "./expansionIntegrity";

describe("validateExpansionIntegrity", () => {
  it("accepts declared catalog structure and in-range progress", () => {
    const issues = validateExpansionIntegrity({
      worlds: [{
        id: "world",
        name: "World",
        works: [{
          id: "work",
          worldId: "world",
          title: "Work",
          sequence: 1,
          format: "novel",
          units: [
            { id: "u0", workId: "work", order: 0, kind: "chapter", label: "1" },
            { id: "u1", workId: "work", order: 1, kind: "chapter", label: "2" },
          ],
        }],
      }],
      progress: [{ workId: "work", completedUnitOrder: 1 }],
    });

    expect(issues).toEqual([]);
  });

  it("reports catalog and progress problems without repairing either", () => {
    const issues = validateExpansionIntegrity({
      worlds: [{
        id: "world",
        name: "World",
        works: [{
          id: "work",
          worldId: "other-world",
          title: "Work",
          sequence: 1,
          format: "novel",
          units: [{ id: "u0", workId: "work", order: 0, kind: "chapter", label: "1" }],
        }],
      }],
      progress: [
        { workId: "work", completedUnitOrder: 4 },
        { workId: "missing", completedUnitOrder: 0 },
      ],
    });

    expect(issues).toContainEqual({
      layer: "progress",
      issue: {
        code: "progress_beyond_declared_structure",
        workId: "work",
        completedUnitOrder: 4,
        maximumUnitOrder: 0,
      },
    });
    expect(issues).toContainEqual({
      layer: "progress",
      issue: { code: "unknown_work", workId: "missing" },
    });
    expect(issues.some((issue) => issue.layer === "catalog")).toBe(true);
  });
  it("includes optional spoiler-gate catalog diagnostics", () => {
    const issues = validateExpansionIntegrity({
      worlds: [{
        id: "world",
        name: "World",
        works: [{
          id: "work",
          worldId: "world",
          title: "Work",
          sequence: 1,
          format: "novel",
          units: [{ id: "u1", workId: "work", order: 1, kind: "chapter", label: "1" }],
        }],
      }],
      progress: [],
      gates: [{
        id: "gate",
        requirements: [{ workId: "work", requiredPosition: 2 }],
      }],
    });

    expect(issues).toContainEqual({
      layer: "spoiler_gate_catalog",
      issue: {
        code: "undeclared_position",
        gateId: "gate",
        workId: "work",
        requiredPosition: 2,
      },
    });
  });

});
