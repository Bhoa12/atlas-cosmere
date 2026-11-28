import { describe, expect, it } from "vitest";
import {
  HOID_SOURCE_BIBLIOGRAPHY,
} from "./bibliography";
import { getHoidReadingManifest } from "./readingManifest";
import {
  createHoidNarrativeAbstentionEnvelope,
  createHoidNarrativeAnswerEnvelope,
  resolveHoidNarrativeDomain,
} from "./narrativeAnswerEnvelope";

const availableSource = HOID_SOURCE_BIBLIOGRAPHY.find(work => {
  const result = getHoidReadingManifest(work.id);
  return result.status === "ready" && result.manifest.units.length >= 2;
});
if (!availableSource) throw new Error("Narrative envelope tests require one verified chapter manifest");

const availableManifest = getHoidReadingManifest(availableSource.id);
if (availableManifest.status !== "ready") {
  throw new Error("Narrative envelope fixture manifest is unavailable");
}

const firstUnit = availableManifest.manifest.units[0];
if (!firstUnit) {
  throw new Error("Narrative envelope tests require an indexed chapter unit");
}
const secondUnit = availableManifest.manifest.units.find(
  unit => unit.ordinal !== firstUnit.ordinal,
);
if (!secondUnit) {
  throw new Error("Narrative envelope tests require two indexed chapter units");
}

function citationFor(unit: Readonly<{ ordinal: number; chapterNumber: number }>) {
  const matching = availableManifest.manifest.units.filter(
    candidate => candidate.chapterNumber === unit.chapterNumber,
  );
  return Object.freeze({
    sourceBookId: availableSource.id,
    title: availableSource.title,
    chapter: unit.chapterNumber,
    chapterOrdinal: unit.ordinal,
    chapterLabelAmbiguous: matching.length > 1 ||
      availableManifest.manifest.ambiguousChapterNumbers.includes(unit.chapterNumber),
  });
}

const firstCitation = citationFor(firstUnit);
const secondCitation = citationFor(secondUnit);
const progressScope = Object.freeze({
  revision: 12,
  fingerprint: "a".repeat(64),
});
const bookScope = Object.freeze({
  mode: "single-work" as const,
  bookIds: Object.freeze([availableSource.id]),
});

function validInput() {
  return {
    domain: "conversation",
    progressScope,
    bookScope,
    displayText: "Respuesta sintética de prueba.",
    citations: [firstCitation],
    segments: [{
      claimId: "synthetic-claim-1",
      text: "Afirmación sintética de prueba.",
      citations: [firstCitation],
    }],
    layout: "plain",
  };
}

describe("Hoid narrative answer envelope", () => {
  it("maps only known typed routes to stable domains", () => {
    expect(resolveHoidNarrativeDomain("conversation")).toBe("conversation");
    expect(resolveHoidNarrativeDomain("dossier")).toBe("entity-dossier");
    expect(resolveHoidNarrativeDomain("relationship")).toBe("entity-relationship");
    expect(resolveHoidNarrativeDomain("timeline")).toBe("entity-timeline");
    expect(resolveHoidNarrativeDomain("character-evolution")).toBe("character-evolution");
    expect(resolveHoidNarrativeDomain("magic-system")).toBe("magic-system");
    expect(resolveHoidNarrativeDomain("provider-fallback")).toBeNull();
  });

  it("creates an immutable answer bound to progress, scope and chapter provenance", () => {
    const envelope = createHoidNarrativeAnswerEnvelope(validInput());
    expect(envelope).not.toBeNull();
    expect(envelope?.status).toBe("ready");
    expect(envelope?.progressScope).toEqual(progressScope);
    expect(envelope?.bookScope).toEqual(bookScope);
    expect(envelope?.citations[0]).toEqual(firstCitation);
    expect(envelope?.epistemicSummary.segmentCount).toBe(1);
    expect(envelope?.epistemicSummary.byKind.unclassified).toBe(1);
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope?.citations)).toBe(true);
    expect(Object.isFrozen(envelope?.segments)).toBe(true);
  });

  it("derives epistemic labels from approved classification metadata", () => {
    const input = validInput();
    const envelope = createHoidNarrativeAnswerEnvelope({
      ...input,
      segments: [{
        ...input.segments[0],
        epistemicKind: "evidence-backed-assertion",
      }],
    });
    expect(envelope?.status).toBe("ready");
    if (envelope?.status !== "ready") return;
    expect(envelope.segments?.[0].epistemicKind).toBe("evidence-backed-assertion");
    expect(envelope.segments?.[0].epistemicLabel).toBe("AFIRMACIÓN EDITORIAL CON EVIDENCIAS");
    expect(envelope.epistemicSummary.byKind["evidence-backed-assertion"]).toBe(1);
  });

  it("rejects provider payloads and unknown extension fields", () => {
    expect(createHoidNarrativeAnswerEnvelope({
      ...validInput(),
      provider: "untrusted",
      rawPrompt: "synthetic",
    })).toBeNull();
  });

  it("rejects malformed or stale-shaped progress identities", () => {
    expect(createHoidNarrativeAnswerEnvelope({
      ...validInput(),
      progressScope: { revision: -1, fingerprint: "a".repeat(64) },
    })).toBeNull();
    expect(createHoidNarrativeAnswerEnvelope({
      ...validInput(),
      progressScope: { revision: 12, fingerprint: "not-a-sha" },
    })).toBeNull();
  });

  it("rejects unknown works and non-canonical bibliography titles", () => {
    expect(createHoidNarrativeAnswerEnvelope({
      ...validInput(),
      citations: [{ ...firstCitation, sourceBookId: "unknown-work" }],
    })).toBeNull();
    expect(createHoidNarrativeAnswerEnvelope({
      ...validInput(),
      citations: [{ ...firstCitation, title: "Título inventado" }],
    })).toBeNull();
  });

  it("rejects a chapter ordinal that does not identify the cited chapter", () => {
    expect(createHoidNarrativeAnswerEnvelope({
      ...validInput(),
      citations: [{ ...firstCitation, chapterOrdinal: 999_999 }],
    })).toBeNull();
  });

  it("rejects citations outside the explicit book scope", () => {
    const otherKnownWork = HOID_SOURCE_BIBLIOGRAPHY.find(
      work => work.id !== availableSource.id,
    );
    expect(otherKnownWork).toBeDefined();
    expect(createHoidNarrativeAnswerEnvelope({
      ...validInput(),
      bookScope: {
        mode: "single-work",
        bookIds: [otherKnownWork?.id ?? "tfe"],
      },
    })).toBeNull();
  });

  it("rejects segment citations that are not present in the top-level citation set", () => {
    expect(createHoidNarrativeAnswerEnvelope({
      ...validInput(),
      segments: [{
        claimId: "synthetic-claim-1",
        text: "Afirmación sintética de prueba.",
        citations: [secondCitation],
      }],
    })).toBeNull();
  });

  it("rejects unused top-level citations", () => {
    expect(createHoidNarrativeAnswerEnvelope({
      ...validInput(),
      citations: [firstCitation, secondCitation],
    })).toBeNull();
  });

  it("requires segments and layout to be supplied together", () => {
    const input = validInput();
    const withoutSegments = { ...input } as Record<string, unknown>;
    delete withoutSegments.segments;
    expect(createHoidNarrativeAnswerEnvelope(withoutSegments)).toBeNull();

    const withoutLayout = { ...input } as Record<string, unknown>;
    delete withoutLayout.layout;
    expect(createHoidNarrativeAnswerEnvelope(withoutLayout)).toBeNull();
  });

  it("rejects epistemic labels that do not match their classification", () => {
    const input = validInput();
    expect(createHoidNarrativeAnswerEnvelope({
      ...input,
      segments: [{
        ...input.segments[0],
        epistemicKind: "editorial-interpretation",
        epistemicLabel: "AFIRMACIÓN EDITORIAL CON EVIDENCIAS",
      }],
    })).toBeNull();
  });

  it("rejects inconsistent cross-book matrices instead of partially rendering them", () => {
    expect(createHoidNarrativeAnswerEnvelope({
      ...validInput(),
      crossBookEvidence: {
        workCount: 2,
        works: [],
        segments: [],
      },
    })).toBeNull();
  });

  it("rejects malformed text and empty evidence", () => {
    expect(createHoidNarrativeAnswerEnvelope({
      ...validInput(),
      displayText: "  texto sin normalizar",
    })).toBeNull();
    expect(createHoidNarrativeAnswerEnvelope({
      ...validInput(),
      citations: [],
    })).toBeNull();
  });
});

describe("Hoid narrative abstention envelope", () => {
  it("uses fixed safe copy and carries no narrative evidence", () => {
    const envelope = createHoidNarrativeAbstentionEnvelope({
      domain: "magic-system",
      progressScope,
      reason: "spoiler-locked",
    });
    expect(envelope).not.toBeNull();
    expect(envelope?.status).toBe("abstained");
    expect(envelope?.reason).toBe("spoiler-locked");
    expect(envelope?.text).toContain("No mostraré su contenido");
    expect(Object.isFrozen(envelope)).toBe(true);
  });

  it("does not accept arbitrary abstention text or unknown reason codes", () => {
    expect(createHoidNarrativeAbstentionEnvelope({
      domain: "conversation",
      progressScope,
      reason: "unavailable",
      text: "Prosa libre no autorizada",
    })).toBeNull();
    expect(createHoidNarrativeAbstentionEnvelope({
      domain: "conversation",
      progressScope,
      reason: "provider-error",
    })).toBeNull();
  });
});
