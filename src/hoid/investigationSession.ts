import { canonicalizeHoidAnswerBookScope } from "./answerScope";
import type { HoidCharacterEvolutionDimension } from "./entityEvolutionExplanationIntent";
import { sha256Hex } from "./sha256";

export type HoidInvestigationDomain =
  | "character-evolution"
  | "magic-system"
  | "entity-dossier"
  | "entity-relationship"
  | "entity-timeline";

export type HoidInvestigationTopic =
  | "overview"
  | HoidCharacterEvolutionDimension
  | "principle"
  | "rule"
  | "limitation"
  | "cost"
  | "application"
  | "exception"
  | "interaction"
  | "timeline";

export type HoidInvestigationTurnTicket = Readonly<{
  epoch: number;
}>;

export type HoidInvestigationHistoryEntry = Readonly<{
  /** A one-way lookup key for the canonical subject label; the label itself is never retained. */
  subjectFingerprint: string;
  domain: HoidInvestigationDomain;
  topic: HoidInvestigationTopic;
  progressRevision: number;
  progressFingerprint: string;
  scopeFingerprint: string;
  sequence: number;
}>;

export type HoidInvestigationSuggestionLike =
  | Readonly<{
      dimension: HoidCharacterEvolutionDimension;
      question: string;
      citations: readonly unknown[];
    }>
  | Readonly<{
      topic: HoidInvestigationTopic;
      question: string;
      citations: readonly unknown[];
    }>;

export type HoidInvestigationSession = Readonly<{
  /** Starts a new request owner while retaining completed entries for this screen session. */
  begin(): HoidInvestigationTurnTicket;
  /** Checks the exact in-memory ticket identity. */
  isCurrent(ticket: unknown): ticket is HoidInvestigationTurnTicket;
  /** Records only a completed, progress-validated investigation. */
  recordCompleted(ticket: unknown, input: unknown): boolean;
  /** Checks whether one domain/topic pair has already been investigated in the exact same scope. */
  hasCompleted(input: unknown): boolean;
  /** Removes completed topics for this subject and exact reading scope. */
  filterSuggestions<T extends HoidInvestigationSuggestionLike>(
    ticket: unknown,
    input: unknown,
  ): readonly T[];
  /** Returns metadata only; subject labels and question text are never retained. */
  getHistory(): readonly HoidInvestigationHistoryEntry[];
  /** Clears the session and invalidates every outstanding ticket. */
  reset(): void;
}>;

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const MAX_SUBJECT_LABEL_LENGTH = 256;
const MAX_QUESTION_LENGTH = 4_000;
const MAX_SUGGESTIONS = 8;
const MAX_CITATIONS = 64;
export const HOID_INVESTIGATION_SESSION_LIMIT = 64;

const DIMENSIONS: readonly HoidCharacterEvolutionDimension[] = Object.freeze([
  "perspective",
  "knowledge",
  "capability",
  "affiliation",
  "relationship",
  "status",
  "motivation",
  "cause",
]);
function isEvolutionDimension(value: unknown): value is HoidCharacterEvolutionDimension {
  return typeof value === "string" && (DIMENSIONS as readonly string[]).includes(value);
}

function exactRecord(
  value: unknown,
  expectedKeys: readonly string[],
  requiredKeys: readonly string[] = expectedKeys,
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length < requiredKeys.length || keys.length > expectedKeys.length) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !expectedKeys.includes(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    for (const key of requiredKeys) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    }
    return result;
  } catch {
    return null;
  }
}

function denseArray(value: unknown, minimum: number, maximum: number): readonly unknown[] | null {
  try {
    if (
      !Array.isArray(value) ||
      value.length < minimum ||
      value.length > maximum ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;

    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result.push(descriptor.value);
    }
    for (const key of keys) {
      if (key === "length") continue;
      if (
        typeof key !== "string" ||
        !/^(0|[1-9][0-9]*)$/u.test(key) ||
        Number(key) >= value.length
      ) return null;
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function validText(value: unknown, maximum: number): value is string {
  return typeof value === "string" &&
    value === value.trim() &&
    value.length >= 1 &&
    value.length <= maximum &&
    !/[\u0000-\u001F\u007F\p{Cf}]/u.test(value);
}

function isInvestigationDomain(value: unknown): value is HoidInvestigationDomain {
  return value === "character-evolution" ||
    value === "magic-system" ||
    value === "entity-dossier" ||
    value === "entity-relationship" ||
    value === "entity-timeline";
}

const MAGIC_SYSTEM_TOPICS: readonly string[] = Object.freeze([
  "principle",
  "rule",
  "limitation",
  "cost",
  "application",
  "exception",
  "interaction",
]);

function canonicalTopic(
  value: unknown,
  domain: HoidInvestigationDomain,
): value is HoidInvestigationTopic {
  if (domain === "character-evolution") {
    return value === "overview" || isEvolutionDimension(value);
  }
  if (domain === "magic-system") {
    return value === "overview" ||
      (typeof value === "string" && MAGIC_SYSTEM_TOPICS.includes(value));
  }
  if (domain === "entity-dossier") return value === "overview";
  if (domain === "entity-relationship") return value === "relationship";
  return value === "timeline";
}

function canonicalSubjectFingerprint(value: unknown): string | null {
  if (!validText(value, MAX_SUBJECT_LABEL_LENGTH)) return null;
  const normalized = value
    .normalize("NFKD")
    .replace(/[\p{Mn}\p{Cf}]/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  if (!normalized) return null;
  return sha256Hex(normalized);
}

type CanonicalInvestigationContext = Readonly<{
  subjectFingerprint: string;
  domain: HoidInvestigationDomain;
  progressRevision: number;
  progressFingerprint: string;
  scopeFingerprint: string;
}>;

function canonicalContext(value: unknown): CanonicalInvestigationContext | null {
  const raw = exactRecord(
    value,
    ["subjectLabel", "progressRevision", "progressFingerprint", "bookScope", "domain"],
    ["subjectLabel", "progressRevision", "progressFingerprint", "bookScope"],
  );
  if (
    !raw ||
    typeof raw.progressRevision !== "number" ||
    !Number.isSafeInteger(raw.progressRevision) ||
    raw.progressRevision < 0 ||
    typeof raw.progressFingerprint !== "string" ||
    !SHA256_PATTERN.test(raw.progressFingerprint)
  ) return null;

  const domain = raw.domain === undefined ? "character-evolution" : raw.domain;
  if (!isInvestigationDomain(domain)) return null;
  const subjectFingerprint = canonicalSubjectFingerprint(raw.subjectLabel);
  const bookScope = canonicalizeHoidAnswerBookScope(raw.bookScope);
  if (!subjectFingerprint || !bookScope) return null;

  const scopeFingerprint = sha256Hex(JSON.stringify({
    mode: bookScope.mode,
    bookIds: bookScope.bookIds,
    progressRevision: raw.progressRevision,
    progressFingerprint: raw.progressFingerprint,
  }));

  return Object.freeze({
    subjectFingerprint,
    domain,
    progressRevision: raw.progressRevision,
    progressFingerprint: raw.progressFingerprint,
    scopeFingerprint,
  });
}

function sameEntryContext(
  entry: HoidInvestigationHistoryEntry,
  context: CanonicalInvestigationContext,
): boolean {
  return entry.subjectFingerprint === context.subjectFingerprint &&
    entry.domain === context.domain &&
    entry.progressRevision === context.progressRevision &&
    entry.progressFingerprint === context.progressFingerprint &&
    entry.scopeFingerprint === context.scopeFingerprint;
}

function sameTopicEntry(
  entry: HoidInvestigationHistoryEntry,
  context: CanonicalInvestigationContext,
  topic: HoidInvestigationTopic,
): boolean {
  return sameEntryContext(entry, context) && entry.topic === topic;
}

/**
 * Ephemeral, provider-neutral history of successfully completed narrative
 * investigations across characters, magic systems, entity dossiers,
 * relationships and timelines. It stores hashes and scope metadata only:
 * no user question, answer prose, EPUB locator, evidence ID or source text.
 *
 * The host must call recordCompleted only after the normal answer path has
 * revalidated progress and is about to commit the corresponding safe result.
 * The domain/topic pair is validated independently so unrelated investigation
 * types for the same subject can never suppress one another.
 */
export function createHoidInvestigationSession(): HoidInvestigationSession {
  let epoch = 0;
  let sequence = 0;
  let activeTicket: HoidInvestigationTurnTicket | null = null;
  const entries: HoidInvestigationHistoryEntry[] = [];

  const isCurrent = (ticket: unknown): ticket is HoidInvestigationTurnTicket =>
    ticket !== null &&
    typeof ticket === "object" &&
    activeTicket === ticket;

  const hasCompletedContext = (
    context: CanonicalInvestigationContext,
    topic: HoidInvestigationTopic,
  ): boolean => entries.some(entry => sameTopicEntry(entry, context, topic));

  return Object.freeze({
    begin(): HoidInvestigationTurnTicket {
      epoch = epoch >= Number.MAX_SAFE_INTEGER ? 0 : epoch + 1;
      activeTicket = Object.freeze({ epoch });
      return activeTicket;
    },

    isCurrent,

    recordCompleted(ticket: unknown, input: unknown): boolean {
      if (!isCurrent(ticket)) return false;
      const raw = exactRecord(
        input,
        ["subjectLabel", "topic", "progressRevision", "progressFingerprint", "bookScope", "domain"],
        ["subjectLabel", "topic", "progressRevision", "progressFingerprint", "bookScope"],
      );
      if (!raw) return false;
      const context = canonicalContext({
        subjectLabel: raw.subjectLabel,
        progressRevision: raw.progressRevision,
        progressFingerprint: raw.progressFingerprint,
        bookScope: raw.bookScope,
        ...(raw.domain === undefined ? {} : { domain: raw.domain }),
      });
      if (!context || !canonicalTopic(raw.topic, context.domain)) return false;
      if (hasCompletedContext(context, raw.topic)) return true;

      sequence = sequence >= Number.MAX_SAFE_INTEGER ? 1 : sequence + 1;
      const entry: HoidInvestigationHistoryEntry = Object.freeze({
        ...context,
        topic: raw.topic,
        sequence,
      });
      if (entries.length >= HOID_INVESTIGATION_SESSION_LIMIT) entries.shift();
      entries.push(entry);
      return true;
    },

    hasCompleted(input: unknown): boolean {
      const raw = exactRecord(
        input,
        ["subjectLabel", "topic", "progressRevision", "progressFingerprint", "bookScope", "domain"],
        ["subjectLabel", "topic", "progressRevision", "progressFingerprint", "bookScope"],
      );
      if (!raw) return false;
      const context = canonicalContext({
        subjectLabel: raw.subjectLabel,
        progressRevision: raw.progressRevision,
        progressFingerprint: raw.progressFingerprint,
        bookScope: raw.bookScope,
        ...(raw.domain === undefined ? {} : { domain: raw.domain }),
      });
      return context && canonicalTopic(raw.topic, context.domain)
        ? hasCompletedContext(context, raw.topic)
        : false;
    },

    filterSuggestions<T extends HoidInvestigationSuggestionLike>(
      ticket: unknown,
      input: unknown,
    ): readonly T[] {
      if (!isCurrent(ticket)) return Object.freeze([]);
      const raw = exactRecord(
        input,
        ["subjectLabel", "progressRevision", "progressFingerprint", "bookScope", "suggestions", "domain"],
        ["subjectLabel", "progressRevision", "progressFingerprint", "bookScope", "suggestions"],
      );
      if (!raw) return Object.freeze([]);
      const context = canonicalContext({
        subjectLabel: raw.subjectLabel,
        progressRevision: raw.progressRevision,
        progressFingerprint: raw.progressFingerprint,
        bookScope: raw.bookScope,
        ...(raw.domain === undefined ? {} : { domain: raw.domain }),
      });
      const suggestions = denseArray(raw.suggestions, 0, MAX_SUGGESTIONS);
      if (!context || !suggestions) return Object.freeze([]);

      const visible: T[] = [];
      for (const suggestion of suggestions) {
        const item = context.domain === "character-evolution"
          ? exactRecord(suggestion, ["dimension", "question", "citations"])
          : exactRecord(suggestion, ["topic", "question", "citations"]);
        if (
          !item ||
          !validText(item.question, MAX_QUESTION_LENGTH) ||
          !denseArray(item.citations, 1, MAX_CITATIONS)
        ) continue;
        const topic = context.domain === "character-evolution" ? item.dimension : item.topic;
        if (!canonicalTopic(topic, context.domain)) continue;
        if (!hasCompletedContext(context, topic)) {
          visible.push(suggestion as T);
        }
      }
      return Object.freeze(visible);
    },

    getHistory(): readonly HoidInvestigationHistoryEntry[] {
      return Object.freeze(entries.map(entry => Object.freeze({ ...entry })));
    },

    reset(): void {
      epoch = epoch >= Number.MAX_SAFE_INTEGER ? 0 : epoch + 1;
      activeTicket = null;
      sequence = 0;
      entries.length = 0;
    },
  });
}
