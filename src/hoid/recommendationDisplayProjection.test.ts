import { describe, expect, it } from "vitest";
import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { resolveHoidChapterIdentity } from "./chapterIdentity";
import {
  createHoidReadingCursor,
  getHoidReadingManifest,
} from "./readingManifest";
import { HOID_TOPIC_TAXONOMY } from "./topicTaxonomy";
import {
  projectHoidEditionRecommendationsForDisplay,
  projectHoidTopicRecommendationsForDisplay,
} from "./recommendationDisplayProjection";

const fingerprint = "a".repeat(64);

function editionFixture() {
  const work = HOID_SOURCE_BIBLIOGRAPHY.find(candidate =>
    getHoidReadingManifest(candidate.id).status === "ready"
  );
  if (!work) throw new Error("A fixture work with a verified manifest is required");
  const manifestResult = getHoidReadingManifest(work.id);
  if (manifestResult.status !== "ready") throw new Error("Manifest fixture unavailable");
  const unit = manifestResult.manifest.units[0];
  if (!unit) throw new Error("Manifest must contain a chapter");
  const cursorResult = createHoidReadingCursor(work.id, unit.chapterNumber);
  if (cursorResult.status !== "ready") throw new Error("Cursor fixture unavailable");

  const target = Object.freeze({
    kind: "edition-cursor",
    cursor: cursorResult.cursor,
    editionId: manifestResult.manifest.editionId,
    navigationSha256: manifestResult.manifest.navigationSha256,
    locatorStatus: unit.locatorId ? "verified" : "cursor-only",
    ...(unit.locatorId ? { locatorId: unit.locatorId } : {}),
  });
  const presentation = Object.freeze({
    status: "ready",
    progressRevision: 7,
    progressFingerprint: fingerprint,
    items: Object.freeze([Object.freeze({
      sourceId: work.id,
      title: work.title,
      reason: "unread-source",
      explanationCode: "start-first-numbered-chapter",
      heading: "Comenzar " + work.title,
      detail: "La obra figura en el catálogo y tiene un manifiesto de lectura verificable.",
      target,
    })]),
  });
  return { work, target, presentation };
}

function topicFixture() {
  const recommended = HOID_SOURCE_BIBLIOGRAPHY[0];
  const evidenceWork = HOID_SOURCE_BIBLIOGRAPHY.find(work =>
    work.id !== recommended.id && getHoidReadingManifest(work.id).status === "ready"
  );
  if (!evidenceWork) throw new Error("A second manifest-backed evidence work is required");
  const evidenceManifest = getHoidReadingManifest(evidenceWork.id);
  if (evidenceManifest.status !== "ready") throw new Error("Evidence manifest fixture unavailable");
  const evidenceUnit = evidenceManifest.manifest.units.find(unit => Boolean(unit.locatorId));
  if (!evidenceUnit?.locatorId) throw new Error("A locator-backed evidence chapter is required");
  const evidenceChapter = evidenceUnit.chapterNumber;
  const topic = HOID_TOPIC_TAXONOMY[0];
  const dimension = topic.dimensions[0];
  return Object.freeze([Object.freeze({
    sourceId: recommended.id,
    title: recommended.title,
    reason: "reviewed-topic-match",
    matches: Object.freeze([Object.freeze({
      topicId: topic.id,
      topicLabel: topic.label,
      dimensionId: dimension.id,
      dimensionLabel: dimension.label,
      claimId: "claim-one",
      reasonText: "Coincidencia respaldada por una asociación editorial revisada.",
      citations: Object.freeze([Object.freeze({
        evidenceId: "evidence-private-one",
        sourceBookId: evidenceWork.id,
        title: evidenceWork.title,
        chapter: evidenceChapter,
        locatorId: evidenceUnit.locatorId,
      })]),
    })]),
  })]);
}

describe("Hoid recommendation display projections", () => {
  it("removes edition cursors, locators, edition hashes and progress identity from UI state", () => {
    const fixture = editionFixture();
    const display = projectHoidEditionRecommendationsForDisplay(fixture.presentation);
    expect(display).not.toBeNull();
    expect(display).toEqual({
      status: "ready",
      items: [{
        sourceId: fixture.work.id,
        title: fixture.work.title,
        heading: "Comenzar " + fixture.work.title,
        detail: "La obra figura en el catálogo y tiene un manifiesto de lectura verificable.",
        navigation: fixture.target.locatorStatus,
      }],
    });
    const serialized = JSON.stringify(display);
    for (const secret of [
      "locatorId",
      "private.xhtml",
      "navigationSha256",
      "editionId",
      "manifestId",
      "unitId",
      "progressFingerprint",
      "progressRevision",
    ]) expect(serialized).not.toContain(secret);
  });

  it("keeps the selection-required UI projection free of internal progress identity", () => {
    const works = HOID_SOURCE_BIBLIOGRAPHY.filter(work => {
      const manifest = getHoidReadingManifest(work.id);
      return manifest.status === "ready" && manifest.manifest.units.length > 1;
    }).slice(0, 2);
    const choices = works.map(work => {
      const manifest = getHoidReadingManifest(work.id);
      if (manifest.status !== "ready") throw new Error("Selection manifest fixture unavailable");
      const previousUnit = manifest.manifest.units[0];
      const currentUnit = manifest.manifest.units[1];
      if (!previousUnit || !currentUnit) throw new Error("Selection manifest requires two chapters");
      return {
        sourceId: work.id,
        title: work.title,
        currentChapter: currentUnit.chapterNumber,
        completedThroughChapter: previousUnit.chapterNumber,
        detail: "Continuar desde el capítulo actual.",
      };
    });
    const display = projectHoidEditionRecommendationsForDisplay({
      status: "selection-required",
      progressRevision: 9,
      progressFingerprint: fingerprint,
      heading: "Elige una obra",
      detail: "Hay varias lecturas en curso.",
      choices,
    });
    expect(display).toEqual({
      status: "selection-required",
      heading: "Elige una obra",
      detail: "Hay varias lecturas en curso.",
      choices: choices.map(({ completedThroughChapter: _completed, ...choice }) => choice),
    });
    expect(JSON.stringify(display)).not.toContain("progressFingerprint");
    expect(JSON.stringify(display)).not.toContain("progressRevision");
  });

  it("rejects an edition target whose locator does not match its verified manifest", () => {
    const fixture = editionFixture();
    const tampered = {
      ...fixture.presentation,
      items: [{
        ...fixture.presentation.items[0],
        target: {
          ...fixture.target,
          ...(fixture.target.locatorId ? { locatorId: "other.xhtml" } : { locatorId: "invented.xhtml" }),
        },
      }],
    };
    expect(projectHoidEditionRecommendationsForDisplay(tampered)).toBeNull();
  });

  it("rejects accessor-backed recommendation records without executing getters", () => {
    const fixture = editionFixture();
    let getterCalls = 0;
    const item = { ...fixture.presentation.items[0] } as Record<string, unknown>;
    delete item.title;
    Object.defineProperty(item, "title", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return fixture.work.title;
      },
    });
    const input = { ...fixture.presentation, items: [item] };
    expect(projectHoidEditionRecommendationsForDisplay(input)).toBeNull();
    expect(getterCalls).toBe(0);
  });

  it("rejects proxy traps and malformed progress fingerprints", () => {
    const fixture = editionFixture();
    const throwingProxy = new Proxy(fixture.presentation, {
      ownKeys() {
        throw new Error("synthetic proxy trap");
      },
    });
    expect(projectHoidEditionRecommendationsForDisplay(throwingProxy)).toBeNull();
    expect(projectHoidEditionRecommendationsForDisplay({
      ...fixture.presentation,
      progressFingerprint: "not-a-sha256",
    })).toBeNull();
  });

  it("deeply freezes the edition recommendation display projection", () => {
    const display = projectHoidEditionRecommendationsForDisplay(editionFixture().presentation);
    expect(Object.isFrozen(display)).toBe(true);
    if (display?.status !== "ready") throw new Error("Expected ready display projection");
    expect(Object.isFrozen(display.items)).toBe(true);
    expect(Object.isFrozen(display.items[0])).toBe(true);
  });

  it("removes claim, evidence and EPUB locator identifiers from thematic recommendations", () => {
    const display = projectHoidTopicRecommendationsForDisplay(topicFixture());
    expect(display).not.toBeNull();
    expect(display?.[0].matches[0].citations[0]).toEqual({
      sourceBookId: topicFixture()[0].matches[0].citations[0].sourceBookId,
      title: topicFixture()[0].matches[0].citations[0].title,
      chapter: topicFixture()[0].matches[0].citations[0].chapter,
      chapterOrdinal: resolveHoidChapterIdentity(
        topicFixture()[0].matches[0].citations[0].sourceBookId,
        {
          chapterNumber: topicFixture()[0].matches[0].citations[0].chapter,
          locatorId: topicFixture()[0].matches[0].citations[0].locatorId,
        },
      ).status === "resolved"
        ? (resolveHoidChapterIdentity(
            topicFixture()[0].matches[0].citations[0].sourceBookId,
            {
              chapterNumber: topicFixture()[0].matches[0].citations[0].chapter,
              locatorId: topicFixture()[0].matches[0].citations[0].locatorId,
            },
          ) as { status: "resolved"; identity: { ordinal: number } }).identity.ordinal
        : -1,
    });
    const serialized = JSON.stringify(display);
    for (const secret of [
      "claim-one",
      "evidence-private-one",
      "locatorId",
      "private.xhtml",
    ]) expect(serialized).not.toContain(secret);
  });

  it("projects an exact duplicate chapter citation with its edition ordinal", () => {
    const fixture = topicFixture();
    const manifest = getHoidReadingManifest("sawt");
    expect(manifest.status).toBe("ready");
    if (manifest.status !== "ready") return;
    const duplicateUnits = manifest.manifest.units.filter(unit => unit.chapterNumber === 12);
    expect(duplicateUnits).toHaveLength(2);

    for (const unit of duplicateUnits) {
      if (!unit.locatorId) throw new Error("Duplicate chapter locator must be verified");
      const changed = [{
        ...fixture[0],
        matches: [{
          ...fixture[0].matches[0],
          citations: [{
            evidenceId: "evidence-sawt-" + String(unit.ordinal),
            sourceBookId: "sawt",
            title: "Viento y verdad",
            chapter: 12,
            locatorId: unit.locatorId,
          }],
        }],
      }];
      const display = projectHoidTopicRecommendationsForDisplay(changed);
      expect(display?.[0].matches[0].citations[0]).toEqual({
        sourceBookId: "sawt",
        title: "Viento y verdad",
        chapter: 12,
        chapterOrdinal: unit.ordinal,
      });
      expect(JSON.stringify(display)).not.toContain(unit.locatorId);
    }
  });

  it("rejects a numeric edition choice at an ambiguous chapter label", () => {
    const tfe = HOID_SOURCE_BIBLIOGRAPHY.find(work => work.id === "tfe");
    if (!tfe) throw new Error("El Imperio Final fixture unavailable");
    expect(projectHoidEditionRecommendationsForDisplay({
      status: "selection-required",
      progressRevision: 10,
      progressFingerprint: fingerprint,
      heading: "Elige una obra",
      detail: "Hay varias lecturas en curso.",
      choices: [
        {
          sourceId: "sawt",
          title: "Viento y verdad",
          currentChapter: 12,
          completedThroughChapter: 11,
          detail: "Continuar desde el capítulo indicado.",
        },
        {
          sourceId: tfe.id,
          title: tfe.title,
          currentChapter: 2,
          completedThroughChapter: 1,
          detail: "Continuar desde el capítulo indicado.",
        },
      ],
    })).toBeNull();
  });

  it("rejects non-canonical bibliography titles and topic labels", () => {
    const fixture = topicFixture();
    const badTitle = [{
      ...fixture[0],
      title: "Título inventado",
    }];
    const badTopic = [{
      ...fixture[0],
      matches: [{
        ...fixture[0].matches[0],
        topicLabel: "Etiqueta inventada",
      }],
    }];
    expect(projectHoidTopicRecommendationsForDisplay(badTitle)).toBeNull();
    expect(projectHoidTopicRecommendationsForDisplay(badTopic)).toBeNull();
  });

  it("rejects citations that point to the recommended unstarted work", () => {
    const fixture = topicFixture();
    const item = fixture[0];
    const invalid = [{
      ...item,
      matches: [{
        ...item.matches[0],
        citations: [{
          evidenceId: "evidence-self",
          sourceBookId: item.sourceId,
          title: item.title,
          chapter: 1,
          locatorId: "self.xhtml",
        }],
      }],
    }];
    expect(projectHoidTopicRecommendationsForDisplay(invalid)).toBeNull();
  });

  it("rejects sparse arrays and duplicate source recommendations", () => {
    const sparse = new Array(1);
    expect(projectHoidTopicRecommendationsForDisplay(sparse)).toBeNull();
    const fixture = topicFixture();
    expect(projectHoidTopicRecommendationsForDisplay([fixture[0], fixture[0]])).toBeNull();
  });

  it("deeply freezes thematic display data", () => {
    const display = projectHoidTopicRecommendationsForDisplay(topicFixture());
    expect(Object.isFrozen(display)).toBe(true);
    expect(Object.isFrozen(display?.[0])).toBe(true);
    expect(Object.isFrozen(display?.[0].matches)).toBe(true);
    expect(Object.isFrozen(display?.[0].matches[0])).toBe(true);
    expect(Object.isFrozen(display?.[0].matches[0].citations)).toBe(true);
    expect(Object.isFrozen(display?.[0].matches[0].citations[0])).toBe(true);
  });
});
