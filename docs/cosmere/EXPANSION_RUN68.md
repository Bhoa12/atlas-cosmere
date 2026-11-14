# Expansión Cosmere — Run 68

## Objetivo

Esta iteración añade una frontera explícita entre **metadatos bibliográficos** y **contenido editorial que puede mostrarse**.

El modelo reutilizable conecta:

`fuentes → mundos → obras → unidades de lectura → contenido → progreso → puertas anti-spoilers`

## Procedencia

Las fuentes distinguen tres estados:

- `verified-index`: un índice respalda títulos y otros metadatos presentes en ese índice.
- `declared-private`: una fuente privada ha sido declarada, sin afirmar que su contenido interno haya sido inspeccionado.
- `accessible`: material realmente accesible en el entorno y apto para respaldar un resumen original.

Una obra o unidad puede conservar su procedencia sin copiar texto del EPUB.

## Contenido editorial

`ContentRecord` tiene dos estados:

- `metadata-only`: no puede contener un resumen.
- `backed-summary`: exige una fuente marcada como `accessible` y un resumen original no vacío.

La validación rechaza cualquier resumen atribuido a una fuente que no sea accesible.

## Anti-spoilers

El contenido solo se devuelve cuando:

1. el catálogo completo supera la validación;
2. el registro es un `backed-summary`;
3. todas sus unidades de puerta están completadas.

Cualquier catálogo inválido, requisito incompleto o procedencia insuficiente mantiene el contenido oculto.

## Bibliografía disponible

El índice verificado aportado para `cosmere.epub` se utiliza exclusivamente como catálogo de metadatos e incluye los 17 títulos declarados por el usuario.

Los EPUB privados de Roshar permanecen como fuentes declaradas cuando su contenido no está accesible. Esta iteración no afirma haber leído capítulos, pasajes o estructura interna de esos archivos.

Los mundos prioritarios —Scadrial, Sel, Nalthis, Taldain y Roshar— se modelan como entidades independientes. Las relaciones obra-mundo no deben deducirse de títulos: solo se registran cuando una fuente accesible respalda el metadato correspondiente.

## Límites

No se almacena ni copia texto íntegro protegido. Los futuros resúmenes deben ser originales, breves y respaldados por material realmente accesible.
