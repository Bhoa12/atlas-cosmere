# Hoid IA: fronteras de confianza

## Regla principal
El progreso del lector es la única autoridad para decidir qué conocimiento narrativo puede utilizar Hoid.

## Pipeline seguro
1. Normalizar progreso por obra y capítulo.
2. Recuperar únicamente entradas autorizadas por ese progreso.
3. Aplicar presupuesto de contexto y crear un snapshot independiente.
4. Enviar al proveedor solo pregunta, contexto autorizado y metadatos necesarios.
5. Validar la salida y ejecutar el filtro anti-spoilers antes de mostrarla.

## Fallo conservador
Si una obra, capítulo, entrada de conocimiento o proveedor no puede verificarse, Hoid no debe ampliar el contexto ni afirmar hechos no respaldados.

## Fuentes privadas
Los EPUB privados son fuentes de consulta. La aplicación debe almacenar metadatos, estructura de lectura y resúmenes originales; no debe copiar ni distribuir texto íntegro protegido.

## Aislamiento
Los proveedores no modifican el catálogo ni el progreso canónico. El contexto que reciben es un snapshot desacoplado y de solo lectura por contrato.
