# Hoid — host de confianza, Ed25519 portable y bootstrap explícito

## Alcance de Run 158

Run 158 incorpora un adaptador Ed25519 de verificación compatible con React Native/Hermes, un contrato de bootstrap de confianza provisionado fuera de banda y una prueba sintética del gate editorial completo con dos revisores y firmas criptográficas reales.

No implementa un firmante móvil, no genera claves de producción y no declara que el almacenamiento monotónico ya esté resuelto en Android o iOS.

## Verificación Ed25519 en React Native

`createHoidNobleEd25519VerificationPort()` implementa `HoidEd25519VerificationPort` mediante `@noble/curves/ed25519.js`.

- Verifica firmas Ed25519; no firma ni genera claves.
- No necesita `crypto.getRandomValues`, SecureStore ni WebCrypto.
- Codifica los mensajes como UTF-8 sin depender de `TextEncoder` en Hermes.
- Usa verificación estricta RFC 8032 (`zip215: false`).
- Rechaza claves, firmas, hexadecimal y objetos malformados; nunca ejecuta getters.
- Devuelve `false` ante cualquier excepción o fallo del adaptador.

La dependencia está fijada exactamente a `@noble/curves@2.4.0`. La documentación del proyecto Noble indica soporte para React Native y advierte que los polyfills de aleatoriedad se necesitan para operaciones que usan `getRandomValues`. Este adaptador solo verifica y no realiza esas operaciones.

La implementación es JavaScript portable ejecutable en el runtime React Native/Hermes; no es una clave hardware-backed ni un módulo criptográfico nativo. Debe medirse y probarse en builds reales Android/iOS antes de producción.

## Bootstrap de confianza fuera de banda

`HoidTrustedHostBootstrapPort` expone únicamente `readPinnedConfiguration()`. El host debe obtener la configuración de una fuente controlada por despliegue, administración del dispositivo o bootstrap remoto autenticado; nunca de texto del usuario, del proveedor lingüístico ni del registro de revisores que se intenta verificar.

La configuración contiene:

- ID de configuración y `trustDomainId` fijados por el host.
- Clave pública raíz Ed25519 fijada fuera del registro.
- Revisión mínima inicial provisionada fuera de banda.
- Lista ordenada de repositorios autorizados.
- Fechas de provisión y caducidad (máximo 90 días).

`loadHoidTrustedHostBootstrap()` valida la configuración, su alcance de repositorio y su vigencia. No escribe, no genera claves y no inicializa el almacén.

`verifyHoidTrustedHostRevisionStore()` comprueba que la revisión persistida ya existe y es igual o superior al suelo provisionado. No repara un almacén vacío ni reduce una revisión.

## Composición del host con la autoridad de promoción

`authorizeHoidTrustedHostSignedEditorialBundlePromotion()` une el bootstrap fijado por el host, la comprobación del suelo persistido y la autoridad de promoción firmada de Run 156/157. El repositorio solicitado debe coincidir con la constante de configuración del host y estar dentro del allowlist provisionado. La clave raíz y el `trustDomainId` proceden exclusivamente del bootstrap validado; no se aceptan overrides del usuario o del proveedor. El flujo avanza la revisión monotónica solo después de autenticar el registro raíz y después ejecuta el gate de firmas, GitHub y progreso. La autorización resultante sigue siendo `ready-for-maintainer-commit`; no escribe conocimiento ni fusiona el PR.

## Por qué SecureStore no es el ancla monotónica

No se añade un adaptador de `expo-secure-store` para la revisión mínima. La documentación oficial de Expo advierte que SecureStore no debe tratarse como única fuente de verdad para datos críticos; además, el comportamiento de persistencia difiere entre Android y iOS y existen escenarios de reinstalación/restauración que deben tratarse expresamente.

El host de producción debe implementar `HoidTrustRegistryRevisionStorePort` con:
- compare-and-set atómico y linealizable;
- durabilidad confirmada por lectura posterior;
- resistencia a rollback/restauración;
- política de reinstalación, cambio de dispositivo y recuperación;
- un contador monotónico hardware-backed o un ancla remota independiente, o una combinación cuyo modelo de amenaza esté documentado.

Una declaración de capacidades del adaptador no demuestra por sí sola esas propiedades. Se requieren revisión de implementación y pruebas nativas de restauración/rollback. Si no puede demostrarse la garantía, el host debe fallar cerrado.

## Dry run criptográfico con dos revisores

La regresión de `signedEditorialBundlePromotionAuthority.test.ts` construye un registro raíz firmado y firmas Ed25519 reales para todos los paquetes sintéticos de las cuatro categorías:

- resumen;
- afirmación atómica;
- identidad;
- relación.

Dos semillas privadas deterministas existen únicamente dentro del test. El gate verifica el registro raíz, cada firma de paquete, el quorum de dos revisores, el snapshot sintético de revisión protegida y la estabilidad del progreso.

El resultado esperado es `ready-for-maintainer-commit`, pero `promotionAllowed` y `productionWritePerformed` permanecen en `false`. Un solo byte de firma alterado bloquea la operación antes de consultar el puerto de control de versiones.

El dry run usa puertos sintéticos; no equivale a una llamada real a GitHub ni a una promoción de producción.

## Validación

El workflow `.github/workflows/hoid-native-ed25519-trusted-host.yml` ejecuta:
- vector RFC 8032 y casos UTF-8/malformados del adaptador Noble;
- bootstrap provisionado, caducidad, scope y revisión mínima;
- gate de bundle firmado, incluido el dry run de dos revisores;
- regresiones del almacén de revisión monotónica y del registro de confianza;
- árbol de dependencias y TypeScript estricto con resolución ESM/bundler.

## Privacidad y spoilers

No se leen ni se incorporan EPUBs en este run. No se guardan pasajes, XHTML, URIs privados, progreso, allowlists ni resúmenes nuevos. Las fixtures editoriales son sintéticas. La autenticación de revisores no concede acceso a capítulos: cada afirmación sigue sujeta a la autorización independiente por obra y capítulo.
