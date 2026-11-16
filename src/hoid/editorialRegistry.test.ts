import { describe, expect, it, vi } from "vitest";
import {
  createHoidEditorialRuntime,
  getHoidEditorialRegistryStatus,
} from "./editorialRegistry";

describe("production Hoid editorial registry", () => {
  it("reports empty until reviewed original claims are actually present", () => {
    expect(getHoidEditorialRegistryStatus()).toBe("empty");
  });

  it("abstains rather than inventing facts when the registry has no approved claims", async () => {
    const runtime = createHoidEditorialRuntime();
    expect(runtime).not.toBeNull();

    const result = await runtime!.answer({
      question: "¿Qué es el Cosmere?",
      reading: [],
    });

    expect(result.status).toBe("abstain");
    expect(result.reason).toBe("no-authorized-evidence");
    expect(result.claimIds).toEqual([]);
    expect(result.evidenceIds).toEqual([]);
    expect(result.sources).toEqual([]);
  });

  it("does not call a selector when there are no authorized editorial candidates", async () => {
    const selectClaims = vi.fn(async () => ["unregistered-claim"]);
    const runtime = createHoidEditorialRuntime({ selectClaims });
    expect(runtime).not.toBeNull();

    const result = await runtime!.answer({
      question: "¿Qué es el Cosmere?",
      reading: [],
    });

    expect(result.status).toBe("abstain");
    expect(selectClaims).not.toHaveBeenCalled();
  });
});
