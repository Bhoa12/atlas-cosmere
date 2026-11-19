# Hoid — persistencia monotónica de la revisión del registro de confianza

## Objetivo

Run 157 añade una frontera de persistencia para la revisión mínima aceptada del registro de revisores. La revisión mínima evita que un registro raíz-firmado antiguo vuelva a habilitar claves que ya fueron revocadas en una revisión posterior.

La persistencia no pertenece al núcleo criptográfico. Hoid depende del contrato `HoidTrustRegistryRevisionStorePort`; el host debe proporcionar una implementación durable, resistente a rollback y con compare-and-set linealizable.

## Contrato

El port expone dos operaciones por dominio de confianza:

- `readMinimumRevision({ trustDomainId })`
- `compareAndSetMinimumRevision({ trustDomainId, expectedRevision, nextRevision })`

Un compare-and-set correcto solo puede devolver `true` cuando el valor almacenado coincide exactamente con `expectedRevision`, `nextRevision` es estrictamente mayor y el nuevo valor ya es durable. Las operaciones deben ser atómicas y linealizables dentro de cada `trustDomainId`.

El núcleo rechaza puertos con métodos ausentes, getters, valores no booleanos, revisiones inválidas y errores de almacenamiento. `trustDomainId` debe ser una constante de configuración controlada por el host y vinculada a un dominio de confianza estable (repositorio y autoridad raíz); nunca debe proceder de una petición del usuario, un proveedor lingüístico o datos del paquete. Cambiarlo requiere una migración de confianza explícita, no crear un dominio nuevo para eludir una revisión mínima.

## Bootstrap explícito

Un dominio sin revisión inicial se rechaza con `revision-store-uninitialized`.

El núcleo **no** inicializa la revisión mínima usando el registro que acaba de recibir. Hacerlo permitiría que el primer registro presentado por un atacante estableciera un punto de rollback demasiado antiguo.

La revisión inicial debe instalarse fuera de banda mediante una operación de provisioning controlada, usando una revisión conocida y aprobada por el operador. La aplicación lectora no dispone de esa operación.

## Algoritmo

1. Leer la revisión mínima persistida.
2. Verificar el registro raíz-firmado contra esa revisión.
3. Si la revisión recibida es igual, continuar sin escritura.
4. Si es mayor, ejecutar compare-and-set desde el valor leído hacia la revisión verificada.
5. Volver a leer para confirmar la persistencia durable.
6. Ante un conflicto concurrente, volver a leer y verificar otra vez.
7. Rechazar rollback, almacenamiento no durable, timeout o conflictos reiterados.
8. Delegar en la autoridad de promoción firmada usando la revisión ya persistida. La autoridad vuelve a verificar todas las firmas del paquete.

La actualización se realiza solo después de autenticar criptográficamente el registro. Una revisión nueva válida puede quedar persistida aunque la promoción editorial posterior se bloquee; esto es intencional: aceptar una política de confianza más reciente no implica aprobar conocimiento.

## Concurrencia y rollback

El compare-and-set evita que dos verificadores sobrescriban una revisión superior con otra inferior. Si otro proceso avanza el dominio mientras se verifica una revisión antigua, el siguiente ciclo vuelve a leer el valor y rechaza el registro obsoleto.

Se permiten cuatro intentos acotados. Los conflictos persistentes bloquean la operación.

## Requisitos del host

El port debe implementarse sobre almacenamiento que ofrezca:
- durabilidad confirmada;
- compare-and-set atómico;
- aislamiento por dominio de confianza;
- protección contra restauración de backups antiguos o rollback del dispositivo;
- comportamiento de fallo cerrado cuando el almacenamiento no está disponible.

Una base SQLite ordinaria o un valor de AsyncStorage por sí solos no constituyen almacenamiento resistente a rollback. Expo SecureStore tampoco debe considerarse suficiente sin una garantía explícita del mecanismo de plataforma y de su comportamiento ante restauraciones. El repositorio no incluye todavía un adaptador de producción para Keychain, Android Keystore o un servicio de confianza remoto.

## Integración

`authorizeHoidSignedEditorialBundlePromotionWithRevisionStore()`:
1. persiste la revisión mínima autenticada;
2. delega en `authorizeHoidSignedEditorialBundlePromotion()`;
3. fuerza una segunda verificación de las firmas con la revisión persistida;
4. conserva `promotionAllowed: false` y `productionWritePerformed: false`.

El wrapper no crea claves, no firma, no escribe el conocimiento editorial y no fusiona Pull Requests.

## Vinculación del commit base

Run 157 actualiza el contrato de revisión protegida a schema v2. El snapshot de GitHub debe incluir:
- `baseRef` y `baseSha`;
- `headRef` y `headSha`.

El adaptador debe obtener `baseSha` del commit real de la rama base del Pull Request. El verificador compara ambos SHA con el request esperado. Los mensajes de firma de paquetes usan el dominio v2 e incluyen `expectedBaseSha`, por lo que una firma no se puede reutilizar si cambia cualquiera de los dos extremos de la comparación.

Las respuestas antiguas de schema v1 se rechazan; no hay fallback silencioso.

## Privacidad y spoilers

El almacenamiento solo conserva una revisión numérica por dominio de confianza. No contiene EPUB, XHTML, texto de capítulos, resúmenes, pasajes ni URI privados. La revisión del registro de confianza no modifica el progreso del lector, los umbrales de desbloqueo ni la autorización de spoilers.
