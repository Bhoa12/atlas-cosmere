import { describe, expect, it, vi } from "vitest";
import type { HoidKnowledgeEntry, HoidKnowledgeKind } from "./catalog";
import {
  createHoidApprovedClaimAttestation,
  type HoidApprovedClaim,
} from "./approvedClaimIntegrity";
import type { HoidEntityAliasRecord } from "./entityAliasRegistry";
import {
  createHoidEntityDossierGateway,
} from "./entityDossierGateway";
import {
  createHoidEntityDossierConversationAdapter,
} from "./entityDossierConversation";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";

const NOW = "2026-11-26T22:30:00.000Z";
const SINGLE_SCOPE = Object.freeze({ mode: "single-work" as const, bookIds: Object.freeze(["tfe"]) });

function makeEntry(
  id: string,
  alias: string,
  bookId: string,
  kind: HoidKnowledgeKind = "character",
  chapter = 1,
  unlockChapter = 2,
): HoidKnowledgeEntry {
  const manifest = getHoidReadingManifest(bookId);
  if (manifest.status !== "ready") throw new Error("Expected a fixture manifest");
  const unit = manifest.manifest.units.find(item => item.chapterNumber === chapter);
  if (!unit?.locatorId) throw new Error("Expected a fixture locator");
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

function aliasRecord(entry: HoidKnowledgeEntry, unlockOverride?: number): HoidEntityAliasRecord {
  if (!entry.evidenceSource || !entry.evidenceUnlock) throw new Error("Expected source metadata");
  const alias = entry.aliases[0];
  return Object.freeze({
    id: "alias." + entry.id,
    entityId: entry.id,
    alias,
    evidence: Object.freeze([Object.freeze({
      id: "alias-evidence." + entry.id,
      source: entry.evidenceSource,
      unlock: Object.freeze({
        bookId: entry.evidenceUnlock.bookId,
        chapter: unlockOverride ?? entry.evidenceUnlock.chapter,
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
  if (result.status !== "valid") throw new Error("Expected a valid synthetic claim attestation: " + result.reason);
  return Object.freeze({ ...core, integrity: result.integrity, review: result.review });
}

function progress(bookId = "tfe", chapter = 3, revision = 1) {
  const result = createHoidReadingCursor(bookId, chapter);
  if (result.status !== "ready") throw new Error("Expected a fixture cursor");
  return Object.freeze({
    schemaVersion: 2,
    revision,
    positions: Object.freeze([Object.freeze({ bookId, cursor: result.cursor })]),
    updatedAt: NOW,
  });
}

function progressAcrossWorks(revision = 1) {
  const tfe = createHoidReadingCursor("tfe", 3);
  const twok = createHoidReadingCursor("twok", 3);
  if (tfe.status !== "ready" || twok.status !== "ready") throw new Error("Expected multi-work cursors");
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
  claims?: readonly HoidApprovedClaim[];
  knowledge?: readonly HoidKnowledgeEntry[];
  aliases?: readonly HoidEntityAliasRecord[];
  current?: unknown;
}> = {}) {
  const entity = makeEntry("entity.vin", "Vin", "tfe");
  const knowledge = options.knowledge ?? Object.freeze([entity]);
  const aliases = options.aliases ?? Object.freeze([aliasRecord(entity)]);
  const current = options.current ?? progress();
  const gateway = createHoidEntityDossierGateway({
    knowledge,
    claims: options.claims ?? [],
    aliasEvidence: aliases,
    getCurrentProgress: () => current,
  });
  if (!gateway) throw new Error("Expected a dossier gateway");
  const adapter = createHoidEntityDossierConversationAdapter({
    gateway,
    refreshCurrentProgress: async () => current,
  });
  if (!adapter) throw new Error("Expected a dossier conversation adapter");
  return { entity, knowledge, aliases, current, gateway, adapter };
}

describe("Hoid entity dossier conversation adapter", () => {
  it("routes an exact entity question to the local dossier without a provider port", async () => {
    const { adapter } = fixture();
    const result = await adapter.answer({
      question: "¿Quién es Vin?",
      progress: progress(),
      bookScope: SINGLE_SCOPE,
      depth: "detailed",
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.presentation.text).toContain("Expediente de Vin");
    expect(result.presentation.text).toContain("Resumen editorial original");
    expect(result.presentation.citations).toEqual([expect.objectContaining({
      sourceBookId: "tfe",
      title: "El Imperio Final",
      chapter: 1,
    })]);
    expect(JSON.stringify(result)).not.toContain("locatorId");
    expect(JSON.stringify(result)).not.toContain("evidenceId");
    expect(JSON.stringify(result)).not.toContain("unlockChapter");
    expect(JSON.stringify(result)).not.toContain("providerEgress");
  });

  it("does not refresh progress or call the gateway for ordinary explanations and missing-name prompts", async () => {
    const { gateway } = fixture();
    const refresh = vi.fn(async () => progress());
    const adapter = createHoidEntityDossierConversationAdapter({
      gateway,
      refreshCurrentProgress: refresh,
    });
    if (!adapter) throw new Error("Expected adapter");
    expect(await adapter.answer({
      question: "¿Cómo funciona este sistema de magia?",
      progress: progress(),
      bookScope: SINGLE_SCOPE,
    })).toEqual({ status: "not-dossier" });
    expect(await adapter.answer({
      question: "¿Quién es?",
      progress: progress(),
      bookScope: SINGLE_SCOPE,
    })).toEqual({ status: "needs-name" });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("keeps unknown and locked aliases indistinguishable", async () => {
    const { entity, knowledge, aliases } = fixture();
    const lockedProgress = progress("tfe", 2);
    const lockedGateway = createHoidEntityDossierGateway({
      knowledge,
      claims: [],
      aliasEvidence: aliases,
      getCurrentProgress: () => lockedProgress,
    });
    if (!lockedGateway) throw new Error("Expected locked gateway");
    const adapter = createHoidEntityDossierConversationAdapter({
      gateway: lockedGateway,
      refreshCurrentProgress: async () => lockedProgress,
    });
    if (!adapter) throw new Error("Expected adapter");

    const locked = await adapter.answer({
      question: "¿Quién es Vin?",
      progress: lockedProgress,
      bookScope: SINGLE_SCOPE,
    });
    const unknown = await adapter.answer({
      question: "¿Quién es un nombre inexistente?",
      progress: lockedProgress,
      bookScope: SINGLE_SCOPE,
    });
    expect(locked).toEqual({ status: "not-found" });
    expect(unknown).toEqual(locked);
    expect(entity.id).toBe("entity.vin");
  });

  it("rejects a dossier whose source is outside the selected book scope", async () => {
    const { adapter } = fixture();
    const result = await adapter.answer({
      question: "¿Quién es Vin?",
      progress: progress(),
      bookScope: Object.freeze({ mode: "single-work", bookIds: Object.freeze(["twok"]) }),
    });
    expect(result).toEqual({ status: "not-found" });
  });

  it("enforces the requested explanation budget without truncating dependent claims", async () => {
    const entity = makeEntry("entity.vin", "Vin", "tfe");
    const knowledge = Object.freeze([entity]);
    const claims = Object.freeze([
      approvedClaim("claim.one", "Afirmación sintética uno.", knowledge, [entity.id], [entity.id]),
      approvedClaim("claim.two", "Afirmación sintética dos.", knowledge, [entity.id], [entity.id]),
      approvedClaim("claim.three", "Afirmación sintética tres.", knowledge, [entity.id], [entity.id]),
    ]);
    const { adapter } = fixture({ knowledge, claims, aliases: [aliasRecord(entity)] });
    const result = await adapter.answer({
      question: "¿Quién es Vin?",
      progress: progress(),
      bookScope: SINGLE_SCOPE,
      depth: "brief",
    });
    expect(result).toEqual({ status: "unavailable", reason: "budget-exceeded" });
  });

  it("requires multiple source works for comparative dossier depth", async () => {
    const { adapter } = fixture();
    const result = await adapter.answer({
      question: "¿Quién es Vin?",
      progress: progress(),
      bookScope: SINGLE_SCOPE,
      depth: "comparative",
    });
    expect(result).toEqual({ status: "unavailable", reason: "budget-exceeded" });
  });

  it("requires one claim segment to carry evidence from at least two works for comparative depth", async () => {
    const entity = makeEntry("entity.vin", "Vin", "tfe");
    const supporting = makeEntry("evidence.context", "Contexto", "twok", "concept", 2, 2);
    const knowledge = Object.freeze([entity, supporting]);
    const snapshot = progressAcrossWorks();
    const scope = Object.freeze({
      mode: "cross-work" as const,
      bookIds: Object.freeze(["tfe", "twok"]),
    });

    const singleWorkClaim = approvedClaim(
      "claim.context.single-source",
      "Afirmación sintética sobre el contexto.",
      knowledge,
      [supporting.id],
      [entity.id],
    );
    const singleWorkGateway = createHoidEntityDossierGateway({
      knowledge,
      claims: [singleWorkClaim],
      aliasEvidence: [aliasRecord(entity)],
      getCurrentProgress: () => snapshot,
    });
    if (!singleWorkGateway) throw new Error("Expected gateway");
    const singleWorkAdapter = createHoidEntityDossierConversationAdapter({
      gateway: singleWorkGateway,
      refreshCurrentProgress: async () => snapshot,
    });
    if (!singleWorkAdapter) throw new Error("Expected adapter");
    expect(await singleWorkAdapter.answer({
      question: "¿Quién es Vin?",
      progress: snapshot,
      bookScope: scope,
      depth: "comparative",
    })).toEqual({ status: "unavailable", reason: "budget-exceeded" });

    const crossWorkClaim = approvedClaim(
      "claim.context.cross-source",
      "Afirmación sintética respaldada por dos obras.",
      knowledge,
      [entity.id, supporting.id],
      [entity.id],
    );
    const crossWorkGateway = createHoidEntityDossierGateway({
      knowledge,
      claims: [crossWorkClaim],
      aliasEvidence: [aliasRecord(entity)],
      getCurrentProgress: () => snapshot,
    });
    if (!crossWorkGateway) throw new Error("Expected gateway");
    const crossWorkAdapter = createHoidEntityDossierConversationAdapter({
      gateway: crossWorkGateway,
      refreshCurrentProgress: async () => snapshot,
    });
    if (!crossWorkAdapter) throw new Error("Expected adapter");
    const result = await crossWorkAdapter.answer({
      question: "¿Quién es Vin?",
      progress: snapshot,
      bookScope: scope,
      depth: "comparative",
    });
    expect(result.status).toBe("ready");
  });

  it("discards the dossier if durable progress changes after projection", async () => {
    const first = progress("tfe", 3, 1);
    const second = progress("tfe", 4, 2);
    const entity = makeEntry("entity.vin", "Vin", "tfe");
    const gateway = createHoidEntityDossierGateway({
      knowledge: [entity],
      claims: [],
      aliasEvidence: [aliasRecord(entity)],
      getCurrentProgress: () => first,
    });
    if (!gateway) throw new Error("Expected gateway");
    let reads = 0;
    const adapter = createHoidEntityDossierConversationAdapter({
      gateway,
      refreshCurrentProgress: async () => {
        reads += 1;
        return reads === 1 ? first : second;
      },
    });
    if (!adapter) throw new Error("Expected adapter");
    const result = await adapter.answer({
      question: "¿Quién es Vin?",
      progress: first,
      bookScope: SINGLE_SCOPE,
    });
    expect(result).toEqual({ status: "unavailable", reason: "progress-changed" });
  });

  it("does not refresh progress or invoke the gateway when the caller has already cancelled", async () => {
    const { gateway } = fixture();
    const refresh = vi.fn(async () => progress());
    const adapter = createHoidEntityDossierConversationAdapter({
      gateway,
      refreshCurrentProgress: refresh,
    });
    if (!adapter) throw new Error("Expected adapter");
    const controller = new AbortController();
    controller.abort();
    const result = await adapter.answer({
      question: "¿Quién es Vin?",
      progress: progress(),
      bookScope: SINGLE_SCOPE,
    }, { signal: controller.signal });
    expect(result).toEqual({ status: "unavailable", reason: "cancelled" });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("rejects provider-bearing configuration and unbranded gateway objects", () => {
    const { gateway } = fixture();
    expect(createHoidEntityDossierConversationAdapter({
      gateway,
      refreshCurrentProgress: () => progress(),
      provider: { invoke: vi.fn() },
    })).toBeNull();
    expect(createHoidEntityDossierConversationAdapter({
      gateway: { getDossier: vi.fn() },
      refreshCurrentProgress: () => progress(),
    })).toBeNull();
    expect(createHoidEntityDossierConversationAdapter({
      gateway,
      refreshCurrentProgress: () => progress(),
    })).not.toBeNull();
  });
});
