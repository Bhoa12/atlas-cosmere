# Hoid IA: contrato de solicitud y presupuesto de conocimiento

## Objetivo

Cada solicitud debe fijar un límite explícito de conocimiento antes de consultar a un proveedor. El límite depende del progreso del lector por obra y capítulo y no puede ampliarse durante la ejecución.

## Contrato conceptual

```ts
type CanonicalWorkId = string;
type EvidenceId = string;

interface ReadingPosition {
  workId: CanonicalWorkId;
  chapter: number;
}

interface KnowledgeBudget {
  snapshotId: string;
  positions: readonly ReadingPosition[];
  evidenceIds: readonly EvidenceId[];
}

interface HoidRequest {
  question: string;
  budget: KnowledgeBudget;
}
```

### Invariantes

1. `snapshotId` identifica una única instantánea validada.
2. Cada `workId` debe existir en el catálogo canónico.
3. Cada capítulo debe estar dentro de la estructura de lectura conocida para esa obra.
4. `evidenceIds` solo puede contener registros editoriales autorizados por las posiciones de la instantánea.
5. El proveedor recibe un contexto derivado del presupuesto, nunca el catálogo completo ni el repositorio editorial completo.
6. Una salida del proveedor no añade evidencia: toda afirmación debe poder enlazarse con un `EvidenceId` ya presente en el presupuesto.
7. Si una obra, capítulo o evidencia no puede validarse, la solicitud falla de forma cerrada o produce una abstención segura.

## Adaptadores de proveedor

La interfaz del proveedor debe depender del presupuesto ya calculado:

```ts
interface HoidProvider {
  answer(input: {
    question: string;
    context: readonly { evidenceId: EvidenceId; summary: string }[];
  }): Promise<{
    claims: readonly { text: string; evidenceIds: readonly EvidenceId[] }[];
  }>;
}
```

El proveedor no recibe progreso mutable ni permisos para resolver títulos ambiguos. Un adaptador puede transformar este contrato para un proveedor concreto, pero no puede relajar los invariantes del núcleo.

## Recomendaciones

Las recomendaciones no deben usar conocimiento narrativo futuro como argumento. Su entrada debe limitarse a:

- progreso validado;
- metadatos de obras;
- preferencias explícitas del lector;
- reglas editoriales independientes de revelaciones narrativas.

Si la recomendación necesita una premisa narrativa no autorizada, debe omitirse esa premisa o abstenerse.

## Bibliografía y derechos

El catálogo puede registrar las obras verificadas aportadas por el usuario, incluidas las novelas de Mistborn, Elantris, El aliento de los dioses, Arena blanca, las novelas secretas indicadas, Arcanum ilimitado y el conjunto privado de Roshar con sus novelas principales y novelas cortas.

Los EPUB privados no deben copiarse ni subirse al repositorio. Los registros editoriales deben contener metadatos, posiciones de lectura y resúmenes originales respaldados. Cuando un pasaje no esté accesible, el sistema debe representar esa ausencia como incertidumbre y nunca inventar que ha sido consultado.

## Pruebas mínimas

- El mismo presupuesto produce el mismo conjunto de evidencias autorizadas.
- Cambiar el progreso original después de crear la instantánea no modifica el presupuesto.
- Una evidencia de un capítulo posterior queda fuera.
- Una evidencia de otra obra queda fuera salvo que esa obra tenga una posición autorizada propia.
- Un proveedor que devuelve una afirmación sin evidencia produce `blocked` o `limited`.
- Un fallo de proveedor no provoca una ampliación del presupuesto.
