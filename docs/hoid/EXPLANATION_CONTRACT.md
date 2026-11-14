# Contrato de explicaciones de Hoid IA

Las explicaciones son una superficie narrativa independiente de las respuestas breves y de las recomendaciones.

## Regla principal

Cada unidad explicativa debe estar respaldada por identificadores de evidencia que ya hayan sido autorizados para la solicitud concreta. El contrato no lee EPUBs y no trata la presencia de una obra en el catálogo como evidencia.

## Modos

- `definition`: explica un concepto con el contexto autorizado.
- `recap`: resume únicamente material ya alcanzado.
- `relationship`: explica una relación solo cuando sus unidades están respaldadas.

## Fallo cerrado

La verificación es atómica. Si una sola unidad:

- está vacía;
- carece de evidencia;
- referencia evidencia desconocida o no autorizada;

se rechaza la explicación completa. No se conserva el resto del texto, porque podría haber sido redactado a partir de una conclusión contaminada por conocimiento futuro.

La capa se integra después de la admisión por progreso y antes de mostrar una explicación al lector.
