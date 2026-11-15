# Hoid IA: catálogo y puerta de contexto

Esta iteración introduce dos contratos independientes:

1. **`sourceCatalog.ts`** contiene únicamente metadatos bibliográficos. La presencia de una obra en el catálogo no autoriza ningún hecho narrativo.
2. **`contextGate.ts`** admite evidencia solo cuando existe progreso explícito para la misma obra y el capítulo no supera la frontera del lector.

La evidencia admitida debe ser un **resumen original** con procedencia declarada como accesible. El contrato no almacena ni requiere texto íntegro de los EPUB privados.

## Fallo cerrado

Una obra desconocida, una obra sin progreso, un capítulo futuro o una evidencia inválida quedan fuera del contexto. El constructor devuelve exclusivamente evidencia que haya superado la admisión.

Si un pasaje no está disponible en el entorno, no debe convertirse en evidencia. La respuesta debe limitarse al contexto respaldado o abstenerse de forma neutral.
