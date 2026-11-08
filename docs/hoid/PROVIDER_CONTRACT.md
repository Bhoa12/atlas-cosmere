# Contrato de proveedor de Hoid IA

## Propósito

El núcleo de Hoid no depende de un SDK, modelo o servicio concreto. Cualquier integración de generación debe implementarse detrás de un adaptador que respete este contrato conceptual.

## Entrada autorizada

El proveedor recibe únicamente una instantánea creada por Hoid después de completar las fronteras locales de seguridad:

- identificador de solicitud;
- pregunta validada;
- contexto narrativo ya autorizado por obra y capítulo;
- progreso necesario para interpretar ese contexto;
- instrucciones de formato que no amplían el conocimiento autorizado.

La entrada debe tratarse como una instantánea. El adaptador no puede asumir que el estado mutable de lectura seguirá existiendo ni conservar referencias al estado de la aplicación.

## Salida

La salida del proveedor es no confiable. Antes de mostrarse debe:

1. cumplir el contrato de respuesta esperado;
2. superar la validación runtime y la normalización canónica de controles invisibles y Unicode antes de cualquier análisis de spoilers;
3. pasar el filtro anti-spoilers;
4. respetar el catálogo y los límites de obra y capítulo;
5. degradarse o rechazarse ante cualquier ambigüedad.

Una respuesta del proveedor nunca constituye autorización para revelar conocimiento.

## Errores y límites temporales

Los adaptadores deben informar de errores y respetar un límite temporal configurado por la capa de aplicación. Un timeout, una respuesta incompleta o un formato desconocido no debe producir una respuesta parcial que pueda contener información no revisada.

## Recomendaciones

Las recomendaciones generadas por un proveedor se consideran contenido narrativo a efectos de seguridad. Deben atravesar las mismas validaciones que una explicación y no pueden insinuar revelaciones posteriores.

## Privacidad y fuentes

El adaptador solo recibe el contexto mínimo autorizado para la solicitud. No debe recibir texto íntegro protegido procedente de las fuentes privadas del usuario. Las entradas del catálogo se basan en metadatos, estructura de lectura y resúmenes originales respaldados.

Si el núcleo no dispone de un hecho verificable, debe expresarlo como una limitación antes de solicitar o presentar una afirmación inventada.

## Criterio de sustitución

Debe ser posible sustituir un proveedor remoto por uno local, simulado o desactivado sin modificar las reglas de progreso, autorización narrativa o filtrado anti-spoilers del núcleo de Hoid.
