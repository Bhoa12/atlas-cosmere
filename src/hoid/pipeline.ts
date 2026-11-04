import { HoidAnswer, HoidAnswerRequest, HoidProvider } from "./types";
import { HoidKnowledgeCatalog, HoidKnowledgeEntry } from "./catalog";
import { retrieveAuthorized } from "./retrieval";
import { guardQuestion, redactProviderAnswer } from "./spoilerGuard";

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

    const catalog = new HoidKnowledgeCatalog(this.knowledge);
    const locked = catalog.lockedMatches(request.question, request.reading);
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

    const context = retrieveAuthorized(this.knowledge, request.reading, request.question);

    try {
      const provider = this.provider as Partial<ContextualHoidProvider>;
      const text = typeof provider.answerWithContext === "function"
        ? await provider.answerWithContext(request, context)
        : await this.provider.answer(request);
      return redactProviderAnswer(text, request);
    } catch {
      return {
        blocked: false,
        reason: "provider-unavailable",
        text: "La fuente de conocimiento no está disponible. Hoid no inventará una respuesta.",
      };
    }
  }
}
