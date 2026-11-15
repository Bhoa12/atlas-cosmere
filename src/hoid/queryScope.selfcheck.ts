import { resolveQueryScope } from "./queryScope";

const progress = [{ workId: "mistborn-final-empire", chapter: 12 }];

const accepted = resolveQueryScope(
  { question: "  ¿Qué   puedo  entender hasta aquí? ", requestedWorkId: "mistborn-final-empire", requestedChapter: 12 },
  progress,
);
if (!accepted.ok || accepted.maxChapter !== 12 || accepted.question !== "¿Qué puedo entender hasta aquí?") {
  throw new Error("Expected an in-progress query to resolve conservatively");
}

const future = resolveQueryScope(
  { question: "Explícame esto", requestedWorkId: "mistborn-final-empire", requestedChapter: 13 },
  progress,
);
if (future.ok || future.reason !== "CHAPTER_BEYOND_PROGRESS") {
  throw new Error("Future chapter must be rejected");
}

const unknown = resolveQueryScope(
  { question: "Explícame esta obra", requestedWorkId: "elantris" },
  progress,
);
if (unknown.ok || unknown.reason !== "UNKNOWN_WORK") {
  throw new Error("Work without explicit progress must be rejected");
}

const empty = resolveQueryScope({ question: "   " }, progress);
if (empty.ok || empty.reason !== "EMPTY_QUESTION") {
  throw new Error("Empty questions must fail closed");
}
