import { describe, expect, it } from "vitest";
import {
  resolveHoidAuthorizedEntities as resolveWithAliasEvidence,
  resolveHoidAuthorizedEntityIds as resolveIdsWithAliasEvidence,
  resolveHoidAuthorizedEntityMentions as resolveMentionsWithAliasEvidence,
  resolveProductionHoidEntities,
  resolveProductionHoidEntityMentions,
} from "./entityResolver";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";
import { getVerifiedChapterDocumentNumbers } from "./verifiedChapterDocuments";
import type { HoidKnowledgeEntry, HoidKnowledgeKind } from "./catalog";

const NOW = "2026-11-17T12:00:00.000Z";

function firstUninspectedChapter(bookId: string): Readonly<{ chapter: number; locatorId: string }> {
  const manifest = getHoidReadingManifest(bookId);
  if (manifest.status !== "ready") throw new Error("Manifiesto de fixture no disponible");
  const inspected = new Set(getVerifiedChapterDocumentNumbers(bookId));
  const unit = manifest.manifest.units.find(item => !inspected.has(item.chapterNumber));
  if (!unit?.locatorId) throw new Error("No hay capítulo no inspeccionado con localizador");
  return Object.freeze({ chapter: unit.chapterNumber, locatorId: unit.locatorId });
}

function progress(
  positions: Array<{ bookId: string; chapter?: number; completed?: boolean }>,
) {
  const canonical = positions.map(position => {
    if (position.completed === true) return { bookId: position.bookId, completed: true as const };
    const cursor = createHoidReadingCursor(position.bookId, position.chapter);
    if (cursor.status !== "ready") throw new Error("Cursor de fixture no disponible");
    return { bookId: position.bookId, cursor: cursor.cursor };
  });
  return {
    schemaVersion: 2,
    revision: canonical.length === 0 ? 0 : 1,
    positions: canonical,
    updatedAt: canonical.length === 0 ? null : NOW,
  };
}

function knowledge(
  id: string,
  aliases: string[],
  bookId = "twok",
  unlockChapter = 1,
  kind: HoidKnowledgeKind = "character",
): HoidKnowledgeEntry {
  const manifest = getHoidReadingManifest(bookId);
  if (manifest.status !== "ready") throw new Error("Manifiesto de fixture no disponible");
  const unit = manifest.manifest.units.find(item => item.chapterNumber === 1);
  if (!unit?.locatorId) throw new Error("Localizador de fixture no disponible");
  return {
    id,
    aliases,
    kind,
    firstSafeAppearance: { bookId, chapter: 1 },
    evidenceSource: { bookId, chapter: 1, locatorId: unit.locatorId },
    evidenceUnlock: { bookId, chapter: unlockChapter },
    summary: "Resumen sintético de prueba; no representa hechos del Cosmere.",
    provenance: "verified",
  };
}


function reviewedAliasRecord(
  id: string,
  entityId: string,
  alias: string,
  evidence: readonly unknown[],
) {
  return {
    id,
    entityId,
    alias,
    evidence,
    review: {
      status: "approved" as const,
      origin: "original-editorial" as const,
      reviewerId: "synthetic-alias-reviewer",
      reviewedAt: NOW,
    },
  };
}

function defaultAliasEvidence(entries: readonly HoidKnowledgeEntry[]) {
  return entries.flatMap(entry => {
    if (!entry.evidenceSource || !entry.evidenceUnlock) {
      throw new Error("La evidencia de fixture no está disponible");
    }
    return entry.aliases.map((alias, index) => reviewedAliasRecord(
      `synthetic.alias.${entry.id}.${index}`,
      entry.id,
      alias,
      [{
        id: `synthetic.alias-evidence.${entry.id}.${index}`,
        source: entry.evidenceSource!,
        unlock: entry.evidenceUnlock!,
      }],
    ));
  });
}

function resolveHoidAuthorizedEntities(
  entries: readonly HoidKnowledgeEntry[],
  reading: unknown,
  query: unknown,
  aliasEvidence = defaultAliasEvidence(entries),
) {
  return resolveWithAliasEvidence(entries, aliasEvidence, reading, query);
}

function aliasEvidenceItem(
  id: string,
  bookId: string,
  sourceChapter: number,
  unlockChapter: number,
) {
  const manifest = getHoidReadingManifest(bookId);
  if (manifest.status !== "ready") throw new Error("Manifiesto de alias no disponible");
  const unit = manifest.manifest.units.find(item => item.chapterNumber === sourceChapter);
  if (!unit?.locatorId) throw new Error("Localizador de alias no disponible");
  return {
    id,
    source: { bookId, chapter: sourceChapter, locatorId: unit.locatorId },
    unlock: { bookId, chapter: unlockChapter },
  };
}

describe("Hoid spoiler-aware entity resolution", () => {
  it("resolves an exact authorized alias and returns source metadata only", () => {
    const entry = knowledge("synthetic.entity-a", ["Synthetic Entity"]);
    const result = resolveHoidAuthorizedEntities(
      [entry],
      progress([{ bookId: "twok", chapter: 2 }]),
      { text: "Synthetic Entity" },
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.resolution).toBe("matched");
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].id).toBe(entry.id);
    expect(result.matches[0].matchedAlias).toBe("Synthetic Entity");
    expect(result.matches[0].entitySource.sourceChapter).toBe(1);
    expect(result.matches[0].entitySource.documentSha256).toMatch(/^[a-f0-9]{64}$/);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(entry.summary);
    expect(serialized).not.toContain("evidenceUnlock");
  });

  it("matches Unicode compatibility forms, accents and invisible query format characters", () => {
    const entry = knowledge("synthetic.entity-a", ["Ｓynthetíc Entity"]);
    const result = resolveHoidAuthorizedEntities(
      [entry],
      progress([{ bookId: "twok", chapter: 2 }]),
      { text: "synthetic\u200b entity" },
    );
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.resolution).toBe("matched");
      expect(result.matches[0].id).toBe(entry.id);
    }
  });

  it("uses exact matching rather than substring or fuzzy matching", () => {
    const entry = knowledge("synthetic.entity-a", ["Synthetic Entity"]);
    const result = resolveHoidAuthorizedEntities(
      [entry],
      progress([{ bookId: "twok", chapter: 2 }]),
      { text: "Synthetic" },
    );
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.resolution).toBe("not-found");
      expect(result.matches).toEqual([]);
    }
  });

  it("does not resolve an entity while its first-appearance chapter is still open", () => {
    const entry = knowledge("synthetic.entity-a", ["Synthetic Entity"]);
    const result = resolveHoidAuthorizedEntities(
      [entry],
      progress([{ bookId: "twok", chapter: 1 }]),
      { text: "Synthetic Entity" },
    );
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.resolution).toBe("not-found");
      expect(result.matches).toEqual([]);
    }
  });

  it("does not resolve a full summary before its independent unlock threshold", () => {
    const entry = knowledge("synthetic.entity-a", ["Synthetic Entity"], "twok", 2);
    const result = resolveHoidAuthorizedEntities(
      [entry],
      progress([{ bookId: "twok", chapter: 2 }]),
      { text: "Synthetic Entity" },
    );
    expect(result.status).toBe("ready");
    if (result.status === "ready") expect(result.resolution).toBe("not-found");
  });

  it("returns the same not-found shape for a locked alias and an unknown alias", () => {
    const locked = knowledge("synthetic.locked", ["Hidden Synthetic Name"], "twok", 2);
    const reading = progress([{ bookId: "twok", chapter: 2 }]);
    const lockedResult = resolveHoidAuthorizedEntities(
      [locked], reading, { text: "Hidden Synthetic Name" },
    );
    const unknownResult = resolveHoidAuthorizedEntities(
      [locked], reading, { text: "Unknown Synthetic Name" },
    );
    expect(lockedResult).toEqual(unknownResult);
  });

  it("ignores locked collisions and returns only the independently authorized entity", () => {
    const unlocked = knowledge("synthetic.visible", ["Shared Synthetic Alias"], "twok", 1);
    const locked = knowledge("synthetic.hidden", ["Shared Synthetic Alias"], "edgedancer", 2);
    const result = resolveHoidAuthorizedEntities(
      [locked, unlocked],
      progress([
        { bookId: "twok", chapter: 2 },
        { bookId: "edgedancer", chapter: 2 },
      ]),
      { text: "Shared Synthetic Alias" },
    );
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.resolution).toBe("matched");
      expect(result.matches.map(item => item.id)).toEqual(["synthetic.visible"]);
    }
  });

  it("reports ambiguity when two authorized entities share an alias", () => {
    const a = knowledge("synthetic.entity-a", ["Shared Synthetic Alias"], "twok");
    const b = knowledge("synthetic.entity-b", ["Shared Synthetic Alias"], "edgedancer");
    const result = resolveHoidAuthorizedEntities(
      [b, a],
      progress([
        { bookId: "twok", chapter: 2 },
        { bookId: "edgedancer", chapter: 2 },
      ]),
      { text: "Shared Synthetic Alias" },
    );
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.resolution).toBe("ambiguous");
      expect(result.matches.map(item => item.id)).toEqual(["synthetic.entity-a", "synthetic.entity-b"]);
    }
  });

  it("supports an explicit entity-kind filter", () => {
    const character = knowledge("synthetic.character", ["Synthetic Target"], "twok", 1, "character");
    const place = knowledge("synthetic.place", ["Synthetic Target"], "edgedancer", 1, "place");
    const result = resolveHoidAuthorizedEntities(
      [character, place],
      progress([
        { bookId: "twok", chapter: 2 },
        { bookId: "edgedancer", chapter: 2 },
      ]),
      { text: "Synthetic Target", kind: "place" },
    );
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.resolution).toBe("matched");
      expect(result.matches.map(item => item.id)).toEqual(["synthetic.place"]);
    }
  });

  it("resolves a phenomenon only when the exact kind filter is requested", () => {
    const phenomenon = knowledge("synthetic.phenomenon", ["Synthetic Target"], "twok", 1, "phenomenon");
    const character = knowledge("synthetic.character", ["Synthetic Target"], "edgedancer", 1, "character");
    const result = resolveHoidAuthorizedEntities(
      [phenomenon, character],
      progress([
        { bookId: "twok", chapter: 2 },
        { bookId: "edgedancer", chapter: 2 },
      ]),
      { text: "Synthetic Target", kind: "phenomenon" },
    );
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.resolution).toBe("matched");
      expect(result.matches.map(item => item.id)).toEqual(["synthetic.phenomenon"]);
      expect(result.matches[0].kind).toBe("phenomenon");
    }
  });

  it("marks bounded ambiguous results as truncated", () => {
    const entries = [
      knowledge("synthetic.entity-a", ["Shared Synthetic Alias"], "twok"),
      knowledge("synthetic.entity-b", ["Shared Synthetic Alias"], "edgedancer"),
      knowledge("synthetic.entity-c", ["Shared Synthetic Alias"], "dawnshard"),
    ];
    const result = resolveHoidAuthorizedEntities(
      entries,
      progress([
        { bookId: "twok", chapter: 2 },
        { bookId: "edgedancer", chapter: 2 },
        { bookId: "dawnshard", chapter: 2 },
      ]),
      { text: "Shared Synthetic Alias", maxResults: 1 },
    );
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.resolution).toBe("ambiguous");
      expect(result.matches).toHaveLength(1);
      expect(result.truncated).toBe(true);
    }
  });

  it("rejects duplicate aliases after Unicode normalization", () => {
    const entry = knowledge("synthetic.entity-a", ["Sérgio", "sergio"]);
    const result = resolveHoidAuthorizedEntities(
      [entry],
      progress([{ bookId: "twok", chapter: 2 }]),
      { text: "sergio" },
    );
    expect(result).toEqual({ status: "unavailable", reason: "invalid-knowledge" });
  });

  it("rejects an entity whose source document was not individually inspected", () => {
    const uninspected = firstUninspectedChapter("twok");
    const entry = {
      ...knowledge("synthetic.uninspected", ["Uninspected Synthetic Entity"]),
      firstSafeAppearance: { bookId: "twok", chapter: uninspected.chapter },
      evidenceSource: { bookId: "twok", chapter: uninspected.chapter, locatorId: uninspected.locatorId },
      evidenceUnlock: { bookId: "twok", chapter: uninspected.chapter },
    };
    const result = resolveHoidAuthorizedEntities(
      [entry],
      progress([{ bookId: "twok", chapter: uninspected.chapter }]),
      { text: "Uninspected Synthetic Entity" },
    );
    expect(result).toEqual({ status: "unavailable", reason: "invalid-knowledge" });
  });

  it("rejects malformed progress without returning candidates", () => {
    const entry = knowledge("synthetic.entity-a", ["Synthetic Entity"]);
    const result = resolveHoidAuthorizedEntities(
      [entry],
      { schemaVersion: 2, revision: 1, positions: [], updatedAt: null },
      { text: "Synthetic Entity" },
    );
    expect(result).toEqual({ status: "unavailable", reason: "invalid-progress" });
  });

  it("rejects accessors without executing query getters", () => {
    const query = { kind: undefined, maxResults: undefined } as Record<string, unknown>;
    let invoked = false;
    Object.defineProperty(query, "text", {
      enumerable: true,
      get: () => {
        invoked = true;
        return "Synthetic Entity";
      },
    });
    const result = resolveHoidAuthorizedEntities(
      [], progress([]), query,
    );
    expect(result).toEqual({ status: "unavailable", reason: "invalid-query" });
    expect(invoked).toBe(false);
  });

  it("rejects uninspected or unverified metadata rather than downgrading it", () => {
    const entry = {
      ...knowledge("synthetic.entity-a", ["Synthetic Entity"]),
      provenance: "limited" as const,
    };
    const result = resolveHoidAuthorizedEntities(
      [entry], progress([{ bookId: "twok", chapter: 2 }]), { text: "Synthetic Entity" },
    );
    expect(result).toEqual({ status: "unavailable", reason: "invalid-knowledge" });
  });

  it("keeps production resolution bound to the empty source-controlled registry", () => {
    const result = resolveProductionHoidEntities(
      progress([]),
      { text: "Any Synthetic Entity" },
    );
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.resolution).toBe("not-found");
      expect(result.matches).toEqual([]);
    }
  });

  it("rejects knowledge accessors without executing them", () => {
    const entry = knowledge("synthetic.entity-a", ["Synthetic Entity"]) as unknown as Record<string, unknown>;
    let invoked = false;
    Object.defineProperty(entry, "aliases", {
      enumerable: true,
      get: () => {
        invoked = true;
        return ["Synthetic Entity"];
      },
    });
    const result = resolveWithAliasEvidence(
      [entry], [], progress([{ bookId: "twok", chapter: 2 }]), { text: "Synthetic Entity" },
    );
    expect(result).toEqual({ status: "unavailable", reason: "invalid-knowledge" });
    expect(invoked).toBe(false);
  });

  it("rejects query filters outside the bounded contract", () => {
    const invalidLimit = resolveHoidAuthorizedEntities(
      [], progress([]), { text: "Synthetic Entity", maxResults: 0 },
    );
    const invalidKind = resolveHoidAuthorizedEntities(
      [], progress([]), { text: "Synthetic Entity", kind: "unknown-kind" },
    );
    expect(invalidLimit).toEqual({ status: "unavailable", reason: "invalid-query" });
    expect(invalidKind).toEqual({ status: "unavailable", reason: "invalid-query" });
  });

  it("rejects stored aliases containing invisible format characters", () => {
    const entry = knowledge("synthetic.entity-a", ["Synthetic\u200b Entity"]);
    const result = resolveHoidAuthorizedEntities(
      [entry], progress([{ bookId: "twok", chapter: 2 }]), { text: "Synthetic Entity" },
    );
    expect(result).toEqual({ status: "unavailable", reason: "invalid-knowledge" });
  });


  it("changes the result fingerprint when reading moves even if a fixture reuses its revision", () => {
    const entry = knowledge("synthetic.entity-a", ["Synthetic Entity"]);
    const first = resolveHoidAuthorizedEntities(
      [entry], progress([{ bookId: "twok", chapter: 2 }]), { text: "Synthetic Entity" },
    );
    const second = resolveHoidAuthorizedEntities(
      [entry], progress([{ bookId: "twok", chapter: 3 }]), { text: "Synthetic Entity" },
    );
    expect(first.status).toBe("ready");
    expect(second.status).toBe("ready");
    if (first.status === "ready" && second.status === "ready") {
      expect(first.progressRevision).toBe(second.progressRevision);
      expect(first.progressFingerprint).not.toBe(second.progressFingerprint);
    }
  });


  it("keeps an alias hidden until its own later disclosure threshold", () => {
    const entry = knowledge("synthetic.entity-a", ["Later Synthetic Alias"], "twok", 1);
    const aliases = [reviewedAliasRecord(
      "synthetic.alias-later",
      entry.id,
      "Later Synthetic Alias",
      [aliasEvidenceItem("synthetic.alias-source", "twok", 1, 2)],
    )];
    const before = resolveHoidAuthorizedEntities(
      [entry], progress([{ bookId: "twok", chapter: 2 }]),
      { text: "Later Synthetic Alias" }, aliases,
    );
    const after = resolveHoidAuthorizedEntities(
      [entry], progress([{ bookId: "twok", chapter: 3 }]),
      { text: "Later Synthetic Alias" }, aliases,
    );
    expect(before.status).toBe("ready");
    if (before.status === "ready") expect(before.resolution).toBe("not-found");
    expect(after.status).toBe("ready");
    if (after.status === "ready") expect(after.resolution).toBe("matched");
  });

  it("requires every cross-work alias disclosure source (AND semantics)", () => {
    const entity = knowledge("synthetic.entity-a", ["Cross-Work Synthetic Alias"], "twok", 1);
    const support = knowledge("synthetic.support", ["Support Entity"], "edgedancer", 1);
    const aliases = [reviewedAliasRecord(
      "synthetic.alias-cross-work",
      entity.id,
      "Cross-Work Synthetic Alias",
      [
        aliasEvidenceItem("synthetic.alias-source-a", "twok", 1, 1),
        aliasEvidenceItem("synthetic.alias-source-b", "edgedancer", 1, 2),
      ],
    )];
    const before = resolveHoidAuthorizedEntities(
      [entity, support],
      progress([
        { bookId: "twok", chapter: 2 },
        { bookId: "edgedancer", chapter: 2 },
      ]),
      { text: "Cross-Work Synthetic Alias" },
      aliases,
    );
    const after = resolveHoidAuthorizedEntities(
      [entity, support],
      progress([
        { bookId: "twok", chapter: 2 },
        { bookId: "edgedancer", chapter: 3 },
      ]),
      { text: "Cross-Work Synthetic Alias" },
      aliases,
    );
    expect(before.status).toBe("ready");
    if (before.status === "ready") expect(before.resolution).toBe("not-found");
    expect(after.status).toBe("ready");
    if (after.status === "ready") {
      expect(after.resolution).toBe("matched");
      expect(after.matches[0].aliasEvidence).toHaveLength(2);
    }
  });

  it("rejects an alias disclosure that cites an uninspected chapter document", () => {
    const uninspected = firstUninspectedChapter("twok");
    const entry = knowledge("synthetic.entity-a", ["Uninspected Alias"], "twok", 1);
    const aliases = [reviewedAliasRecord(
      "synthetic.alias-uninspected",
      entry.id,
      "Uninspected Alias",
      [aliasEvidenceItem("synthetic.alias-source-uninspected", "twok", uninspected.chapter, uninspected.chapter)],
    )];
    const result = resolveHoidAuthorizedEntities(
      [entry], progress([{ bookId: "twok", chapter: uninspected.chapter }]),
      { text: "Uninspected Alias" }, aliases,
    );
    expect(result).toEqual({ status: "unavailable", reason: "invalid-knowledge" });
  });

  it("rejects alias evidence that is not attached to the entity's declared aliases", () => {
    const entry = knowledge("synthetic.entity-a", ["Declared Alias"], "twok", 1);
    const aliases = [reviewedAliasRecord(
      "synthetic.alias-invented",
      entry.id,
      "Invented Alias",
      [aliasEvidenceItem("synthetic.alias-source-invented", "twok", 1, 1)],
    )];
    const result = resolveHoidAuthorizedEntities(
      [entry], progress([{ bookId: "twok", chapter: 2 }]),
      { text: "Invented Alias" }, aliases,
    );
    expect(result).toEqual({ status: "unavailable", reason: "invalid-knowledge" });
  });


  it("rejects alias disclosure records without an independent editorial approval", () => {
    const entry = knowledge("synthetic.entity-a", ["Unreviewed Alias"]);
    const unreviewed = [{
      id: "synthetic.alias-unreviewed",
      entityId: entry.id,
      alias: "Unreviewed Alias",
      evidence: [aliasEvidenceItem("synthetic.alias-source-unreviewed", "twok", 1, 1)],
    }];
    const result = resolveHoidAuthorizedEntities(
      [entry], progress([{ bookId: "twok", chapter: 2 }]),
      { text: "Unreviewed Alias" }, unreviewed,
    );
    expect(result).toEqual({ status: "unavailable", reason: "invalid-knowledge" });
  });

  it("rejects alias accessors without executing them", () => {
    const entry = knowledge("synthetic.entity-a", ["Synthetic Entity"]);
    const record = reviewedAliasRecord(
      "synthetic.alias-accessor",
      entry.id,
      "Synthetic Entity",
      [aliasEvidenceItem("synthetic.alias-source-accessor", "twok", 1, 1)],
    ) as unknown as Record<string, unknown>;
    let invoked = false;
    Object.defineProperty(record, "alias", {
      enumerable: true,
      get: () => {
        invoked = true;
        return "Synthetic Entity";
      },
    });
    const result = resolveHoidAuthorizedEntities(
      [entry], progress([{ bookId: "twok", chapter: 2 }]),
      { text: "Synthetic Entity" }, [record],
    );
    expect(result).toEqual({ status: "unavailable", reason: "invalid-knowledge" });
    expect(invoked).toBe(false);
  });

});


function resolveEntityMentions(
  entries: readonly HoidKnowledgeEntry[],
  reading: unknown,
  question: unknown,
  aliasEvidence = defaultAliasEvidence(entries),
) {
  return resolveMentionsWithAliasEvidence(entries, aliasEvidence, reading, question);
}

describe("Hoid spoiler-aware natural-language entity mentions", () => {
  it("matches an exact authorized alias inside a Spanish question", () => {
    const entry = knowledge("synthetic.entity-a", ["Synthetic Entity"]);
    const result = resolveEntityMentions(
      [entry],
      progress([{ bookId: "twok", chapter: 2 }]),
      "¿Puedes explicarme Synthetic Entity?",
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.resolution).toBe("matched");
    expect(result.matches.map(item => item.id)).toEqual([entry.id]);
    expect(JSON.stringify(result)).not.toContain(entry.summary);
  });

  it("returns an opaque blocked result for an entity beyond the reader's progress", () => {
    const entry = knowledge("synthetic.locked", ["Locked Entity"], "twok", 3);
    const result = resolveEntityMentions(
      [entry],
      progress([{ bookId: "twok", chapter: 2 }]),
      "¿Quién es Locked Entity?",
    );

    expect(result).toEqual({ status: "blocked" });
    expect(JSON.stringify(result)).not.toContain("Locked Entity");
    expect(JSON.stringify(result)).not.toContain(entry.id);
  });

  it("blocks an otherwise unlocked entity when its alias-specific disclosure is later", () => {
    const entry = knowledge("synthetic.entity-a", ["Synthetic Entity"]);
    const aliasEvidence = [reviewedAliasRecord(
      "synthetic.alias.late",
      entry.id,
      "Synthetic Entity",
      [aliasEvidenceItem("synthetic.alias-evidence.late", "twok", 1, 3)],
    )];
    const result = resolveEntityMentions(
      [entry],
      progress([{ bookId: "twok", chapter: 2 }]),
      "Explícame Synthetic Entity",
      aliasEvidence,
    );

    expect(result).toEqual({ status: "blocked" });
  });

  it("blocks a catalogued alias that has no independent reviewed disclosure record", () => {
    const entry = knowledge("synthetic.entity-a", ["Synthetic Entity"]);
    const result = resolveEntityMentions(
      [entry],
      progress([{ bookId: "twok", chapter: 2 }]),
      "¿Qué sabes de Synthetic Entity?",
      [],
    );

    expect(result).toEqual({ status: "blocked" });
  });

  it("withholds the whole question when an authorized and a blocked entity are mixed", () => {
    const safe = knowledge("synthetic.safe", ["Safe Entity"]);
    const locked = knowledge("synthetic.locked", ["Locked Entity"], "twok", 3);
    const result = resolveEntityMentions(
      [safe, locked],
      progress([{ bookId: "twok", chapter: 2 }]),
      "Relaciona Safe Entity con Locked Entity",
    );

    expect(result).toEqual({ status: "blocked" });
    expect(JSON.stringify(result)).not.toContain(safe.id);
    expect(JSON.stringify(result)).not.toContain(locked.id);
  });

  it("reports ambiguity only when every matching entity and alias is authorized", () => {
    const first = knowledge("synthetic.entity-a", ["Shared Name"]);
    const second = knowledge("synthetic.entity-b", ["Shared Name"]);
    const result = resolveEntityMentions(
      [first, second],
      progress([{ bookId: "twok", chapter: 2 }]),
      "¿Quién es Shared Name?",
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.resolution).toBe("ambiguous");
    expect(result.matches.map(item => item.id)).toEqual([first.id, second.id]);
  });

  it("normalizes accents and compatibility characters but preserves word boundaries", () => {
    const entry = knowledge("synthetic.entity-a", ["Ｓynthetíc Entity"]);
    const matched = resolveEntityMentions(
      [entry],
      progress([{ bookId: "twok", chapter: 2 }]),
      "¿Qué sabes de SYNTHETIC ENTITY?",
    );
    expect(matched.status).toBe("ready");
    if (matched.status === "ready") expect(matched.resolution).toBe("matched");

    const short = knowledge("synthetic.short", ["Kal"]);
    const partial = resolveEntityMentions(
      [short],
      progress([{ bookId: "twok", chapter: 2 }]),
      "¿Qué sabes de Kaladin?",
    );
    expect(partial.status).toBe("ready");
    if (partial.status === "ready") expect(partial.resolution).toBe("not-found");
  });

  it("rejects control characters and malformed progress without returning candidates", () => {
    const entry = knowledge("synthetic.entity-a", ["Synthetic Entity"]);
    expect(resolveEntityMentions(
      [entry],
      progress([{ bookId: "twok", chapter: 2 }]),
      "¿Qué sabes de\nSynthetic Entity?",
    )).toEqual({ status: "unavailable", reason: "invalid-question" });
    expect(resolveEntityMentions([entry], {}, "Synthetic Entity")).toEqual({
      status: "unavailable",
      reason: "invalid-progress",
    });
  });

  it("keeps the production resolver empty until editorial entities are approved", () => {
    const result = resolveProductionHoidEntityMentions(
      progress([{ bookId: "twok", chapter: 2 }]),
      "¿Quién es Kaladin?",
    );
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.resolution).toBe("not-found");
      expect(result.matches).toHaveLength(0);
    }
  });

  it("resolves several distinct authorized mentions without confusing them with alias collisions", () => {
    const alpha = knowledge("synthetic.entity-alpha", ["Synthetic Alpha"], "twok");
    const beta = knowledge("synthetic.entity-beta", ["Synthetic Beta"], "edgedancer");
    const reading = progress([
      { bookId: "twok", chapter: 2 },
      { bookId: "edgedancer", chapter: 2 },
    ]);
    const entries = [alpha, beta];
    const result = resolveMentionsWithAliasEvidence(
      entries,
      defaultAliasEvidence(entries),
      reading,
      "Compara Synthetic Alpha con Synthetic Beta",
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.resolution).toBe("matched");
    expect(result.matches.map(item => item.id)).toEqual([
      "synthetic.entity-alpha",
      "synthetic.entity-beta",
    ]);
    expect(result.truncated).toBe(false);
  });

  it("keeps a shared spelling ambiguous even when several distinct mentions are supported", () => {
    const alpha = knowledge("synthetic.entity-alpha", ["Shared Synthetic Alias"], "twok");
    const beta = knowledge("synthetic.entity-beta", ["Shared Synthetic Alias"], "edgedancer");
    const entries = [alpha, beta];
    const result = resolveMentionsWithAliasEvidence(
      entries,
      defaultAliasEvidence(entries),
      progress([
        { bookId: "twok", chapter: 2 },
        { bookId: "edgedancer", chapter: 2 },
      ]),
      "Shared Synthetic Alias",
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.resolution).toBe("ambiguous");
    expect(result.matches.map(item => item.id)).toEqual([
      "synthetic.entity-alpha",
      "synthetic.entity-beta",
    ]);
  });

});


describe("Hoid spoiler-aware ID-only entity revalidation", () => {
  it("revalidates IDs in their original order and returns metadata only", () => {
    const alpha = knowledge("synthetic.entity-alpha", ["Synthetic Alpha"], "twok");
    const beta = knowledge("synthetic.entity-beta", ["Synthetic Beta"], "edgedancer");
    const entries = [alpha, beta];
    const reading = progress([
      { bookId: "twok", chapter: 2 },
      { bookId: "edgedancer", chapter: 2 },
    ]);
    const result = resolveIdsWithAliasEvidence(
      entries,
      defaultAliasEvidence(entries),
      reading,
      [beta.id, alpha.id],
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.resolution).toBe("matched");
    expect(result.matches.map(item => item.id)).toEqual([beta.id, alpha.id]);
    expect(JSON.stringify(result)).not.toContain(beta.summary);
  });

  it("blocks the entire ID set when one entity is not unlocked in its own work", () => {
    const alpha = knowledge("synthetic.entity-alpha", ["Synthetic Alpha"], "twok");
    const beta = knowledge("synthetic.entity-beta", ["Synthetic Beta"], "edgedancer");
    const entries = [alpha, beta];
    const result = resolveIdsWithAliasEvidence(
      entries,
      defaultAliasEvidence(entries),
      progress([{ bookId: "twok", chapter: 2 }]),
      [alpha.id, beta.id],
    );
    expect(result).toEqual({ status: "blocked" });
  });

  it("rejects duplicate and malformed IDs before returning candidates", () => {
    const entry = knowledge("synthetic.entity-alpha", ["Synthetic Alpha"]);
    const aliases = defaultAliasEvidence([entry]);
    const reading = progress([{ bookId: "twok", chapter: 2 }]);
    expect(resolveIdsWithAliasEvidence(
      [entry], aliases, reading, [entry.id, entry.id],
    )).toEqual({ status: "unavailable", reason: "invalid-question" });
    expect(resolveIdsWithAliasEvidence(
      [entry], aliases, reading, [entry.id, "bad id"],
    )).toEqual({ status: "unavailable", reason: "invalid-question" });
  });
});
