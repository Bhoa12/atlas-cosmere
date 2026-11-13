# EXPANSION RUN 59

Esta iteración añade utilidades reutilizables para navegación y progreso sin introducir contenido editorial.

## Navegación de mundos

`worksForWorld` solo devuelve relaciones explícitas. Si la relación declarada por un mundo y la declarada por una obra entran en conflicto, devuelve una colección vacía en vez de elegir o inferir una versión.

## Progreso

`normalizeProgress` elimina unidades desconocidas, unidades de otra obra y duplicados antes de que el progreso pueda utilizarse para desbloquear contenido.

## Spoilers

`canReveal` continúa con una política *fail-closed*: metadatos ausentes, requisitos vacíos o duplicados y unidades desconocidas mantienen el contenido bloqueado.

No se incluyen pasajes, citas ni texto de los EPUB privados. Esta capa no asigna obras a Scadrial, Sel, Nalthis, Taldain, Roshar ni otros mundos salvo cuando la relación ya exista como metadato explícito.
