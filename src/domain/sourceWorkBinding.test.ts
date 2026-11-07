import { describe, expect, it } from "vitest";
import {
  isSourceBoundToWork,
  validateSourceWorkBindings,
} from "./sourceWorkBinding";

describe("source work bindings", () => {
  const bindings = [{ sourceId: "source-a", workId: "work-a" }];

  it("accepts an explicit source-to-work binding", () => {
    expect(isSourceBoundToWork("source-a", "work-a", bindings)).toBe(true);
  });

  it("does not infer a binding for another work", () => {
    expect(isSourceBoundToWork("source-a", "work-b", bindings)).toBe(false);
  });

  it("fails closed when the registry is malformed", () => {
    const malformed = [
      { sourceId: "source-a", workId: "work-a" },
      { sourceId: "source-a", workId: "work-b" },
    ];
    expect(validateSourceWorkBindings(malformed)).not.toHaveLength(0);
    expect(isSourceBoundToWork("source-a", "work-a", malformed)).toBe(false);
  });

  it("rejects empty identifiers", () => {
    expect(isSourceBoundToWork("", "work-a", bindings)).toBe(false);
    expect(isSourceBoundToWork("source-a", "", bindings)).toBe(false);
  });
});
