import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { getHoidSourceCoverageDisplayProjection } from "../hoid/sourceCoverageDisplayProjection";

function navigationLabel(kind: string, status: string): string {
  if (status === "inconsistent") return "Navegación inconsistente; no se puede usar como base de progreso";
  if (kind === "requires-volume-segmentation") return "Segmentación de volúmenes pendiente";
  if (kind === "collection-sections") return "Segmentación de secciones de colección pendiente";
  if (status === "complete") return "Índice numerado y localizadores verificados";
  if (status === "partial" && kind === "ambiguous-numbered-chapters") {
    return "Prefijo de capítulos verificado; hay numeración ambigua después";
  }
  if (status === "partial") return "Índice parcialmente verificado";
  if (status === "missing") return "Sin localizadores de navegación verificados";
  if (status === "blocked") return "Navegación bloqueada hasta verificar la estructura";
  return "Navegación no disponible";
}

function manifestLabel(
  manifest: NonNullable<ReturnType<typeof getHoidSourceCoverageDisplayProjection>["selectedWork"]>["manifest"],
): string {
  if (manifest.status === "unavailable") return "Estructura de capítulos no verificada";
  return manifest.coverage === "verified-numeric-chapters"
    ? `Manifiesto numerado verificado · ${manifest.unitCount} unidades`
    : `Prefijo seguro verificado · ${manifest.unitCount} unidades antes de la numeración ambigua`;
}

function formatChapterNumbers(numbers: readonly number[]): string {
  if (numbers.length === 0) return "ninguno";
  const contiguous = numbers.every((number, index) => number === index + 1);
  if (contiguous) return numbers.length === 1 ? "capítulo 1" : `capítulos 1–${numbers[numbers.length - 1]}`;
  return numbers.map(number => String(number)).join(", ");
}

export const HoidSourceCoveragePanel: React.FC<{
  selectedBookId?: string | null;
}> = ({ selectedBookId = null }) => {
  const [expanded, setExpanded] = useState(false);
  const projection = getHoidSourceCoverageDisplayProjection(selectedBookId);

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>FUENTES Y COBERTURA</Text>
      <Text style={styles.summary}>
        {projection.catalogue.totalWorks} obras catalogadas · {projection.catalogue.cosmereWorks} del Cosmere · {projection.catalogue.rosharWorks} de Roshar.
      </Text>
      <Text style={styles.metric}>
        Navegación: {projection.navigation.worksWithVerifiedLocators} obras y {projection.navigation.totalVerifiedChapterLocators.toLocaleString("es-ES")} localizadores verificados.
      </Text>
      <Text style={styles.metric}>
        Inspección documental: {projection.chapterBodies.totalInspectedChapterDocuments} capítulos en {projection.chapterBodies.worksWithInspectedDocuments} obras.
      </Text>
      <Text style={styles.metric}>
        Editorial: {projection.editorial.stagedSummaryCount} resúmenes en borrador · {projection.editorial.pendingReviewSummaryCount} pendientes de revisión · {projection.editorial.approvedClaimCount} afirmaciones aprobadas.
      </Text>
      {projection.integrity === "inconsistent" ? (
        <Text style={styles.warning}>
          La auditoría de cobertura detecta inconsistencias. Estos datos no autorizan respuestas narrativas.
        </Text>
      ) : null}
      <Text style={styles.disclaimer}>
        El catálogo y los índices no confirman que el EPUB esté accesible ahora. Las huellas de capítulos no contienen sus textos y los borradores no son conocimiento aprobado. La autorización narrativa sigue dependiendo de evidencias editoriales verificadas.
      </Text>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={expanded ? "Ocultar detalle de cobertura de fuentes" : "Mostrar detalle de cobertura de fuentes"}
        onPress={() => setExpanded(value => !value)}
        style={styles.toggle}
      >
        <Text style={styles.toggleText}>{expanded ? "Ocultar detalle" : "Ver detalle de la obra enfocada"}</Text>
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.details}>
          {projection.selectedWorkStatus === "ready" && projection.selectedWork ? (
            <>
              <Text style={styles.workTitle}>{projection.selectedWork.title}</Text>
              <Text style={styles.detailText}>
                {navigationLabel(
                  projection.selectedWork.navigation.kind,
                  projection.selectedWork.navigation.status,
                )} · {projection.selectedWork.navigation.verifiedLocatorCount} localizadores.
              </Text>
              <Text style={styles.detailText}>{manifestLabel(projection.selectedWork.manifest)}.</Text>
              {projection.selectedWork.navigation.ambiguousChapterNumbers.length > 0 ? (
                <Text style={styles.detailText}>
                  Números ambiguos: {projection.selectedWork.navigation.ambiguousChapterNumbers.join(", ")}.
                </Text>
              ) : null}
              <Text style={styles.detailText}>
                Documentos de capítulo inspeccionados: {projection.selectedWork.inspectedChapterDocumentCount} ({formatChapterNumbers(projection.selectedWork.inspectedChapterNumbers)}).
              </Text>
              <Text style={styles.detailText}>
                Resúmenes en borrador: {projection.selectedWork.stagedSummaryCount} ({projection.selectedWork.pendingReviewSummaryCount} pendientes de revisión; {formatChapterNumbers(projection.selectedWork.stagedSummaryChapterNumbers)}).
              </Text>
              <Text style={styles.detailText}>
                Entradas de conocimiento de producción para esta obra: {projection.selectedWork.productionKnowledgeEntryCount}.
              </Text>
            </>
          ) : projection.selectedWorkStatus === "unknown-work" ? (
            <Text style={styles.detailText}>La obra solicitada no pertenece al catálogo bibliográfico validado.</Text>
          ) : (
            <Text style={styles.detailText}>Selecciona un foco de lectura para consultar la cobertura de esa obra. El resumen global ya está disponible.</Text>
          )}
          <Text style={styles.detailText}>
            Registro de producción: {projection.editorial.productionRegistryStatus === "empty" ? "vacío" : "con entradas"} · {projection.editorial.productionKnowledgeEntryCount} entradas de conocimiento · {projection.editorial.approvedClaimCount} afirmaciones aprobadas.
          </Text>
          <Text style={styles.detailText}>
            Acceso a bytes de origen: {projection.catalogue.accessStatus === "not-asserted" ? "no afirmado por este informe" : "estado no disponible"}.
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    padding: 12,
    backgroundColor: "#101827",
    borderBottomWidth: 1,
    borderColor: "#334155",
  },
  heading: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  summary: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 7,
  },
  metric: {
    color: "#cbd5e1",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  disclaimer: {
    color: "#94a3b8",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
  },
  warning: {
    color: "#fbbf24",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 7,
  },
  toggle: {
    alignSelf: "flex-start",
    marginTop: 9,
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#475569",
  },
  toggleText: {
    color: "#c7d2fe",
    fontSize: 12,
    fontWeight: "700",
  },
  details: {
    marginTop: 9,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: "#334155",
    gap: 5,
  },
  workTitle: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "800",
  },
  detailText: {
    color: "#cbd5e1",
    fontSize: 11,
    lineHeight: 16,
  },
});
