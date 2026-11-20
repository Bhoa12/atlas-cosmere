# Run 179 — Integración de profundidad en el gateway, selector e interfaz

## Objetivo

Conectar los niveles `brief`, `detailed` y `comparative` definidos en Run 178 al flujo real de conversación, sin convertir la profundidad en una autorización narrativa.

## Flujo

1. `HoidScreen` mantiene una preferencia de profundidad efímera y la incluye en la solicitud del gateway.
2. `HoidConversationGateway` acepta únicamente los tres valores canónicos. Si falta el campo, usa `detailed` por compatibilidad.
3. El gateway resuelve el presupuesto inmutable correspondiente y lo transmite como `selectionBudget`; no transmite un campo libre de profundidad al selector.
4. `HoidCursorEvidenceRuntime` valida el snapshot v2 y reenvía el presupuesto cerrado.
5. `HoidEvidenceRuntime` vuelve a validar el objeto como registro de datos propio, sin getters ni propiedades adicionales, y lo limita a los máximos absolutos del runtime.
6. El selector recibe candidatos que ya superaron la autorización de progreso, más los límites de selección. No recibe texto fuente protegido ni puede elevar los límites.
7. El runtime rechaza selecciones que excedan afirmaciones, evidencias, obras, caracteres o los requisitos de procedencia cruzada.
8. `presentHoidExplanation()` vuelve a validar las citas y el progreso vivo y aplica el mismo presupuesto antes de mostrar texto.

## Presupuestos

| Nivel | Afirmaciones | Evidencias | Obras | Caracteres |
|---|---:|---:|---:|---:|
| Breve | 3 | 4 | 2 | 6.000 |
| Detallada | 8 | 12 | 4 | 18.000 |
| Comparativa | 12 | 16 | 4 | 24.000 |

El modo comparativo exige al menos dos obras y una afirmación individual con evidencias procedentes de varias obras. No basta con poner dos afirmaciones independientes de libros distintos.

## Seguridad

- El presupuesto nunca cambia `firstSafeAppearance`, `evidenceUnlock`, el manifiesto ni el cursor.
- Los candidatos siguen filtrándose antes de invocar el selector.
- El selector solo devuelve IDs; la prosa se renderiza desde afirmaciones editoriales aprobadas.
- Una respuesta excesiva se rechaza completa; no se trunca ni se reordena.
- Las rutas de relación del grafo siguen sometidas a la validación de presentación posterior.
- Un cambio de progreso durante la operación invalida toda la respuesta.
- La selección de profundidad es estado de interfaz efímero, no progreso de lectura.

## Pruebas

- El gateway usa `detailed` por defecto y rechaza niveles desconocidos antes de leer progreso.
- El gateway transmite presupuestos cerrados, no el valor libre de profundidad.
- La fachada de cursores solo reenvía el presupuesto tras validar el snapshot.
- El runtime rechaza getters, propiedades extra y límites fuera del rango absoluto.
- El runtime impone máximos de afirmaciones, evidencias, obras y caracteres.
- El modo comparativo requiere una afirmación con procedencia cruzada.
- La interfaz se somete a TypeScript estricto en el workflow de Atlas.

## Privacidad y catálogo

Esta iteración es exclusivamente arquitectónica. No abre ni inspecciona EPUBs, no altera el catálogo bibliográfico, no añade resúmenes y no incluye texto protegido.

## Aislamiento

- Base: `feat/hoid-ia-core-run178`
- Base SHA: `929c14d2f52b2fd2f575ddcb0ffd4423ad277247`
- Rama: `feat/hoid-ia-core-run179`
- PR: draft-only, sin fusión automática.
- `main`, Run 178 y las ramas/PR anteriores permanecen intactos.
