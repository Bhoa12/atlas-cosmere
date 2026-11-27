import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { HOID_EDITORIAL_DRAFTS } from "../hoid/editorialDrafts";
import type {
  HoidEditorialReviewChecklist,
} from "../hoid/editorialReviewPackets";
import {
  getHoidEditorialReviewChecklistNoteCodes,
  projectHoidEditorialReviewWorkspace,
  type HoidEditorialReviewSubmissionPort,
} from "../hoid/editorialReviewWorkflow";

const EMPTY_CHECKLIST: HoidEditorialReviewChecklist = Object.freeze({
  factualAccuracy: false,
  completeness: false,
  originality: false,
  spoilerCeiling: false,
  provenance: false,
});

const CHECKS = Object.freeze([
  { key: "factualAccuracy", label: "Exactitud factual" },
  { key: "completeness", label: "Cobertura suficiente" },
  { key: "originality", label: "Redacción original" },
  { key: "spoilerCeiling", label: "Respeta el límite de spoilers" },
  { key: "provenance", label: "Trazabilidad de la fuente" },
] as const);

type Decision = "approved" | "revision-required" | "rejected";

function statusLabel(status: string): string {
  switch (status) {
    case "pending-review": return "Pendiente de revisión";
    case "approved-awaiting-source-promotion": return "Aprobado localmente · pendiente de promoción protegida";
    case "revision-required": return "Requiere correcciones";
    case "rejected": return "Rechazado en revisión local";
    default: return "Estado no reconocido";
  }
}

export const HoidEditorialReviewWorkspacePanel: React.FC<{
  progressSnapshot: unknown;
  receipts: readonly unknown[];
  receiptsStatus: "loading" | "ready" | "unavailable";
  reviewPort: HoidEditorialReviewSubmissionPort | null;
  refreshProgress: () => Promise<unknown | null>;
}> = ({
  progressSnapshot,
  receipts,
  receiptsStatus,
  reviewPort,
  refreshProgress,
}) => {
  const [activePacketId, setActivePacketId] = useState<string | null>(null);
  const [checklists, setChecklists] = useState<Readonly<Record<string, HoidEditorialReviewChecklist>>>(
    Object.freeze({}),
  );
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const workspace = useMemo(
    () => projectHoidEditorialReviewWorkspace(
      HOID_EDITORIAL_DRAFTS,
      receipts,
      progressSnapshot,
    ),
    [receipts, progressSnapshot],
  );

  if (receiptsStatus !== "ready") {
    return (
      <View style={styles.panel}>
        <Text style={styles.heading}>ESPACIO DE REVISIÓN EDITORIAL</Text>
        <Text style={styles.note}>
          {receiptsStatus === "loading"
            ? "Validando el registro local. Los resúmenes permanecerán ocultos hasta completar la comprobación."
            : "El registro local no está disponible. No se abrirá el espacio de revisión."}
        </Text>
      </View>
    );
  }

  if (workspace.status === "unavailable") {
    return (
      <View style={styles.panel}>
        <Text style={styles.heading}>ESPACIO DE REVISIÓN EDITORIAL</Text>
        <Text style={styles.note}>
          No se puede verificar el progreso actual. Los resúmenes permanecen ocultos para evitar adelantar contenido.
        </Text>
      </View>
    );
  }

  if (workspace.status === "invalid") {
    return (
      <View style={styles.panel}>
        <Text style={styles.heading}>ESPACIO DE REVISIÓN EDITORIAL</Text>
        <Text style={styles.warning}>
          Los paquetes o recibos editoriales no superan la validación. No se mostrarán resúmenes ni decisiones aproximadas.
        </Text>
      </View>
    );
  }

  const items = workspace.items;
  const displayedItems = showAll ? items : items.slice(0, 8);

  const updateChecklist = (
    packetId: string,
    key: keyof HoidEditorialReviewChecklist,
    value: boolean,
  ) => {
    setChecklists(current => Object.freeze({
      ...current,
      [packetId]: Object.freeze({
        ...(current[packetId] ?? EMPTY_CHECKLIST),
        [key]: value,
      }),
    }));
  };

  const submitDecision = async (
    packetId: string,
    decision: Decision,
  ) => {
    if (!reviewPort || saving) return;
    const checklist = checklists[packetId] ?? EMPTY_CHECKLIST;
    const issues = getHoidEditorialReviewChecklistNoteCodes(checklist);
    if (decision === "approved" && issues.length > 0) {
      setFeedback("Para aprobar, los cinco controles deben estar marcados.");
      return;
    }
    if (decision !== "approved" && issues.length === 0) {
      setFeedback("Marca al menos un aspecto que necesite corrección.");
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const freshProgress = await refreshProgress();
      if (freshProgress === null) {
        setFeedback("No se pudo actualizar el progreso. La revisión no se ha guardado.");
        return;
      }

      const result = await reviewPort.submit({
        packetId,
        decision,
        checklist,
        noteCodes: decision === "approved"
          ? Object.freeze(["no-issues"] as const)
          : issues,
        progressSnapshot: freshProgress,
      });

      switch (result) {
        case "saved":
          setFeedback("Recibo guardado en este dispositivo. La revisión local no autentica al revisor ni publica conocimiento.");
          setActivePacketId(null);
          break;
        case "conflict":
          setFeedback("El registro cambió durante la revisión. Actualiza la pantalla antes de volver a intentarlo.");
          break;
        case "not-eligible":
          setFeedback("El progreso o la elegibilidad del capítulo ha cambiado. El resumen se cerrará.");
          setActivePacketId(null);
          break;
        case "invalid":
          setFeedback("La decisión no supera la validación editorial. No se ha guardado.");
          break;
        case "unavailable":
          setFeedback("El almacenamiento no está disponible o no ha confirmado la escritura.");
          break;
      }
    } catch {
      setFeedback("La revisión no se ha podido completar. No se ha confirmado ningún cambio.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>ESPACIO DE REVISIÓN EDITORIAL</Text>
      <Text style={styles.note}>
        Solo se muestran resúmenes originales asociados a capítulos ya completados. El texto fuente del EPUB no se carga ni se presenta aquí.
      </Text>
      <Text style={styles.summary}>
        {items.length} paquetes visibles dentro del progreso validado · {items.filter(item => item.status === "pending-review").length} pendientes de revisión.
      </Text>

      {items.length === 0 ? (
        <Text style={styles.note}>
          No hay paquetes de revisión disponibles dentro de los capítulos completados.
        </Text>
      ) : (
        <>
          <View style={styles.list}>
            {displayedItems.map(item => {
              const isActive = activePacketId === item.packetId;
              const checklist = checklists[item.packetId] ?? EMPTY_CHECKLIST;
              const allChecksPassed = Object.values(checklist).every(Boolean);
              const editable = item.status === "pending-review";
              return (
                <View key={item.packetId} style={styles.item}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isActive }}
                    accessibilityLabel={item.title + ", capítulo " + item.chapterNumber}
                    disabled={!editable || saving}
                    onPress={() => {
                      setFeedback(null);
                      setActivePacketId(isActive ? null : item.packetId);
                    }}
                    style={styles.itemHeader}
                  >
                    <View style={styles.itemHeadingGroup}>
                      <Text style={styles.itemTitle}>
                        {item.title} · capítulo {item.chapterNumber}
                      </Text>
                      <Text style={styles.itemStatus}>{statusLabel(item.status)}</Text>
                    </View>
                    <Text style={styles.expandMark}>{editable ? (isActive ? "−" : "+") : "·"}</Text>
                  </TouchableOpacity>

                  {isActive && editable ? (
                    <View style={styles.reviewBody}>
                      <Text style={styles.sectionLabel}>RESUMEN ORIGINAL DE STAGING</Text>
                      <Text selectable style={styles.summaryText}>{item.summary}</Text>
                      <Text style={styles.provenanceNote}>
                        Vinculado a una huella documental registrada. La disponibilidad actual del EPUB no se ha auditado en esta revisión.
                      </Text>
                      <Text style={styles.sectionLabel}>LISTA DE COMPROBACIÓN</Text>
                      {CHECKS.map(check => {
                        const checked = checklist[check.key];
                        return (
                          <TouchableOpacity
                            key={check.key}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked }}
                            disabled={saving}
                            onPress={() => updateChecklist(item.packetId, check.key, !checked)}
                            style={styles.checkRow}
                          >
                            <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                              <Text style={styles.checkboxMark}>{checked ? "✓" : ""}</Text>
                            </View>
                            <Text style={styles.checkLabel}>{check.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                      <View style={styles.actions}>
                        <TouchableOpacity
                          accessibilityRole="button"
                          disabled={saving || !allChecksPassed || !reviewPort}
                          onPress={() => { void submitDecision(item.packetId, "approved"); }}
                          style={[styles.actionButton, styles.approveButton, (saving || !allChecksPassed) && styles.disabledButton]}
                        >
                          <Text style={styles.actionText}>{saving ? "Guardando…" : "Aprobar localmente"}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          accessibilityRole="button"
                          disabled={saving || allChecksPassed || !reviewPort}
                          onPress={() => { void submitDecision(item.packetId, "revision-required"); }}
                          style={[styles.actionButton, styles.revisionButton, (saving || allChecksPassed) && styles.disabledButton]}
                        >
                          <Text style={styles.actionText}>Solicitar correcciones</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          accessibilityRole="button"
                          disabled={saving || allChecksPassed || !reviewPort}
                          onPress={() => { void submitDecision(item.packetId, "rejected"); }}
                          style={[styles.actionButton, styles.rejectButton, (saving || allChecksPassed) && styles.disabledButton]}
                        >
                          <Text style={styles.actionText}>Rechazar</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.disclaimer}>
                        El recibo usa la etiqueta «device-local-unverified». No acredita identidad, no permite promoción a producción y no modifica el progreso ni los permisos de spoilers.
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
          {items.length > 8 ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ expanded: showAll }}
              onPress={() => setShowAll(value => !value)}
              style={styles.toggle}
            >
              <Text style={styles.toggleText}>
                {showAll ? "Mostrar menos" : "Mostrar los " + items.length + " paquetes visibles"}
              </Text>
            </TouchableOpacity>
          ) : null}
        </>
      )}

      {feedback !== null ? (
        <Text accessibilityRole="alert" style={styles.feedback}>{feedback}</Text>
      ) : null}
      <Text style={styles.disclaimer}>
        La cola no incluye borradores futuros. La revisión local es un paso de staging: solo una autoridad editorial protegida e independiente puede promover conocimiento a producción.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#111827",
  },
  heading: {
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  note: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 18,
  },
  warning: {
    color: "#fbbf24",
    fontSize: 12,
    lineHeight: 18,
  },
  summary: {
    color: "#cbd5e1",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 8,
  },
  list: {
    gap: 7,
  },
  item: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 9,
    overflow: "hidden",
    backgroundColor: "#0f172a",
  },
  itemHeader: {
    minHeight: 56,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemHeadingGroup: {
    flex: 1,
    paddingRight: 10,
  },
  itemTitle: {
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "700",
  },
  itemStatus: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 3,
  },
  expandMark: {
    color: "#cbd5e1",
    fontSize: 20,
    fontWeight: "700",
  },
  reviewBody: {
    paddingHorizontal: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
  sectionLabel: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
    marginTop: 12,
    marginBottom: 7,
  },
  summaryText: {
    color: "#e2e8f0",
    fontSize: 13,
    lineHeight: 20,
  },
  provenanceNote: {
    color: "#94a3b8",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 7,
  },
  checkRow: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#64748b",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    borderColor: "#34d399",
    backgroundColor: "#065f46",
  },
  checkboxMark: {
    color: "#ecfdf5",
    fontSize: 13,
    fontWeight: "800",
  },
  checkLabel: {
    color: "#cbd5e1",
    fontSize: 12,
  },
  actions: {
    gap: 7,
    marginTop: 12,
  },
  actionButton: {
    minHeight: 38,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  approveButton: {
    backgroundColor: "#065f46",
  },
  revisionButton: {
    backgroundColor: "#92400e",
  },
  rejectButton: {
    backgroundColor: "#7f1d1d",
  },
  disabledButton: {
    opacity: 0.35,
  },
  actionText: {
    color: "#f8fafc",
    fontSize: 11,
    fontWeight: "700",
  },
  disclaimer: {
    color: "#64748b",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 10,
  },
  toggle: {
    alignSelf: "flex-start",
    marginTop: 9,
    paddingVertical: 6,
  },
  toggleText: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "700",
  },
  feedback: {
    color: "#fbbf24",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
  },
});
