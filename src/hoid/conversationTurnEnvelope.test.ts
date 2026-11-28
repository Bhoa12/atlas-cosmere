import { describe, expect, it } from "vitest";
import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { getHoidReadingManifest, createHoidReadingCursor } from "./readingManifest";
import {
  createHoidNarrativeAnswerEnvelope,
} from "./narrativeAnswerEnvelope";
import {
  createProductionHoidInvestigationContextConversationAdapter,
} from "./investigationContextConversation";
import {
  createHoidConversationTurnEnvelope,
  isHoidConversationTurnEnvelope,
} from "./conversationTurnEnvelope";

const NOW = "2026-11-28T13:00:00.000Z";
const readySources = HOID_SOURCE_BIBLIOGRAPHY.filter(work => {
  const result = getHoidReadingManifest(work.id);
  return result.status === "ready" && result.manifest.units.length > 0;
});
if (readySources.length < 2) throw new Error("Turn-envelope tests require two indexed works");
const source = readySources[0]!;
const otherSource = readySources[1]!;
const manifestResult = getHoidReadingManifest(source.id);
if (manifestResult.status !== "ready") throw new Error("Source manifest unavailable");
const unit = manifestResult.manifest.units[0];
if (!unit) throw new Error("Source chapter unit unavailable");
const matchingUnits = manifestResult.manifest.units.filter(item => item.chapterNumber === unit.chapterNumber);
const citation = Object.freeze({
  sourceBookId: source.id,
  title: source.title,
  chapter: unit.chapterNumber,
  chapterOrdinal: unit.ordinal,
  chapterLabelAmbiguous: matchingUnits.length > 1 ||
    manifestResult.manifest.ambiguousChapterNumbers.includes(unit.chapterNumber),
});
const progressScope = Object.freeze({ revision: 12, fingerprint: "a".repeat(64) });
const bookScope = Object.freeze({
  mode: "single-work" as const,
  bookIds: Object.freeze([source.id]),
});

function snapshot(bookId: string, revision: number) {
  const cursor = createHoidReadingCursor(bookId, 1);
  if (cursor.status !== "ready") throw new Error("Synthetic cursor unavailable");
  return Object.freeze({
    schemaVersion: 2,
    revision,
    positions: Object.freeze([
      Object.freeze({ bookId, cursor: cursor.cursor }),
    ]),
    updatedAt: NOW,
  });
}

function answer() {
  const result = createHoidNarrativeAnswerEnvelope({
    domain: "character-evolution",
    progressScope,
    bookScope,
    displayText: "Explicación sintética para pruebas.",
    citations: [citation],
    segments: [{
      claimId: "synthetic-claim",
      text: "Afirmación sintética para pruebas.",
      citations: [citation],
      epistemicKind: "evidence-backed-assertion",
    }],
    layout: "plain",
  });
  if (!result) throw new Error("Synthetic answer envelope unavailable");
  return result;
}

function contextAt(bookId: string, revision: number, scope: Readonly<{
  mode: "single-work";
  bookIds: readonly string[];
}>) {
  const progress = snapshot(bookId, revision);
  const adapter = createProductionHoidInvestigationContextConversationAdapter(() => progress);
  if (!adapter) throw new Error("Production context adapter unavailable");
  const result = adapter.present({ progress, history: [], bookScope: scope });
  if (result.status !== "ready") throw new Error("Synthetic context presentation unavailable");
  return result;
}

describe("Hoid atomic conversation turn envelope", () => {
  it("composes one branded answer with same-scope follow-ups and trusted context", () => {
    const context = contextAt(source.id, 12, bookScope);
    const envelope = createHoidConversationTurnEnvelope({
      answer: answer(),
      followUpQuestions: [{
        dimension: "knowledge",
        question: "¿Qué conocimiento adicional está documentado hasta este capítulo?",
        citations: [citation],
      }],
      investigationContext: context,
    });
    expect(envelope).not.toBeNull();
    expect(isHoidConversationTurnEnvelope(envelope)).toBe(true);
    expect(envelope?.progressScope).toEqual(progressScope);
    expect(envelope?.followUpQuestions).toHaveLength(1);
    expect(envelope?.investigationContext?.links).toEqual([]);
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope?.followUpQuestions)).toBe(true);
  });

  it("rejects a structurally forged or JSON-restored answer brand", () => {
    const forged = JSON.parse(JSON.stringify(answer()));
    expect(createHoidConversationTurnEnvelope({ answer: forged })).toBeNull();
  });

  it("rejects a context presentation from another progress revision", () => {
    const context = contextAt(source.id, 13, bookScope);
    expect(createHoidConversationTurnEnvelope({
      answer: answer(),
      investigationContext: context,
    })).toBeNull();
  });

  it("rejects a context presentation from another selected-work scope", () => {
    const otherScope = Object.freeze({
      mode: "single-work" as const,
      bookIds: Object.freeze([otherSource.id]),
    });
    const context = contextAt(otherSource.id, 12, otherScope);
    expect(createHoidConversationTurnEnvelope({
      answer: answer(),
      investigationContext: context,
    })).toBeNull();
  });

  it("rejects follow-up citations not present in the answer's citation set", () => {
    const otherManifest = getHoidReadingManifest(otherSource.id);
    if (otherManifest.status !== "ready") throw new Error("Second manifest unavailable");
    const otherUnit = otherManifest.manifest.units[0];
    if (!otherUnit) throw new Error("Second chapter unit unavailable");
    const otherCitation = Object.freeze({
      sourceBookId: otherSource.id,
      title: otherSource.title,
      chapter: otherUnit.chapterNumber,
      chapterOrdinal: otherUnit.ordinal,
      chapterLabelAmbiguous: otherManifest.manifest.units.filter(
        item => item.chapterNumber === otherUnit.chapterNumber,
      ).length > 1 || otherManifest.manifest.ambiguousChapterNumbers.includes(otherUnit.chapterNumber),
    });
    expect(createHoidConversationTurnEnvelope({
      answer: answer(),
      followUpQuestions: [{
        dimension: "knowledge",
        question: "Pregunta sintética fuera de las citas.",
        citations: [otherCitation],
      }],
    })).toBeNull();
  });

  it("rejects duplicate dimensions, malformed questions and unknown fields", () => {
    const suggestion = {
      dimension: "knowledge",
      question: "Pregunta sintética.",
      citations: [citation],
    };
    expect(createHoidConversationTurnEnvelope({
      answer: answer(),
      followUpQuestions: [suggestion, suggestion],
    })).toBeNull();
    expect(createHoidConversationTurnEnvelope({
      answer: answer(),
      followUpQuestions: [{ ...suggestion, question: "  sin normalizar" }],
    })).toBeNull();
    expect(createHoidConversationTurnEnvelope({
      answer: answer(),
      provider: "untrusted",
    })).toBeNull();
  });

  it("rejects a context presentation supplied as a plain object", () => {
    const context = contextAt(source.id, 12, bookScope);
    const forged = JSON.parse(JSON.stringify(context));
    expect(createHoidConversationTurnEnvelope({
      answer: answer(),
      investigationContext: forged,
    })).toBeNull();
  });
});
