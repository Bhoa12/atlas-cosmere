# EXPANSION RUN 106 — Progreso de lectura aislado

Esta iteración añade una capa reutilizable de progreso por obra sobre el catálogo
con procedencia explícita.

## Principios

- El progreso se reconcilia únicamente contra unidades de lectura declaradas.
- Los identificadores desconocidos se ignoran; no crean contenido nuevo.
- Una unidad de otra obra no puede completar progreso en la obra actual.
- El orden procede exclusivamente del campo `position` explícito.
- Una obra sin unidades accesibles conocidas no se considera completada y no
  produce una recomendación de lectura.

## Alcance editorial

El módulo no contiene capítulos, texto protegido ni resúmenes narrativos. El
catálogo bibliográfico puede registrar obras procedentes del índice verificado y
fuentes privadas declaradas, pero eso no se interpreta como acceso a su contenido.

Cuando se incorporen unidades reales para Scadrial, Sel, Nalthis, Taldain,
Roshar u otros mundos, deberán declararse con una procedencia editorial
adecuada y una posición explícita.
