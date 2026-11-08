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

  it("allows multiple explicit sources for the same work", () => {
    const multipleSources = [
      { sourceId: "source-a", workId: "work-a" },
      { sourceId: "source-b", workId: "work-a" },
    ];
    expect(validateSourceWorkBindings(multipleSources)).toHaveLength(0);
    expect(isSourceBoundToWork("source-a", "work-a", multipleSources)).toBe(true);
    expect(isSourceBoundToWork("source-b", "work-a", multipleSources)).toBe(true);
  });

  it("does not infer a binding for another work", () => {
    expect(isSourceBoundToWork("source-a", "work-b", bindings)).toBe(false);
  });

  it("fails closed when one source is bound more than once", () => {
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
