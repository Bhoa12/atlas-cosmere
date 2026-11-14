# Integridad de la respuesta

La verificación de referencias de evidencia protege las afirmaciones declaradas por un proveedor, pero una respuesta libre puede contener frases adicionales que nunca fueron declaradas como afirmaciones.

`responseIntegrity.ts` cierra esa brecha.

## Regla

Una respuesta narrativa solo supera la puerta cuando:

1. no existe ninguna afirmación rechazada;
2. existe al menos una afirmación aceptada;
3. el texto visible de la respuesta es exactamente la composición ordenada de los textos de esas afirmaciones, ignorando únicamente diferencias de espacio.

Cualquier detalle adicional, conclusión no declarada o frase inferida provoca un rechazo completo.

Esta política es deliberadamente estricta. Las capas de presentación pueden añadir elementos no narrativos fuera de la respuesta del proveedor, pero el proveedor no obtiene una vía para introducir conocimiento futuro como prosa sin respaldo.

La capa no almacena ni reproduce texto de las fuentes privadas. Opera sobre texto generado para la respuesta y sobre el resultado de la verificación de evidencia.
