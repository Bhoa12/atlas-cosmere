import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { createHoidExpoLocalEpubRuntime } from "../hoid/expoLocalEpubPlatform";
import { createHoidImportLifecycleGuard } from "../hoid/epubImportLifecycle";
import { getHoidSourceIngestionPlan } from "../hoid/sourceIngestionPlan";
import { inspectHoidPlannedChapterCandidate, type HoidPlannedChapterInspectionCandidate } from "../hoid/sourceIngestionExecution";
import type { HoidExpoPickedSource } from "../hoid/expoLocalEpubProvider";
import type { HoidEpubPackageInspectionCandidate } from "../hoid/epubIngestion";
import {
  createHoidEpubSourceDescriptor,
  getHoidEpubImportChoices,
  type HoidEpubImportChoice,
} from "../hoid/epubImportSelection";

const epubRuntime = createHoidExpoLocalEpubRuntime();
const importChoices = getHoidEpubImportChoices();

function sourceGroupLabel(group: HoidEpubImportChoice["sourceGroup"]): string {
  return group === "cosmere.epub" ? "Cosmere · cosmere.epub" : "Roshar · fuentes de Roshar";
}

function progressModeLabel(choice: HoidEpubImportChoice): string {
  switch (choice.progressMode) {
    case "numeric-chapters": return "Capítulos numerados";
    case "chapter-number-with-duplicate-locators": return "Numeración ambigua · progreso limitado";
    case "requires-volume-segmentation": return "Segmentación de volúmenes pendiente";
    case "collection-sections": return "Colección · secciones independientes";
    default: return "Estructura no verificada";
  }
}

function rejectionMessage(reason: string): string {
  if (reason === "edition-navigation-mismatch") {
    return "El índice del archivo no coincide con la huella de navegación de la edición seleccionada. No se ha vinculado la obra.";
  }
  if (reason === "invalid-source-descriptor") {
    return "La obra o la edición seleccionada no pertenecen al catálogo autorizado.";
  }
  if (reason === "source-changed") {
    return "El archivo ha cambiado durante la inspección. Se ha descartado el resultado.";
  }
  if (reason === "invalid-task" || reason === "manifest-mismatch") return "La tarea ya no coincide con el plan o manifiesto vigente. No se ha inspeccionado el documento.";
  if (reason === "source-candidate-mismatch" || reason === "chapter-candidate-mismatch") return "La evidencia local no coincide con la fuente o edición seleccionada. Se ha descartado el resultado.";
  return "No se ha podido verificar la estructura EPUB. El archivo permanece sin vincular y no se ha cambiado tu progreso.";
}

export const HoidEpubImportPanel: React.FC = () => {
  const [pickedSource, setPickedSource] = useState<HoidExpoPickedSource | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<HoidEpubImportChoice | null>(null);
  const [candidate, setCandidate] = useState<HoidEpubPackageInspectionCandidate | null>(null);
  const [chapterCandidate, setChapterCandidate] = useState<HoidPlannedChapterInspectionCandidate | null>(null);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    "Los EPUB se inspeccionan localmente. El nombre del archivo nunca determina la obra ni la edición.",
  );
  const sourceIdRef = useRef<string | null>(null);
  const lifecycleRef = useRef(createHoidImportLifecycleGuard());
  const plannedTask = selectedChoice === null ? null : getHoidSourceIngestionPlan().tasks.find(task => task.workId === selectedChoice.workId) ?? null;

  useEffect(() => {
    const lease = lifecycleRef.current.activate();
    return () => {
      lifecycleRef.current.deactivate(lease);
      const sourceId = sourceIdRef.current;
      sourceIdRef.current = null;
      if (sourceId !== null) void epubRuntime.provider.release(sourceId).catch(() => undefined);
    };
  }, []);

  const pickEpub = async () => {
    if (busy) return;
    const operation = lifecycleRef.current.beginOperation();
    setBusy(true);
    setMessage("Esperando la selección del archivo…");
    try {
      const result = await epubRuntime.provider.pickEpub();
      if (!lifecycleRef.current.isCurrent(operation)) {
        if (result.status === "selected") {
          await epubRuntime.provider.release(result.source.sourceId).catch(() => undefined);
        }
        return;
      }
      if (result.status === "cancelled") {
        setMessage("Selección cancelada. No se ha modificado ninguna fuente ni tu progreso.");
        return;
      }
      if (result.status === "rejected") {
        setMessage("No se ha podido aceptar el archivo. Comprueba que sea un EPUB accesible y que no supere el límite local.");
        return;
      }

      const previousSourceId = sourceIdRef.current;
      sourceIdRef.current = result.source.sourceId;
      setPickedSource(result.source);
      if (previousSourceId !== null) {
        try {
          await epubRuntime.provider.release(previousSourceId);
        } catch {
          // The newly selected source remains tracked; stale cache cleanup is best-effort.
        }
      }
      if (!lifecycleRef.current.isCurrent(operation)) return;
      setSelectedChoice(null);
      setCandidate(null);
      setChapterCandidate(null);
      setMessage("Archivo local seleccionado. Ahora debes elegir explícitamente la obra y su edición registrada.");
      setSelectionOpen(true);
    } catch {
      if (lifecycleRef.current.isCurrent(operation)) {
        setMessage("No se ha podido abrir el archivo local. No se enviará a ningún servicio externo.");
      }
    } finally {
      if (lifecycleRef.current.isCurrent(operation)) setBusy(false);
    }
  };

  const inspectSelectedWork = async (choice: HoidEpubImportChoice) => {
    const source = pickedSource;
    if (source === null || busy || choice.editionId === null) return;
    const operation = lifecycleRef.current.beginOperation();

    const descriptor = createHoidEpubSourceDescriptor(
      source.sourceId,
      choice.workId,
      choice.editionId,
    );
    if (descriptor === null) {
      setMessage("La selección de obra y edición no es válida. No se realizará la inspección.");
      return;
    }

    setSelectionOpen(false);
    setBusy(true);
    setSelectedChoice(choice);
    setCandidate(null);
    setChapterCandidate(null);
    setMessage("Verificando ZIP, paquete OPF, navegación y huella de la edición…");
    try {
      const result = await epubRuntime.ingestion.inspectPackage(descriptor);
      if (!lifecycleRef.current.isCurrent(operation)) return;
      if (result.status === "candidate") {
        setCandidate(result.candidate);
        setMessage(
          "Edición y estructura verificadas. Esto no inspecciona el contenido narrativo, no aprueba resúmenes y no desbloquea capítulos.",
        );
      } else {
        setMessage(rejectionMessage(result.reason));
      }
    } catch {
      if (lifecycleRef.current.isCurrent(operation)) {
        setMessage("La inspección ha fallado de forma segura. No se ha creado una vinculación ni se ha modificado el progreso.");
      }
    } finally {
      if (lifecycleRef.current.isCurrent(operation)) setBusy(false);
    }
  };


  const inspectNextChapter = async () => {
    const source = pickedSource;
    const choice = selectedChoice;
    const packageCandidate = candidate;
    const task = plannedTask;
    if (source === null || choice === null || packageCandidate === null || task === null || busy) return;
    const descriptor = createHoidEpubSourceDescriptor(source.sourceId, choice.workId, choice.editionId);
    if (descriptor === null) {
      setMessage("La selección local ya no coincide con el catálogo. No se inspeccionará ningún capítulo.");
      return;
    }
    const operation = lifecycleRef.current.beginOperation();
    setBusy(true);
    setChapterCandidate(null);
    setMessage(`Inspeccionando localmente el documento del capítulo ${task.chapterNumber}…`);
    try {
      const result = await inspectHoidPlannedChapterCandidate(task, descriptor, packageCandidate, epubRuntime.ingestion);
      if (!lifecycleRef.current.isCurrent(operation)) return;
      if (result.status === "candidate") {
        setChapterCandidate(result.candidate);
        setMessage(`Capítulo ${result.candidate.chapterNumber} inspeccionado localmente. Solo se conserva su huella; no se guarda texto, no se crea un resumen y no se autoriza producción.`);
      } else setMessage(rejectionMessage(result.reason));
    } catch {
      if (lifecycleRef.current.isCurrent(operation)) setMessage("La inspección del capítulo ha fallado de forma segura. No se ha creado un resumen ni se ha modificado el progreso.");
    } finally {
      if (lifecycleRef.current.isCurrent(operation)) setBusy(false);
    }
  };

  const releaseSource = async () => {
    const operation = lifecycleRef.current.beginOperation();
    const sourceId = sourceIdRef.current;
    sourceIdRef.current = null;
    setBusy(true);
    try {
      if (sourceId !== null) await epubRuntime.provider.release(sourceId);
    } catch {
      if (lifecycleRef.current.isCurrent(operation)) {
        setMessage("La fuente dejó de estar disponible; se ha liberado su referencia local.");
      }
    } finally {
      if (lifecycleRef.current.isCurrent(operation)) {
        setPickedSource(null);
        setSelectedChoice(null);
        setCandidate(null);
        setChapterCandidate(null);
        setSelectionOpen(false);
        setMessage("Fuente local liberada. No se ha guardado su URI ni su contenido.");
        setBusy(false);
      }
    }
  };

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>FUENTES EPUB LOCALES</Text>
          <Text style={styles.note}>
            Inspección en el dispositivo · sin subir libros · sin modificar el progreso
          </Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          disabled={busy}
          onPress={pickEpub}
          style={[styles.button, busy && styles.disabled]}
        >
          <Text style={styles.buttonText}>{pickedSource ? "Cambiar EPUB" : "Importar EPUB"}</Text>
        </TouchableOpacity>
      </View>

      {pickedSource !== null && (
        <View style={styles.sourceRow}>
          <Text style={styles.sourceName} numberOfLines={1}>{pickedSource.displayName}</Text>
          <Text style={styles.sourceMeta}>{(pickedSource.byteLength / (1024 * 1024)).toFixed(1)} MiB · identidad pendiente de selección</Text>
        </View>
      )}

      {busy && <ActivityIndicator color="#a5b4fc" style={styles.spinner} />}
      <Text style={styles.message}>{message}</Text>

      {pickedSource !== null && !busy && (
        <View style={styles.actions}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setSelectionOpen(true)}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>
              {candidate ? "Cambiar obra o edición" : "Elegir obra y edición"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={releaseSource}
            style={styles.releaseButton}
          >
            <Text style={styles.releaseButtonText}>Liberar</Text>
          </TouchableOpacity>
        </View>
      )}

      {candidate !== null && selectedChoice !== null && (
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>ESTRUCTURA DEL PAQUETE VALIDADA</Text>
          <Text style={styles.previewWork}>{selectedChoice.title}</Text>
          <Text style={styles.previewMeta}>Edición: {candidate.declaredEditionId}</Text>
          <Text style={styles.previewMeta}>Idioma declarado: {candidate.language}</Text>
          <View style={styles.metrics}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{candidate.navigationEntryCount}</Text>
              <Text style={styles.metricLabel}>Entradas de navegación</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{candidate.navigationXhtmlTargetCount}</Text>
              <Text style={styles.metricLabel}>Destinos XHTML</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{candidate.spineItemCount}</Text>
              <Text style={styles.metricLabel}>Recursos del spine</Text>
            </View>
          </View>
          {plannedTask !== null && (
            <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={inspectNextChapter} style={[styles.inspectButton, busy && styles.disabled]}>
              <Text style={styles.inspectButtonText}>Inspeccionar capítulo {plannedTask.chapterNumber}</Text>
            </TouchableOpacity>
          )}
          {chapterCandidate !== null && (
            <View style={styles.chapterPreview}>
              <Text style={styles.chapterPreviewTitle}>DOCUMENTO XHTML INSPECCIONADO</Text>
              <Text style={styles.previewMeta}>Capítulo {chapterCandidate.chapterNumber} · desbloqueo mínimo al llegar al capítulo {chapterCandidate.minimumReaderChapter}</Text>
              <Text style={styles.previewMeta}>SHA-256: {chapterCandidate.documentSha256.slice(0, 20)}…</Text>
              <Text style={styles.privacyNote}>Resultado candidate-only. No contiene texto, no añade un resumen y no modifica el progreso ni el conocimiento de producción.</Text>
            </View>
          )}
          <Text style={styles.privacyNote}>La inspección devuelve solo metadatos y huellas. La coincidencia de edición o un documento inspeccionado no equivalen a aprobación editorial.</Text>
        </View>
      )}

      <Modal
        visible={selectionOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectionOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>ELIGE LA OBRA Y LA EDICIÓN</Text>
            <Text style={styles.modalNote}>
              El archivo no se identifica por su nombre. Selecciona la obra que contiene y confirma su edición registrada.
            </Text>
            <ScrollView style={styles.choiceList}>
              {importChoices.map(choice => (
                <TouchableOpacity
                  key={choice.workId}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !choice.supported }}
                  disabled={!choice.supported || busy}
                  onPress={() => inspectSelectedWork(choice)}
                  style={[styles.choice, !choice.supported && styles.disabled]}
                >
                  <Text style={styles.choiceTitle}>{choice.title}</Text>
                  <Text style={styles.choiceMeta}>{sourceGroupLabel(choice.sourceGroup)}</Text>
                  <Text style={styles.choiceEdition}>
                    {choice.editionId ?? "Sin edición verificada"} · {progressModeLabel(choice)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setSelectionOpen(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    padding: 12,
    backgroundColor: "#0b1424",
    borderBottomWidth: 1,
    borderColor: "#26344d",
  },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerCopy: { flex: 1 },
  title: { color: "#e2e8f0", fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  note: { color: "#94a3b8", fontSize: 10, lineHeight: 15, marginTop: 3 },
  button: { backgroundColor: "#3730a3", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16 },
  buttonText: { color: "#ffffff", fontSize: 10, fontWeight: "800" },
  disabled: { opacity: 0.4 },
  sourceRow: { marginTop: 9, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#26344d" },
  sourceName: { color: "#e2e8f0", fontSize: 11, fontWeight: "700" },
  sourceMeta: { color: "#94a3b8", fontSize: 9, marginTop: 2 },
  spinner: { marginTop: 8 },
  message: { color: "#cbd5e1", fontSize: 10, lineHeight: 15, marginTop: 8 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 9 },
  secondaryButton: { backgroundColor: "#1e293b", borderWidth: 1, borderColor: "#475569", paddingHorizontal: 11, paddingVertical: 7, borderRadius: 14 },
  secondaryButtonText: { color: "#c7d2fe", fontSize: 10, fontWeight: "700" },
  releaseButton: { paddingHorizontal: 10, paddingVertical: 7 },
  releaseButtonText: { color: "#fca5a5", fontSize: 10, fontWeight: "700" },
  preview: { marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: "#111d31", borderWidth: 1, borderColor: "#334155" },
  previewTitle: { color: "#a5b4fc", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  previewWork: { color: "#f8fafc", fontSize: 12, fontWeight: "800", marginTop: 5 },
  previewMeta: { color: "#cbd5e1", fontSize: 10, marginTop: 3 },
  metrics: { flexDirection: "row", gap: 8, marginTop: 10 },
  metric: { flex: 1, padding: 7, borderRadius: 8, backgroundColor: "#0b1424" },
  metricValue: { color: "#ffffff", fontSize: 17, fontWeight: "800" },
  metricLabel: { color: "#94a3b8", fontSize: 8, lineHeight: 12, marginTop: 2 },
  inspectButton: { alignSelf: "flex-start", marginTop: 10, backgroundColor: "#312e81", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  inspectButtonText: { color: "#ffffff", fontSize: 10, fontWeight: "800" },
  chapterPreview: { marginTop: 9, padding: 9, borderRadius: 8, backgroundColor: "#0b1424", borderWidth: 1, borderColor: "#475569" },
  chapterPreviewTitle: { color: "#86efac", fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  privacyNote: { color: "#94a3b8", fontSize: 9, lineHeight: 13, marginTop: 9 },
  modalBackdrop: { flex: 1, justifyContent: "center", padding: 18, backgroundColor: "rgba(0,0,0,0.72)" },
  modal: { maxHeight: "85%", backgroundColor: "#0f172a", borderRadius: 16, borderWidth: 1, borderColor: "#334155", padding: 14 },
  modalTitle: { color: "#f8fafc", fontSize: 12, fontWeight: "900", letterSpacing: 0.8 },
  modalNote: { color: "#94a3b8", fontSize: 10, lineHeight: 15, marginTop: 5, marginBottom: 8 },
  choiceList: { maxHeight: 460 },
  choice: { paddingVertical: 9, borderTopWidth: 1, borderTopColor: "#26344d" },
  choiceTitle: { color: "#f8fafc", fontSize: 11, fontWeight: "700" },
  choiceMeta: { color: "#94a3b8", fontSize: 9, marginTop: 2 },
  choiceEdition: { color: "#a5b4fc", fontSize: 9, marginTop: 2 },
  closeButton: { alignSelf: "flex-end", marginTop: 8, paddingHorizontal: 12, paddingVertical: 8 },
  closeButtonText: { color: "#c7d2fe", fontSize: 10, fontWeight: "700" },
});
