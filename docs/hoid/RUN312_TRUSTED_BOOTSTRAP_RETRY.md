# Hoid Run 312 — recuperación explícita del bootstrap confiable

## Objetivo

Permitir que el host de aplicación vuelva a intentar la composición confiable cuando una dependencia transitoria (por ejemplo, la apertura de SQLite o la lectura del registro editorial) haya dejado el bootstrap bloqueado. El reintento debe ser explícito, coalescido y no puede duplicar recursos activos.

## Contrato

`HoidTrustedApplicationBootstrap.retry()` sigue estas reglas:

- **Idle:** inicia la primera inicialización.
- **Loading:** devuelve la misma promesa de la inicialización activa.
- **Blocked:** limpia únicamente la promesa ya resuelta y ejecuta un nuevo intento.
- **Ready:** devuelve el snapshot actual; no reconstruye el host ni crea otra sesión.
- **Disposed:** devuelve el estado terminal; nunca vuelve a cargar dependencias.

`initialize()` mantiene su semántica anterior: llamadas repetidas después de un fallo no reintentan por sí solas. Solo `retry()` expresa una decisión explícita del host o del usuario.

## Seguridad y concurrencia

- El nuevo intento pasa por el mismo `loadDependencies(signal)`, validación estricta de dependencias, composición exact-unit y creación de screen port.
- No se conserva ni se reutiliza una capability del intento bloqueado.
- Las llamadas simultáneas a `retry()` se unen a la misma promesa porque el nuevo intento publica `loading` y registra la promesa antes de notificar observadores.
- Un retry durante una inicialización activa no inicia otro loader.
- Un bootstrap `ready` no se reinicializa, evitando duplicar coordinadores, sesiones o suscripciones.
- `dispose()` continúa siendo terminal y aborta cualquier carga activa.
- Un error de progreso o de confianza sigue produciendo `blocked`; el reintento no relaja firmas, checkpoint, autorización ni filtros de spoilers.

## Límites

Este cambio no fabrica adaptadores nativos, claves raíz, registros editoriales, almacenamiento anti-rollback ni transporte de proveedor. Tampoco habilita respuestas narrativas por sí solo. Si las dependencias siguen ausentes o inválidas, el bootstrap permanece bloqueado.

No se leen ni se incorporan cuerpos EPUB, pasajes o prosa protegida. El cambio afecta exclusivamente al ciclo de vida de dependencias.

## Validación prevista

El workflow `Hoid trusted application bootstrap` ejecuta las pruebas de bootstrap, composición, screen port, gateway y host, además de TypeScript estricto. Las pruebas nuevas cubren retry tras fallo de configuración, retry tras indisponibilidad transitoria del ledger, coalescencia durante `loading`, y ausencia de reconstrucción en `ready`/`disposed`.
