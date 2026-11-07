import { HoidService } from './HoidService';
import { HoidProvider } from './types';

describe('HoidService provider request boundary', () => {
  it('gives a provider an immutable snapshot detached from later reader changes', async () => {
    let captured: any;
    const provider: HoidProvider = {
      answer: jest.fn(async (request) => {
        captured = request;
        return 'Respuesta segura';
      }),
    };

    const reading = [{ bookId: 'book', chapter: 1 }];
    const request = { question: 'Pregunta segura', reading };
    const result = await new HoidService(provider).answer(request);

    request.question = 'Pregunta cambiada';
    reading[0].chapter = 99;

    expect(result.blocked).toBe(false);
    expect(captured.question).toBe('Pregunta segura');
    expect(captured.reading[0].chapter).toBe(1);
    expect(Object.isFrozen(captured)).toBe(true);
    expect(Object.isFrozen(captured.reading)).toBe(true);
    expect(Object.isFrozen(captured.reading[0])).toBe(true);
  });
});
