import { describe, expect, it } from "vitest";
import {
  createHoidCursorAnswerProgressBinding,
  fingerprintHoidCursorProgressProjection,
  validateHoidCursorAnswerProgressBinding,
  type HoidCursorProgressFingerprintProjection,
} from "./cursorProgressFingerprint";

function projection(
  revision = 4,
  positions: HoidCursorProgressFingerprintProjection["reading"] = [
    { bookId: "tfe", chapter: 8, order: 1 },
    { bookId: "wor", chapter: 3, order: 2 },
  ],
  startedBookIds: readonly string[] = ["tfe", "wor"],
): HoidCursorProgressFingerprintProjection {
  return { revision, reading: positions, startedBookIds };
}

describe("Hoid cursor progress fingerprint", () => {
  it("is stable when equivalent positions and started-work IDs arrive in another order", () => {
    const first = projection();
    const second = projection(4, [
      { bookId: "wor", chapter: 3, order: 2 },
      { bookId: "tfe", chapter: 8, order: 1 },
    ], ["wor", "tfe"]);
    expect(fingerprintHoidCursorProgressProjection(first))
      .toBe(fingerprintHoidCursorProgressProjection(second));
  });

  it("changes when the revision changes even if the projected positions do not", () => {
    expect(fingerprintHoidCursorProgressProjection(projection(4)))
      .not.toBe(fingerprintHoidCursorProgressProjection(projection(5)));
  });

  it("changes when a cursor position changes under the same revision", () => {
    const original = projection(4);
    const changed = projection(4, [
      { bookId: "tfe", chapter: 9, order: 1 },
      { bookId: "wor", chapter: 3, order: 2 },
    ]);
    expect(fingerprintHoidCursorProgressProjection(original))
      .not.toBe(fingerprintHoidCursorProgressProjection(changed));
  });

  it("creates a versioned immutable receipt for the exact projection", () => {
    const current = projection();
    const binding = createHoidCursorAnswerProgressBinding(current);
    expect(binding).toEqual({
      schemaVersion: 1,
      revision: 4,
      fingerprint: fingerprintHoidCursorProgressProjection(current),
    });
    expect(Object.isFrozen(binding)).toBe(true);
    expect(validateHoidCursorAnswerProgressBinding(binding, current)).toBe("match");
  });

  it("classifies a valid receipt from another snapshot as stale", () => {
    const binding = createHoidCursorAnswerProgressBinding(projection(4));
    expect(validateHoidCursorAnswerProgressBinding(binding, projection(4, [
      { bookId: "tfe", chapter: 9, order: 1 },
      { bookId: "wor", chapter: 3, order: 2 },
    ]))).toBe("stale");
  });

  it("rejects unknown fields and unsupported receipt versions", () => {
    const current = projection();
    const binding = createHoidCursorAnswerProgressBinding(current);
    expect(validateHoidCursorAnswerProgressBinding({ ...binding, extra: true }, current)).toBe("invalid");
    expect(validateHoidCursorAnswerProgressBinding({ ...binding, schemaVersion: 2 }, current)).toBe("invalid");
  });

  it("rejects malformed fingerprints and negative revisions", () => {
    const current = projection();
    const binding = createHoidCursorAnswerProgressBinding(current);
    expect(validateHoidCursorAnswerProgressBinding({ ...binding, fingerprint: "not-a-digest" }, current)).toBe("invalid");
    expect(validateHoidCursorAnswerProgressBinding({ ...binding, revision: -1 }, current)).toBe("invalid");
  });

  it("rejects accessors without executing them", () => {
    const current = projection();
    const binding = createHoidCursorAnswerProgressBinding(current);
    let getterCalls = 0;
    const hostile: Record<string, unknown> = {
      schemaVersion: 1,
      revision: 4,
    };
    Object.defineProperty(hostile, "fingerprint", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return binding.fingerprint;
      },
    });
    expect(validateHoidCursorAnswerProgressBinding(hostile, current)).toBe("invalid");
    expect(getterCalls).toBe(0);
  });

  it("contains proxy traps at the public receipt boundary", () => {
    const current = projection();
    const binding = createHoidCursorAnswerProgressBinding(current);
    const hostile = new Proxy(binding, {
      ownKeys() {
        throw new Error("hostile receipt proxy");
      },
    });
    expect(validateHoidCursorAnswerProgressBinding(hostile, current)).toBe("invalid");
  });
});
