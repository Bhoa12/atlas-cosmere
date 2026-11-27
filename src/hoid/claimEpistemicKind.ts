import type { HoidEditorialClaimAssertionKind } from "./editorialClaimDrafts";
import type { HoidExactApprovedClaimIntent } from "./exactUnitClaimIntegrity";

export type HoidClaimEpistemicKind =
  | "evidence-backed-assertion"
  | "editorial-interpretation"
  | "reader-recommendation"
  | "unclassified";

const INTENTS = new Set<HoidExactApprovedClaimIntent>(["explain", "context", "recommend"]);
const ASSERTION_KINDS = new Set<HoidEditorialClaimAssertionKind>([
  "identity",
  "appearance",
  "ability",
  "limitation",
  "relationship",
  "event",
  "location",
  "interpretation",
]);

/**
 * Classifies only metadata already bound to an approved editorial claim.
 * Missing assertionKind is deliberately not treated as a factual assertion.
 */
export function classifyHoidClaimEpistemicKind(
  intentInput: unknown,
  assertionKindInput: unknown,
): HoidClaimEpistemicKind | null {
  if (intentInput !== undefined && (
    typeof intentInput !== "string" ||
    !INTENTS.has(intentInput as HoidExactApprovedClaimIntent)
  )) return null;

  if (assertionKindInput !== undefined && (
    typeof assertionKindInput !== "string" ||
    !ASSERTION_KINDS.has(assertionKindInput as HoidEditorialClaimAssertionKind)
  )) return null;

  if (intentInput === "recommend") return "reader-recommendation";
  if (assertionKindInput === "interpretation") return "editorial-interpretation";
  if (assertionKindInput !== undefined) return "evidence-backed-assertion";
  return "unclassified";
}

export function labelHoidClaimEpistemicKind(kind: HoidClaimEpistemicKind): string {
  switch (kind) {
    case "evidence-backed-assertion":
      return "AFIRMACIÓN EDITORIAL CON EVIDENCIAS";
    case "editorial-interpretation":
      return "INTERPRETACIÓN EDITORIAL";
    case "reader-recommendation":
      return "RECOMENDACIÓN PARA EL LECTOR";
    case "unclassified":
      return "TIPO DE AFIRMACIÓN SIN CLASIFICAR";
  }
}
