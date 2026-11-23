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
import {
  authorizeHoidCatalogAliasMentions,
  sameHoidAliasProgressWitness,
  type HoidAliasDisclosureDecision,
  type HoidAliasDisclosurePort,
} from "./aliasDisclosureBoundary";

type CanonicalHoidPipelineInput = Readonly<{
  question: unknown;
  reading: unknown;
}>;

/**
 * Read only the two fields Hoid accepts at this boundary.
 *
 * Deliberately do not spread, enumerate or serialize the caller's object:
 * runtime-only reader state may contain local EPUB blocks, XHTML, file URIs
 * or opaque package handles. Ignored fields must not be evaluated merely
 * because they happen to be attached to the request.
 */
function canonicalPipelineInput(value: unknown): CanonicalHoidPipelineInput | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const question = Object.getOwnPropertyDescriptor(value, "question");
    const reading = Object.getOwnPropertyDescriptor(value, "reading");
    if (
      !question ||
      !Object.prototype.hasOwnProperty.call(question, "value") ||
      question.enumerable !== true ||
      !reading ||
      !Object.prototype.hasOwnProperty.call(reading, "value") ||
      reading.enumerable !== true
    ) return null;

    return Object.freeze({
      question: question.value,
      reading: reading.value,
    });
  } catch {
    return null;
  }
}

export type ProviderKnowledgeContextEntry = Readonly<{
  id: string;
  kind: HoidKnowledgeEntry["kind"];
  firstSafeAppearance: Readonly<{ bookId: string; chapter: number }>;
  summary: string;
}>;

export interface ContextualHoidProvider extends HoidProvider {
  answerWithContext(request: HoidAnswerRequest, context: readonly ProviderKnowledgeContextEntry[]): Promise<string>;
}

export type EvidenceBoundClaim = { text: string; evidenceIds: readonly string[] };

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
  let totalLength = 0;
  const parts: string[] = [];
  for (const claim of accepted) {
    const separatorLength = parts.length === 0 ? 0 : 2;
    if (totalLength + separatorLength + claim.text.length > DEFAULT_MAX_PROVIDER_TEXT_LENGTH) return null;
    parts.push(claim.text);
    totalLength += separatorLength + claim.text.length;
  }
  return validProviderText(parts.join("\n\n"), DEFAULT_MAX_PROVIDER_TEXT_LENGTH);
}

function blocked(reason: "reading-position" | "provider-output", text: string): HoidAnswer {
  return { blocked: true, reason, text };
}

function sameAliasDecision(initial: HoidAliasDisclosureDecision, final: HoidAliasDisclosureDecision): boolean {
  return initial.status === "allowed" && final.status === "allowed" &&
    sameHoidAliasProgressWitness(initial.progressWitness, final.progressWitness);
}

export class HoidPipeline {
  private readonly knowledge: HoidKnowledgeEntry[];

  constructor(
    private readonly provider: HoidProvider | EvidenceBoundHoidProvider | null | undefined,
    knowledge: HoidKnowledgeEntry[],
    private readonly providerTimeoutMs = 15_000,
    private readonly aliasDisclosurePort?: HoidAliasDisclosurePort,
  ) {
    this.knowledge = validatedKnowledge(knowledge).map(entry => Object.freeze({
      ...entry,
      aliases: Object.freeze([...entry.aliases]),
      firstSafeAppearance: Object.freeze({ ...entry.firstSafeAppearance }),
    })) as unknown as HoidKnowledgeEntry[];
  }

  private aliasDisclosureDecision(
    text: string,
    reading: HoidAnswerRequest["reading"],
    catalog: HoidKnowledgeCatalog,
  ): Promise<HoidAliasDisclosureDecision> {
    return authorizeHoidCatalogAliasMentions(text, reading, catalog, this.aliasDisclosurePort);
  }

  async answer(request: HoidAnswerRequest): Promise<HoidAnswer> {
    const input = canonicalPipelineInput(request);
    if (!input) {
      return { blocked: true, reason: "input-invalid", text: "La solicitud contiene datos de entrada no válidos. Hoid prefiere no interpretarlos ni enviarlos a ninguna fuente externa." };
    }

    const question = validHoidQuestion(input.question);
    const readingInput = validReadingPositions(input.reading);
    if (question === null || readingInput === null) {
      return { blocked: true, reason: "input-invalid", text: "La solicitud contiene datos de entrada no válidos. Hoid prefiere no interpretarlos ni enviarlos a ninguna fuente externa." };
    }

    // Build a fresh allow-listed request. No caller-owned property other than
    // the validated question and detached reading snapshot crosses this point.
    const normalizedRequest: HoidAnswerRequest = Object.freeze({
      question,
      reading: Object.freeze(readingInput.map(position => Object.freeze({ ...position }))),
    });
    const blockedQuestion = guardQuestion(normalizedRequest);
    if (blockedQuestion) return blockedQuestion;
    const knowledge = this.knowledge;
    const catalog = new HoidKnowledgeCatalog(knowledge);
    const reading = authorizeReading(normalizedRequest.reading, catalogBookIds(knowledge));
    const authorizedRequest = { question, reading };
    if (catalog.lockedMatches(question, reading).length > 0) {
      return blocked("reading-position", "Esa pregunta incluye información que todavía no has desbloqueado. Hoid prefiere guardar ese misterio hasta que llegues a la parte correspondiente.");
    }

    const questionAliasDecision = await this.aliasDisclosureDecision(question, reading, catalog);
    if (questionAliasDecision.status !== "allowed") {
      return blocked("reading-position", "La pregunta contiene un nombre cuya divulgación no está autorizada para tu progreso actual.");
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
          return blocked("provider-output", "No puedo verificar que esa respuesta esté respaldada únicamente por conocimiento que ya hayas desbloqueado.");
        }
        const outputAliasDecision = await this.aliasDisclosureDecision(text, reading, catalog);
        if (!sameAliasDecision(questionAliasDecision, outputAliasDecision)) {
          return blocked("provider-output", "La respuesta contiene un nombre o una autorización de progreso que no coincide con la revisión utilizada al iniciar la consulta.");
        }
        return redactProviderAnswer(text, authorizedRequest);
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
        return blocked("provider-output", "He empezado a revelar información que todavía no has desbloqueado. Mejor dejemos ese misterio sellado por ahora.");
      }
      const outputAliasDecision = await this.aliasDisclosureDecision(safeText, reading, catalog);
      if (!sameAliasDecision(questionAliasDecision, outputAliasDecision)) {
        return blocked("provider-output", "La respuesta contiene un nombre o una autorización de progreso que no coincide con la revisión utilizada al iniciar la consulta.");
      }
      return providerAnswer;
    } catch {
      return { blocked: false, reason: "provider-unavailable", text: "La fuente de conocimiento no está disponible. Hoid no inventará una respuesta." };
    }
  }
}
