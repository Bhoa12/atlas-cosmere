import { normalizeHoidRequest } from "./requestContract";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const valid = normalizeHoidRequest({
  question: "  ¿Qué debo recordar de este capítulo?  ",
  intent: "explain",
  bookId: "mistborn-the-final-empire",
  chapter: 4,
});
assert(valid.valid, "Expected a valid request");
if (valid.valid) {
  assert(valid.question === "¿Qué debo recordar de este capítulo?", "Question must be trimmed");
}

assert(!normalizeHoidRequest({ question: "", intent: "explain", bookId: "x" }).valid, "Empty questions fail closed");
assert(!normalizeHoidRequest({ question: "x", intent: "unknown" as never, bookId: "x" }).valid, "Unknown intents fail closed");
assert(!normalizeHoidRequest({ question: "x", intent: "recommend", bookId: "" }).valid, "Missing books fail closed");
assert(!normalizeHoidRequest({ question: "x", intent: "explain", bookId: "x", chapter: 0 }).valid, "Invalid chapters fail closed");
