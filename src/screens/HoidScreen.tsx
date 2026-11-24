import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useCosmere } from '../context/CosmereContext';
import { createHoidEditorialRuntime, getHoidEditorialRegistryStatus } from '../hoid/editorialRegistry';
import { createHoidCursorEvidenceRuntime, projectHoidCursorProgressSnapshot } from '../hoid/cursorEvidenceRuntime';
import { fingerprintHoidCursorProgressProjection } from '../hoid/knowledgeGraph';
import { createHoidConversationGateway } from '../hoid/conversationGateway';
import {
  projectHoidAnswerForDisplay,
  projectHoidCrossBookEvidenceForDisplay,
  type HoidDisplayCitation,
  type HoidDisplayCrossBookEvidenceSummary,
  type HoidDisplaySegment,
} from '../hoid/answerDisplayProjection';
import type { HoidExplanationDepth } from '../hoid/explanationDepth';
import {
  isHoidTrustedScreenAnswerPort,
  type HoidTrustedScreenAnswerPort,
} from '../hoid/trustedScreenAnswer';
import { createHoidTrustedTopicRecommendationPresenter } from '../hoid/trustedTopicRecommendations';
import type { HoidNarrativeLayout } from '../hoid/narrativeComposition';
import { summarizeHoidPresentedCrossBookEvidence } from '../hoid/crossBookEvidence';

import { classifyHoidConversationIntent } from '../hoid/conversationIntent';
import type { HoidConversationContext } from '../hoid/conversationContext';
import type { HoidTypedConversationContext } from '../hoid/typedConversationContext';
import type { HoidConversationScopeBinding } from '../hoid/conversationScopeBinding';
import { createHoidConversationTurnSession } from '../hoid/conversationTurnSession';
import { createHoidRecommendationRequestSession } from '../hoid/recommendationRequestSession';
import { awaitHoidOperationWithSignal } from '../hoid/abortableOperation';
import {
  createHoidEditionBoundRecommendationPresentation,
  type HoidEditionBoundRecommendationPresentation,
} from '../hoid/editionBoundRecommendationPresentation';
import { validateHoidEditionBoundRecommendationFreshness } from '../hoid/editionBoundRecommendationFreshness';
import { prepareHoidRecommendationNavigationHandoff } from '../hoid/editionBoundRecommendationNavigation';
import { HOID_TOPIC_TAXONOMY, type HoidTopicId } from '../hoid/topicTaxonomy';
import { HOID_SOURCE_BIBLIOGRAPHY } from '../hoid/bibliography';
import {
  buildHoidAnswerScopeSelection,
  toggleHoidAnswerScopeBook,
  type HoidAnswerScopeMode,
} from '../hoid/answerScopeSelection';
import { validateHoidPresentedAnswerScope } from '../hoid/answerScopePresentation';
import { createHoidTopicInterestContext } from '../hoid/topicInterestContext';
import {
  createHoidTopicInterestRecommendationGateway,
} from '../hoid/topicInterestRecommendationsGateway';
import { createHoidApprovedClaimAnswerPort } from '../hoid/topicApprovedClaimAnswerPort';
import { HoidEpubImportPanel } from '../components/HoidEpubImportPanel';
import {
  openHoidRecommendationChapter,
  type HoidRecommendationReaderPort,
} from '../hoid/recommendationReaderPort';
import {
  projectHoidEditionRecommendationsForDisplay,
  projectHoidTopicRecommendationsForDisplay,
  type HoidEditionRecommendationDisplayProjection,
  type HoidTopicRecommendationDisplayItem,
} from '../hoid/recommendationDisplayProjection';
import {
  HOID_STATIC_GREETING_ID,
  HOID_STATIC_GREETING_KIND,
  HOID_STATIC_GREETING_TEXT,
  canCommitHoidProgressScopedResponse,
  filterVisibleHoidMessages,
  pruneStaleHoidMessages,
  type HoidConversationProgressScope,
} from '../hoid/conversationHistoryPolicy';

const editorialRuntime = createHoidEditorialRuntime();
const hoidRuntime = editorialRuntime ? createHoidCursorEvidenceRuntime(editorialRuntime) : null;
const topicApprovedClaimAnswerPort = createHoidApprovedClaimAnswerPort(editorialRuntime);

interface Mensaje {
  id: string;
  emisor: 'usuario' | 'hoid';
  texto: string;
  kind?: typeof HOID_STATIC_GREETING_KIND;
  progressScope?: HoidConversationProgressScope;
  citas?: readonly HoidDisplayCitation[];
  segmentos?: readonly HoidDisplaySegment[];
  formato?: HoidNarrativeLayout;
  evidenciaTransversal?: HoidDisplayCrossBookEvidenceSummary;
}

function formatHoidCitationLocation(
  title: string,
  chapter: number,
  chapterOrdinal: number,
  chapterLabelAmbiguous: boolean,
): string {
  return chapterLabelAmbiguous
    ? `${title} · capítulo ${chapter} · entrada ${chapterOrdinal} del índice`
    : `${title} · capítulo ${chapter}`;
}

export const HoidScreen: React.FC<{ trustedAnswerPort?: HoidTrustedScreenAnswerPort | null }> = ({ trustedAnswerPort: trustedAnswerPortInput = null }) => {
  // A caller-supplied object with a compatible shape is not a trust grant.
  // Only the module-private capability issued by the signed presenter factory
  // may enable narrative answer dispatch.
  const trustedAnswerPort = isHoidTrustedScreenAnswerPort(trustedAnswerPortInput)
    ? trustedAnswerPortInput
    : null;
  const {
    getHoidCursorProgressSnapshot,
    refreshHoidCursorProgressSnapshot,
    subscribeHoidCursorProgressChanges,
    progresoPersistenciaEstado,
  } = useCosmere();
  const progressReaderRef = useRef(getHoidCursorProgressSnapshot);
  progressReaderRef.current = getHoidCursorProgressSnapshot;
  const progressRefreshRef = useRef(refreshHoidCursorProgressSnapshot);
  progressRefreshRef.current = refreshHoidCursorProgressSnapshot;
  const progressSubscriptionRef = useRef(subscribeHoidCursorProgressChanges);
  progressSubscriptionRef.current = subscribeHoidCursorProgressChanges;
  // Ephemeral ID-only context: never persisted to SQLite, messages or providers.
  const conversationContextRef = useRef<HoidConversationContext | null>(null);
  const typedConversationContextRef = useRef<HoidTypedConversationContext | null>(null);
  const conversationScopeBindingRef = useRef<HoidConversationScopeBinding | null>(null);
  const [conversationTurnSession] = useState(() => createHoidConversationTurnSession());
  const [recommendationRequestSession] = useState(() => createHoidRecommendationRequestSession());
  const conversationGateway = hoidRuntime
    ? createHoidConversationGateway({
        runtime: hoidRuntime,
        getCurrentProgress: () => progressReaderRef.current(),
        refreshCurrentProgress: () => progressRefreshRef.current(),
        subscribeToProgressChanges: listener => progressSubscriptionRef.current(listener),
      })
    : null;
  const topicInterestGateway = createHoidTopicInterestRecommendationGateway({
    getCurrentProgress: () => progressReaderRef.current(),
    refreshCurrentProgress: (signal?: AbortSignal) => awaitHoidOperationWithSignal(
      () => progressRefreshRef.current(),
      signal,
    ),
    ...(topicApprovedClaimAnswerPort
      ? { answerApprovedClaims: topicApprovedClaimAnswerPort }
      : {}),
  });

  const trustedTopicRecommendationPresenter = trustedAnswerPort && topicApprovedClaimAnswerPort
    ? createHoidTrustedTopicRecommendationPresenter({
        loadApprovedClaims: topicApprovedClaimAnswerPort,
        trustedAnswerPort,
        refreshCurrentProgress: (signal?: AbortSignal) => awaitHoidOperationWithSignal(
          () => progressRefreshRef.current(),
          signal,
        ),
      })
    : null;

  // Topic recommendations remain unavailable until the host injects the same signed presenter used by narrative answers.
  const topicRecommendationsTrustReady = trustedTopicRecommendationPresenter !== null;

  const [cargando, setCargando] = useState(false);
  const [canCancelAnswer, setCanCancelAnswer] = useState(false);
  const [cargandoRecomendaciones, setCargandoRecomendaciones] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    {
      id: HOID_STATIC_GREETING_ID,
      emisor: 'hoid',
      kind: HOID_STATIC_GREETING_KIND,
      texto: HOID_STATIC_GREETING_TEXT
    }
  ]);
  const [input, setInput] = useState('');
  const [explanationDepth, setExplanationDepth] = useState<HoidExplanationDepth>('detailed');
  const [recommendationPresentation, setRecommendationPresentation] = useState<HoidEditionRecommendationDisplayProjection | null>(null);
  // Full edition-bound targets stay outside React state. The UI receives only
  // the display projection; navigation resolves the private target from this ref
  // and revalidates it against live progress immediately before opening.
  const recommendationPresentationRef = useRef<HoidEditionBoundRecommendationPresentation | null>(null);
  const recommendationDisplayProjectionRef = useRef<HoidEditionRecommendationDisplayProjection | null>(null);
  const clearRecommendationPresentation = () => {
    recommendationPresentationRef.current = null;
    recommendationDisplayProjectionRef.current = null;
    setRecommendationPresentation(null);
  };
  const commitRecommendationPresentation = (
    trustedPresentation: HoidEditionBoundRecommendationPresentation,
  ): boolean => {
    const display = projectHoidEditionRecommendationsForDisplay(trustedPresentation);
    if (!display) {
      clearRecommendationPresentation();
      return false;
    }
    recommendationPresentationRef.current = trustedPresentation;
    recommendationDisplayProjectionRef.current = display;
    setRecommendationPresentation(display);
    return true;
  };
  const [recommendationMessage, setRecommendationMessage] = useState('');
  const [recommendationSelectedBookId, setRecommendationSelectedBookId] = useState<string | null>(null);
  const [readerPortState, setReaderPortState] = useState<Readonly<{
    port: HoidRecommendationReaderPort;
    workId: string;
  }> | null>(null);
  const [readerOpening, setReaderOpening] = useState(false);
  const [readerMessage, setReaderMessage] = useState('');
  const readerAbortControllerRef = useRef<AbortController | null>(null);
  const handleReaderPortChange = useCallback((
    port: HoidRecommendationReaderPort | null,
    workId: string | null,
  ) => {
    setReaderPortState(port && workId ? Object.freeze({ port, workId }) : null);
    if (!port) {
      readerAbortControllerRef.current?.abort();
      readerAbortControllerRef.current = null;
      setReaderOpening(false);
      setReaderMessage('');
    }
  }, []);
  const [selectedTopicIds, setSelectedTopicIds] = useState<readonly HoidTopicId[]>([]);
  const [topicRecommendations, setTopicRecommendations] = useState<readonly HoidTopicRecommendationDisplayItem[]>([]);
  const topicRecommendationBindingRef = useRef<Readonly<{
    revision: number;
    fingerprint: string;
    selectionKey: string;
    trustPort: HoidTrustedScreenAnswerPort;
  }> | null>(null);
  const clearTopicRecommendationBinding = () => {
    topicRecommendationBindingRef.current = null;
  };
  const [topicRecommendationMessage, setTopicRecommendationMessage] = useState('');
  const [answerScopeMode, setAnswerScopeMode] = useState<HoidAnswerScopeMode>('automatic');
  const [answerScopeBookIds, setAnswerScopeBookIds] = useState<readonly string[]>([]);
  const [answerScopeMessage, setAnswerScopeMessage] = useState('Ámbito automático: la primera respuesta fijará las obras que aporten evidencia; el progreso de cada obra seguirá aplicándose.');

  const liveProgress = progressReaderRef.current();
  const liveProjection = liveProgress ? projectHoidCursorProgressSnapshot(liveProgress) : null;
  const liveProgressScope: HoidConversationProgressScope | null = liveProjection?.status === 'ready'
    ? {
        revision: liveProjection.revision,
        fingerprint: fingerprintHoidCursorProgressProjection(liveProjection),
      }
    : null;

  useEffect(() => {
    conversationTurnSession.invalidate();
    recommendationRequestSession.invalidate();
    setCargandoRecomendaciones(false);
    setCanCancelAnswer(false);
    setCargando(false);
    conversationContextRef.current = null;
    typedConversationContextRef.current = null;
    conversationScopeBindingRef.current = null;
    clearRecommendationPresentation();
    setRecommendationMessage('');
    setRecommendationSelectedBookId(null);
    readerAbortControllerRef.current?.abort();
    readerAbortControllerRef.current = null;
    setReaderOpening(false);
    setTopicRecommendations([]);
    clearTopicRecommendationBinding();
    setTopicRecommendationMessage('');
  }, [liveProgressScope?.revision, liveProgressScope?.fingerprint, progresoPersistenciaEstado, trustedAnswerPort]);

  useEffect(() => () => {
    conversationTurnSession.invalidate();
    recommendationRequestSession.invalidate();
    recommendationPresentationRef.current = null;
    recommendationDisplayProjectionRef.current = null;
    readerAbortControllerRef.current?.abort();
    readerAbortControllerRef.current = null;
  }, []);

  // Filter immediately during render, then prune stale assistant text from state.
  useEffect(() => {
    setMensajes(previous => pruneStaleHoidMessages(previous, liveProgressScope));
  }, [liveProgressScope?.revision, liveProgressScope?.fingerprint, progresoPersistenciaEstado]);

  const resetConversationForAnswerScopeChange = () => {
    conversationContextRef.current = null;
    typedConversationContextRef.current = null;
    conversationScopeBindingRef.current = null;
    conversationTurnSession.invalidate();
    setCanCancelAnswer(false);
    setCargando(false);
    setMensajes([{
      id: HOID_STATIC_GREETING_ID,
      emisor: 'hoid',
      kind: HOID_STATIC_GREETING_KIND,
      texto: HOID_STATIC_GREETING_TEXT,
    }]);
  };

  const changeAnswerScopeMode = (mode: HoidAnswerScopeMode) => {
    if (cargando || mode === answerScopeMode) return;
    const nextIds = mode === 'automatic'
      ? []
      : mode === 'single-work'
        ? answerScopeBookIds.slice(0, 1)
        : answerScopeBookIds.slice(0, 4);
    setAnswerScopeMode(mode);
    setAnswerScopeBookIds(nextIds);
    setAnswerScopeMessage(mode === 'automatic'
      ? 'Ámbito automático: la primera respuesta fijará las obras que aporten evidencia; el progreso de cada obra seguirá aplicándose.'
      : mode === 'single-work'
        ? 'Selecciona exactamente una obra. Solo se considerarán afirmaciones cuya evidencia pertenezca a ella.'
        : 'Selecciona entre dos y cuatro obras. Cada una debe aportar evidencia autorizada; si falta una, Hoid se abstendrá.');
    resetConversationForAnswerScopeChange();
  };

  const toggleAnswerScopeBook = (bookId: string) => {
    if (cargando || answerScopeMode === 'automatic') return;
    const next = toggleHoidAnswerScopeBook(
      { mode: answerScopeMode, bookIds: answerScopeBookIds },
      bookId,
    );
    if (next.bookIds.join('\\n') === answerScopeBookIds.join('\\n')) return;
    setAnswerScopeBookIds(next.bookIds);
    setAnswerScopeMessage(answerScopeMode === 'single-work'
      ? 'La respuesta narrativa quedará limitada a la obra seleccionada.'
      : next.bookIds.length < 2
        ? 'Selecciona al menos dos obras para comparar.'
        : next.bookIds.length === 4
          ? 'Has alcanzado el máximo de cuatro obras.'
          : 'Cada obra seleccionada deberá aportar evidencia desbloqueada.');
    resetConversationForAnswerScopeChange();
  };

  const cancelarRespuesta = () => {
    if (!conversationTurnSession.cancelCurrent()) return;
    setCanCancelAnswer(false);
  };

  const enviarMensaje = async () => {
    if (!input.trim() || cargando || progresoPersistenciaEstado !== 'ready') return;
    const ticket = conversationTurnSession.begin();
    const textoUsuario = input.trim();
    const nuevoMsgUsuario: Mensaje = { id: Date.now().toString(), emisor: 'usuario', texto: textoUsuario };
    setMensajes(prev => [...prev, nuevoMsgUsuario]);
    setInput('');
    setCargando(true);
    setCanCancelAnswer(true);
    let requestScope: HoidConversationProgressScope | null = null;
    const commitCancelledTurn = () => {
      if (!conversationTurnSession.isCurrent(ticket)) return;
      conversationContextRef.current = null;
      typedConversationContextRef.current = null;
      conversationScopeBindingRef.current = null;
      setMensajes(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        emisor: 'hoid',
        texto: 'Consulta cancelada. Hoid ha descartado cualquier resultado parcial o tardío.',
      }]);
    };

    try {
      const currentProgress = await progressRefreshRef.current();
      if (!conversationTurnSession.isCurrent(ticket)) return;
      if (ticket.signal.aborted) { commitCancelledTurn(); return; }
      if (!currentProgress) {
        setMensajes(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          emisor: 'hoid',
          texto: 'No puedo verificar el progreso actual. La respuesta queda bloqueada para evitar spoilers.',
        }]);
        return;
      }
      const requestProjection = projectHoidCursorProgressSnapshot(currentProgress);
      if (requestProjection.status !== 'ready') {
        setMensajes(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          emisor: 'hoid',
          texto: 'No puedo verificar el progreso actual. La respuesta queda bloqueada para evitar spoilers.',
        }]);
        return;
      }
      requestScope = {
        revision: requestProjection.revision,
        fingerprint: fingerprintHoidCursorProgressProjection(requestProjection),
      };
      const intentPlan = classifyHoidConversationIntent(textoUsuario);
      const answerScopeSelection = buildHoidAnswerScopeSelection(answerScopeMode, answerScopeBookIds);
      let respuesta: string;
      let citas: readonly HoidDisplayCitation[] | undefined;
      let segmentos: readonly HoidDisplaySegment[] | undefined;
      let formato: HoidNarrativeLayout | undefined;
      let evidenciaTransversal: HoidDisplayCrossBookEvidenceSummary | undefined;
      // Even neutral fallback text is scoped to the request snapshot. Stale
      // results and cancelled work explicitly clear this scope below.
      let responseScope: HoidConversationProgressScope | null = requestScope;

      if (intentPlan.status !== 'ready') {
        conversationContextRef.current = null;
        typedConversationContextRef.current = null;
        conversationScopeBindingRef.current = null;
        respuesta = 'No he podido validar la pregunta. No la enviaré a ningún proveedor ni ampliaré el contexto.';
      } else if (intentPlan.mode === 'reading-progress') {
        conversationContextRef.current = null;
        typedConversationContextRef.current = null;
        conversationScopeBindingRef.current = null;
        if (!conversationGateway) {
          respuesta = 'El runtime de progreso no está disponible. No mostraré una posición estimada.';
        } else {
          const result = await conversationGateway.readingContext({ progress: currentProgress });
          if (!conversationTurnSession.isCurrent(ticket)) return;
          if (ticket.signal.aborted) { commitCancelledTurn(); return; }
          if (result.status === 'ready') {
            responseScope = {
              revision: result.progressRevision,
              fingerprint: result.progressFingerprint,
            };
            const positions = result.context.positions;
            respuesta = positions.length === 0
              ? 'No hay obras iniciadas en el progreso guardado.'
              : 'Este es tu progreso de lectura registrado:\\n\\n'
                + positions.map(position => position.status === 'completed'
                  ? `• ${position.title}: obra marcada como terminada.`
                  : `• ${position.title}: estás en el capítulo ${position.currentChapter}; completado hasta ${position.completedThroughChapter ?? 'ningún capítulo'}.`
                ).join('\\n')
                + `\\n\\nTienes ${result.context.startedCount} obras con progreso registrado de ${result.context.catalogSize}. Hay ${result.context.trackableUnstartedCount} obras sin empezar con estructura verificada y ${result.context.untrackedWorkCount} obras cuya segmentación todavía no está verificada. Esto describe únicamente tu posición registrada, no es un resumen narrativo.`;
          } else {
            respuesta = result.reason === 'progress-changed'
              ? 'Tu progreso ha cambiado mientras consultaba tu posición. He descartado el resultado; vuelve a preguntarme.'
              : 'No puedo verificar el progreso actual. No mostraré una posición de lectura estimada.';
          }
        }
      } else if (intentPlan.mode === 'catalogue-recommendation') {
        conversationContextRef.current = null;
        typedConversationContextRef.current = null;
        conversationScopeBindingRef.current = null;
        const presentation = createHoidEditionBoundRecommendationPresentation(
          currentProgress,
          3,
        );
        if (presentation.status === 'ready') {
          responseScope = {
            revision: presentation.progressRevision,
            fingerprint: presentation.progressFingerprint,
          };
          respuesta = presentation.items.length === 0
            ? 'No hay obras en curso que retomar ni obras sin empezar en el catálogo actual.'
            : presentation.items.map(item => `${item.heading}\n${item.detail}`).join('\n\n')
              + '\n\nEstas explicaciones utilizan únicamente tu progreso y los manifiestos de lectura. No establecen una cronología canónica ni desbloquean información narrativa.';
        } else if (presentation.status === 'selection-required') {
          responseScope = {            revision: presentation.progressRevision,
            fingerprint: presentation.progressFingerprint,
          };
          respuesta = `${presentation.heading}\n${presentation.detail}\n\n`
            + presentation.choices.map(choice =>
              `• ${choice.title} · capítulo actual ${choice.currentChapter} · completado hasta ${choice.completedThroughChapter ?? 'ningún capítulo'}`,
            ).join('\n')
            + '\n\nAbre el panel «Retomar y descubrir» y selecciona la obra que quieres continuar.';
        } else {
          respuesta = presentation.reason === 'invalid-progress'
            ? 'No puedo verificar el progreso actual. No mostraré recomendaciones.'
            : 'No puedo generar una recomendación válida con esos parámetros.';
        }
      } else if (answerScopeSelection.status === 'incomplete') {
        conversationContextRef.current = null;
        typedConversationContextRef.current = null;
        conversationScopeBindingRef.current = null;
        responseScope = requestScope;
        respuesta = answerScopeSelection.reason === 'one-work-required'
          ? 'Selecciona exactamente una obra para limitar esta respuesta narrativa.'
          : answerScopeSelection.reason === 'two-to-four-works-required'
            ? 'Selecciona entre dos y cuatro obras para una comparación narrativa.'
            : 'La selección de obras no es válida. No enviaré la consulta al runtime.';
      } else if (!conversationGateway) {
        conversationContextRef.current = null;
        typedConversationContextRef.current = null;
        conversationScopeBindingRef.current = null;
        respuesta = 'El runtime de conocimiento no está disponible. No se enviará la pregunta a un proveedor alternativo.';
      } else if (!trustedAnswerPort) {
        conversationContextRef.current = null;
        typedConversationContextRef.current = null;
        conversationScopeBindingRef.current = null;
        responseScope = requestScope;
        respuesta = 'La presentación narrativa está desactivada porque el host todavía no ha provisionado una autoridad editorial firmada. Puedo consultar tu progreso y las recomendaciones de catálogo sin revelar contenido narrativo.';
      } else {
        const priorConversationScopeBinding = conversationScopeBindingRef.current;
        const result = await conversationGateway.answer({
          question: textoUsuario,
          progress: currentProgress,
          intent: intentPlan.intent,
          depth: explanationDepth,
          context: conversationContextRef.current ?? undefined,
          typedContext: typedConversationContextRef.current ?? undefined,
          ...(conversationScopeBindingRef.current
            ? { scopeBinding: conversationScopeBindingRef.current }
            : {}),
          ...(answerScopeSelection.status === 'ready' ? { bookScope: answerScopeSelection.scope } : {}),
        }, { signal: ticket.signal });
        if (!conversationTurnSession.isCurrent(ticket)) return;
        if (ticket.signal.aborted) { commitCancelledTurn(); return; }
        if (result.status === 'ready' && result.answer.reason === 'request-cancelled') {
          responseScope = null;
          respuesta = 'Consulta cancelada. Hoid ha descartado cualquier resultado parcial o tardío.';
          conversationContextRef.current = null;
          typedConversationContextRef.current = null;
          conversationScopeBindingRef.current = null;
        } else if (result.status === 'ready') {
          responseScope = {
            revision: result.progressRevision,
            fingerprint: result.progressFingerprint,
          };
          const trustedResult = await trustedAnswerPort.present(result.answer, result.depth);
          if (!conversationTurnSession.isCurrent(ticket)) return;
          if (ticket.signal.aborted) { commitCancelledTurn(); return; }
          if (trustedResult.status === 'ready') {
            const presentation = trustedResult.presentation;
            const scopeValidation = validateHoidPresentedAnswerScope(
              presentation,
              answerScopeSelection.status === 'ready' ? answerScopeSelection.scope : undefined,
            );
            if (scopeValidation.status !== 'ready') {
              respuesta = 'No puedo verificar que las citas pertenezcan exactamente a las obras seleccionadas. No mostraré el contenido.';
              conversationContextRef.current = null;
              typedConversationContextRef.current = null;
              conversationScopeBindingRef.current =
                result.conversationScopeBinding === priorConversationScopeBinding
                  ? priorConversationScopeBinding
                  : null;
              responseScope = requestScope;
            } else {
              const requiresCrossWorkCoverage =
                (answerScopeSelection.status === 'ready' &&
                  answerScopeSelection.scope.mode === 'cross-work') ||
                (answerScopeSelection.status === 'unscoped' &&
                  scopeValidation.sourceBookIds.length > 1);
              const crossBookResult = requiresCrossWorkCoverage
                ? summarizeHoidPresentedCrossBookEvidence(presentation)
                : null;
              const crossBookCoverageValid =
                crossBookResult?.status === 'ready' &&
                crossBookResult.summary.workCount === scopeValidation.sourceBookIds.length &&
                crossBookResult.summary.works.every(work =>
                  scopeValidation.sourceBookIds.includes(work.sourceBookId),
                );

              if (requiresCrossWorkCoverage && !crossBookCoverageValid) {
                respuesta = 'No puedo verificar la procedencia por segmento y capítulo de todas las obras seleccionadas. No mostraré una comparación parcial.';
                conversationContextRef.current = null;
                typedConversationContextRef.current = null;
                conversationScopeBindingRef.current =
                  result.conversationScopeBinding === priorConversationScopeBinding
                    ? priorConversationScopeBinding
                    : null;
                responseScope = requestScope;
              } else {
                const displayProjection = projectHoidAnswerForDisplay(presentation);
                if (!displayProjection) {
                  throw new Error('Invalid trusted answer display projection');
                }
                respuesta = displayProjection.text;
                citas = displayProjection.citations;
                segmentos = displayProjection.segments;
                formato = displayProjection.layout;
                if (
                  crossBookResult?.status === 'ready' &&
                  crossBookResult.summary.workCount > 1
                ) {
                  evidenciaTransversal =
                    projectHoidCrossBookEvidenceForDisplay(crossBookResult.summary) ?? undefined;
                }
                const returnedBinding = result.conversationScopeBinding ?? null;
                const bindingBookIds = returnedBinding?.scope.bookIds ?? [];
                const presentedBookIds = [...scopeValidation.sourceBookIds].sort();
                const presentedChapters = new Map<string, Set<number>>();
                for (const citation of presentation.citations) {
                  let chapters = presentedChapters.get(citation.sourceBookId);
                  if (!chapters) {
                    chapters = new Set<number>();
                    presentedChapters.set(citation.sourceBookId, chapters);
                  }
                  chapters.add(citation.chapter);
                }
                // The legacy conversation binding stores chapter numbers only.
                // Do not retain follow-up context when a visible label needed an ordinal disambiguator.
                const hasAmbiguousChapterIdentity = displayProjection.citations.some(
                  citation => citation.chapterLabelAmbiguous,
                );
                const bindingMatchesPresentation = !hasAmbiguousChapterIdentity && (!returnedBinding || (
                  bindingBookIds.length === presentedBookIds.length &&
                  bindingBookIds.every((bookId, index) => bookId === presentedBookIds[index]) &&
                  returnedBinding.works.every(work => {
                    const chapters = [...(presentedChapters.get(work.bookId) ?? [])]
                      .sort((left, right) => left - right);
                    return chapters.length === work.chapters.length &&
                      chapters.every((chapter, index) => chapter === work.chapters[index]);
                  })
                ));
                if (!bindingMatchesPresentation) {
                  respuesta = 'La procedencia del contexto conversacional no coincide con las fuentes presentadas. No conservaré ese contexto.';
                  citas = undefined;
                  segmentos = undefined;
                  formato = undefined;
                  evidenciaTransversal = undefined;
                  conversationContextRef.current = null;
                  typedConversationContextRef.current = null;
                  conversationScopeBindingRef.current =
                    returnedBinding === priorConversationScopeBinding
                      ? priorConversationScopeBinding
                      : null;
                  responseScope = requestScope;
                } else {
                  conversationScopeBindingRef.current = returnedBinding;
                  conversationContextRef.current = returnedBinding
                    ? result.conversationContext ?? null
                    : null;
                  typedConversationContextRef.current = returnedBinding
                    ? result.typedConversationContext ?? null
                    : null;
                }
              }
            }
          } else {
            respuesta = trustedResult.text;
            conversationContextRef.current = null;
            typedConversationContextRef.current = null;
            conversationScopeBindingRef.current =
              result.conversationScopeBinding === priorConversationScopeBinding
                ? priorConversationScopeBinding
                : null;
            responseScope = requestScope;
          }
        } else {
          conversationContextRef.current = null;
          typedConversationContextRef.current = null;
          if (
            result.reason === 'progress-changed' ||
            result.reason === 'invalid-progress' ||
            result.reason === 'context-stale' ||
            result.reason === 'context-scope-unavailable' ||
            result.reason === 'cancelled'
          ) conversationScopeBindingRef.current = null;
          respuesta = result.reason === 'progress-changed'
            ? 'Tu progreso de lectura ha cambiado mientras preparaba la respuesta. He descartado el resultado; vuelve a formular la pregunta.'
            : result.reason === 'cancelled'
              ? 'Consulta cancelada. Hoid ha descartado cualquier resultado parcial o tardío.'
              : result.reason === 'invalid-progress'
              ? 'No puedo verificar el progreso actual. La respuesta queda bloqueada para evitar spoilers.'
              : result.reason === 'context-ambiguous'
                ? 'No puedo identificar con seguridad el referente. Repite los nombres de los personajes para evitar una suposición.'
                : result.reason === 'context-unavailable'
                  ? 'No hay una relación anterior inequívoca en esta conversación. Vuelve a mencionar los personajes.'
                  : result.reason === 'context-scope-mismatch'
                    ? 'El ámbito solicitado no coincide con el de esta conversación. Pulsa «Nuevo tema» para iniciar otra con la selección actual.'
                    : result.reason === 'context-scope-unavailable'
                      ? 'No puedo verificar el ámbito de la respuesta anterior. No ampliaré la conversación a otras obras.'
                      : result.reason === 'context-stale'
                    ? 'El progreso ha cambiado. Vuelve a mencionar los personajes para comprobar de nuevo la relación.'
                    : result.reason === 'entity-blocked' || result.reason === 'entity-ambiguous' || result.reason === 'entity-unavailable'
                      ? 'No hay afirmaciones editoriales verificadas y autorizadas para esta pregunta y tu progreso. Hoid no inventará una explicación.'
                      : 'No hay una respuesta verificable disponible. No recurriré a un proveedor alternativo ni completaré la respuesta mediante suposiciones.';
          if (
            result.reason === 'entity-blocked' ||
            result.reason === 'entity-ambiguous' ||
            result.reason === 'entity-unavailable' ||
            result.reason === 'context-ambiguous' ||
            result.reason === 'context-unavailable' ||
            result.reason === 'context-stale' ||
            result.reason === 'context-scope-unavailable' ||
            result.reason === 'context-scope-mismatch'
          ) responseScope = requestScope;
        }
      }

      // The gateway checks before and after its asynchronous work. This final
      // comparison closes the remaining interval before React commits the text.
      const latestProgress = await progressRefreshRef.current();
      if (!conversationTurnSession.isCurrent(ticket)) return;
      if (ticket.signal.aborted) { commitCancelledTurn(); return; }
      const latestProjection = latestProgress
        ? projectHoidCursorProgressSnapshot(latestProgress)
        : null;
      const latestScope: HoidConversationProgressScope | null = latestProjection?.status === 'ready'
        ? {
            revision: latestProjection.revision,
            fingerprint: fingerprintHoidCursorProgressProjection(latestProjection),
          }
        : null;
      if (requestScope && responseScope && !canCommitHoidProgressScopedResponse(requestScope, responseScope, latestScope)) {
        respuesta = 'Tu progreso ha cambiado mientras preparaba la respuesta. He descartado el resultado para proteger tu lectura.';
        responseScope = null;
        // A stale response must lose every citation/provenance field before the
        // neutral notice is committed as an unscoped chat message.
        citas = undefined;
        segmentos = undefined;
        formato = undefined;
        evidenciaTransversal = undefined;
        conversationContextRef.current = null;
        typedConversationContextRef.current = null;
        conversationScopeBindingRef.current = null;
      }

      if (ticket.signal.aborted) {
        respuesta = 'Consulta cancelada. Hoid ha descartado cualquier resultado parcial o tardío.';
        responseScope = null;
        citas = undefined;
        segmentos = undefined;
        formato = undefined;
        evidenciaTransversal = undefined;
        conversationContextRef.current = null;
        typedConversationContextRef.current = null;
        conversationScopeBindingRef.current = null;
      }

      setMensajes(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        emisor: 'hoid',
        texto: respuesta,
        ...(responseScope ? { progressScope: responseScope } : {}),
        ...(citas && citas.length > 0 ? { citas } : {}),
        ...(segmentos && formato ? { segmentos, formato } : {}),
        ...(evidenciaTransversal ? { evidenciaTransversal } : {}),
      }]);
    } catch {
      if (!conversationTurnSession.isCurrent(ticket)) return;
      if (ticket.signal.aborted) {
        commitCancelledTurn();
      } else {
        conversationContextRef.current = null;
        typedConversationContextRef.current = null;
        conversationScopeBindingRef.current = null;
        setMensajes(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          emisor: 'hoid',
          texto: 'No puedo responder de forma verificable en este momento. No enviaré la pregunta a un proveedor no configurado ni completaré la respuesta mediante suposiciones.',
          ...(requestScope ? { progressScope: requestScope } : {}),
        }]);
      }
    } finally {
      if (conversationTurnSession.finish(ticket)) {
        setCanCancelAnswer(false);
        setCargando(false);
      }
    }
  };

  const cargarRecomendaciones = async (activeBookId?: string) => {
    if (cargandoRecomendaciones || progresoPersistenciaEstado !== 'ready') return;
    const ticket = recommendationRequestSession.begin();
    if (!ticket) return;

    conversationTurnSession.invalidate();
    setCanCancelAnswer(false);
    setCargando(false);
    conversationContextRef.current = null;
    typedConversationContextRef.current = null;
    conversationScopeBindingRef.current = null;
    setCargandoRecomendaciones(true);
    clearRecommendationPresentation();
    setRecommendationMessage('');
    setRecommendationSelectedBookId(activeBookId ?? null);

    try {
      const currentProgress = await awaitHoidOperationWithSignal(
        () => progressRefreshRef.current(),
        ticket.signal,
      );
      if (!recommendationRequestSession.isCurrent(ticket)) return;
      const projection = currentProgress
        ? projectHoidCursorProgressSnapshot(currentProgress)
        : null;
      if (!currentProgress || projection?.status !== 'ready') {
        setRecommendationMessage('No puedo verificar el progreso actual. No mostraré recomendaciones.');
        return;
      }

      const presentation = createHoidEditionBoundRecommendationPresentation(
        currentProgress,
        3,
        activeBookId,
      );
      if (presentation.status === 'unavailable') {
        setRecommendationMessage(
          presentation.reason === 'invalid-active-work'
            ? 'La obra seleccionada ya no tiene un cursor abierto. Actualiza las recomendaciones y vuelve a elegir.'
            : 'No puedo verificar el progreso, el manifiesto o los parámetros. No mostraré recomendaciones.',
        );
        return;
      }

      // The synchronous adapter is still followed by a fresh authoritative read.
      // This closes the interval between calculation and committing React state.
      const latestProgress = await awaitHoidOperationWithSignal(
        () => progressRefreshRef.current(),
        ticket.signal,
      );
      if (!recommendationRequestSession.isCurrent(ticket)) return;
      const latestProjection = latestProgress
        ? projectHoidCursorProgressSnapshot(latestProgress)
        : null;
      const freshness = latestProjection?.status === 'ready'
        ? validateHoidEditionBoundRecommendationFreshness(presentation, latestProjection)
        : 'invalid-progress';
      if (freshness !== 'current') {
        setRecommendationMessage(
          freshness === 'stale'
            ? 'Tu progreso ha cambiado. Vuelve a solicitar las recomendaciones.'
            : 'No puedo verificar la presentación o el progreso actual. No mostraré recomendaciones.',
        );
        return;
      }

      if (!commitRecommendationPresentation(presentation)) {
        setRecommendationMessage('No puedo reducir la recomendación a metadatos de presentación seguros. No mostraré resultados.');
        return;
      }
      setRecommendationMessage(presentation.status === 'selection-required'
        ? 'Hay varias obras en curso. Selecciona explícitamente cuál quieres reanudar.'
        : `Se han preparado ${presentation.items.length} recomendaciones vinculadas al progreso y a sus manifiestos. No es una ruta canónica.`);
    } catch {
      if (!recommendationRequestSession.isCurrent(ticket)) return;
      clearRecommendationPresentation();
      setRecommendationMessage('No puedo verificar el progreso o el catálogo. No mostraré recomendaciones.');
    } finally {
      if (recommendationRequestSession.finish(ticket)) {
        setCargandoRecomendaciones(false);
      }
    }
  };

  const toggleTopicInterest = (topicId: HoidTopicId) => {
    recommendationRequestSession.invalidate();
    setCargandoRecomendaciones(false);
    setSelectedTopicIds(previous => previous.includes(topicId)
      ? previous.filter(item => item !== topicId)
      : [...previous, topicId]);
    setTopicRecommendations([]);
    clearTopicRecommendationBinding();
    setTopicRecommendationMessage('');
  };

  const cargarRecomendacionesTematicas = async () => {
    if (cargandoRecomendaciones) return;
    const ticket = recommendationRequestSession.begin();
    if (!ticket) return;

    conversationTurnSession.invalidate();
    setCanCancelAnswer(false);
    setCargando(false);
    conversationContextRef.current = null;
    typedConversationContextRef.current = null;
    conversationScopeBindingRef.current = null;
    setTopicRecommendations([]);
    clearTopicRecommendationBinding();
    setTopicRecommendationMessage('');
    setCargandoRecomendaciones(true);
    const selectedTopicSnapshot = Object.freeze([...selectedTopicIds]);

    try {
      if (!topicRecommendationsTrustReady || !trustedAnswerPort || !trustedTopicRecommendationPresenter) {
        setTopicRecommendationMessage('Las recomendaciones temáticas están temporalmente bloqueadas hasta que cada afirmación pase por la autoridad editorial Ed25519 del host.');
        return;
      }
      if (selectedTopicSnapshot.length === 0) {
        setTopicRecommendationMessage('Selecciona al menos un tema de interés explícito.');
        return;
      }
      if (progresoPersistenciaEstado !== 'ready' || !topicInterestGateway) {
        setTopicRecommendationMessage('El progreso o el servicio de recomendaciones no está disponible. No mostraré resultados.');
        return;
      }

      const currentProgress = await awaitHoidOperationWithSignal(
        () => progressRefreshRef.current(),
        ticket.signal,
      );
      if (!recommendationRequestSession.isCurrent(ticket)) return;
      const projection = currentProgress ? projectHoidCursorProgressSnapshot(currentProgress) : null;
      if (!currentProgress || projection?.status !== 'ready') {
        setTopicRecommendationMessage('No puedo verificar el progreso actual. No mostraré recomendaciones temáticas.');
        return;
      }
      const progressIdentity = {
        revision: projection.revision,
        fingerprint: fingerprintHoidCursorProgressProjection(projection),
      };
      const context = createHoidTopicInterestContext(selectedTopicSnapshot, progressIdentity);
      if (!context) {
        setTopicRecommendationMessage('La selección temática no es válida. No mostraré recomendaciones.');
        return;
      }

      const result = await topicInterestGateway.recommend({
        progress: currentProgress,
        context,
        limit: 5,
      }, ticket.signal);
      if (!recommendationRequestSession.isCurrent(ticket)) return;
      if (result.status === 'ready') {
        const verified = await trustedTopicRecommendationPresenter.present({
          items: result.items,
          progress: currentProgress,
          progressRevision: result.progressRevision,
          progressFingerprint: result.progressFingerprint,
        }, ticket.signal);
        if (!recommendationRequestSession.isCurrent(ticket)) return;
        if (verified.status !== 'ready') {
          setTopicRecommendations([]);
          clearTopicRecommendationBinding();
          setTopicRecommendationMessage(
            verified.reason === 'progress-changed'
              ? 'Tu progreso ha cambiado. Vuelve a buscar para recalcular las autorizaciones.'
              : 'No puedo verificar las afirmaciones y sus firmas editoriales. No mostraré recomendaciones temáticas.',
          );
          return;
        }

        const latestProgress = await awaitHoidOperationWithSignal(
          () => progressRefreshRef.current(),
          ticket.signal,
        );
        if (!recommendationRequestSession.isCurrent(ticket)) return;
        const latestProjection = latestProgress
          ? projectHoidCursorProgressSnapshot(latestProgress)
          : null;
        if (
          latestProjection?.status !== 'ready' ||
          latestProjection.revision !== result.progressRevision ||
          fingerprintHoidCursorProgressProjection(latestProjection) !== result.progressFingerprint
        ) {
          setTopicRecommendations([]);
          clearTopicRecommendationBinding();
          setTopicRecommendationMessage('Tu progreso ha cambiado. Vuelve a buscar para recalcular las autorizaciones.');
          return;
        }
        const topicDisplayItems = projectHoidTopicRecommendationsForDisplay(verified.items);
        if (!topicDisplayItems) {
          setTopicRecommendations([]);
          clearTopicRecommendationBinding();
          setTopicRecommendationMessage('No puedo reducir las recomendaciones temáticas a metadatos seguros. No mostraré resultados.');
          return;
        }
        setTopicRecommendations(topicDisplayItems);
        topicRecommendationBindingRef.current = Object.freeze({
          revision: verified.progressRevision,
          fingerprint: verified.progressFingerprint,
          selectionKey: selectedTopicSnapshot.join('\n'),
          trustPort: trustedAnswerPort,
        });
        setTopicRecommendationMessage(
          verified.items.length === 0
            ? 'No hay coincidencias temáticas aprobadas para esta selección.'
            : 'Estas recomendaciones utilizan afirmaciones firmadas, asociaciones editoriales aprobadas y evidencias ya desbloqueadas.',
        );
      } else if (result.status === 'none') {
        clearTopicRecommendationBinding();
        setTopicRecommendationMessage(
          'Todavía no hay asociaciones temáticas aprobadas y seguras para estos intereses. No inferiré recomendaciones por semejanza.',
        );
      } else {
        clearTopicRecommendationBinding();
        setTopicRecommendationMessage(
          result.reason === 'progress-changed' || result.reason === 'context-stale'
            ? 'Tu progreso ha cambiado. Vuelve a buscar para recalcular las autorizaciones.'
            : 'No puedo verificar las asociaciones temáticas o sus evidencias. No mostraré recomendaciones.',
        );
      }
    } catch {
      if (!recommendationRequestSession.isCurrent(ticket)) return;
      setTopicRecommendations([]);
      clearTopicRecommendationBinding();
      setTopicRecommendationMessage('No puedo verificar las recomendaciones temáticas. No mostraré resultados alternativos.');
    } finally {
      if (recommendationRequestSession.finish(ticket)) {
        setCargandoRecomendaciones(false);
      }
    }
  };

  const cancelarRecomendaciones = () => {
    if (!recommendationRequestSession.cancelCurrent()) return;
    setCargandoRecomendaciones(false);
    clearRecommendationPresentation();
    setRecommendationSelectedBookId(null);
    setRecommendationMessage('Solicitud cancelada. No mostraré resultados parciales.');
    setTopicRecommendations([]);
    clearTopicRecommendationBinding();
    setTopicRecommendationMessage('');
  };

  // A recommendation view model is visible only for its exact validated progress revision and fingerprint.
  const privateRecommendationPresentation = recommendationPresentationRef.current;
  const recommendationsAreCurrent =
    recommendationPresentation !== null &&
    recommendationDisplayProjectionRef.current === recommendationPresentation &&
    privateRecommendationPresentation !== null &&
    liveProjection?.status === 'ready' &&
    validateHoidEditionBoundRecommendationFreshness(
      privateRecommendationPresentation,
      liveProjection,
    ) === 'current';
  const describeRecommendationNavigation = (
    target: unknown,
    progressRevision: number,
    progressFingerprint: string,
  ): string => {
    const handoff = prepareHoidRecommendationNavigationHandoff(
      target,
      liveProgress,
      progressRevision,
      progressFingerprint,
      recommendationSelectedBookId ?? undefined,
    );
    if (handoff.status !== 'ready') {
      return 'Destino no disponible: el progreso o el manifiesto han cambiado. Actualiza las recomendaciones.';
    }
    if (handoff.handoff.locatorStatus !== 'verified') {
      return `Cursor revalidado · capítulo ${handoff.handoff.cursor.chapterNumber}; no hay localizador verificado. No se abrirá una ruta inventada.`;
    }
    const readerReady = readerPortState?.workId === handoff.handoff.cursor.bookId;
    return readerReady
      ? `Destino revalidado contra el progreso y la edición · capítulo ${handoff.handoff.cursor.chapterNumber}. Lector EPUB local disponible.`
      : `Destino revalidado contra el progreso y la edición · capítulo ${handoff.handoff.cursor.chapterNumber}. Importa y verifica el EPUB de esta obra para abrirlo localmente.`;
  };

  const describeRecommendationNavigationForDisplay = (sourceId: string): string => {
    const trusted = recommendationPresentationRef.current;
    if (
      recommendationDisplayProjectionRef.current !== recommendationPresentation ||
      !trusted ||
      trusted.status !== 'ready'
    ) return 'Destino no disponible: actualiza las recomendaciones para volver a verificarlo.';
    const item = trusted.items.find(candidate => candidate.sourceId === sourceId);
    if (!item) return 'Destino no disponible: no existe una recomendación privada asociada a esta obra.';
    return describeRecommendationNavigation(
      item.target,
      trusted.progressRevision,
      trusted.progressFingerprint,
    );
  };

  const openRecommendationInReader = async (
    target: unknown,
    sourceId: string,
    progressRevision: number,
    progressFingerprint: string,
  ) => {
    const activeReader = readerPortState;
    if (!activeReader || activeReader.workId !== sourceId || readerOpening) {
      setReaderMessage('Importa y verifica el EPUB de esta obra antes de abrir el capítulo.');
      return;
    }
    readerAbortControllerRef.current?.abort();
    const controller = new AbortController();
    readerAbortControllerRef.current = controller;
    setReaderOpening(true);
    setReaderMessage('Revalidando el progreso y preparando el capítulo local…');
    try {
      const result = await openHoidRecommendationChapter(
        {
          reader: activeReader.port,
          refreshCurrentProgress: () => progressRefreshRef.current(),
        },
        {
          target,
          expectedProgressRevision: progressRevision,
          expectedProgressFingerprint: progressFingerprint,
          selectedActiveBookId: recommendationSelectedBookId ?? undefined,
          signal: controller.signal,
        },
      );
      if (result.status === 'opened') {
        setReaderMessage(
          `Capítulo ${result.target.cursor.chapterNumber} abierto localmente. El progreso no se ha modificado.`,
        );
      } else if (result.reason === 'stale-progress') {
        setReaderMessage('El progreso cambió durante la apertura. Se ha descartado el contenido; actualiza las recomendaciones.');
      } else if (result.reason === 'cancelled') {
        setReaderMessage('Apertura cancelada. No se ha modificado el progreso.');
      } else if (result.reason === 'superseded') {
        setReaderMessage('Se ha iniciado una apertura más reciente. Se ha descartado este resultado anterior.');
      } else {
        setReaderMessage('No se ha podido abrir el capítulo con seguridad. Comprueba la edición local y vuelve a intentarlo.');
      }
    } catch {
      setReaderMessage('La apertura local ha fallado de forma segura.');
    } finally {
      if (readerAbortControllerRef.current === controller) {
        readerAbortControllerRef.current = null;
        setReaderOpening(false);
      }
    }
  };

  const openRecommendationFromDisplay = (sourceId: string) => {
    const trusted = recommendationPresentationRef.current;
    if (
      recommendationDisplayProjectionRef.current !== recommendationPresentation ||
      !trusted ||
      trusted.status !== 'ready'
    ) {
      setReaderMessage('La recomendación ya no está vigente. Actualiza el catálogo antes de abrirla.');
      return;
    }
    const item = trusted.items.find(candidate => candidate.sourceId === sourceId);
    if (
      !item ||
      item.target.kind !== 'edition-cursor' ||
      item.target.locatorStatus !== 'verified'
    ) {
      setReaderMessage('No existe un destino EPUB verificado para esta recomendación.');
      return;
    }
    void openRecommendationInReader(
      item.target,
      item.sourceId,
      trusted.progressRevision,
      trusted.progressFingerprint,
    );
  };

  const cancelReaderOpen = () => {
    readerAbortControllerRef.current?.abort();
    readerAbortControllerRef.current = null;
    setReaderOpening(false);
    setReaderMessage('Apertura cancelada. No se ha modificado el progreso.');
  };

  const visibleMessages = filterVisibleHoidMessages(mensajes, liveProgressScope);
  const topicRecommendationBinding = topicRecommendationBindingRef.current;
  const topicRecommendationsAreCurrent =
    topicRecommendationsTrustReady &&
    topicRecommendationBinding !== null &&
    liveProgressScope !== null &&
    topicRecommendationBinding.revision === liveProgressScope.revision &&
    topicRecommendationBinding.fingerprint === liveProgressScope.fingerprint &&
    topicRecommendationBinding.selectionKey === selectedTopicIds.join('\n') &&
    topicRecommendationBinding.trustPort === trustedAnswerPort;
  const activeConversationScopeBinding = conversationScopeBindingRef.current;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>HOID (SAGAZ) • MODO SEGURO</Text>
          <Text style={styles.headerSub}>
            {progresoPersistenciaEstado === 'loading'
              ? 'Cargando progreso de lectura seguro…'
              : progresoPersistenciaEstado === 'unavailable'
                ? 'Progreso no disponible · consultas bloqueadas'
                : getHoidEditorialRegistryStatus() === 'empty'
                  ? 'Sin afirmaciones editoriales verificadas · runtime estricto'
                  : 'Registro editorial disponible · runtime estricto'}
          </Text>
        </View>
      </View>

      <HoidEpubImportPanel onReaderPortChange={handleReaderPortChange} />

      <View style={styles.recommendationPanel}>
        <View style={styles.recommendationHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.recommendationTitle}>RETOMAR Y DESCUBRIR</Text>
            <Text style={styles.recommendationNote}>
              Primero lecturas en curso; si hay varias, eliges cuál continuar. Después aparecen obras sin empezar. No establece un orden canónico.
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={progresoPersistenciaEstado !== 'ready' || cargandoRecomendaciones}
            style={[
              styles.recommendationButton,
              (progresoPersistenciaEstado !== 'ready' || cargandoRecomendaciones) && styles.disabledButton,
            ]}
            onPress={() => { void cargarRecomendaciones(); }}
          >
            <Text style={styles.recommendationButtonText}>Explorar</Text>
          </TouchableOpacity>
        </View>
        {cargandoRecomendaciones && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <ActivityIndicator color="#818cf8" style={{ marginRight: 12 }} />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Cancelar recomendaciones"
              onPress={cancelarRecomendaciones}
              style={styles.readerCancelButton}
            >
              <Text style={styles.readerCancelButtonText}>Cancelar recomendaciones</Text>
            </TouchableOpacity>
          </View>
        )}
        {recommendationMessage.length > 0 && (
          <Text style={styles.recommendationMessage}>{recommendationMessage}</Text>
        )}
        {readerMessage.length > 0 && (
          <Text style={styles.readerMessage}>{readerMessage}</Text>
        )}
        {readerOpening && (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={cancelReaderOpen}
            style={styles.readerCancelButton}
          >
            <Text style={styles.readerCancelButtonText}>Cancelar apertura</Text>
          </TouchableOpacity>
        )}
        {recommendationsAreCurrent && recommendationPresentation?.status === 'selection-required' && (
          <View style={styles.recommendationSelection}>
            <Text style={styles.recommendationItemText}>{recommendationPresentation.heading}</Text>
            <Text style={styles.recommendationItemMeta}>{recommendationPresentation.detail}</Text>
            {recommendationPresentation.choices.map(choice => (
              <TouchableOpacity
                key={choice.sourceId}
                accessibilityRole="button"
                accessibilityLabel={`Reanudar ${choice.title}, capítulo ${choice.currentChapter}`}
                disabled={cargandoRecomendaciones}
                onPress={() => { void cargarRecomendaciones(choice.sourceId); }}
                style={[styles.recommendationChoice, cargandoRecomendaciones && styles.disabledButton]}
              >
                <Text style={styles.recommendationItemText}>
                  {choice.title} · capítulo actual {choice.currentChapter}
                </Text>
                <Text style={styles.recommendationItemMeta}>{choice.detail}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {recommendationsAreCurrent && recommendationPresentation?.status === 'ready' && recommendationPresentation.items.map(item => (
          <View key={item.sourceId} style={styles.recommendationItem}>
            <Text style={styles.recommendationItemText}>{item.heading}</Text>
            <Text style={styles.recommendationItemMeta}>{item.detail}</Text>
            <Text style={styles.recommendationTarget}>
              {item.navigation === 'catalog-only'
                ? 'Solo catálogo · no existe un destino por capítulo verificado.'
                : describeRecommendationNavigationForDisplay(item.sourceId)}
            </Text>
            {item.navigation === 'verified' && readerPortState?.workId === item.sourceId && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Abrir ${item.heading} en el lector EPUB local`}
                disabled={readerOpening}
                onPress={() => openRecommendationFromDisplay(item.sourceId)}
                style={[styles.readerOpenButton, readerOpening && styles.disabledButton]}
              >
                <Text style={styles.readerOpenButtonText}>
                  {readerOpening ? 'Abriendo…' : 'Abrir capítulo en lector'}
                </Text>
              </TouchableOpacity>
            )}
            {item.navigation === 'verified' && readerPortState?.workId !== item.sourceId && (
              <Text style={styles.readerHint}>
                Importa y verifica la edición EPUB de esta obra para abrir el capítulo localmente.
              </Text>
            )}
            {item.navigation === 'cursor-only' && (
              <Text style={styles.readerHint}>
                El cursor está verificado, pero esta edición no tiene un localizador de capítulo aprobado para apertura.
              </Text>
            )}
          </View>
        ))}
      </View>


      <View style={styles.answerScopePanel}>
        <Text style={styles.recommendationTitle}>ÁMBITO DE RESPUESTA NARRATIVA</Text>
        <Text style={styles.recommendationNote}>
          Limita las evidencias por obra. Elegir un libro no desbloquea capítulos; cada fuente sigue su propio progreso.
        </Text>
        <View style={styles.answerScopeModeRow}>
          {([
            { value: 'automatic', label: 'Automático' },
            { value: 'single-work', label: 'Una obra' },
            { value: 'cross-work', label: 'Comparar 2–4' },
          ] as const).map(option => {
            const selected = answerScopeMode === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: cargando }}
                disabled={cargando}
                onPress={() => changeAnswerScopeMode(option.value)}
                style={[
                  styles.answerScopeMode,
                  selected && styles.answerScopeModeSelected,
                  cargando && styles.disabledButton,
                ]}
              >
                <Text style={[styles.topicChipText, selected && styles.topicChipTextSelected]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {answerScopeMode !== 'automatic' && (
          <View>
            <Text style={styles.answerScopeHint}>
              {answerScopeMode === 'single-work'
                ? 'Selecciona una obra del catálogo:'
                : `Obras seleccionadas: ${answerScopeBookIds.length}/4`}
            </Text>
            <ScrollView
              style={styles.answerScopeScroll}
              contentContainerStyle={styles.topicChipRow}
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              {HOID_SOURCE_BIBLIOGRAPHY.map(work => {
                const selected = answerScopeBookIds.includes(work.id);
                const atLimit = answerScopeMode === 'cross-work' && answerScopeBookIds.length >= 4 && !selected;
                const disabled = cargando || atLimit;
                return (
                  <TouchableOpacity
                    key={work.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled }}
                    accessibilityLabel={`${selected ? 'Quitar' : 'Seleccionar'} ${work.title} para el ámbito narrativo`}
                    disabled={disabled}
                    onPress={() => toggleAnswerScopeBook(work.id)}
                    style={[
                      styles.topicChip,
                      selected && styles.topicChipSelected,
                      disabled && styles.disabledButton,
                    ]}
                  >
                    <Text style={[styles.topicChipText, selected && styles.topicChipTextSelected]}>
                      {work.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
        <Text style={styles.answerScopeMessage}>{answerScopeMessage}</Text>
        {activeConversationScopeBinding && (
          <Text style={styles.recommendationNote}>
            Ámbito de conversación: {activeConversationScopeBinding.works.map(work => {
              const title = HOID_SOURCE_BIBLIOGRAPHY.find(item => item.id === work.bookId)?.title ?? 'Obra verificada';
              return `${title} · capítulos ${work.chapters.join(', ')}`;
            }).join('; ')} (capítulos citados en la última respuesta). El progreso actual sigue limitando cada obra.
          </Text>
        )}
        <TouchableOpacity
          style={styles.scopeResetButton}
          onPress={resetConversationForAnswerScopeChange}
          accessibilityRole="button"
          accessibilityLabel="Iniciar un tema nuevo y reiniciar el ámbito conversacional"
        >
          <Text style={styles.scopeResetButtonText}>Nuevo tema</Text>
        </TouchableOpacity>
        <Text style={styles.recommendationNote}>
          Este ámbito solo afecta a explicaciones narrativas; el progreso y las recomendaciones de catálogo mantienen sus propios contratos.
        </Text>
      </View>

      <View style={styles.topicInterestPanel}>
        <Text style={styles.recommendationTitle}>TEMAS QUE TE INTERESAN</Text>
        <Text style={styles.recommendationNote}>
          Selección explícita y temporal. Los resultados narrativos permanecerán cerrados hasta disponer de presentación firmada.
        </Text>
        <View style={styles.topicChipRow}>
          {HOID_TOPIC_TAXONOMY.map(topic => {
            const selected = selectedTopicIds.includes(topic.id);
            return (
              <TouchableOpacity
                key={topic.id}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: cargandoRecomendaciones }}
                disabled={cargandoRecomendaciones}
                onPress={() => toggleTopicInterest(topic.id)}
                style={[styles.topicChip, selected && styles.topicChipSelected, cargandoRecomendaciones && styles.disabledButton]}
              >
                <Text style={[styles.topicChipText, selected && styles.topicChipTextSelected]}>
                  {topic.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          disabled={progresoPersistenciaEstado !== 'ready' || cargandoRecomendaciones || !topicInterestGateway || !topicRecommendationsTrustReady}
          style={[
            styles.recommendationButton,
            (progresoPersistenciaEstado !== 'ready' || cargandoRecomendaciones || !topicInterestGateway || !topicRecommendationsTrustReady) && styles.disabledButton,
          ]}
          onPress={cargarRecomendacionesTematicas}
        >
          <Text style={styles.recommendationButtonText}>Buscar por temas seleccionados</Text>
        </TouchableOpacity>
        {topicRecommendationMessage.length > 0 && (
          <Text style={styles.recommendationMessage}>{topicRecommendationMessage}</Text>
        )}
        {topicRecommendationsAreCurrent && topicRecommendations.map(item => (
          <View key={item.sourceId} style={styles.topicRecommendationItem}>
            <Text style={styles.recommendationItemText}>{item.title}</Text>
            {item.matches.map(match => (
              <View key={match.key} style={styles.provenanceSegment}>
                <Text style={styles.recommendationItemMeta}>
                  {match.topicLabel} · {match.dimensionLabel}
                </Text>
                <Text style={styles.bubbleText}>{match.reasonText}</Text>
                {match.citations.map((citation, citationIndex) => (
                  <Text key={citation.sourceBookId + ':' + citation.chapter + ':' + citationIndex} style={styles.citationText}>
                    {formatHoidCitationLocation(citation.title, citation.chapter, citation.chapterOrdinal, citation.chapterLabelAmbiguous)}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        ))}
      </View>

      <FlatList
        data={visibleMessages}
        keyExtractor={m => m.id}
        contentContainerStyle={styles.chatList}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.emisor === 'usuario' ? styles.userBubble : styles.hoidBubble]}>
            <Text style={styles.bubbleAuthor}>{item.emisor === 'usuario' ? 'TÚ' : 'HOID'}</Text>
            {item.evidenciaTransversal && (              <View style={styles.citationBlock}>
                <Text style={styles.citationHeading}>
                  EVIDENCIA TRANSVERSAL · {item.evidenciaTransversal.workCount} OBRAS
                </Text>
                {item.evidenciaTransversal.works.map(work => (
                  <Text key={work.sourceBookId} style={styles.citationText}>
                    {work.title} · capítulos {work.chapters.join(', ')}
                  </Text>
                ))}
              </View>
            )}
            {item.segmentos && item.formato ? (
              <View>
                {item.segmentos.map((segmento, index) => (
                  <View key={segmento.claimId} style={styles.provenanceSegment}>
                    {item.formato === 'grouped' && index % 3 === 0 && (
                      <Text style={styles.provenanceHeading}>Bloque {Math.floor(index / 3) + 1}</Text>
                    )}
                    <Text style={styles.bubbleText}>
                      {item.formato === 'numbered' ? `${index + 1}. ` : item.formato === 'grouped' ? '• ' : ''}
                      {segmento.text}
                    </Text>
                    <View style={styles.segmentCitationBlock}>
                      <Text style={styles.citationHeading}>
                        {item.evidenciaTransversal
                          ? 'OBRAS Y CAPÍTULOS DE ESTA AFIRMACIÓN'
                          : 'FUENTES DE ESTE SEGMENTO'}
                      </Text>
                      {(() => {
                        const trace = item.evidenciaTransversal?.segments.find(
                          entry => entry.claimId === segmento.claimId,
                        );
                        return trace
                          ? trace.works.map(work => (
                              <Text key={work.sourceBookId} style={styles.citationText}>
                                {work.title} · capítulos {work.chapters.join(', ')}
                              </Text>
                            ))
                          : segmento.citations.map((cita, citationIndex) => (
                              <Text key={`${cita.sourceBookId}:${cita.chapter}:${citationIndex}`} style={styles.citationText}>
                                {formatHoidCitationLocation(cita.title, cita.chapter, cita.chapterOrdinal, cita.chapterLabelAmbiguous)}
                              </Text>
                            ));
                      })()}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.bubbleText}>{item.texto}</Text>
            )}
            {(!item.segmentos || item.segmentos.length === 0) && item.citas && item.citas.length > 0 && (
              <View style={styles.citationBlock}>
                <Text style={styles.citationHeading}>FUENTES VERIFICADAS</Text>
                {item.citas.map((cita, citationIndex) => (
                  <Text key={`${cita.sourceBookId}:${cita.chapter}:${citationIndex}`} style={styles.citationText}>
                    {formatHoidCitationLocation(cita.title, cita.chapter, cita.chapterOrdinal, cita.chapterLabelAmbiguous)}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}
      />

      {cargando && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 8 }}>
          <ActivityIndicator color="#818cf8" style={{ marginRight: 12 }} />
          {canCancelAnswer && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Cancelar respuesta de Hoid"
              onPress={cancelarRespuesta}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#1e293b' }}
            >
              <Text style={{ color: '#e2e8f0', fontWeight: '600' }}>Cancelar</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.inputContainer}>
        <View style={styles.depthControlHeader}>
          <Text style={styles.depthLabel}>PROFUNDIDAD DE RESPUESTA</Text>
          <Text style={styles.depthNote}>La profundidad nunca desbloquea capítulos ni evidencias.</Text>
        </View>
        <View style={styles.depthOptions}>
          {([
            { value: 'brief', label: 'Breve' },
            { value: 'detailed', label: 'Detallada' },
            { value: 'comparative', label: 'Comparativa' },
          ] as const).map(option => {
            const selected = explanationDepth === option.value;
            const disabled = progresoPersistenciaEstado !== 'ready' || cargando;
            return (
              <TouchableOpacity
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled }}
                disabled={disabled}
                onPress={() => setExplanationDepth(option.value)}
                style={[
                  styles.depthOption,
                  selected && styles.depthOptionSelected,
                  disabled && styles.disabledButton,
                ]}
              >
                <Text style={[styles.depthOptionText, selected && styles.depthOptionTextSelected]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Pregúntale a Hoid..."
            placeholderTextColor="#64748b"
            value={input}
            editable={progresoPersistenciaEstado === 'ready'}
            onChangeText={setInput}
          />
          <TouchableOpacity disabled={progresoPersistenciaEstado !== 'ready' || cargando} style={[styles.sendButton, (progresoPersistenciaEstado !== 'ready' || cargando) && styles.disabledButton]} onPress={enviarMensaje}>
            <Text style={styles.sendButtonText}>➔</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090d16' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#0f172a', borderBottomWidth: 1, borderColor: '#1e293b' },
  headerTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
  headerSub: { color: '#818cf8', fontSize: 11, marginTop: 2 },
  recommendationPanel: { padding: 12, backgroundColor: '#101a2e', borderBottomWidth: 1, borderColor: '#1e293b' },
  recommendationHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recommendationTitle: { color: '#e2e8f0', fontSize: 11, fontWeight: '900', letterSpacing: 1.1 },
  recommendationNote: { color: '#94a3b8', fontSize: 10, marginTop: 3 },
  recommendationButton: { backgroundColor: '#312e81', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18 },
  recommendationButtonText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  recommendationMessage: { color: '#cbd5e1', fontSize: 11, lineHeight: 16, marginTop: 8 },
  answerScopePanel: { padding: 12, backgroundColor: '#111a2d', borderBottomWidth: 1, borderColor: '#334155' },
  answerScopeModeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 },
  answerScopeMode: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 14, borderWidth: 1, borderColor: '#475569', backgroundColor: '#111827' },
  answerScopeModeSelected: { borderColor: '#818cf8', backgroundColor: '#312e81' },
  answerScopeHint: { color: '#cbd5e1', fontSize: 10, marginTop: 10 },
  answerScopeScroll: { maxHeight: 142, marginTop: 4 },
  answerScopeMessage: { color: '#c7d2fe', fontSize: 10, lineHeight: 15, marginTop: 8 },
  scopeResetButton: { alignSelf: 'flex-start', marginTop: 7, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#64748b', backgroundColor: '#111827' },
  scopeResetButtonText: { color: '#c7d2fe', fontSize: 10, fontWeight: '700' },
  topicInterestPanel: { padding: 12, backgroundColor: '#0d1526', borderBottomWidth: 1, borderColor: '#1e293b' },
  topicChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9, marginBottom: 10 },
  topicChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: '#475569', backgroundColor: '#111827' },
  topicChipSelected: { borderColor: '#818cf8', backgroundColor: '#312e81' },
  topicChipText: { color: '#cbd5e1', fontSize: 10 },
  topicChipTextSelected: { color: '#ffffff', fontWeight: '700' },
  topicRecommendationItem: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#26344d', marginTop: 8 },
  recommendationItem: { paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#26344d', marginTop: 7 },
  recommendationSelection: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#26344d' },
  recommendationChoice: { paddingVertical: 8, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: '#26344d', marginTop: 5, borderRadius: 8 },
  recommendationTarget: { color: '#a5b4fc', fontSize: 10, lineHeight: 15, marginTop: 5 },
  readerMessage: { color: '#86efac', fontSize: 10, lineHeight: 15, marginTop: 7 },
  readerOpenButton: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#14532d', borderWidth: 1, borderColor: '#4ade80' },
  readerOpenButtonText: { color: '#dcfce7', fontSize: 10, fontWeight: '800' },
  readerHint: { color: '#94a3b8', fontSize: 9, lineHeight: 14, marginTop: 6 },
  readerCancelButton: { alignSelf: 'flex-start', marginTop: 7, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: '#7f1d1d' },
  readerCancelButtonText: { color: '#fee2e2', fontSize: 9, fontWeight: '800' },
  recommendationItemText: { color: '#f8fafc', fontSize: 12, fontWeight: '700' },
  recommendationItemMeta: { color: '#94a3b8', fontSize: 10, marginTop: 2 },
  disabledButton: { opacity: 0.45 },
  chatList: { padding: 16, paddingBottom: 20 },
  bubble: { padding: 14, borderRadius: 14, marginBottom: 12, maxWidth: '85%' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#0284c7' },
  hoidBubble: { alignSelf: 'flex-start', backgroundColor: '#1e1b4b', borderWidth: 1, borderColor: '#4338ca' },
  bubbleAuthor: { fontSize: 9, fontWeight: '900', color: '#cbd5e1', marginBottom: 4 },
  bubbleText: { color: '#ffffff', fontSize: 13, lineHeight: 19 },
  provenanceSegment: { marginTop: 8 },
  provenanceHeading: { color: '#a5b4fc', fontSize: 10, fontWeight: '800', marginBottom: 4 },
  segmentCitationBlock: { marginTop: 6, paddingTop: 5, borderTopWidth: 1, borderTopColor: '#3730a3' },
  citationBlock: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#3730a3' },
  citationHeading: { color: '#a5b4fc', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  citationText: { color: '#c7d2fe', fontSize: 10, lineHeight: 15, marginTop: 3 },
  inputContainer: { flexDirection: 'column', padding: 12, backgroundColor: '#0f172a', borderTopWidth: 1, borderColor: '#1e293b' },
  depthControlHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  depthLabel: { color: '#c7d2fe', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  depthNote: { color: '#94a3b8', fontSize: 9 },
  depthOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7, marginBottom: 9 },
  depthOption: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: '#475569', backgroundColor: '#111827' },
  depthOptionSelected: { borderColor: '#818cf8', backgroundColor: '#312e81' },
  depthOptionText: { color: '#cbd5e1', fontSize: 10 },
  depthOptionTextSelected: { color: '#ffffff', fontWeight: '700' },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#090d16', color: '#ffffff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#334155', fontSize: 13 },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  sendButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' }
});