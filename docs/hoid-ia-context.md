# Hoid IA: autorización de contexto

Hoid debe aplicar la protección contra spoilers **antes** de recuperar conocimiento y otra vez antes de mostrar una respuesta.

## Contrato

1. El progreso se expresa por `bookId` y capítulo.
2. El catálogo registra únicamente metadatos editoriales y resúmenes originales autorizados; no contiene texto íntegro de novelas.
3. `authorizeHoidContext` decide qué entidades pueden entrar en una recuperación futura.
4. Un proveedor nunca debe recibir contexto de una entidad bloqueada.
5. La salida del proveedor sigue pasando por el guardia determinista existente.

El catálogo está deliberadamente vacío de afirmaciones editoriales no verificadas. Las futuras entradas deben basarse en fuentes verificadas y registrar su primera aparición segura.

## Integración futura

Una integración de recuperación debe ejecutar:

`pregunta -> autorización -> recuperación sólo autorizada -> proveedor -> guardia de salida`

Si falla la autorización o no existe un proveedor configurado, el sistema debe responder de forma segura y no intentar un proveedor alternativo silencioso.
