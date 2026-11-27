# Run 355 — preguntas de seguimiento vinculadas al progreso

## Objetivo

Añadir recomendaciones conversacionales de investigación a la explicación de evolución de personajes. Hoid puede sugerir preguntas concretas solo para dimensiones que ya tengan afirmaciones editoriales aprobadas y visibles en el expediente del personaje bajo el progreso y el ámbito documental actuales.

## Comportamiento

- La ruta reutiliza el mismo expediente local, índice de anotaciones editoriales y autorización de evidencias que la explicación de evolución.
- Una dimensión solo puede generar una pregunta si al menos una afirmación de esa dimensión aparece en el expediente ya filtrado por identidad, alias, ámbito, edición, capítulo y watermark de lectura completada.
- Las preguntas son plantillas originales y genéricas; no añaden hechos narrativos.
- Cada pregunta incluye únicamente citas de capítulo ya proyectadas por `projectHoidAnswerForDisplay`. No se copian identificadores de evidencia, localizadores EPUB ni umbrales internos al estado de React.
- Se presentan como máximo tres preguntas, en un orden determinista por dimensión.
- El coste de las preguntas y de sus citas se descuenta del presupuesto de caracteres de la explicación. Si el presupuesto no permite incluirlas, se omiten; nunca se recorta una afirmación ni se relaja un control de spoilers.
- HoidScreen muestra las preguntas y sus referencias junto a la explicación de evolución.

## Garantías

1. No se consulta una segunda fuente ni un proveedor para generar sugerencias.
2. Las dimensiones sin afirmaciones aprobadas y desbloqueadas no se mencionan.
3. Las afirmaciones `recommend` no se convierten en hechos ni en recomendaciones de investigación.
4. Las preguntas de causa solo pueden derivarse de anotaciones `cause` que ya exigen una transición explícita y una afirmación `explain`.
5. Las preguntas de relaciones solo pueden derivarse de anotaciones que ya exigen al menos dos participantes verificados.
6. Las citas se vuelven a proyectar mediante la frontera de presentación segura.
7. La identidad del progreso se verifica antes y después de recuperar y componer el expediente; un cambio descarta toda la respuesta.
8. No se infieren dimensiones futuras, capítulos pendientes, acontecimientos no visibles ni temas que todavía no estén documentados en el expediente autorizado.

## Límite deliberado

El proyecto todavía no mantiene un historial autoritativo de preguntas que el lector ya haya investigado. Por ello, estas sugerencias significan **preguntas de seguimiento disponibles con el progreso actual**, no una afirmación de que el lector nunca las haya formulado. No se infiere ese historial a partir del comportamiento.

## Datos y copyright

- `HOID_CHARACTER_EVOLUTION_ANNOTATIONS` continúa vacío en producción.
- Las pruebas utilizan personajes, afirmaciones y fuentes sintéticos originales.
- No se incorporan EPUB, XHTML, texto protegido, resúmenes narrativos reales ni localizadores privados.
- El catálogo bibliográfico existente sigue siendo metadata-only.
- La promoción de anotaciones reales continúa siendo una operación editorial independiente y de host confiable.

## Validación

El workflow específico de Run 355 ejecuta la suite de evolución y regresiones de dossiers, relaciones, cronologías, magia, proyección y recomendaciones, seguido de TypeScript estricto. El resultado se considera válido únicamente cuando GitHub Actions termina en `success` sobre el HEAD final de esta rama.
