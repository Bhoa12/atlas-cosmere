# Estructura de ediciones y progreso por capítulo

## Alcance de la inspección

Se inspeccionaron únicamente los metadatos EPUB necesarios para identificar el paquete OPF, el documento de navegación y sus entradas estructurales. No se extrajo texto de capítulos ni se incorporaron títulos de capítulos al repositorio.

Cada `navigationSha256` de `src/hoid/editionStructure.ts` es la huella SHA-256 del documento de navegación de esa edición. Sirve para detectar cambios de edición o de índice; no es una huella del texto narrativo.

## Estructuras verificadas

Los recuentos son el número de valores de capítulo numerado encontrados en el índice de navegación de la edición inspeccionada. No incluyen prólogos, epílogos, interludios, apéndices, mapas ni material preliminar/final. Por tanto, no deben presentarse como número total de unidades de lectura.

### `cosmere.epub`

| Obra del catálogo | Capítulos numerados detectados | Política |
|---|---:|---|
| El Imperio Final | 38 | Numérica |
| El Pozo de la Ascensión | 59 | Numérica |
| El Héroe de las Eras | 82 | Numérica |
| Aleación de ley | 20 | Numérica |
| Sombras de identidad | 26 | Numérica |
| Brazales de Duelo | 31 | Numérica |
| El metal perdido | 74 | Numérica |
| El aliento de los dioses | 58 | Numérica |
| Elantris | 63 | Requiere localizador para los números repetidos 48, 51 y 57 |
| Arena blanca, volúmenes 1–3 | Sin recuento por volumen | El índice los presenta en un bloque combinado; requiere segmentación |
| Trenza del mar Esmeralda | 64 | Numérica |
| Yumi y el pintor de pesadillas | 41 | Numérica |
| El Hombre Iluminado | 52 | Numérica |
| Islas de la ascuaoscura | 61 | Numérica |
| Arcanum ilimitado | Sin recuento global | Colección con numeración reiniciada; requiere cursores por sección/relato |

Los tres volúmenes de Arena blanca se mantienen como tres IDs bibliográficos, pero no se les asigna un contador de capítulos inventado a partir del índice combinado. Arcanum ilimitado tampoco recibe un contador global: los números de capítulo se repiten dentro de sus obras contenidas.

### EPUB recopilatorio de El Archivo de las Tormentas

| Obra | Capítulos numerados detectados | Política |
|---|---:|---|
| El camino de los reyes | 75 | Numérica |
| Palabras radiantes | 89 | Numérica |
| Juramentada | 122 | Numérica |
| El Ritmo de la Guerra | 117 | Numérica |
| Viento y verdad | 147 | Requiere localizador para los números repetidos 12 y 14 |

### EPUB individuales de relatos de Roshar

| Obra | Capítulos numerados detectados | Política |
|---|---:|---|
| Danzante del Filo | 20 | Numérica |
| Esquirla del amanecer | 19 | Numérica |

## Regla conservadora de adaptación

`toHoidReadingPositions()` aplica ahora la estructura de edición antes de convertir el progreso de Atlas:

- obra desconocida: se omite;
- capítulo no entero, inferior a 1 o superior al recuento detectado: se omite;
- capítulo de Elantris igual o posterior al 48: se omite mientras Atlas no proporcione un localizador inequívoco;
- capítulo de Viento y verdad igual o posterior al 12: se omite mientras Atlas no proporcione un localizador inequívoco;
- progreso parcial de Arena blanca o Arcanum: se omite hasta implementar cursores por volumen/sección;
- finalización explícita del lector: se conserva como autodeclaración independiente del contador numérico.

La omisión significa que Hoid no puede usar esa posición parcial para desbloquear evidencia. No significa que el lector no haya avanzado; significa que el formato actual de progreso no representa ese avance con precisión suficiente.

## Límites y trabajo pendiente

1. Los índices no proporcionan todavía un mapeo completo y estable de prólogos, interludios, epílogos y secciones especiales.
2. Elantris y Viento y verdad necesitan un cursor basado en localizador, no solo un entero de capítulo.
3. Arena blanca requiere identificar los límites exactos de los tres volúmenes dentro de la edición combinada.
4. Arcanum ilimitado requiere modelar obras internas como unidades de lectura independientes.
5. El progreso de Atlas aún usa enteros por libro. La migración a cursores de unidad debe ser explícita y compatible con datos antiguos.

La estructura se usa solo para validar posiciones de lectura. No contiene pasajes, resúmenes, títulos de capítulos ni afirmaciones narrativas.
