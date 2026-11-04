# Política de finalización de lectura — Roshar

**Estado:** decisión técnica aplicada al modelo de progreso; pendiente de revisión editorial de unidades anómalas.

## 1. Progreso de unidad

- Cada `ReadingUnit` se puede registrar de forma individual.
- Abrir o seleccionar una unidad no la marca como completada.
- Completar una unidad no completa ninguna unidad anterior, posterior ni de otra obra.
- Partes, días y bloques de interludios son contenedores editoriales, no unidades completables.

## 2. Finalización narrativa de una obra

La finalización narrativa se calcula solo con unidades que pertenecen al relato:

- Requeridas: preludio, prólogo, capítulo, interludio, epílogo y postludio.
- No bloquean la finalización narrativa: Ars Arcanum, agradecimientos, apéndices y material de cierre editorial clasificado como `afterword`.
- Las unidades `other` no se excluyen automáticamente: permanecen requeridas hasta que una revisión editorial determine su naturaleza. Esta regla evita que las anomalías de Viento y verdad o entradas todavía sin clasificar desaparezcan del criterio de finalización.

Esta política no significa que el material complementario no pueda seguirse. Sigue siendo una unidad individual que la aplicación puede marcar como leída, pero no impide que el usuario termine narrativamente una obra.

## 3. Spoilers y material complementario

- La condición de finalización narrativa no concede acceso a afirmaciones de enciclopedia.
- Cada afirmación, entrada, pregunta, relación y recompensa conserva su propio `SpoilerGate`.
- Un Ars Arcanum, apéndice o nota puede contener información que requiera un gate propio; ser material opcional no lo convierte en libre de spoilers.
- No se debe inferir que leer un apéndice desbloquea capítulos ni que completar todos los capítulos desbloquea automáticamente cada afirmación del material complementario.

## 4. Progreso legado

- `@atlas-cosmere/state-v1` permanece intacta.
- `librosLeidos` y `capituloActualPorLibro` no se convierten en unidades completadas: no prueban qué secciones se leyeron ni si el contador representa lectura continua.
- Los valores iniciales de demostración no son progreso real.
- El esquema v2 se mantiene separado hasta implementar hidratación, respaldo, rollback y recuperación probada en el contexto.

## 5. Implementación

La regla pura está implementada en `src/data/roshar/progress.ts` como `isRequiredForNarrativeCompletion` y cubierta por `tests/roshar/progress.test.cjs`.

La regla no calcula todavía el estado visual de «obra terminada» en la UI; ese consumidor deberá calcularlo a partir de las unidades narrativas requeridas y el conjunto explícito `completedUnitIds`.
