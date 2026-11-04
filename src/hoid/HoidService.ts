import { guardQuestion, redactProviderAnswer } from './spoilerGuard';
import { HoidAnswer, HoidAnswerRequest, HoidProvider } from './types';

export class HoidService {
  constructor(private readonly provider?: HoidProvider) {}

  async answer(request: HoidAnswerRequest): Promise<HoidAnswer> {
    const blocked = guardQuestion(request);
    if (blocked) return blocked;
    if (!this.provider) return {
      blocked: false,
      text: 'No hay una fuente de IA configurada para responder con seguridad. Atlas no enviará esta pregunta a ningún servicio externo hasta que exista una integración verificada.'
    };
    return redactProviderAnswer(await this.provider.answer(request), request);
  }
}
