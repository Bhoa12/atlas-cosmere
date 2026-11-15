/**
 * Provider boundary for Hoid IA.
 *
 * Providers receive only already-authorized summaries. They never receive a
 * reader's broader library and cannot expand the narrative scope themselves.
 */
export type HoidMode = "explain" | "recommend";

export interface AuthorizedContext {
  readonly bookId: string;
  readonly maxChapter: number;
  readonly evidence: readonly {
    readonly id: string;
    readonly chapter: number;
    readonly summary: string;
  }[];
}

export interface ProviderRequest {
  readonly question: string;
  readonly mode: HoidMode;
  readonly context: AuthorizedContext;
}

export interface ProviderClaim {
  readonly text: string;
  readonly evidenceIds: readonly string[];
}

export interface ProviderResponse {
  readonly claims: readonly ProviderClaim[];
}

export interface HoidProvider {
  generate(request: ProviderRequest): Promise<ProviderResponse>;
}

/**
 * Validates provider output against the exact evidence set supplied to it.
 * The result is fail-closed: one unsupported claim invalidates the response.
 */
export function validateProviderResponse(
  response: ProviderResponse,
  context: AuthorizedContext,
): { ok: true } | { ok: false; reason: string } {
  if (!Array.isArray(response.claims) || response.claims.length === 0) {
    return { ok: false, reason: "El proveedor no devolvió afirmaciones verificables." };
  }

  const allowed = new Set(
    context.evidence
      .filter((item) =>
        item.chapter > 0 &&
        item.chapter <= context.maxChapter &&
        item.id.trim().length > 0 &&
        item.summary.trim().length > 0,
      )
      .map((item) => item.id),
  );

  if (allowed.size === 0) {
    return { ok: false, reason: "No existe evidencia autorizada para esta respuesta." };
  }

  for (const claim of response.claims) {
    if (!claim.text || claim.text.trim().length === 0) {
      return { ok: false, reason: "El proveedor devolvió una afirmación vacía." };
    }
    if (!Array.isArray(claim.evidenceIds) || claim.evidenceIds.length === 0) {
      return { ok: false, reason: "Una afirmación carece de evidencia declarada." };
    }
    if (claim.evidenceIds.some((id) => !allowed.has(id))) {
      return { ok: false, reason: "Una afirmación referencia evidencia no autorizada." };
    }
  }

  return { ok: true };
}
