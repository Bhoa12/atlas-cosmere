import { HoidQuestion, ReadingPosition } from './types';

export interface SpoilerGate {
  bookId: string;
  minimumChapter: number;
  keywords: string[];
}

/**
 * Conservative, deterministic gatekeeper. Unknown or ambiguous questions are
 * never sent to an external provider until a richer canonical knowledge index
 * can prove the requested context is unlocked.
 */
export class SpoilerGuard {
  constructor(private readonly gates: SpoilerGate[] = []) {}

  isUnlocked(position: ReadingPosition[], gate: SpoilerGate): boolean {
    const progress = position.find(item => item.bookId === gate.bookId);
    return !!progress && (progress.completed || progress.chapter >= gate.minimumChapter);
  }

  inspect(input: HoidQuestion): { allowed: boolean; reason?: string } {
    const normalized = input.question.toLocaleLowerCase();
    for (const gate of this.gates) {
      if (gate.keywords.some(keyword => normalized.includes(keyword.toLocaleLowerCase())) && !this.isUnlocked(input.reading, gate)) {
        return { allowed: false, reason: `El tema requiere llegar al capítulo ${gate.minimumChapter} de ${gate.bookId}.` };
      }
    }
    return { allowed: true };
  }
}
