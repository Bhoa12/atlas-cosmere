/**
 * Final response decision for Hoid IA.
 *
 * Provider prose is not trusted merely because individual claims were checked.
 * If any narrative claim is rejected, the complete provider answer is withheld
 * and the caller must use a neutral abstention. This prevents unsupported prose
 * from surviving after evidence validation.
 */
import { type KnowledgeBoundary } from "./knowledgeBoundary";
import {
  type HoidProvider,
  type HoidPrompt,
  createProviderRequest,
  verifyProviderResponse,
} from "./providerContract";

export type ResponseDecision =
  | Readonly<{ kind: "answer"; text: string }>
  | Readonly<{ kind: "abstain"; reason: "empty_answer" | "unverified_claim" }>;

export async function decideProviderResponse(
  provider: HoidProvider,
  boundary: KnowledgeBoundary,
  prompt: HoidPrompt,
): Promise<ResponseDecision> {
  const request = createProviderRequest(boundary, prompt);
  const response = await provider.answer(request);
  const verified = verifyProviderResponse(boundary, response);

  // Fail closed: the answer can depend on a rejected claim even when that
  // claim is not repeated verbatim in the final prose.
  if (verified.rejectedClaims > 0) {
    return Object.freeze({ kind: "abstain", reason: "unverified_claim" });
  }

  if (!verified.answer) {
    return Object.freeze({ kind: "abstain", reason: "empty_answer" });
  }

  return Object.freeze({ kind: "answer", text: verified.answer });
}
