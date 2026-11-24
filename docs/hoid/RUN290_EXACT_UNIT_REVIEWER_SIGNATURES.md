# Run 290 — Firmas de revisión Ed25519 para claims de unidad exacta

## Problema resuelto

La atestación SHA-256 de `exactUnitClaimIntegrity` demuestra que un claim, sus evidencias y sus políticas no han cambiado respecto al bundle validado. Por sí sola no autentica quién aprobó el contenido. La propia capa de presentación v1 ya documenta esta distinción.

Run 290 añade una envoltura de revisión Ed25519 v2 para los paquetes de claims con unidades exactas.

## Contrato firmado

Cada paquete firmado contiene:

- `claim`: claim editorial v2 con su atestación de integridad.
- `evidence`: metadatos editoriales originales y alias internos.
- `policies`: fuente, primera aparición segura y desbloqueo como referencias de edición/unidad exactas.
- `signature`: sobre Ed25519 v2 con `keyId` y firma de 64 bytes codificada en hexadecimal.

El mensaje de firma está separado por dominio y vincula el claim, sus hashes de integridad, los metadatos de revisión y el contexto de promoción del repositorio (PR, refs, SHAs, manifiesto y fingerprints).

## Verificación

`verifyHoidExactUnitClaimSignatures`:

1. Canonicaliza estructuras cerradas y arrays densos.
2. Revalida el hash-attestation contra los metadatos de evidencia, el digest verificado de fuente y las tres referencias exactas.
3. Construye el mensaje de firma determinista.
4. Verifica la firma raíz del registro de confianza.
5. Exige revisión mínima monotónica, registro vigente y clave de revisor activa.
6. Comprueba identidad de revisor, repositorio autorizado y ventana temporal.
7. Devuelve paquetes canónicos e inmutables solo si todas las firmas del lote son válidas.

Una firma de otro PR, un claim modificado, una clave revocada, un registro caducado o una revisión anterior bloquean el lote completo.

## Construcción del runtime

`createHoidSignedExactUnitEvidenceRuntime` verifica todas las firmas antes de construir `HoidExactUnitEvidenceRuntime`. No acepta que el proveedor aporte claims, firmas, progreso ni permisos. El selector continúa recibiendo únicamente los candidatos ya autorizados por el runtime exacto.

La fábrica es una composición de host: `now` debe proceder de un reloj controlado por el host y `minimumRegistryRevision` de almacenamiento monotónico durable. Nunca deben proceder de la pregunta, del proveedor ni de estado manipulable de la interfaz. La integración con bootstrap fijado y revision store durable sigue siendo responsabilidad del composition root nativo.

La fábrica de bajo nivel `createHoidExactUnitEvidenceRuntime` se conserva para pruebas y flujos editoriales locales controlados; no debe confundirse con una composición de producción autenticada.

## Límites explícitos

- Esta iteración no cambia la autoridad activa de progreso v2/v3.
- No conecta el nuevo runtime a `HoidScreen` ni sustituye todavía el presenter firmado v1.
- No introduce claves privadas ni secretos en el repositorio.
- La firma autentica el paquete y su contexto de revisión; la autorización de spoilers sigue dependiendo del progreso durable y de `HoidExactUnitEvidenceRuntime`.
- No se copian ni se suben pasajes de los EPUB privados. Los fixtures usan metadatos y prosa sintética.

## Validación

El workflow dedicado ejecuta las pruebas de firma exacta, atestación v2, registro de confianza y runtime exacto, además de TypeScript estricto.

La siguiente fase puede conectar estos paquetes firmados a una presentación exacta v2 sin reutilizar indebidamente el esquema de claims v1.
