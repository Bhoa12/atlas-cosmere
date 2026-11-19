# Hoid — integridad de afirmaciones aprobadas

## Propósito

Una afirmación de producción no debe depender únicamente de un objeto que declare `status: approved`. El runtime debe comprobar que el texto, sus identificadores, los umbrales de spoiler y los documentos de origen siguen siendo exactamente los revisados.

## Huellas canónicas

Cada afirmación aprobada incorpora cuatro SHA-256:

- `statementSha256`: texto original exacto.
- `claimSha256`: identificador, texto, intención, conjunto canónico de evidencias y ámbito de entidades.
- `evidenceSha256`: para cada evidencia, identificador, obra, capítulo, localizador, umbral de desbloqueo, primera aparición segura, tipo de conocimiento, conjunto de alias, edición, huella de navegación, huella del XHTML individual, procedencia y huella del resumen original.
- `reviewSha256`: estado, origen editorial, identificador del revisor, fecha y `claimSha256`.

Los identificadores de evidencia y entidad se normalizan como conjuntos ordenados para evitar huellas distintas por cambios de orden que no alteran su significado.

## Requisitos de procedencia

Cada evidencia utilizada por una afirmación aprobada debe resolver a:

1. Una obra del manifiesto de lectura canónico.
2. Un capítulo y localizador exactos de esa edición.
3. Una edición y una huella de navegación registradas.
4. Un SHA-256 de documento XHTML presente en la allowlist de capítulos inspeccionados individualmente.

Si el documento no está en la allowlist, la afirmación no puede recibir una atestación de runtime. La existencia de un localizador de navegación no sustituye la inspección del XHTML.

Los umbrales de desbloqueo y la primera aparición segura forman parte de la huella de evidencia. Cambiarlos invalida la atestación y obliga a repetir la revisión.

## Validación en runtime

`validateHoidApprovedClaimAttestation` vuelve a calcular todas las huellas al crear el runtime. Un cambio de texto, evidencia, localizador, edición, resumen, procedencia, umbral o metadatos de revisión rechaza el registro completo.

El selector lingüístico continúa recibiendo candidatos ya autorizados y solo puede devolver identificadores. La prosa final se reconstruye desde la afirmación local validada.

## Límite de confianza

SHA-256 detecta divergencias y vincula los campos; **no es una firma digital y no autentica por sí solo al revisor**. El identificador del revisor y la fecha son metadatos declarativos. La autenticación independiente, la aprobación protegida de GitHub y la autoridad de promoción editorial siguen siendo requisitos separados.

El registro de producción permanece vacío hasta que la revisión protegida y la promoción editorial auténtica se completen. No se añaden hechos sintéticos ni se modifica el progreso del lector.

## Privacidad

Solo se almacenan huellas, identificadores, metadatos de edición, localizadores y resúmenes originales. No se copia texto EPUB, XHTML, imágenes ni pasajes protegidos.

## Integración con el grafo de conocimiento

El constructor del grafo no reconstruye una afirmación reducida a partir de id, texto y revisión. Valida y conserva el registro completo mediante `validateHoidApprovedClaimAttestation`, incluyendo sus cuatro huellas y su correspondencia exacta con las evidencias. Una afirmación modificada después de la atestación invalida el grafo completo; no se omiten campos de integridad ni se degrada a una validación superficial.

## Validación durante la representación

La representación de un plan vuelve a validar cada afirmación completa contra el conjunto de conocimiento suministrado al planificador. No acepta un objeto reducido que conserve solo el texto y los identificadores: las cuatro huellas, la edición, el documento XHTML, el localizador y los umbrales deben seguir coincidiendo. La factoría de producción usa exclusivamente los registros locales de conocimiento y afirmaciones aprobadas.
