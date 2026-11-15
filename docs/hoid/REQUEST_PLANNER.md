# Planificación de solicitudes de Hoid IA

`requestPlanner.ts` es la puerta de entrada entre una consulta del lector y las capas posteriores de recuperación y generación.

## Regla principal

Una solicitud narrativa necesita una obra explícita y un alcance que `resolveQueryScope` haya autorizado con el progreso declarado. Una pregunta sin obra **no recibe acceso implícito** a capítulos de otras obras.

El planificador no lee EPUBs, no contiene texto protegido y no decide hechos narrativos. Solo transporta:

- la pregunta ya normalizada por el contrato de alcance;
- la obra autorizada;
- el capítulo máximo autorizado;
- una instantánea inmutable del progreso.

Las capas posteriores deben seguir exigiendo evidencia con procedencia y resúmenes originales autorizados. Si no existe evidencia accesible, deben abstenerse de forma neutral.
