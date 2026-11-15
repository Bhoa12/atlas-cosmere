# Expansión Cosmere: iteración 93

## Objetivo

Esta iteración añade una auditoría transversal reutilizable para los datos de expansión del Atlas. El modelo valida referencias entre fuentes, mundos, obras, relaciones explícitas, unidades de lectura, progreso y puertas anti-spoilers.

## Procedencia

La bibliografía privada aportada se trata como **catálogo de fuentes**. Un índice verificado puede respaldar metadatos. Una fuente privada declarada puede registrarse sin afirmar que su contenido haya sido inspeccionado.

Las unidades de lectura requieren una fuente marcada como `editorial-accessible` y realmente accesible. La auditoría no crea capítulos, secciones ni estructura editorial por inferencia.

## Relaciones

Los vínculos obra-mundo son explícitos. La auditoría no deduce mundos a partir de títulos ni añade cronología o hechos narrativos.

## Progreso y spoilers

El progreso se reconcilia por obra y por el orden explícito de las unidades validadas.

Las puertas anti-spoilers fallan de forma cerrada: requisitos vacíos, duplicados o desconocidos mantienen el contenido bloqueado. Un contenido solo puede desbloquearse cuando todos los requisitos validados de su puerta están completados.

## Cobertura

Las pruebas usan únicamente datos sintéticos. Cubren procedencia de unidades, orden del progreso y desbloqueo conservador de puertas. No incluyen texto protegido ni dependen de pasajes privados no accesibles.
