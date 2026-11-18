import { describe, expect, it } from "vitest";
import {
  createHoidTopicInterestContext,
  validateHoidTopicInterestContext,
} from "./topicInterestContext";

const progress = Object.freeze({ revision: 12, fingerprint: "a".repeat(64) });
const topics = Object.freeze(["investiture-system", "organization"] as const);

describe("Hoid explicit topic-interest context", () => {
  it("creates an immutable metadata-only context and preserves selection order", () => {
    const result = createHoidTopicInterestContext(topics, progress);
    expect(result).toEqual({
      schemaVersion: 1,
      kind: "explicit-topic-interests",
      topicIds: topics,
      progressRevision: 12,
      progressFingerprint: "a".repeat(64),
    });
    expect(result?.topicIds).toEqual(["investiture-system", "organization"]);
    expect(JSON.stringify(result)).not.toMatch(/character name|claim prose|citation|epub/i);
  });

  it("rejects an empty selection and more than eight topics", () => {
    expect(createHoidTopicInterestContext([], progress)).toBeNull();
    expect(createHoidTopicInterestContext([
      "investiture-system", "organization", "artifact", "phenomenon",
      "character", "place", "narrative-theme", "investiture-system",
    ], progress)).toBeNull();
  });

  it("rejects unknown and duplicate topic IDs", () => {
    expect(createHoidTopicInterestContext(["unknown-topic", "organization"], progress)).toBeNull();
    expect(createHoidTopicInterestContext(["organization", "organization"], progress)).toBeNull();
  });

  it("rejects extra properties and accessor-backed topic arrays without invoking getters", () => {
    const valid = createHoidTopicInterestContext(topics, progress);
    expect(validateHoidTopicInterestContext({ ...valid, names: ["private"] }, progress).status)
      .toBe("unavailable");

    let invoked = false;
    const hostile = ["investiture-system", "organization"] as unknown[];
    Object.defineProperty(hostile, "1", {
      enumerable: true,
      get() { invoked = true; return "organization"; },
    });
    expect(createHoidTopicInterestContext(hostile, progress)).toBeNull();
    expect(invoked).toBe(false);
  });

  it("rejects sparse arrays and arrays with custom properties", () => {
    const sparse = new Array(2);
    sparse[1] = "organization";
    expect(createHoidTopicInterestContext(sparse, progress)).toBeNull();
    const custom = ["organization"] as string[] & { extra?: boolean };
    custom.extra = true;
    expect(createHoidTopicInterestContext(custom, progress)).toBeNull();
  });

  it("rejects malformed progress identities", () => {
    expect(createHoidTopicInterestContext(topics, { revision: -1, fingerprint: "a".repeat(64) })).toBeNull();
    expect(createHoidTopicInterestContext(topics, { revision: 12, fingerprint: "bad" })).toBeNull();
  });

  it("validates the exact progress revision and fingerprint", () => {
    const context = createHoidTopicInterestContext(topics, progress);
    expect(validateHoidTopicInterestContext(context, progress).status).toBe("valid");
    expect(validateHoidTopicInterestContext(context, {
      revision: 13,
      fingerprint: "a".repeat(64),
    })).toEqual({ status: "unavailable", reason: "stale-context" });
    expect(validateHoidTopicInterestContext(context, {
      revision: 12,
      fingerprint: "b".repeat(64),
    })).toEqual({ status: "unavailable", reason: "stale-context" });
  });

  it("distinguishes missing, malformed and invalid-progress contexts", () => {
    expect(validateHoidTopicInterestContext(undefined, progress))
      .toEqual({ status: "unavailable", reason: "missing-context" });
    expect(validateHoidTopicInterestContext({ ...createHoidTopicInterestContext(topics, progress), extra: true }, progress))
      .toEqual({ status: "unavailable", reason: "invalid-context" });
    expect(validateHoidTopicInterestContext(createHoidTopicInterestContext(topics, progress), null))
      .toEqual({ status: "unavailable", reason: "invalid-progress" });
  });

  it("does not retain labels, user prose, source locators or reading history", () => {
    const result = createHoidTopicInterestContext(topics, progress);
    expect(result).not.toHaveProperty("labels");
    expect(result).not.toHaveProperty("question");
    expect(result).not.toHaveProperty("sourceLocators");
    expect(result).not.toHaveProperty("readingHistory");
    expect(result).not.toHaveProperty("answers");
  });
});
