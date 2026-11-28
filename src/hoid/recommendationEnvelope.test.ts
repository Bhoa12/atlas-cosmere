import { describe, expect, it } from "vitest";
import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";
import { HOID_TOPIC_TAXONOMY } from "./topicTaxonomy";
import {
  createHoidCuratedPathRecommendationEnvelope,
  createHoidRecommendationAbstentionEnvelope,
  createHoidResumeReadingRecommendationEnvelope,
  createHoidTopicInterestRecommendationEnvelope,
  fingerprintHoidTopicSelection,
} from "./recommendationEnvelope";
import {
  projectHoidEditionRecommendationsForDisplay,
  projectHoidTopicRecommendationsForDisplay,
} from "./recommendationDisplayProjection";

const progressFingerprint = "a".repeat(64);
const progressScope = Object.freeze({ revision: 7, fingerprint: progressFingerprint });

function editionFixture() {
  const work = HOID_SOURCE_BIBLIOGRAPHY.find(candidate => {
    const manifest = getHoidReadingManifest(candidate.id);
    return manifest.status === "ready" && manifest.manifest.units.length > 0;
  });
  if (!work) throw new Error("A manifest-backed work is required");
  const result = getHoidReadingManifest(work.id);
  if (result.status !== "ready") throw new Error("Edition fixture manifest unavailable");
  const unit = result.manifest.units[0];
  if (!unit) throw new Error("Edition fixture requires a chapter unit");
  const cursor = createHoidReadingCursor(work.id, unit.chapterNumber);
  if (cursor.status !== "ready") throw new Error("Edition fixture cursor unavailable");
  const target = Object.freeze({
    kind: "edition-cursor",
    cursor: cursor.cursor,
    editionId: result.manifest.editionId,
    navigationSha256: result.manifest.navigationSha256,
    locatorStatus: unit.locatorId ? "verified" : "cursor-only",
    ...(unit.locatorId ? { locatorId: unit.locatorId } : {}),
  });
  const presentation = Object.freeze({
    status: "ready",
    progressRevision: progressScope.revision,
    progressFingerprint: progressScope.fingerprint,
    items: Object.freeze([Object.freeze({
      sourceId: work.id,
      title: work.title,
      reason: "resume-current-work",
      explanationCode: "resume-current-cursor",
      heading: "Reanudar " + work.title,
      detail: "Cursor de prueba validado contra el manifiesto.",
      target,
    })]),
  });
  return { presentation };
}

function topicFixture() {
  const recommended = HOID_SOURCE_BIBLIOGRAPHY[0];
  if (!recommended) throw new Error("A recommendation work is required");
  const evidenceWork = HOID_SOURCE_BIBLIOGRAPHY.find(work => {
    if (work.id === recommended.id) return false;
    const manifest = getHoidReadingManifest(work.id);
    return manifest.status === "ready" && manifest.manifest.units.some(unit => Boolean(unit.locatorId));
  });
  if (!evidenceWork) throw new Error("A locator-backed evidence work is required");
  const manifest = getHoidReadingManifest(evidenceWork.id);
  if (manifest.status !== "ready") throw new Error("Topic fixture manifest unavailable");
  const unit = manifest.manifest.units.find(candidate => Boolean(candidate.locatorId));
  if (!unit?.locatorId) throw new Error("Topic fixture locator unavailable");
  const topic = HOID_TOPIC_TAXONOMY[0];
  const dimension = topic?.dimensions[0];
  if (!topic || !dimension) throw new Error("Topic taxonomy fixture unavailable");
  const raw = Object.freeze([Object.freeze({
    sourceId: recommended.id,
    title: recommended.title,
    reason: "reviewed-topic-match",
    matches: Object.freeze([Object.freeze({
      topicId: topic.id,
      topicLabel: topic.label,
      dimensionId: dimension.id,
      dimensionLabel: dimension.label,
      claimId: "synthetic-claim",
      reasonText: "Coincidencia sintética respaldada por una asociación editorial revisada.",
      citations: Object.freeze([Object.freeze({
        evidenceId: "synthetic-evidence",
        sourceBookId: evidenceWork.id,
        title: evidenceWork.title,
        chapter: unit.chapterNumber,
        locatorId: unit.locatorId,
      })]),
    })]),
  })]);
  return { raw, topic };
}

describe("Hoid narrative recommendation envelopes", () => {
  it("binds a branded resume-reading projection to its exact progress identity", () => {
    const fixture = editionFixture();
    const display = projectHoidEditionRecommendationsForDisplay(fixture.presentation);
    expect(display).not.toBeNull();
    const envelope = createHoidResumeReadingRecommendationEnvelope({
      display,
      progressScope,
    });
    expect(envelope).not.toBeNull();
    expect(envelope?.kind).toBe("resume-reading");
    expect(envelope?.progressScope).toEqual(progressScope);
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope?.display)).toBe(true);
    const serialized = JSON.stringify(envelope);
    for (const privateField of ["cursor", "locatorId", "navigationSha256", "editionId", "manifestId"]) {
      expect(serialized).not.toContain(privateField);
    }
  });

  it("rejects a resume projection paired with a different progress revision or fingerprint", () => {
    const display = projectHoidEditionRecommendationsForDisplay(editionFixture().presentation);
    expect(createHoidResumeReadingRecommendationEnvelope({
      display,
      progressScope: { revision: 8, fingerprint: progressFingerprint },
    })).toBeNull();
    expect(createHoidResumeReadingRecommendationEnvelope({
      display,
      progressScope: { revision: 7, fingerprint: "b".repeat(64) },
    })).toBeNull();
  });

  it("rejects a structurally forged edition projection that did not pass the trusted projector", () => {
    expect(createHoidResumeReadingRecommendationEnvelope({
      display: Object.freeze({ status: "ready", items: Object.freeze([]) }),
      progressScope,
    })).toBeNull();
  });

  it("binds topic recommendations to verified progress and the exact explicit topic selection", () => {
    const fixture = topicFixture();
    const display = projectHoidTopicRecommendationsForDisplay(fixture.raw, progressScope);
    expect(display).not.toBeNull();
    const envelope = createHoidTopicInterestRecommendationEnvelope({
      display,
      progressScope,
      selectedTopicIds: [fixture.topic.id],
    });
    expect(envelope).not.toBeNull();
    expect(envelope?.kind).toBe("topic-interest");
    expect(envelope?.selectedTopicIds).toEqual([fixture.topic.id]);
    expect(envelope?.selectionFingerprint).toBe(fingerprintHoidTopicSelection([fixture.topic.id]));
    expect(envelope?.display[0]?.matches[0]?.topicLabel).toBe(fixture.topic.label);
    const serialized = JSON.stringify(envelope);
    for (const privateField of ["claimId", "evidenceId", "locatorId", "editionId", "manifestId"]) {
      expect(serialized).not.toContain(privateField);
    }
  });

  it("rejects topic projections without a progress binding or with a different selection", () => {
    const fixture = topicFixture();
    const unbound = projectHoidTopicRecommendationsForDisplay(fixture.raw);
    expect(createHoidTopicInterestRecommendationEnvelope({
      display: unbound,
      progressScope,
      selectedTopicIds: [fixture.topic.id],
    })).toBeNull();

    const bound = projectHoidTopicRecommendationsForDisplay(fixture.raw, progressScope);
    const otherTopic = HOID_TOPIC_TAXONOMY.find(topic => topic.id !== fixture.topic.id);
    expect(otherTopic).toBeDefined();
    expect(createHoidTopicInterestRecommendationEnvelope({
      display: bound,
      progressScope,
      selectedTopicIds: otherTopic ? [otherTopic.id] : [],
    })).toBeNull();
  });

  it("rejects topic recommendations when the progress identity changes", () => {
    const fixture = topicFixture();
    const display = projectHoidTopicRecommendationsForDisplay(fixture.raw, progressScope);
    expect(createHoidTopicInterestRecommendationEnvelope({
      display,
      progressScope: { revision: 8, fingerprint: progressFingerprint },
      selectedTopicIds: [fixture.topic.id],
    })).toBeNull();
  });

  it("rejects a curated-path projection that was not produced by the trusted signed projector", () => {
    expect(createHoidCuratedPathRecommendationEnvelope({
      display: Object.freeze({ status: "ready", items: Object.freeze([]) }),
      progressScope,
    })).toBeNull();
  });

  it("creates fixed-copy abstentions without accepting provider or caller prose", () => {
    const envelope = createHoidRecommendationAbstentionEnvelope({
      kind: "topic-interest",
      progressScope,
      reason: "no-reviewed-match",
    });
    expect(envelope?.status).toBe("withheld");
    expect(envelope?.kind).toBe("topic-interest");
    expect(envelope?.text).toContain("No hay asociaciones editoriales aprobadas");
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(createHoidRecommendationAbstentionEnvelope({
      kind: "topic-interest",
      progressScope,
      reason: "no-reviewed-match",
      text: "prosa de proveedor",
    })).toBeNull();
    expect(createHoidRecommendationAbstentionEnvelope({
      kind: "topic-interest",
      progressScope,
      reason: "unknown",
    })).toBeNull();
  });

  it("fingerprints only a non-empty, unique selection from the closed topic taxonomy", () => {
    const topic = HOID_TOPIC_TAXONOMY[0];
    if (!topic) throw new Error("Topic taxonomy fixture unavailable");
    expect(fingerprintHoidTopicSelection([topic.id])).toMatch(/^[a-f0-9]{64}$/u);
    expect(fingerprintHoidTopicSelection([])).toBeNull();
    expect(fingerprintHoidTopicSelection([topic.id, topic.id])).toBeNull();
    expect(fingerprintHoidTopicSelection(["provider-topic"])).toBeNull();
  });
});
