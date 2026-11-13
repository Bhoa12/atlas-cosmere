# Hoid IA — Catálogo de fuentes y cobertura editorial

## Propósito

Este documento define el catálogo canónico que Hoid IA puede usar para resolver identidades de obra, progreso de lectura y límites de contexto. No constituye una copia ni una transcripción de las fuentes privadas.

## Principio de acceso

El catálogo describe únicamente:

- identificadores de obra;
- títulos mostrables;
- pertenencia editorial;
- relaciones de lectura estructurales cuando estén verificadas.

El contenido narrativo requiere evidencia independiente. La mera presencia de una obra en este catálogo **no autoriza** ninguna afirmación sobre su trama.

## Colección Cosmere verificada

La fuente privada `cosmere.epub` tiene un índice verificado que incluye:

- El Imperio Final
- El Pozo de la Ascensión
- El Héroe de las Eras
- Aleación de ley
- Sombras de identidad
- Brazales de Duelo
- El metal perdido
- El aliento de los dioses
- Elantris
- Arena blanca, volúmenes 1 a 3
- Trenza del mar Esmeralda
- Yumi y el pintor de pesadillas
- El Hombre Iluminado
- Islas de la ascuaoscura
- Arcanum ilimitado

## Colección Roshar aportada

También existen fuentes privadas separadas para:

- las cinco novelas principales de El Archivo de las Tormentas;
- Danzante del Filo;
- Esquirla del amanecer.

La existencia de estos archivos no implica que todos sus capítulos estén accesibles en cada ejecución.

## Contrato de cobertura

Cada futura entrada editorial debe declarar uno de estos estados:

- `catalog_only`: la obra se conoce como metadato, sin acceso narrativo.
- `structure_verified`: se ha verificado estructura de lectura utilizable para progreso.
- `summary_backed`: existe un resumen original respaldado por evidencia permitida.
- `unavailable`: la fuente o el pasaje necesario no está disponible.

Las respuestas narrativas solo pueden basarse en `summary_backed` y en evidencia que esté dentro del presupuesto de conocimiento de la solicitud.

## Regla de incertidumbre

Si una obra figura en el catálogo pero el pasaje, capítulo o evidencia concreta no está accesible, Hoid IA debe indicar la limitación o abstenerse. Nunca debe convertir un título conocido en una afirmación narrativa inventada.

## Integración con el resto de la arquitectura

El catálogo alimenta la normalización de obra y las validaciones de progreso. Después, el presupuesto de conocimiento y el contexto autorizado determinan qué evidencia puede cruzar la frontera hacia un proveedor. Ningún proveedor puede ampliar esta cobertura por conocimiento propio.
