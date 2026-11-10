# World Reading Progress Summary

`resolveWorldReadingProgressSummary` derives world-level metrics from two already-validated inputs:

- a metadata-only reading-unit manifest;
- an explicit validated reading-progress snapshot.

For each world it reports total, completed and pending units plus a numeric completion ratio.

The function is fail-closed. It blocks when validation is unavailable, unit identifiers are ambiguous, or the progress snapshot does not partition the manifest exactly.

This layer does not inspect EPUB text, infer chapters, determine narrative order, create editorial summaries, or decide spoiler boundaries. It can therefore be reused for Scadrial, Sel, Nalthis, Taldain, Roshar and future worlds without embedding canon claims.

Architecture:

`catalog -> reading units -> validated progress -> world progress summary -> spoiler policy -> content access`
