import { describe, expect, it, vi } from 'vitest';
import { HoidService } from './HoidService';
import { HoidKnowledgeCatalog } from './catalog';
import type { HoidAliasDisclosurePort, HoidAliasDisclosureRequest } from "./aliasDisclosureBoundary";
import { HoidProvider } from './types';

function allowAllMatchedAliases(): HoidAliasDisclosurePort {
  return {
    authorize(request: HoidAliasDisclosureRequest) {
      return {
        status: "authorized",
        authorizedMatches: request.matches.map(match => ({ id: match.id, aliases: [...match.aliases] })),
        progressRevision: 3,
        progressFingerprint: "d".repeat(64),
      };
    },
  };
}

describe('HoidService catalog authorization boundary', () => {
  it('does not send a question about a locked catalog entry to a provider', async () => {
    const provider: HoidProvider = { answer: vi.fn(async () => 'No debería llamarse') };
    const catalog = new HoidKnowledgeCatalog([
      { id: 'verified-locked-entity', aliases: ['Entidad bloqueada'], kind: 'concept', firstSafeAppearance: { bookId: 'tfe', chapter: 5 } },
    ]);
    const result = await new HoidService(provider, undefined, catalog).answer({
      question: '¿Qué es la Entidad bloqueada?',
      reading: [{ bookId: 'tfe', chapter: 4 }],
    });
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('reading-position');
    expect(provider.answer).not.toHaveBeenCalled();
  });

  it('rejects progress outside the verified edition range before invoking a provider', async () => {
    const provider: HoidProvider = { answer: vi.fn(async () => 'No debería llamarse') };
    const result = await new HoidService(provider).answer({
      question: 'Pregunta sintética sin spoilers.',
      reading: [{ bookId: 'tfe', chapter: 999_999 }],
    });
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('input-invalid');
    expect(provider.answer).not.toHaveBeenCalled();
  });

  it('allows an unlocked catalog entry only when every matched alias is explicitly authorized', async () => {
    const provider: HoidProvider = { answer: vi.fn(async () => 'Respuesta segura') };
    const catalog = new HoidKnowledgeCatalog([
      { id: 'verified-entry', aliases: ['Entidad segura'], kind: 'concept', firstSafeAppearance: { bookId: 'tfe', chapter: 5 } },
    ]);
    const result = await new HoidService(provider, undefined, catalog, allowAllMatchedAliases()).answer({
      question: 'Háblame de la Entidad segura',
      reading: [{ bookId: 'tfe', chapter: 5 }],
    });
    expect(result.blocked).toBe(false);
    expect(provider.answer).toHaveBeenCalledTimes(1);
  });

  it('blocks provider output that introduces a locked catalog entity', async () => {
    const provider: HoidProvider = { answer: vi.fn(async () => 'Una Entidad bloqueada aparece aquí.') };
    const catalog = new HoidKnowledgeCatalog([
      { id: 'verified-locked-output', aliases: ['Entidad bloqueada'], kind: 'concept', firstSafeAppearance: { bookId: 'tfe', chapter: 5 } },
    ]);
    const result = await new HoidService(provider, undefined, catalog).answer({
      question: 'Dame una explicación general sin nombres.',
      reading: [{ bookId: 'tfe', chapter: 4 }],
    });
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('provider-output');
  });

  it('blocks catalog aliases obfuscated with invisible Unicode characters', async () => {
    const provider: HoidProvider = { answer: vi.fn(async () => 'Una Enti\u200bdad bloqueada aparece aquí.') };
    const catalog = new HoidKnowledgeCatalog([
      { id: 'unicode-locked-output', aliases: ['Entidad bloqueada'], kind: 'concept', firstSafeAppearance: { bookId: 'tfe', chapter: 5 } },
    ]);
    const result = await new HoidService(provider, undefined, catalog).answer({
      question: 'Dame una explicación general sin nombres.',
      reading: [{ bookId: 'tfe', chapter: 4 }],
    });
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('provider-output');
  });

  it('keeps provider output authorization bound to progress at request entry', async () => {
    let release!: () => void;
    let markProviderStarted!: () => void;
    const providerStarted = new Promise<void>(resolve => { markProviderStarted = resolve; });
    const provider: HoidProvider = {
      answer: vi.fn(() => {
        markProviderStarted();
        return new Promise<string>(resolve => {
          release = () => resolve('Una Entidad bloqueada aparece aquí.');
        });
      }),
    };
    const catalog = new HoidKnowledgeCatalog([
      { id: 'snapshot-locked-output', aliases: ['Entidad bloqueada'], kind: 'concept', firstSafeAppearance: { bookId: 'tfe', chapter: 5 } },
    ]);
    const reading = [{ bookId: 'tfe', chapter: 4 }];
    const pending = new HoidService(provider, undefined, catalog).answer({
      question: 'Dame una explicación general sin nombres.',
      reading,
    });
    await providerStarted;
    reading[0].chapter = 5;
    release();
    const result = await pending;
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('provider-output');
  });
});
