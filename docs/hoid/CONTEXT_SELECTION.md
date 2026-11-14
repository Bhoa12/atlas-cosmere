# Context selection

`selectSafeContext` is the retrieval-side boundary for Hoid IA.

It accepts evidence records only when all of the following are true:

1. the reader has declared progress for the same book;
2. the evidence chapter is a positive integer;
3. the evidence chapter is not later than the reader's declared chapter;
4. the evidence contains an original, non-empty summary.

The selector deliberately knows nothing about EPUB text extraction. A private source in the catalog does not automatically become evidence. Upstream ingestion must produce metadata and original summaries with an auditable provenance policy.

The function fails closed: unknown books, future chapters, invalid chapters, and empty summaries are rejected. Its output separates allowed and rejected records so later observability can measure filtering without exposing rejected narrative content to the reader.
