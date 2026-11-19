import { isKnownHoidSource } from "./bibliography";
import { isHoidKnowledgeKind } from "./knowledgeKinds";
import { canonicalEvidenceScope, evidenceCitationFor, isEvidenceUnlocked, type HoidEvidenceCitation } from "./evidenceScope";
import { HoidKnowledgeCatalog, type HoidKnowledgeEntry } from "./catalog";
import { validatedKnowledge } from "./catalogValidation";
import { answerWithinTimeout } from "./providerTimeout";
import { recommendUnstartedSources, type HoidRecommendation } from "./recommendations";
import { retrieveAuthorized } from "./retrieval";
import { validHoidQuestion } from "./requestValidation";
import { validEditionBoundReadingPositions } from "./editionProgressValidation";
import { guardQuestion } from "./spoilerGuard";
import { getHoidReadingManifest } from "./readingManifest";
import type { HoidAnswerRequest, ReadingPosition } from "./types";
import {
  validateHoidApprovedClaimAttestation,
  type HoidApprovedClaim as AttestedHoidApprovedClaim,
  type HoidApprovedClaimIntent,
} from "./approvedClaimIntegrity";

export type HoidClaimIntent = HoidApprovedClaimIntent;
export type HoidApprovedClaim = AttestedHoidApprovedClaim;

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
  reason: "no-authorized-evidence" | "provider-unavailable",
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
    if (evidenceIds.length > MAX_SELECTED_EVIDENCE_IDS) {
      return blocked("invalid-selection", "La respuesta requiere demasiadas evidencias para conservar una trazabilidad completa. Hoid no reducirá las fuentes de forma silenciosa.");
    }
    const knowledgeById = new Map(this.knowledge.map(entry => [entry.id, entry]));
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
    return Object.freeze({
      status: "authorized",
      text: selectedClaims.map(claim => claim.text).join("\n\n"),
      claimIds: Object.freeze(selectedClaims.map(claim => claim.id)),
      evidenceIds: Object.freeze(evidenceIds),
      sources: Object.freeze(sources as HoidEvidenceCitation[]),
      segments: Object.freeze(segments),
      layout: "plain",
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
