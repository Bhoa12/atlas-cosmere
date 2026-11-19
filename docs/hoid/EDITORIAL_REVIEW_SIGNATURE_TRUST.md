# Hoid — confianza criptográfica en revisiones editoriales

## Propósito

Run 155 separa tres propiedades que no deben confundirse:

1. **Integridad:** SHA-256 detecta cambios en una afirmación, sus evidencias y sus metadatos.
2. **Autenticidad:** una firma Ed25519 demuestra que quien controla una clave privada autorizada firmó un payload concreto.
3. **Autorización:** el registro de confianza determina qué revisor puede aprobar qué repositorio y qué clave continúa vigente.

Una huella SHA-256 no autentica a un revisor. Un identificador declarativo de revisor tampoco es una firma.

## Payload firmado

`buildHoidApprovedClaimReviewSigningMessage()` produce una serialización JSON canónica basada en una tupla ordenada y con separación de dominio. Vincula:

- repositorio y número de Pull Request;
- rama base y SHA base;
- rama propuesta y SHA exacto de HEAD;
- ruta del manifiesto de promoción;
- fingerprint del plan y del paquete de revisión;
- identificador de afirmación;
- estado y origen editorial;
- identidad y fecha del revisor;
- los cuatro SHA-256 de la atestación;
- identificador de la clave Ed25519.

No incluye el texto de la afirmación, el resumen, el contenido EPUB/XHTML, los pasajes ni los URI privados. Los fingerprints ya vinculan el contenido exacto.

Cambiar de PR, HEAD, plan, paquete, revisor, evidencia o revisión invalida la firma.

## Registro de confianza

El registro tiene versión, revisión monotónica, fecha de emisión, caducidad y claves ordenadas. Cada clave contiene:

- `keyId` y `reviewerId` estable;
- algoritmo Ed25519 y clave pública hexadecimal de 32 bytes;
- estado activo o revocado;
- intervalo de validez;
- fecha de revocación;
- lista explícita de repositorios autorizados.

El registro completo lleva una firma raíz Ed25519. La clave pública raíz se fija fuera del propio registro, en la configuración de confianza del host. No se acepta una raíz que venga junto al registro como si se autenticara a sí misma. El host debe conservar una revisión mínima ya aceptada en almacenamiento resistente a rollback y pasarla obligatoriamente al verificador; el núcleo no proporciona un valor predeterminado.

La vigencia del registro está limitada a 90 días. Una revisión inferior a la revisión mínima persistida se rechaza aunque su firma raíz siga siendo matemáticamente válida. Las claves revocadas, caducadas, fuera de su intervalo o no autorizadas para el repositorio fallan cerradas.

## Contratos y adaptadores

El núcleo depende únicamente de `HoidEd25519VerificationPort`. No importa un SDK criptográfico ni accede a claves privadas.

`createHoidWebCryptoEd25519VerificationPort()` ofrece un adaptador opcional sobre WebCrypto. El host debe inyectar una implementación que realmente soporte Ed25519 y una codificación UTF-8 compatible. Expo/Hermes no se considera compatible por defecto; si no hay implementación nativa disponible, la verificación se bloquea.

El firmante es una herramienta externa controlada por el revisor, idealmente con clave hardware o servicio de firma. La app lectora nunca firma y nunca contiene claves privadas.

## Rotación y revocación

- La raíz pública se rota mediante una actualización controlada del host, no editando el registro firmado por la raíz antigua.
- Cada revisor puede tener varias claves históricas, pero no se permite reutilizar una misma clave pública bajo distintos identificadores.
- Las claves nuevas se publican en una revisión firmada del registro.
- La revocación se publica en una revisión posterior firmada por la raíz.
- Una clave revocada se rechaza aunque la firma sea matemáticamente válida.
- Una firma está ligada al HEAD exacto; cualquier commit posterior exige una nueva revisión y firma.

## Integración y límites de producción

Run 155 implementa los contratos, la canonicalización, la validación del registro raíz y el adaptador Ed25519 inyectable. Run 156 conecta una firma por paquete editorial —resumen, afirmación atómica, entidad y relación— con la autoridad protegida de GitHub y el progreso SQLite. Run 157 añade persistencia monotónica de la revisión mínima y vincula las firmas al SHA exacto de la rama base y al SHA exacto de HEAD mediante el contrato de revisión schema v2.

La promoción sigue siendo conservadora. El gate devuelve únicamente `ready-for-maintainer-commit`; `promotionAllowed` y `productionWritePerformed` permanecen en `false`. No instala ni genera claves privadas, no crea un registro real de revisores y no escribe el conocimiento editorial de producción.

Antes de producción deben existir una raíz pública aprobada fuera de banda, un registro firmado real, claves de revisores protegidas, un adaptador Ed25519 probado en el host y un `HoidTrustRegistryRevisionStorePort` durable, resistente a rollback y con compare-and-set linealizable. El bootstrap de la revisión mínima debe realizarse fuera de banda; el núcleo rechaza dominios no inicializados. Las pruebas sintéticas no equivalen a una configuración real de confianza.

## Validación

El workflow `.github/workflows/hoid-editorial-review-signatures.yml` ejecuta las pruebas del módulo, las regresiones de integridad de afirmaciones y TypeScript estricto con tipos DOM para el adaptador WebCrypto.

Las pruebas de confianza utilizan un verificador falso determinista para probar el contrato y un vector público RFC 8032 para el adaptador WebCrypto. El verificador falso nunca se usa en producción.

## Privacidad y spoilers

Solo se firman identificadores, fingerprints, metadatos de revisión y contexto del Pull Request. No se suben EPUBs, XHTML, resúmenes protegidos, pasajes ni texto íntegro de los libros. No se modifica el progreso de lectura, la allowlist de capítulos, los umbrales de desbloqueo ni el registro narrativo de producción.
