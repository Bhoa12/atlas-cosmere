# Hoid IA — Run 366: auditoría local de integridad EPUB

## Objetivo

Conectar el router de acceso editorial de Run 365 con la sesión real que crea el panel de importación EPUB y ofrecer una comprobación visible de integridad, sin revelar ni persistir contenido.

## Integración

- `HoidEpubImportPanel` crea el router al disponer de una fuente seleccionada, un candidato de paquete inmutable y una obra/edición verificada.
- El router comparte el mismo predicado de vigencia que el lector local. Al liberar o sustituir la fuente, se invalida la sesión y el callback entrega `null`.
- `HoidScreen` conserva únicamente el puerto efímero y el identificador de obra; no recibe URI, rutas ni bytes.
- `HoidEpubEditorialSourceAccessPanel` permite iniciar o cancelar una auditoría de la obra activa.

## Alcance de la auditoría

La auditoría recorre exclusivamente los capítulos cuyo digest SHA-256 ya está registrado en la allowlist editorial dispersa. Para cada uno vuelve a validar:

1. Identidad de obra y edición.
2. Huella de navegación.
3. Localizador exacto del capítulo.
4. Digest esperado del documento XHTML.
5. Respuesta exacta del puerto local.

Una coincidencia acredita que el documento disponible en la sesión actual tiene los mismos bytes que el documento previamente inspeccionado. No acredita lectura humana, corrección narrativa, aprobación editorial ni autorización de spoilers.

Las obras sin digests registrados muestran un estado explícito de cobertura insuficiente; no se infiere disponibilidad a partir del índice.

## Privacidad y cancelación

- El resultado contiene solo números de capítulo, recuentos y estados.
- Las respuestas con campos extra, texto, URI o digest distinto se consideran no disponibles.
- El auditor no crea recibos, resúmenes, afirmaciones ni escrituras.
- La auditoría es secuencial y cooperativamente cancelable.
- Al cambiar de fuente, obra, edición o desmontar el componente, la petición se aborta y se descarta la proyección parcial.
- Los observadores de progreso no pueden interrumpir la inspección.

## Límites

La auditoría no sustituye el flujo de revisión histórica ni el preflight de promoción firmado. Tampoco cambia el progreso de lectura. Los digests registrados siguen siendo una allowlist sparse: el resto de capítulos continúa sin verificación editorial de cuerpo.

Las pruebas utilizan puertos sintéticos. No demuestran que los EPUB privados estén montados en CI ni inspeccionan nuevos pasajes.

## Validación

- Pruebas del auditor de cobertura local.
- Regresiones del router EPUB de Run 365.
- TypeScript estricto para el auditor, el router, el panel de importación, el panel de auditoría y HoidScreen.
