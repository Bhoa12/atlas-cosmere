# Hoid — testigo remoto firmado para la revisión monotónica de confianza

## Alcance

Run 159 añade un adaptador cliente, independiente del proveedor, que implementa `HoidTrustRegistryRevisionStorePort` sobre un servicio remoto de testigo monotónico. Cada lectura y cada compare-and-set necesita un recibo Ed25519 firmado por una clave pública del testigo provisionada fuera de banda.

Este cambio **no implementa ni despliega el servicio remoto**. Define el protocolo que deberá implementar un servicio de confianza y un transporte autenticado. No declara que exista ya un ancla remota de producción.

## Contratos

- `HoidTrustRevisionWitnessTransportPort`: transporte inyectado para lectura y compare-and-set.
- `HoidTrustRevisionWitnessNoncePort`: fuente inyectada de nonces de 32 bytes.
- `HoidTrustRevisionWitnessClockPort`: reloj ISO-8601 UTC inyectado.
- `HoidTrustRevisionWitnessConfiguration`: identidad, clave pública y dominio del testigo fijados por el host.
- `HoidTrustRevisionWitnessReceipt`: respuesta firmada por el testigo.
- `createHoidRemoteTrustRegistryRevisionStorePort()`: adaptador compatible con el contrato de almacenamiento monotónico existente.

El adaptador no contiene URLs, SDK de red, almacenamiento, secretos ni dependencias de un proveedor concreto.

## Protocolo de recibos

El servicio debe devolver un objeto exacto (sin campos adicionales) que incluya:

- versión de esquema;
- ID del testigo y de la clave;
- dominio de confianza;
- operación;
- nonce de la solicitud;
- revisión esperada y revisión objetivo (nulas solo para lectura);
- resultado `read`, `advanced`, `already-applied` o `conflict`;
- revisión observada;
- fechas de emisión y caducidad;
- firma Ed25519 hexadecimal en minúsculas.

La firma cubre el mensaje JSON canónico producido por `buildHoidTrustRevisionWitnessReceiptSigningMessage()`, con el dominio:

`hoid-trust-revision-witness-receipt-ed25519-v1`

El mensaje incluye el nonce de 256 bits, el testigo, el dominio, la operación, las revisiones, el resultado y las fechas. Un recibo de otra solicitud no puede reutilizarse porque el nonce no coincide.

## Semántica de compare-and-set

El servicio remoto debe ofrecer una operación atómica, linealizable y durable por `trustDomainId`:

- `advanced`: el valor durable pasó exactamente de `expectedRevision` a `nextRevision`; el adaptador devuelve `true`.
- `already-applied`: el valor durable ya es exactamente `nextRevision`; permite reintentos idempotentes y devuelve `true`.
- `conflict`: el testigo observa una revisión superior a la esperada y distinta del objetivo; devuelve `false` para que el coordinador vuelva a leer.
- Cualquier revisión inferior, resultado incoherente o respuesta sin firma válida provoca error y bloqueo.

El servidor nunca puede reducir la revisión. Debe proteger su propia base de datos y su clave de firma contra rollback, restauraciones antiguas y compromiso operativo. La firma del recibo autentica la respuesta, pero no hace monotónico por sí sola al servidor.

## Frescura y límites

- Nonce: exactamente 32 bytes, hexadecimal minúscula.
- No se aceptan nonces repetidos dentro de la vida de una instancia del adaptador.
- Presupuesto local máximo: 4.096 nonces por instancia.
- Firma: exactamente 64 bytes.
- Clave pública: exactamente 32 bytes.
- Vida máxima del recibo: 60 segundos.
- Desfase futuro máximo de emisión: 30 segundos.
- El reloj debe ser una fuente fiable del host.
- Fallos de red, reloj, nonce, parseo o firma se propagan como error; el coordinador superior los convierte en bloqueo cerrado.

El host debe proporcionar nonces mediante un CSPRNG del sistema operativo. `Math.random` no es válido. No se incluye un generador de nonces en este adaptador porque React Native/Hermes y los distintos hosts deben seleccionar explícitamente una fuente segura.

## Provisionamiento y transporte

La clave pública del testigo debe estar fijada por el host fuera de banda, junto con el `trustDomainId`. Nunca debe recibirse desde la respuesta del propio testigo, el usuario, el proveedor lingüístico o el registro de revisores que se está verificando.

El transporte debe:
- autenticar el servicio y proteger la conexión (por ejemplo, TLS con validación normal del certificado);
- autenticar al cliente/instalación mediante un mecanismo del host;
- no registrar nonces, credenciales ni configuración privada;
- imponer autorización por dominio;
- aplicar rate limits y protección contra abuso;
- devolver recibos firmados incluso para conflictos;
- preservar la atomicidad y durabilidad de compare-and-set.

La implementación concreta del servidor, el transporte HTTP, la autenticación de cliente, la rotación de la clave del testigo y su monitorización quedan fuera de este PR.

## Relación con el almacén local

El adaptador implementa el port existente y puede inyectarse en `authorizeHoidSignedEditorialBundlePromotionWithRevisionStore()` o en la composición del host. El coordinador sigue siendo responsable de verificar la firma raíz del registro de revisores y de avanzar la revisión. El testigo remoto añade una autoridad independiente para recordar el máximo aceptado.

No debe usarse una copia local restaurable como fallback cuando el testigo no está disponible. Sin respuesta firmada y fresca, la operación falla cerrada.

## Pruebas

`remoteTrustRevisionWitness.test.ts` utiliza Noble Ed25519 con una clave determinista exclusiva de pruebas y cubre:

- lectura firmada y nonce vinculado;
- compare-and-set exitoso;
- conflicto y relectura;
- reintento idempotente;
- firma de clave no fijada;
- replay de nonce;
- recibos caducados o con vigencia excesiva;
- retroceso de revisión;
- resultado CAS incoherente;
- nonce inválido o repetido;
- cruce de dominios;
- getters en respuestas hostiles;
- mensajes de firma no canónicos;
- indisponibilidad del transporte.

Las claves y semillas de prueba no son credenciales de producción.

## Privacidad y spoilers

El testigo solo recibe identificadores de dominio y números de revisión. No recibe EPUB, XHTML, texto de capítulos, progreso narrativo detallado, nombres de personajes, afirmaciones ni contenido protegido.

Este protocolo no concede acceso a libros ni modifica umbrales de lectura. La autorización por obra y capítulo, las reglas AND entre libros y los filtros de spoilers permanecen independientes. No se cambia ningún registro de conocimiento de producción ni recibo de activación.
