# Catálogo de fuentes privadas

`privateCosmereSourceCatalog.ts` registra exclusivamente títulos cuya presencia fue verificada en el índice aportado por el usuario.

Cada entrada tiene estado `declared`. Ese estado **no** significa que el texto completo, un capítulo concreto o un pasaje haya sido consultado.

## Garantías

- No contiene texto de los EPUB.
- No declara capítulos, unidades de lectura ni puntos de desbloqueo.
- No asigna mundos ni infiere cronologías a partir del título.
- Los errores estructurales se informan y no se resuelven automáticamente.

La arquitectura debe enlazar posteriormente una obra o contenido editorial solo cuando exista el metadato o evidencia correspondiente.
