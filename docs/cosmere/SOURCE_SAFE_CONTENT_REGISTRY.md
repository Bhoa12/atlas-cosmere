# Registro de contenido seguro para la expansión del Cosmere

Este módulo añade una capa reutilizable entre el catálogo bibliográfico y la interfaz de Atlas.

## Modelo

`SourceRecord → WorkRecord → ReadingUnit → ContentCard → SpoilerGate → Progress`

Una tarjeta contiene únicamente metadatos originales del Atlas. No almacena texto de EPUB, citas ni pasajes protegidos.

## Procedencia

- `verified-index`: solo respalda metadatos presentes en un índice verificado.
- `declared-private`: registra una fuente privada sin afirmar que su contenido interno haya sido inspeccionado.

El registro no infiere relaciones narrativas ni asignaciones obra–mundo. Si una relación no está respaldada por metadatos disponibles, debe permanecer ausente.

## Anti-spoilers

Cada tarjeta declara sus requisitos mediante un `SpoilerGate`. La resolución reutiliza el evaluador conservador existente y es *fail-closed*: ante progreso ausente, requisitos inválidos o unidades incompletas, la tarjeta no se entrega.

## Validación

La validación detecta referencias a fuentes u obras desconocidas, IDs duplicados, metadatos vacíos, puertas inconsistentes y resúmenes excesivamente largos. El límite de longitud ayuda a mantener esta capa como metadatos originales, no como un contenedor de texto editorial protegido.

Las pruebas usan datos sintéticos; no reproducen contenido de las fuentes privadas.
