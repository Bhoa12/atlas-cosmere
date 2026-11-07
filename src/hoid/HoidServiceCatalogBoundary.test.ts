import { HoidService } from './HoidService';
import { HoidKnowledgeCatalog } from './catalog';
import { HoidProvider } from './types';

describe('HoidService catalog authorization boundary', () => {
  it('does not send a question about a locked catalog entry to a provider', async () => {
    const provider: HoidProvider = { answer: jest.fn(async () => 'No debería llamarse') };
    const catalog = new HoidKnowledgeCatalog([
      { id: 'verified-locked-entity', aliases: ['Entidad bloqueada'], kind: 'concept', firstSafeAppearance: { bookId: 'mistborn-final-empire', chapter: 5 } },
    ]);

    const result = await new HoidService(provider, undefined, catalog).answer({
      question: '¿Qué es la Entidad bloqueada?',
      reading: [{ bookId: 'mistborn-final-empire', chapter: 4 }],
    });

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('reading-position');
    expect(provider.answer).not.toHaveBeenCalled();
  });

  it('allows an unlocked catalog entry through the provider boundary', async () => {
    const provider: HoidProvider = { answer: jest.fn(async () => 'Respuesta segura') };
    const catalog = new HoidKnowledgeCatalog([
      { id: 'verified-entry', aliases: ['Entidad segura'], kind: 'concept', firstSafeAppearance: { bookId: 'mistborn-final-empire', chapter: 5 } },
    ]);

    const result = await new HoidService(provider, undefined, catalog).answer({
      question: 'Háblame de la Entidad segura',
      reading: [{ bookId: 'mistborn-final-empire', chapter: 5 }],
    });

    expect(result.blocked).toBe(false);
    expect(provider.answer).toHaveBeenCalledTimes(1);
  });

  it('blocks provider output that introduces a locked catalog entity', async () => {
    const provider: HoidProvider = { answer: jest.fn(async () => 'Una Entidad bloqueada aparece aquí.') };
    const catalog = new HoidKnowledgeCatalog([
      { id: 'verified-locked-output', aliases: ['Entidad bloqueada'], kind: 'concept', firstSafeAppearance: { bookId: 'mistborn-final-empire', chapter: 5 } },
    ]);

    const result = await new HoidService(provider, undefined, catalog).answer({
      question: 'Dame una explicación general sin nombres.',
      reading: [{ bookId: 'mistborn-final-empire', chapter: 4 }],
    });

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('provider-output');
  });

  it('blocks catalog aliases obfuscated with invisible Unicode characters', async () => {
    const provider: HoidProvider = { answer: jest.fn(async () => 'Una Enti\u200bdad bloqueada aparece aquí.') };
    const catalog = new HoidKnowledgeCatalog([
      { id: 'unicode-locked-output', aliases: ['Entidad bloqueada'], kind: 'concept', firstSafeAppearance: { bookId: 'mistborn-final-empire', chapter: 5 } },
    ]);

    const result = await new HoidService(provider, undefined, catalog).answer({
      question: 'Dame una explicación general sin nombres.',
      reading: [{ bookId: 'mistborn-final-empire', chapter: 4 }],
    });

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('provider-output');
  });

  it('keeps provider output authorization bound to progress at request entry', async () => {
    let release!: () => void;
    const provider: HoidProvider = {
      answer: jest.fn(() => new Promise<string>(resolve => {
        release = () => resolve('Una Entidad bloqueada aparece aquí.');
      })),
    };
    const catalog = new HoidKnowledgeCatalog([
      { id: 'snapshot-locked-output', aliases: ['Entidad bloqueada'], kind: 'concept', firstSafeAppearance: { bookId: 'mistborn-final-empire', chapter: 5 } },
    ]);
    const reading = [{ bookId: 'mistborn-final-empire', chapter: 4 }];
    const pending = new HoidService(provider, undefined, catalog).answer({
      question: 'Dame una explicación general sin nombres.',
      reading,
    });
    await Promise.resolve();
    reading[0].chapter = 5;
    release();
    const result = await pending;

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('provider-output');
  });
});
