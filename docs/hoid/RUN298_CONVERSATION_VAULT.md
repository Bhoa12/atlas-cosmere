# Hoid IA — Run 298: cifrado y restauración de conversaciones

## Alcance

Esta entrega introduce el contrato neutral de un vault de conversaciones cifrado y versionado. No conecta todavía el vault a `HoidScreen`, no genera claves y no incorpora una implementación criptográfica propia.

El núcleo orquesta cuatro responsabilidades separadas:

1. **Key provider:** entrega un identificador y un handle opaco de clave; nunca bytes exportables.
2. **AEAD provider:** cifra/descifra mediante una implementación nativa o criptográfica auditada.
3. **Blob store:** conserva exclusivamente envelopes cifrados y aplica CAS por revisión.
4. **Checkpoint:** mantiene una revisión monotónica independiente del blob store.

El codec es responsable de una lista permitida y de una versión explícita del snapshot conversacional. No se serializan objetos arbitrarios por defecto.

## Envelope persistido

El envelope contiene únicamente:

- schemaVersion, sessionId, revision y kind;
- keyId y algoritmo fijo AES-256-GCM;
- nonce, ciphertext y tag en base64url sin padding;
- fingerprint SHA-256 del AAD;
- timestamp ISO-8601 canónico.

El AAD liga criptográficamente sesión, revisión, tipo de registro, keyId y timestamp. Cambiar cualquiera de esos metadatos invalida la autenticación. El ciphertext tiene un límite de tamaño para impedir restauraciones descontroladas.

No se persisten preguntas en claro, respuestas, historial, progreso de lectura, ordinales, unit IDs, localizadores EPUB, permisos de presentación ni claves.

## Protocolo de escritura

1. Leer checkpoint y envelope actuales.
2. Exigir que ambos representen la misma revisión.
3. Codificar el snapshot con el codec allow-listed.
4. Obtener un handle opaco de la clave activa.
5. Cifrar con AES-256-GCM y AAD canónico.
6. Hacer CAS del envelope cifrado.
7. Avanzar el checkpoint monotónico mediante CAS.
8. Informar de éxito solo si ambos pasos se completan.

Si el paso 7 falla después de guardar el envelope, la siguiente restauración detecta la divergencia y se bloquea. No se intenta reparar automáticamente ni rebajar el checkpoint.

## Restauración y anti-rollback

La restauración exige igualdad exacta entre la revisión del checkpoint y la del envelope, valida el formato y el fingerprint del AAD, resuelve la versión histórica de la clave y autentica el ciphertext antes de decodificarlo.

La ausencia de checkpoint y envelope significa sesión vacía. Cualquier combinación parcial, revisión divergente, clave histórica ausente, error AEAD o payload rechazado bloquea la restauración.

**Límite importante:** el contrato no puede convertir SQLite, AsyncStorage o Keychain en un contador monotónico por sí solo. La implementación del checkpoint debe apoyarse en una autoridad nativa independiente y resistente a rollback. Hasta que esa propiedad se demuestre en Android e iOS, el sistema no debe anunciar protección anti-rollback de producción.

## Borrado

`clear()` escribe un tombstone cifrado con una nueva revisión, en vez de eliminar la única evidencia de revisión. La restauración posterior devuelve una sesión vacía en esa revisión.

Esto es un borrado lógico del contenido activo, no una garantía de borrado físico de páginas SQLite, WAL, copias de seguridad o snapshots del sistema. El adaptador de almacenamiento debe definir y probar su política de compactación/retención.

## Requisitos para adaptadores nativos

- AES-256-GCM con nonce aleatorio único por clave; nunca reutilizar un nonce.
- Separación inequívoca de nonce, ciphertext y tag.
- Claves no exportables y rotación con resolución de claves históricas.
- No escribir plaintext, handles ni errores sensibles en logs.
- CAS durable entre procesos y una política de bloqueo ante escrituras concurrentes.
- Checkpoint monotónico fuera del mismo dominio rollbackable que los blobs.
- Pruebas en dispositivo para interrupción entre blob-CAS y checkpoint-CAS, restauración, rotación, pérdida de clave y borrado.
- No habilitar persistencia de producción si el checkpoint o el proveedor AEAD faltan.

## Limitaciones deliberadas

- No hay dependencia de proveedor ni SDK específico.
- No hay clave, secreto, endpoint ni credencial en el repositorio.
- No hay fallback a almacenamiento en claro.
- No se restauran permisos narrativos: cada turno debe volver a pasar por el host firmado y el progreso actual.
- Los fixtures son sintéticos; no se han leído ni incorporado cuerpos EPUB, XHTML ni pasajes protegidos.
