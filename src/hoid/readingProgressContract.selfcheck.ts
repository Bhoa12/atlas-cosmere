import { authorizeScope, buildProgressIndex } from "./readingProgressContract";

const progress = buildProgressIndex([{ bookId: "mistborn-final-empire", chapter: 12 }]);
function expect(value: boolean, message: string): void {
  if (!value) throw new Error(message);
}
expect(authorizeScope({ bookId: "mistborn-final-empire", chapter: 12 }, progress).allowed, "reached chapter should pass");
expect(!authorizeScope({ bookId: "mistborn-final-empire", chapter: 13 }, progress).allowed, "future chapter must fail");
expect(!authorizeScope({ bookId: "elantris", chapter: 0 }, progress).allowed, "missing book progress must fail");
