# Run 277 — reparación de integración y separación entre identidad y progreso

## Contexto

La auditoría del HEAD de Run 276 (095f4dd9feb3f7df9df5ba98f6e93f4dd370ba12) encontró 56 ejecuciones asociadas: 24 satisfactorias y 32 fallidas. Las fallidas no representaban 32 defectos independientes: varias suites compartían un único error de TypeScript en HoidScreen, y otras repetían expectativas que no se actualizaron al incorporar cuatro localizadores exactos para capítulos con etiqueta duplicada.

Esta iteración corrige esas causas sin modificar la rama Run 276.

## Correcciones

### 1. Tipo correcto en la frontera de presentación

HoidScreen consultaba chapterLabelAmbiguous sobre HoidPresentedCitation, que es el contrato interno y no contiene ese campo. La propiedad pertenece a HoidDisplayCitation, producido por projectHoidAnswerForDisplay().

La comprobación de continuidad conversacional utiliza ahora displayProjection.citations. Se mantiene la regla conservadora: el binding heredado, que solo almacena números de capítulo, no se conserva si una cita necesita ordinal para desambiguarse.

### 2. Contratos de presentación actualizados

- La prueba de respuestas no segmentadas espera la identidad visible estable (chapterOrdinal y chapterLabelAmbiguous: false).
- La prueba de recomendaciones usa el título bibliográfico canónico Viento y Verdad; el validador continúa rechazando títulos no canónicos.
- No se amplían los datos visibles con localizadores, hashes o IDs internos.

### 3. Cobertura de navegación: identidad no equivale a progreso

El manifiesto de Viento y verdad contiene ahora 15 unidades: 11 del prefijo numérico seguro y cuatro unidades adicionales con localizador exacto para las etiquetas duplicadas 12 y 14.

La cobertura ya no compara el tamaño total del manifiesto con el límite numérico 11. Comprueba por separado:

- Prefijo seguro completo: exactamente los capítulos 1–11, en ordinal consecutivo y con localizador verificado.
- Unidades ambiguas: cada unidad del manifiesto debe coincidir con una entrada exacta aprobada para la misma obra, edición, hash de navegación, capítulo, ordinal y locator.
- Inventario: el número total de unidades y localizadores debe coincidir con el prefijo seguro más las unidades ambiguas exactas.

La obra continúa clasificada como parcial; safeNumericProgressThroughChapter permanece en 11. Elantris conserva su prefijo seguro 1–47 y sus ambigüedades 48, 51 y 57 sin localizadores inventados.

### 4. Inventario de localizadores

getVerifiedChapterLocatorCount("sawt") informa 15 localizadores exactos. Este contador describe el inventario estructural, no el permiso de progreso.

Las pruebas actualizan el total de localizadores de Roshar de 453 a 457 y verifican que los capítulos 12 y 14 tienen dos unidades cada uno, mientras que el prefijo numérico continúa siendo de 11 capítulos.

### 5. Cola de ingesta editorial

Los localizadores ambiguos sirven para identidad y presentación, no para planificar inspección secuencial por número. Se extrae getHoidSafeIngestionUnits() y la cola de ingesta usa exclusivamente esas unidades.

Para Viento y verdad devuelve únicamente los capítulos 1–11. Cuando ese prefijo esté completado, el plan debe bloquear la continuación por numeración ambigua en lugar de programar una de las unidades 12/14. La prueba sintética verifica que las cuatro unidades identity-only quedan fuera de la cola segura.

## Privacidad y prevención de spoilers

- No se incorporan EPUB, XHTML, prosa, títulos de capítulos ni resúmenes.
- No se modifican SQLite, el ledger, el cursor v1 ni los umbrales editoriales.
- La identidad exacta de una unidad no acredita lectura ni autoriza evidencia.
- Los capítulos 12 y 14 siguen fuera del progreso numérico v1.
- Elantris y las colecciones sin segmentación suficiente permanecen conservadoras.
- La proyección visible conserva solo obra, capítulo, ordinal y etiqueta de ambigüedad.

## Validación

La CI inicial de Run 276 mostró 24 ejecuciones satisfactorias y 32 fallidas. Los logs inspeccionados identificaron:
- Un error de TypeScript en HoidScreen.tsx que bloqueaba múltiples suites.
- Expectativas antiguas de las proyecciones visibles.
- Un título de fixture que no coincidía con la bibliografía canónica.
- Contadores de cobertura que confundían localizadores exactos de identidad con el prefijo de progreso.
- La cola de ingesta bloqueada por la cobertura inconsistente y el riesgo de incluir unidades ambiguas.

La certificación de Run 277 queda pendiente de los workflows ejecutados sobre su HEAD final. No se declararán Vitest ni TypeScript satisfactorios hasta observar los resultados reales.

## Aislamiento

- Rama nueva: feat/hoid-ia-core-run277.
- Base exacta: Run 276, 095f4dd9feb3f7df9df5ba98f6e93f4dd370ba12.
- Run 276 y sus PR anteriores no se modifican.
- No se modifica main, no se fusiona automáticamente y no se promueve ningún borrador editorial.
