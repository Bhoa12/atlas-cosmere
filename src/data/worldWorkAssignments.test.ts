import { validateWorldWorkAssignments } from "./worldWorkAssignments";

const worlds = ["scadrial", "sel"];
const works = ["el-imperio-final", "elantris"];

describe("validateWorldWorkAssignments", () => {
  it("accepts an empty assignment set without inferring editorial data", () => {
    expect(validateWorldWorkAssignments([], worlds, works).valid).toBe(true);
  });

  it("accepts known technical references", () => {
    expect(validateWorldWorkAssignments(
      [{ worldId: "scadrial", workId: "el-imperio-final" }],
      worlds,
      works,
    ).valid).toBe(true);
  });

  it("rejects unknown worlds, unknown works and duplicates", () => {
    expect(validateWorldWorkAssignments([{ worldId: "unknown", workId: "elantris" }], worlds, works).valid).toBe(false);
    expect(validateWorldWorkAssignments([{ worldId: "sel", workId: "unknown" }], worlds, works).valid).toBe(false);
    expect(validateWorldWorkAssignments([
      { worldId: "sel", workId: "elantris" },
      { worldId: "sel", workId: "elantris" },
    ], worlds, works).valid).toBe(false);
  });
});
