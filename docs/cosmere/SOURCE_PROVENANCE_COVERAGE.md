# Cobertura de procedencia de fuentes

`resolveSourceProvenanceCoverage(...)` comprueba una propiedad estructural: que cada obra declarada tenga al menos una fuente catalogada vinculada explícitamente.

## Estados

- `complete`: todas las obras declaradas tienen cobertura explícita.
- `incomplete`: la estructura es válida, pero faltan vinculaciones para una o más obras.
- `blocked`: el catálogo, las vinculaciones o las declaraciones son ambiguos o inválidos.

## Límites

Esta comprobación no lee EPUBs ni pasajes, no extrae hechos narrativos y no convierte la presencia de una fuente privada en evidencia de contenido. Una fuente cubierta solo establece procedencia estructural; la evidencia de un resumen y la autorización anti-spoilers continúan pasando por sus capas independientes.

La función no infiere vínculos mediante títulos, nombres de archivo, cronología o conocimiento externo.
