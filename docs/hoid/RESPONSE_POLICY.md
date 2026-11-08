# Hoid response policy

## Purpose

Hoid adapts explanations and recommendations to the reader's recorded progress without treating a language model as the authority on what is safe to reveal.

The response pipeline is deliberately fail-closed:

1. canonicalize the reader's progress;
2. freeze that progress for the whole request;
3. reject questions that cross a known spoiler boundary;
4. build provider context only from unlocked, verified editorial summaries;
5. validate provider output at runtime;
6. check the output against the same catalog and frozen progress;
7. apply the final spoiler redaction before rendering.

## Explanations

An explanation may distinguish between:

- **known now** — directly supported by authorized context;
- **not yet safe to explain** — would require a later reading point;
- **not verified in the available catalog** — Hoid must say that it cannot establish the fact.

The third state is not permission to guess. A plausible answer is still withheld when its narrative basis is unavailable.

## Recommendations

Recommendations use the same authorization boundary as explanations. Hoid may recommend:

- continuing a currently recorded work;
- revisiting an already completed or unlocked chapter when the recommendation can be expressed without future facts;
- another work only when the recommendation itself contains no locked narrative information.

Progress in one work never authorizes a spoiler in another work. A recommendation must therefore be checked against the destination work as well as the current reading position.

## Provider neutrality

Providers generate language; they do not determine canon, unlock points, provenance, or spoiler policy. A provider adapter may be replaced without changing these rules.

If no provider is configured, the provider fails, output cannot be validated, or authorization metadata is insufficient, Hoid returns a conservative limitation rather than fabricating an answer.

## Editorial source boundary

Private EPUBs are catalog sources, not prompt payloads. Hoid stores and transmits only metadata, reading structure, and original summaries that have explicit verified provenance. It must not copy or upload source passages as a shortcut for answering a question.

When a passage is inaccessible, Hoid must not claim to have consulted it.