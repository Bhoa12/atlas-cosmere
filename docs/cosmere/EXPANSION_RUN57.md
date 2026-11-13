# Expansión Cosmere: arquitectura run57

Esta capa modela fuentes, mundos, obras, unidades de lectura, progreso y puertas anti-spoilers sin almacenar texto de EPUB.

## Procedencia

- `verified-index`: respalda únicamente metadatos presentes en un índice verificado.
- `declared-private`: registra una fuente privada declarada; no afirma que su contenido interno haya sido inspeccionado.

## Catálogo

Los títulos de `cosmere.epub` se registran como metadatos proporcionados. Las relaciones entre obra y mundo se dejan vacías cuando no existe un metadato explícito accesible.

## Anti-spoilers

`canReveal` es *fail-closed*: una puerta malformada, progreso ausente, obra incorrecta, unidades inexistentes o requisitos duplicados mantienen el contenido oculto.

## Límites editoriales

No copiar texto protegido. Los futuros resúmenes deben ser originales y estar respaldados por información accesible. Si un pasaje no está disponible, no se debe inventar un hecho ni afirmar que se consultó.
