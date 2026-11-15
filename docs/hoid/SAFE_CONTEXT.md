# Hoid IA: catálogo y contexto seguro

Esta capa separa **disponibilidad bibliográfica** de **autorización narrativa**.

## Catálogo

`sourceCatalog.ts` registra únicamente metadatos de las obras privadas aportadas. La presencia de una obra en el catálogo no autoriza a revelar hechos de ella.

## Contexto por capítulo

`buildSafeContext` requiere progreso explícito para la misma obra y aplica una política de fallo cerrado:

- una obra desconocida devuelve `null`;
- sin un capítulo alcanzado válido devuelve `null`;
- se excluye evidencia de otras obras;
- se excluyen capítulos posteriores al progreso;
- se excluye evidencia marcada como no accesible;
- solo se aceptan resúmenes originales no vacíos.

La capa no recupera, almacena ni reproduce texto íntegro de EPUB. Si no existe evidencia accesible y respaldada, una capa superior debe abstenerse en lugar de inventar hechos.
