import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { createHoidExpoLocalEpubRuntime } from "../hoid/expoLocalEpubPlatform";
import { createHoidImportLifecycleGuard } from "../hoid/epubImportLifecycle";
import { getHoidSourceIngestionPlan } from "../hoid/sourceIngestionPlan";
import { inspectHoidPlannedChapterCandidate, type HoidPlannedChapterInspectionCandidate } from "../hoid/sourceIngestionExecution";
import type { HoidExpoPickedSource } from "../hoid/expoLocalEpubProvider";
import type {
  HoidEpubPackageInspectionCandidate,
  HoidEpubReadableBlock,
} from "../hoid/epubIngestion";
import { useCosmere } from "../context/CosmereContext";
import {
  createHoidLocalEpubRecommendationReaderPort,
  type HoidReaderProgressBinding,
} from "../hoid/epubRecommendationReaderHost";
import type { HoidRecommendationReaderPort } from "../hoid/recommendationReaderPort";
import { getHoidReadingManifest } from "../hoid/readingManifest";
import { getExpoHoidSourceInspectionReceiptStore } from "../hoid/expoSourceInspectionReceiptStore";
import {
  appendHoidSourceInspectionReceipt,
  validateHoidSourceInspectionReceiptLedger,
} from "../hoid/sourceInspectionReceipts";
import {
  createHoidHistoricalReviewSessionController,
  type HoidHistoricalReviewDraft,
  type HoidHistoricalReviewHandoff,
  type HoidHistoricalReviewSessionLease,
} from "../hoid/historicalReviewSession";
import type {
  HoidHistoricalEditorialChecklist,
  HoidHistoricalEditorialReviewPacket,
  HoidHistoricalEditorialReviewReceipt,
} from "../hoid/historicalEditorialReview";
import {
  projectHoidSourceInspectionReviewQueue,
  type HoidSourceInspectionReviewQueueItem,
} from "../hoid/sourceInspectionReviewQueue";
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

function inspectionReceiptKey(workId: string, editionId: string, chapterNumber: number): string {
  return `${workId}:${editionId}:${chapterNumber}`;
}

const EMPTY_HISTORICAL_REVIEW_CHECKLIST: HoidHistoricalEditorialChecklist = Object.freeze({
  factualAccuracy: false,
  completeness: false,
  originality: false,
  spoilerCeiling: false,
  provenance: false,
});

const HISTORICAL_REVIEW_CHECKS: readonly Readonly<{
  key: keyof HoidHistoricalEditorialChecklist;
  label: string;
}>[] = Object.freeze([
  Object.freeze({ key: "factualAccuracy", label: "Precisión factual" }),
  Object.freeze({ key: "completeness", label: "Cobertura suficiente del capítulo" }),
  Object.freeze({ key: "originality", label: "Redacción original, sin fragmentos copiados" }),
  Object.freeze({ key: "spoilerCeiling", label: "No supera el capítulo indicado" }),
  Object.freeze({ key: "provenance", label: "Procedencia y edición verificadas" }),
]);

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

type OpenedChapterView = Readonly<{
  workId: string;
  sourceId: string;
  readerSessionEpoch: number;
  title: string;
  chapterNumber: number;
  editionId: string;
  blocks: readonly HoidEpubReadableBlock[];
  progressRevision: number;
  progressFingerprint: string;
  progressAction: "advance" | "unavailable";
}>;

export const HoidEpubImportPanel: React.FC<{
  onReaderPortChange?: (port: HoidRecommendationReaderPort | null, workId: string | null) => void;
}> = ({ onReaderPortChange }) => {
  const {
    refreshHoidCursorProgressSnapshot,
    subscribeHoidCursorProgressChanges,
    markHoidChapterReadIfCurrent,
    completeHoidWorkIfCurrent,
  } = useCosmere();
  const progressRefreshRef = useRef(refreshHoidCursorProgressSnapshot);
  progressRefreshRef.current = refreshHoidCursorProgressSnapshot;
  const progressSubscriptionRef = useRef(subscribeHoidCursorProgressChanges);
  progressSubscriptionRef.current = subscribeHoidCursorProgressChanges;
  const [pickedSource, setPickedSource] = useState<HoidExpoPickedSource | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<HoidEpubImportChoice | null>(null);
  const [candidate, setCandidate] = useState<HoidEpubPackageInspectionCandidate | null>(null);
  const [chapterCandidate, setChapterCandidate] = useState<HoidPlannedChapterInspectionCandidate | null>(null);
  const [localReceiptKeys, setLocalReceiptKeys] = useState<string[]>([]);
  const [reviewQueueItems, setReviewQueueItems] = useState<readonly HoidSourceInspectionReviewQueueItem[]>([]);
  const [historicalReviewHandoff, setHistoricalReviewHandoff] = useState<HoidHistoricalReviewHandoff | null>(null);
  const [historicalReviewDraft, setHistoricalReviewDraft] = useState<HoidHistoricalReviewDraft | null>(null);
  const [historicalReviewPacket, setHistoricalReviewPacket] = useState<HoidHistoricalEditorialReviewPacket | null>(null);
  const [historicalReviewReceipt, setHistoricalReviewReceipt] = useState<HoidHistoricalEditorialReviewReceipt | null>(null);
  const [historicalReviewChecklist, setHistoricalReviewChecklist] = useState<HoidHistoricalEditorialChecklist>(EMPTY_HISTORICAL_REVIEW_CHECKLIST);
  const [historicalReviewReviewerLabel, setHistoricalReviewReviewerLabel] = useState("local-editor");
  const [historicalReviewSummary, setHistoricalReviewSummary] = useState("");
  const [historicalReviewOriginalityConfirmed, setHistoricalReviewOriginalityConfirmed] = useState(false);
  const [historicalReviewSessionGeneration, setHistoricalReviewSessionGeneration] = useState<number | null>(null);
  const [receiptStoreStatus, setReceiptStoreStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    "Los EPUB se inspeccionan localmente. El nombre del archivo nunca determina la obra ni la edición.",
  );
  const [openedChapter, setOpenedChapter] = useState<OpenedChapterView | null>(null);
  const sourceIdRef = useRef<string | null>(null);
  const lifecycleRef = useRef(createHoidImportLifecycleGuard());
  const leaseRef = useRef<number | null>(null);
  const progressChangeEpochRef = useRef(0);
  const readerSessionEpochRef = useRef(0);
  const reviewQueueReadEpochRef = useRef(0);
  const historicalReviewControllerRef = useRef(createHoidHistoricalReviewSessionController());
  const historicalReviewLeaseRef = useRef<HoidHistoricalReviewSessionLease | null>(null);
  const historicalReviewAbortRef = useRef<AbortController | null>(null);
  const readerSessionAbortRef = useRef<AbortController | null>(null);
  const markingProgressRef = useRef(false);
  const plannedTask = selectedChoice === null ? null : getHoidSourceIngestionPlan().tasks.find(task => task.workId === selectedChoice.workId) ?? null;
  const plannedTaskAlreadyRecorded = plannedTask !== null && localReceiptKeys.includes(
    inspectionReceiptKey(plannedTask.workId, plannedTask.editionId, plannedTask.chapterNumber),
  );

  const refreshLocalReviewQueue = async (isCurrent: () => boolean) => {
    const readEpoch = reviewQueueReadEpochRef.current + 1;
    reviewQueueReadEpochRef.current = readEpoch;
    const isLatestRead = () =>
      isCurrent() && reviewQueueReadEpochRef.current === readEpoch;
    try {
      const store = await getExpoHoidSourceInspectionReceiptStore();
      const projection = projectHoidSourceInspectionReviewQueue(await store.read());
      if (!isLatestRead()) return;
      if (projection.status !== "ready") {
        setReviewQueueItems([]);
        setLocalReceiptKeys([]);
        setReceiptStoreStatus("unavailable");
        return;
      }
      setReviewQueueItems(projection.queue.items);
      setLocalReceiptKeys(projection.queue.items.map(item =>
        inspectionReceiptKey(item.workId, item.editionId, item.chapterNumber),
      ));
      setReceiptStoreStatus("ready");
    } catch {
      if (!isLatestRead()) return;
      setReviewQueueItems([]);
      setLocalReceiptKeys([]);
      setReceiptStoreStatus("unavailable");
    }
  };

  const invalidateHistoricalReviewSession = () => {
    const lease = historicalReviewLeaseRef.current;
    historicalReviewLeaseRef.current = null;
    if (lease !== null) historicalReviewControllerRef.current.invalidate(lease);
    else historicalReviewControllerRef.current.invalidate();
    const controller = historicalReviewAbortRef.current;
    historicalReviewAbortRef.current = null;
    try { controller?.abort(); } catch { /* The lease is invalidated regardless. */ }
    setHistoricalReviewHandoff(null);
    setHistoricalReviewDraft(null);
    setHistoricalReviewPacket(null);
    setHistoricalReviewReceipt(null);
    setHistoricalReviewChecklist(EMPTY_HISTORICAL_REVIEW_CHECKLIST);
    setHistoricalReviewSummary("");
    setHistoricalReviewOriginalityConfirmed(false);
    setHistoricalReviewSessionGeneration(null);
  };

  const invalidateReaderSession = () => {
    invalidateHistoricalReviewSession();
    readerSessionEpochRef.current += 1;
    const controller = readerSessionAbortRef.current;
    readerSessionAbortRef.current = null;
    try { controller?.abort(); } catch { /* Continue source cleanup. */ }
    onReaderPortChange?.(null, null);
  };

  useEffect(() => {
    const lease = lifecycleRef.current.activate();
    leaseRef.current = lease;
    return () => {
      invalidateReaderSession();
      lifecycleRef.current.deactivate(lease);
      leaseRef.current = null;
      const sourceId = sourceIdRef.current;
      sourceIdRef.current = null;
      setOpenedChapter(null);
      if (sourceId !== null) void epubRuntime.provider.release(sourceId).catch(() => undefined);
    };
  }, [onReaderPortChange]);

  useEffect(() => progressSubscriptionRef.current(() => {
    progressChangeEpochRef.current += 1;
    invalidateHistoricalReviewSession();
    setOpenedChapter(null);
    setMessage("El progreso ha cambiado. El capítulo abierto se ha cerrado; vuelve a validar el destino desde Hoid.");
  }), []);

  useEffect(() => {
    let active = true;
    void refreshLocalReviewQueue(() => active);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const source = pickedSource;
    const choice = selectedChoice;
    const packageCandidate = candidate;
    if (
      source === null ||
      choice === null ||
      choice.editionId === null ||
      packageCandidate === null
    ) return;

    const lease = historicalReviewControllerRef.current.beginSession({
      sourceId: source.sourceId,
      workId: choice.workId,
      editionId: choice.editionId,
    });
    if (lease === null) return;
    historicalReviewLeaseRef.current = lease;
    setHistoricalReviewSessionGeneration(lease.generation);
    return () => {
      historicalReviewControllerRef.current.invalidate(lease);
      if (historicalReviewLeaseRef.current === lease) historicalReviewLeaseRef.current = null;
    };
  }, [pickedSource?.sourceId, selectedChoice?.workId, selectedChoice?.editionId, candidate?.sourceFingerprint]);

  useEffect(() => {
    const source = pickedSource;
    const choice = selectedChoice;
    const packageCandidate = candidate;
    if (
      source === null ||
      choice === null ||
      choice.editionId === null ||
      packageCandidate === null
    ) {
      onReaderPortChange?.(null, null);
      return;
    }

    const readerSessionEpoch = readerSessionEpochRef.current + 1;
    readerSessionEpochRef.current = readerSessionEpoch;
    let readerSessionActive = true;
    const sessionController = new AbortController();
    readerSessionAbortRef.current = sessionController;
    const sourceId = source.sourceId;
    const workId = choice.workId;
    const editionId = choice.editionId;
    const port = createHoidLocalEpubRecommendationReaderPort({
      workId,
      editionId,
      packageCandidate,
      ingestion: epubRuntime.ingestion,
      refreshCurrentProgress: () => progressRefreshRef.current(),
      sessionSignal: sessionController.signal,
      isCurrent: () =>
        readerSessionActive &&
        readerSessionEpochRef.current === readerSessionEpoch &&
        sourceIdRef.current === sourceId &&
        lifecycleRef.current.isActive(leaseRef.current),
      getProgressChangeEpoch: () => progressChangeEpochRef.current,
      onChapterOpened: (chapter, chapterNumber, progressBinding: HoidReaderProgressBinding) => {
        const manifestResult = getHoidReadingManifest(workId);
        const progressAction: OpenedChapterView["progressAction"] =
          manifestResult.status === "ready" &&
          manifestResult.manifest.units.some(unit => unit.chapterNumber === chapterNumber + 1)
            ? "advance"
            : "unavailable";
        setOpenedChapter(Object.freeze({
          workId,
          sourceId,
          readerSessionEpoch,
          title: choice.title,
          chapterNumber,
          editionId,
          blocks: chapter.blocks,
          progressRevision: progressBinding.revision,
          progressFingerprint: progressBinding.fingerprint,
          progressAction,
        }));
        setMessage("Capítulo abierto localmente. El texto permanece en memoria de esta pantalla y no se envía a Hoid ni se guarda.");
      },
    });

    onReaderPortChange?.(port, workId);
    return () => {
      readerSessionActive = false;
      try { sessionController.abort(); } catch { /* Invalidate the session regardless. */ }
      if (readerSessionAbortRef.current === sessionController) {
        readerSessionAbortRef.current = null;
      }
      if (readerSessionEpochRef.current === readerSessionEpoch) {
        readerSessionEpochRef.current += 1;
      }
      onReaderPortChange?.(null, null);
    };
  }, [pickedSource, selectedChoice, candidate, onReaderPortChange]);

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

      // Stop reads through the old source before releasing its cached file.
      invalidateReaderSession();
      const previousSourceId = sourceIdRef.current;
      sourceIdRef.current = result.source.sourceId;
      setPickedSource(result.source);
      setOpenedChapter(null);
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

    invalidateReaderSession();
    setSelectionOpen(false);
    setBusy(true);
    setSelectedChoice(choice);
    setCandidate(null);
    setChapterCandidate(null);
    setOpenedChapter(null);
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
        setMessage(`Capítulo ${result.candidate.chapterNumber} inspeccionado localmente. Guardando únicamente un recibo de metadatos en el dispositivo…`);
        try {
          const store = await getExpoHoidSourceInspectionReceiptStore();
          const receiptResult = await appendHoidSourceInspectionReceipt(
            store,
            result.candidate,
            new Date().toISOString(),
          );
          if (!lifecycleRef.current.isCurrent(operation)) return;
          if (receiptResult.status === "saved" || receiptResult.status === "unchanged") {
            await refreshLocalReviewQueue(() => lifecycleRef.current.isCurrent(operation));
            if (!lifecycleRef.current.isCurrent(operation)) return;
            setMessage(
              receiptResult.status === "saved"
                ? `Recibo del capítulo ${result.candidate.chapterNumber} guardado localmente. No contiene texto; requiere volver a seleccionar la fuente antes de cualquier revisión editorial.`
                : `El capítulo ${result.candidate.chapterNumber} ya tenía un recibo local idéntico. No se ha duplicado ni sobrescrito.`,
            );
          } else if (receiptResult.status === "receipt-conflict") {
            await refreshLocalReviewQueue(() => lifecycleRef.current.isCurrent(operation));
            if (!lifecycleRef.current.isCurrent(operation)) return;
            setMessage("Ya existe un recibo local distinto para este capítulo. Se conserva el anterior y no se sobrescribe.");
          } else if (receiptResult.status === "write-conflict") {
            await refreshLocalReviewQueue(() => lifecycleRef.current.isCurrent(operation));
            if (!lifecycleRef.current.isCurrent(operation)) return;
            setMessage("El registro local cambió durante la escritura. Se ha conservado el estado persistido; vuelve a intentar la inspección después de actualizar la lista.");
          } else {
            setReceiptStoreStatus("unavailable");
            setMessage("La inspección sigue siendo candidate-only, pero no se pudo guardar el recibo local. No se ha guardado texto ni se ha autorizado producción.");
          }
        } catch {
          if (lifecycleRef.current.isCurrent(operation)) {
            setReceiptStoreStatus("unavailable");
            setMessage("La inspección sigue siendo candidate-only; el almacenamiento local no está disponible. No se ha guardado texto ni se ha modificado el progreso.");
          }
        }
      } else setMessage(rejectionMessage(result.reason));
    } catch {
      if (lifecycleRef.current.isCurrent(operation)) setMessage("La inspección del capítulo ha fallado de forma segura. No se ha creado un resumen ni se ha modificado el progreso.");
    } finally {
      if (lifecycleRef.current.isCurrent(operation)) setBusy(false);
    }
  };


  const reinspectHistoricalReviewItem = async (item: HoidSourceInspectionReviewQueueItem) => {
    const source = pickedSource;
    const choice = selectedChoice;
    const packageCandidate = candidate;
    const lease = historicalReviewLeaseRef.current;
    if (
      source === null ||
      choice === null ||
      choice.editionId === null ||
      packageCandidate === null ||
      lease === null ||
      !historicalReviewControllerRef.current.isCurrent(lease) ||
      choice.workId !== item.workId ||
      choice.editionId !== item.editionId ||
      packageCandidate.workId !== item.workId ||
      packageCandidate.declaredEditionId !== item.editionId ||
      busy
    ) {
      setMessage("Para reinspeccionar, selecciona de nuevo el EPUB y la misma obra y edición del recibo.");
      return;
    }

    const descriptor = createHoidEpubSourceDescriptor(source.sourceId, item.workId, item.editionId);
    if (descriptor === null) {
      setMessage("La fuente seleccionada no coincide con el catálogo. No se ha iniciado la reinspección.");
      return;
    }

    const operation = lifecycleRef.current.beginOperation();
    const abortController = new AbortController();
    historicalReviewAbortRef.current = abortController;
    setBusy(true);
    setHistoricalReviewHandoff(null);
    setHistoricalReviewDraft(null);
    setHistoricalReviewSummary("");
    setHistoricalReviewOriginalityConfirmed(false);
    setMessage("Volviendo a verificar el capítulo exacto contra el recibo local…");
    try {
      const store = await getExpoHoidSourceInspectionReceiptStore();
      const ledger = validateHoidSourceInspectionReceiptLedger(await store.read());
      if (!lifecycleRef.current.isCurrent(operation) ||
          !historicalReviewControllerRef.current.isCurrent(lease)) return;
      if (ledger.status !== "valid") {
        setReceiptStoreStatus("unavailable");
        setMessage("El registro local no se puede validar. No se ha abierto el espacio de revisión.");
        return;
      }
      const receipt = ledger.ledger.receipts.find(value =>
        value.workId === item.workId &&
        value.editionId === item.editionId &&
        value.chapterNumber === item.chapterNumber,
      );
      if (receipt === undefined) {
        setMessage("El recibo exacto ya no está disponible. Actualiza la lista antes de continuar.");
        return;
      }

      const result = await historicalReviewControllerRef.current.verifyAndBind(lease, {
        receipt,
        source: descriptor,
        packageCandidate,
        ingestion: epubRuntime.ingestion,
        verifiedAt: new Date().toISOString(),
        signal: abortController.signal,
      });
      if (!lifecycleRef.current.isCurrent(operation)) return;
      if (result.status === "ready") {
        setHistoricalReviewHandoff(result.handoff);
        setMessage("Capítulo verificado en la sesión local activa. Puedes redactar un resumen original en el espacio efímero de revisión.");
      } else if (result.status === "changed") {
        setMessage("El documento del capítulo ha cambiado respecto al recibo histórico. Se conserva el recibo y la revisión permanece bloqueada.");
      } else if (result.status === "stale-session") {
        setMessage("La sesión de la fuente cambió durante la reinspección. El resultado se ha descartado.");
      } else {
        setMessage("No se ha podido verificar el capítulo exacto. No se ha abierto el espacio de revisión.");
      }
    } catch {
      if (lifecycleRef.current.isCurrent(operation)) {
        setMessage("La reinspección local ha fallado de forma segura. No se ha creado ningún borrador.");
      }
    } finally {
      if (lifecycleRef.current.isCurrent(operation)) setBusy(false);
      if (historicalReviewAbortRef.current === abortController) historicalReviewAbortRef.current = null;
    }
  };

  const saveHistoricalReviewDraft = () => {
    const handoff = historicalReviewHandoff;
    if (handoff === null) return;
    const result = historicalReviewControllerRef.current.saveDraft(
      handoff,
      historicalReviewSummary,
      historicalReviewOriginalityConfirmed,
    );
    if (result.status === "saved-in-memory") {
      setHistoricalReviewDraft(result.draft);
      const packetResult = historicalReviewControllerRef.current.buildReviewPacket(handoff);
      if (packetResult.status === "ready") {
        setHistoricalReviewPacket(packetResult.packet);
        setHistoricalReviewReceipt(null);
        setHistoricalReviewChecklist(EMPTY_HISTORICAL_REVIEW_CHECKLIST);
        setMessage("Borrador original y paquete de revisión preparados en memoria. El paquete está pendiente de comprobación humana; no autoriza producción ni spoilers.");
      } else {
        setHistoricalReviewPacket(null);
        setHistoricalReviewReceipt(null);
        setMessage("El borrador permanece en memoria, pero no se ha podido construir un paquete editorial verificable.");
      }
    } else if (result.reason === "originality-not-confirmed") {
      setMessage("Confirma expresamente que el resumen está redactado con tus propias palabras y no contiene fragmentos copiados.");
    } else if (result.reason === "invalid-summary") {
      setMessage("El resumen debe tener entre 80 y 3.000 caracteres y no puede contener XHTML ni referencias a archivos locales.");
    } else {
      setMessage("La sesión de revisión ya no está activa. El borrador no se ha guardado.");
    }
  };

  const recordHistoricalReviewDecision = (decision: "approved" | "revision-required") => {
    const handoff = historicalReviewHandoff;
    const packet = historicalReviewPacket;
    if (handoff === null || packet === null || historicalReviewReviewerLabel.trim().length === 0) return;
    const failedChecks = HISTORICAL_REVIEW_CHECKS.filter(item => !historicalReviewChecklist[item.key]);
    if (decision === "approved" && failedChecks.length > 0) return;
    if (decision === "revision-required" && failedChecks.length === 0) return;
    const noteByCheck: Readonly<Record<keyof HoidHistoricalEditorialChecklist, string>> = {
      factualAccuracy: "factual-issue",
      completeness: "completeness-issue",
      originality: "originality-issue",
      spoilerCeiling: "spoiler-scope-issue",
      provenance: "provenance-issue",
    };
    const noteCodes = decision === "approved"
      ? ["no-issues"]
      : failedChecks.map(item => noteByCheck[item.key]);
    const result = historicalReviewControllerRef.current.recordReviewDecision(handoff, packet, {
      decision,
      reviewerLabel: historicalReviewReviewerLabel.trim(),
      reviewedAt: new Date().toISOString(),
      checklist: historicalReviewChecklist,
      noteCodes,
    });
    if (result.status === "valid") {
      setHistoricalReviewReceipt(result.receipt);
      setMessage(result.outcome === "approved-awaiting-trusted-promotion"
        ? "Revisión local registrada. Sigue pendiente de promoción firmada; no habilita respuestas ni spoilers."
        : "Revisión local registrada con correcciones pendientes. El borrador continúa fuera del conocimiento de producción.");
    } else {
      setMessage("La decisión local no coincide con el paquete actual o la lista de comprobación está incompleta. No se ha registrado.");
    }
  };

  const discardHistoricalReviewDraft = () => {
    const handoff = historicalReviewHandoff;
    if (handoff !== null) historicalReviewControllerRef.current.discardDraft(handoff);
    setHistoricalReviewDraft(null);
    setHistoricalReviewPacket(null);
    setHistoricalReviewReceipt(null);
    setHistoricalReviewChecklist(EMPTY_HISTORICAL_REVIEW_CHECKLIST);
    setHistoricalReviewSummary("");
    setHistoricalReviewOriginalityConfirmed(false);
    setMessage("Borrador y paquete efímeros descartados de la memoria de la sesión.");
  };

  const isOpenedChapterSessionCurrent = (chapter: OpenedChapterView): boolean =>
    chapter.readerSessionEpoch === readerSessionEpochRef.current &&
    sourceIdRef.current === chapter.sourceId &&
    lifecycleRef.current.isActive(leaseRef.current);

  const commitOpenedChapterProgress = async (chapter: OpenedChapterView) => {
    if (
      markingProgressRef.current ||
      chapter.progressAction !== "advance" ||
      !isOpenedChapterSessionCurrent(chapter)
    ) return;
    markingProgressRef.current = true;
    setBusy(true);
    setMessage("Comprobando que el progreso no haya cambiado antes de registrar la lectura…");
    try {
      const result = await markHoidChapterReadIfCurrent(
        chapter.workId,
        chapter.chapterNumber,
        chapter.progressRevision,
        chapter.progressFingerprint,
        { confirmed: true },
      );
      if (!isOpenedChapterSessionCurrent(chapter)) return;
      if (result === null) {
        setMessage("No se ha podido acceder al coordinador durable. El progreso no se ha modificado.");
      } else if (result.status === "ready" && result.operation === "updated") {
        setMessage(`Capítulo ${chapter.chapterNumber} registrado como leído. El cursor avanza al capítulo siguiente y Hoid recalculará sus límites de spoiler.`);
      } else if (result.status === "ready" && result.operation === "unchanged") {
        setMessage("Este progreso ya constaba en el ledger. No se ha creado una escritura adicional.");
      } else if (result.status === "conflict") {
        setMessage("El progreso cambió desde que se abrió el capítulo. No se ha aplicado esta confirmación; vuelve a solicitar una recomendación.");
      } else if (result.status === "rejected" && result.reason === "non-sequential-reader-advance") {
        setMessage("Este capítulo ya no es el siguiente pendiente. No se ha saltado ningún capítulo ni se ha modificado el progreso.");
      } else {
        setMessage("No se ha podido registrar la lectura de forma segura. No se ha modificado el progreso.");
      }
    } catch {
      setMessage("La confirmación ha fallado. No se ha modificado el progreso.");
    } finally {
      markingProgressRef.current = false;
      if (isOpenedChapterSessionCurrent(chapter)) setBusy(false);
    }
  };

  const confirmOpenedChapterRead = () => {
    const chapter = openedChapter;
    if (chapter === null || busy || markingProgressRef.current ||
      chapter.progressAction !== "advance" || !isOpenedChapterSessionCurrent(chapter)) return;
    Alert.alert(
      "Marcar capítulo como leído",
      `¿Confirmas que has leído el capítulo ${chapter.chapterNumber} de ${chapter.title}? El progreso avanzará al siguiente capítulo y cambiará qué información puede revelar Hoid.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Marcar como leído",
          onPress: () => { void commitOpenedChapterProgress(chapter); },
        },
      ],
    );
  };

  const commitWholeWorkCompletion = async (chapter: OpenedChapterView) => {
    if (markingProgressRef.current || !isOpenedChapterSessionCurrent(chapter)) return;
    markingProgressRef.current = true;
    setBusy(true);
    setMessage("Comprobando el progreso antes de registrar la finalización completa…");
    try {
      const result = await completeHoidWorkIfCurrent(
        chapter.workId,
        chapter.progressRevision,
        chapter.progressFingerprint,
        { confirmed: true },
      );
      if (!isOpenedChapterSessionCurrent(chapter)) return;
      if (result === null) {
        setMessage("No se ha podido acceder al coordinador durable. El progreso no se ha modificado.");
      } else if (result.status === "ready" && result.operation === "updated") {
        setMessage("Obra marcada como completada por confirmación expresa. Hoid recalculará los límites de spoiler para toda la obra.");
      } else if (result.status === "ready" && result.operation === "unchanged") {
        setMessage("La obra ya constaba como completada. No se ha creado una escritura adicional.");
      } else if (result.status === "conflict") {
        setMessage("El progreso cambió desde que se abrió el capítulo. No se ha aplicado la finalización; vuelve a validar la lectura.");
      } else {
        setMessage("No se ha podido registrar la finalización de forma segura. El progreso no se ha modificado.");
      }
    } catch {
      setMessage("La confirmación de finalización ha fallado. No se ha modificado el progreso.");
    } finally {
      markingProgressRef.current = false;
      if (isOpenedChapterSessionCurrent(chapter)) setBusy(false);
    }
  };

  const confirmWholeWorkCompletion = () => {
    const chapter = openedChapter;
    if (chapter === null || busy || markingProgressRef.current ||
      !isOpenedChapterSessionCurrent(chapter)) return;
    Alert.alert(
      "He terminado toda la obra",
      `¿Confirmas que has terminado toda la obra ${chapter.title}, incluidos epílogos, apéndices y secciones no numeradas? Esta acción marcará el libro como completado y cambiará qué información puede revelar Hoid.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Completar obra",
          style: "destructive",
          onPress: () => { void commitWholeWorkCompletion(chapter); },
        },
      ],
    );
  };

  const releaseSource = async () => {
    const operation = lifecycleRef.current.beginOperation();
    invalidateReaderSession();
    setOpenedChapter(null);
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
        setOpenedChapter(null);
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
            Inspección en el dispositivo · sin subir libros · progreso solo con confirmación explícita
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
      <Text style={styles.receiptMeta}>
        {receiptStoreStatus === "ready"
          ? `${localReceiptKeys.length} recibos locales de inspección · solo metadatos · requieren volver a seleccionar la fuente`
          : receiptStoreStatus === "loading"
            ? "Cargando el registro local de inspecciones…"
            : "Registro local de inspecciones no disponible; las inspecciones nuevas no se persistirán."}
      </Text>

      {receiptStoreStatus === "ready" && reviewQueueItems.length > 0 && (
        <View style={styles.reviewQueue}>
          <Text style={styles.reviewQueueTitle}>CANDIDATOS QUE REQUIEREN RESELECCIÓN DE FUENTE</Text>
          {reviewQueueItems.slice(0, 5).map(item => (
            <View key={inspectionReceiptKey(item.workId, item.editionId, item.chapterNumber)} style={styles.reviewQueueItem}>
              <Text style={styles.reviewQueueWork}>{item.title} · capítulo {item.chapterNumber}</Text>
              <Text style={styles.reviewQueueMeta}>Edición {item.editionId} · inspeccionado {new Date(item.inspectedAt).toLocaleString()}</Text>
              {pickedSource !== null &&
                selectedChoice?.workId === item.workId &&
                selectedChoice.editionId === item.editionId &&
                candidate?.workId === item.workId &&
                candidate.declaredEditionId === item.editionId &&
                historicalReviewSessionGeneration !== null &&
                historicalReviewLeaseRef.current !== null &&
                historicalReviewControllerRef.current.isCurrent(historicalReviewLeaseRef.current) ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => { void reinspectHistoricalReviewItem(item); }}
                    style={[styles.reinspectButton, busy && styles.disabled]}
                  >
                    <Text style={styles.reinspectButtonText}>Reinspeccionar capítulo {item.chapterNumber}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.reviewQueueMeta}>Selecciona el EPUB y esta misma obra y edición para volver a verificar el capítulo.</Text>
                )}
            </View>
          ))}
          {reviewQueueItems.length > 5 && (
            <Text style={styles.reviewQueueMeta}>Y {reviewQueueItems.length - 5} candidatos más.</Text>
          )}
          <Text style={styles.privacyNote}>Los recibos no contienen texto ni permiten aprobar resúmenes, escribir conocimiento de producción o desbloquear spoilers.</Text>
        </View>
      )}

      {historicalReviewHandoff !== null && (
        <View style={styles.reviewWorkspace}>
          <Text style={styles.reviewWorkspaceTitle}>ESPACIO LOCAL DE REVISIÓN</Text>
          <Text style={styles.reviewWorkspaceMeta}>
            Capítulo {historicalReviewHandoff.chapterNumber} · {historicalReviewHandoff.editionId} · fuente verificada en esta sesión
          </Text>
          <Text style={styles.reviewWorkspaceMeta}>
            Redacta un resumen original con tus propias palabras. No pegues texto del EPUB. El borrador no sale del dispositivo ni se incorpora al conocimiento de Hoid.
          </Text>
          <TextInput
            accessibilityLabel="Resumen original del capítulo"
            multiline
            maxLength={3000}
            editable={!busy}
            value={historicalReviewSummary}
            onChangeText={value => {
              if (historicalReviewHandoff !== null) {
                historicalReviewControllerRef.current.discardDraft(historicalReviewHandoff);
              }
              setHistoricalReviewSummary(value);
              setHistoricalReviewDraft(null);
            }}
            placeholder="Escribe aquí un resumen original de 80 a 3.000 caracteres…"
            placeholderTextColor="#64748b"
            style={styles.reviewDraftInput}
          />
          <TouchableOpacity
            accessibilityRole="checkbox"
            accessibilityState={{ checked: historicalReviewOriginalityConfirmed }}
            onPress={() => {
              if (historicalReviewHandoff !== null) {
                historicalReviewControllerRef.current.discardDraft(historicalReviewHandoff);
              }
              setHistoricalReviewDraft(null);
              setHistoricalReviewOriginalityConfirmed(value => !value);
            }}
            style={styles.reviewAttestation}
          >
            <Text style={styles.reviewAttestationText}>
              {historicalReviewOriginalityConfirmed ? "☑" : "☐"} Confirmo que el resumen está redactado con mis propias palabras y no reproduce fragmentos del libro.
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={busy || !historicalReviewOriginalityConfirmed}
            onPress={saveHistoricalReviewDraft}
            style={[styles.reviewSaveButton, (busy || !historicalReviewOriginalityConfirmed) && styles.disabled]}
          >
            <Text style={styles.reviewSaveButtonText}>
              {historicalReviewDraft === null ? "Mantener borrador en memoria" : "Actualizar borrador en memoria"}
            </Text>
          </TouchableOpacity>
          {historicalReviewDraft !== null && (
            <View>
              <Text style={styles.reviewDraftState}>
                Borrador local · pendiente de revisión humana · no persistido · no autorizado para respuestas
              </Text>
              <TouchableOpacity accessibilityRole="button" onPress={discardHistoricalReviewDraft} style={styles.reviewDiscardButton}>
                <Text style={styles.reviewDiscardButtonText}>Descartar borrador</Text>
              </TouchableOpacity>
            </View>
          )}
          {historicalReviewPacket !== null && (
            <View style={styles.reviewPacket}>
              <Text style={styles.reviewPacketTitle}>PAQUETE EDITORIAL LOCAL</Text>
              <Text style={styles.reviewPacketMeta}>
                {historicalReviewPacket.workId} · capítulo {historicalReviewPacket.chapterNumber} · {historicalReviewPacket.editionId}
              </Text>
              <Text style={styles.reviewPacketMeta}>Huella del paquete: {historicalReviewPacket.packetId.slice(0, 20)}…</Text>
              {historicalReviewReceipt === null ? (
                <View>
                  <Text style={styles.reviewPacketMeta}>Comprueba el resumen frente al capítulo verificado. Todas las casillas son obligatorias para aprobar.</Text>
                  {HISTORICAL_REVIEW_CHECKS.map(item => (
                    <TouchableOpacity
                      key={item.key}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: historicalReviewChecklist[item.key] }}
                      onPress={() => setHistoricalReviewChecklist(current => ({
                        ...current,
                        [item.key]: !current[item.key],
                      }))}
                      style={styles.reviewCheck}
                    >
                      <Text style={styles.reviewCheckText}>
                        {historicalReviewChecklist[item.key] ? "☑" : "☐"} {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TextInput
                    accessibilityLabel="Etiqueta local del revisor, no verificada"
                    value={historicalReviewReviewerLabel}
                    onChangeText={setHistoricalReviewReviewerLabel}
                    editable={!busy}
                    autoCapitalize="none"
                    maxLength={128}
                    placeholder="Etiqueta local del revisor"
                    placeholderTextColor="#64748b"
                    style={styles.reviewReviewerInput}
                  />
                  <TouchableOpacity
                    accessibilityRole="button"
                    disabled={busy || HISTORICAL_REVIEW_CHECKS.some(item => !historicalReviewChecklist[item.key]) || historicalReviewReviewerLabel.trim().length === 0}
                    onPress={() => recordHistoricalReviewDecision("approved")}
                    style={[styles.reviewDecisionButton, (busy || HISTORICAL_REVIEW_CHECKS.some(item => !historicalReviewChecklist[item.key]) || historicalReviewReviewerLabel.trim().length === 0) && styles.disabled]}
                  >
                    <Text style={styles.reviewDecisionButtonText}>Registrar aprobación local</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    disabled={busy || HISTORICAL_REVIEW_CHECKS.every(item => historicalReviewChecklist[item.key]) || historicalReviewReviewerLabel.trim().length === 0}
                    onPress={() => recordHistoricalReviewDecision("revision-required")}
                    style={[styles.reviewDecisionSecondary, (busy || HISTORICAL_REVIEW_CHECKS.every(item => historicalReviewChecklist[item.key]) || historicalReviewReviewerLabel.trim().length === 0) && styles.disabled]}
                  >
                    <Text style={styles.reviewDecisionSecondaryText}>Solicitar correcciones</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.reviewReceiptText}>
                  {historicalReviewReceipt.decision === "approved" ? "Aprobación local registrada" : "Correcciones solicitadas"} · {historicalReviewReceipt.trustLevel} · {historicalReviewReceipt.reviewerIdentityAuthority}
                </Text>
              )}
              <Text style={styles.privacyNote}>
                La etiqueta del revisor no está autenticada. Esta decisión no es una firma, no satisface el quorum de producción y no desbloquea spoilers.
              </Text>
            </View>
          )}
          <Text style={styles.privacyNote}>
            La confirmación de originalidad es una declaración humana, no un detector automático. Este espacio no aprueba, publica ni desbloquea spoilers. Se vacía al cambiar o liberar la fuente, cambiar de obra/edición o cambiar el progreso.
          </Text>
        </View>
      )}

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

      {openedChapter !== null && (
        <View style={styles.reader}>
          <Text style={styles.readerTitle}>LECTOR EPUB LOCAL</Text>
          <Text style={styles.readerHeading}>{openedChapter.title}</Text>
          <Text style={styles.readerMeta}>Capítulo {openedChapter.chapterNumber} · {openedChapter.editionId}</Text>
          <ScrollView style={styles.readerScroll} nestedScrollEnabled>
            {openedChapter.blocks.map((block, index) => (
              <Text
                key={index}
                style={[
                  styles.readerBlock,
                  block.kind === "heading" && styles.readerBlockHeading,
                  block.kind === "quote" && styles.readerBlockQuote,
                  block.kind === "list-item" && styles.readerBlockList,
                ]}
              >
                {block.kind === "list-item" ? "• " : ""}{block.text}
              </Text>
            ))}
          </ScrollView>
          {openedChapter.progressAction === "advance" ? (
            <TouchableOpacity
              accessibilityRole="button"
              disabled={busy}
              onPress={confirmOpenedChapterRead}
              style={[styles.markReadButton, busy && styles.disabled]}
            >
              <Text style={styles.markReadButtonText}>Marcar capítulo como leído</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.readerPrivacy}>
              El manifiesto no define un siguiente cursor numérico seguro. No se avanzará el progreso automáticamente.
            </Text>
          )}
          <TouchableOpacity
            accessibilityRole="button"
            disabled={busy}
            onPress={confirmWholeWorkCompletion}
            style={[styles.markReadButton, busy && styles.disabled]}
          >
            <Text style={styles.markReadButtonText}>He terminado toda la obra</Text>
          </TouchableOpacity>
          <Text style={styles.readerPrivacy}>
            El texto permanece local y efímero. Abrir el capítulo no modifica el progreso; avanzar un capítulo y completar toda la obra son acciones distintas, ambas requieren confirmación expresa.
          </Text>
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
            plannedTaskAlreadyRecorded ? (
              <Text style={styles.receiptWarning}>
                El capítulo {plannedTask.chapterNumber} ya tiene un recibo local. La planificación no lo considera producción: requiere revisión editorial y promoción explícita antes de avanzar al siguiente capítulo.
              </Text>
            ) : (
              <TouchableOpacity accessibilityRole="button" disabled={busy || receiptStoreStatus === "loading"} onPress={inspectNextChapter} style={[styles.inspectButton, (busy || receiptStoreStatus === "loading") && styles.disabled]}>
                <Text style={styles.inspectButtonText}>Inspeccionar capítulo {plannedTask.chapterNumber}</Text>
              </TouchableOpacity>
            )
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
  reader: { marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: "#0a1020", borderWidth: 1, borderColor: "#64748b" },
  readerTitle: { color: "#86efac", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  readerHeading: { color: "#f8fafc", fontSize: 15, fontWeight: "800", marginTop: 6 },
  readerMeta: { color: "#94a3b8", fontSize: 9, marginTop: 3 },
  readerScroll: { maxHeight: 460, marginTop: 10 },
  readerBlock: { color: "#e2e8f0", fontSize: 13, lineHeight: 21, marginBottom: 12 },
  readerBlockHeading: { color: "#c7d2fe", fontSize: 15, fontWeight: "800", lineHeight: 23, marginTop: 8 },
  readerBlockQuote: { color: "#cbd5e1", fontStyle: "italic", paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: "#64748b" },
  readerBlockList: { paddingLeft: 8 },
  markReadButton: { alignSelf: "flex-start", marginTop: 8, backgroundColor: "#14532d", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  markReadButtonText: { color: "#dcfce7", fontSize: 10, fontWeight: "800" },
  readerPrivacy: { color: "#94a3b8", fontSize: 9, lineHeight: 14, marginTop: 8 },
  chapterPreview: { marginTop: 9, padding: 9, borderRadius: 8, backgroundColor: "#0b1424", borderWidth: 1, borderColor: "#475569" },
  chapterPreviewTitle: { color: "#86efac", fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  privacyNote: { color: "#94a3b8", fontSize: 9, lineHeight: 13, marginTop: 9 },
  receiptMeta: { color: "#94a3b8", fontSize: 9, lineHeight: 14, marginTop: 5 },
  receiptWarning: { color: "#fbbf24", fontSize: 10, lineHeight: 15, marginTop: 9 },
  reviewQueue: { marginTop: 9, padding: 9, borderRadius: 8, backgroundColor: "#111d31", borderWidth: 1, borderColor: "#475569" },
  reviewQueueTitle: { color: "#fbbf24", fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  reviewQueueItem: { paddingTop: 7, marginTop: 7, borderTopWidth: 1, borderTopColor: "#334155" },
  reviewQueueWork: { color: "#e2e8f0", fontSize: 10, fontWeight: "800" },
  reviewQueueMeta: { color: "#94a3b8", fontSize: 9, lineHeight: 13, marginTop: 3 },
  reinspectButton: { alignSelf: "flex-start", marginTop: 7, backgroundColor: "#1e3a5f", borderWidth: 1, borderColor: "#60a5fa", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 },
  reinspectButtonText: { color: "#dbeafe", fontSize: 9, fontWeight: "800" },
  reviewWorkspace: { marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: "#10251f", borderWidth: 1, borderColor: "#4ade80" },
  reviewWorkspaceTitle: { color: "#86efac", fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  reviewWorkspaceMeta: { color: "#cbd5e1", fontSize: 9, lineHeight: 14, marginTop: 5 },
  reviewDraftInput: { minHeight: 120, maxHeight: 220, marginTop: 9, padding: 10, borderRadius: 8, backgroundColor: "#091711", borderWidth: 1, borderColor: "#3f6654", color: "#f0fdf4", fontSize: 11, lineHeight: 17, textAlignVertical: "top" },
  reviewAttestation: { marginTop: 8, padding: 8, borderRadius: 8, backgroundColor: "#15352a" },
  reviewAttestationText: { color: "#dcfce7", fontSize: 9, lineHeight: 14 },
  reviewSaveButton: { alignSelf: "flex-start", marginTop: 8, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, backgroundColor: "#166534" },
  reviewSaveButtonText: { color: "#f0fdf4", fontSize: 9, fontWeight: "800" },
  reviewDraftState: { color: "#bbf7d0", fontSize: 9, lineHeight: 14, marginTop: 8 },
  reviewDiscardButton: { alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9, backgroundColor: "#7f1d1d" },
  reviewDiscardButtonText: { color: "#fee2e2", fontSize: 9, fontWeight: "700" },
  reviewPacket: { marginTop: 10, padding: 9, borderRadius: 9, backgroundColor: "#171d31", borderWidth: 1, borderColor: "#818cf8" },
  reviewPacketTitle: { color: "#c7d2fe", fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  reviewPacketMeta: { color: "#cbd5e1", fontSize: 9, lineHeight: 14, marginTop: 5 },
  reviewCheck: { marginTop: 5, padding: 7, borderRadius: 7, backgroundColor: "#0f172a" },
  reviewCheckText: { color: "#e2e8f0", fontSize: 9, lineHeight: 13 },
  reviewReviewerInput: { marginTop: 8, padding: 8, borderRadius: 7, backgroundColor: "#0b1424", borderWidth: 1, borderColor: "#475569", color: "#f8fafc", fontSize: 10 },
  reviewDecisionButton: { alignSelf: "flex-start", marginTop: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9, backgroundColor: "#166534" },
  reviewDecisionButtonText: { color: "#f0fdf4", fontSize: 9, fontWeight: "800" },
  reviewDecisionSecondary: { alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9, backgroundColor: "#713f12" },
  reviewDecisionSecondaryText: { color: "#fef3c7", fontSize: 9, fontWeight: "800" },
  reviewReceiptText: { color: "#bbf7d0", fontSize: 9, lineHeight: 14, marginTop: 8 },
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