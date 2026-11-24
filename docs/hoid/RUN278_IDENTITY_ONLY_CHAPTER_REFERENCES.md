# Run 278 — referencias de capítulo identity-only

## Objetivo

Introducir un contrato explícito para conservar la identidad exacta de una unidad de lectura sin convertir esa identidad en progreso, lectura completada ni autorización narrativa.

La necesidad surge de los capítulos con numeración repetida: un número visible no identifica por sí solo una unidad dentro de una edición.

## Contrato

`HoidChapterReference` contiene únicamente:

- versión y tipo del contrato;
- autoridad fija `identity-only`;
- obra bibliográfica;
- número visible de capítulo;
- ordinal de la unidad en el índice;
- ID de unidad;
- indicador de etiqueta ambigua;
- fingerprint SHA-256 de la identidad completa.

El fingerprint se calcula sobre la identidad de edición completa, incluidos el manifiesto, la edición, el hash de navegación y el localizador privado. Esos datos no se copian al objeto de referencia.

## Resolución

`createHoidChapterReference()` delega la resolución en `resolveHoidChapterIdentity()`.

- Un capítulo con etiqueta única puede resolverse por número.
- Una etiqueta duplicada requiere `unitId` o `locatorId` exacto.
- No se selecciona nunca el primer resultado de una búsqueda ambigua.
- La referencia se revalida contra el manifiesto vigente mediante `validateHoidChapterReference()`.

## Frontera de autoridad

La referencia:

- no lee ni modifica el ledger de progreso;
- no contiene un cursor;
- no acredita que el usuario haya leído la unidad;
- no autoriza evidencias ni resúmenes;
- no amplía los límites del cursor numérico v1;
- no incluye texto, título narrativo, URI local ni cuerpo EPUB.

La validación estructural debe ir seguida, por separado, de la comprobación del progreso vivo y de la política de desbloqueo de evidencias. La identidad exacta nunca sustituye esas comprobaciones.

## Pruebas

La suite cubre:

1. resolución de capítulos con numeración única;
2. rechazo de etiquetas duplicadas sin desambiguador;
3. conservación diferenciada de las dos unidades etiquetadas como capítulo 12;
4. ausencia de localizadores y hashes de navegación en el objeto público;
5. rechazo del objeto como cursor y como posición del ledger;
6. detección de ordinales y fingerprints obsoletos;
7. rechazo de getters sin ejecutarlos;
8. rechazo de propiedades adicionales y autoridades manipuladas.

## Privacidad

Solo se incorporan metadatos de identidad y un digest. No se incorporan EPUB, XHTML, prosa, títulos de capítulos, resúmenes, extractos ni rutas privadas.

## Validación

El workflow específico ejecuta la suite nueva junto con las pruebas de identidad y manifiesto existentes y realiza un type-check estricto de los módulos afectados. La certificación se considerará válida únicamente para el HEAD final de esta rama.

## Aislamiento

- Base: `feat/hoid-ia-core-run277`.
- Rama: `feat/hoid-ia-core-run278`.
- No se modifica Run 277, PR #170 ni `main`.
- No se fusiona automáticamente ni se cambia el destino de otros PR.
