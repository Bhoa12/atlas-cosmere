# Run 215 — Canonical static greeting integrity

## Finding

Run 214 correctly restricted unscoped assistant history to a fixed greeting ID
and kind. The visibility policy did not bind that exemption to the greeting's
actual text or complete record shape. A future restoration/hydration path could
therefore reuse the marker with arbitrary prose. Multiple copies of the same
unscoped greeting could also reach the list with duplicate React keys.

The application currently keeps Hoid chat history in component memory; this
run does not introduce persistence or claim that a durable hydration path
already exists. It hardens the existing restoration boundary so a future
adapter cannot treat the greeting marker as a generic unscoped-message token.

## Changes

- Export one canonical `HOID_STATIC_GREETING_TEXT` constant and use it in
  `HoidScreen` rather than maintaining a second literal.
- Require the exact greeting ID, role, kind, text and four-key record shape.
- Reject altered greeting text, extra fields, accessors and inherited records
  without invoking getters.
- Reserve the greeting ID and kind; scoped assistant answers cannot reuse
  either marker.
- Require bounded own-data IDs and text for ordinary user and scoped assistant
  messages before they reach the chat list.
- Collapse duplicate canonical greetings to one visible entry.
- Keep the existing exact progress revision and fingerprint requirement for
  every non-greeting Hoid message.
- Extend the conversation-continuity workflow path filters for this run's
  documentation.

## Security invariants

1. No unscoped assistant prose is visible except the exact application-owned
   greeting.
2. The greeting exemption is content-bound, not merely ID-bound.
3. A provider response cannot become the greeting by copying one marker.
4. Duplicate greeting records cannot create duplicate list keys.
5. Accessor-backed IDs, text, role, kind or progress scopes are never executed
   by the visibility policy.
6. Every non-greeting assistant response still requires an exact current
   revision and progress fingerprint.
7. User-authored messages remain independent of reading progress, but must be
   plain, bounded records before rendering.

## Validation

The conversation-continuity workflow runs the history-policy regression suite
and strict TypeScript checks for the policy and `HoidScreen`. The PR remains
draft until the final HEAD has successful CI.

## Scope and privacy

This run changes message validation only. It adds no Cosmere facts, aliases,
summaries, source locators, EPUB/XHTML content, extracted passages or images.
It does not add chat persistence, alter reading progress, modify editorial
registries, trust keys or production approvals.
