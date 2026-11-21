import { validProviderText } from './providerOutput';
import { validHoidQuestion } from './requestValidation';
import { HoidKnowledgeCatalog } from './catalog';
import { authorizeHoidContext } from './contextPolicy';
import {
  authorizeHoidCatalogAliasMentions,
  type HoidAliasDisclosurePort,
} from "./aliasDisclosureBoundary";
import { buildAuthorizedKnowledgeContext } from './authorizedKnowledgeContext';
import { snapshotProviderRequest } from './providerRequestSnapshot';
import { answerWithinTimeout } from './providerTimeout';
import { guardQuestion, redactProviderAnswer } from './spoilerGuard';
import { HoidAnswer, HoidAnswerRequest, HoidProvider } from './types';
import { validEditionBoundReadingPositions } from './editionProgressValidation';

export const DEFAULT_PROVIDER_TIMEOUT_MS = 10_000;

export class HoidService {
  constructor(
    private readonly provider?: HoidProvider,
    private readonly providerTimeoutMs = DEFAULT_PROVIDER_TIMEOUT_MS,
    private readonly catalog?: HoidKnowledgeCatalog,
    private readonly aliasDisclosurePort?: HoidAliasDisclosurePort,
  ) {}

  async answer(request: HoidAnswerRequest): Promise<HoidAnswer> {
    if (request === null || typeof request !== 'object' || Array.isArray(request)) {
      return {
        blocked: true,
        reason: 'input-invalid',
        text: 'La solicitud contiene datos de entrada no válidos. Hoid no los interpretará ni los enviará a ninguna fuente externa.'
      };
    }

    const question = validHoidQuestion(request.question);
    const reading = validEditionBoundReadingPositions(request.reading);
    if (question === null || reading === null) {
      return {
        blocked: true,
        reason: 'input-invalid',
        text: 'La pregunta o el progreso de lectura no pueden procesarse de forma segura. Hoid no enviará datos ambiguos a ninguna fuente externa.'
      };
    }

    const normalizedRequest: HoidAnswerRequest = { ...request, question, reading };
    const blocked = guardQuestion(normalizedRequest);
    if (blocked) return blocked;

    // Freeze the reader state once at service entry. Every authorization step
    // in this request must evaluate the same progress snapshot.
    const progressSnapshot = snapshotProviderRequest(normalizedRequest);

    // Catalog first appearance and per-alias disclosure are separate gates.
    // A name can be safe to mention while a later spelling for the same entity
    // remains locked. No provider is called until both gates authorize it.
    if (this.catalog) {
      const contextDecision = authorizeHoidContext(
        progressSnapshot,
        this.catalog,
        this.aliasDisclosurePort,
      );
      if (!contextDecision.allowed) {
        return {
          blocked: true,
          reason: 'reading-position',
          text: 'Esa pregunta podría revelar información que todavía no has alcanzado. Cuando avances en la lectura, Hoid podrá explicarla con seguridad.'
        };
      }
    }

    if (!this.provider) {
      return {
        blocked: false,
        reason: 'provider-unavailable',
        text: 'No hay una fuente de IA configurada para responder con seguridad. Atlas no enviará esta pregunta a ningún servicio externo hasta que exista una integración verificada.'
      };
    }

    try {
      const providerRequest = snapshotProviderRequest({
        ...progressSnapshot,
        ...(this.catalog
          ? { knowledgeContext: buildAuthorizedKnowledgeContext(this.catalog, progressSnapshot.reading) }
          : {}),
      }, { includeAuthorizedKnowledgeContext: true });
      const rawAnswer: unknown = await answerWithinTimeout(
        this.provider.answer(providerRequest),
        this.providerTimeoutMs,
      );

      if (rawAnswer === null) {
        return {
          blocked: false,
          reason: 'provider-unavailable',
          text: 'La fuente de conocimiento no está disponible en este momento. No inventaré una respuesta ni expondré tu pregunta a otro servicio.'
        };
      }

      const answer = validProviderText(rawAnswer);
      if (answer === null) {
        return {
          blocked: true,
          reason: 'provider-output',
          text: 'La respuesta recibida no puede validarse de forma segura. No mostraré contenido incompleto o inesperado.'
        };
      }

      if (this.catalog) {
        if (this.catalog.lockedMatches(answer, progressSnapshot.reading).length > 0) {
          return {
            blocked: true,
            reason: 'provider-output',
            text: 'La respuesta podría revelar información que todavía no has alcanzado. Prefiero mantener ese misterio sellado hasta que avances en la lectura.'
          };
        }

        const aliasDecision = authorizeHoidCatalogAliasMentions(
          answer,
          progressSnapshot.reading,
          this.catalog,
          this.aliasDisclosurePort,
        );
        if (aliasDecision.status !== "allowed") {
          return {
            blocked: true,
            reason: 'provider-output',
            text: 'La respuesta contiene un nombre cuya divulgación no está autorizada para tu progreso actual.'
          };
        }
      }

      return redactProviderAnswer(answer, progressSnapshot);
    } catch {
      return {
        blocked: false,
        reason: 'provider-unavailable',
        text: 'La fuente de conocimiento no está disponible en este momento. No inventaré una respuesta ni expondré tu pregunta a otro servicio.'
      };
    }
  }
}
