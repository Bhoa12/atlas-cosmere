# Hoid IA — Run 364: regresiones de la frontera de acceso a fuentes

## Objetivo

Endurecer la frontera local creada en Run 363 sin introducir una implementación
ficticia del lector de EPUB ni afirmar que los archivos privados están montados.

## Cambios

- El helper de pruebas permite observar la señal cooperativa de cancelación.
- Se rechazan respuestas del puerto que añadan bytes, texto extraído o rutas.
- Las respuestas inválidas no llegan a la autoridad de promoción.
- Las inspecciones que superan el límite temporal abortan la señal y bloquean
  la delegación al host.
- Se documenta que la bibliografía y los digests registrados no demuestran
  disponibilidad física de los EPUB.

## Límites

Las pruebas usan respuestas sintéticas. No se han leído EPUB, XHTML ni
pasajes en esta ejecución. El host de despliegue debe implementar el lector
privado local; si no está disponible, la operación permanece bloqueada.

La promoción sigue siendo no automática: `promotionAllowed` y
`productionWritePerformed` permanecen en `false`.
