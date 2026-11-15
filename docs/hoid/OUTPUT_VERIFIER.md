# Verificación final de salida de Hoid IA

`outputVerifier` es la última frontera estructural antes de presentar una
respuesta narrativa.

## Contrato

Una respuesta solo permanece disponible cuando:

1. contiene texto no vacío;
2. declara al menos una evidencia;
3. cada identificador pertenece al conjunto de evidencia autorizado para la
   consulta.

Los identificadores se deduplican sin ampliar el conjunto autorizado.

## Fallo cerrado

Una abstención procedente de una capa anterior sigue siendo una abstención. El
verificador nunca transforma una ausencia de evidencia en conocimiento narrativo.

Del mismo modo, una respuesta con evidencia desconocida —incluida evidencia de
capítulos futuros— se bloquea por completo. Esta capa no intenta editar ni
salvar parcialmente una salida contaminada.

## Alcance

El verificador trabaja con identificadores y texto de salida; no lee EPUBs ni
extrae pasajes. La procedencia y los resúmenes originales deben haber sido
resueltos por las capas anteriores.
