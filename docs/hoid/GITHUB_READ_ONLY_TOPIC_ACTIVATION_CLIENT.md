# Run 143 — read-only GitHub REST transport for topic activation

## Purpose

Run 142 introduced a provider-neutral post-merge review port and a GitHub-specific normalizer, but its API client was still an injected interface with no concrete REST transport. Run 143 adds a concrete, read-only REST client while keeping the transport injectable and keeping GitHub out of the reader-facing Hoid runtime.

## Boundary

The createHoidGitHubRestTopicAssignmentMergeApiPort(fetchPort, token) factory implements the existing HoidGitHubTopicAssignmentMergeApiPort used by createHoidGitHubTopicAssignmentMergeReviewPort().

It exposes only two operations:

- GET /repos/{owner}/{repo}/pulls/{number}
- GET /repos/{owner}/{repo}/contents/{fixed-manifest-path}?ref={reviewed-head-sha}

The origin is fixed to https://api.github.com. Repository, PR number, manifest path and commit SHA are validated before any request. Path segments are encoded independently. Redirects are rejected, caching is disabled and browser credentials are omitted.

The injected fetch port is the only transport dependency. The token is captured in a closure and is never returned, logged or included in error messages. The adapter does not read environment variables and does not perform writes. It must be instantiated only by trusted editorial maintenance tooling, never by HoidScreen or a reader device.

## Least privilege

The credential should be a short-lived GitHub App installation token or fine-grained token restricted to the target repository with read-only access to:

- Contents
- Pull requests

No contents-write, pull-request-write, administration, actions-write or secrets permissions are needed. The application does not need a GitHub credential to render already-committed activation receipts.

## Manifest verification

The contents endpoint is requested at the exact reviewed head SHA and the one canonical promotion-manifest path. The client checks:

- GitHub reports a file, not a directory or symlink-like response;
- exact returned path and base64 encoding;
- bounded file size and valid UTF-8;
- exact manifest object keys and schema version;
- canonical, unique and sorted assignment/reviewer IDs;
- assignment/evidence/progress fingerprints;
- the plan fingerprint expected by the caller;
- the manifest fingerprint using the same canonical SHA-256 tuple as the promotion authority.

Only after these checks does the adapter return the commit SHA supplied in the immutable ref request and the verified plan fingerprint. The higher-level merge adapter still validates the raw PR state, target repository, base/head refs, exact reviewed head SHA, merged state and merge commit SHA.

This is an integrity check over source-controlled metadata. It is not a GitHub signature and does not replace protected reviews or human maintainer control.

## Failure behavior

The client fails closed on invalid input, missing credentials, network errors, non-200 responses, malformed JSON, invalid base64/UTF-8, oversized content, wrong paths, unexpected object keys or fingerprint mismatches. Transport error details are intentionally suppressed so credentials cannot be echoed through exceptions.

There are no retries and no writes. A caller may retry a transient failure at the orchestration boundary after re-reading the PR and progress state.

## CI path-filter correction

The Run 142 workflow already ran the merge adapter on branch pushes, but its pull_request.paths list omitted the GitHub merge adapter and its test. That could allow a PR-only change to those files to skip the dedicated activation workflow. Run 143 adds both existing adapter paths and the new REST client/test paths to the push and pull-request filters.

## Validation

Run:

    npx vitest run src/hoid/githubTopicAssignmentRestClient.test.ts src/hoid/githubTopicAssignmentMergeAdapter.test.ts src/hoid/topicAssignmentActivation.test.ts

The CI workflow also performs strict TypeScript checks over the complete activation and recommendation boundary.

## Production status

No credential is committed or configured by this change. No real activation request has been made. The production topic-assignment registry remains empty and the activation receipt remains null. No EPUB/XHTML content, passages, summaries or images are added.
