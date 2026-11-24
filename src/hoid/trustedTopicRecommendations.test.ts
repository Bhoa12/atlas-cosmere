import { describe, expect, it, vi } from "vitest";
import { createHoidReadingCursor } from "./readingManifest";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";
import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { sha256Hex } from "./sha256";
import {
  createHoidTrustedTopicRecommendationPresenter,
  type HoidTrustedTopicRecommendationPresenterConfig,
} from "./trustedTopicRecommendations";
import type { HoidTrustedScreenAnswerPort } from "./trustedScreenAnswer";

const UPDATED_AT = "2026-11-18T17:00:00.000Z";
const CLAIM_ID = "claim-topic-1";
const EVIDENCE_ID = "evidence-topic-1";
const CLAIM_TEXT = "Afirmación editorial verificada para una recomendación.";

function title(bookId: string): string {
  const work = HOID_SOURCE_BIBLIOGRAPHY.find(item => item.id === bookId);
  if (!work) throw new Error("Unknown fixture work");
  return work.title;
}

function snapshot(options?: { chapter?: number; revision?: number; includeTarget?: boolean }) {
  const cursor = createHoidReadingCursor("tfe", options?.chapter ?? 3);
  if (cursor.status !== "ready") throw new Error("Fixture cursor unavailable");
  const positions: unknown[] = [{ bookId: "tfe", cursor: cursor.cursor }];
  if (options?.includeTarget) {
    const target = createHoidReadingCursor("tress", 1);
    if (target.status !== "ready") throw new Error("Target cursor unavailable");
    positions.push({ bookId: "tress", cursor: target.cursor });
  }
  return {
    schemaVersion: 2,
    revision: options?.revision ?? 7,
    positions,
    updatedAt: UPDATED_AT,
  };
}

function identity(progress: unknown) {
  const projection = projectHoidCursorProgressSnapshot(progress);
  if (projection.status !== "ready") throw new Error("Fixture progress invalid");
  return {
    revision: projection.revision,
    fingerprint: fingerprintHoidCursorProgressProjection(projection),
  };
}

function citation(sourceBookId = "tfe") {
  return Object.freeze({
    evidenceId: EVIDENCE_ID,
    sourceBookId,
    title: title(sourceBookId),
    chapter: 1,
    locatorId: sourceBookId + ".chapter-1",
  });
}

function recommendation(overrides?: {
  sourceId?: string;
  title?: string;
  reasonText?: string;
  citations?: readonly unknown[];
}) {
  const sourceId = overrides?.sourceId ?? "tress";
  return Object.freeze({
    sourceId,
    title: overrides?.title ?? title(sourceId),
    reason: "reviewed-topic-match" as const,
    matches: Object.freeze([Object.freeze({
      topicId: "investiture-system",
      topicLabel: "Sistema de Investidura",
      dimensionId: "mechanism",
      dimensionLabel: "Mecanismo",
      claimId: CLAIM_ID,
      reasonText: overrides?.reasonText ?? CLAIM_TEXT,
      citations: Object.freeze([...(overrides?.citations ?? [citation()])]),
    })]),
  });
}

function readyClaimResult(options?: {
  text?: string;
  citations?: readonly unknown[];
  claimId?: string;
}) {
  const claimId = options?.claimId ?? CLAIM_ID;
  const citations = options?.citations ?? [citation()];
  const evidenceIds = citations.map(item => (item as { evidenceId: string }).evidenceId);
  const text = options?.text ?? CLAIM_TEXT;
  const presentation = Object.freeze({
    status: "ready",
    text,
    claimIds: Object.freeze([claimId]),
    evidenceIds: Object.freeze(evidenceIds),
    citations: Object.freeze([...citations]),
    layout: "plain",
    segments: Object.freeze([Object.freeze({
      claimId,
      text,
      evidenceIds: Object.freeze(evidenceIds),
      citations: Object.freeze([...citations]),
    })]),
  });
  return Object.freeze({
    status: "ready",
    depth: "brief",
    metrics: Object.freeze({
      claimCount: 1,
      evidenceCount: evidenceIds.length,
      workCount: new Set((citations as readonly { sourceBookId: string }[]).map(item => item.sourceBookId)).size,
      characterCount: text.length,
    }),
    presentation,
  });
}

function approvedAssignment(overrides?: {
  id?: string;
  subjectId?: string;
  claimTextSha256?: string;
  evidenceIds?: readonly string[];
}) {
  return Object.freeze({
    schemaVersion: 1,
    id: overrides?.id ?? "assignment-topic-tress",
    subjectKind: "work",
    subjectId: overrides?.subjectId ?? "tress",
    worldId: "cosmere",
    worldLabel: "Cosmere",
    topicId: "investiture-system",
    dimensionId: "mechanism",
    claimId: CLAIM_ID,
    claimTextSha256: overrides?.claimTextSha256 ?? sha256Hex(CLAIM_TEXT),
    evidenceIds: Object.freeze([...(overrides?.evidenceIds ?? [EVIDENCE_ID])].sort()),
    review: Object.freeze({
      status: "approved",
      reviewerId: "reviewer-test",
      reviewedAt: UPDATED_AT,
    }),
  });
}

function setup(options?: {
  progress?: unknown;
  refresh?: () => unknown | Promise<unknown>;
  records?: unknown;
  presentation?: unknown;
  assignments?: readonly unknown[];
  assignmentResolution?: unknown;
}) {
  const progress = options?.progress ?? snapshot();
  const current = options?.refresh ?? (() => progress);
  const loadApprovedClaims = vi.fn(async () =>
    options?.records ?? [{ claimId: CLAIM_ID, answer: Object.freeze({ status: "authorized" }) }],
  );
  const present = vi.fn(async () => options?.presentation ?? readyClaimResult());
  const trustedAnswerPort = Object.freeze({ present }) as unknown as HoidTrustedScreenAnswerPort;
  const config: HoidTrustedTopicRecommendationPresenterConfig = {
    loadApprovedClaims,
    trustedAnswerPort,
    refreshCurrentProgress: current,
    resolveApprovedAssignments: () => options?.assignmentResolution ?? Object.freeze({
      status: "active",
      assignments: options?.assignments ?? Object.freeze([approvedAssignment()]),
      receipt: Object.freeze({}),
    }),
  };
  const port = createHoidTrustedTopicRecommendationPresenter(config);
  if (!port) throw new Error("Fixture presenter unavailable");
  const progressIdentity = identity(progress);
  const input = {
    items: [recommendation()],
    progress,
    progressRevision: progressIdentity.revision,
    progressFingerprint: progressIdentity.fingerprint,
  };
  return { port, input, loadApprovedClaims, present, progress };
}

describe("Hoid trusted topic recommendation presentation", () => {
  it("returns recommendations only after every claim is passed through the signed presenter", async () => {
    const fixture = setup();
    await expect(fixture.port.present(fixture.input)).resolves.toMatchObject({
      status: "ready",
      verifiedClaimCount: 1,
      items: [{
        sourceId: "tress",
        matches: [{ claimId: CLAIM_ID, reasonText: CLAIM_TEXT }],
      }],
    });
    expect(fixture.loadApprovedClaims).toHaveBeenCalledWith([CLAIM_ID], fixture.progress);
    expect(fixture.present).toHaveBeenCalledTimes(1);
    expect(fixture.present).toHaveBeenCalledWith({ status: "authorized" }, "brief");
  });

  it("returns promptly when approved-claim loading is cancelled and ignores the late result", async () => {
    const fixture = setup();
    let resolveClaims!: (value: unknown) => void;
    fixture.loadApprovedClaims.mockImplementation(() => new Promise(resolve => {
      resolveClaims = resolve;
    }));
    const controller = new AbortController();
    const pending = fixture.port.present(fixture.input, controller.signal);

    await vi.waitFor(() => {
      expect(fixture.loadApprovedClaims).toHaveBeenCalledTimes(1);
    });
    controller.abort();
    await expect(pending).resolves.toEqual({
      status: "withheld",
      reason: "cancelled",
    });

    resolveClaims([{ claimId: CLAIM_ID, answer: Object.freeze({ status: "authorized" }) }]);
    await Promise.resolve();
    expect(fixture.present).not.toHaveBeenCalled();
  });

  it("withholds recommendations when the approved-claim loader omits a referenced claim", async () => {
    const fixture = setup({ records: [] });
    await expect(fixture.port.present(fixture.input)).resolves.toEqual({
      status: "withheld",
      reason: "approved-claims-unavailable",
    });
    expect(fixture.present).not.toHaveBeenCalled();
  });

  it("withholds when the trusted presenter rejects a claim", async () => {
    const fixture = setup({
      presentation: { status: "withheld", reason: "locked-evidence", text: "private" },
    });
    await expect(fixture.port.present(fixture.input)).resolves.toEqual({
      status: "withheld",
      reason: "claim-presentation-withheld",
    });
  });

  it("rejects a recommendation whose reason text differs from the signed claim segment", async () => {
    // Let the assignment digest match the tampered candidate so this reaches
    // the later signed-claim comparison rather than the earlier assignment guard.
    const fixture = setup({
      assignments: [approvedAssignment({ claimTextSha256: sha256Hex("Texto sustituido.") })],
    });
    const input = { ...fixture.input, items: [recommendation({ reasonText: "Texto sustituido." })] };
    await expect(fixture.port.present(input)).resolves.toEqual({
      status: "withheld",
      reason: "invalid-claim-presentation",
    });
  });

  it("rejects citations that differ from the signed claim provenance", async () => {
    const fixture = setup();
    const changedCitation = Object.freeze({ ...citation(), locatorId: "invented.locator" });
    const input = { ...fixture.input, items: [recommendation({ citations: [changedCitation] })] };
    await expect(fixture.port.present(input)).resolves.toEqual({
      status: "withheld",
      reason: "invalid-claim-presentation",
    });
  });

  it("rejects a target work already present in the reader progress", async () => {
    const progress = snapshot({ includeTarget: true });
    const fixture = setup({ progress });
    const progressIdentity = identity(progress);
    const input = {
      ...fixture.input,
      progress,
      progressRevision: progressIdentity.revision,
      progressFingerprint: progressIdentity.fingerprint,
    };
    await expect(fixture.port.present(input)).resolves.toEqual({
      status: "withheld",
      reason: "invalid-recommendations",
    });
  });

  it("rejects evidence originating from the recommended target work itself", async () => {
    const fixture = setup();
    const input = {
      ...fixture.input,
      items: [recommendation({ citations: [citation("tress")] })],
    };
    await expect(fixture.port.present(input)).resolves.toEqual({
      status: "withheld",
      reason: "invalid-recommendations",
    });
  });

  it("rejects non-canonical topic labels and malformed recommendation records", async () => {
    const fixture = setup();
    const malformed = {
      ...recommendation(),
      matches: [{
        ...recommendation().matches[0],
        topicLabel: "Etiqueta inventada",
      }],
    };
    await expect(fixture.port.present({ ...fixture.input, items: [malformed] })).resolves.toEqual({
      status: "withheld",
      reason: "invalid-recommendations",
    });
  });

  it("detects a progress change during signed claim verification", async () => {
    const initial = snapshot();
    const changed = snapshot({ chapter: 4, revision: 8 });
    let reads = 0;
    const fixture = setup({
      progress: initial,
      refresh: () => {
        reads += 1;
        return reads === 1 ? initial : changed;
      },
    });
    await expect(fixture.port.present(fixture.input)).resolves.toEqual({
      status: "withheld",
      reason: "progress-changed",
    });
  });

  it("does not execute accessors in recommendation metadata", async () => {
    const fixture = setup();
    let invoked = false;
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(hostile, {
      sourceId: { enumerable: true, get: () => { invoked = true; return "tress"; } },
      title: { enumerable: true, value: title("tress") },
      reason: { enumerable: true, value: "reviewed-topic-match" },
      matches: { enumerable: true, value: recommendation().matches },
    });
    await expect(fixture.port.present({ ...fixture.input, items: [hostile] })).resolves.toMatchObject({
      status: "withheld",
      reason: "invalid-recommendations",
    });
    expect(invoked).toBe(false);
  });

  it("verifies a repeated claim only once and reuses its signed segment", async () => {
    const fixture = setup({
      assignments: [
        approvedAssignment(),
        approvedAssignment({ id: "assignment-topic-yumi", subjectId: "yumi" }),
      ],
    });
    const first = recommendation();
    const second = Object.freeze({
      ...first,
      sourceId: "yumi",
      title: title("yumi"),
    });
    const result = await fixture.port.present({ ...fixture.input, items: [first, second] });
    expect(result.status).toBe("ready");
    expect(fixture.present).toHaveBeenCalledTimes(1);
  });

  it("rejects a candidate work that has no matching active approved assignment before loading claims", async () => {
    const fixture = setup();
    const forged = recommendation({ sourceId: "yumi" });
    await expect(fixture.port.present({ ...fixture.input, items: [forged] })).resolves.toEqual({
      status: "withheld",
      reason: "invalid-recommendations",
    });
    expect(fixture.loadApprovedClaims).not.toHaveBeenCalled();
  });

  it("withholds when the production assignment authority is inactive", async () => {
    const fixture = setup({
      assignmentResolution: Object.freeze({
        status: "inactive",
        reason: "no-topic-assignments",
      }),
    });
    await expect(fixture.port.present(fixture.input)).resolves.toEqual({
      status: "withheld",
      reason: "invalid-recommendations",
    });
    expect(fixture.loadApprovedClaims).not.toHaveBeenCalled();
  });

  it("rejects an assignment whose claim digest no longer matches the displayed claim", async () => {
    const fixture = setup({
      assignments: [approvedAssignment({ claimTextSha256: "0".repeat(64) })],
    });
    await expect(fixture.port.present(fixture.input)).resolves.toEqual({
      status: "withheld",
      reason: "invalid-recommendations",
    });
    expect(fixture.loadApprovedClaims).not.toHaveBeenCalled();
  });

  it("rejects an assignment whose evidence set differs from the signed citations", async () => {
    const fixture = setup({
      assignments: [approvedAssignment({ evidenceIds: ["different-evidence"] })],
    });
    await expect(fixture.port.present(fixture.input)).resolves.toEqual({
      status: "withheld",
      reason: "invalid-recommendations",
    });
    expect(fixture.loadApprovedClaims).not.toHaveBeenCalled();
  });

  it("rejects a resolver that throws without falling back to candidate metadata", async () => {
    const fixture = setup();
    const failing = createHoidTrustedTopicRecommendationPresenter({
      loadApprovedClaims: fixture.loadApprovedClaims,
      trustedAnswerPort: Object.freeze({ present: fixture.present }) as unknown as HoidTrustedScreenAnswerPort,
      refreshCurrentProgress: () => fixture.progress,
      resolveApprovedAssignments: () => { throw new Error("assignment registry unavailable"); },
    });
    expect(failing).not.toBeNull();
    await expect(failing!.present(fixture.input)).resolves.toEqual({
      status: "withheld",
      reason: "invalid-recommendations",
    });
  });

  it("rejects a trusted answer port whose descriptor trap throws", () => {
    const fixture = setup();
    const hostilePort = new Proxy({}, {
      getOwnPropertyDescriptor() {
        throw new Error("hostile descriptor trap");
      },
    });
    expect(createHoidTrustedTopicRecommendationPresenter({
      loadApprovedClaims: fixture.loadApprovedClaims,
      trustedAnswerPort: hostilePort as unknown as HoidTrustedScreenAnswerPort,
      refreshCurrentProgress: () => fixture.progress,
    })).toBeNull();
  });

  it("fails closed when durable progress cannot be refreshed", async () => {
    const fixture = setup({ refresh: () => null });
    await expect(fixture.port.present(fixture.input)).resolves.toEqual({
      status: "withheld",
      reason: "invalid-progress",
    });
    expect(fixture.present).not.toHaveBeenCalled();
  });
});
