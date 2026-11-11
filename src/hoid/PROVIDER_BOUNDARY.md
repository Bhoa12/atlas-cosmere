# Frontera de proveedores de Hoid IA

## Objetivo

Los proveedores de IA son intercambiables y no forman parte de la autoridad narrativa. La autorización de progreso, la recuperación y la prevención determinista de spoilers permanecen dentro de Hoid IA.

## Contrato mínimo que cruza la frontera

El contexto narrativo enviado a un proveedor contiene únicamente:

- `id`
- `kind`
- `summary`
- `firstSafeAppearance.bookId`
- `firstSafeAppearance.chapter`

Los `aliases` se usan solo para recuperación interna y no deben cruzar esta frontera.

El progreso enviado al proveedor se valida antes y se representa mediante posiciones canónicas de obras conocidas. Un estado ambiguo o inválido falla de forma cerrada: no se fusiona hacia un capítulo mayor.

## Propiedades del snapshot

Las solicitudes y el contexto que cruzan la frontera deben ser snapshots desacoplados del estado mutable de la aplicación. Un proveedor no recibe referencias que puedan modificar posteriormente la autorización o el contexto local.

## Dos rutas de respuesta

### Texto libre

Los proveedores tradicionales devuelven texto. Hoid IA aplica:

1. límite de tamaño;
2. guardia determinista de spoilers;
3. comprobación frente al catálogo bloqueado.

### Evidencia estructurada

Los proveedores que devuelven claims deben asociar cada afirmación con identificadores presentes en el contexto autorizado. Hoid IA valida los identificadores, aplica un presupuesto agregado a toda la respuesta y ejecuta las mismas barreras finales anti-spoilers que en la ruta de texto libre.

Ninguna forma estructurada de respuesta puede ampliar los permisos del proveedor ni eludir los límites globales.

## Fallos y tiempos de espera

La indisponibilidad, un timeout, datos con forma inválida o evidencia no autorizada no se sustituyen por conocimiento inventado. Hoid IA devuelve un resultado conservador que indica que no puede verificar una respuesta.

## Regla de evolución

Al añadir un proveedor nuevo, el adaptador debe depender de contratos de Hoid IA, no de SDKs dentro de la capa de dominio. Cualquier campo nuevo que cruce la frontera requiere:

- justificación de necesidad;
- revisión del presupuesto de contexto;
- pruebas de aislamiento e inmutabilidad;
- revisión de su impacto en spoilers y procedencia.
