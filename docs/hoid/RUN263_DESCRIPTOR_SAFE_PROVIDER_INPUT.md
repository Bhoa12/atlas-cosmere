# Run 263 — descriptor-safe provider input projection

## Objective

The local EPUB reader owns chapter blocks, XHTML, source handles and package candidates. The provider pipeline must not evaluate or copy those fields merely because they are attached to an answer request.

Run 262 reconstructed a provider allow-list after reading `question` and `reading`. Run 263 closes an earlier boundary: the pipeline previously spread the caller's request before building that allow-list. Object spread can invoke getters on unrelated reader-only properties.

## Request boundary

`canonicalPipelineInput()` now:

- accepts only an ordinary object or a null-prototype record;
- reads only own data descriptors for `question` and `reading`;
- rejects accessor-backed required fields without invoking them;
- catches descriptor/proxy failures and returns the existing opaque `input-invalid` result;
- never enumerates, spreads, serializes or otherwise evaluates ignored caller properties.

The validated request is rebuilt from the two accepted values. Caller-supplied `knowledgeContext`, chapter blocks, XHTML, file URIs, package handles and arbitrary runtime-only properties are not copied into the normalized request.

Unknown optional properties are intentionally ignored rather than inspected. This lets the local reader coexist with the answer request object without turning the provider boundary into a reader-state traversal.

## Reading array boundary

`validReadingPositions()` previously used `for...of`. A caller-controlled `Symbol.iterator` could execute before the progress snapshot was canonicalized.

Run 263 now snapshots only dense ordinary arrays by index descriptors:

- array prototype must be the current realm's `Array.prototype`;
- length must be a safe integer within the existing 256-position limit;
- every numeric slot must be an enumerable own data property;
- holes, accessors, symbols, custom string properties and custom iterators are rejected;
- each position is still independently validated as an exact own-data record;
- duplicate works and contradictory completion forms remain fail-closed.

No custom iterator or accessor is invoked during progress normalization.

## Provider projection

The existing provider snapshot remains an explicit allow-list containing only:

- validated question;
- detached, frozen canonical reading positions;
- internally retrieved and authorized editorial context on the contextual provider interface.

No local chapter content, XHTML, file URI, source handle or package candidate is part of either legacy or contextual provider requests.

## Regression coverage

The provider-boundary suite covers:

- local EPUB fields absent from provider payloads;
- reader-only getters not evaluated;
- accessor-backed required request fields rejected without invocation;
- throwing proxy descriptor traps contained;
- legacy and contextual provider paths retaining the allow-list.

The reading-validation suite covers:

- sparse arrays;
- custom iterator accessors;
- accessor-backed array elements;
- extra string and symbol array properties;
- existing malformed-position, duplicate-work and hostile-record cases.

Fixtures are synthetic. No private EPUB is opened or committed.

## Security interpretation and limits

This is a descriptor-safe application boundary, not a claim that JavaScript can neutralize every malicious Proxy trap. Proxy meta-object traps may execute when reflection is requested; exceptions are contained and the request is rejected. The implementation avoids ordinary property getters and caller-controlled iteration.

The guarantee applies to the HoidPipeline request projection and its validated progress input. Other provider integrations must continue to use the same explicit snapshot boundary; this workflow is not a network-wide audit of every possible application transport.

## Validation

The dedicated GitHub Actions workflow runs both provider-egress and reading-snapshot regression suites, then strictly type-checks the pipeline, progress validator, tests and provider snapshot dependencies.
