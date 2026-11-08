import { describe, expect, it } from "vitest";
import { resolveContentScopeIntegrity } from "./contentScopeIntegrity";

describe("resolveContentScopeIntegrity", () => {
  const scope = [{ contentId: "c1", workId: "mistborn-1", worldId: "scadrial" }];

  it("accepts explicit matching scope, evidence and request identities", () => {
    expect(resolveContentScopeIntegrity(
      scope,
      [{ contentId: "c1", workId: "mistborn-1", sourceId: "catalog", evidenceKind: "metadata" }],
      [{ contentId: "c1", requiredUnitIds: [] }],
    ).status).toBe("valid");
  });

  it("blocks evidence whose work differs from declared content scope", () => {
    expect(resolveContentScopeIntegrity(
      scope,
      [{ contentId: "c1", workId: "elantris", sourceId: "catalog", evidenceKind: "metadata" }],
      [],
    ).status).toBe("blocked");
  });

  it("blocks duplicate identifiers and requests outside the declared scope", () => {
    expect(resolveContentScopeIntegrity(
      scope,
      [
        { contentId: "c1", workId: "mistborn-1", sourceId: "a", evidenceKind: "metadata" },
        { contentId: "c1", workId: "mistborn-1", sourceId: "b", evidenceKind: "metadata" },
      ],
      [],
    ).status).toBe("blocked");

    expect(resolveContentScopeIntegrity(scope, [], [{ contentId: "unknown", requiredUnitIds: [] }]).status).toBe("blocked");
  });
});
