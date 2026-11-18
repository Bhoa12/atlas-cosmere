import { describe, expect, it, vi } from "vitest";
import {
  composeHoidNarrative,
  defaultHoidNarrativeLayout,
  selectHoidNarrativeLayout,
  type HoidNarrativeLayoutRequest,
} from "./narrativeComposition";

function segments(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    claimId: "claim." + String(index + 1),
    text: "Afirmación editorial " + String(index + 1) + ".",
    evidenceIds: ["evidence." + String(index + 1)],
  }));
}

describe("Hoid narrative composition", () => {
  it("preserves a single approved claim exactly in plain layout", () => {
    const result = composeHoidNarrative({ segments: segments(1) }, "plain");
    expect(result).toMatchObject({
      status: "ready",
      layout: "plain",
      text: "Afirmación editorial 1.",
      claimIds: ["claim.1"],
      evidenceIds: ["evidence.1"],
    });
  });

  it("numbers multiple claims without changing their wording or order", () => {
    const result = composeHoidNarrative({ segments: segments(3) }, "numbered");
    expect(result).toMatchObject({
      status: "ready",
      layout: "numbered",
      text: [
        "1. Afirmación editorial 1.",
        "",
        "2. Afirmación editorial 2.",
        "",
        "3. Afirmación editorial 3.",
      ].join("\n"),
      claimIds: ["claim.1", "claim.2", "claim.3"],
    });
  });

  it("groups long explanations into neutral blocks of at most three claims", () => {
    const result = composeHoidNarrative({ segments: segments(7) }, "grouped");
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.sections).toHaveLength(3);
    expect(result.sections.map(section => section.claimIds.length)).toEqual([3, 3, 1]);
    expect(result.text).toContain("Bloque 1");
    expect(result.text).toContain("Bloque 3");
    for (const segment of result.segments) expect(result.text).toContain(segment.text);
  });

  it("deduplicates evidence IDs across claims while preserving claim order", () => {
    const input = {
      segments: [
        { claimId: "claim.one", text: "Primera afirmación.", evidenceIds: ["evidence.shared"] },
        { claimId: "claim.two", text: "Segunda afirmación.", evidenceIds: ["evidence.shared", "evidence.two"] },
      ],
    };
    expect(composeHoidNarrative(input, "numbered")).toMatchObject({
      status: "ready",
      evidenceIds: ["evidence.shared", "evidence.two"],
    });
  });

  it("rejects duplicate claim IDs", () => {
    const input = {
      segments: [
        { claimId: "claim.same", text: "Primera afirmación.", evidenceIds: ["evidence.one"] },
        { claimId: "claim.same", text: "Segunda afirmación.", evidenceIds: ["evidence.two"] },
      ],
    };
    expect(composeHoidNarrative(input, "numbered")).toEqual({
      status: "unavailable",
      reason: "invalid-input",
    });
  });

  it("rejects duplicate evidence IDs inside a segment", () => {
    const input = {
      segments: [{
        claimId: "claim.one",
        text: "Afirmación.",
        evidenceIds: ["evidence.one", "evidence.one"],
      }],
    };
    expect(composeHoidNarrative(input, "plain")).toEqual({
      status: "unavailable",
      reason: "invalid-input",
    });
  });

  it("rejects sparse segment arrays", () => {
    const sparse = new Array(2);
    sparse[1] = segments(1)[0];
    expect(composeHoidNarrative({ segments: sparse }, "plain")).toEqual({
      status: "unavailable",
      reason: "invalid-input",
    });
  });

  it("rejects accessor-backed segment text without invoking the getter", () => {
    const segment = segments(1)[0] as Record<string, unknown>;
    let invoked = false;
    Object.defineProperty(segment, "text", {
      enumerable: true,
      get() {
        invoked = true;
        return "No debe leerse";
      },
    });
    expect(composeHoidNarrative({ segments: [segment] }, "plain")).toEqual({
      status: "unavailable",
      reason: "invalid-input",
    });
    expect(invoked).toBe(false);
  });

  it("rejects unexpected input and segment properties", () => {
    expect(composeHoidNarrative({ segments: segments(1), providerText: "inventado" }, "plain")).toEqual({
      status: "unavailable",
      reason: "invalid-input",
    });
    expect(composeHoidNarrative({
      segments: [{ ...segments(1)[0], extra: "No autorizado" }],
    }, "plain")).toEqual({
      status: "unavailable",
      reason: "invalid-input",
    });
  });

  it("rejects invisible formatting controls in editorial claim text", () => {
    expect(composeHoidNarrative({
      segments: [{ ...segments(1)[0], text: "Afirmación\u200B editorial." }],
    }, "plain")).toEqual({
      status: "unavailable",
      reason: "invalid-input",
    });
  });

  it("rejects unsupported layout values", () => {
    expect(composeHoidNarrative({ segments: segments(1) }, "free-form")).toEqual({
      status: "unavailable",
      reason: "invalid-layout",
    });
  });

  it("uses deterministic defaults based only on the number of claims", () => {
    expect(defaultHoidNarrativeLayout(1)).toBe("plain");
    expect(defaultHoidNarrativeLayout(3)).toBe("numbered");
    expect(defaultHoidNarrativeLayout(4)).toBe("grouped");
    expect(defaultHoidNarrativeLayout(0)).toBe("plain");
  });

  it("exposes only counts and a closed layout allow-list to an optional provider", async () => {
    let received: HoidNarrativeLayoutRequest | undefined;
    const port = {
      chooseLayout: vi.fn(async (request: HoidNarrativeLayoutRequest) => {
        received = request;
        return "grouped";
      }),
    };
    const layout = await selectHoidNarrativeLayout(port, 6, 4);
    expect(layout).toBe("grouped");
    expect(port.chooseLayout).toHaveBeenCalledTimes(1);
    expect(received).toEqual({
      schemaVersion: 1,
      locale: "es",
      claimCount: 6,
      entityCount: 4,
      allowedLayouts: ["plain", "numbered", "grouped"],
    });
    expect(Object.keys(received ?? {})).not.toContain("question");
    expect(Object.keys(received ?? {})).not.toContain("segments");
    expect(Object.keys(received ?? {})).not.toContain("sources");
  });

  it("falls back locally when a provider returns an unrecognized layout object", async () => {
    const port = { chooseLayout: async () => ({ layout: "plain" }) };
    await expect(selectHoidNarrativeLayout(port, 4, 3)).resolves.toBe("grouped");
  });

  it("falls back locally when a provider rejects", async () => {
    const port = { chooseLayout: async () => { throw new Error("provider failure"); } };
    await expect(selectHoidNarrativeLayout(port, 2, 2)).resolves.toBe("numbered");
  });

  it("does not invoke a provider for invalid group sizes", async () => {
    const port = { chooseLayout: vi.fn(async () => "plain") };
    await expect(selectHoidNarrativeLayout(port, 3, 5)).resolves.toBe("numbered");
    expect(port.chooseLayout).not.toHaveBeenCalled();
  });
});
