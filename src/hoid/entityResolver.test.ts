import { describe, expect, it } from "vitest";
import {
  resolveHoidAuthorizedEntities as resolveWithAliasEvidence,
  resolveProductionHoidEntities,
} from "./entityResolver";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";
import type { HoidKnowledgeEntry, HoidKnowledgeKind } from "./catalog";

const NOW = "2026-11-17T12:00:00.000Z";

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
    const manifest = getHoidReadingManifest("twok");
    if (manifest.status !== "ready") throw new Error("Manifiesto de fixture no disponible");
    const unit = manifest.manifest.units.find(item => item.chapterNumber === 2);
    if (!unit?.locatorId) throw new Error("Localizador de fixture no disponible");
    const entry = {
      ...knowledge("synthetic.uninspected", ["Uninspected Synthetic Entity"]),
      firstSafeAppearance: { bookId: "twok", chapter: 2 },
      evidenceSource: { bookId: "twok", chapter: 2, locatorId: unit.locatorId },
      evidenceUnlock: { bookId: "twok", chapter: 2 },
    };
    const result = resolveHoidAuthorizedEntities(
      [entry],
      progress([{ bookId: "twok", chapter: 3 }]),
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
    const entry = knowledge("synthetic.entity-a", ["Uninspected Alias"], "twok", 1);
    const aliases = [reviewedAliasRecord(
      "synthetic.alias-uninspected",
      entry.id,
      "Uninspected Alias",
      [aliasEvidenceItem("synthetic.alias-source-uninspected", "twok", 2, 2)],
    )];
    const result = resolveHoidAuthorizedEntities(
      [entry], progress([{ bookId: "twok", chapter: 3 }]),
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
