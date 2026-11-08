import { resolveDeclaredWorkBindingScope } from "./declaredWorkBindingScope";

describe("resolveDeclaredWorkBindingScope", () => {
  it("accepts bindings that all target declared works", () => {
    expect(resolveDeclaredWorkBindingScope(
      ["work-a", "work-b"],
      [
        { sourceId: "s1", workId: "work-a" },
        { sourceId: "s2", workId: "work-b" },
      ],
    )).toEqual({
      status: "valid",
      inScopeBindings: [
        { sourceId: "s1", workId: "work-a" },
        { sourceId: "s2", workId: "work-b" },
      ],
      outOfScopeBindings: [],
    });
  });

  it("fails closed without discarding bindings to undeclared works", () => {
    const result = resolveDeclaredWorkBindingScope(
      ["work-a"],
      [
        { sourceId: "s1", workId: "work-a" },
        { sourceId: "s2", workId: "work-future" },
      ],
    );

    expect(result.status).toBe("blocked");
    expect(result.inScopeBindings).toEqual([{ sourceId: "s1", workId: "work-a" }]);
    expect(result.outOfScopeBindings).toEqual([{ sourceId: "s2", workId: "work-future" }]);
  });

  it("blocks invalid declared lists and malformed bindings", () => {
    expect(resolveDeclaredWorkBindingScope([], []).status).toBe("blocked");
    expect(resolveDeclaredWorkBindingScope(
      ["work-a", "work-a"],
      [],
    ).status).toBe("blocked");
    expect(resolveDeclaredWorkBindingScope(
      ["work-a"],
      [{ sourceId: "", workId: "work-a" }],
    ).status).toBe("blocked");
  });
});
