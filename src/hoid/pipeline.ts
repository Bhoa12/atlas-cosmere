import { HoidAnswer, HoidAnswerRequest, HoidProvider } from "./types";
import { HoidKnowledgeCatalog, HoidKnowledgeEntry } from "./catalog";
import { retrieveAuthorized } from "./retrieval";
import { validatedKnowledge } from "./catalogValidation";
import { guardQuestion, redactProviderAnswer } from "./spoilerGuard";
import { validProviderText } from "./providerOutput";
import { authorizeReading, catalogBookIds } from "./authorizationBoundary";

/**
 * Optional provider capability. Providers that understand authorized context can
 * implement this contract without coupling the UI to any SDK.
 */
export interface ContextualHoidProvider extends HoidProvider {
  answerWithContext(
    request: HoidAnswerRequest,
    context: HoidKnowledgeEntry[],
  ): Promise<string>;
}

/**
 * End-to-end boundary for Hoid IA:
 * question -> pre-guard -> catalog authorization -> authorized retrieval
 * -> provider -> output guard.
 *
 * The provider never receives knowledge that failed the reading-position check.
 * If a question explicitly matches locked catalog knowledge, the request fails
 * closed instead of answering a mixture of safe and unsafe topics.
 */
export class HoidPipeline {
  constructor(
    private readonly provider: HoidProvider | null | undefined,
    private readonly knowledge: HoidKnowledgeEntry[],
  ) {}

  async answer(request: HoidAnswerRequest): Promise<HoidAnswer> {
    const blocked = guardQuestion(request);
    if (blocked) return blocked;

    const knowledge = validatedKnowledge(this.knowledge);
    const catalog = new HoidKnowledgeCatalog(knowledge);
    const reading = authorizeReading(request.reading, catalogBookIds(knowledge));
    const authorizedRequest = { ...request, reading };
    const locked = catalog.lockedMatches(request.question, reading);
    if (locked.length > 0) {
      return {
        blocked: true,
        reason: "reading-position",
        text: "Esa pregunta incluye información que todavía no has desbloqueado. Hoid prefiere guardar ese misterio hasta que llegues a la parte correspondiente.",
      };
    }

    if (!this.provider) {
      return {
        blocked: false,
        reason: "provider-unavailable",
        text: "No hay una fuente de IA configurada. Atlas no enviará esta pregunta a ningún servicio externo.",
      };
    }

    const context = retrieveAuthorized(knowledge, reading, request.question);

    // A contextual provider must receive the same request semantics as a plain
    // provider, but only after the catalog and reading-position boundaries have
    // reduced the knowledge set to authorized entries.

    try {
      const provider = this.provider as Partial<ContextualHoidProvider>;
      const text = typeof provider.answerWithContext === "function"
        ? await provider.answerWithContext(authorizedRequest, context)
        : await this.provider.answer(authorizedRequest);
      const safeText = validProviderText(text);
      if (safeText === null) {
        return {
          blocked: false,
          reason: "provider-unavailable",
          text: "La fuente de conocimiento devolvió una respuesta inválida. Hoid no inventará una respuesta.",
        };
      }
      const providerAnswer = redactProviderAnswer(safeText, authorizedRequest);
      if (providerAnswer.blocked) return providerAnswer;

      // Do not trust a provider merely because the input context was safe.
      // A provider can introduce a locked catalog alias on its own, so the
      // generated output crosses the same catalog authorization boundary.
      const leaked = catalog.lockedMatches(safeText, reading);
      if (leaked.length > 0) {
        return {
          blocked: true,
          reason: "provider-output",
          text: "He empezado a revelar información que todavía no has desbloqueado. Mejor dejemos ese misterio sellado por ahora.",
        };
      }
      return providerAnswer;
    } catch {
      return {
        blocked: false,
        reason: "provider-unavailable",
        text: "La fuente de conocimiento no está disponible. Hoid no inventará una respuesta.",
      };
    }
  }
}
