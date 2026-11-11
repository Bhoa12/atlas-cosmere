# Validación de unidades de lectura

La validación de unidades de lectura es una frontera técnica de metadatos. Su objetivo es impedir que identificadores, posiciones o estructuras malformadas se conviertan en progreso válido.

## Contrato

Cada unidad debe proporcionar:

- un identificador de unidad no vacío;
- un identificador de obra no vacío;
- una posición entera positiva dentro del rango de enteros seguros de JavaScript.

Los identificadores deben ser únicos, no pueden tener espacios de relleno al principio o al final y las posiciones no pueden duplicarse dentro de la misma obra. La capa rechaza esos identificadores en lugar de recortarlos silenciosamente, para que dos claves técnicamente distintas no terminen representando la misma unidad u obra.

## Entradas externas

Aunque TypeScript describa una colección como `ReadingUnit[]`, los datos procedentes de persistencia, importaciones o integraciones pueden incumplir ese tipo en tiempo de ejecución. Las colecciones que no sean arrays se registran como `invalid_collection_shape`. Las unidades internas con forma inválida se registran como `invalid_unit_shape`. En ambos casos, el conjunto deja de considerarse válido.

La capa no normaliza valores, no inventa posiciones y no intenta reconstruir unidades. Los espacios de relleno en identificadores se registran como `non_canonical_id` o `non_canonical_work_id`.

## Límites editoriales

Esta validación no lee EPUBs ni contiene texto protegido. Tampoco determina capítulos, orden editorial, hechos narrativos o resúmenes del canon. Solo protege la integridad de metadatos que otras capas pueden usar para progreso y control anti-spoilers.
