import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { HOID_SOURCE_BIBLIOGRAPHY } from "../hoid/bibliography";
import type { HoidEditorialSourceDocumentAccessPort } from "../hoid/editorialClaimPromotionPreflight";
import {
  auditHoidEpubEditorialSourceCoverage,
  type HoidEpubEditorialSourceCoverageAuditProgress,
  type HoidEpubEditorialSourceCoverageAuditResult,
} from "../hoid/epubEditorialSourceCoverageAudit";

type AuditView =
  | Readonly<{ status: "idle" }>
  | Readonly<{ status: "running"; progress: HoidEpubEditorialSourceCoverageAuditProgress }>
  | Readonly<{ status: "completed"; result: Extract<HoidEpubEditorialSourceCoverageAuditResult, { status: "completed" }> }>
  | Readonly<{ status: "unavailable"; reason: string }>;

export const HoidEpubEditorialSourceAccessPanel: React.FC<{
  port: HoidEditorialSourceDocumentAccessPort | null;
  workId: string | null;
}> = ({ port, workId }) => {
  const [view, setView] = useState<AuditView>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const workTitle = HOID_SOURCE_BIBLIOGRAPHY.find(work => work.id === workId)?.title ?? workId;

  useEffect(() => {
    const previous = abortRef.current;
    abortRef.current = null;
    try { previous?.abort(); } catch { /* The source projection is cleared regardless. */ }
    setView({ status: "idle" });
    return () => {
      const current = abortRef.current;
      abortRef.current = null;
      try { current?.abort(); } catch { /* Ignore teardown errors. */ }
    };
  }, [port, workId]);

  const runAudit = async () => {
    if (port === null || workId === null || abortRef.current !== null) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setView({
      status: "running",
      progress: {
        workId,
        checkedChapterCount: 0,
        totalAllowlistedChapterCount: 0,
        availableChapterCount: 0,
        unavailableChapterCount: 0,
      },
    });

    try {
      const result = await auditHoidEpubEditorialSourceCoverage(
        port,
        workId,
        controller.signal,
        progress => {
          if (abortRef.current === controller && !controller.signal.aborted) {
            setView({ status: "running", progress });
          }
        },
      );
      if (abortRef.current !== controller || controller.signal.aborted) return;
      if (result.status === "completed") setView({ status: "completed", result });
      else if (result.status === "unavailable") setView({ status: "unavailable", reason: result.reason });
      else setView({ status: "idle" });
    } catch {
      if (abortRef.current === controller && !controller.signal.aborted) {
        setView({ status: "unavailable", reason: "audit-failed" });
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const cancelAudit = () => {
    const controller = abortRef.current;
    abortRef.current = null;
    try { controller?.abort(); } catch { /* The UI returns to idle either way. */ }
    setView({ status: "idle" });
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>INTEGRIDAD DE LA FUENTE EPUB ACTIVA</Text>
      {port === null || workId === null ? (
        <Text style={styles.note}>
          Selecciona y verifica una obra en el lector EPUB para habilitar la comprobación local.
        </Text>
      ) : (
        <>
          <Text style={styles.work}>{workTitle}</Text>
          <Text style={styles.note}>
            Comprueba únicamente los capítulos que ya tienen una huella SHA-256 editorial registrada. No amplía la cobertura ni consulta el progreso de lectura.
          </Text>
          {view.status === "running" ? (
            <View style={styles.progress}>
              <ActivityIndicator color="#a5b4fc" />
              <Text style={styles.note}>
                Comprobados {view.progress.checkedChapterCount} de {view.progress.totalAllowlistedChapterCount || "…"} · {view.progress.availableChapterCount} coinciden · {view.progress.unavailableChapterCount} no disponibles
              </Text>
              <TouchableOpacity accessibilityRole="button" onPress={cancelAudit} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              accessibilityRole="button"
              disabled={view.status === "unavailable" && view.reason === "invalid-port"}
              onPress={() => { void runAudit(); }}
              style={styles.button}
            >
              <Text style={styles.buttonText}>
                {view.status === "completed" ? "Volver a comprobar" : "Comprobar integridad local"}
              </Text>
            </TouchableOpacity>
          )}
          {view.status === "completed" ? (
            <Text style={styles.result}>
              {view.result.availableChapterNumbers.length} de {view.result.totalAllowlistedChapterCount} capítulos con huella registrada coinciden con la fuente seleccionada. No disponibles o distintos: {view.result.unavailableChapterNumbers.length}.
            </Text>
          ) : view.status === "unavailable" ? (
            <Text style={styles.warning}>
              {view.reason === "no-verified-chapters"
                ? "Esta obra todavía no tiene capítulos con digest editorial registrado. No se ha realizado ninguna lectura."
                : "No se ha podido completar la comprobación. La fuente no se considerará verificada."}
            </Text>
          ) : null}
        </>
      )}
      <Text style={styles.privacy}>
        La auditoría devuelve solo números de capítulo y estados de coincidencia. No muestra ni guarda texto, no envía contenido a proveedores y no aprueba resúmenes ni autoriza spoilers.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    padding: 12,
    backgroundColor: "#0f172a",
    borderBottomWidth: 1,
    borderColor: "#334155",
    gap: 7,
  },
  heading: { color: "#cbd5e1", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  work: { color: "#f8fafc", fontSize: 13, fontWeight: "800" },
  note: { color: "#94a3b8", fontSize: 11, lineHeight: 16 },
  progress: { gap: 7, alignItems: "flex-start" },
  button: { alignSelf: "flex-start", backgroundColor: "#3730a3", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 9 },
  buttonText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  secondaryButton: { borderWidth: 1, borderColor: "#475569", paddingHorizontal: 11, paddingVertical: 7, borderRadius: 8 },
  secondaryButtonText: { color: "#cbd5e1", fontSize: 11, fontWeight: "700" },
  result: { color: "#a7f3d0", fontSize: 11, lineHeight: 16 },
  warning: { color: "#fbbf24", fontSize: 11, lineHeight: 16 },
  privacy: { color: "#64748b", fontSize: 10, lineHeight: 15 },
});
