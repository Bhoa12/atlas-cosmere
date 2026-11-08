import { resolveCosmereDisclosurePlan } from "./cosmereDisclosurePlan";

describe("resolveCosmereDisclosurePlan", () => {
  const catalog = [{ sourceId: "s1", access: "verified-structure" as const }];
  const bindings = [{ sourceId: "s1", workId: "w1" }];
  const scope = [{ contentId: "c1", workId: "w1", worldId: "scadrial" }];
  const evidence = [{ contentId: "c1", workId: "w1", sourceId: "s1", kind: "metadata" as const }];
  const requests = [{ contentId: "c1", requiredUnitIds: [] }];

  it("orchestrates a structurally valid batch without adding narrative data", () => {
    const result = resolveCosmereDisclosurePlan(scope, catalog, bindings, ["w1"], [], [], evidence, requests);
    expect(result.integrity).toBe("valid");
    expect(result.status).toBe("ready");
    expect(result.decisions).toHaveLength(1);
  });

  it("fails closed before batch resolution when evidence crosses the declared work", () => {
    const result = resolveCosmereDisclosurePlan(
      scope, catalog, bindings, ["w1", "w2"], [], [],
      [{ ...evidence[0], workId: "w2" }], requests,
    );
    expect(result).toEqual({ status: "blocked", integrity: "blocked", decisions: [], blockedContentIds: [] });
  });
});
