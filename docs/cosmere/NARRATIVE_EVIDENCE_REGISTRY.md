# Registro de evidencia narrativa

Esta capa registra **proveniencia mínima** para contenido narrativo que haya sido
respaldado por evidencia accesible. No almacena EPUBs, pasajes, citas ni texto
protegido.

## Estados

- `metadata`: describe únicamente evidencia estructural o bibliográfica y nunca
  autoriza revelar contenido narrativo.
- `summary`: identifica un resumen original respaldado mediante un
  `summaryId` explícito.

## Regla de seguridad

El registro es *fail-closed*. Identificadores vacíos, tipos desconocidos,
resúmenes sin identificador o duplicados invalidan el registro completo para las
consultas de autorización.

Registrar una fuente en el catálogo no crea automáticamente una entrada aquí.
Del mismo modo, una entrada `summary` es un vínculo de procedencia: no demuestra
que un EPUB privado completo haya sido leído ni permite inventar hechos.

Esta pieza es reutilizable para Scadrial, Sel, Nalthis, Taldain, Roshar y otros
mundos porque opera con identificadores estables y no contiene datos narrativos.
