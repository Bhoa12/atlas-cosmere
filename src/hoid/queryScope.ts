export type HoidProgress = Readonly<{ workId: string; chapter: number }>;

export type HoidQuery = Readonly<{
  question: string;
  requestedWorkId?: string;
  requestedChapter?: number;
}>;

export type QueryScope =
  | Readonly<{ ok: true; workId?: string; maxChapter?: number; question: string }>
  | Readonly<{ ok: false; reason: "EMPTY_QUESTION" | "INVALID_REQUESTED_CHAPTER" | "UNKNOWN_WORK" | "CHAPTER_BEYOND_PROGRESS" }>;

const normalize = (value: string) => value.trim().replace(/\s+/g, " ");

export function resolveQueryScope(query: HoidQuery, progress: readonly HoidProgress[]): QueryScope {
  const question = normalize(query.question);
  if (!question) return { ok: false, reason: "EMPTY_QUESTION" };

  if (query.requestedChapter !== undefined &&
      (!Number.isInteger(query.requestedChapter) || query.requestedChapter < 0)) {
    return { ok: false, reason: "INVALID_REQUESTED_CHAPTER" };
  }

  if (!query.requestedWorkId) return { ok: true, question };

  const workProgress = progress
    .filter((item) => item.workId === query.requestedWorkId)
    .reduce<number | undefined>((max, item) => max === undefined ? item.chapter : Math.max(max, item.chapter), undefined);

  if (workProgress === undefined) return { ok: false, reason: "UNKNOWN_WORK" };

  if (query.requestedChapter !== undefined && query.requestedChapter > workProgress) {
    return { ok: false, reason: "CHAPTER_BEYOND_PROGRESS" };
  }

  return {
    ok: true,
    question,
    workId: query.requestedWorkId,
    maxChapter: query.requestedChapter ?? workProgress,
  };
}
