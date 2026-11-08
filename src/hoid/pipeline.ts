import { HoidAnswer, HoidAnswerRequest, HoidProvider } from "./types";
import { HoidKnowledgeCatalog, HoidKnowledgeEntry } from "./catalog";
import { retrieveAuthorized } from "./retrieval";
import { validatedKnowledge } from "./catalogValidation";
import { guardQuestion, redactProviderAnswer } from "./spoilerGuard";
import { validProviderText } from "./providerOutput";
import { authorizeReading, catalogBookIds } from "./authorizationBoundary";
import { boundAuthorizedContext } from "./contextBudget";
import { answerWithinTimeout } from "./providerTimeout";

export interface ContextualHoidProvider extends HoidProvider {
  answerWithContext(request: HoidAnswerRequest, context: HoidKnowledgeEntry[]): Promise<string>;
}

function providerSnapshots(
  request: HoidAnswerRequest,
  context: HoidKnowledgeEntry[],
): { request: HoidAnswerRequest; context: HoidKnowledgeEntry[] } {
  const reading = request.reading.map(position => Object.freeze({ ...position }));

  // knowledgeContext is an internal authorization result, not caller-controlled
  // provider input. Rebuild the request from the minimal public contract so a
  // caller cannot smuggle arbitrary narrative context across this boundary.
  const providerRequest = Object.freeze({
    question: request.question,
    reading: Object.freeze(reading),
  }) as unknown as HoidAnswerRequest;

  const providerContext = context.map(entry => Object.freeze({
    ...entry,
    aliases: Object.freeze([...entry.aliases]),
    firstSafeAppearance: Object.freeze({ ...entry.firstSafeAppearance }),
  })) as unknown as HoidKnowledgeEntry[];

  return {
    request: providerRequest,
    context: Object.freeze(providerContext) as unknown as HoidKnowledgeEntry[],
  };
}

export class HoidPipeline {
  constructor(
    private readonly provider: HoidProvider | null | undefined,
    private readonly knowledge: HoidKnowledgeEntry[],
    private readonly providerTimeoutMs = 15_000,
  ) {}

  async answer(request: HoidAnswerRequest): Promise<HoidAnswer> {
    const blocked = guardQuestion(request);
    if (blocked) return blocked;

    const knowledge = validatedKnowledge(this.knowledge);
    const catalog = new HoidKnowledgeCatalog(knowledge);
    const reading = authorizeReading(request.reading, catalogBookIds(knowledge));
    const authorizedRequest = { question: request.question, reading };
    const locked = catalog.lockedMatches(request.question, reading);
    if (locked.length > 0) {
      return { blocked: true, reason: "reading-position", text: "Esa pregunta incluye información que todavía no has desbloqueado. Hoid prefiere guardar ese misterio hasta que llegues a la parte correspondiente." };
    }

    if (!this.provider) {
      return { blocked: false, reason: "provider-unavailable", text: "No hay una fuente de IA configurada. Atlas no enviará esta pregunta a ningún servicio externo." };
    }

    const context = boundAuthorizedContext(retrieveAuthorized(knowledge, reading, request.question));
    const snapshot = providerSnapshots(authorizedRequest, context);

    try {
      const provider = this.provider as Partial<ContextualHoidProvider>;
      const operation = typeof provider.answerWithContext === "function"
        ? provider.answerWithContext(snapshot.request, snapshot.context)
        : this.provider.answer(snapshot.request);
      const text = await answerWithinTimeout(operation, this.providerTimeoutMs);
      if (text === null) {
        return { blocked: false, reason: "provider-unavailable", text: "La fuente de conocimiento no está disponible a tiempo. Hoid no inventará una respuesta." };
      }
      const safeText = validProviderText(text);
      if (safeText === null) {
        return { blocked: false, reason: "provider-unavailable", text: "La fuente de conocimiento devolvió una respuesta inválida. Hoid no inventará una respuesta." };
      }
      const providerAnswer = redactProviderAnswer(safeText, authorizedRequest);
      if (providerAnswer.blocked) return providerAnswer;
      const leaked = catalog.lockedMatches(safeText, reading);
      if (leaked.length > 0) {
        return { blocked: true, reason: "provider-output", text: "He empezado a revelar información que todavía no has desbloqueado. Mejor dejemos ese misterio sellado por ahora." };
      }
      return providerAnswer;
    } catch {
      return { blocked: false, reason: "provider-unavailable", text: "La fuente de conocimiento no está disponible. Hoid no inventará una respuesta." };
    }
  }
}
