# Hoid IA: modelo de amenazas

Hoid IA trata como no confiables todas las entradas que puedan ampliar, alterar o justificar conocimiento narrativo.

## Activos protegidos

- El límite de lectura por obra y capítulo.
- La separación entre obras y entre posiciones del lector.
- La procedencia de cada resumen editorial original.
- La independencia entre la política de spoilers y cualquier proveedor de IA.
- La ausencia de texto íntegro protegido en el repositorio.

## Fronteras y respuesta esperada

| Frontera | Riesgo | Regla |
|---|---|---|
| Pregunta | Cargas excesivas o controles Unicode | Limitar antes y después de normalizar; rechazar entradas inválidas. |
| Progreso | Capítulos falsos, duplicados o tamaños extremos | Validar estructura y límites; no conceder conocimiento por datos ambiguos. |
| Catálogo | Identidades duplicadas o mutables | Usar IDs canónicos y no elegir por orden de llegada. |
| Recuperación | Resultados malformados o sobredimensionados | Fallar de forma cerrada antes de construir contexto. |
| Proveedor | Afirmaciones o evidencias no autorizadas | Filtrar contra el conocimiento autorizado y exigir evidencia válida. |

## Principio de no ampliación

Ninguna frontera posterior puede ampliar el conocimiento permitido por una frontera anterior. En particular, el proveedor no decide qué capítulos conoce el lector, y una recomendación no puede introducir hechos narrativos fuera del contexto autorizado.

## Fallo seguro

Cuando falte procedencia, la estructura sea ambigua o una fuente privada no sea accesible, Hoid IA debe degradar la respuesta: reconocer el límite, usar solo contexto autorizado o abstenerse. Nunca debe inventar una consulta, una cita ni un hecho atribuido a una fuente no disponible.

## Pruebas mínimas

Cada frontera debe cubrir al menos un caso válido, uno malformado y uno sobredimensionado. Las pruebas de regresión deben comprobar que datos no confiables no incrementan el conjunto de conocimiento autorizado.

Este documento describe controles arquitectónicos y no incorpora contenido narrativo ni texto protegido de las fuentes privadas.
