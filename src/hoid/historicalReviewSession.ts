import {
  reinspectHoidHistoricalSourceChapter,
  type HoidHistoricalSourceReinspectionResult,
} from "./historicalSourceReinspection";

type ReinspectionInput = Parameters<typeof reinspectHoidHistoricalSourceChapter>[0];
type ReinspectionOperation = (input: ReinspectionInput) => Promise<HoidHistoricalSourceReinspectionResult>;

export type HoidHistoricalReviewSessionLease = Readonly<{
  scope: "hoid-local-source-session";
  generation: number;
}>;

export type HoidHistoricalReviewHandoff = Readonly<{
  schemaVersion: 1;
  scope: "session-bound-local-editorial-handoff";
  sessionGeneration: number;
  workId: string;
  editionId: string;
  chapterNumber: number;
  verifiedAt: string;
  sourceAvailability: "verified-local";
  sourceContentIncluded: false;
  sourceTextPersisted: false;
  reviewWorkspaceAvailable: true;
  summaryCreated: false;
  productionWritePerformed: false;
  authorizationEffect: "none";
  editorialEffect: "none";
  spoilerAuthorization: "none";
}>;

export type HoidHistoricalReviewDraft = Readonly<{
  schemaVersion: 1;
  scope: "ephemeral-local-editorial-draft";
  workId: string;
  editionId: string;
  chapterNumber: number;
  summaryText: string;
  originalityAttested: true;
  reviewState: "awaiting-human-editorial-review";
  sourceContentIncluded: false;
  sourceTextPersisted: false;
  productionWritePerformed: false;
  authorizationEffect: "none";
  editorialEffect: "none";
  spoilerAuthorization: "none";
}>;

export type HoidHistoricalReviewVerification =
  | Readonly<{ status: "ready"; handoff: HoidHistoricalReviewHandoff }>
  | Readonly<{
      status: "changed";
      reason: "document-digest-mismatch" | "document-length-mismatch";
    }>
  | Readonly<{ status: "rejected"; reason: string }>
  | Readonly<{ status: "stale-session" }>;

export type HoidHistoricalReviewDraftResult =
  | Readonly<{ status: "saved-in-memory"; draft: HoidHistoricalReviewDraft }>
  | Readonly<{
      status: "rejected";
      reason: "stale-session" | "originality-not-confirmed" | "invalid-summary";
    }>;

export interface HoidHistoricalReviewSessionController {
  beginSession(identity: unknown): HoidHistoricalReviewSessionLease | null;
  isCurrent(lease: unknown): lease is HoidHistoricalReviewSessionLease;
  invalidate(lease?: unknown): void;
  verifyAndBind(
    lease: HoidHistoricalReviewSessionLease,
    input: ReinspectionInput,
  ): Promise<HoidHistoricalReviewVerification>;
  saveDraft(
    handoff: HoidHistoricalReviewHandoff,
    summaryText: unknown,
    originalityConfirmed: unknown,
  ): HoidHistoricalReviewDraftResult;
  getDraft(handoff: HoidHistoricalReviewHandoff): HoidHistoricalReviewDraft | null;
  discardDraft(handoff: HoidHistoricalReviewHandoff): boolean;
}

const IDENTITY_KEYS = ["sourceId", "workId", "editionId"] as const;
const SOURCE_KEYS = ["sourceId", "workId", "editionId", "sourceGroup"] as const;
const MIN_SUMMARY_LENGTH = 80;
const MAX_SUMMARY_LENGTH = 3_000;

function exactDataRecord(value: unknown, expectedKeys: readonly string[]): Record<string, unknown> | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== expectedKeys.length || keys.some(key => typeof key !== "string")) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of expectedKeys) {
      const descriptor = descriptors[key];
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) {
        return null;
      }
      result[key] = descriptor.value;
    }
    if (keys.some(key => !expectedKeys.includes(key as string))) return null;
    return result;
  } catch {
    return null;
  }
}

function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128 &&
    /^[A-Za-z0-9._:-]+$/.test(value);
}

/**
 * Binds a verified historical-chapter handoff to one active, device-local EPUB
 * session. The controller deliberately has no persistence or provider port.
 * Releasing/changing the source, changing work/edition, changing reading
 * progress, or unmounting the owning screen must invalidate the lease.
 *
 * Original summaries remain ephemeral drafts in memory. They are never sent
 * to a model/provider and never become production knowledge or spoiler
 * authorization through this controller.
 */
export function createHoidHistoricalReviewSessionController(
  reinspection: ReinspectionOperation = reinspectHoidHistoricalSourceChapter,
): HoidHistoricalReviewSessionController {
  let generation = 0;
  let activeLease: HoidHistoricalReviewSessionLease | null = null;
  let activeIdentity: Readonly<{ sourceId: string; workId: string; editionId: string }> | null = null;
  let handoffLeases = new WeakMap<object, HoidHistoricalReviewSessionLease>();
  let drafts = new WeakMap<object, HoidHistoricalReviewDraft>();

  const isCurrent = (lease: unknown): lease is HoidHistoricalReviewSessionLease =>
    activeLease !== null && lease === activeLease;

  const invalidate = (lease?: unknown): void => {
    if (lease !== undefined && !isCurrent(lease)) return;
    activeLease = null;
    activeIdentity = null;
    handoffLeases = new WeakMap<object, HoidHistoricalReviewSessionLease>();
    drafts = new WeakMap<object, HoidHistoricalReviewDraft>();
    generation += 1;
  };

  return Object.freeze({
    beginSession(identityInput: unknown): HoidHistoricalReviewSessionLease | null {
      const identity = exactDataRecord(identityInput, IDENTITY_KEYS);
      if (
        identity === null ||
        !validIdentifier(identity.sourceId) ||
        !validIdentifier(identity.workId) ||
        !validIdentifier(identity.editionId)
      ) return null;

      invalidate();
      generation += 1;
      activeIdentity = Object.freeze({
        sourceId: identity.sourceId,
        workId: identity.workId,
        editionId: identity.editionId,
      });
      activeLease = Object.freeze({
        scope: "hoid-local-source-session",
        generation,
      });
      return activeLease;
    },

    isCurrent,

    invalidate,

    async verifyAndBind(lease, input): Promise<HoidHistoricalReviewVerification> {
      if (!isCurrent(lease) || activeIdentity === null) {
        return Object.freeze({ status: "stale-session" });
      }

      const source = exactDataRecord(input.source, SOURCE_KEYS);
      if (
        source === null ||
        source.sourceId !== activeIdentity.sourceId ||
        source.workId !== activeIdentity.workId ||
        source.editionId !== activeIdentity.editionId
      ) return Object.freeze({ status: "rejected", reason: "session-source-mismatch" });

      let result: HoidHistoricalSourceReinspectionResult;
      try {
        result = await reinspection(input);
      } catch {
        return isCurrent(lease)
          ? Object.freeze({ status: "rejected", reason: "inspection-failed" })
          : Object.freeze({ status: "stale-session" });
      }

      if (!isCurrent(lease)) return Object.freeze({ status: "stale-session" });
      if (result.status === "changed") {
        return Object.freeze({ status: "changed", reason: result.reason });
      }
      if (result.status === "rejected") {
        return Object.freeze({ status: "rejected", reason: result.reason });
      }

      if (
        result.attestation.workId !== activeIdentity.workId ||
        result.attestation.editionId !== activeIdentity.editionId ||
        result.attestation.reviewCanStart !== true ||
        result.attestation.authorizationEffect !== "none" ||
        result.attestation.editorialEffect !== "none"
      ) return Object.freeze({ status: "rejected", reason: "attestation-session-mismatch" });

      const handoff: HoidHistoricalReviewHandoff = Object.freeze({
        schemaVersion: 1,
        scope: "session-bound-local-editorial-handoff",
        sessionGeneration: lease.generation,
        workId: result.attestation.workId,
        editionId: result.attestation.editionId,
        chapterNumber: result.attestation.chapterNumber,
        verifiedAt: result.attestation.verifiedAt,
        sourceAvailability: "verified-local",
        sourceContentIncluded: false,
        sourceTextPersisted: false,
        reviewWorkspaceAvailable: true,
        summaryCreated: false,
        productionWritePerformed: false,
        authorizationEffect: "none",
        editorialEffect: "none",
        spoilerAuthorization: "none",
      });
      handoffLeases.set(handoff, lease);
      return Object.freeze({ status: "ready", handoff });
    },

    saveDraft(handoff, summaryInput, originalityConfirmed): HoidHistoricalReviewDraftResult {
      const lease = handoffLeases.get(handoff);
      if (!lease || !isCurrent(lease)) return Object.freeze({ status: "rejected", reason: "stale-session" });
      if (originalityConfirmed !== true) {
        return Object.freeze({ status: "rejected", reason: "originality-not-confirmed" });
      }
      if (
        typeof summaryInput !== "string" ||
        summaryInput.includes("\u0000") ||
        /<(?:!doctype|html|body|script|style)\b/i.test(summaryInput) ||
        /(?:file|content):\/\//i.test(summaryInput)
      ) return Object.freeze({ status: "rejected", reason: "invalid-summary" });

      const summaryText = summaryInput.trim();
      if (summaryText.length < MIN_SUMMARY_LENGTH || summaryText.length > MAX_SUMMARY_LENGTH) {
        return Object.freeze({ status: "rejected", reason: "invalid-summary" });
      }

      const draft: HoidHistoricalReviewDraft = Object.freeze({
        schemaVersion: 1,
        scope: "ephemeral-local-editorial-draft",
        workId: handoff.workId,
        editionId: handoff.editionId,
        chapterNumber: handoff.chapterNumber,
        summaryText,
        originalityAttested: true,
        reviewState: "awaiting-human-editorial-review",
        sourceContentIncluded: false,
        sourceTextPersisted: false,
        productionWritePerformed: false,
        authorizationEffect: "none",
        editorialEffect: "none",
        spoilerAuthorization: "none",
      });
      drafts.set(handoff, draft);
      return Object.freeze({ status: "saved-in-memory", draft });
    },

    getDraft(handoff): HoidHistoricalReviewDraft | null {
      const lease = handoffLeases.get(handoff);
      if (!lease || !isCurrent(lease)) return null;
      return drafts.get(handoff) ?? null;
    },

    discardDraft(handoff): boolean {
      const lease = handoffLeases.get(handoff);
      if (!lease || !isCurrent(lease)) return false;
      return drafts.delete(handoff);
    },
  });
}
