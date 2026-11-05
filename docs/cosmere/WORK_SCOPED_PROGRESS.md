# Progreso aislado por obra

El progreso de lectura se valida contra las unidades declaradas para su propia obra.

## Garantías

- Una entrada de progreso para una obra desconocida se informa como `unknown_work`.
- Una unidad completada que no pertenece a la obra se informa como `foreign_unit`.
- Los identificadores repetidos en una misma entrada se evalúan una sola vez.
- La validación no crea unidades ni intenta reconstruir estructura editorial ausente.

## Uso

Este módulo complementa el cálculo de progreso. El cálculo ignora datos ajenos para mantenerse seguro; la validación permite detectar esos datos y tratarlos como migraciones o corrupción antes de persistirlos.

Estas reglas son independientes de cualquier mundo concreto y pueden reutilizarse en Scadrial, Sel, Nalthis, Taldain, Roshar y futuras expansiones.

La validez técnica no confirma que una estructura de capítulos haya sido consultada en una fuente privada.