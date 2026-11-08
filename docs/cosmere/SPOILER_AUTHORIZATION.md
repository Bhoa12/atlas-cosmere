# Autorización anti-spoilers

`resolveSpoilerAuthorization` decide si una solicitud de revelación puede mostrarse a partir de requisitos de lectura **explícitos**.

## Contrato

La función recibe:

- obras declaradas;
- unidades de lectura validadas;
- progreso explícito;
- un identificador técnico de contenido;
- una lista explícita de unidades requeridas.

El resultado es:

- `authorized`: todas las unidades requeridas existen y están marcadas como completadas;
- `withheld`: la estructura es válida, pero falta completar algún requisito;
- `blocked`: hay datos inválidos, ambiguos, duplicados o referencias desconocidas.

## Límites

Esta capa no contiene ni recupera texto narrativo. Un `contentId` es solo un identificador técnico: no demuestra que exista una fuente accesible, que el contenido haya sido verificado ni que pueda generarse un resumen factual.

No se infieren requisitos a partir de títulos, nombres de mundos, cronologías o identificadores. Las dependencias deben declararse explícitamente.

La autorización técnica tampoco sustituye la procedencia editorial: cualquier contenido narrativo futuro debe mantener su propia evidencia y política de publicación.
