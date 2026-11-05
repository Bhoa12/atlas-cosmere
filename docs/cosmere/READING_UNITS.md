# Validación de unidades de lectura

Las unidades de lectura son estructura técnica, no contenido editorial. Una unidad se describe únicamente con:

- un identificador estable;
- el identificador de la obra a la que pertenece;
- una posición entera positiva dentro de esa obra.

## Reglas comprobadas

`validateReadingUnits` rechaza IDs vacíos o duplicados, obras vacías, posiciones no enteras o menores que uno y posiciones repetidas dentro de la misma obra.

La validación permite que obras diferentes tengan una unidad en la misma posición. Tampoco exige que las posiciones sean consecutivas: esa decisión depende de la estructura realmente verificada de cada fuente.

## Límite editorial

Una colección técnicamente válida no certifica capítulos, títulos, acontecimientos ni resúmenes. Las unidades reales solo deben cargarse cuando su estructura proceda de una fuente accesible y verificable. Este módulo no abre EPUBs ni extrae texto protegido.
