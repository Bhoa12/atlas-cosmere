import { describe, expect, it } from "vitest";
import { resolveWorldWorkScope } from "./worldWorkScope";

describe("world work scope", () => {
  it("accepts explicit links entirely inside the declared scope", () => {
    expect(resolveWorldWorkScope(
      ["scadrial", "sel"],
      ["mistborn-1", "elantris"],
      [
        { workId: "mistborn-1", worldId: "scadrial" },
        { workId: "elantris", worldId: "sel" },
      ],
    )).toEqual({ status: "valid", outOfScopeLinks: [] });
  });

  it("blocks and preserves links that point outside the declared scope", () => {
    expect(resolveWorldWorkScope(
      ["scadrial"],
      ["mistborn-1"],
      [
        { workId: "mistborn-1", worldId: "scadrial" },
        { workId: "unknown-work", worldId: "scadrial" },
        { workId: "mistborn-1", worldId: "unknown-world" },
      ],
    )).toEqual({
      status: "blocked",
      outOfScopeLinks: [
        { workId: "unknown-work", worldId: "scadrial" },
        { workId: "mistborn-1", worldId: "unknown-world" },
      ],
    });
  });

  it("fails closed for empty, duplicate or malformed declarations", () => {
    expect(resolveWorldWorkScope([], ["a"], [{ workId: "a", worldId: "w" }]).status).toBe("blocked");
    expect(resolveWorldWorkScope(["w", "w"], ["a"], [{ workId: "a", worldId: "w" }]).status).toBe("blocked");
    expect(resolveWorldWorkScope(["w"], ["a"], [{ workId: "a", worldId: "w" }, { workId: "a", worldId: "w" }]).status).toBe("blocked");
  });
});