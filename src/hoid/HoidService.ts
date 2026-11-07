import { validProviderText } from './providerOutput';
import { HoidKnowledgeCatalog } from './catalog';
import { authorizeHoidContext } from './contextPolicy';
import { snapshotProviderRequest } from './providerRequestSnapshot';
import { answerWithinTimeout } from './providerTimeout';
import { guardQuestion, redactProviderAnswer } from './spoilerGuard';
import { HoidAnswer, HoidAnswerRequest, HoidProvider } from './types';

/**
 * Conservative default for a remote provider call. Integrations may override it
 * when constructing the service, but invalid values fail closed at the timeout
 * boundary instead of disabling the deadline.
 */
export const DEFAULT_PROVIDER_TIMEOUT_MS = 10_000;

export class HoidService {
  constructor(
    private readonly provider?: HoidProvider,
    private readonly providerTimeoutMs = DEFAULT_PROVIDER_TIMEOUT_MS,
    private readonly catalog?: HoidKnowledgeCatalog,
  ) {}

  async answer(request: HoidAnswerRequest): Promise<HoidAnswer> {
    const blocked = guardQuestion(request);
    if (blocked) return blocked;

    // Freeze the reader state once at service entry. Every authorization step
    // in this request must evaluate the same progress snapshot; mutable UI
    // state must not change what an in-flight provider response is allowed to reveal.
    const authorizedRequest = snapshotProviderRequest(request);

    // Catalog authorization is a second, broader trust boundary. The explicit
    // spoiler guard protects known high-risk terms; the catalog prevents any
    // editorially verified locked entity from reaching an external provider.
    // Missing catalog metadata never invents a block, preserving backwards
    // compatibility while deployments that configure the catalog fail closed.
    if (this.catalog) {
      const contextDecision = authorizeHoidContext(authorizedRequest, this.catalog);
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
      // Cross the provider boundary with a detached immutable snapshot. A
      // provider may continue running after a timeout, so it must never retain
      // references to mutable reader progress owned by the application.
      const providerRequest = authorizedRequest;
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

      // The catalog is also enforced on provider output. A provider can mention
      // a locked entity even when the reader did not ask about it, so output
      // must never bypass the same book/chapter authorization boundary.
      if (this.catalog && this.catalog.lockedMatches(answer, authorizedRequest.reading).length > 0) {
        return {
          blocked: true,
          reason: 'provider-output',
          text: 'La respuesta podría revelar información que todavía no has alcanzado. Prefiero mantener ese misterio sellado hasta que avances en la lectura.'
        };
      }

      return redactProviderAnswer(answer, authorizedRequest);
    } catch {
      return {
        blocked: false,
        reason: 'provider-unavailable',
        text: 'La fuente de conocimiento no está disponible en este momento. No inventaré una respuesta ni expondré tu pregunta a otro servicio.'
      };
    }
  }
}
