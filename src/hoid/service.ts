import { HoidProvider, HoidAnswerRequest, HoidAnswer } from "./types";
import { HoidKnowledgeEntry } from "./catalog";
import { retrieveAuthorized } from "./retrieval";
export class HoidService {
  constructor(private readonly provider: HoidProvider | null, private readonly knowledge: HoidKnowledgeEntry[]) {}
  async ask(request: HoidAnswerRequest): Promise<HoidAnswer> {
    if (!this.provider) return { text: "Hoid IA todavía no tiene un proveedor de IA configurado.", blocked: true, reason: "provider-unavailable" };
    const context = retrieveAuthorized(this.knowledge, request.reading, request.question);
    const lockedMatch = this.knowledge.some(item => {
      const p = request.reading.find(x => x.bookId === item.firstSafeAppearance.bookId);
      const unlocked = !!p && (p.completed || (p.chapter ?? 0) >= item.firstSafeAppearance.chapter);
      return !unlocked && item.aliases.some(a => request.question.toLowerCase().includes(a.toLowerCase()));
    });
    if (lockedMatch) return { text: "Para evitar spoilers, esa información todavía no está disponible según tu progreso de lectura.", blocked: true, reason: "reading-position" };
    // Provider contract remains generic; adapters may later receive authorized context without changing UI contracts.
    void context;
    return { text: await this.provider.answer(request), blocked: false };
  }
}