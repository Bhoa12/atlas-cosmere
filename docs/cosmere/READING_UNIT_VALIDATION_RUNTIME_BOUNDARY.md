# Validación de unidades de lectura

La validación de unidades de lectura es una frontera técnica de metadatos. Su objetivo es impedir que identificadores, posiciones o estructuras malformadas se conviertan en progreso válido.

## Contrato

Cada unidad debe proporcionar:

- un identificador de unidad no vacío;
- un identificador de obra no vacío;
- una posición entera positiva.

Los identificadores deben ser únicos y las posiciones no pueden duplicarse dentro de la misma obra.

## Entradas externas

Aunque TypeScript describa una colección como `ReadingUnit[]`, los datos procedentes de persistencia, importaciones o integraciones pueden incumplir ese tipo en tiempo de ejecución. Las unidades con forma inválida se registran como `invalid_unit_shape` y el conjunto deja de considerarse válido.

La capa no normaliza valores, no inventa posiciones y no intenta reconstruir unidades.

## Límites editoriales

Esta validación no lee EPUBs ni contiene texto protegido. Tampoco determina capítulos, orden editorial, hechos narrativos o resúmenes del canon. Solo protege la integridad de metadatos que otras capas pueden usar para progreso y control anti-spoilers.
