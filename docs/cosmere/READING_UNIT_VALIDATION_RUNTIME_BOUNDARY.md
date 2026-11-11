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


## Progreso en tiempo de ejecución

Las mismas garantías de frontera se aplican al progreso reutilizable: antes de usarlo para contar unidades, calcular una fracción o confirmar una unidad completada, la capa comprueba que la obra y todos los identificadores completados sean cadenas canónicas y que la colección tenga forma de array. Los valores malformados devuelven un resultado neutral y bloqueado —cero progreso o una comprobación negativa— en lugar de lanzar una excepción o normalizar datos externos.

Estas comprobaciones siguen siendo puramente técnicas. No convierten posiciones en capítulos, no infieren contenido faltante y no establecen requisitos narrativos.


## Reading progress runtime boundary

Reading progress is also treated as untrusted at runtime. A progress record is accepted only when its work identifier and every completed unit identifier are canonical, and the completion collection contains no duplicate identifiers. Duplicate values are rejected rather than silently collapsed.

Progress fractions additionally validate every supplied reading unit before accessing its fields. Each unit must have canonical identifiers plus a positive safe-integer position. A malformed collection or unit produces a zero progress fraction; the layer does not repair, trim, infer, or normalize external data.

These checks remain technical metadata validation. They do not determine chapters, editorial order, narrative events, or any canon fact.
