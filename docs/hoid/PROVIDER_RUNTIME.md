# Hoid provider runtime

This module is the runtime boundary between Hoid IA and any language-model provider.

## Security invariants

Before a provider is called, context is reduced to evidence that is:

- explicitly accessible;
- from the exact book declared in reader progress;
- at or before the declared chapter;
- identified and backed by a non-empty original summary.

The provider receives no EPUB text through this contract.

After generation, every answer must cite at least one allowed evidence identifier. Unknown identifiers, empty answers, malformed results and provider exceptions fail closed to structured abstention.

## Provider independence

A provider implements only `HoidProvider`. Provider-specific SDKs and credentials belong in adapters outside this core contract.

## Copyright boundary

The runtime carries metadata and original summaries only. It must not upload or reproduce complete protected passages.
