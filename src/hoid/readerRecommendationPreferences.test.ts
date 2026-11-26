import { describe, expect, it } from "vitest";
import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import {
  getDefaultHoidReaderRecommendationPreferences,
  rankHoidCuratedPathRecommendationsForReader,
  validateHoidReaderRecommendationPreferences,
} from "./readerRecommendationPreferences";

function item(key: string, workId: string) {
  const work = HOID_SOURCE_BIBLIOGRAPHY.find(entry => entry.id === workId);
  if (!work) throw new Error("Unknown test work");
  return Object.freeze({
    key,
    pathTitle: "Ruta editorial sintética",
    workId,
    workTitle: work.title,
    whyNow: "Motivo editorial sintético y sin información narrativa.",
    selection: "manual-reader-selection-required" as const,
    rationaleAuthority: "signed-editorial-catalogue" as const,
  });
}

function ready(...items: ReturnType<typeof item>[]) {
  return Object.freeze({ status: "ready" as const, items: Object.freeze(items) });
}

function preferences(
  overrides: Partial<{
    revision: number;
    priorityWorkIds: readonly string[];
    deprioritizedWorkIds: readonly string[];
    maxItems: 1 | 3 | 5;
  }> = {},
) {
  const defaults = getDefaultHoidReaderRecommendationPreferences();
  return Object.freeze({ ...defaults, ...overrides });
}

describe("Hoid local reader recommendation preferences", () => {
  it("provides a valid empty default profile", () => {
    const result = validateHoidReaderRecommendationPreferences(
      getDefaultHoidReaderRecommendationPreferences(),
    );
    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.preferences.revision).toBe(0);
      expect(result.preferences.priorityWorkIds).toEqual([]);
      expect(result.preferences.deprioritizedWorkIds).toEqual([]);
      expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/u);
    }
  });

  it("accepts only works in the supplied metadata bibliography", () => {
    const result = validateHoidReaderRecommendationPreferences(preferences({
      priorityWorkIds: ["tfe", "elantris"],
    }));
    expect(result.status).toBe("valid");
  });

  it("rejects unknown work identifiers", () => {
    const result = validateHoidReaderRecommendationPreferences(preferences({
      priorityWorkIds: ["unverified-work"],
    }));
    expect(result).toEqual({ status: "invalid", reason: "invalid-work" });
  });

  it("rejects a work assigned conflicting priority and deprioritization", () => {
    const result = validateHoidReaderRecommendationPreferences(preferences({
      priorityWorkIds: ["tfe"],
      deprioritizedWorkIds: ["tfe"],
    }));
    expect(result).toEqual({
      status: "invalid",
      reason: "conflicting-work-priority",
    });
  });

  it("rejects accessor-backed preference profiles without invoking getters", () => {
    let getterCalls = 0;
    const hostile = Object.create(null);
    Object.defineProperties(hostile, {
      schemaVersion: { enumerable: true, value: 1 },
      revision: { enumerable: true, value: 1 },
      priorityWorkIds: {
        enumerable: true,
        get() {
          getterCalls += 1;
          return ["tfe"];
        },
      },
      deprioritizedWorkIds: { enumerable: true, value: [] },
      maxItems: { enumerable: true, value: 5 },
    });
    expect(validateHoidReaderRecommendationPreferences(hostile)).toEqual({
      status: "invalid",
      reason: "invalid-shape",
    });
    expect(getterCalls).toBe(0);
  });

  it("ranks explicit priorities in the reader's chosen order", () => {
    const projection = ready(item("path-a.step-1", "elantris"), item("path-b.step-1", "tfe"), item("path-c.step-1", "warbreaker"));
    const result = rankHoidCuratedPathRecommendationsForReader(
      projection,
      preferences({ priorityWorkIds: ["warbreaker", "tfe"] }),
    );
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.items.map(entry => entry.workId)).toEqual([
        "warbreaker",
        "tfe",
        "elantris",
      ]);
    }
  });

  it("places deprioritized works after neutral eligible works", () => {
    const projection = ready(item("path-a.step-1", "elantris"), item("path-b.step-1", "tfe"), item("path-c.step-1", "warbreaker"));
    const result = rankHoidCuratedPathRecommendationsForReader(
      projection,
      preferences({ deprioritizedWorkIds: ["elantris"] }),
    );
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.items.map(entry => entry.workId)).toEqual([
        "tfe",
        "warbreaker",
        "elantris",
      ]);
    }
  });

  it("preserves original order for equal-priority items", () => {
    const projection = ready(item("path-a.step-1", "elantris"), item("path-b.step-1", "tfe"), item("path-c.step-1", "warbreaker"));
    const result = rankHoidCuratedPathRecommendationsForReader(projection);
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.items.map(entry => entry.workId)).toEqual([
        "elantris",
        "tfe",
        "warbreaker",
      ]);
    }
  });

  it("limits presentation without changing the number of eligible routes", () => {
    const projection = ready(item("path-a.step-1", "elantris"), item("path-b.step-1", "tfe"), item("path-c.step-1", "warbreaker"));
    const result = rankHoidCuratedPathRecommendationsForReader(
      projection,
      preferences({ maxItems: 1 }),
    );
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.eligibleItemCount).toBe(3);
      expect(result.displayedItemCount).toBe(1);
      expect(result.items).toHaveLength(1);
    }
  });

  it("does not create a recommendation for a preferred work absent from the safe projection", () => {
    const projection = ready(item("path-a.step-1", "elantris"));
    const result = rankHoidCuratedPathRecommendationsForReader(
      projection,
      preferences({ priorityWorkIds: ["tfe"] }),
    );
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.items.map(entry => entry.workId)).toEqual(["elantris"]);
    }
  });

  it("does not mutate the validated source projection", () => {
    const projection = ready(item("path-a.step-1", "elantris"), item("path-b.step-1", "tfe"));
    const before = projection.items.map(entry => entry.workId);
    rankHoidCuratedPathRecommendationsForReader(
      projection,
      preferences({ priorityWorkIds: ["tfe"] }),
    );
    expect(projection.items.map(entry => entry.workId)).toEqual(before);
  });

  it("never revives a withheld source projection", () => {
    const result = rankHoidCuratedPathRecommendationsForReader(
      Object.freeze({ status: "withheld", reason: "plan-revalidation-failed" }),
      preferences({ priorityWorkIds: ["tfe"] }),
    );
    expect(result).toEqual({ status: "withheld", reason: "source-withheld" });
  });

  it("rejects a display item without the signed-catalogue authority marker", () => {
    const unsafe = Object.freeze({
      ...item("path-a.step-1", "tfe"),
      rationaleAuthority: "model-generated",
    });
    const result = rankHoidCuratedPathRecommendationsForReader(
      Object.freeze({ status: "ready", items: Object.freeze([unsafe]) }),
    );
    expect(result).toEqual({ status: "withheld", reason: "invalid-projection" });
  });

  it("changes the preference fingerprint when priority or revision changes", () => {
    const first = validateHoidReaderRecommendationPreferences(preferences({
      revision: 1,
      priorityWorkIds: ["tfe", "elantris"],
    }));
    const second = validateHoidReaderRecommendationPreferences(preferences({
      revision: 2,
      priorityWorkIds: ["elantris", "tfe"],
    }));
    expect(first.status).toBe("valid");
    expect(second.status).toBe("valid");
    if (first.status === "valid" && second.status === "valid") {
      expect(first.fingerprint).not.toBe(second.fingerprint);
    }
  });
});
