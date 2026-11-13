import { describe, expect, it } from "vitest";
import { createProgressSnapshot, readingFromSnapshot } from "./progressSnapshot";

describe("Hoid progress snapshot", () => {
  it("detaches the authorization ceiling from later caller mutation", () => {
    const progress = [{ bookId: "book-a", chapter: 3, completed: false }];
    const snapshot = createProgressSnapshot(progress);

    expect(snapshot).not.toBeNull();
    progress[0].chapter = 99;

    expect(snapshot!.reading[0].chapter).toBe(3);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot!.reading)).toBe(true);
  });

  it("fails closed when progress is malformed", () => {
    expect(createProgressSnapshot([{ bookId: "book-a", chapter: -1 }])).toBeNull();
  });

  it("returns detached reading for downstream consumers", () => {
    const snapshot = createProgressSnapshot([{ bookId: "book-a", chapter: 4, completed: false }])!;
    const reading = readingFromSnapshot(snapshot);

    expect(reading).not.toBe(snapshot.reading);
    expect(reading).toEqual(snapshot.reading);
    expect(Object.isFrozen(reading)).toBe(true);
  });
});
