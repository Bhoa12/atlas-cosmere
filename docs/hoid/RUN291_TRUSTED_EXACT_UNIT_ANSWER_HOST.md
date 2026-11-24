# Run 291 — Host de confianza y presentación exacta v2

## Objetivo
Componer el runtime exact-unit v2 con una frontera de presentación que vuelva a verificar la confianza editorial y el progreso durable inmediatamente antes de entregar una respuesta a la interfaz.

## Contratos
- `HoidReviewerTrustCheckpointStore`: lectura y compare-and-swap atómico de revisión monotónica y fingerprint.
- `HoidReviewerTrustRegistrySource`: carga del registro firmado más reciente.
- `HoidSignedClaimPackageSource`: carga de claims firmados y suscripción a invalidaciones del bundle.
- `HoidTrustedProgressInvalidationPort`: puente de invalidación de progreso entre coordinadores/procesos.
- `HoidTrustedClock`: reloj suministrado por el host.
- `HoidTrustedScreenAnswerPort`: sink síncrono de presentación y retirada.
- `HoidTrustedExactUnitAnswerHost`: composition root para preparar y presentar respuestas exact-unit v2.

## Flujo
1. Lee el checkpoint durable.
2. Carga el registro raíz firmado y los paquetes.
3. Canonicaliza el payload y calcula su fingerprint.
4. Rechaza rollback, equivocación, registro caducado o demasiado antiguo.
5. Construye el runtime mediante `createHoidSignedExactUnitEvidenceRuntime`.
6. Avanza el checkpoint mediante compare-and-swap antes de responder.
7. Ejecuta el runtime; el proveedor solo selecciona IDs de claims autorizados.
8. Devuelve un token opaco; el texto permanece en una WeakMap del host.
9. Antes de presentar, vuelve a cargar y verificar registro y paquete.
10. Rechaza cambios de bundle, revocaciones, rollback o equivocación.
11. Ejecuta `verifyForPresentation()` sobre el recibo exacto de progreso.
12. Invoca el sink de forma síncrona, sin `await` entre la última comprobación y la entrega.

## Anti-rollback y equivocación
El checkpoint guarda `{ revision, registryFingerprint }`. El fingerprint deriva del mensaje canónico raíz, no de JSON arbitrario.
- Revisión inferior: rechazo.
- Misma revisión con fingerprint distinto: rechazo por equivocación.
- Revisión superior: se acepta solo tras verificar registro raíz y todas las firmas editoriales.
- El avance exige CAS durable. Si el CAS falla y no se observa exactamente el checkpoint esperado, el host se bloquea.
- El checkpoint store debe emitir cambios durables; el package source debe emitir invalidaciones del bundle.
- La presentación instala suscripciones de confianza, bundle y progreso, vuelve a leer el checkpoint y verifica el recibo. Cualquier invalidación durante esa barrera impide la entrega.

El store de producción debe resistir escrituras concurrentes y restauraciones de backup. AsyncStorage o estado React no cumplen el contrato.

## Límites
- Reloj, root public key, registro, paquetes y checkpoint son dependencias del host; nunca proceden de pregunta, selector o UI.
- No hay claves privadas en el repositorio.
- El proveedor no recibe progreso, ordinales, IDs de unidad, fingerprints, referencias de capítulo, localizadores EPUB ni registro de confianza.
- El texto no se expone en el token preparado.
- El sink es síncrono y se llama tras verificar confianza y progreso. La UI debe retirar respuestas al recibir invalidaciones y no persistirlas fuera de este ciclo.
- Los hashes no sustituyen firmas raíz ni Ed25519.

## Integración nativa pendiente
Este PR añade contratos y pruebas, pero no modifica `HoidScreen`, SQLite ni adaptadores nativos. Antes de producción faltan:
- Implementación Android Keystore / iOS Keychain del checkpoint anti-rollback.
- Fuente de registro con política de frescura.
- Root public key fijada fuera de un bundle mutable.
- Adaptadores de suscripción que propaguen invalidaciones entre procesos y no solo dentro de una instancia.
- Adaptador del selector del proveedor.
- Conexión de `HoidTrustedScreenAnswerPort` con la pantalla real.
- Pruebas end-to-end, concurrencia, restauración y reloj nativo.

## Fuentes privadas
No se copian ni suben EPUB, XHTML, títulos, pasajes ni texto íntegro protegido. Los fixtures usan metadatos y prosa sintética. Referencias documentales no verificadas siguen bloqueadas.

## Validación
El workflow dedicado ejecuta pruebas de host, firma exact-unit, runtime, autorización y ledger, junto con TypeScript estricto.
