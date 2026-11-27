import { describe, expect, it } from "vitest";
import type { HoidKnowledgeEntry, HoidKnowledgeKind } from "./catalog";
import {
  createHoidApprovedClaimAttestation,
  type HoidApprovedClaim,
} from "./approvedClaimIntegrity";
import type { HoidEntityAliasRecord } from "./entityAliasRegistry";
import {
  createHoidCharacterEvolutionExplanationAdapter,
  createHoidCharacterEvolutionIndex,
  createHoidCharacterEvolutionReview,
  getHoidCharacterEvolutionRegistryStatus,
} from "./entityEvolutionExplanation";
import { classifyHoidCharacterEvolutionIntent } from "./entityEvolutionExplanationIntent";
import { createHoidEntityDossierGateway } from "./entityDossierGateway";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";

const NOW = "2026-11-27T04:00:00.000Z";
const SINGLE_SCOPE = Object.freeze({
  mode: "single-work" as const,
  bookIds: Object.freeze(["tfe"]),
});

function makeEntry(
  id: string,
  alias: string,
  kind: HoidKnowledgeKind,
  chapter = 1,
  unlockChapter = Math.max(2, chapter),
): HoidKnowledgeEntry {
  const manifest = getHoidReadingManifest("tfe");
  if (manifest.status !== "ready") throw new Error("Expected a verified fixture manifest");
  const unit = manifest.manifest.units.find(item => item.chapterNumber === chapter);
  if (!unit?.locatorId) throw new Error("Expected an edition-bound fixture locator");
  return Object.freeze({
    id,
    aliases: Object.freeze([alias]) as unknown as string[],
    kind,
    firstSafeAppearance: Object.freeze({ bookId: "tfe", chapter }),
    evidenceSource: Object.freeze({ bookId: "tfe", chapter, locatorId: unit.locatorId }),
    evidenceUnlock: Object.freeze({ bookId: "tfe", chapter: unlockChapter }),
    summary: "Resumen editorial original y sintético para " + alias + ".",
    provenance: "verified" as const,
  });
}

function aliasRecord(entry: HoidKnowledgeEntry): HoidEntityAliasRecord {
  if (!entry.evidenceSource || !entry.evidenceUnlock) throw new Error("Expected source metadata");
  return Object.freeze({
    id: "alias." + entry.id,
    entityId: entry.id,
    alias: entry.aliases[0],
    evidence: Object.freeze([Object.freeze({
      id: "alias-evidence." + entry.id,
      source: entry.evidenceSource,
      unlock: Object.freeze({
        bookId: entry.evidenceUnlock.bookId,
        chapter: entry.evidenceUnlock.chapter,
      }),
    })]),
    review: Object.freeze({
      status: "approved" as const,
      origin: "original-editorial" as const,
      reviewerId: "reviewer.alpha",
      reviewedAt: NOW,
    }),
  });
}

function progress(cursorIndex = 5, revision = 1) {
  const cursor = createHoidReadingCursor("tfe", cursorIndex);
  if (cursor.status !== "ready") throw new Error("Expected a verified reading cursor");
  return Object.freeze({
    schemaVersion: 2,
    revision,
    positions: Object.freeze([
      Object.freeze({ bookId: "tfe", cursor: cursor.cursor }),
    ]),
    updatedAt: NOW,
  });
}

function approvedClaim(
  id: string,
  text: string,
  evidenceIds: readonly string[],
  entityIds: readonly string[],
  knowledge: readonly HoidKnowledgeEntry[],
  intent: "explain" | "context" | "recommend" = "explain",
): HoidApprovedClaim {
  const core = Object.freeze({
    id,
    text,
    intent,
    evidenceIds: Object.freeze([...evidenceIds]),
    entityIds: Object.freeze([...entityIds]),
  });
  const attestation = createHoidApprovedClaimAttestation(core, knowledge, {
    reviewerId: "reviewer.alpha",
    reviewedAt: NOW,
  });
  if (attestation.status !== "valid") {
    throw new Error("Expected valid synthetic claim: " + attestation.reason);
  }
  return Object.freeze({
    ...core,
    integrity: attestation.integrity,
    review: attestation.review,
  });
}

function fixture(options: Readonly<{
  cursor?: number;
  revision?: number;
  intent?: "explain" | "context" | "recommend";
  secondParticipant?: boolean;
}> = {}) {
  let current = progress(options.cursor ?? 5, options.revision ?? 1);
  const character = makeEntry("character.alpha", "Personaje Alfa", "character", 1, 2);
  const evidence = makeEntry("evidence.state", "Fuente de estado", "concept", 2, 3);
  const other = makeEntry("concept.other", "Concepto Beta", "concept", 3, 4);
  const knowledge = Object.freeze([character, evidence, other]);
  const entityIds = options.secondParticipant
    ? Object.freeze([character.id, other.id])
    : Object.freeze([character.id]);
  const evidenceIds = options.secondParticipant
    ? Object.freeze([character.id, other.id])
    : Object.freeze([character.id, evidence.id]);
  const claim = approvedClaim(
    "claim.evolution",
    options.intent === "recommend"
      ? "Una recomendación sintética que no describe un hecho."
      : "El personaje presenta un estado sintético documentado por una fuente revisada.",
    evidenceIds,
    entityIds,
    knowledge,
    options.intent ?? "explain",
  );
  const gateway = createHoidEntityDossierGateway({
    knowledge,
    claims: Object.freeze([claim]),
    aliasEvidence: Object.freeze([
      aliasRecord(character),
      ...(options.secondParticipant ? [aliasRecord(other)] : []),
    ]),
    getCurrentProgress: () => current,
  });
  if (!gateway) throw new Error("Expected a branded local dossier gateway");

  const dossierResult = gateway.getDossier({
    progress: current,
    query: {
      text: "Personaje Alfa",
      kind: "character",
      bookScope: SINGLE_SCOPE,
    },
  });
  const dossierClaim = dossierResult.status === "ready"
    ? dossierResult.dossier.claims[0]
    : undefined;
  const core = Object.freeze({
    id: "evolution.fact",
    characterId: character.id,
    claimId: "claim.evolution",
    dimension: "knowledge" as const,
    evidenceKind: "state" as const,
  });
  const review = dossierClaim
    ? createHoidCharacterEvolutionReview(core, dossierClaim, {
        reviewerId: "reviewer.alpha",
        reviewedAt: NOW,
      })
    : null;
  const index = createHoidCharacterEvolutionIndex(
    review ? [Object.freeze({ ...core, review })] : [],
  );
  if (!index) throw new Error("Expected an evolution index");
  const adapter = createHoidCharacterEvolutionExplanationAdapter({
    gateway,
    index,
    refreshCurrentProgress: async () => current,
  });
  if (!adapter) throw new Error("Expected a character evolution adapter");

  return {
    adapter,
    gateway,
    index,
    character,
    knowledge,
    current,
    setCurrent(value: ReturnType<typeof progress>) { current = value; },
    dossierResult,
    dossierClaim,
    core,
    review,
  };
}

describe("Hoid character evolution intent", () => {
  it("recognizes Spanish evolution questions without fuzzy matching", () => {
    expect(classifyHoidCharacterEvolutionIntent("¿Cómo ha evolucionado Personaje Alfa?")).toEqual({
      status: "ready",
      characterName: "Personaje Alfa",
    });
    expect(classifyHoidCharacterEvolutionIntent("¿Cómo ha evolucionado el personaje de Personaje Alfa?")).toEqual({
      status: "ready",
      characterName: "Personaje Alfa",
    });
    expect(classifyHoidCharacterEvolutionIntent("Evolución del personaje de Personaje Alfa")).toEqual({
      status: "ready",
      characterName: "Personaje Alfa",
    });
    expect(classifyHoidCharacterEvolutionIntent("Evolución de Personaje Alfa hasta ahora")).toEqual({
      status: "ready",
      characterName: "Personaje Alfa",
    });
    expect(classifyHoidCharacterEvolutionIntent("Capacidades de Personaje Alfa")).toEqual({
      status: "ready",
      characterName: "Personaje Alfa",
      dimension: "capability",
    });
  });

  it("recognizes English evolution questions and dimension filters", () => {
    expect(classifyHoidCharacterEvolutionIntent("How has Character Alpha changed?")).toEqual({
      status: "ready",
      characterName: "Character Alpha",
    });
    expect(classifyHoidCharacterEvolutionIntent("Relationships of Character Alpha")).toEqual({
      status: "ready",
      characterName: "Character Alpha",
      dimension: "relationship",
    });
  });

  it("requests a name and rejects malformed or unrelated questions", () => {
    expect(classifyHoidCharacterEvolutionIntent("Evolución de")).toEqual({ status: "needs-name" });
    expect(classifyHoidCharacterEvolutionIntent("¿Cómo ha evolucionado?")).toEqual({ status: "needs-name" });
    expect(classifyHoidCharacterEvolutionIntent("Háblame de Personaje Alfa")).toEqual({ status: "not-evolution" });
    expect(classifyHoidCharacterEvolutionIntent("Evolución de x\u0000")).toEqual({ status: "invalid" });
  });
});

describe("Hoid progress-bound character evolution", () => {
  it("presents only reviewed claims with chapter citations and explicit reading-order semantics", async () => {
    const state = fixture();
    expect(state.dossierResult.status).toBe("ready");
    const result = await state.adapter.answer({
      question: "Evolución de Personaje Alfa",
      progress: state.current,
      bookScope: SINGLE_SCOPE,
      depth: "detailed",
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.characterLabel).toBe("Personaje Alfa");
    expect(result.semantics).toBe("reading-order-evidence");
    expect(result.presentation.text).toContain("Conocimiento · estado documentado");
    expect(result.presentation.citations.map(item => item.chapter)).toEqual([1, 2]);
    expect(result.presentation.citations[0]).not.toHaveProperty("locatorId");
    expect(result.presentation.citations[0]).not.toHaveProperty("evidenceId");
    expect(result.followUpQuestions).toHaveLength(1);
    expect(result.followUpQuestions[0].dimension).toBe("knowledge");
    expect(result.followUpQuestions[0].question).toBe(
      "¿Qué conocimientos de Personaje Alfa están documentados hasta donde has leído?",
    );
    expect(result.followUpQuestions[0].citations.map(item => item.chapter)).toEqual([1, 2]);
    expect(JSON.stringify(result.followUpQuestions[0])).not.toMatch(/evidenceId|locatorId|unlock/i);
  });

  it("does not suggest a dimension without an already-unlocked reviewed claim", async () => {
    const state = fixture();
    const result = await state.adapter.answer({
      question: "Capacidades de Personaje Alfa",
      progress: state.current,
      bookScope: SINGLE_SCOPE,
    });
    expect(result.status).toBe("not-found");
  });

  it("supports a reviewed transition without inventing its wording", async () => {
    const state = fixture();
    if (!state.dossierClaim) throw new Error("Expected an authorized dossier claim");
    const core = Object.freeze({
      id: "evolution.transition",
      characterId: state.character.id,
      claimId: state.dossierClaim.claimId,
      dimension: "perspective" as const,
      evidenceKind: "transition" as const,
    });
    const review = createHoidCharacterEvolutionReview(core, state.dossierClaim, {
      reviewerId: "reviewer.alpha",
      reviewedAt: NOW,
    });
    expect(review).not.toBeNull();
    if (!review) throw new Error("Expected a reviewed transition annotation");
    const index = createHoidCharacterEvolutionIndex([Object.freeze({ ...core, review })]);
    const adapter = createHoidCharacterEvolutionExplanationAdapter({
      gateway: state.gateway,
      index,
      refreshCurrentProgress: async () => state.current,
    });
    if (!adapter) throw new Error("Expected transition adapter");
    const result = await adapter.answer({
      question: "Perspectiva de Personaje Alfa",
      progress: state.current,
      bookScope: SINGLE_SCOPE,
    });
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.presentation.text).toContain("Perspectiva · cambio documentado");
      expect(result.presentation.text).toContain(state.dossierClaim?.text ?? "");
    }
  });

  it("does not promote recommendation claims into evolution facts", async () => {
    const state = fixture({ intent: "recommend" });
    expect(state.review).toBeNull();
    const result = await state.adapter.answer({
      question: "Evolución de Personaje Alfa",
      progress: state.current,
      bookScope: SINGLE_SCOPE,
    });
    expect(result.status).toBe("not-found");
  });

  it("requires two verified participants for a relationship dimension", () => {
    const state = fixture();
    if (!state.dossierClaim) throw new Error("Expected a dossier claim");
    const core = Object.freeze({
      id: "evolution.relationship",
      characterId: state.character.id,
      claimId: state.dossierClaim.claimId,
      dimension: "relationship" as const,
      evidenceKind: "state" as const,
    });
    expect(createHoidCharacterEvolutionReview(core, state.dossierClaim, {
      reviewerId: "reviewer.alpha",
      reviewedAt: NOW,
    })).toBeNull();
  });

  it("requires an explicitly reviewed transition and explain claim for cause annotations", () => {
    const state = fixture({ intent: "context" });
    if (!state.dossierClaim) throw new Error("Expected a dossier claim");
    const core = Object.freeze({
      id: "evolution.cause",
      characterId: state.character.id,
      claimId: state.dossierClaim.claimId,
      dimension: "cause" as const,
      evidenceKind: "transition" as const,
    });
    expect(createHoidCharacterEvolutionReview(core, state.dossierClaim, {
      reviewerId: "reviewer.alpha",
      reviewedAt: NOW,
    })).toBeNull();
  });

  it("keeps unknown and locked character requests neutral", async () => {
    const state = fixture();
    const unknown = await state.adapter.answer({
      question: "Evolución de Personaje Desconocido",
      progress: state.current,
      bookScope: SINGLE_SCOPE,
    });
    expect(unknown.status).toBe("not-found");

    const lockedProgress = progress(2);
    state.setCurrent(lockedProgress);
    const locked = await state.adapter.answer({
      question: "Evolución de Personaje Alfa",
      progress: lockedProgress,
      bookScope: SINGLE_SCOPE,
    });
    expect(locked.status).toBe("not-found");
  });

  it("rejects a stale progress snapshot before dossier retrieval", async () => {
    const state = fixture();
    const adapter = createHoidCharacterEvolutionExplanationAdapter({
      gateway: state.gateway,
      index: state.index,
      refreshCurrentProgress: async () => progress(5, 2),
    });
    if (!adapter) throw new Error("Expected stale-progress adapter");
    const result = await adapter.answer({
      question: "Evolución de Personaje Alfa",
      progress: state.current,
      bookScope: SINGLE_SCOPE,
    });
    expect(result).toEqual({ status: "unavailable", reason: "progress-changed" });
  });

  it("discards a request cancelled before execution", async () => {
    const state = fixture();
    const controller = new AbortController();
    controller.abort();
    const result = await state.adapter.answer({
      question: "Evolución de Personaje Alfa",
      progress: state.current,
      bookScope: SINGLE_SCOPE,
    }, { signal: controller.signal });
    expect(result).toEqual({ status: "unavailable", reason: "cancelled" });
  });

  it("rejects provider-bearing configuration and duplicate annotation identities", () => {
    const state = fixture();
    expect(createHoidCharacterEvolutionExplanationAdapter({
      gateway: state.gateway,
      index: state.index,
      refreshCurrentProgress: () => state.current,
      provider: { send: () => "untrusted" },
    })).toBeNull();
    expect(createHoidCharacterEvolutionIndex([
      Object.freeze({ ...state.core, review: state.review }),
      Object.freeze({ ...state.core, review: state.review }),
    ])).toBeNull();
    if (!state.dossierClaim || !state.review) throw new Error("Expected a reviewed base claim");
    const alternateCore = Object.freeze({
      ...state.core,
      id: "evolution.fact.alternate",
      dimension: "capability" as const,
    });
    const alternateReview = createHoidCharacterEvolutionReview(
      alternateCore,
      state.dossierClaim,
      { reviewerId: "reviewer.alpha", reviewedAt: NOW },
    );
    if (!alternateReview) throw new Error("Expected a second synthetic review");
    expect(createHoidCharacterEvolutionIndex([
      Object.freeze({ ...state.core, review: state.review }),
      Object.freeze({ ...alternateCore, review: alternateReview }),
    ])).toBeNull();
  });

  it("rejects review digest drift at query time", async () => {
    const state = fixture();
    const alteredReview = Object.freeze({
      ...state.review!,
      claimSha256: "0".repeat(64),
      annotationSha256: "0".repeat(64),
    });
    const index = createHoidCharacterEvolutionIndex([
      Object.freeze({ ...state.core, review: alteredReview }),
    ]);
    const adapter = createHoidCharacterEvolutionExplanationAdapter({
      gateway: state.gateway,
      index,
      refreshCurrentProgress: async () => state.current,
    });
    if (!adapter) throw new Error("Expected digest-drift adapter");
    const result = await adapter.answer({
      question: "Evolución de Personaje Alfa",
      progress: state.current,
      bookScope: SINGLE_SCOPE,
    });
    expect(result).toEqual({ status: "unavailable", reason: "invalid-index" });
  });

  it("withholds comparative depth without an individually cross-work claim", async () => {
    const state = fixture();
    const result = await state.adapter.answer({
      question: "Evolución de Personaje Alfa",
      progress: state.current,
      bookScope: SINGLE_SCOPE,
      depth: "comparative",
    });
    expect(result).toEqual({ status: "unavailable", reason: "budget-exceeded" });
  });

  it("keeps the production registry empty", () => {
    expect(getHoidCharacterEvolutionRegistryStatus()).toBe("empty");
  });
});
