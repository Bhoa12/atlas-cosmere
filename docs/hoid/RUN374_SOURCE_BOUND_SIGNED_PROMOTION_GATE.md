# Run 374 — gate de promoción editorial firmado y vinculado a fuentes

## Objetivo

Conectar el preflight local de resúmenes de Run 372 con la autoridad de confianza de Run 373 sin duplicar la autenticación Ed25519, el registro de revisores, el quórum ni la autoridad protegida de GitHub.

El gate nuevo es una composición de aplicación. No sustituye a authorizeHoidTrustedHostSignedEditorialBundlePromotion.

## Contrato y secuencia

createHoidSourceBoundEditorialPromotionGatePort recibe dos puertos:

- HoidEditorialSummaryPromotionPreflightPort: comprueba progreso, recibo local, edición, navegación y digest del XHTML activo.
- HoidTrustedHostPromotionAuthorityPort: delega en la autoridad existente de host confiable.

Para el plan de promoción recibido:

1. Valida el fingerprint del plan y obtiene exactamente los paquetes de categoría summary.
2. Reconstruye cada paquete desde el catálogo editorial vigente.
3. Valida los recibos de resumen del bundle autenticado.
4. Ejecuta el preflight local de cada resumen, en serie y sin exponer texto.
5. Comprueba que cada resultado corresponde al paquete, obra, capítulo, edición, revisión y fingerprint exactos del progreso firmado.
6. Compara el fingerprint de decisión del recibo local con el del recibo del bundle autenticado.
7. Delega en el host confiable existente, que vuelve a validar firmas, registro raíz, revisión monotónica, quórum independiente, Pull Request protegido y progreso autoritativo.
8. Después de la autoridad, reconstruye el plan desde el contexto y el snapshot de progreso originales, y vuelve a comprobar la solicitud y los recibos.
9. Si la autoridad está lista para commit, repite todos los preflights locales.
10. Rechaza el resultado si cambia la fuente, el progreso, la solicitud, el bundle o el snapshot de recibos durante la operación.

## Vinculación de recibos

fingerprintHoidEditorialReviewDecision vincula:

- packet y draft;
- digest del resumen original;
- digest documental de la fuente;
- decisión;
- checklist completo;
- códigos de observación.

Excluye deliberadamente reviewerId y reviewedAt: un recibo local usa device-local-unverified, mientras que el recibo autenticado usa la identidad del revisor Ed25519. La identidad autenticada y su fecha siguen vinculadas por la firma del bundle; la comparación local exige que ambos recibos representen la misma decisión editorial sobre el mismo contenido y fuente.

## Límites de autoridad

Un resultado ready-for-maintainer-commit significa que:

- todos los paquetes de resumen del plan pasaron dos inspecciones locales coherentes;
- el host confiable autenticó el bundle, sus revisores y el estado protegido del Pull Request;
- los fingerprints de plan, bundle, recibos, progreso y HEAD coinciden.

No significa que se haya realizado un commit, una escritura de conocimiento de producción ni una fusión. La autoridad de host confiable puede persistir de forma monotónica la revisión mínima del registro de confianza; ese control de seguridad no es una promoción de conocimiento.

Todos los resultados conservan:

- promotionAllowed: false
- productionWritePerformed: false
- answerAuthorizationEffect: none
- spoilerUnlockEffect: none

El gate no autoriza respuestas narrativas ni altera el progreso del lector. Si un resumen no está permitido por el progreso actual o su EPUB no está cargado, el gate se bloquea.

## Privacidad y copyright

El preflight devuelve metadatos y fingerprints solamente. El gate no recibe ni devuelve bytes EPUB, XHTML, texto de capítulos, rutas privadas ni URI. No hay egress a proveedores. Las pruebas utilizan un adaptador sintético y no afirman que los EPUB privados estén montados en CI.

El catálogo sigue siendo el índice bibliográfico declarado por el usuario: 17 entradas de cosmere.epub y siete fuentes de Roshar. Este cambio no amplía la cobertura documental ni afirma haber inspeccionado nuevos pasajes.

## Validación

El workflow Run 374 ejecuta:

- pruebas del nuevo gate;
- pruebas del preflight local;
- regresiones de paquetes, bundle, quórum y autoridad de host confiable;
- TypeScript estricto en los contratos y consumidores del nuevo gate.
