import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_READING_POSITION_BOOK_ID_LENGTH,
  DEFAULT_MAX_READING_POSITION_CHAPTER,
  DEFAULT_MAX_READING_POSITION_ORDER,
  DEFAULT_MAX_READING_POSITIONS,
  validReadingPositions,
} from "./readingValidation";

describe("validReadingPositions", () => {
  it("rejects a non-array reading state", () => {
    expect(validReadingPositions({})).toBeNull();
  });

  it("rejects the whole snapshot when any position is malformed", () => {
    expect(validReadingPositions([null, { bookId: "mistborn", chapter: 4 }])).toBeNull();
    expect(validReadingPositions([{}, { bookId: "mistborn", chapter: 4 }])).toBeNull();
    expect(validReadingPositions([
      { bookId: "mistborn", chapter: -1 },
      { bookId: "roshar", chapter: 4 },
    ])).toBeNull();
    expect(validReadingPositions([
      { bookId: "mistborn", chapter: Number.POSITIVE_INFINITY },
      { bookId: "roshar", chapter: 4 },
    ])).toBeNull();
  });

  it("rejects oversized book identifiers instead of dropping them", () => {
    const oversizedBookId = "x".repeat(DEFAULT_MAX_READING_POSITION_BOOK_ID_LENGTH + 1);
    expect(validReadingPositions([
      { bookId: oversizedBookId, chapter: 999 },
      { bookId: "mistborn", chapter: 4 },
    ])).toBeNull();
  });

  it("rejects oversized chapter values instead of retaining a partial snapshot", () => {
    expect(validReadingPositions([
      { bookId: "mistborn", chapter: DEFAULT_MAX_READING_POSITION_CHAPTER + 1 },
      { bookId: "roshar", chapter: 4 },
    ])).toBeNull();
  });

  it("rejects oversized ordering metadata", () => {
    expect(validReadingPositions([
      { bookId: "mistborn", chapter: 4, order: DEFAULT_MAX_READING_POSITION_ORDER + 1 },
    ])).toBeNull();
  });

  it("accepts only literal true as an explicit completion state", () => {
    expect(validReadingPositions([{ bookId: "roshar", completed: true }]))
      .toEqual([{ bookId: "roshar", completed: true }]);
    expect(validReadingPositions([{ bookId: "roshar", completed: "yes" }])).toBeNull();
    expect(validReadingPositions([{ bookId: "roshar", completed: false }])).toBeNull();
  });

  it("rejects chapter and completion on the same work", () => {
    expect(validReadingPositions([{ bookId: "tfe", chapter: 1, completed: true }])).toBeNull();
    expect(validReadingPositions([{ bookId: "tfe", chapter: -1, completed: true }])).toBeNull();
  });

  it("rejects positions with neither chapter nor explicit completion", () => {
    expect(validReadingPositions([{ bookId: "tfe" }])).toBeNull();
  });

  it("rejects unknown fields instead of silently ignoring them", () => {
    expect(validReadingPositions([{ bookId: "tfe", chapter: 4, isFinished: true }])).toBeNull();
  });

  it("rejects inherited position fields", () => {
    const inherited = Object.create({ bookId: "tfe", chapter: 38 });
    expect(validReadingPositions([inherited])).toBeNull();
  });

  it("rejects accessors without invoking them", () => {
    let getterCalled = false;
    const accessorPosition = Object.defineProperty({}, "bookId", {
      enumerable: true,
      get() {
        getterCalled = true;
        return "tfe";
      },
    });
    Object.defineProperty(accessorPosition, "chapter", { enumerable: true, value: 4 });

    expect(validReadingPositions([accessorPosition])).toBeNull();
    expect(getterCalled).toBe(false);
  });

  it("rejects symbol properties and hostile proxies", () => {
    const withSymbol = { bookId: "tfe", chapter: 4 };
    Object.defineProperty(withSymbol, Symbol("extra"), { value: "ignored" });
    expect(validReadingPositions([withSymbol])).toBeNull();

    const hostileProxy = new Proxy({}, {
      getPrototypeOf() {
        throw new Error("synthetic proxy failure");
      },
    });
    expect(validReadingPositions([hostileProxy])).toBeNull();
  });

  it("rejects duplicate positions for one work", () => {
    expect(validReadingPositions([
      { bookId: "mistborn", chapter: 2 },
      { bookId: "mistborn", chapter: 8 },
    ])).toBeNull();
  });

  it("rejects a chapter value that is not a safe integer", () => {
    expect(validReadingPositions([{ bookId: "tfe", chapter: 1.5 }])).toBeNull();
  });

  it("rejects oversized progress payloads instead of truncating by input order", () => {
    const payload = Array.from({ length: DEFAULT_MAX_READING_POSITIONS + 1 }, (_, index) => ({
      bookId: `book-${index}`,
      chapter: 1,
    }));
    expect(validReadingPositions(payload)).toBeNull();
  });

  it("accepts the two canonical progress forms with valid ordering metadata", () => {
    expect(validReadingPositions([
      { bookId: "tfe", chapter: 4, order: 2 },
      { bookId: "warbreaker", completed: true, order: 3 },
    ])).toEqual([
      { bookId: "tfe", chapter: 4, order: 2 },
      { bookId: "warbreaker", completed: true, order: 3 },
    ]);
  });

  it("rejects sparse progress arrays instead of iterating missing slots as undefined", () => {
    const sparse = new Array(2);
    sparse[1] = { bookId: "tfe", chapter: 4 };
    expect(validReadingPositions(sparse)).toBeNull();
  });

  it("rejects custom array properties without invoking a custom iterator", () => {
    let iteratorGetterCalled = false;
    const positions = [{ bookId: "tfe", chapter: 4 }];
    Object.defineProperty(positions, Symbol.iterator, {
      configurable: true,
      get() {
        iteratorGetterCalled = true;
        throw new Error("custom iterator must remain unused");
      },
    });

    expect(validReadingPositions(positions)).toBeNull();
    expect(iteratorGetterCalled).toBe(false);
  });

  it("rejects accessor-backed array elements without invoking them", () => {
    let elementGetterCalled = false;
    const positions = [undefined] as unknown[];
    Object.defineProperty(positions, "0", {
      configurable: true,
      enumerable: true,
      get() {
        elementGetterCalled = true;
        return { bookId: "tfe", chapter: 4 };
      },
    });

    expect(validReadingPositions(positions)).toBeNull();
    expect(elementGetterCalled).toBe(false);
  });

  it("rejects extra string and symbol properties on the progress array", () => {
    const extraString = [{ bookId: "tfe", chapter: 4 }] as unknown[] & { extra?: boolean };
    extraString.extra = true;
    expect(validReadingPositions(extraString)).toBeNull();

    const extraSymbol = [{ bookId: "tfe", chapter: 4 }];
    Object.defineProperty(extraSymbol, Symbol("extra"), { value: true });
    expect(validReadingPositions(extraSymbol)).toBeNull();
  });
});
