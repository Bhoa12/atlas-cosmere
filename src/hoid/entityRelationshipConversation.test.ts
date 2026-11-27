import { describe, expect, it, vi } from "vitest";
import type { HoidKnowledgeEntry, HoidKnowledgeKind } from "./catalog";
import {
  createHoidApprovedClaimAttestation,
  type HoidApprovedClaim,
} from "./approvedClaimIntegrity";
import type { HoidEntityAliasRecord } from "./entityAliasRegistry";
import { createHoidEntityDossierGateway } from "./entityDossierGateway";
import { createHoidEntityRelationshipConversationAdapter } from "./entityRelationshipConversation";
import { createHoidReadingCursor } from "./readingManifest";

const NOW = "2026-11-27T00:00:00.000Z";
const CROSS_SCOPE = Object.freeze({
  mode: "cross-work" as const,
  bookIds: Object.freeze(["tfe", "twok"]),
});

function makeEntry(
  id: string,
  alias: string,
  bookId: string,
  chapter: number,
  unlockChapter: number,
  kind: HoidKnowledgeKind = "character",
): HoidKnowledgeEntry {
  const manifest = requireManifest(bookId);
  const unit = manifest.units.find(item => item.chapterNumber === chapter);
  if (!unit?.locatorId) throw new Error("Expected a verified fixture locator");
  return Object.freeze({
    id,
    aliases: Object.freeze([alias]) as unknown as string[],
    kind,
    firstSafeAppearance: Object.freeze({ bookId, chapter }),
    evidenceSource: Object.freeze({ bookId, chapter, locatorId: unit.locatorId }),
    evidenceUnlock: Object.freeze({ bookId, chapter: unlockChapter }),
    summary: "Resumen editorial original y sintético para " + alias + ".",
    provenance: "verified" as const,
  });
}

function requireManifest(bookId: string) {
  const { getHoidReadingManifest } = requireReadingManifest();
  const result = getHoidReadingManifest(bookId);
  if (result.status !== "ready") throw new Error("Expected a verified fixture manifest");
  return result.manifest;
}

function requireReadingManifest() {
  return { getHoidReadingManifest };
}

import { getHoidReadingManifest } from "./readingManifest";

function aliasRecord(entry: HoidKnowledgeEntry): HoidEntityAliasRecord {
  if (!entry.evidenceSource || !entry.evidenceUnlock) throw new Error("Expected source metadata");
  return Object.freeze({
    id: "alias." + entry.id,
    entityId: entry.id,
    alias: entry.aliases[0],
    evidence: Object.freeze([Object.freeze({
      id: "alias-evidence." + entry.id,
      source: entry.evidenceSource,
      unlock: entry.evidenceUnlock,
    })]),
    review: Object.freeze({
      status: "approved" as const,
      origin: "original-editorial" as const,
      reviewerId: "reviewer.alpha",
      reviewedAt: NOW,
    }),
  });
}

function approvedClaim(
  id: string,
  text: string,
  knowledge: readonly HoidKnowledgeEntry[],
  evidenceIds: readonly string[],
  entityIds: readonly string[],
): HoidApprovedClaim {
  const core = Object.freeze({
    id,
    text,
    intent: "explain" as const,
    evidenceIds: Object.freeze([...evidenceIds]),
    entityIds: Object.freeze([...entityIds]),
  });
  const result = createHoidApprovedClaimAttestation(core, knowledge, {
    reviewerId: "reviewer.alpha",
    reviewedAt: NOW,
  });
  if (result.status !== "valid") {
    throw new Error("Expected a valid synthetic relationship attestation: " + result.reason);
  }
  return Object.freeze({ ...core, integrity: result.integrity, review: result.review });
}

function progressAcrossWorks(twokCursor = 3, revision = 1) {
  const tfe = createHoidReadingCursor("tfe", 3);
  const twok = createHoidReadingCursor("twok", twokCursor);
  if (tfe.status !== "ready" || twok.status !== "ready") {
    throw new Error("Expected verified multi-work cursors");
  }
  return Object.freeze({
    schemaVersion: 2,
    revision,
    positions: Object.freeze([
      Object.freeze({ bookId: "tfe", cursor: tfe.cursor }),
      Object.freeze({ bookId: "twok", cursor: twok.cursor }),
    ]),
    updatedAt: NOW,
  });
}

function fixture(options: Readonly<{
  knowledge: readonly HoidKnowledgeEntry[];
  claims?: readonly HoidApprovedClaim[];
  aliases?: readonly HoidEntityAliasRecord[];
  current?: unknown;
  refresh?: () => unknown | Promise<unknown>;
}>): Readonly<{
  gateway: NonNullable<ReturnType<typeof createHoidEntityDossierGateway>>;
  adapter: NonNullable<ReturnType<typeof createHoidEntityRelationshipConversationAdapter>>;
  current: unknown;
}> {
  const current = options.current ?? progressAcrossWorks();
  const gateway = createHoidEntityDossierGateway({
    knowledge: options.knowledge,
    claims: options.claims ?? [],
    aliasEvidence: options.aliases ?? options.knowledge.map(aliasRecord),
    getCurrentProgress: () => current,
  });
  if (!gateway) throw new Error("Expected a branded dossier gateway");
  const adapter = createHoidEntityRelationshipConversationAdapter({
    gateway,
    refreshCurrentProgress: options.refresh ?? (async () => current),
  });
  if (!adapter) throw new Error("Expected a relationship adapter");
  return Object.freeze({ gateway, adapter, current });
}

function pairFixture(twokCursor = 3, revision = 1) {
  const alpha = makeEntry("entity.alpha", "Entidad Alfa", "tfe", 1, 1);
  const beta = makeEntry("entity.beta", "Entidad Beta", "twok", 2, 2);
  const knowledge = Object.freeze([alpha, beta]);
  const claim = approvedClaim(
    "claim.alpha-beta",
    "Entidad Alfa y Entidad Beta comparten una conexión editorial sintética.",
    knowledge,
    [alpha.id, beta.id],
    [alpha.id, beta.id],
  );
  const current = progressAcrossWorks(twokCursor, revision);
  return fixture({
    knowledge,
    claims: [claim],
    aliases: [aliasRecord(alpha), aliasRecord(beta)],
    current,
  });
}

describe("Hoid entity relationship conversation adapter", () => {
  it("projects only the same approved cross-work claim present in both dossiers", async () => {
    const { adapter, current } = pairFixture();
    const result = await adapter.answer({
      question: "¿Qué relación hay entre Entidad Alfa y Entidad Beta?",
      progress: current,
      bookScope: CROSS_SCOPE,
      depth: "detailed",
    });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.presentation.text).toContain("conexión editorial sintética");
    expect(result.presentation.citations.map(item => item.sourceBookId).sort()).toEqual(["tfe", "twok"]);
    expect(result.presentation.citations.map(item => item.title)).toContain("El Imperio Final");
    expect(result.presentation.citations.map(item => item.title)).toContain("El Camino de los Reyes");
    expect(JSON.stringify(result)).not.toContain("evidenceId");
    expect(JSON.stringify(result)).not.toContain("locatorId");
    expect(JSON.stringify(result)).not.toContain("unlockChapter");
    expect(JSON.stringify(result)).not.toContain("providerEgress");
  });

  it("returns the same neutral not-found result when either entity is locked or unknown", async () => {
    const { adapter, current } = pairFixture(2);
    const locked = await adapter.answer({
      question: "Relación entre Entidad Alfa y Entidad Beta",
      progress: current,
      bookScope: CROSS_SCOPE,
    });
    const unknown = await adapter.answer({
      question: "Relación entre Entidad Alfa y Entidad Fantasma",
      progress: current,
      bookScope: CROSS_SCOPE,
    });
    expect(locked).toEqual({ status: "not-found" });
    expect(unknown).toEqual(locked);
  });

  it("does not infer a relationship from two dossiers without a shared approved claim", async () => {
    const alpha = makeEntry("entity.alpha", "Entidad Alfa", "tfe", 1, 1);
    const beta = makeEntry("entity.beta", "Entidad Beta", "twok", 2, 2);
    const { adapter, current } = fixture({
      knowledge: [alpha, beta],
      aliases: [aliasRecord(alpha), aliasRecord(beta)],
    });
    expect(await adapter.answer({
      question: "Relación entre Entidad Alfa y Entidad Beta",
      progress: current,
      bookScope: CROSS_SCOPE,
    })).toEqual({ status: "not-found" });
  });

  it("requires one individual claim segment to cite multiple works for comparative depth", async () => {
    const alpha = makeEntry("entity.alpha", "Entidad Alfa", "tfe", 1, 1);
    const beta = makeEntry("entity.beta", "Entidad Beta", "tfe", 2, 2);
    const knowledge = Object.freeze([alpha, beta]);
    const claim = approvedClaim(
      "claim.same-work",
      "Entidad Alfa y Entidad Beta comparten una conexión editorial sintética.",
      knowledge,
      [alpha.id, beta.id],
      [alpha.id, beta.id],
    );
    const current = progressAcrossWorks();
    const { adapter } = fixture({
      knowledge,
      claims: [claim],
      aliases: [aliasRecord(alpha), aliasRecord(beta)],
      current,
    });

    const detailed = await adapter.answer({
      question: "Relación entre Entidad Alfa y Entidad Beta",
      progress: current,
      bookScope: CROSS_SCOPE,
      depth: "detailed",
    });
    expect(detailed.status).toBe("ready");

    const comparative = await adapter.answer({
      question: "Relación entre Entidad Alfa y Entidad Beta",
      progress: current,
      bookScope: CROSS_SCOPE,
      depth: "comparative",
    });
    expect(comparative).toEqual({ status: "unavailable", reason: "budget-exceeded" });
  });

  it("allows comparative depth when one relationship claim is backed by both works", async () => {
    const { adapter, current } = pairFixture();
    const result = await adapter.answer({
      question: "Relación entre Entidad Alfa y Entidad Beta",
      progress: current,
      bookScope: CROSS_SCOPE,
      depth: "comparative",
    });
    expect(result.status).toBe("ready");
  });

  it("discards a relationship when durable progress changes during the two-dossier read", async () => {
    const first = progressAcrossWorks(3, 1);
    const second = progressAcrossWorks(4, 2);
    const alpha = makeEntry("entity.alpha", "Entidad Alfa", "tfe", 1, 1);
    const beta = makeEntry("entity.beta", "Entidad Beta", "twok", 2, 2);
    const knowledge = Object.freeze([alpha, beta]);
    const claim = approvedClaim(
      "claim.alpha-beta",
      "Entidad Alfa y Entidad Beta comparten una conexión editorial sintética.",
      knowledge,
      [alpha.id, beta.id],
      [alpha.id, beta.id],
    );
    let reads = 0;
    const { adapter } = fixture({
      knowledge,
      claims: [claim],
      aliases: [aliasRecord(alpha), aliasRecord(beta)],
      current: first,
      refresh: async () => {
        reads += 1;
        return reads === 1 ? first : second;
      },
    });
    expect(await adapter.answer({
      question: "Relación entre Entidad Alfa y Entidad Beta",
      progress: first,
      bookScope: CROSS_SCOPE,
    })).toEqual({ status: "unavailable", reason: "progress-changed" });
  });

  it("rejects provider-bearing configuration and unbranded gateway objects", () => {
    const alpha = makeEntry("entity.alpha", "Entidad Alfa", "tfe", 1, 1);
    const beta = makeEntry("entity.beta", "Entidad Beta", "twok", 2, 2);
    const { gateway, current } = fixture({ knowledge: [alpha, beta] });
    expect(createHoidEntityRelationshipConversationAdapter({
      gateway,
      refreshCurrentProgress: () => current,
      provider: { invoke: vi.fn() },
    })).toBeNull();
    expect(createHoidEntityRelationshipConversationAdapter({
      gateway: { getDossier: vi.fn() },
      refreshCurrentProgress: () => current,
    })).toBeNull();
  });

  it("handles cancellation and malformed relationship requests without provider fallback", async () => {
    const { adapter, current } = pairFixture();
    const controller = new AbortController();
    controller.abort();
    expect(await adapter.answer({
      question: "Relación entre Entidad Alfa y Entidad Beta",
      progress: current,
      bookScope: CROSS_SCOPE,
    }, { signal: controller.signal })).toEqual({
      status: "unavailable",
      reason: "cancelled",
    });
    expect(await adapter.answer({
      question: "Relación entre Entidad Alfa y Entidad Beta y Entidad Gamma",
      progress: current,
      bookScope: CROSS_SCOPE,
    })).toEqual({ status: "unavailable", reason: "invalid-request" });
  });
});
