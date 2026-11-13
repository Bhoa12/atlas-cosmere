# Hoid IA: frontera de solicitud segura

Este módulo implementa una frontera mínima y neutral respecto al proveedor para Hoid IA.

## Invariantes

Una solicitud debe seguir esta dirección:

`progreso validado → presupuesto → contexto autorizado → proveedor → verificación`

Las etapas posteriores pueden reducir el conocimiento visible, pero nunca ampliarlo.

## Uso de fuentes privadas

Los EPUB privados se tratan como catálogo y estructura de lectura. Esta capa solo acepta:

- identificadores canónicos de obras y evidencias;
- posiciones de lectura;
- metadatos;
- resúmenes editoriales originales.

No transporta pasajes íntegros ni presupone que un pasaje ha sido consultado.

## Comportamiento ante incertidumbre

Un registro sin procedencia permitida, con posición inválida o perteneciente a una obra/capítulo fuera del progreso queda fuera del presupuesto. La ausencia de evidencia no se rellena con conocimiento externo: el orquestador debe limitar la respuesta o abstenerse.

## Contrato para proveedores

Los adaptadores de proveedor deben recibir únicamente `ContextItem[]` construidos por `buildAuthorizedContext`. Antes de una llamada, reintento o cambio de proveedor, el orquestador puede comprobar `isContextWithinBudget`.

El proveedor no decide qué evidencia queda autorizada y sus salidas no añaden evidencia implícita.

## Pruebas recomendadas

Cuando el proyecto incorpore su infraestructura de tests, cubrir como mínimo:

1. un registro de capítulo futuro no entra en el presupuesto;
2. una obra sin progreso no aporta contexto;
3. posiciones contradictorias fallan de forma cerrada;
4. contexto duplicado se deduplica;
5. modificar el array original de progreso después de crear el presupuesto no cambia la instantánea;
6. un reintento con el mismo presupuesto no puede recuperar evidencia excluida;
7. un proveedor no puede introducir un identificador de evidencia inexistente.
