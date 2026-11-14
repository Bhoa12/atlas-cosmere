# Decisión final de respuesta

Esta capa cierra la frontera entre un proveedor desacoplado y el lector.

## Regla principal

Validar afirmaciones individualmente no demuestra que el texto completo de la respuesta sea seguro. Un proveedor podría usar conocimiento no autorizado para redactar una conclusión y devolver además referencias inválidas.

Por eso, si **cualquier** afirmación narrativa falla la frontera de conocimiento, Hoid IA descarta la respuesta completa y devuelve una decisión de abstención. La presentación de esa abstención corresponde a la capa neutral ya existente y no debe revelar el motivo narrativo al lector.

## Estados

- `answer`: todas las afirmaciones declaradas han superado la verificación y el texto no está vacío.
- `abstain / unverified_claim`: al menos una afirmación citó evidencia fuera de la frontera.
- `abstain / empty_answer`: el proveedor no produjo texto utilizable.

Los códigos son internos. No deben convertirse en explicaciones que indiquen la existencia de sucesos futuros, capítulos no leídos o evidencia concreta.

Esta capa no accede a EPUB privados ni a texto protegido; opera únicamente sobre contratos, identificadores y resultados de validación.
