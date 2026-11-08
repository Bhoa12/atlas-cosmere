import { describe, expect, it } from "vitest";
import { resolveDeclaredContentScope } from "./declaredContentScope";

describe("resolveDeclaredContentScope", () => {
  const worlds = ["scadrial", "sel"];
  const works = ["mistborn-1", "elantris"];

  it("accepts explicit content inside declared world and work scope", () => {
    const result = resolveDeclaredContentScope(
      [{ contentId: "c1", workId: "mistborn-1", worldId: "scadrial" }],
      works,
      worlds,
    );

    expect(result.status).toBe("valid");
    expect(result.entries).toHaveLength(1);
  });

  it("blocks duplicate content identifiers without returning partial scope", () => {
    const result = resolveDeclaredContentScope(
      [
        { contentId: "c1", workId: "mistborn-1", worldId: "scadrial" },
        { contentId: "c1", workId: "elantris", worldId: "sel" },
      ],
      works,
      worlds,
    );

    expect(result.status).toBe("blocked");
    expect(result.entries).toEqual([]);
    expect(result.duplicateContentIds).toEqual(["c1"]);
  });

  it("diagnoses references outside declared scope", () => {
    const result = resolveDeclaredContentScope(
      [{ contentId: "c1", workId: "unknown", worldId: "unknown-world" }],
      works,
      worlds,
    );

    expect(result.status).toBe("blocked");
    expect(result.unknownWorkIds).toEqual(["unknown"]);
    expect(result.unknownWorldIds).toEqual(["unknown-world"]);
  });

  it("fails closed for empty or duplicated declarations", () => {
    expect(resolveDeclaredContentScope([], [], worlds).status).toBe("blocked");
    expect(resolveDeclaredContentScope([], ["mistborn-1", "mistborn-1"], worlds).status).toBe("blocked");
  });
});
