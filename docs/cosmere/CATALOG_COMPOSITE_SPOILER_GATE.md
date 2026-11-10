# Puerta compuesta anti-spoilers vinculada al catálogo

`resolveCatalogCompositeSpoilerGate` integra tres límites técnicos existentes:

1. un mundo explícito del catálogo;
2. las unidades de lectura declaradas para sus obras;
3. una puerta compuesta cuyos requisitos deben pertenecer a ese mismo mundo.

El progreso se restringe primero a coordenadas realmente declaradas por el catálogo. Después se evalúan los requisitos. Si el mundo es ambiguo, una obra está fuera del mundo seleccionado, el catálogo contiene una incoherencia local o el identificador del mundo no es canónico, el resultado queda bloqueado.

## Contrato de seguridad

Esta capa es **fail-closed** y trabaja solo con metadatos. No:

- lee ni almacena texto de EPUB;
- define un orden editorial;
- crea relaciones narrativas entre obras;
- afirma hechos del canon.

Por tanto, puede reutilizarse para Scadrial, Sel, Nalthis, Taldain, Roshar y otros mundos cuando sus obras y unidades estén declaradas explícitamente en el catálogo.
