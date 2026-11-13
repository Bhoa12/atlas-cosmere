# Cosmere expansion run 64

## Arquitectura
Esta iteración modela `fuentes → mundos → obras → unidades de lectura → progreso → puertas anti-spoilers`. Los mundos prioritarios son Scadrial, Sel, Nalthis, Taldain y Roshar.

## Procedencia
El índice verificado de `cosmere.epub` se registra únicamente como catálogo bibliográfico de 17 títulos. Las relaciones obra-mundo se dejan vacías hasta disponer de metadatos explícitos respaldados. Los EPUB privados de Roshar pueden declararse como fuente, pero una declaración de fuente no afirma que se hayan inspeccionado capítulos o pasajes.

## Anti-spoilers
`evaluateSpoilerGate` aplica fail-closed: requisitos vacíos, duplicados o desconocidos; progreso ausente o de otra obra; y lectura incompleta mantienen el contenido bloqueado. El progreso se normaliza para eliminar unidades desconocidas y duplicados.

## Límites de contenido
No se almacenan textos, citas ni pasajes de EPUB. Los futuros resúmenes deben ser originales y estar respaldados por material accesible. Si una estructura o pasaje no está accesible, no se inventan hechos ni unidades de lectura.

## Pruebas
Las pruebas usan datos sintéticos y cubren validación, normalización, bloqueo conservador y ausencia de asignaciones de mundo inferidas.