import {
  AuthorizedKnowledgeRetriever,
  KnowledgeRepository,
  SpoilerPolicy,
} from "../hoid/contracts";

const repository: KnowledgeRepository = {
  async search() {
    return [
      { id: "allowed", aliases: [], kind: "concept", unlock: { bookId: "book-a", chapter: 2 } },
      { id: "blocked", aliases: [], kind: "event", unlock: { bookId: "book-b", chapter: 1 } },
    ];
  },
};

async function run() {
  const retriever = new AuthorizedKnowledgeRetriever(
    repository,
    new SpoilerPolicy({ "book-a": 2, "book-b": 0 }),
  );
  const items = await retriever.retrieve("test");
  if (items.length !== 1 || items[0].id !== "allowed") {
    throw new Error("Spoiler authorization leaked blocked knowledge");
  }
}

run();
