/**
 * Provider-neutral contract for checking one exact chapter document in a
 * host-local EPUB session. Implementations return availability metadata only;
 * they must never return source bytes, XHTML, extracted text, paths or URIs.
 */
export type HoidEditorialSourceDocumentAccessRequest = Readonly<{
  bookId: string;
  editionId: string;
  navigationSha256: string;
  chapterNumber: number;
  locatorId: string;
  expectedDocumentSha256: string;
}>;

export type HoidEditorialSourceDocumentAccessPort = Readonly<{
  inspectChapter(
    request: HoidEditorialSourceDocumentAccessRequest,
    options: Readonly<{ signal: AbortSignal }>,
  ): Promise<unknown>;
}>;
