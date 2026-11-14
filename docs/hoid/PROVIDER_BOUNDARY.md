# Hoid IA: frontera de proveedores

## Objetivo

Hoid IA puede utilizar distintos proveedores de modelos, búsqueda o generación, pero ningún proveedor decide qué conocimiento narrativo está autorizado para un lector.

La frontera de seguridad se resuelve **antes** de invocar al proveedor y se verifica **después** de recibir su salida.

## Contrato conceptual

Entrada al proveedor:

- pregunta del lector;
- progreso congelado para la solicitud;
- contexto mínimo ya autorizado;
- instrucciones de abstención cuando falte respaldo.

Salida del proveedor:

- borrador;
- afirmaciones separables;
- referencias a identificadores de evidencia autorizada;
- explicaciones y recomendaciones separadas de los hechos narrativos.

El proveedor no recibe permiso implícito para añadir hechos procedentes de sus conocimientos generales.

## Invariantes

1. Un proveedor no puede ampliar el presupuesto de contexto.
2. Un identificador de evidencia desconocido invalida la afirmación que lo usa.
3. Una afirmación sin respaldo autorizado no se muestra como hecho.
4. Las explicaciones deben pasar la misma frontera de conocimiento que la respuesta.
5. Las recomendaciones solo pueden justificarse mediante progreso, preferencias explícitas, metadatos no narrativos o evidencia ya autorizada.
6. Si el contexto autorizado es insuficiente, la respuesta debe limitarse o abstenerse.

## Adaptadores

Los adaptadores concretos deben depender de un contrato local de Hoid IA, nunca al revés. Cambiar de proveedor no debe modificar:

- la representación del progreso;
- la autorización por obra y capítulo;
- el catálogo de fuentes;
- la política final anti-spoilers.

Un adaptador solo transforma una solicitud autorizada en una llamada externa y devuelve un borrador para verificación.

## Privacidad y fuentes

Los EPUB privados no se envían automáticamente a ningún proveedor. El catálogo bibliográfico y la estructura de lectura pueden existir sin transferir texto protegido. Solo contexto previamente autorizado y necesario para una solicitud puede cruzar la frontera del proveedor.

Si un pasaje no está disponible en el entorno, no debe sintetizarse como evidencia ni presentarse como contenido consultado.
