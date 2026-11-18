import { answerWithinTimeout } from "./providerTimeout";

/**
 * Optional language-provider boundary. It selects presentation only and
 * receives no question, entity names, claims, evidence IDs or source data.
 */
export const HOID_NARRATIVE_LAYOUTS = Object.freeze([
  "plain",
  "numbered",
  "grouped",
] as const);

export type HoidNarrativeLayout = (typeof HOID_NARRATIVE_LAYOUTS)[number];

export type HoidNarrativeLayoutRequest = Readonly<{
  schemaVersion: 1;
  locale: "es";
  claimCount: number;
  entityCount: number;
  allowedLayouts: readonly HoidNarrativeLayout[];
}>;

export interface HoidNarrativeLayoutPort {
  chooseLayout(request: HoidNarrativeLayoutRequest): Promise<unknown>;
}

export type HoidNarrativeSegment = Readonly<{
  claimId: string;
  text: string;
  evidenceIds: readonly string[];
}>;

export type HoidNarrativeSection = Readonly<{
  id: string;
  title: string;
  claimIds: readonly string[];
  text: string;
}>;

export type HoidNarrativeComposition =
  | Readonly<{
      status: "ready";
      layout: HoidNarrativeLayout;
      text: string;
      claimIds: readonly string[];
      evidenceIds: readonly string[];
      segments: readonly HoidNarrativeSegment[];
      sections: readonly HoidNarrativeSection[];
    }>
  | Readonly<{
      status: "unavailable";
      reason: "invalid-input" | "invalid-layout" | "budget-exceeded";
    }>;

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const INVALID_TEXT_CONTROLS = /[\u0000-\u0008\u000B-\u001F\u007F\u00AD\u034F\u061C\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u;
const MAX_SEGMENTS = 12;
const MAX_EVIDENCE_PER_SEGMENT = 16;
const MAX_TEXT_PER_SEGMENT = 4_000;
const MAX_TOTAL_TEXT = 32_000;
const GROUP_SIZE = 3;
const DEFAULT_LAYOUT_TIMEOUT_MS = 1_200;

function isLayout(value: unknown): value is HoidNarrativeLayout {
  return typeof value === "string" &&
    (HOID_NARRATIVE_LAYOUTS as readonly string[]).includes(value);
}

function canonicalRecord(
  value: unknown,
  allowedKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string" || !allowedKeys.includes(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    if (Object.keys(result).length !== allowedKeys.length) return null;
    return result;
  } catch {
    return null;
  }
}

function canonicalDenseArray(value: unknown, minimum: number, maximum: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length < minimum || value.length > maximum) return null;
    if (Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;

    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result.push(descriptor.value);
    }
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length) {
        return null;
      }
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function canonicalSegments(value: unknown): readonly HoidNarrativeSegment[] | null {
  const rawSegments = canonicalDenseArray(value, 1, MAX_SEGMENTS);
  if (!rawSegments) return null;

  const claimIds = new Set<string>();
  const normalized: HoidNarrativeSegment[] = [];
  let totalTextLength = 0;

  for (const raw of rawSegments) {
    const segment = canonicalRecord(raw, ["claimId", "text", "evidenceIds"]);
    if (!segment) return null;

    const claimId = segment.claimId;
    const text = segment.text;
    if (
      typeof claimId !== "string" ||
      claimId.length > 128 ||
      !ID_PATTERN.test(claimId) ||
      claimIds.has(claimId) ||
      typeof text !== "string" ||
      text.length < 1 ||
      text.length > MAX_TEXT_PER_SEGMENT ||
      text !== text.trim() ||
      INVALID_TEXT_CONTROLS.test(text)
    ) return null;

    const rawEvidenceIds = canonicalDenseArray(segment.evidenceIds, 1, MAX_EVIDENCE_PER_SEGMENT);
    if (!rawEvidenceIds) return null;
    const evidenceIds: string[] = [];
    const evidenceSeen = new Set<string>();
    for (const rawEvidenceId of rawEvidenceIds) {
      if (
        typeof rawEvidenceId !== "string" ||
        rawEvidenceId.length > 128 ||
        !ID_PATTERN.test(rawEvidenceId) ||
        evidenceSeen.has(rawEvidenceId)
      ) return null;
      evidenceSeen.add(rawEvidenceId);
      evidenceIds.push(rawEvidenceId);
    }

    totalTextLength += text.length;
    if (totalTextLength > MAX_TOTAL_TEXT) return null;
    claimIds.add(claimId);
    normalized.push(Object.freeze({
      claimId,
      text,
      evidenceIds: Object.freeze(evidenceIds),
    }));
  }

  return Object.freeze(normalized);
}

/** Deterministic local layout; no claim wording is rewritten. */
export function defaultHoidNarrativeLayout(claimCount: number): HoidNarrativeLayout {
  if (!Number.isSafeInteger(claimCount) || claimCount < 1) return "plain";
  if (claimCount === 1) return "plain";
  if (claimCount <= 3) return "numbered";
  return "grouped";
}

/**
 * Ask an optional provider-neutral port for one value from a closed enum.
 * Invalid output, rejection, timeout or missing configuration falls back to
 * the deterministic local layout. The port cannot author or reorder claims.
 */
export async function selectHoidNarrativeLayout(
  port: HoidNarrativeLayoutPort | null | undefined,
  claimCount: number,
  entityCount: number,
  timeoutMs = DEFAULT_LAYOUT_TIMEOUT_MS,
): Promise<HoidNarrativeLayout> {
  const fallback = defaultHoidNarrativeLayout(claimCount);
  if (
    !port ||
    !Number.isSafeInteger(claimCount) ||
    claimCount < 1 ||
    claimCount > MAX_SEGMENTS ||
    !Number.isSafeInteger(entityCount) ||
    entityCount < 2 ||
    entityCount > 4
  ) return fallback;

  const request: HoidNarrativeLayoutRequest = Object.freeze({
    schemaVersion: 1,
    locale: "es",
    claimCount,
    entityCount,
    allowedLayouts: HOID_NARRATIVE_LAYOUTS,
  });

  try {
    const operation = Promise.resolve().then(() => port.chooseLayout(request));
    const proposal = await answerWithinTimeout(operation, timeoutMs);
    return isLayout(proposal) ? proposal : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Compose already-validated editorial segments. Generated material is limited
 * to neutral numbering or block labels; claim wording and evidence mappings
 * remain unchanged.
 */
export function composeHoidNarrative(
  input: unknown,
  layoutInput: unknown,
): HoidNarrativeComposition {
  const record = canonicalRecord(input, ["segments"]);
  if (!record) return Object.freeze({ status: "unavailable", reason: "invalid-input" });
  const segments = canonicalSegments(record.segments);
  if (!segments) return Object.freeze({ status: "unavailable", reason: "invalid-input" });
  if (!isLayout(layoutInput)) return Object.freeze({ status: "unavailable", reason: "invalid-layout" });

  const claimIds = Object.freeze(segments.map(segment => segment.claimId));
  const evidenceIds = Object.freeze(
    [...new Set(segments.flatMap(segment => [...segment.evidenceIds]))].sort(),
  );
  let sections: HoidNarrativeSection[];

  if (layoutInput === "plain") {
    sections = [{
      id: "section-1",
      title: "Explicación documentada",
      claimIds,
      text: segments.map(segment => segment.text).join("\n\n"),
    }];
  } else if (layoutInput === "numbered") {
    sections = [{
      id: "section-1",
      title: "Puntos verificados",
      claimIds,
      text: segments.map((segment, index) => String(index + 1) + ". " + segment.text).join("\n\n"),
    }];
  } else {
    sections = [];
    for (let start = 0; start < segments.length; start += GROUP_SIZE) {
      const group = segments.slice(start, start + GROUP_SIZE);
      const blockNumber = sections.length + 1;
      sections.push({
        id: "section-" + String(blockNumber),
        title: "Bloque " + String(blockNumber),
        claimIds: Object.freeze(group.map(segment => segment.claimId)),
        text: group.map(segment => "• " + segment.text).join("\n\n"),
      });
    }
  }

  const frozenSections = Object.freeze(sections.map(section => Object.freeze({
    ...section,
    claimIds: Object.freeze([...section.claimIds]),
  })));
  const text = layoutInput === "grouped"
    ? frozenSections.map(section => section.title + "\n" + section.text).join("\n\n")
    : frozenSections[0].text;

  if (text.length < 1 || text.length > MAX_TOTAL_TEXT) {
    return Object.freeze({ status: "unavailable", reason: "budget-exceeded" });
  }

  return Object.freeze({
    status: "ready",
    layout: layoutInput,
    text,
    claimIds,
    evidenceIds,
    segments,
    sections: frozenSections,
  });
}
