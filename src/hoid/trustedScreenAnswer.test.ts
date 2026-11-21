import { describe, expect, it, vi } from "vitest";
import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { composeHoidNarrative } from "./narrativeComposition";
import { createHoidTrustedScreenAnswerPort } from "./trustedScreenAnswer";

function title(bookId: string): string {
  const work = HOID_SOURCE_BIBLIOGRAPHY.find(item => item.id === bookId);
  if (!work) throw new Error("Test work is not in the bibliography");
  return work.title;
}

function citation(evidenceId: string, sourceBookId = "tfe") {
  return Object.freeze({
    evidenceId,
    sourceBookId,
    title: title(sourceBookId),
    chapter: 1,
    locatorId: sourceBookId + ".chapter-1",
  });
}

function readyPresentation(options?: {
  bookIds?: readonly string[];
  claimCount?: number;
  includeSegments?: boolean;
}) {
  const bookIds = options?.bookIds ?? ["tfe"];
  const claimCount = options?.claimCount ?? 1;
  const claimIds = Array.from({ length: claimCount }, (_, index) => "claim-" + String(index + 1));
  const evidenceIds = bookIds.map((_, index) => "evidence-" + String(index + 1));
  const citations = bookIds.map((bookId, index) => citation(evidenceIds[index], bookId));
  const segments = options?.includeSegments === false
    ? undefined
    : [{
        claimId: claimIds[0],
        text: "Afirmación editorial verificada.",
        evidenceIds,
      }];

  if (claimCount > 1 && segments) {
    for (let index = 1; index < claimCount; index += 1) {
      segments.push({
        claimId: claimIds[index],
        text: "Otra afirmación editorial verificada.",
        evidenceIds: [evidenceIds[index % evidenceIds.length]],
      });
    }
  }

  const layout = segments ? "plain" as const : undefined;
  const composition = segments ? composeHoidNarrative({ segments }, layout) : null;
  if (composition && composition.status !== "ready") throw new Error("Invalid presentation fixture");

  return Object.freeze({
    status: "ready" as const,
    text: composition?.text ?? "Afirmación editorial verificada.",
    claimIds: Object.freeze(claimIds),
    evidenceIds: Object.freeze(evidenceIds),
    citations: Object.freeze(citations),
    ...(segments && composition ? {
      layout,
      segments: Object.freeze(segments.map(segment => Object.freeze({
        ...segment,
        evidenceIds: Object.freeze([...segment.evidenceIds]),
        citations: Object.freeze(segment.evidenceIds.map(id => citations.find(item => item.evidenceId === id)!)),
      }))),
    } : {}),
  });
}

describe("Hoid trusted screen answer boundary", () => {
  it("renders only a ready result returned by the trusted presenter", async () => {
    const output = readyPresentation();
    const presenter = Object.freeze({ present: vi.fn(async () => output) });
    const port = createHoidTrustedScreenAnswerPort(presenter);

    expect(port).not.toBeNull();
    await expect(port!.present(Object.freeze({ status: "authorized" }), "brief")).resolves.toMatchObject({
      status: "ready",
      presentation: { text: "Afirmación editorial verificada." },
      metrics: { claimCount: 1, evidenceCount: 1, workCount: 1 },
    });
  });

  it("passes only the answer candidate to the presenter and never accepts caller progress", async () => {
    const answer = Object.freeze({ status: "authorized", token: "candidate" });
    const present = vi.fn(async () => readyPresentation());
    const port = createHoidTrustedScreenAnswerPort(Object.freeze({ present }));

    await port!.present(answer, "detailed");
    expect(present).toHaveBeenCalledTimes(1);
    expect(present).toHaveBeenCalledWith(answer);
  });

  it("withholds when the trusted presenter rejects the answer", async () => {
    const presenter = Object.freeze({
      present: async () => Object.freeze({
        status: "withheld",
        reason: "locked-evidence",
        text: "internal detail must not escape",
      }),
    });
    const port = createHoidTrustedScreenAnswerPort(presenter);

    await expect(port!.present({}, "brief")).resolves.toMatchObject({
      status: "withheld",
      reason: "presenter-withheld",
    });
  });

  it("rejects an unsupported explanation depth before calling the presenter", async () => {
    const present = vi.fn(async () => readyPresentation());
    const port = createHoidTrustedScreenAnswerPort(Object.freeze({ present }));

    await expect(port!.present({}, "spoiler-mode")).resolves.toMatchObject({
      status: "withheld",
      reason: "invalid-depth",
    });
    expect(present).not.toHaveBeenCalled();
  });

  it("rejects an output whose composed text does not match its evidence segments", async () => {
    const output = {
      ...readyPresentation(),
      text: "Provider-authored replacement text.",
    };
    const port = createHoidTrustedScreenAnswerPort(Object.freeze({
      present: async () => output,
    }));

    await expect(port!.present({}, "brief")).resolves.toMatchObject({
      status: "withheld",
      reason: "presenter-withheld",
    });
  });

  it("rejects citations whose title does not match the canonical bibliography", async () => {
    const output = readyPresentation();
    const tampered = {
      ...output,
      citations: [Object.freeze({ ...output.citations[0], title: "Título inventado" })],
      segments: [Object.freeze({
        ...output.segments![0],
        citations: [Object.freeze({ ...output.citations![0], title: "Título inventado" })],
      })],
    };
    const port = createHoidTrustedScreenAnswerPort(Object.freeze({
      present: async () => tampered,
    }));

    await expect(port!.present({}, "brief")).resolves.toMatchObject({
      status: "withheld",
      reason: "presenter-withheld",
    });
  });

  it("requires segment-level provenance for detailed explanations", async () => {
    const port = createHoidTrustedScreenAnswerPort(Object.freeze({
      present: async () => readyPresentation({ includeSegments: false }),
    }));

    await expect(port!.present({}, "detailed")).resolves.toMatchObject({
      status: "withheld",
      reason: "segment-provenance-required",
    });
  });

  it("enforces the brief claim budget without truncating the answer", async () => {
    const port = createHoidTrustedScreenAnswerPort(Object.freeze({
      present: async () => readyPresentation({ claimCount: 4 }),
    }));

    await expect(port!.present({}, "brief")).resolves.toMatchObject({
      status: "withheld",
      reason: "depth-budget-exceeded",
    });
  });

  it("requires a genuinely cross-work segment for comparative depth", async () => {
    const port = createHoidTrustedScreenAnswerPort(Object.freeze({
      present: async () => readyPresentation(),
    }));

    await expect(port!.present({}, "comparative")).resolves.toMatchObject({
      status: "withheld",
      reason: "comparison-provenance-required",
    });
  });

  it("allows comparative depth only when one segment cites multiple works", async () => {
    const output = readyPresentation({ bookIds: ["tfe", "twok"] });
    const port = createHoidTrustedScreenAnswerPort(Object.freeze({
      present: async () => output,
    }));

    await expect(port!.present({}, "comparative")).resolves.toMatchObject({
      status: "ready",
      metrics: { workCount: 2 },
    });
  });

  it("rejects accessor-backed presenter methods without invoking the getter", () => {
    let invoked = false;
    const hostile = Object.defineProperty({}, "present", {
      enumerable: true,
      get() {
        invoked = true;
        throw new Error("must not run");
      },
    });

    expect(createHoidTrustedScreenAnswerPort(hostile)).toBeNull();
    expect(invoked).toBe(false);
  });

  it("withholds when the presenter throws", async () => {
    const port = createHoidTrustedScreenAnswerPort(Object.freeze({
      present: async () => {
        throw new Error("private failure");
      },
    }));

    await expect(port!.present({}, "brief")).resolves.toMatchObject({
      status: "withheld",
      reason: "presenter-withheld",
    });
  });

  it("rejects a segment whose citation is not part of the top-level citation set", async () => {
    const output = readyPresentation();
    const altered = {
      ...output,
      segments: [Object.freeze({
        ...output.segments![0],
        citations: [citation("evidence-alpha", "twok")],
      })],
    };
    const port = createHoidTrustedScreenAnswerPort(Object.freeze({
      present: async () => altered,
    }));

    await expect(port!.present({}, "brief")).resolves.toMatchObject({
      status: "withheld",
      reason: "presenter-withheld",
    });
  });
});
