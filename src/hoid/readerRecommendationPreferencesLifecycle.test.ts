import { describe, expect, it } from "vitest";
import {
  createHoidReaderPreferenceOperationFence,
  type HoidReaderPreferenceOperationToken,
} from "./readerRecommendationPreferencesLifecycle";

describe("Hoid reader preference operation fence", () => {
  it("accepts a read token in its issuing generation", () => {
    const fence = createHoidReaderPreferenceOperationFence();
    const token = fence.beginRead();
    expect(fence.isCurrent(token)).toBe(true);
  });

  it("invalidates a pending read when the store generation changes", () => {
    const fence = createHoidReaderPreferenceOperationFence();
    const oldToken = fence.beginRead();
    fence.invalidate();
    expect(fence.isCurrent(oldToken)).toBe(false);
    expect(fence.isCurrent(fence.beginRead())).toBe(true);
  });

  it("invalidates a pending write after a store replacement", () => {
    const fence = createHoidReaderPreferenceOperationFence();
    const token = fence.tryBeginWrite();
    expect(token).not.toBeNull();
    fence.invalidate();
    expect(fence.isCurrent(token)).toBe(false);
  });

  it("allows only one write at a time", () => {
    const fence = createHoidReaderPreferenceOperationFence();
    const first = fence.tryBeginWrite();
    expect(first).not.toBeNull();
    expect(fence.tryBeginWrite()).toBeNull();
  });

  it("releases the write slot after completion", () => {
    const fence = createHoidReaderPreferenceOperationFence();
    const token = fence.tryBeginWrite();
    expect(token).not.toBeNull();
    expect(fence.finishWrite(token)).toBe(true);
    expect(fence.tryBeginWrite()).not.toBeNull();
  });

  it("releases a stale write without making its result current", () => {
    const fence = createHoidReaderPreferenceOperationFence();
    const token = fence.tryBeginWrite();
    expect(token).not.toBeNull();
    fence.invalidate();
    expect(fence.isCurrent(token)).toBe(false);
    expect(fence.finishWrite(token)).toBe(true);
    const next = fence.tryBeginWrite();
    expect(next).not.toBeNull();
    expect(fence.isCurrent(next)).toBe(true);
  });

  it("does not let a read token release the write slot", () => {
    const fence = createHoidReaderPreferenceOperationFence();
    const read = fence.beginRead();
    const write = fence.tryBeginWrite();
    expect(fence.finishWrite(read)).toBe(false);
    expect(fence.tryBeginWrite()).toBeNull();
    expect(fence.finishWrite(write)).toBe(true);
  });

  it("does not let a foreign fence token pass validation", () => {
    const first = createHoidReaderPreferenceOperationFence();
    const second = createHoidReaderPreferenceOperationFence();
    expect(second.isCurrent(first.beginRead())).toBe(false);
  });

  it("rejects null, primitive and forged tokens", () => {
    const fence = createHoidReaderPreferenceOperationFence();
    expect(fence.isCurrent(null)).toBe(false);
    expect(fence.isCurrent("token")).toBe(false);
    expect(fence.isCurrent({ generation: 0, id: 1, kind: "read" })).toBe(false);
    expect(fence.finishWrite({ generation: 0, id: 1, kind: "write" })).toBe(false);
  });

  it("keeps tokens opaque and immutable", () => {
    const fence = createHoidReaderPreferenceOperationFence();
    const token = fence.beginRead() as HoidReaderPreferenceOperationToken;
    expect(Object.isFrozen(token)).toBe(true);
    expect(Reflect.ownKeys(token)).toEqual([]);
  });

  it("does not release an active write merely because the generation is invalidated", () => {
    const fence = createHoidReaderPreferenceOperationFence();
    const token = fence.tryBeginWrite();
    fence.invalidate();
    expect(fence.tryBeginWrite()).toBeNull();
    expect(fence.finishWrite(token)).toBe(true);
    expect(fence.tryBeginWrite()).not.toBeNull();
  });

  it("supports repeated invalidation without reviving earlier operations", () => {
    const fence = createHoidReaderPreferenceOperationFence();
    const first = fence.beginRead();
    fence.invalidate();
    const second = fence.beginRead();
    fence.invalidate();
    const third = fence.beginRead();
    expect(fence.isCurrent(first)).toBe(false);
    expect(fence.isCurrent(second)).toBe(false);
    expect(fence.isCurrent(third)).toBe(true);
  });

  it("keeps independent fences isolated", () => {
    const first = createHoidReaderPreferenceOperationFence();
    const second = createHoidReaderPreferenceOperationFence();
    const firstWrite = first.tryBeginWrite();
    const secondWrite = second.tryBeginWrite();
    expect(firstWrite).not.toBeNull();
    expect(secondWrite).not.toBeNull();
    expect(first.finishWrite(secondWrite)).toBe(false);
    expect(second.finishWrite(firstWrite)).toBe(false);
    expect(first.finishWrite(firstWrite)).toBe(true);
    expect(second.finishWrite(secondWrite)).toBe(true);
  });

  it("rejects a second write even if the first token is stale", () => {
    const fence = createHoidReaderPreferenceOperationFence();
    const first = fence.tryBeginWrite();
    fence.invalidate();
    expect(fence.tryBeginWrite()).toBeNull();
    expect(fence.finishWrite(first)).toBe(true);
    expect(fence.tryBeginWrite()).not.toBeNull();
  });

  it("does not allow a completed write token to be reused", () => {
    const fence = createHoidReaderPreferenceOperationFence();
    const token = fence.tryBeginWrite();
    expect(fence.finishWrite(token)).toBe(true);
    expect(fence.isCurrent(token)).toBe(false);
    expect(fence.finishWrite(token)).toBe(false);
  });
});
