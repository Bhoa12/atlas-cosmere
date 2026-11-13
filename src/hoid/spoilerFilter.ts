import type { HoidClaim } from "./providerContract";

export type SpoilerFilterResult =
  | { status: "authorized"; claims: readonly HoidClaim[] }
  | { status: "limited"; claims: readonly HoidClaim[] }
  | { status: "blocked"; claims: readonly HoidClaim[] };

/**
 * Final fail-closed filter. The caller supplies the already verified claims;
 * this function never promotes rejected claims back into visibility.
 */
export function filterVisibleClaims(
  accepted: readonly HoidClaim[],
  rejectedCount: number,
): SpoilerFilterResult {
  if (accepted.length === 0) {
    return { status: "blocked", claims: [] };
  }

  if (rejectedCount > 0) {
    return { status: "limited", claims: [...accepted] };
  }

  return { status: "authorized", claims: [...accepted] };
}
