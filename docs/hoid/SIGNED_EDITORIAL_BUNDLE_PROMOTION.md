# Hoid — promoción editorial con firmas por paquete

## Propósito

Run 156 añade una capa de firmas criptográficas a la sesión editorial completa. Cada paquete de revisión —resumen, afirmación atómica, identidad o relación— requiere una firma Ed25519 independiente antes de que se consulte la autoridad de revisión protegida de GitHub.

La nueva capa no sustituye la autoridad existente. Primero verifica las firmas y después delega en `authorizeHoidEditorialBundlePromotion()`, que vuelve a reconstruir el paquete, verifica el Pull Request protegido y lee el progreso SQLite autoritativo antes y después de la consulta de GitHub.

## Payload firmado

`buildHoidEditorialReviewPacketSigningMessage()` construye un mensaje con separación de dominio que vincula:

- repositorio, número de PR y ramas base/propuesta;
- SHA exacto del HEAD propuesto;
- quorum mínimo de aprobaciones y requisitos de Code Owner, descarte de revisiones obsoletas y enforcement de administradores;
- ruta del manifiesto de promoción;
- fingerprint del plan, paquete de conocimiento, bundle de revisión y lote de recibos;
- revisión y fingerprint del progreso de lectura;
- categoría, ID de borrador, ID de paquete y digest del contenido;
- digest canónico del recibo completo, incluidos checklist y códigos de observación;
- identidad y fecha del revisor;
- decisión aprobada e ID de la clave Ed25519.

El mensaje no contiene prosa editorial, resúmenes, pasajes, XHTML, EPUB, URI privados ni texto íntegro protegido. Los digests vinculan los contenidos exactos.

La firma queda ligada al HEAD exacto. Cualquier cambio de commit, paquete, recibo, progreso, revisor, decisión o clave exige una nueva firma.

**Contrato actualizado en Run 157:** la revisión protegida utiliza schema v2 y exige tanto `baseRef` como `baseSha`, además de `headRef` y `headSha`. El adaptador GitHub debe obtener `baseSha` del commit real de la rama base del Pull Request; el núcleo compara ese SHA con `expectedBaseSha`. Los mensajes de firma usan el dominio v2 e incluyen `expectedBaseSha`. Los snapshots schema v1 se rechazan sin fallback.

## Cobertura completa

El lote de firmas debe contener exactamente una firma por cada referencia del plan, en el mismo orden canónico. No se admiten firmas ausentes, duplicadas, inesperadas ni reordenadas.

Cada firma se resuelve contra el recibo de su categoría:

- `summary` → `summaries`;
- `atomic-claim` → `claims`;
- `entity` → `entities`;
- `relationship` → `relationships`.

El recibo debe haber superado primero el validador estructural existente y tener decisión `approved`. La identidad y fecha del revisor se extraen del recibo, no del sobre de firma, y deben coincidir con una clave activa del registro raíz autenticado.

## Secuencia de autorización

1. Validar el plan y reconstruirlo desde el manifiesto, las cuatro fuentes y los recibos exactos.
2. Comprobar que el fingerprint del plan no ha cambiado y que el progreso suministrado corresponde a ese plan.
3. Validar el bundle completo de recibos.
4. Verificar la firma raíz del registro y la revisión mínima persistida.
5. Verificar todas las firmas de paquete; cualquier fallo bloquea el lote completo.
6. Delegar en la autoridad protegida existente.
7. La autoridad existente vuelve a leer progreso, reconstruye el plan, consulta el snapshot GitHub del HEAD exacto y vuelve a leer progreso.
8. Solo se devuelve `ready-for-maintainer-commit`; nunca se autoriza una escritura de producción ni se fusiona un PR.

La app lectora no firma. El host inyecta el verificador criptográfico y aporta la raíz pública fijada fuera del registro, la revisión mínima persistida, el registro firmado y los sobres de firma. Si no existe implementación Ed25519, el proceso falla cerrado.

## Identidad del revisor

Los IDs del recibo deben utilizar el mismo espacio de identidad estable que el adaptador de GitHub. Se recomienda un ID inmutable de usuario de GitHub, no un login mutable. Además de la firma Ed25519, el gate exige que el número de revisores distintos que han firmado recibos alcance el quorum solicitado. La autoridad existente exige también que cada revisor de recibo aparezca entre las aprobaciones autenticadas del mismo PR y HEAD. Un segundo aprobador genérico no sustituye a la diversidad de revisores que han firmado el paquete editorial.

## Límites de producción

Este módulo no genera claves privadas, no crea un registro real de revisores, no escribe el registro editorial de producción y no fusiona Pull Requests. Los tests utilizan un firmante determinista sintético; no constituye criptografía de producción. La clave raíz, las claves reales y el adaptador Ed25519 del host siguen siendo configuración externa pendiente.

La promoción continúa devolviendo `promotionAllowed: false` y `productionWritePerformed: false`.

## Spoilers y privacidad

La revisión editorial y sus firmas no desbloquean contenido para lectores. El gate de progreso por libro/capítulo y la semántica AND de evidencias siguen siendo independientes. No se modifica SQLite, la allowlist de capítulos, los umbrales de desbloqueo ni el registro narrativo de producción.

Solo se firman metadatos, IDs y fingerprints. No se suben EPUBs, XHTML, texto de capítulos, resúmenes protegidos ni pasajes.


## Persistencia de la revisión mínima

Run 157 añade `HoidTrustRegistryRevisionStorePort` y `authorizeHoidSignedEditorialBundlePromotionWithRevisionStore()`. El host debe proporcionar almacenamiento durable, resistente a rollback y con compare-and-set linealizable. El núcleo no inicializa automáticamente un dominio sin revisión mínima: el bootstrap es una operación externa controlada. Tras verificar el registro raíz-firmado, la revisión se persiste y se vuelve a leer antes de delegar en la autoridad de promoción. La autoridad vuelve a verificar todas las firmas con la revisión persistida. No se incluye un adaptador de producción para Keychain/Keystore y la escritura editorial sigue desactivada.
