# Hoid IA — composición de producción v3

## Objetivo

Conectar, en un único punto de composición, los componentes ya verificados de:

1. selección exact-unit con transporte neutral;
2. host de respuestas autenticadas por firmas editoriales;
3. gateway conversacional multi-turno v3;
4. coordinador de progreso durable e invalidaciones.

El módulo no elige un proveedor ni contiene credenciales. El transporte se inyecta como función y se limita al contrato de selección exact-unit.

## Construcción

`createHoidTrustedConversationComposition(config)` valida una estructura cerrada sin evaluar getters. Construye el adaptador mediante `createHoidExactUnitSelectionAdapter`, lo inyecta como selector del `HoidTrustedExactUnitAnswerHost` y conecta ese host al `HoidTrustedConversationGatewayV3`.

La composición administra sesiones identificadas, rechaza IDs duplicados, limita las sesiones activas a 64, permite cerrar sesiones de forma independiente y dispone todas las sesiones y presentaciones al destruir el host. Captura los métodos de los puertos de confianza en wrappers inmutables y copia la clave raíz pública y el contexto de revisión para impedir que una sustitución posterior de propiedades cambie silenciosamente las implementaciones fijadas.

## Semántica de estado

El resultado `composed` significa únicamente que el grafo de dependencias se ha construido. **No** significa que haya una autoridad editorial operativa ni que existan afirmaciones disponibles.

Cada turno vuelve a comprobar:

- el checkpoint monotónico;
- el registro de revisores y su firma raíz;
- la vigencia y revocación de las claves;
- las firmas de los paquetes editoriales;
- la integridad del paquete;
- el progreso exacto y su frescura.

Si falta cualquiera de esas condiciones, el host se abstiene. El adaptador de proveedor no se invoca cuando la confianza editorial no está provisionada.

## Contrato de egress

El proveedor solo recibe el snapshot exact-unit v2/v3 generado por el runtime. No recibe el progreso, los ordinales, los IDs de unidad, las referencias exactas, los localizadores EPUB, el registro de confianza, las claves ni la prosa de respuestas anteriores.

El resultado del transporte sigue siendo `unknown`; nunca concede autorización. El runtime valida el fingerprint y los IDs seleccionados contra los candidatos locales.

## Responsabilidades del host de aplicación

La aplicación debe suministrar implementaciones revisadas de:

- `HoidUnitProgressCoordinator` y su almacenamiento durable;
- invalidaciones de progreso entre instancias;
- fuente del paquete editorial firmado;
- fuente del registro de confianza;
- checkpoint anti-rollback atómico;
- reloj controlado por el host;
- clave raíz pública fijada fuera de banda;
- verificador Ed25519.

No se deben provisionar claves raíz, claves privadas de revisores ni secretos mediante React, el proveedor o un archivo de configuración público.

## Estado de integración

Esta iteración crea y prueba la composición, pero no la conecta todavía a `App.tsx` ni a `HoidScreen`. La aplicación actual sigue pasando `trustedAnswerPort={null}`, por lo que la respuesta narrativa permanece desactivada. No se activa el registro editorial, que sigue vacío hasta que haya resúmenes originales y evidencias exactas revisados y firmados.

La integración de interfaz requiere primero los adaptadores nativos de confianza y una provisión editorial válida. No se debe sustituir esta abstención por el `HoidService` heredado.

## Privacidad y bibliografía

La bibliografía privada se conserva como catálogo de metadatos. Esta composición no importa EPUBs, no extrae cuerpos XHTML y no incorpora texto protegido. La inspección de una fuente debe permanecer en el pipeline local de estructura/edición y producir únicamente metadatos y resúmenes originales con trazabilidad.


## Verificación de metadatos de EPUB privados

En esta iteración se localizaron y abrieron únicamente los contenedores ZIP, `META-INF/container.xml`, el OPF y el documento de navegación (nav/NCX). No se leyeron cuerpos XHTML de capítulos, secciones narrativas ni pasajes.

Los SHA-256 de navegación coinciden exactamente con los fingerprints ya registrados en `editionStructure.ts`:

| Fuente | SHA-256 de navegación | Elementos OPF | Elementos spine |
|---|---|---:|---:|
| `cosmere.epub` | `85c53b4a8a24bffdd1c2cbba99bcd5da47d47b78589d784047e0fcb9cfab7aee` | 3.285 | 1.626 |
| EPUB recopilatorio de Roshar | `08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025` | 1.687 | 849 |
| `Danzante del Filo` | `5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517` | 46 | 30 |
| `Esquirla del amanecer` | `8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075` | 47 | 31 |

### Observaciones estructurales

- `cosmere.epub` presenta 15 entradas de primer nivel en su TOC; la entrada de Arena blanca agrupa los volúmenes 1–3, por lo que corresponde a 17 obras del catálogo Cosmere.
- El TOC de Elantris contiene etiquetas numéricas duplicadas 48, 51 y 57. Se conserva el tratamiento ambiguo existente; esta inspección no amplía el prefijo de progreso numérico.
- Arena blanca continúa requiriendo segmentación por volumen. Arcanum ilimitado se mantiene como colección de secciones, no como una secuencia numérica única.
- Los cuatro OPF resuelven todas las referencias `itemref` del spine. En `cosmere.epub`, los 986 enlaces de navegación apuntan a miembros existentes del ZIP.
- La inspección de Esquirla del amanecer confirma el fingerprint NCX registrado; no se deduce un recuento numérico a partir de etiquetas romanas.

Esta verificación acredita identidad y estructura de edición, no contenido narrativo ni aprobación editorial. Los EPUB permanecen fuera del repositorio; no se subieron, transformaron ni incorporaron cuerpos de capítulos.
