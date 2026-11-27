import { describe, expect, it, vi } from "vitest";
import type { HoidKnowledgeEntry, HoidKnowledgeKind } from "./catalog";
import {
  createHoidApprovedClaimAttestation,
  type HoidApprovedClaim,
} from "./approvedClaimIntegrity";
import type { HoidEntityAliasRecord } from "./entityAliasRegistry";
import { createHoidEntityDossierGateway } from "./entityDossierGateway";
import {
  createHoidMagicSystemExplanationAdapter,
  createHoidMagicSystemFactIndex,
  createHoidMagicSystemFactReview,
  getHoidMagicSystemFactRegistryStatus,
} from "./magicSystemExplanation";
import { classifyHoidMagicSystemExplanationIntent } from "./magicSystemExplanationIntent";
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
  knowledge: readonly HoidKnowledgeEntry[],
  intent: "explain" | "context" | "recommend" = "explain",
): HoidApprovedClaim {
  const core = Object.freeze({
    id,
    text,
    intent,
    evidenceIds: Object.freeze(["magic.system", "evidence.rule"]),
    entityIds: Object.freeze(["magic.system"]),
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
  intent?: "explain" | "context" | "recommend";
  kind?: HoidKnowledgeKind;
}> = {}) {
  let current = progress(options.cursor ?? 5);
  const system = makeEntry(
    "magic.system",
    "Sistema Alfa",
    options.kind ?? "magic",
    1,
    2,
  );
  const evidence = makeEntry("evidence.rule", "Fuente de regla", "concept", 2, 3);
  const knowledge = Object.freeze([system, evidence]);
  const claim = approvedClaim(
    "claim.rule",
    "El sistema sigue una regla sintética revisada.",
    knowledge,
    options.intent ?? "explain",
  );
  const gateway = createHoidEntityDossierGateway({
    knowledge,
    claims: Object.freeze([claim]),
    aliasEvidence: Object.freeze([aliasRecord(system)]),
    getCurrentProgress: () => current,
  });
  if (!gateway) throw new Error("Expected a branded local dossier gateway");

  const dossierResult = gateway.getDossier({
    progress: current,
    query: {
      text: "Sistema Alfa",
      kind: "magic",
      bookScope: SINGLE_SCOPE,
    },
  });
  const dossierClaim = dossierResult.status === "ready"
    ? dossierResult.dossier.claims[0]
    : undefined;

  const core = Object.freeze({
    id: "fact.rule",
    magicSystemId: "magic.system",
    claimId: "claim.rule",
    facet: "rule" as const,
  });
  const review = dossierClaim
    ? createHoidMagicSystemFactReview(core, dossierClaim, {
        reviewerId: "reviewer.alpha",
        reviewedAt: NOW,
      })
    : null;
  const index = createHoidMagicSystemFactIndex(
    review ? [Object.freeze({ ...core, review })] : [],
  );
  if (!index) throw new Error("Expected a fact index");
  const adapter = createHoidMagicSystemExplanationAdapter({
    gateway,
    factIndex: index,
    refreshCurrentProgress: async () => current,
  });
  if (!adapter) throw new Error("Expected a magic-system explanation adapter");

  return {
    adapter,
    gateway,
    index,
    system,
    knowledge,
    current,
    setCurrent(value: ReturnType<typeof progress>) { current = value; },
    dossierResult,
    dossierClaim,
    core,
    review,
  };
}

describe("Hoid magic-system explanation intent", () => {
  it("recognizes exact Spanish facet questions", () => {
    expect(classifyHoidMagicSystemExplanationIntent("Reglas de Sistema Alfa")).toEqual({
      status: "ready",
      systemName: "Sistema Alfa",
      facet: "rule",
    });
    expect(classifyHoidMagicSystemExplanationIntent("¿Cómo funciona Sistema Alfa?")).toEqual({
      status: "ready",
      systemName: "Sistema Alfa",
      facet: "principle",
    });
    expect(classifyHoidMagicSystemExplanationIntent("Limitaciones de Sistema Alfa")).toEqual({
      status: "ready",
      systemName: "Sistema Alfa",
      facet: "limitation",
    });
  });

  it("recognizes English questions and does not fuzzy-match ordinary prose", () => {
    expect(classifyHoidMagicSystemExplanationIntent("How does Sistema Alfa work?")).toEqual({
      status: "ready",
      systemName: "Sistema Alfa",
      facet: "principle",
    });
    expect(classifyHoidMagicSystemExplanationIntent("What are the rules of Sistema Alfa")).toEqual({
      status: "ready",
      systemName: "Sistema Alfa",
      facet: "rule",
    });
    expect(classifyHoidMagicSystemExplanationIntent("Tell me something interesting")).toEqual({
      status: "not-magic",
    });
  });

  it("distinguishes missing names and malformed questions", () => {
    expect(classifyHoidMagicSystemExplanationIntent("Reglas de")).toEqual({ status: "needs-name" });
    expect(classifyHoidMagicSystemExplanationIntent("Reglas de \u0000")).toEqual({ status: "invalid" });
  });
});

describe("Hoid progress-bound magic-system explanations", () => {
  it("builds a cited explanation from an approved magic-system claim", async () => {
    const { adapter, dossierResult } = fixture();
    expect(dossierResult.status).toBe("ready");
    const result = await adapter.answer({
      question: "Reglas de Sistema Alfa",
      progress: progress(),
      bookScope: SINGLE_SCOPE,
      depth: "detailed",
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.systemLabel).toBe("Sistema Alfa");
    expect(result.facet).toBe("rule");
    expect(result.presentation.text).toContain("Regla: El sistema sigue una regla sintética revisada.");
    expect(result.presentation.citations).toEqual([expect.objectContaining({
      sourceBookId: "tfe",
      title: "El Imperio Final",
      chapter: 2,
    })]);
    expect(JSON.stringify(result)).not.toContain("locatorId");
    expect(JSON.stringify(result)).not.toContain("evidenceId");
    expect(JSON.stringify(result)).not.toContain("unlockChapter");
    expect(JSON.stringify(result)).not.toContain("providerEgress");
  });

  it("returns the same neutral result for an unknown system and a locked fact", async () => {
    const locked = fixture({ cursor: 3 });
    const lockedResult = await locked.adapter.answer({
      question: "Reglas de Sistema Alfa",
      progress: progress(3),
      bookScope: SINGLE_SCOPE,
    });
    expect(lockedResult).toEqual({ status: "not-found" });

    const unknown = await locked.adapter.answer({
      question: "Reglas de Sistema Desconocido",
      progress: progress(3),
      bookScope: SINGLE_SCOPE,
    });
    expect(unknown).toEqual({ status: "not-found" });
  });

  it("requires the resolved entity to be a magic-system entity", async () => {
    const { adapter } = fixture({ kind: "character" });
    expect(await adapter.answer({
      question: "Reglas de Sistema Alfa",
      progress: progress(),
      bookScope: SINGLE_SCOPE,
    })).toEqual({ status: "not-found" });
  });

  it("never promotes recommendation claims into magic-system facts", async () => {
    const { dossierClaim } = fixture({ intent: "recommend" });
    expect(dossierClaim).toBeUndefined();
    expect(createHoidMagicSystemFactReview(
      {
        id: "fact.recommend",
        magicSystemId: "magic.system",
        claimId: "claim.rule",
        facet: "rule",
      },
      {
        claimId: "claim.rule",
        intent: "recommend",
        text: "Synthetic recommendation.",
        participants: [{ id: "magic.system", kind: "magic", label: "Sistema Alfa" }],
        sources: [{
          evidenceId: "magic.system",
          sourceBookId: "tfe",
          sourceChapter: 1,
          locatorId: "chapter-1",
          unlockBookId: "tfe",
          unlockChapter: 2,
        }],
      },
      { reviewerId: "reviewer.alpha", reviewedAt: NOW },
    )).toBeNull();
  });

  it("rejects tampered annotation digests", async () => {
    const { gateway, dossierClaim, core } = fixture();
    expect(dossierClaim).toBeDefined();
    if (!dossierClaim) return;
    const review = createHoidMagicSystemFactReview(core, dossierClaim, {
      reviewerId: "reviewer.alpha",
      reviewedAt: NOW,
    });
    expect(review).not.toBeNull();
    if (!review) return;
    const index = createHoidMagicSystemFactIndex([{
      ...core,
      review: { ...review, annotationSha256: "0".repeat(64) },
    }]);
    expect(index).not.toBeNull();
    if (!index) return;
    const adapter = createHoidMagicSystemExplanationAdapter({
      gateway,
      factIndex: index,
      refreshCurrentProgress: async () => progress(),
    });
    expect(adapter).not.toBeNull();
    if (!adapter) return;
    expect(await adapter.answer({
      question: "Reglas de Sistema Alfa",
      progress: progress(),
      bookScope: SINGLE_SCOPE,
    })).toEqual({ status: "unavailable", reason: "invalid-index" });
  });

  it("discards the complete answer when durable progress changes during projection", async () => {
    const { gateway, index } = fixture();
    const snapshots = [progress(), progress(6, 2)];
    const refresh = vi.fn(async () => snapshots.shift() ?? progress(6, 2));
    const adapter = createHoidMagicSystemExplanationAdapter({
      gateway,
      factIndex: index,
      refreshCurrentProgress: refresh,
    });
    if (!adapter) throw new Error("Expected adapter");
    expect(await adapter.answer({
      question: "Reglas de Sistema Alfa",
      progress: progress(),
      bookScope: SINGLE_SCOPE,
    })).toEqual({ status: "unavailable", reason: "progress-changed" });
  });

  it("honors cancellation and rejects provider-bearing or unbranded configuration", async () => {
    const { gateway, index, adapter } = fixture();
    const controller = new AbortController();
    controller.abort();
    expect(await adapter.answer({
      question: "Reglas de Sistema Alfa",
      progress: progress(),
      bookScope: SINGLE_SCOPE,
    }, { signal: controller.signal })).toEqual({
      status: "unavailable",
      reason: "cancelled",
    });

    expect(createHoidMagicSystemExplanationAdapter({
      gateway,
      factIndex: index,
      refreshCurrentProgress: async () => progress(),
      provider: { complete: vi.fn() },
    })).toBeNull();
    expect(createHoidMagicSystemExplanationAdapter({
      gateway: { getDossier: () => ({ status: "not-found" }) },
      factIndex: index,
      refreshCurrentProgress: async () => progress(),
    })).toBeNull();
  });

  it("does not claim production facts before editorial promotion", () => {
    expect(getHoidMagicSystemFactRegistryStatus()).toBe("empty");
  });
});
