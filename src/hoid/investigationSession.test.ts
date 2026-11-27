import { describe, expect, it } from "vitest";
import {
  createHoidInvestigationSession,
  HOID_INVESTIGATION_SESSION_LIMIT,
} from "./investigationSession";

const FINGERPRINT_A = "a".repeat(64);
const FINGERPRINT_B = "b".repeat(64);
const SINGLE_SCOPE = Object.freeze({
  mode: "single-work" as const,
  bookIds: Object.freeze(["tfe"]),
});
const CROSS_SCOPE = Object.freeze({
  mode: "cross-work" as const,
  bookIds: Object.freeze(["tfe", "twok"]),
});

function context(overrides: Record<string, unknown> = {}) {
  return {
    subjectLabel: "Personaje Alfa",
    topic: "knowledge",
    progressRevision: 7,
    progressFingerprint: FINGERPRINT_A,
    bookScope: SINGLE_SCOPE,
    ...overrides,
  };
}

function suggestions() {
  return Object.freeze([
    Object.freeze({
      dimension: "knowledge" as const,
      question: "¿Qué conocimientos están documentados?",
      citations: Object.freeze([Object.freeze({ title: "El Imperio Final", chapter: 2 })]),
    }),
    Object.freeze({
      dimension: "relationship" as const,
      question: "¿Qué relaciones están documentadas?",
      citations: Object.freeze([Object.freeze({ title: "El Imperio Final", chapter: 4 })]),
    }),
    Object.freeze({
      dimension: "capability" as const,
      question: "¿Qué capacidades están documentadas?",
      citations: Object.freeze([Object.freeze({ title: "El Imperio Final", chapter: 5 })]),
    }),
  ]);
}

describe("Hoid session-scoped investigation history", () => {
  it("records only a completed topic for the exact progress and book scope", () => {
    const session = createHoidInvestigationSession();
    const ticket = session.begin();

    expect(session.recordCompleted(ticket, context())).toBe(true);
    expect(session.hasCompleted(context())).toBe(true);
    expect(session.hasCompleted(context({ topic: "relationship" }))).toBe(false);
    expect(session.hasCompleted(context({ progressRevision: 8 }))).toBe(false);
    expect(session.hasCompleted(context({ progressFingerprint: FINGERPRINT_B }))).toBe(false);
    expect(session.hasCompleted(context({ bookScope: CROSS_SCOPE }))).toBe(false);
  });

  it("suppresses only the completed dimension and keeps other safe suggestions", () => {
    const session = createHoidInvestigationSession();
    const ticket = session.begin();
    expect(session.recordCompleted(ticket, context())).toBe(true);

    const visible = session.filterSuggestions(ticket, {
      subjectLabel: "PERSONAJE ÁLFA",
      progressRevision: 7,
      progressFingerprint: FINGERPRINT_A,
      bookScope: SINGLE_SCOPE,
      suggestions: suggestions(),
    });

    expect(visible.map(item => "dimension" in item ? item.dimension : item.topic)).toEqual(["relationship", "capability"]);
  });

  it("does not suppress suggestions after the progress or selected book scope changes", () => {
    const session = createHoidInvestigationSession();
    const ticket = session.begin();
    expect(session.recordCompleted(ticket, context())).toBe(true);

    const forNewProgress = session.filterSuggestions(ticket, {
      subjectLabel: "Personaje Alfa",
      progressRevision: 8,
      progressFingerprint: FINGERPRINT_B,
      bookScope: SINGLE_SCOPE,
      suggestions: suggestions(),
    });
    const forCrossWorkScope = session.filterSuggestions(ticket, {
      subjectLabel: "Personaje Alfa",
      progressRevision: 7,
      progressFingerprint: FINGERPRINT_A,
      bookScope: CROSS_SCOPE,
      suggestions: suggestions(),
    });

    expect(forNewProgress).toHaveLength(3);
    expect(forCrossWorkScope).toHaveLength(3);
  });

  it("does not treat a broad overview as completion of every individual dimension", () => {
    const session = createHoidInvestigationSession();
    const ticket = session.begin();
    expect(session.recordCompleted(ticket, context({ topic: "overview" }))).toBe(true);

    const visible = session.filterSuggestions(ticket, {
      subjectLabel: "Personaje Alfa",
      progressRevision: 7,
      progressFingerprint: FINGERPRINT_A,
      bookScope: SINGLE_SCOPE,
      suggestions: suggestions(),
    });

    expect(visible).toHaveLength(3);
  });

  it("normalizes the canonical label without retaining the label or question text", () => {
    const session = createHoidInvestigationSession();
    const ticket = session.begin();
    expect(session.recordCompleted(ticket, context())).toBe(true);

    const history = session.getHistory();
    expect(history).toHaveLength(1);
    expect(JSON.stringify(history)).not.toContain("Personaje Alfa");
    expect(JSON.stringify(history)).not.toContain("conocimientos");
    expect(history[0].subjectFingerprint).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("deduplicates repeated completions without growing the history", () => {
    const session = createHoidInvestigationSession();
    const ticket = session.begin();
    expect(session.recordCompleted(ticket, context())).toBe(true);
    expect(session.recordCompleted(ticket, context())).toBe(true);
    expect(session.getHistory()).toHaveLength(1);
    expect(session.getHistory()[0].sequence).toBe(1);
  });

  it("rejects a superseded request ticket while retaining prior completed history", () => {
    const session = createHoidInvestigationSession();
    const oldTicket = session.begin();
    expect(session.recordCompleted(oldTicket, context())).toBe(true);

    const currentTicket = session.begin();
    expect(session.isCurrent(oldTicket)).toBe(false);
    expect(session.recordCompleted(oldTicket, context({ topic: "relationship" }))).toBe(false);
    expect(session.recordCompleted(currentTicket, context({ topic: "relationship" }))).toBe(true);
    expect(session.getHistory()).toHaveLength(2);
  });

  it("reset clears the history and invalidates outstanding tickets", () => {
    const session = createHoidInvestigationSession();
    const ticket = session.begin();
    expect(session.recordCompleted(ticket, context())).toBe(true);

    session.reset();

    expect(session.isCurrent(ticket)).toBe(false);
    expect(session.getHistory()).toEqual([]);
    expect(session.recordCompleted(ticket, context({ topic: "relationship" }))).toBe(false);
  });

  it("rejects malformed identities, unknown topics and non-canonical records", () => {
    const session = createHoidInvestigationSession();
    const ticket = session.begin();

    expect(session.recordCompleted(ticket, context({ topic: "future-dimension" }))).toBe(false);
    expect(session.recordCompleted(ticket, context({ progressFingerprint: "not-a-sha" }))).toBe(false);
    expect(session.recordCompleted(ticket, context({ subjectLabel: " " }))).toBe(false);
    expect(session.recordCompleted(ticket, { ...context(), extra: true })).toBe(false);
    expect(session.getHistory()).toHaveLength(0);
  });

  it("fails closed for malformed suggestions and stale tickets", () => {
    const session = createHoidInvestigationSession();
    const ticket = session.begin();
    const malformed = [{ dimension: "knowledge", question: "Pregunta", citations: [] }];

    expect(session.filterSuggestions(ticket, {
      subjectLabel: "Personaje Alfa",
      progressRevision: 7,
      progressFingerprint: FINGERPRINT_A,
      bookScope: SINGLE_SCOPE,
      suggestions: malformed,
    })).toEqual([]);

    const newer = session.begin();
    expect(session.filterSuggestions(ticket, {
      subjectLabel: "Personaje Alfa",
      progressRevision: 7,
      progressFingerprint: FINGERPRINT_A,
      bookScope: SINGLE_SCOPE,
      suggestions: suggestions(),
    })).toEqual([]);
    expect(session.isCurrent(newer)).toBe(true);
  });

  it("keeps a bounded history and evicts the oldest metadata entry", () => {
    const session = createHoidInvestigationSession();
    const ticket = session.begin();

    for (let index = 0; index < HOID_INVESTIGATION_SESSION_LIMIT + 1; index += 1) {
      expect(session.recordCompleted(ticket, context({
        subjectLabel: "Personaje " + index,
      }))).toBe(true);
    }

    const history = session.getHistory();
    expect(history).toHaveLength(HOID_INVESTIGATION_SESSION_LIMIT);
    expect(history[0].sequence).toBe(2);
    expect(history[history.length - 1].sequence).toBe(HOID_INVESTIGATION_SESSION_LIMIT + 1);
  });

  it("keeps magic-system facets separate from character dimensions for the same subject", () => {
    const session = createHoidInvestigationSession();
    const ticket = session.begin();
    const magicContext = context({
      subjectLabel: "Sistema Alfa",
      domain: "magic-system",
      topic: "rule",
    });
    expect(session.recordCompleted(ticket, magicContext)).toBe(true);
    expect(session.hasCompleted(magicContext)).toBe(true);
    expect(session.hasCompleted(context({
      subjectLabel: "Sistema Alfa",
      domain: "magic-system",
      topic: "principle",
    }))).toBe(false);
    expect(session.hasCompleted(context({
      subjectLabel: "Sistema Alfa",
      domain: "character-evolution",
      topic: "knowledge",
    }))).toBe(false);
  });

  it("records dossier, relationship and timeline investigations in separate domains", () => {
    const session = createHoidInvestigationSession();
    const ticket = session.begin();
    const cases = [
      { subjectLabel: "Entidad Alfa", domain: "entity-dossier", topic: "overview" },
      { subjectLabel: "Entidad Alfa ↔ Entidad Beta", domain: "entity-relationship", topic: "relationship" },
      { subjectLabel: "Entidad Alfa", domain: "entity-timeline", topic: "timeline" },
    ] as const;
    for (const item of cases) {
      expect(session.recordCompleted(ticket, context(item))).toBe(true);
      expect(session.hasCompleted(context(item))).toBe(true);
    }
    expect(session.getHistory().map(item => item.domain)).toEqual([
      "entity-dossier", "entity-relationship", "entity-timeline",
    ]);
    expect(session.getHistory().map(item => item.topic)).toEqual([
      "overview", "relationship", "timeline",
    ]);
  });

  it("filters generic topic suggestions only within the matching domain and subject", () => {
    const session = createHoidInvestigationSession();
    const ticket = session.begin();
    const shared = {
      subjectLabel: "Sistema Alfa",
      domain: "magic-system" as const,
      progressRevision: 7,
      progressFingerprint: FINGERPRINT_A,
      bookScope: SINGLE_SCOPE,
    };
    expect(session.recordCompleted(ticket, { ...shared, topic: "rule" })).toBe(true);
    const visible = session.filterSuggestions(ticket, {
      ...shared,
      suggestions: [
        { topic: "rule", question: "¿Qué reglas están documentadas?", citations: [{ title: "Obra", chapter: 2 }] },
        { topic: "limitation", question: "¿Qué limitaciones están documentadas?", citations: [{ title: "Obra", chapter: 3 }] },
      ],
    });
    expect(visible.map(item => "topic" in item ? item.topic : item.dimension)).toEqual(["limitation"]);
  });

  it("rejects domains paired with topics outside their own taxonomy", () => {
    const session = createHoidInvestigationSession();
    const ticket = session.begin();
    expect(session.recordCompleted(ticket, context({ domain: "magic-system", topic: "relationship" }))).toBe(false);
    expect(session.recordCompleted(ticket, context({ domain: "entity-timeline", topic: "knowledge" }))).toBe(false);
    expect(session.recordCompleted(ticket, context({ domain: "unknown-domain", topic: "overview" }))).toBe(false);
  });

});
