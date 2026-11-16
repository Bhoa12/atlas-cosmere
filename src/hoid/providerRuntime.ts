export type HoidIntent = "explain" | "recommend";

export interface ReaderProgress {
  bookId: string;
  chapter: number;
}

export interface SafeEvidence {
  id: string;
  bookId: string;
  chapter: number;
  accessible: boolean;
  summary: string;
}

export interface ProviderContext {
  question: string;
  intent: HoidIntent;
  progress: ReaderProgress;
  evidence: SafeEvidence[];
}

export type ProviderResult =
  | { kind: "answer"; text: string; evidenceIds: string[] }
  | { kind: "abstain"; reason: "no-authorized-evidence" | "invalid-progress" | "provider-failure" };

export interface HoidProvider {
  generate(context: ProviderContext): Promise<ProviderResult>;
}

export function buildProviderContext(
  question: string,
  intent: HoidIntent,
  progress: ReaderProgress,
  evidence: SafeEvidence[],
): ProviderContext | null {
  if (!question.trim() || !progress.bookId || !Number.isInteger(progress.chapter) || progress.chapter < 1) return null;
  const allowed = evidence.filter((item) =>
    item.accessible &&
    item.bookId === progress.bookId &&
    Number.isInteger(item.chapter) &&
    item.chapter >= 1 &&
    item.chapter <= progress.chapter &&
    item.id.trim().length > 0 &&
    item.summary.trim().length > 0,
  );
  return allowed.length ? { question: question.trim(), intent, progress, evidence: allowed } : null;
}

export async function runProvider(
  provider: HoidProvider,
  question: string,
  intent: HoidIntent,
  progress: ReaderProgress,
  evidence: SafeEvidence[],
): Promise<ProviderResult> {
  const context = buildProviderContext(question, intent, progress, evidence);
  if (!context) return { kind: "abstain", reason: "no-authorized-evidence" };
  try {
    const result = await provider.generate(context);
    if (result.kind === "answer") {
      const allowedIds = new Set(context.evidence.map((item) => item.id));
      if (!result.text.trim() || !result.evidenceIds.length || result.evidenceIds.some((id) => !allowedIds.has(id))) {
        return { kind: "abstain", reason: "provider-failure" };
      }
    }
    return result;
  } catch {
    return { kind: "abstain", reason: "provider-failure" };
  }
}
