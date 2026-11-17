import { describe, expect, it } from "vitest";
import {
  resolveHoidAuthorizedEntities,
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
    expect(result.matches[0].source.sourceChapter).toBe(1);
    expect(result.matches[0].source.documentSha256).toMatch(/^[a-f0-9]{64}$/);
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
    const entry = knowledge("synthetic.entity-a", ["Synthetic Entity"]) as Record<string, unknown>;
    let invoked = false;
    Object.defineProperty(entry, "aliases", {
      enumerable: true,
      get: () => {
        invoked = true;
        return ["Synthetic Entity"];
      },
    });
    const result = resolveHoidAuthorizedEntities(
      [entry], progress([{ bookId: "twok", chapter: 2 }]), { text: "Synthetic Entity" },
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

});
