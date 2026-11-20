# Presentación segura: integridad y autenticidad

La salida del proveedor nunca es una fuente de autoridad. La presentación final debe reconstruirse desde afirmaciones locales, verificadas y desbloqueadas.

## Dos niveles distintos

- createHoidVerifiedAnswerPresenter valida la atestación SHA-256, la procedencia documental, el texto canónico, las citas y el progreso. Es una frontera de integridad y reconstrucción; por sí sola no autentica quién aprobó una afirmación.
- createHoidTrustedVerifiedAnswerPresenter añade autenticidad criptográfica. Exige una firma Ed25519 por afirmación, una clave de revisor autorizada por un registro firmado por la raíz fijada por el host y una revisión mínima persistida de forma durable y monotónica.

No se debe interpretar un reviewerId, un campo status=approved ni un SHA-256 como prueba de identidad del revisor.

## Composición de confianza

1. El host carga la configuración de bootstrap desde su puerto fijado fuera de banda.
2. El bootstrap fija la clave pública raíz, el dominio de confianza, los repositorios permitidos y la revisión mínima.
3. El almacén durable valida que su revisión persistida está inicializada y no ha retrocedido.
4. El núcleo autentica la firma raíz del registro de revisores y persiste su revisión mediante compare-and-set.
5. Cada afirmación se valida contra sus documentos de capítulo y se verifica con la clave Ed25519 activa del revisor.
6. La firma vincula repositorio, PR, rama y SHA base, rama y SHA HEAD, manifiesto, plan, paquete editorial y fingerprints de la afirmación.
7. Solo entonces se construye el presentador local que reconstruye texto y citas.
8. En cada presentación se comprueba que el bootstrap no ha cambiado, que bootstrap y registro siguen vigentes y que la revisión persistida sigue siendo exactamente la utilizada para verificar las firmas.
9. Si cambia la revisión, caduca la configuración o falla cualquier puerto, la respuesta queda retenida.

## Contratos del host

El host debe proporcionar, desde configuración confiable y nunca desde el proveedor ni desde el usuario:

- Bootstrap port con clave raíz fijada fuera de banda.
- Trust registry firmado y vigente.
- Verificador Ed25519 real (por ejemplo, WebCrypto o implementación nativa).
- Revision store durable, resistente a rollback, con compare-and-set linealizable.
- Clock del host.
- Puerto de progreso que lee el snapshot autoritativo local (por ejemplo, el adaptador SQLite); el presentador no acepta progreso como argumento del llamador.
- Contexto del manifiesto de revisión ligado al PR y HEAD exactos.
- Repositorio esperado.

Las pruebas de esta capa usan un verificador determinista falso para probar el contrato. No equivale a una clave de producción ni sustituye las pruebas RFC 8032 del adaptador WebCrypto existente.

## Política de promoción

La verificación criptográfica de afirmaciones no sustituye la política de promoción del paquete editorial. El proceso de promoción sigue exigiendo sus recibos, firmas por paquete, número mínimo de revisores, revisión de GitHub y controles de progreso. La app lectora no firma, no contiene claves privadas y no escribe conocimiento de producción.

## Límites y caducidad

- El presentador se invalida cuando el almacén persiste una revisión distinta.
- Se invalida cuando cambia el fingerprint del bootstrap.
- Se invalida al expirar el bootstrap o el trust registry.
- El host debe cargar la revisión más reciente disponible y reconstruir el presentador tras cualquier rotación o revocación.
- La frescura del registro depende de que el host actualice su snapshot; el núcleo no puede descubrir por sí solo una revocación que todavía no se haya publicado o persistido.

## Spoilers y privacidad

La firma autentica metadatos y fingerprints, no añade conocimiento narrativo. Cada evidencia continúa sometida al desbloqueo N+1 de su obra. No se incorporan EPUBs, XHTML, pasajes ni texto protegido a esta capa.
