import { HoidProvider, HoidRequest, HoidResult, KnowledgeItem } from "./types";
import { retrieveAuthorized } from "./retrieval";

export class HoidService {
  constructor(private readonly provider: HoidProvider | null, private readonly knowledge: KnowledgeItem[]) {}

  async ask(request: HoidRequest): Promise<HoidResult> {
    if (!this.provider) return {
      text: "Hoid IA todavía no tiene un proveedor de IA configurado.",
      blocked: true, reason: "provider_not_configured"
    };
    const context = retrieveAuthorized(this.knowledge, request.progress, request.question);
    const answer = await this.provider.answer({ question: request.question, context });
    return { text: answer, blocked: false };
  }
}
