# Progreso y acceso anti-spoilers

El núcleo de expansión separa el progreso de lectura de cualquier contenido editorial.

- `ReadingUnit` representa una unidad identificada y ordenada de una obra.
- Las unidades deben proceder de una estructura verificada; este modelo no inventa capítulos.
- `ReadingProgress` almacena únicamente identificadores de unidades completadas.
- `getProgressFraction` ignora identificadores desconocidos para evitar que datos corruptos inflen el progreso.

## Anti-spoilers

`evaluateSpoilerAccess` evalúa requisitos explícitos y devuelve `visible` o `blocked`.

La función no conoce tramas, personajes ni títulos y no intenta deducir el orden de lectura. Las capas de contenido deben declarar sus requisitos a partir de metadatos verificados. Esto permite reutilizar el mismo motor para Scadrial, Sel, Nalthis, Taldain, Roshar y futuros mundos sin introducir reglas narrativas codificadas.
