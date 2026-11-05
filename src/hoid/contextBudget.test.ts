import { boundAuthorizedContext } from "./contextBudget";

describe("boundAuthorizedContext", () => {
  it("caps authorized context deterministically", () => {
    const entries = Array.from({ length: 4 }, (_, index) => ({ id: String(index) }));
    expect(boundAuthorizedContext(entries as any, 2)).toHaveLength(2);
  });

  it("fails closed for invalid limits", () => {
    expect(boundAuthorizedContext([{ id: "safe" }] as any, 0)).toEqual([]);
    expect(boundAuthorizedContext([{ id: "safe" }] as any, Number.NaN)).toEqual([]);
  });
});
