import { authorizeChapter } from "./chapterScope";

function expect(value: unknown, message: string): void {
  if (!value) throw new Error(message);
}

const progress = { bookId: "mistborn-final-empire", firstChapter: 1, lastChapter: 12 };

expect(
  authorizeChapter("mistborn-final-empire", { bookId: "mistborn-final-empire", chapter: 12 }, progress).allowed,
  "The reached chapter must be allowed",
);

expect(
  !authorizeChapter("mistborn-final-empire", { bookId: "mistborn-final-empire", chapter: 13 }, progress).allowed,
  "A future chapter must fail closed",
);

expect(
  !authorizeChapter("mistborn-final-empire", { bookId: "elantris", chapter: 1 }, progress).allowed,
  "Cross-book evidence must fail closed",
);

expect(
  !authorizeChapter("mistborn-final-empire", { bookId: "mistborn-final-empire", chapter: 0 }, progress).allowed,
  "Malformed chapters must fail closed",
);
