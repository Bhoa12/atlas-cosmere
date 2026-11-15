# Cosmere expansion run 89

This iteration adds a reusable descriptor layer between the verified catalog and user-visible content.

## Provenance rules

- A verified index may back bibliographic metadata.
- A declared private source is not treated as inspected editorial evidence.
- An original summary requires an accessible editorial source.
- No descriptor may invent internal reading structure.

## Spoiler safety

Descriptors may reference an explicit spoiler gate for the same work. Visibility is fail-closed when the gate is missing, empty, duplicated, crosses works, or its required units are not completed.

The implementation stores structure and provenance only; it does not copy protected passages or assert access to unavailable private material.
