import { HoidAnswer, HoidAnswerRequest, HoidProvider } from "./types";
import { HoidKnowledgeCatalog, HoidKnowledgeEntry } from "./catalog";
import { retrieveAuthorized } from "./retrieval";
import { validatedKnowledge } from "./catalogValidation";
import { guardQuestion, redactProviderAnswer } from "./spoilerGuard";
import { DEFAULT_MAX_PROVIDER_TEXT_LENGTH, validProviderText } from "./providerOutput";
import { filterClaimsByAuthorizedIds } from "./responseFilter";
import { authorizeReading, catalogBookIds } from "./authorizationBoundary";
import { boundAuthorizedContext } from "./contextBudget";
import { answerWithinTimeout } from "./providerTimeout";
import { validHoidQuestion } from "./requestValidation";
import { validReadingPositions } from "./readingValidation";

export type ProviderKnowledgeContextEntry = Readonly<{
  id: string;
  kind: HoidKnowledgeEntry["kind"];
  firstSafeAppearance: Readonly<{ bookId: string; chapter: number }>;
  summary: string;
}>;

export interface ContextualHoidProvider extends HoidProvider {
  answerWithContext(request: HoidAnswerRequest, context: readonly ProviderKnowledgeContextEntry[]): Promise<string>;
}

/**
 * Structured providers opt into claim-level evidence. This contract is
 * intentionally separate from the legacy text provider so a provider cannot
 * claim evidence support merely by returning a string.
 */
export type EvidenceBoundClaim = {
  text: string;
  evidenceIds: readonly string[];
};

export interface EvidenceBoundHoidProvider {
  answerWithEvidence(
    request: HoidAnswerRequest,
    context: readonly ProviderKnowledgeContextEntry[],
  ): Promise<readonly EvidenceBoundClaim[]>;
}

function providerSnapshots(
  request: HoidAnswerRequest,
  context: HoidKnowledgeEntry[],
): { request: HoidAnswerRequest; context: readonly ProviderKnowledgeContextEntry[] } {
  const reading = request.reading.map(position => Object.freeze({ ...position }));
  const providerRequest = Object.freeze({
    question: request.question,
    reading: Object.freeze(reading),
  }) as unknown as HoidAnswerRequest;

  // Retrieval aliases are an internal matching aid. They are not narrative
  // context and must not cross the provider trust boundary.
  const providerContext = context.map(entry => Object.freeze({
    id: entry.id,
    kind: entry.kind,
    summary: entry.summary,
    firstSafeAppearance: Object.freeze({ ...entry.firstSafeAppearance }),
  })) as readonly ProviderKnowledgeContextEntry[];

  return { request: providerRequest, context: Object.freeze(providerContext) };
}

function evidenceText(
  claims: unknown,
  context: readonly ProviderKnowledgeContextEntry[],
): string | null {
  const allowed = new Set(context.map(item => item.id));
  const accepted = filterClaimsByAuthorizedIds(claims, allowed);
  if (accepted.length === 0) return null;

  // Every individual claim is bounded, but an evidence provider can return
  // arbitrarily many individually valid claims. Enforce the legacy route's
  // aggregate output limit before concatenating them.
  let totalLength = 0;
  const parts: string[] = [];
  for (const claim of accepted) {
    const separatorLength = parts.length === 0 ? 0 : 2;
    if (totalLength + separatorLength + claim.text.length > DEFAULT_MAX_PROVIDER_TEXT_LENGTH) {
      return null;
    }
    parts.push(claim.text);
    totalLength += separatorLength + claim.text.length;
  }

  return validProviderText(parts.join("\n\n"), DEFAULT_MAX_PROVIDER_TEXT_LENGTH);
}

export class HoidPipeline {
  private readonly knowledge: HoidKnowledgeEntry[];

  constructor(
    private readonly provider: HoidProvider | EvidenceBoundHoidProvider | null | undefined,
    knowledge: HoidKnowledgeEntry[],
    private readonly providerTimeoutMs = 15_000,
  ) {
    this.knowledge = validatedKnowledge(knowledge).map(entry => Object.freeze({
      ...entry,
      aliases: Object.freeze([...entry.aliases]),
      firstSafeAppearance: Object.freeze({ ...entry.firstSafeAppearance }),
    })) as unknown as HoidKnowledgeEntry[];
  }

  async answer(request: HoidAnswerRequest): Promise<HoidAnswer> {
    if (request === null || typeof request !== "object" || Array.isArray(request)) {
      return { blocked: true, reason: "input-invalid", text: "La solicitud contiene datos de entrada no válidos. Hoid prefiere no interpretarlos ni enviarlos a ninguna fuente externa." };
    }

    const question = validHoidQuestion(request.question);
    const readingInput = validReadingPositions(request.reading);
    if (question === null || readingInput === null) {
      return { blocked: true, reason: "input-invalid", text: "La solicitud contiene datos de entrada no válidos. Hoid prefiere no interpretarlos ni enviarlos a ninguna fuente externa." };
    }

    const normalizedRequest: HoidAnswerRequest = { ...request, question, reading: readingInput };
    const blocked = guardQuestion(normalizedRequest);
    if (blocked) return blocked;

    const knowledge = this.knowledge;
    const catalog = new HoidKnowledgeCatalog(knowledge);
    const reading = authorizeReading(normalizedRequest.reading, catalogBookIds(knowledge));
    const authorizedRequest = { question, reading };
    if (catalog.lockedMatches(question, reading).length > 0) {
      return { blocked: true, reason: "reading-position", text: "Esa pregunta incluye información que todavía no has desbloqueado. Hoid prefiere guardar ese misterio hasta que llegues a la parte correspondiente." };
    }

    if (!this.provider) {
      return { blocked: false, reason: "provider-unavailable", text: "No hay una fuente de IA configurada. Atlas no enviará esta pregunta a ningún servicio externo." };
    }

    const context = boundAuthorizedContext(retrieveAuthorized(knowledge, reading, question));
    const snapshot = providerSnapshots(authorizedRequest, context);

    try {
      const provider = this.provider as Partial<EvidenceBoundHoidProvider & ContextualHoidProvider>;
      if (typeof provider.answerWithEvidence === "function") {
        const claims = await answerWithinTimeout(provider.answerWithEvidence(snapshot.request, snapshot.context), this.providerTimeoutMs);
        if (claims === null || !Array.isArray(claims)) {
          return { blocked: false, reason: "provider-unavailable", text: "La fuente de conocimiento no está disponible a tiempo. Hoid no inventará una respuesta." };
        }
        const text = evidenceText(claims, snapshot.context);
        if (text === null || catalog.lockedMatches(text, reading).length > 0) {
          return { blocked: true, reason: "provider-output", text: "No puedo verificar que esa respuesta esté respaldada únicamente por conocimiento que ya hayas desbloqueado." };
        }
        const providerAnswer = redactProviderAnswer(text, authorizedRequest);
        if (providerAnswer.blocked) return providerAnswer;
        return providerAnswer;
      }

      const legacy = this.provider as HoidProvider;
      const operation = typeof provider.answerWithContext === "function"
        ? provider.answerWithContext(snapshot.request, snapshot.context)
        : legacy.answer(snapshot.request);
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
      if (catalog.lockedMatches(safeText, reading).length > 0) {
        return { blocked: true, reason: "provider-output", text: "He empezado a revelar información que todavía no has desbloqueado. Mejor dejemos ese misterio sellado por ahora." };
      }
      return providerAnswer;
    } catch {
      return { blocked: false, reason: "provider-unavailable", text: "La fuente de conocimiento no está disponible. Hoid no inventará una respuesta." };
    }
  }
}
