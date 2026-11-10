import { describe, expect, it, vi } from 'vitest';
import { HoidService } from './HoidService';
import { HoidProvider } from './types';

describe('HoidService provider request boundary', () => {
  it('gives a provider an immutable snapshot detached from later reader changes', async () => {
    let captured: any;
    const provider: HoidProvider = {
      answer: vi.fn(async (request) => {
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

  it('fails closed on a malformed runtime request before calling the provider', async () => {
    const provider: HoidProvider = { answer: vi.fn(async () => 'No debería llamarse') };

    const result = await new HoidService(provider).answer(null as unknown as { question: string; reading: [] });

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('input-invalid');
    expect(provider.answer).not.toHaveBeenCalled();
  });

  it('rejects ambiguous duplicate reading progress before spoiler checks or provider calls', async () => {
    const provider: HoidProvider = { answer: vi.fn(async () => 'No debería llamarse') };

    const result = await new HoidService(provider).answer({
      question: 'Pregunta segura',
      reading: [
        { bookId: 'book', chapter: 1 },
        { bookId: 'book', chapter: 2 },
      ],
    });

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('input-invalid');
    expect(provider.answer).not.toHaveBeenCalled();
  });
});
