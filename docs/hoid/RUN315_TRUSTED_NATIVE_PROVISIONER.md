# Hoid IA — Run 315: trusted native provisioner

## Objetivo

Conectar los contratos existentes de registro nativo, attestation Ed25519 y
composición editorial en un único gate de provisión. El objetivo es impedir que
el bootstrap solicite las fuentes editoriales o construya la composición antes
de verificar el proveedor nativo de almacenamiento y criptografía.

## Cambios

- createHoidTrustedNativeProvisioner() crea un provisioner con identidad de
  runtime y bindings editoriales fijados al construirlo.
- El provisioner verifica una attestation fresca con challenge de un solo uso,
  clave de proveedor obtenida de un registro firmado por raíz y revisión
  monotónica respaldada por un witness durable.
- La attestation se vincula al identificador y build de la aplicación, a la
  plataforma y a las capacidades declaradas por el proveedor nativo.
- expoProvisioner expone exactamente loadCompositionConfig(signal), compatible
  con createExpoHoidTrustedApplicationBootstrap().
- El loader editorial recibe un único conjunto de bindings: reloj, raíz
  editorial, contexto de revisión y verificador Ed25519 creado localmente.
- La composición se rechaza si intenta sustituir cualquiera de esos bindings,
  añade propiedades inesperadas, utiliza accessors o entrega un transporte
  ausente.
- Cada llamada a loadCompositionConfig obtiene una attestation nueva; no se
  cachean challenges ni verificaciones.

## Orden de confianza

1. El bootstrap valida primero el runtime SQLite y el progreso compartido.
2. El provisioner valida el AbortSignal y obtiene el reloj confiable.
3. Se emite y consume un challenge nativo de un solo uso.
4. Se carga el registro de proveedores firmado por raíz.
5. Se comprueba la revisión durable para detectar rollback.
6. Se verifica la firma Ed25519 del proveedor nativo y sus capacidades.
7. Solo después se llama al loader editorial.
8. El config devuelto debe reutilizar exactamente el reloj, raíz, contexto y
   verificador fijados por el provisioner.
9. El bootstrap y trustedConversationComposition vuelven a validar los
   contratos y el progreso antes de crear el host conversacional.

## Separación de proveedores

La attestation de este run acredita el proveedor nativo de almacenamiento y
criptografía. No acredita al proveedor de inferencia/LLM.

El transporte LLM continúa siendo una función separada y sustituible en la
composición. El modelo no recibe autoridad para desbloquear capítulos,
seleccionar fuentes, modificar el progreso ni aprobar afirmaciones editoriales.

## Garantías y límites

- No se generan ni se incorporan claves privadas, firmas, API keys, raíces
  públicas de producción, checkpoints ni paquetes editoriales.
- La raíz nativa, el identificador de aplicación/build y la raíz editorial
  deben proceder de configuración de confianza del build.
- El revision store debe ser realmente durable, atómico, linealizable y
  resistente a rollback. Un adaptador SQLite ordinario no satisface por sí solo
  esa garantía.
- Las capabilities firmadas son declaraciones del proveedor. No constituyen
  por sí mismas una prueba independiente de hardware; se requieren revisión del
  código nativo y pruebas en dispositivos Android/iOS reales.
- El módulo no lee EPUBs, XHTML ni prosa protegida y no crea afirmaciones
  narrativas.
- App.tsx sigue fail-closed hasta que la aplicación aporte puertos nativos
  reales y configuración editorial firmada. Este run no activa respuestas de
  producción.

## Pruebas

La suite cubre attestation válida, firma inválida, challenge replay, clave
revocada, witness no disponible, capacidades inseguras, build incorrecto,
cancelación antes y durante la attestation, reloj no canónico, sustitución de
raíz/verificador/reloj, propiedades extra, accessors y cancelación durante la
carga editorial.
