# Expansión del catálogo del Cosmere: frontera editorial

La expansión reutilizable se organiza en seis capas:

1. **Fuentes**: registran procedencia y estado de acceso.
2. **Mundos**: identificadores de navegación, sin inferencias narrativas.
3. **Obras**: metadatos bibliográficos vinculados a una fuente.
4. **Unidades de lectura**: estructura explícita y ordenada por obra.
5. **Progreso**: unidades completadas para una obra concreta.
6. **Puertas anti-spoilers**: requisitos explícitos evaluados con política *fail-closed*.

## Procedencia

- `verified-index` significa únicamente que el metadato procede de un índice
  verificado disponible para el proyecto.
- `declared-private` registra una fuente privada declarada sin afirmar que su
  texto interno, capítulos o pasajes hayan sido inspeccionados.

La semilla bibliográfica actual registra como metadatos los títulos incluidos en
el índice verificado de `cosmere.epub`. La colección privada de Roshar se
registra como fuente, pero no se inventa una estructura interna cuando no existe
metadato accesible en esta capa.

## Relaciones mundo–obra

Un título, nombre de archivo o conocimiento externo no constituye una relación
automática. `resolveWorld` devuelve un mundo solo si existe **exactamente una**
asignación explícita. La ausencia o ambigüedad permanece sin resolver.

Esto permite priorizar Scadrial, Sel, Nalthis, Taldain y Roshar como destinos de
navegación sin fabricar relaciones editoriales.

## Anti-spoilers

`canReveal` bloquea por defecto cuando:

- el progreso pertenece a otra obra;
- no existen requisitos;
- hay requisitos duplicados;
- falta una unidad;
- una unidad requerida pertenece a otra obra;
- alguna unidad requerida no está completada.

La capa no decide qué hechos narrativos son spoilers. Las futuras entradas de
contenido deberán declarar sus requisitos y conservar evidencia de su procedencia.

## Límites de contenido

Estos archivos no contienen texto de EPUB, citas extensas ni pasajes protegidos.
Los resúmenes futuros deben ser originales y estar respaldados por una fuente
accesible para el proyecto; si un pasaje no está disponible, no debe inventarse
ni afirmarse que fue consultado.
