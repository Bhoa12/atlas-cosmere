# Migración del progreso de Hoid a cursores v2

## Objetivo

Definir y probar una conversión no destructiva desde el snapshot numérico v1 del Progress Ledger hacia un snapshot v2 con cursores vinculados a la edición exacta.

Esta iteración introduce el contrato de snapshot, su validador y una función de migración pura. **No cambia la tabla SQLite existente, no escribe snapshots v2 en disco y no cambia todavía la fuente autoritativa del EvidenceRuntime.** El Ledger v1 continúa siendo el formato de producción hasta completar el adaptador transaccional y la integración de lectura dual.

## Modelo v2

Un snapshot v2 conserva la revisión global, la fecha de actualización y una posición independiente por obra:

- Progreso parcial: `{ bookId, cursor, order? }`.
- Finalización declarada: `{ bookId, completed: true, order? }`.

El cursor debe validar contra el manifiesto local de esa misma edición. El estado completado no se transforma en un capítulo ficticio. El orden editorial opcional se conserva sin utilizarlo como autorización narrativa.

## Conversión v1 → v2

`migrateHoidProgressV1ToV2()` sigue estos pasos:

1. Entrega el snapshot de entrada al validador del Progress Ledger v1, en modo de solo lectura.
2. Rechaza el snapshot completo si la forma, la edición, la revisión o cualquier posición heredada es inválida.
3. Conserva las finalizaciones explícitas como finalizaciones.
4. Convierte cada capítulo parcial en un cursor obtenido del manifiesto exacto.
5. Si una posición no tiene cursor inequívoco, bloquea la migración completa; no elimina ni rebaja esa posición.
6. Conserva revisión, fecha y orden editorial.
7. Valida el snapshot v2 resultante antes de devolverlo.

La función no modifica el objeto legado ni escribe en SQLite. La misma entrada válida produce el mismo resultado.

## Política ante ambigüedades

- Elantris: un progreso numérico heredado que alcance una posición ambigua se rechaza; no se elige arbitrariamente uno de los localizadores.
- Viento y verdad: se aplica la misma regla a los números duplicados.
- Arena blanca: no se inventa un cursor mientras los volúmenes no tengan manifiestos independientes verificados.
- Arcanum ilimitado: no se infiere un cursor global para la colección.
- Obras desconocidas o posiciones fuera de la edición: se rechaza el snapshot legado completo.

Una migración bloqueada deja intacto el snapshot v1. La recuperación requiere corregir el progreso con un localizador editorial verificado, no descartar datos automáticamente.

## Validación v2

`validateHoidCursorProgressSnapshot()` comprueba:

- versión exacta del esquema;
- revisión segura y estado temporal coherente;
- arrays densos y registros planos;
- ausencia de propiedades desconocidas, heredadas, simbólicas o accessors;
- una sola posición por obra;
- obra perteneciente al catálogo;
- cursor válido contra su manifiesto y correspondiente al mismo `bookId`;
- finalización explícita, nunca combinada con cursor;
- fecha ISO canónica.

Los datos externos deben decodificarse desde JSON antes de esta frontera. JavaScript no permite identificar con fiabilidad todos los proxies transparentes.

## Siguiente etapa antes del corte a v2

No se debe activar este snapshot como fuente autoritativa hasta completar:

1. Un adaptador SQLite v2 con tabla/versión explícita y transacciones atómicas.
2. Un marcador de migración escrito en la misma transacción que el snapshot v2.
3. Lectura dual determinista: v2 validado, o migración de v1 validada; nunca mezclar posiciones de ambas fuentes.
4. Compare-and-swap contra la revisión fuente para impedir migrar un snapshot que haya cambiado.
5. Rollback y recuperación ante interrupciones, sin borrar v1 antes de verificar v2.
6. Integración del EvidenceRuntime para consumir exclusivamente cursores validados.
7. Pruebas de migración repetida, conflicto, corrupción, rollback y downgrade.

Hasta entonces, la migración de este módulo es una preparación verificable, no una migración de base de datos ya ejecutada.

## Pruebas

`cursorProgressLedger.test.ts` cubre snapshots vacíos, validación de cursores, finalizaciones, identidades de obra, duplicados, edición obsoleta, estructuras malformadas, conversión de progreso parcial, conservación de metadatos, rechazo de posiciones ambiguas, no mutación e idempotencia determinista.

No se inspeccionaron EPUBs nuevos ni se incorporó contenido narrativo. El módulo utiliza exclusivamente los manifiestos estructurales y contratos ya existentes.
