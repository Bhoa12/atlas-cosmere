import { validProviderText } from './providerOutput';
import { guardQuestion, redactProviderAnswer } from './spoilerGuard';
import { HoidAnswer, HoidAnswerRequest, HoidProvider } from './types';

export class HoidService {
  constructor(private readonly provider?: HoidProvider) {}

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
      // Treat provider output as untrusted runtime data even though the
      // TypeScript contract says it is a string.
      const rawAnswer: unknown = await this.provider.answer(request);
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
