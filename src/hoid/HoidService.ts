import { validProviderText } from './providerOutput';
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
  ) {}

  async answer(request: HoidAnswerRequest): Promise<HoidAnswer> {
    const blocked = guardQuestion(request);
    if (blocked) return blocked;

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
      const providerRequest = snapshotProviderRequest(request);
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

      return redactProviderAnswer(answer, request);
    } catch {
      return {
        blocked: false,
        reason: 'provider-unavailable',
        text: 'La fuente de conocimiento no está disponible en este momento. No inventaré una respuesta ni expondré tu pregunta a otro servicio.'
      };
    }
  }
}
