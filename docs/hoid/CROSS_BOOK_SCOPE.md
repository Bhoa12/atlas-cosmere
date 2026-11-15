# Cross-book narrative scope

Hoid IA treats the source catalogue and the reader's progress as separate concerns.

A request that needs narrative context must name one explicit `bookId`. Progress in other books is never imported implicitly. The scope resolver exposes only the selected book and its maximum authorized chapter.

## Fail-closed cases

The resolver rejects:

- requests without a book;
- books absent from the declared progress;
- invalid progress values;
- chapters beyond the recorded progress.

This boundary is intentionally provider-independent. Providers receive context only after a scope has been authorized by later pipeline stages.

The catalogue may describe the private bibliography using metadata, but metadata does not grant narrative access. This module does not read EPUB text and does not contain copyrighted passages.
