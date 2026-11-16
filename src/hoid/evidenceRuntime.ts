import { isKnownHoidSource } from "./bibliography";
import { HoidKnowledgeCatalog, type HoidKnowledgeEntry } from "./catalog";
import { validatedKnowledge } from "./catalogValidation";
import { answerWithinTimeout } from "./providerTimeout";
import { recommendUnstartedSources, type HoidRecommendation } from "./recommendations";
import { retrieveAuthorized } from "./retrieval";
import { validHoidQuestion } from "./requestValidation";
import { validReadingPositions } from "./readingValidation";
import { guardQuestion } from "./spoilerGuard";
import type { HoidAnswerRequest, ReadingPosition } from "./types";

export type HoidClaimIntent = "explain" | "recommend" | "context";

export type HoidApprovedClaim = Readonly<{
  id: string;
  text: string;
  intent: HoidClaimIntent;
  evidenceIds: readonly string[];
  review: Readonly<{
    status: "approved";
    origin: "original-editorial";
    reviewerId: string;
    reviewedAt: string;
  }>;
}>;

export type HoidClaimSelectionCandidate = Readonly<{
  id: string;
  text: string;
  evidenceIds: readonly string[];
}>;

export type HoidClaimSelectionRequest = Readonly<{
  question: string;
  intent: HoidClaimIntent;
  candidates: readonly HoidClaimSelectionCandidate[];
}>;

/**
 * The model is a selector, not an author. It may return only IDs from the
 * already-authorized candidate set; final prose is rendered from the local,
 * editorially approved claim registry.
 */
export interface HoidClaimSelector {
  selectClaims(request: HoidClaimSelectionRequest): Promise<unknown>;
}

export type HoidEvidenceAnswer = Readonly<{
  status: "authorized" | "blocked" | "abstain";
  reason?:
    | "invalid-input"
    | "reading-position"
    | "no-authorized-evidence"
    | "provider-unavailable"
    | "invalid-selection";
  text: string;
  claimIds: readonly string[];
  evidenceIds: readonly string[];
}>;

export type HoidEvidenceRecommendationResult =
  | Readonly<{ status: "ready"; items: readonly HoidRecommendation[] }>
  | Readonly<{ status: "abstain"; reason: "invalid-progress"; items: readonly [] }>;

export type HoidEvidenceRuntimeConfig = Readonly<{
  knowledge: readonly HoidKnowledgeEntry[];
  claims: readonly HoidApprovedClaim[];
  selector?: HoidClaimSelector | null;
  providerTimeoutMs?: number;
}>;

const MAX_KNOWLEDGE_ENTRIES = 512;
const MAX_APPROVED_CLAIMS = 512;
const MAX_CLAIM_ID_LENGTH = 128;
const MAX_CLAIM_TEXT_LENGTH = 4_000;
const MAX_EVIDENCE_IDS_PER_CLAIM = 16;
const MAX_EVIDENCE_ID_LENGTH = 128;
const MAX_CANDIDATES = 32;
const MAX_SELECTED_CLAIMS = 12;
const DEFAULT_SELECTION_TIMEOUT_MS = 10_000;
const MAX_SELECTION_TIMEOUT_MS = 60_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonicalKnowledge(value: unknown): readonly HoidKnowledgeEntry[] | null {
  if (!Array.isArray(value) || value.length > MAX_KNOWLEDGE_ENTRIES) return null;

  const entries: HoidKnowledgeEntry[] = [];
  const validKinds = new Set(["character", "place", "event", "concept", "magic", "organization", "object"]);
  const validProvenance = new Set(["verified", "limited", "unavailable"]);

  for (const raw of value) {
    if (!isRecord(raw) || !isRecord(raw.firstSafeAppearance) || !Array.isArray(raw.aliases)) return null;
    if (typeof raw.id !== "string" || !raw.id.trim() || raw.id.trim().length > MAX_CLAIM_ID_LENGTH) return null;
    if (typeof raw.kind !== "string" || !validKinds.has(raw.kind)) return null;
    if (typeof raw.firstSafeAppearance.bookId !== "string" || !isKnownHoidSource(raw.firstSafeAppearance.bookId)) return null;
    const chapter = raw.firstSafeAppearance.chapter;
    if (typeof chapter !== "number" || !Number.isFinite(chapter) || !Number.isInteger(chapter) || chapter < 0) return null;
    if (raw.aliases.length === 0 || raw.aliases.length > 64 || !raw.aliases.every(alias =>
      typeof alias === "string" && alias.trim().length > 0 && alias.length <= 256
    )) return null;
    if (raw.provenance !== undefined && (typeof raw.provenance !== "string" || !validProvenance.has(raw.provenance))) return null;
    if (raw.summary !== undefined && (typeof raw.summary !== "string" || raw.summary.length > MAX_CLAIM_TEXT_LENGTH)) return null;

    entries.push({
      id: raw.id.trim(),
      aliases: [...raw.aliases] as string[],
      kind: raw.kind as HoidKnowledgeEntry["kind"],
      firstSafeAppearance: { bookId: raw.firstSafeAppearance.bookId, chapter },
      ...(raw.provenance === undefined ? {} : { provenance: raw.provenance as HoidKnowledgeEntry["provenance"] }),
      ...(raw.summary === undefined ? {} : { summary: (raw.summary as string).trim() }),
    });
  }

  const validated = validatedKnowledge(entries);
  if (validated.length !== entries.length) return null;

  return Object.freeze(validated.map(entry => Object.freeze({
    ...entry,
    aliases: Object.freeze([...entry.aliases]) as unknown as string[],
    firstSafeAppearance: Object.freeze({ ...entry.firstSafeAppearance }),
  })));
}
function canonicalClaims(
  value: unknown,
  knowledgeIds: ReadonlySet<string>,
): readonly HoidApprovedClaim[] | null {
  if (!Array.isArray(value) || value.length > MAX_APPROVED_CLAIMS) return null;

  const seen = new Set<string>();
  const claims: HoidApprovedClaim[] = [];

  for (const raw of value) {
    if (!isRecord(raw) || !isRecord(raw.review)) return null;

    const id = typeof raw.id === "string" ? raw.id.trim() : "";
    const text = typeof raw.text === "string" ? raw.text.trim() : "";
    const intent = raw.intent;
    const evidenceIds = raw.evidenceIds;
    const review = raw.review;

    if (!id || id.length > MAX_CLAIM_ID_LENGTH || seen.has(id)) return null;
    if (!text || text.length > MAX_CLAIM_TEXT_LENGTH) return null;
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(text)) return null;
    if (intent !== "explain" && intent !== "recommend" && intent !== "context") return null;
    if (!Array.isArray(evidenceIds) || evidenceIds.length === 0 || evidenceIds.length > MAX_EVIDENCE_IDS_PER_CLAIM) return null;

    const canonicalEvidence: string[] = [];
    const evidenceSeen = new Set<string>();
    for (const rawEvidenceId of evidenceIds) {
      if (typeof rawEvidenceId !== "string") return null;
      const evidenceId = rawEvidenceId.trim();
      if (!evidenceId || evidenceId.length > MAX_EVIDENCE_ID_LENGTH || evidenceSeen.has(evidenceId)) return null;
      if (!knowledgeIds.has(evidenceId)) return null;
      evidenceSeen.add(evidenceId);
      canonicalEvidence.push(evidenceId);
    }

    if (review.status !== "approved" || review.origin !== "original-editorial") return null;
    if (typeof review.reviewerId !== "string" || !review.reviewerId.trim() || review.reviewerId.length > 128) return null;
    if (typeof review.reviewedAt !== "string" || !Number.isFinite(Date.parse(review.reviewedAt))) return null;

    seen.add(id);
    claims.push(Object.freeze({
      id,
      text,
      intent,
      evidenceIds: Object.freeze(canonicalEvidence),
      review: Object.freeze({
        status: "approved",
        origin: "original-editorial",
        reviewerId: review.reviewerId.trim(),
        reviewedAt: review.reviewedAt,
      }),
    }));
  }

  return Object.freeze(claims);
}

function blocked(
  reason: "invalid-input" | "reading-position" | "invalid-selection",
  text: string,
): HoidEvidenceAnswer {
  return Object.freeze({ status: "blocked", reason, text, claimIds: Object.freeze([]), evidenceIds: Object.freeze([]) });
}

function abstain(
  reason: "no-authorized-evidence" | "provider-unavailable",
  text: string,
): HoidEvidenceAnswer {
  return Object.freeze({ status: "abstain", reason, text, claimIds: Object.freeze([]), evidenceIds: Object.freeze([]) });
}

function knownReadingPositions(value: unknown): ReadingPosition[] | null {
  const validated = validReadingPositions(value);
  if (validated === null) return null;
  return validated
    .filter(position => isKnownHoidSource(position.bookId))
    .map(position => Object.freeze({ ...position }));
}

/**
 * Strict application runtime for evidence-bound Hoid responses.
 *
 * Unlike legacy free-text provider paths, this runtime never displays text
 * authored by a model. A provider selects approved claim IDs; Hoid renders the
 * exact original editorial text stored locally.
 */
export class HoidEvidenceRuntime {
  private readonly catalog: HoidKnowledgeCatalog;

  private constructor(
    private readonly knowledge: readonly HoidKnowledgeEntry[],
    private readonly claims: readonly HoidApprovedClaim[],
    private readonly selector: HoidClaimSelector | null,
    private readonly providerTimeoutMs: number,
  ) {
    this.catalog = new HoidKnowledgeCatalog([...knowledge]);
  }

  static create(config: unknown): HoidEvidenceRuntime | null {
    if (!isRecord(config)) return null;

    const knowledge = canonicalKnowledge(config.knowledge);
    if (knowledge === null) return null;

    const knowledgeIds = new Set(knowledge.map(entry => entry.id));
    const claims = canonicalClaims(config.claims, knowledgeIds);
    if (claims === null) return null;

    const selector = config.selector === undefined || config.selector === null
      ? null
      : isRecord(config.selector) && typeof config.selector.selectClaims === "function"
        ? config.selector as unknown as HoidClaimSelector
        : null;
    if (config.selector !== undefined && config.selector !== null && selector === null) return null;

    const timeout = config.providerTimeoutMs === undefined
      ? DEFAULT_SELECTION_TIMEOUT_MS
      : config.providerTimeoutMs;
    if (typeof timeout !== "number" || !Number.isFinite(timeout) || timeout <= 0 || timeout > MAX_SELECTION_TIMEOUT_MS) return null;

    return new HoidEvidenceRuntime(knowledge, claims, selector, Math.ceil(timeout));
  }

  async answer(input: unknown): Promise<HoidEvidenceAnswer> {
    if (!isRecord(input)) {
      return blocked("invalid-input", "La solicitud no tiene un formato válido. Hoid no enviará datos ambiguos a ningún proveedor.");
    }

    const question = validHoidQuestion(input.question);
    const reading = knownReadingPositions(input.reading);
    const intent = input.intent === undefined ? "explain" : input.intent;

    if (question === null || reading === null || (intent !== "explain" && intent !== "recommend" && intent !== "context")) {
      return blocked("invalid-input", "La pregunta, la intención o el progreso no pueden validarse. Hoid no ampliará el contexto.");
    }

    const request: HoidAnswerRequest = { question, reading };
    const explicitGuard = guardQuestion(request);
    if (explicitGuard) return blocked("reading-position", explicitGuard.text);

    if (this.catalog.lockedMatches(question, reading).length > 0) {
      return blocked("reading-position", "Esa pregunta puede revelar información que todavía no has alcanzado. Hoid conservará ese misterio.");
    }

    const authorizedContext = retrieveAuthorized([...this.knowledge], reading, question);
    const authorizedEvidenceIds = new Set(authorizedContext.map(entry => entry.id));
    const candidates = this.claims
      .filter(claim => claim.intent === intent && claim.evidenceIds.every(id => authorizedEvidenceIds.has(id)))
      .slice(0, MAX_CANDIDATES);

    if (candidates.length === 0) {
      return abstain("no-authorized-evidence", "No hay afirmaciones editoriales verificadas y autorizadas para esta pregunta y tu progreso. Hoid no inventará una explicación.");
    }

    if (!this.selector) {
      return abstain("provider-unavailable", "No hay un selector de IA configurado. Hoid conserva las evidencias autorizadas sin generar contenido.");
    }

    const selectionRequest: HoidClaimSelectionRequest = Object.freeze({
      question,
      intent,
      candidates: Object.freeze(candidates.map(claim => Object.freeze({
        id: claim.id,
        text: claim.text,
        evidenceIds: Object.freeze([...claim.evidenceIds]),
      }))),
    });

    const rawSelection = await answerWithinTimeout(
      Promise.resolve().then(() => this.selector!.selectClaims(selectionRequest)),
      this.providerTimeoutMs,
    );

    if (rawSelection === null) {
      return abstain("provider-unavailable", "El selector no está disponible o ha superado el tiempo límite. Hoid no completará la respuesta por su cuenta.");
    }
    if (!Array.isArray(rawSelection) || rawSelection.length === 0 || rawSelection.length > MAX_SELECTED_CLAIMS) {
      return blocked("invalid-selection", "El proveedor devolvió una selección inválida. No se mostrará contenido sin verificar.");
    }

    const selectedIds: string[] = [];
    const selectedSet = new Set<string>();
    const candidateIds = new Set(candidates.map(claim => claim.id));
    for (const rawId of rawSelection) {
      if (typeof rawId !== "string") return blocked("invalid-selection", "La selección contiene identificadores no válidos.");
      const id = rawId.trim();
      if (!id || id.length > MAX_CLAIM_ID_LENGTH || selectedSet.has(id) || !candidateIds.has(id)) {
        return blocked("invalid-selection", "La selección contiene una afirmación desconocida o repetida. No se mostrará contenido.");
      }
      selectedSet.add(id);
      selectedIds.push(id);
    }

    // Render in editorial registry order, not provider order. The provider
    // cannot rewrite, append, or reorder narrative prose.
    const selectedClaims = candidates.filter(claim => selectedSet.has(claim.id));
    if (selectedClaims.length !== selectedIds.length) {
      return blocked("invalid-selection", "No se ha podido reconciliar la selección con el registro editorial.");
    }

    const evidenceIds = [...new Set(selectedClaims.flatMap(claim => claim.evidenceIds))].sort();
    return Object.freeze({
      status: "authorized",
      text: selectedClaims.map(claim => claim.text).join("\n\n"),
      claimIds: Object.freeze(selectedClaims.map(claim => claim.id)),
      evidenceIds: Object.freeze(evidenceIds),
    });
  }

  recommend(readingInput: unknown, limit = 3): HoidEvidenceRecommendationResult {
    const reading = knownReadingPositions(readingInput);
    if (reading === null) {
      return Object.freeze({ status: "abstain", reason: "invalid-progress", items: Object.freeze([]) as readonly [] });
    }
    return Object.freeze({
      status: "ready",
      items: Object.freeze(recommendUnstartedSources(reading, limit)),
    });
  }
}

export function createHoidEvidenceRuntime(config: unknown): HoidEvidenceRuntime | null {
  return HoidEvidenceRuntime.create(config);
}
