# Run 180 — Regresión de profundidad en seguimientos tipados

## Objetivo

Cerrar las dos regresiones detectadas en la validación de Run 179 sin modificar las reglas de autorización narrativa ni relajar los controles de spoilers.

## Diagnóstico

Las ejecuciones `Hoid phenomenon entity kind` y `Hoid typed entity conversation continuity` fallaban en dos aserciones de `typedConversationGateway.test.ts`.

El gateway ya transmite `selectionBudget` en las consultas de seguimiento con contexto tipado. Las expectativas de esas dos pruebas seguían usando el contrato anterior y omitían ese campo. No se observó una pérdida de validación del progreso ni una ampliación de permisos; el fallo era una expectativa de test obsoleta.

## Correcciones

- Las expectativas de los seguimientos tipados ahora incluyen el presupuesto canónico `detailed`, que es el valor predeterminado cuando la solicitud no especifica profundidad.
- Se añaden pruebas explícitas para seguimientos tipados que solicitan `brief` y `comparative`, verificando que el runtime recibe exactamente los presupuestos canónicos correspondientes.
- Se conserva la exigencia de reautorizar los IDs de entidad y enviar al runtime únicamente el ID canónico resuelto.
- No se cambia el catálogo, los umbrales `firstSafeAppearance` / `evidenceUnlock`, los manifiestos de edición ni el progreso de lectura.

## Invariantes

1. La profundidad controla únicamente el presupuesto de selección; no concede acceso narrativo.
2. El presupuesto se deriva del conjunto cerrado de niveles admitidos.
3. El seguimiento tipado vuelve a validar cada ID contra el registro local y el progreso vigente.
4. Un cambio de progreso durante la operación invalida la respuesta.
5. Ningún proveedor recibe texto fuente protegido.

## Validación pendiente

La corrección está subida a `feat/hoid-ia-core-run180`. La validación CI debe ejecutarse sobre el HEAD final de esta rama antes de declarar el arreglo verificado.

## Aislamiento

- Base: `feat/hoid-ia-core-run179`
- Base SHA: `2d248f77d77dfb4391ff93d1cbaac47d315c507d`
- Rama: `feat/hoid-ia-core-run180`
- Sin cambios en `main` ni en PR #72.
- Sin inspección ni incorporación de EPUBs en esta iteración.
