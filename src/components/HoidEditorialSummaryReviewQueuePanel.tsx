import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { HOID_EDITORIAL_DRAFTS } from "../hoid/editorialDrafts";
import {
  projectHoidEditorialSummaryReviewQueue,
  type HoidEditorialSummaryReviewQueueItem,
} from "../hoid/editorialSummaryReviewQueue";

const EMPTY_RECEIPTS: readonly unknown[] = Object.freeze([]);

function statusLabel(status: HoidEditorialSummaryReviewQueueItem["status"]): string {
  switch (status) {
    case "pending-review": return "Pendiente de revisión";
    case "approved-awaiting-source-promotion": return "Aprobación local · pendiente de promoción protegida";
    case "revision-required": return "Requiere revisión";
    case "rejected": return "Rechazado en revisión local";
  }
}

export const HoidEditorialSummaryReviewQueuePanel: React.FC<{
  progressSnapshot: unknown;
  selectedBookId?: string | null;
  receipts?: unknown;
  receiptsStatus?: "loading" | "ready" | "unavailable";
}> = ({
  progressSnapshot,
  selectedBookId = null,
  receipts = EMPTY_RECEIPTS,
  receiptsStatus = "unavailable",
}) => {
  const [expanded, setExpanded] = useState(false);

  if (receiptsStatus !== "ready") {
    return (
      <View style={styles.panel}>
        <Text style={styles.heading}>REVISIÓN EDITORIAL · PROGRESO PROTEGIDO</Text>
        <Text style={styles.note}>
          {receiptsStatus === "loading"
            ? "Cargando el registro local de revisiones. La cola permanecerá oculta hasta validar su integridad."
            : "El registro local de revisiones no está disponible o no supera la validación. La cola se oculta para no confundir revisiones existentes con borradores pendientes."}
        </Text>
      </View>
    );
  }
  const result = useMemo(
    () => projectHoidEditorialSummaryReviewQueue(
      HOID_EDITORIAL_DRAFTS,
      receipts,
      progressSnapshot,
    ),
    [progressSnapshot, receipts],
  );

  if (result.status === "unavailable") {
    return (
      <View style={styles.panel}>
        <Text style={styles.heading}>REVISIÓN EDITORIAL · PROGRESO PROTEGIDO</Text>
        <Text style={styles.note}>
          No puedo verificar el progreso actual. La cola se oculta para evitar mostrar referencias de capítulos que quizá todavía no has completado.
        </Text>
      </View>
    );
  }

  if (result.status === "invalid") {
    return (
      <View style={styles.panel}>
        <Text style={styles.heading}>REVISIÓN EDITORIAL · PROGRESO PROTEGIDO</Text>
        <Text style={styles.warning}>
          Los registros de revisión no superan la validación. No se mostrarán estados editoriales aproximados.
        </Text>
      </View>
    );
  }

  const items = result.queue.items.filter(item =>
    selectedBookId === null || item.workId === selectedBookId,
  );
  const pendingCount = items.filter(item => item.status === "pending-review").length;
  const approvedCount = items.filter(
    item => item.status === "approved-awaiting-source-promotion",
  ).length;
  const displayedItems = expanded ? items : items.slice(0, 8);

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>REVISIÓN EDITORIAL · PROGRESO PROTEGIDO</Text>
      <Text style={styles.summary}>
        {items.length} referencias editoriales dentro de capítulos ya completados · {pendingCount} pendientes de revisión · {approvedCount} con aprobación local pendiente de promoción protegida.
      </Text>
      {items.length === 0 ? (
        <Text style={styles.note}>
          No hay referencias de revisión disponibles dentro del progreso completado de las obras activas.
        </Text>
      ) : (
        <>
          <View style={styles.list}>
            {displayedItems.map(item => (
              <View key={item.draftId} style={styles.item}>
                <Text style={styles.itemTitle}>
                  {item.title} · capítulo {item.chapterNumber}
                </Text>
                <Text style={styles.itemStatus}>{statusLabel(item.status)}</Text>
              </View>
            ))}
          </View>
          {items.length > 8 ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={expanded ? "Ocultar referencias editoriales" : "Mostrar todas las referencias editoriales"}
              onPress={() => setExpanded(value => !value)}
              style={styles.toggle}
            >
              <Text style={styles.toggleText}>
                {expanded ? "Mostrar menos" : "Mostrar las " + items.length + " referencias"}
              </Text>
            </TouchableOpacity>
          ) : null}
        </>
      )}
      <Text style={styles.disclaimer}>
        La cola no muestra resúmenes ni texto EPUB. Solo incluye capítulos completados según el cursor validado; no informa de borradores futuros. Una aprobación local no autentica al revisor ni autoriza respuestas, producción o spoilers.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    padding: 12,
    backgroundColor: "#111827",
    borderBottomWidth: 1,
    borderColor: "#334155",
    gap: 7,
  },
  heading: {
    color: "#cbd5e1",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  summary: {
    color: "#f8fafc",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  note: {
    color: "#94a3b8",
    fontSize: 11,
    lineHeight: 16,
  },
  warning: {
    color: "#fbbf24",
    fontSize: 11,
    lineHeight: 16,
  },
  list: {
    gap: 6,
  },
  item: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#263449",
    gap: 2,
  },
  itemTitle: {
    color: "#e2e8f0",
    fontSize: 11,
    fontWeight: "800",
  },
  itemStatus: {
    color: "#a5b4fc",
    fontSize: 10,
    lineHeight: 15,
  },
  toggle: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#475569",
  },
  toggleText: {
    color: "#c7d2fe",
    fontSize: 11,
    fontWeight: "700",
  },
  disclaimer: {
    color: "#64748b",
    fontSize: 10,
    lineHeight: 15,
  },
});
