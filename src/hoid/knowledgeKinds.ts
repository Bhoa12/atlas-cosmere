/**
 * Canonical closed set of Hoid knowledge entity kinds.
 *
 * Every catalogue, editorial, graph, relationship and conversation boundary
 * must use this tuple/guard instead of maintaining a local allow-list.
 * Adding a kind is an explicit schema change and must be covered by the
 * cross-boundary contract workflow.
 */
export const HOID_KNOWLEDGE_KINDS = Object.freeze([
  "character",
  "place",
  "event",
  "phenomenon",
  "concept",
  "magic",
  "organization",
  "object",
] as const);

export type HoidKnowledgeKind = typeof HOID_KNOWLEDGE_KINDS[number];

const KNOWLEDGE_KIND_SET: ReadonlySet<string> = new Set(HOID_KNOWLEDGE_KINDS);

export function isHoidKnowledgeKind(value: unknown): value is HoidKnowledgeKind {
  return typeof value === "string" && KNOWLEDGE_KIND_SET.has(value);
}
