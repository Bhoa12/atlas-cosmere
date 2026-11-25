# Hoid IA — Run 314: Expo progress runtime bridge

## Objetivo

Preparar la unión del bootstrap confiable con el progreso real de Atlas sin
crear una segunda autoridad de lectura ni simular dependencias de confianza
que todavía no están provisionadas.

## Cambios

- getExpoHoidCursorProgressRuntime() expone el par formado por el
  HoidCursorProgressStore y el HoidCursorProgressCoordinator creados
  sobre el único handle SQLite compartido.
- createExpoHoidCursorProgressCoordinator() conserva su contrato
  anterior y devuelve el coordinador del runtime compartido. CosmereContext
  sigue utilizando esta entrada de compatibilidad.
- createHoidTrustedApplicationDependencyLoader() valida contratos
  exactos, captura métodos de datos, rechaza accessors y construye wrappers
  inmutables para el store y la fuente de invalidación.
- El loader obtiene y valida primero el runtime de progreso. Solo después
  solicita la configuración de confianza y transporte al provisioner nativo.
- createExpoHoidTrustedApplicationBootstrap() reutiliza el mismo
  store y coordinador que CosmereContext, y exige un provisioner
  explícito para la configuración editorial y criptográfica.

## Orden de inicialización

1. El host solicita una sesión nueva.
2. El adaptador Expo obtiene el runtime SQLite compartido.
3. Se validan load, read, compareAndSwap y subscribe sin ejecutar
   getters.
4. Se capturan los métodos y se exponen wrappers congelados.
5. Solo entonces se solicita al provisioner la configuración de composición.
6. El bootstrap existente vuelve a validar el progreso durable y construye la
   composición provider-neutral.
7. Cada turno sigue verificando checkpoint, registro, firmas, edición y
   progreso vivo.

## Garantías y límites

- No se abre un segundo archivo SQLite ni se crea un segundo coordinador para
  Hoid.
- La invalidación se conecta al coordinador que ya recibe los commits del
  lector en CosmereContext.
- Los wrappers no permiten sustituir posteriormente los métodos capturados.
- Una señal abortada detiene la secuencia antes de solicitar configuración
  editorial o transporte.
- La configuración nativa no se inventa: el provisioner debe aportar fuentes
  firmadas, checkpoint anti-rollback durable, reloj confiable, raíz pública
  fijada, verificador Ed25519 y transporte real.
- No se incorpora una raíz pública de prueba, clave privada, API key, registro
  editorial ni paquete de afirmaciones.
- App.tsx conserva createBootstrap={null} hasta que
  exista ese provisioner verificable. La pantalla continúa fail-closed.
- El presenter editorial de recomendaciones sigue siendo una dependencia
  separada.
- Web continúa sin soporte para el almacenamiento transaccional nativo.
- No se leen, copian ni suben cuerpos EPUB, XHTML, pasajes ni prosa protegida.
  No se promueven afirmaciones narrativas nuevas.

## Pruebas

- Validación de contratos y rechazo de propiedades desconocidas.
- Rechazo de accessors sin invocarlos.
- Captura estable de métodos ante sustitución posterior.
- El provisioner no se consulta si el runtime de progreso es inválido.
- Cancelación antes de empezar y durante la adquisición del progreso.
- Validación de identificadores de sesión.
- TypeScript estricto del núcleo y del adaptador Expo.

Los fixtures de confianza son sintéticos y verifican únicamente el contrato de
composición; no constituyen una provisión criptográfica de producción.
