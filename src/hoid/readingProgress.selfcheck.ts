import { isWithinProgress, validateProgress } from "./readingProgress";

const books = ["mistborn-el-imperio-final", "el-camino-de-los-reyes"];

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const accepted = validateProgress(
  { bookId: " Mistborn-El-Imperio-Final ", chapter: 12 },
  books,
);
assert(accepted.kind === "accepted", "valid progress must be accepted");

const unknown = validateProgress({ bookId: "future-book", chapter: 1 }, books);
assert(unknown.kind === "rejected", "unknown books must fail closed");

const invalid = validateProgress(
  { bookId: books[0], chapter: 0 },
  books,
);
assert(invalid.kind === "rejected", "chapter zero must be rejected");

assert(
  isWithinProgress(
    { bookId: books[0], chapter: 12 },
    { bookId: books[0], chapter: 12 },
  ),
  "reached chapter must be allowed",
);
assert(
  !isWithinProgress(
    { bookId: books[0], chapter: 12 },
    { bookId: books[0], chapter: 13 },
  ),
  "future chapter must be blocked",
);
assert(
  !isWithinProgress(
    { bookId: books[0], chapter: 12 },
    { bookId: books[1], chapter: 1 },
  ),
  "cross-book evidence must be blocked",
);
