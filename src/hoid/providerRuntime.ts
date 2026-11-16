export type HoidIntent = "explain" | "recommend";

export interface ReaderProgress {
  readonly bookId: string;
  readonly chapter: number;
}

export interface SafeEvidence {
  readonly id: string;
  readonly bookId: string;
  readonly chapter: number;
  readonly accessible: boolean;
  readonly summary: string;
}

export interface ProviderContext {
  readonly question: string;
  readonly intent: HoidIntent;
  readonly progress: ReaderProgress;
  readonly evidence: readonly SafeEvidence[];
}

export type AbstentionReason =
  | "invalid-request"
  | "invalid-progress"
  | "no-authorized-evidence"
  | "provider-failure";

export type ProviderResult =
  | { kind: "answer"; text: string; evidenceIds: string[] }
  | { kind: "abstain"; reason: AbstentionReason };

export interface HoidProvider {
  generate(context: ProviderContext): Promise<unknown>;
}

const MAX_QUESTION_CHARS = 4_000;
const MAX_EVIDENCE_ITEMS = 40;
const MAX_INPUT_EVIDENCE_ITEMS = 200;
const MAX_SUMMARY_CHARS = 3_000;
const MAX_CONTEXT_CHARS = 24_000;
const MAX_ANSWER_CHARS = 12_000;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

function isValidProgress(value: unknown): value is ReaderProgress {
  if (!isRecord(value)) return false;
  return isId(value.bookId) &&
    Number.isSafeInteger(value.chapter) &&
    (value.chapter as number) >= 1;
}

function isValidIntent(value: unknown): value is HoidIntent {
  return value === "explain" || value === "recommend";
}

function isValidQuestion(value: unknown): value is string {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= MAX_QUESTION_CHARS;
}

function validEvidenceShape(value: unknown): value is SafeEvidence {
  if (!isRecord(value)) return false;
  return isId(value.id) &&
    isId(value.bookId) &&
    Number.isSafeInteger(value.chapter) &&
    (value.chapter as number) >= 1 &&
    typeof value.accessible === "boolean" &&
    typeof value.summary === "string" &&
    value.summary.trim().length > 0 &&
    value.summary.length <= MAX_SUMMARY_CHARS;
}

export function buildProviderContext(
  question: string,
  intent: HoidIntent,
  progress: ReaderProgress,
  evidence: SafeEvidence[],
): ProviderContext | null {
  if (!isValidQuestion(question) || !isValidIntent(intent) ||
      !isValidProgress(progress) || !Array.isArray(evidence) ||
      evidence.length > MAX_INPUT_EVIDENCE_ITEMS) {
    return null;
  }

  const seenIds = new Set<string>();
  const allowed: SafeEvidence[] = [];
  let contextChars = question.trim().length;

  for (const candidate of evidence as unknown[]) {
    if (!isRecord(candidate) || !isId(candidate.id)) continue;
    if (seenIds.has(candidate.id)) return null;
    seenIds.add(candidate.id);

    if (!validEvidenceShape(candidate)) continue;
    if (!candidate.accessible ||
        candidate.bookId !== progress.bookId ||
        candidate.chapter > progress.chapter) {
      continue;
    }

    const summary = candidate.summary.trim();
    contextChars += summary.length;
    if (allowed.length >= MAX_EVIDENCE_ITEMS ||
        contextChars > MAX_CONTEXT_CHARS) {
      return null;
    }

    allowed.push(Object.freeze({
      id: candidate.id,
      bookId: candidate.bookId,
      chapter: candidate.chapter,
      accessible: true,
      summary,
    }));
  }

  if (allowed.length === 0) return null;

  return Object.freeze({
    question: question.trim(),
    intent,
    progress: Object.freeze({
      bookId: progress.bookId,
      chapter: progress.chapter,
    }),
    evidence: Object.freeze(allowed),
  });
}

function normalizeProviderResult(
  value: unknown,
  allowedIds: ReadonlySet<string>,
): ProviderResult {
  if (!isRecord(value)) {
    return { kind: "abstain", reason: "provider-failure" };
  }

  if (value.kind === "abstain") {
    const reason = value.reason;
    if (reason === "invalid-request" ||
        reason === "invalid-progress" ||
        reason === "no-authorized-evidence" ||
        reason === "provider-failure") {
      return { kind: "abstain", reason };
    }
    return { kind: "abstain", reason: "provider-failure" };
  }

  if (value.kind !== "answer" ||
      typeof value.text !== "string" ||
      value.text.trim().length === 0 ||
      value.text.length > MAX_ANSWER_CHARS ||
      !Array.isArray(value.evidenceIds) ||
      value.evidenceIds.length === 0 ||
      value.evidenceIds.length > MAX_EVIDENCE_ITEMS) {
    return { kind: "abstain", reason: "provider-failure" };
  }

  const cited = new Set<string>();
  for (const id of value.evidenceIds) {
    if (!isId(id) || !allowedIds.has(id) || cited.has(id)) {
      return { kind: "abstain", reason: "provider-failure" };
    }
    cited.add(id);
  }

  return {
    kind: "answer",
    text: value.text.trim(),
    evidenceIds: [...cited],
  };
}

export async function runProvider(
  provider: HoidProvider,
  question: string,
  intent: HoidIntent,
  progress: ReaderProgress,
  evidence: SafeEvidence[],
): Promise<ProviderResult> {
  if (!isValidProgress(progress)) {
    return { kind: "abstain", reason: "invalid-progress" };
  }
  if (!isValidQuestion(question) || !isValidIntent(intent)) {
    return { kind: "abstain", reason: "invalid-request" };
  }

  const context = buildProviderContext(question, intent, progress, evidence);
  if (!context) {
    return { kind: "abstain", reason: "no-authorized-evidence" };
  }
  if (!provider || typeof provider.generate !== "function") {
    return { kind: "abstain", reason: "provider-failure" };
  }

  // Snapshot the allow-list before calling untrusted provider code.
  const allowedIds = new Set(context.evidence.map((item) => item.id));

  try {
    const candidate = await provider.generate(context);
    return normalizeProviderResult(candidate, allowedIds);
  } catch {
    return { kind: "abstain", reason: "provider-failure" };
  }
}
