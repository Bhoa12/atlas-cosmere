/**
 * An alias is a disclosure fact in its own right. Its evidence can be later
 * than the entity's first appearance and can require several works.
 */
export type HoidEntityAliasEvidence = Readonly<{
  id: string;
  source: Readonly<{ bookId: string; chapter: number; locatorId: string }>;
  unlock: Readonly<{ bookId: string; chapter: number }>;
}>;

export type HoidEntityAliasRecord = Readonly<{
  id: string;
  entityId: string;
  alias: string;
  /** Every item is mandatory (AND semantics) before this alias can be resolved. */
  evidence: readonly HoidEntityAliasEvidence[];
  review: Readonly<{
    status: "approved";
    origin: "original-editorial";
    reviewerId: string;
    reviewedAt: string;
  }>;
}>;

/**
 * Production alias registry. Keep empty until each spelling/identity is
 * independently checked against inspected source documents and spoiler-scoped.
 * Do not infer alias safety from first appearance or the entity summary.
 */
export const HOID_ENTITY_ALIAS_EVIDENCE: readonly HoidEntityAliasRecord[] = Object.freeze([]);
