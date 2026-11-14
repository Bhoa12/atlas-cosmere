# Expansión Cosmere — Run 71

Esta iteración añade una capa de relaciones verificables entre mundos y obras y una evaluación anti-spoilers reutilizable.

## Modelo

`SourceRecord → WorkRecord → ReadingUnit → Progress → SpoilerGate`

Las relaciones `WorldWorkLink` son independientes de `WorkRecord`. Esto permite que Scadrial, Sel, Nalthis, Taldain, Roshar y futuros mundos se incorporen sin inferir una relación a partir del título de una obra.

Una relación solo se acepta cuando referencia IDs existentes de mundo, obra y fuente. Las relaciones duplicadas se informan durante la auditoría.

## Procedencia

El índice verificado de `cosmere.epub` se utiliza únicamente como catálogo de títulos. Los EPUB privados declarados de Roshar identifican fuentes disponibles para el usuario, pero esta capa no afirma haber inspeccionado capítulos ni pasajes que no estén accesibles.

No se guarda texto íntegro protegido. Esta iteración tampoco añade resúmenes narrativos.

## Anti-spoilers

`evaluateSpoilerGate` es conservadora:

- requisitos vacíos, duplicados o desconocidos bloquean;
- una unidad de otra obra no cuenta;
- el progreso se normaliza antes de evaluar;
- solo se permite el acceso cuando todas las unidades requeridas y válidas están completadas.

## Pruebas

Las pruebas usan datos sintéticos y cubren:

- una relación explícita válida;
- referencias de mundo inválidas;
- navegación por relaciones explícitas;
- progreso incompleto;
- desbloqueo tras completar todos los requisitos;
- requisitos duplicados.

La arquitectura sigue separando los metadatos bibliográficos del contenido editorial, para que futuras ampliaciones solo incorporen resúmenes originales respaldados por material realmente accesible.
