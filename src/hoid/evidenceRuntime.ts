import { isKnownHoidSource } from "./bibliography";
import { isHoidKnowledgeKind } from "./knowledgeKinds";
import { canonicalEvidenceScope, evidenceCitationFor, isEvidenceUnlocked, type HoidEvidenceCitation } from "./evidenceScope";
import { HoidKnowledgeCatalog, type HoidKnowledgeEntry } from "./catalog";
import { validatedKnowledge } from "./catalogValidation";
import { invokeWithProviderDeadline } from "./providerTimeout";
import { recommendReadingNextSteps, type HoidRecommendation } from "./recommendations";
import { retrieveAuthorized } from "./retrieval";
import { validHoidQuestion } from "./requestValidation";
import { validEditionBoundReadingPositions } from "./editionProgressValidation";
import { guardQuestion } from "./spoilerGuard";
import { getHoidReadingManifest } from "./readingManifest";
import type { HoidAnswerRequest, HoidAnswerSelectionBudget, ReadingPosition } from "./types";
import {
  createHoidClaimSelectionRequest,
  parseHoidClaimSelectionResponse,
  type HoidClaimSelectionRequest,
} from "./selectionProtocol";
export type { HoidClaimSelectionCandidate, HoidClaimSelectionRequest, HoidClaimSelectionResponse } from "./selectionProtocol";
import {
  validateHoidApprovedClaimAttestation,
  type HoidApprovedClaim as AttestedHoidApprovedClaim,
  type HoidApprovedClaimIntent,
} from "./approvedClaimIntegrity";

export type HoidClaimIntent = HoidApprovedClaimIntent;
export type HoidApprovedClaim = AttestedHoidApprovedClaim;

/**
 * The model is a selector, not an author. It may return only IDs from the
 * already-authorized candidate set; final prose is rendered from the local,
 * editorially approved claim registry.
 */
export type HoidClaimSelectionContext = Readonly<{
  /** Cooperative cancellation signal; adapters should pass it to their transport. */
  signal: AbortSignal;
}>;

export type HoidRuntimeCallOptions = Readonly<{
  /** Cancels this invocation without changing the reading snapshot or its permissions. */
  signal?: AbortSignal;
}>;

export interface HoidClaimSelector {
  selectClaims(
    request: HoidClaimSelectionRequest,
    context: HoidClaimSelectionContext,
  ): Promise<unknown>;
}

export type HoidEvidenceAnswerSegment = Readonly<{
  claimId: string;
  text: string;
  evidenceIds: readonly string[];
}>;

export type HoidEvidenceAnswer = Readonly<{
  status: "authorized" | "blocked" | "abstain";
  reason?:
    | "invalid-input"
    | "reading-position"
    | "no-authorized-evidence"
    | "provider-unavailable"
    | "request-cancelled"
    | "invalid-selection";
  text: string;
  claimIds: readonly string[];
  evidenceIds: readonly string[];
  sources: readonly HoidEvidenceCitation[];
  /** Present only when the answer preserves a validated claim-to-evidence map. */
  segments?: readonly HoidEvidenceAnswerSegment[];
  layout?: "plain" | "numbered" | "grouped";
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
const MAX_ENTITY_IDS = 8;
const ENTITY_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const MAX_CANDIDATES = 32;
const MAX_SELECTED_CLAIMS = 12;
const MAX_SELECTED_EVIDENCE_IDS = 16;
const DEFAULT_SELECTION_TIMEOUT_MS = 10_000;
const MAX_SELECTION_TIMEOUT_MS = 60_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const SELECTION_BUDGET_KEYS = [
  "maxClaims",
  "maxEvidence",
  "maxWorks",
  "maxCharacters",
  "minimumWorks",
  "requireSegmentProvenance",
  "requireCrossWorkSegment",
] as const;

const DEFAULT_SELECTION_BUDGET: HoidAnswerSelectionBudget = Object.freeze({
  maxClaims: MAX_SELECTED_CLAIMS,
  maxEvidence: MAX_SELECTED_EVIDENCE_IDS,
  maxWorks: 4,
  maxCharacters: 32_000,
  minimumWorks: 1,
  requireSegmentProvenance: true,
  requireCrossWorkSegment: false,
});

/** Accept only a closed budget bounded by runtime hard limits. */
function canonicalSelectionBudget(value: unknown): HoidAnswerSelectionBudget | null {
  if (value === undefined) return DEFAULT_SELECTION_BUDGET;
  try {
    if (!isRecord(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== SELECTION_BUDGET_KEYS.length) return null;

    const record = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !(SELECTION_BUDGET_KEYS as readonly string[]).includes(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      record[key] = descriptor.value;
    }
    for (const key of SELECTION_BUDGET_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(record, key)) return null;
    }

    const maxClaims = record.maxClaims;
    const maxEvidence = record.maxEvidence;
    const maxWorks = record.maxWorks;
    const maxCharacters = record.maxCharacters;
    const minimumWorks = record.minimumWorks;
    const requireSegmentProvenance = record.requireSegmentProvenance;
    const requireCrossWorkSegment = record.requireCrossWorkSegment;
    if (
      typeof maxClaims !== "number" || !Number.isSafeInteger(maxClaims) || maxClaims < 1 || maxClaims > MAX_SELECTED_CLAIMS ||
      typeof maxEvidence !== "number" || !Number.isSafeInteger(maxEvidence) || maxEvidence < 1 || maxEvidence > MAX_SELECTED_EVIDENCE_IDS ||
      typeof maxWorks !== "number" || !Number.isSafeInteger(maxWorks) || maxWorks < 1 || maxWorks > 4 ||
      typeof maxCharacters !== "number" || !Number.isSafeInteger(maxCharacters) || maxCharacters < 1 || maxCharacters > 32_000 ||
      typeof minimumWorks !== "number" || !Number.isSafeInteger(minimumWorks) || minimumWorks < 1 || minimumWorks > maxWorks ||
      typeof requireSegmentProvenance !== "boolean" ||
      typeof requireCrossWorkSegment !== "boolean" ||
      (requireCrossWorkSegment && !requireSegmentProvenance)
    ) return null;

    return Object.freeze({
      maxClaims,
      maxEvidence,
      maxWorks,
      maxCharacters,
      minimumWorks,
      requireSegmentProvenance,
      requireCrossWorkSegment,
    });
  } catch {
    return null;
  }
}

function canonicalKnowledge(value: unknown): readonly HoidKnowledgeEntry[] | null {
  if (!Array.isArray(value) || value.length > MAX_KNOWLEDGE_ENTRIES) return null;

  const entries: HoidKnowledgeEntry[] = [];
  const validProvenance = new Set(["verified", "limited", "unavailable"]);

  for (const raw of value) {
    if (!isRecord(raw) || !isRecord(raw.firstSafeAppearance) || !Array.isArray(raw.aliases)) return null;
    const evidenceScope = canonicalEvidenceScope(raw.evidenceSource, raw.evidenceUnlock);
    if (!evidenceScope) return null;
    if (typeof raw.id !== "string" || !raw.id.trim() || raw.id.trim().length > MAX_CLAIM_ID_LENGTH) return null;
    if (!isHoidKnowledgeKind(raw.kind)) return null;
    const firstAppearanceBookId = typeof raw.firstSafeAppearance.bookId === "string"
      ? raw.firstSafeAppearance.bookId.trim()
      : "";
    if (!firstAppearanceBookId || !isKnownHoidSource(firstAppearanceBookId)) return null;
    const chapter = raw.firstSafeAppearance.chapter;
    if (typeof chapter !== "number" || !Number.isSafeInteger(chapter) || chapter < 1) return null;
    const firstAppearanceManifest = getHoidReadingManifest(firstAppearanceBookId);
    if (
      firstAppearanceManifest.status !== "ready" ||
      !firstAppearanceManifest.manifest.units.some(unit => unit.chapterNumber === chapter)
    ) return null;
    if (raw.aliases.length === 0 || raw.aliases.length > 64 || !raw.aliases.every(alias =>
      typeof alias === "string" && alias.trim().length > 0 && alias.length <= 256
    )) return null;
    if (raw.provenance !== undefined && (typeof raw.provenance !== "string" || !validProvenance.has(raw.provenance))) return null;
    if (raw.summary !== undefined && (typeof raw.summary !== "string" || raw.summary.length > MAX_CLAIM_TEXT_LENGTH)) return null;

    entries.push({
      id: raw.id.trim(),
      aliases: [...raw.aliases] as string[],
      kind: raw.kind as HoidKnowledgeEntry["kind"],
      firstSafeAppearance: { bookId: firstAppearanceBookId, chapter },
      evidenceSource: { bookId: evidenceScope.sourceBookId, chapter: evidenceScope.sourceChapter, locatorId: evidenceScope.locatorId },
      evidenceUnlock: { bookId: evidenceScope.unlockBookId, chapter: evidenceScope.unlockChapter },
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
    evidenceSource: Object.freeze({ ...entry.evidenceSource! }),
    evidenceUnlock: Object.freeze({ ...entry.evidenceUnlock! }),
  })));
}
function canonicalClaims(
  value: unknown,
  knowledge: readonly HoidKnowledgeEntry[],
): readonly HoidApprovedClaim[] | null {
  if (!Array.isArray(value) || value.length > MAX_APPROVED_CLAIMS) return null;
  try {
    if (Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;

    const seen = new Set<string>();
    const claims: HoidApprovedClaim[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      const attestation = validateHoidApprovedClaimAttestation(descriptor.value, knowledge);
      if (attestation.status !== "valid" || seen.has(attestation.claim.id)) return null;
      seen.add(attestation.claim.id);
      claims.push(attestation.claim);
    }
    return Object.freeze(claims);
  } catch {
    return null;
  }
}

function canonicalEntityIds(
  value: unknown,
  knownIds: ReadonlySet<string>,
): readonly string[] | null {
  try {
    if (!Array.isArray(value) || value.length < 1 || value.length > MAX_ENTITY_IDS) return null;
    if (Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;

    const ids: string[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true ||
        typeof descriptor.value !== "string"
      ) return null;
      const id = descriptor.value;
      if (
        id !== id.trim() ||
        !ENTITY_ID_PATTERN.test(id) ||
        seen.has(id) ||
        !knownIds.has(id)
      ) return null;
      seen.add(id);
      ids.push(id);
    }
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length) {
        return null;
      }
    }
    return Object.freeze(ids);
  } catch {
    return null;
  }
}

function blocked(
  reason: "invalid-input" | "reading-position" | "invalid-selection",
  text: string,
): HoidEvidenceAnswer {
  return Object.freeze({ status: "blocked", reason, text, claimIds: Object.freeze([]), evidenceIds: Object.freeze([]), sources: Object.freeze([]) });
}

function abstain(
  reason: "no-authorized-evidence" | "provider-unavailable" | "request-cancelled",
  text: string,
): HoidEvidenceAnswer {
  return Object.freeze({ status: "abstain", reason, text, claimIds: Object.freeze([]), evidenceIds: Object.freeze([]), sources: Object.freeze([]) });
}

function knownReadingPositions(value: unknown): ReadingPosition[] | null {
  const validated = validEditionBoundReadingPositions(value);
  if (validated === null) return null;
  return validated.map(position => Object.freeze({ ...position }));
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

    const claims = canonicalClaims(config.claims, knowledge);
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

  /**
   * Render one exact, already-approved recommendation claim by ID. This path
   * is intentionally selector-free: the assignment registry chooses the ID,
   * while the runtime independently rechecks every evidence and unlock scope.
   */
  renderApprovedClaimById(claimIdInput: unknown, readingInput: unknown): HoidEvidenceAnswer {
    if (
      typeof claimIdInput !== "string" ||
      claimIdInput !== claimIdInput.trim() ||
      claimIdInput.length < 1 ||
      claimIdInput.length > MAX_CLAIM_ID_LENGTH ||
      !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u.test(claimIdInput)
    ) {
      return blocked("invalid-input", "El identificador de la afirmación no es válido.");
    }

    const reading = knownReadingPositions(readingInput);
    if (reading === null) {
      return blocked("invalid-input", "El progreso de lectura no puede verificarse.");
    }

    const claim = this.claims.find(item => item.id === claimIdInput && item.intent === "recommend");
    if (!claim) {
      return abstain("no-authorized-evidence", "No existe una afirmación de recomendación aprobada para ese identificador.");
    }

    const authorizedContextIds = new Set(this.catalog.entriesForContext(reading).map(entry => entry.id));
    const knowledgeById = new Map(this.knowledge.map(entry => [entry.id, entry]));
    const evidence = claim.evidenceIds.map(id => knowledgeById.get(id));
    if (evidence.some((entry, index) =>
      !entry ||
      entry.id !== claim.evidenceIds[index] ||
      !authorizedContextIds.has(entry.id) ||
      !isEvidenceUnlocked(entry, reading)
    )) {
      return abstain("no-authorized-evidence", "No todas las evidencias de la afirmación están desbloqueadas.");
    }

    const evidenceIds = [...claim.evidenceIds].sort();
    const sources = evidenceIds.map(id => {
      const entry = knowledgeById.get(id);
      return entry ? evidenceCitationFor(entry) : null;
    });
    if (sources.some(source => source === null)) {
      return abstain("no-authorized-evidence", "No se puede reconstruir toda la procedencia documental.");
    }

    const frozenEvidenceIds = Object.freeze(evidenceIds);
    const segment = Object.freeze({
      claimId: claim.id,
      text: claim.text,
      evidenceIds: frozenEvidenceIds,
    });
    return Object.freeze({
      status: "authorized",
      text: claim.text,
      claimIds: Object.freeze([claim.id]),
      evidenceIds: frozenEvidenceIds,
      sources: Object.freeze(sources as HoidEvidenceCitation[]),
      segments: Object.freeze([segment]),
      layout: "plain",
    });
  }

  async answer(input: unknown, options?: HoidRuntimeCallOptions): Promise<HoidEvidenceAnswer> {
    if (!isRecord(input)) {
      return blocked("invalid-input", "La solicitud no tiene un formato válido. Hoid no enviará datos ambiguos a ningún proveedor.");
    }

    const question = validHoidQuestion(input.question);
    const reading = knownReadingPositions(input.reading);
    const intent = input.intent === undefined ? "explain" : input.intent;

    if (question === null || reading === null || (intent !== "explain" && intent !== "recommend" && intent !== "context")) {
      return blocked("invalid-input", "La pregunta, la intención o el progreso no pueden validarse. Hoid no ampliará el contexto.");
    }

    let rawSelectionBudget: unknown;
    try {
      const descriptor = Object.getOwnPropertyDescriptor(input, "selectionBudget");
      if (descriptor && (
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      )) return blocked("invalid-input", "El presupuesto de explicación no puede validarse.");
      rawSelectionBudget = descriptor?.value;
    } catch {
      return blocked("invalid-input", "El presupuesto de explicación no puede validarse.");
    }
    const selectionBudget = canonicalSelectionBudget(rawSelectionBudget);
    if (!selectionBudget) {
      return blocked("invalid-input", "El presupuesto de explicación no puede validarse.");
    }

    let entityIds: readonly string[] | undefined;
    try {
      const descriptor = Object.getOwnPropertyDescriptor(input, "entityIds");
      if (descriptor) {
        if (
          !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          descriptor.enumerable !== true
        ) return blocked("invalid-input", "El ámbito de entidades no puede validarse. Hoid no ampliará el contexto.");
        const knownIds = new Set(this.knowledge.map(entry => entry.id));
        const canonicalIds = canonicalEntityIds(descriptor.value, knownIds);
        if (!canonicalIds) {
          return blocked("invalid-input", "El ámbito de entidades no puede validarse. Hoid no ampliará el contexto.");
        }
        entityIds = canonicalIds;
      }
    } catch {
      return blocked("invalid-input", "El ámbito de entidades no puede validarse. Hoid no ampliará el contexto.");
    }

    const request: HoidAnswerRequest = { question, reading };
    const explicitGuard = guardQuestion(request);
    if (explicitGuard) return blocked("reading-position", explicitGuard.text);

    if (this.catalog.lockedMatches(question, reading).length > 0) {
      return blocked("reading-position", "Esa pregunta puede revelar información que todavía no has alcanzado. Hoid conservará ese misterio.");
    }

    // firstSafeAppearance protects entity mentions; evidenceUnlock separately protects
    // the full editorial summary. A short alias threshold must never authorize
    // a summary that contains later-chapter detail.
    const authorizedContext = retrieveAuthorized([...this.knowledge], reading, question)
      .filter(entry => isEvidenceUnlocked(entry, reading));
    const authorizedEvidenceIds = new Set(authorizedContext.map(entry => entry.id));
    const candidates = this.claims
      .filter(claim =>
        claim.intent === intent &&
        claim.evidenceIds.every(id => authorizedEvidenceIds.has(id)) &&
        (entityIds === undefined || entityIds.every(id => claim.entityIds?.includes(id) === true))
      )
      .slice(0, MAX_CANDIDATES);

    if (candidates.length === 0) {
      return abstain("no-authorized-evidence", "No hay afirmaciones editoriales verificadas y autorizadas para esta pregunta y tu progreso. Hoid no inventará una explicación.");
    }

    if (!this.selector) {
      return abstain("provider-unavailable", "No hay un selector de IA configurado. Hoid conserva las evidencias autorizadas sin generar contenido.");
    }

    const selectionRequest = createHoidClaimSelectionRequest({
      question,
      intent,
      reading,
      selectionBudget,
      candidates: candidates.map(claim => ({
        id: claim.id,
        text: claim.text,
        evidenceIds: claim.evidenceIds,
      })),
    });

    const invocation = await invokeWithProviderDeadline(
      signal => this.selector!.selectClaims(selectionRequest, Object.freeze({ signal })),
      this.providerTimeoutMs,
      options?.signal,
    );

    if (invocation.status === "aborted") {
      return abstain("request-cancelled", "La solicitud se ha cancelado. Hoid no mostrará una respuesta parcial ni reutilizará resultados tardíos.");
    }
    if (invocation.status !== "completed") {
      return abstain("provider-unavailable", "El selector no está disponible o ha superado el tiempo límite. Hoid no completará la respuesta por su cuenta.");
    }
    const rawSelection = invocation.value;
    const selectedIds = parseHoidClaimSelectionResponse(
      rawSelection,
      selectionRequest,
      Math.min(MAX_SELECTED_CLAIMS, selectionBudget.maxClaims),
    );
    if (!selectedIds) {
      return blocked("invalid-selection", "El selector devolvió una respuesta sin versión o vinculada a otra solicitud. No se mostrará contenido.");
    }

    const selectedSet = new Set<string>();
    const candidateIds = new Set(candidates.map(claim => claim.id));
    for (const id of selectedIds) {
      if (!candidateIds.has(id)) {
        return blocked("invalid-selection", "La selección contiene una afirmación desconocida. No se mostrará contenido.");
      }
      selectedSet.add(id);
    }

    // Render in editorial registry order, not provider order. The provider
    // cannot rewrite, append, or reorder narrative prose.
    const selectedClaims = candidates.filter(claim => selectedSet.has(claim.id));
    if (selectedClaims.length !== selectedIds.length) {
      return blocked("invalid-selection", "No se ha podido reconciliar la selección con el registro editorial.");
    }

    const evidenceIds = [...new Set(selectedClaims.flatMap(claim => claim.evidenceIds))].sort();
    if (evidenceIds.length > Math.min(MAX_SELECTED_EVIDENCE_IDS, selectionBudget.maxEvidence)) {
      return blocked("invalid-selection", "La respuesta supera el presupuesto de evidencias. Hoid no reducirá las fuentes de forma silenciosa.");
    }
    const knowledgeById = new Map(this.knowledge.map(entry => [entry.id, entry]));
    const selectedEntries = evidenceIds.map(id => knowledgeById.get(id));
    if (selectedEntries.some(entry => !entry || !entry.evidenceSource)) {
      return blocked("invalid-selection", "No se puede reconstruir toda la procedencia documental.");
    }
    const selectedWorkIds = new Set(selectedEntries.map(entry => entry!.evidenceSource!.bookId));
    const selectedText = selectedClaims.map(claim => claim.text).join("\n\n");
    if (
      selectedWorkIds.size < selectionBudget.minimumWorks ||
      selectedWorkIds.size > selectionBudget.maxWorks ||
      selectedText.length > selectionBudget.maxCharacters
    ) {
      return blocked("invalid-selection", "La respuesta supera el presupuesto de profundidad solicitado. Hoid no recortará afirmaciones ni evidencias.");
    }
    if (selectionBudget.requireCrossWorkSegment && !selectedClaims.some(claim => {
      const claimWorkIds = new Set<string>();
      for (const id of claim.evidenceIds) {
        const sourceBookId = knowledgeById.get(id)?.evidenceSource?.bookId;
        if (sourceBookId) claimWorkIds.add(sourceBookId);
      }
      return claimWorkIds.size >= 2;
    })) {
      return blocked("invalid-selection", "La comparación no tiene una afirmación con procedencia cruzada suficiente.");
    }
    const sources = evidenceIds.map(id => {
      const entry = knowledgeById.get(id);
      return entry ? evidenceCitationFor(entry) : null;
    });
    if (sources.some(source => source === null)) {
      return blocked("invalid-selection", "La procedencia de una evidencia no se puede reconstruir. No se mostrará la respuesta.");
    }
    const segments = selectedClaims.map(claim => Object.freeze({
      claimId: claim.id,
      text: claim.text,
      evidenceIds: Object.freeze([...claim.evidenceIds]),
    }));
    if (selectionBudget.requireSegmentProvenance && (
      segments.length !== selectedClaims.length ||
      segments.some((segment, index) =>
        segment.claimId !== selectedClaims[index].id ||
        segment.evidenceIds.length !== selectedClaims[index].evidenceIds.length ||
        segment.evidenceIds.some((id, evidenceIndex) => id !== selectedClaims[index].evidenceIds[evidenceIndex])
      )
    )) {
      return blocked("invalid-selection", "La selección no conserva la procedencia por afirmación.");
    }
    return Object.freeze({
      status: "authorized",
      text: selectedText,
      claimIds: Object.freeze(selectedClaims.map(claim => claim.id)),
      evidenceIds: Object.freeze(evidenceIds),
      sources: Object.freeze(sources as HoidEvidenceCitation[]),
      segments: Object.freeze(segments),
      layout: "plain",
    });
  }

  recommend(readingInput: unknown, limit = 3, activeBookId?: string): HoidEvidenceRecommendationResult {
    const reading = knownReadingPositions(readingInput);
    if (reading === null) {
      return Object.freeze({ status: "abstain", reason: "invalid-progress", items: Object.freeze([]) as readonly [] });
    }
    return Object.freeze({
      status: "ready",
      items: Object.freeze(recommendReadingNextSteps(reading, limit, activeBookId)),
    });
  }
}

export function createHoidEvidenceRuntime(config: unknown): HoidEvidenceRuntime | null {
  return HoidEvidenceRuntime.create(config);
}
