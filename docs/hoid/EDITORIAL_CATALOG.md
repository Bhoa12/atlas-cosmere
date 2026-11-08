# Catálogo editorial de Hoid IA

## Propósito

El catálogo editorial es la fuente local de autorización narrativa de Hoid. No almacena texto íntegro protegido: describe obras, puntos de lectura y entradas de conocimiento originales para decidir qué contexto puede utilizarse.

## Entrada mínima

Cada entrada de conocimiento debe incluir conceptualmente:

- `id`: identificador estable;
- `workId`: obra a la que pertenece;
- `unlock`: libro y capítulo, o un punto de lectura equivalente, desde el que puede utilizarse;
- `summary`: resumen original y breve, nunca una copia del texto fuente;
- `aliases`: variantes necesarias para detectar menciones, cuando existan;
- `provenance`: origen editorial o estado de verificación;
- `verification`: `verified`, `limited` o `unavailable`.

Las implementaciones pueden añadir campos de clasificación, pero ningún campo adicional puede elevar el nivel de autorización de una entrada.

## Regla de autorización

Una entrada solo puede entrar en el contexto de una solicitud si el progreso del lector alcanza o supera exactamente su punto de desbloqueo dentro de la misma obra. El progreso de una obra no autoriza conocimiento de otra.

Si falta el progreso, la obra no coincide, el capítulo es ambiguo o la entrada no tiene un punto de desbloqueo verificable, la entrada queda bloqueada.

## Procedencia y verificación

`verified` indica que el metadato o resumen original tiene respaldo accesible.

`limited` indica que solo puede usarse dentro del alcance explícitamente respaldado; no se completa con suposiciones.

`unavailable` impide usar la entrada para afirmar hechos narrativos. Hoid debe reconocer la limitación o recuperar contexto alternativo autorizado.

## Catálogo de fuentes

La bibliografía privada aportada se representa únicamente como catálogo de obras y estructura de lectura. Incluye las obras verificadas del EPUB `cosmere.epub` y los EPUB de Roshar con las cinco novelas principales, **Danzante del Filo** y **Esquirla del amanecer**.

La presencia de una obra en el catálogo no equivale a que todo su contenido esté disponible o verificado.

## Frontera de seguridad

La autorización se aplica antes de entregar contexto a un proveedor y vuelve a comprobarse sobre la salida. Un proveedor no puede desbloquear una entrada ni convertir una entrada no verificable en un hecho.

## Pruebas recomendadas

Las pruebas del catálogo deben cubrir:

- igualdad exacta del capítulo de desbloqueo;
- progreso inmediatamente anterior al desbloqueo;
- obras distintas con el mismo número de capítulo;
- entradas sin procedencia verificable;
- alias y variantes Unicode;
- mutación del progreso original después de crear la instantánea autorizada;
- posiciones duplicadas o desordenadas para una misma obra: la autorización debe usar el contexto canónico, nunca el primer elemento recibido.
