import { HoidKnowledgeCatalog } from '../src/hoid/catalog';
import { authorizeHoidContext } from '../src/hoid/contextPolicy';

const catalog = new HoidKnowledgeCatalog([
  {
    id: 'verified-example',
    aliases: ['nombre de ejemplo'],
    kind: 'concept',
    firstSafeAppearance: { bookId: 'book-a', chapter: 3 }
  }
]);

describe('Hoid context authorization', () => {
  it('blocks a matching entity before its safe chapter', () => {
    const decision = authorizeHoidContext(
      { question: '¿Qué significa nombre de ejemplo?', reading: [{ bookId: 'book-a', chapter: 2 }] },
      catalog
    );
    expect(decision.allowed).toBe(false);
  });

  it('unlocks only the same book at the safe chapter', () => {
    const decision = authorizeHoidContext(
      { question: 'nombre de ejemplo', reading: [{ bookId: 'book-a', chapter: 3 }] },
      catalog
    );
    expect(decision.allowed).toBe(true);
  });

  it('does not unlock content with progress in another book', () => {
    const decision = authorizeHoidContext(
      { question: 'nombre de ejemplo', reading: [{ bookId: 'book-b', completed: true }] },
      catalog
    );
    expect(decision.allowed).toBe(false);
  });
});
