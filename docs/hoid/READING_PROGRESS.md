# Contrato de progreso de lectura

Hoid IA trata el progreso del lector como un límite de seguridad, no como una
sugerencia. Cada frontera debe indicar explícitamente una obra conocida y un
capítulo positivo.

## Invariantes

- La pregunta del usuario nunca concede progreso implícito.
- El catálogo de fuentes solo valida identificadores; no aporta conocimiento
  narrativo.
- Una evidencia solo está dentro del progreso cuando pertenece a la misma obra
  y su capítulo es menor o igual al capítulo declarado.
- Obras desconocidas, capítulos no enteros, cero y valores negativos se
  rechazan con fallo cerrado.

Este contrato usa únicamente identificadores y números de capítulo. No almacena
ni reproduce texto protegido de los EPUB.
