# Hoid IA — Request Contract

This module is the input boundary for Hoid IA.

## Responsibilities

It validates and normalizes only request metadata:

- non-empty reader question;
- explicit response intent: `explain` or `recommend`;
- explicit book identifier;
- optional positive chapter number.

## Spoiler policy

The contract deliberately does **not** infer books, chapters, reading progress, or narrative facts. A normalized request is not authorization to expose context. It must still pass the cross-book scope, progress, evidence and output verification layers.

Invalid input fails closed so later layers cannot silently guess missing narrative scope.
