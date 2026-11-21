import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useCosmere } from '../context/CosmereContext';
import { createHoidEditorialRuntime, getHoidEditorialRegistryStatus } from '../hoid/editorialRegistry';
import { createHoidCursorEvidenceRuntime, projectHoidCursorProgressSnapshot } from '../hoid/cursorEvidenceRuntime';
import { fingerprintHoidCursorProgressProjection } from '../hoid/knowledgeGraph';
import { createHoidConversationGateway } from '../hoid/conversationGateway';
import {
  type HoidPresentedCitation,
  type HoidPresentedSegment,
} from '../hoid/answerPresentation';
import type { HoidExplanationDepth } from '../hoid/explanationDepth';
import type { HoidTrustedScreenAnswerPort } from '../hoid/trustedScreenAnswer';
import { createHoidTrustedTopicRecommendationPresenter } from '../hoid/trustedTopicRecommendations';
import type { HoidNarrativeLayout } from '../hoid/narrativeComposition';
import type { HoidCrossBookEvidenceSummary } from '../hoid/crossBookEvidence';
import { classifyHoidConversationIntent } from '../hoid/conversationIntent';
import type { HoidConversationContext } from '../hoid/conversationContext';
import type { HoidTypedConversationContext } from '../hoid/typedConversationContext';
import type { HoidRecommendation } from '../hoid/recommendations';
import { HOID_TOPIC_TAXONOMY, type HoidTopicId } from '../hoid/topicTaxonomy';
import { createHoidTopicInterestContext } from '../hoid/topicInterestContext';
import {
  createHoidTopicInterestRecommendationGateway,
} from '../hoid/topicInterestRecommendationsGateway';
import { createHoidApprovedClaimAnswerPort } from '../hoid/topicApprovedClaimAnswerPort';
import { HoidEpubImportPanel } from '../components/HoidEpubImportPanel';
import type { HoidTopicRecommendation } from '../hoid/topicRecommendations';
import {
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
  progressScope?: HoidConversationProgressScope;
  citas?: readonly HoidPresentedCitation[];
  segmentos?: readonly HoidPresentedSegment[];
  formato?: HoidNarrativeLayout;
  evidenciaTransversal?: HoidCrossBookEvidenceSummary;
}

export const HoidScreen: React.FC<{ trustedAnswerPort?: HoidTrustedScreenAnswerPort | null }> = ({ trustedAnswerPort = null }) => {
  const {
    hoidCursorProgressSnapshot,
    getHoidCursorProgressSnapshot,
    refreshHoidCursorProgressSnapshot,
    progresoPersistenciaEstado,
  } = useCosmere();
  const progressReaderRef = useRef(getHoidCursorProgressSnapshot);
  progressReaderRef.current = getHoidCursorProgressSnapshot;
  const progressRefreshRef = useRef(refreshHoidCursorProgressSnapshot);
  progressRefreshRef.current = refreshHoidCursorProgressSnapshot;
  // Ephemeral ID-only context: never persisted to SQLite, messages or providers.
  const conversationContextRef = useRef<HoidConversationContext | null>(null);
  const typedConversationContextRef = useRef<HoidTypedConversationContext | null>(null);
  const answerAbortControllerRef = useRef<AbortController | null>(null);
  const conversationGateway = hoidRuntime
    ? createHoidConversationGateway({
        runtime: hoidRuntime,
        getCurrentProgress: () => progressReaderRef.current(),
        refreshCurrentProgress: () => progressRefreshRef.current(),
      })
    : null;
  const topicInterestGateway = createHoidTopicInterestRecommendationGateway({
    getCurrentProgress: () => progressReaderRef.current(),
    refreshCurrentProgress: () => progressRefreshRef.current(),
    ...(topicApprovedClaimAnswerPort
      ? { answerApprovedClaims: topicApprovedClaimAnswerPort }
      : {}),
  });

  const trustedTopicRecommendationPresenter = trustedAnswerPort && topicApprovedClaimAnswerPort
    ? createHoidTrustedTopicRecommendationPresenter({
        loadApprovedClaims: topicApprovedClaimAnswerPort,
        trustedAnswerPort,
        refreshCurrentProgress: () => progressRefreshRef.current(),
      })
    : null;

  // Topic recommendations remain unavailable until the host injects the same signed presenter used by narrative answers.
  const topicRecommendationsTrustReady = trustedTopicRecommendationPresenter !== null;

  const [cargando, setCargando] = useState(false);
  const [canCancelAnswer, setCanCancelAnswer] = useState(false);
  const [cargandoRecomendaciones, setCargandoRecomendaciones] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    {
      id: '1',
      emisor: 'hoid',
      texto: 'Saludos, viajero de mundos. Soy Sagaz. Estoy usando el runtime estricto con el progreso de lectura vinculado a la edición. El registro editorial todavía está vacío, así que no inventaré hechos ni recurriré a respuestas libres.'
    }
  ]);
  const [input, setInput] = useState('');
  const [explanationDepth, setExplanationDepth] = useState<HoidExplanationDepth>('detailed');
  const [recomendaciones, setRecomendaciones] = useState<readonly HoidRecommendation[]>([]);
  const [recommendationRevision, setRecommendationRevision] = useState<number | null>(null);
  const [recommendationFingerprint, setRecommendationFingerprint] = useState<string | null>(null);
  const [recommendationMessage, setRecommendationMessage] = useState('');
  const [selectedTopicIds, setSelectedTopicIds] = useState<readonly HoidTopicId[]>([]);
  const [topicRecommendations, setTopicRecommendations] = useState<readonly HoidTopicRecommendation[]>([]);
  const [topicRecommendationRevision, setTopicRecommendationRevision] = useState<number | null>(null);
  const [topicRecommendationFingerprint, setTopicRecommendationFingerprint] = useState<string | null>(null);
  const [topicRecommendationSelectionKey, setTopicRecommendationSelectionKey] = useState<string | null>(null);
  const [topicRecommendationMessage, setTopicRecommendationMessage] = useState('');

  const liveProgress = progressReaderRef.current();
  const liveProjection = liveProgress ? projectHoidCursorProgressSnapshot(liveProgress) : null;
  const liveProgressScope: HoidConversationProgressScope | null = liveProjection?.status === 'ready'
    ? {
        revision: liveProjection.revision,
        fingerprint: fingerprintHoidCursorProgressProjection(liveProjection),
      }
    : null;

  useEffect(() => {
    answerAbortControllerRef.current?.abort();
    answerAbortControllerRef.current = null;
    setCanCancelAnswer(false);
    conversationContextRef.current = null;
    typedConversationContextRef.current = null;
    setRecomendaciones([]);
    setRecommendationRevision(null);
    setRecommendationFingerprint(null);
    setRecommendationMessage('');
    setTopicRecommendations([]);
    setTopicRecommendationRevision(null);
    setTopicRecommendationFingerprint(null);
    setTopicRecommendationSelectionKey(null);
    setTopicRecommendationMessage('');
  }, [hoidCursorProgressSnapshot, progresoPersistenciaEstado]);

  useEffect(() => () => {
    answerAbortControllerRef.current?.abort();
    answerAbortControllerRef.current = null;
  }, []);

  // Filter immediately during render, then prune stale assistant text from state.
  useEffect(() => {
    setMensajes(previous => pruneStaleHoidMessages(previous, liveProgressScope));
  }, [liveProgressScope?.revision, liveProgressScope?.fingerprint, progresoPersistenciaEstado]);

  const cancelarRespuesta = () => {
    const controller = answerAbortControllerRef.current;
    if (!controller) return;
    controller.abort();
    setCanCancelAnswer(false);
  };

  const enviarMensaje = async () => {
    if (!input.trim() || cargando || progresoPersistenciaEstado !== 'ready') return;
    const currentProgress = await progressRefreshRef.current();
    if (!currentProgress) return;
    const requestProjection = projectHoidCursorProgressSnapshot(currentProgress);
    if (requestProjection.status !== 'ready') return;
    const requestScope: HoidConversationProgressScope = {
      revision: requestProjection.revision,
      fingerprint: fingerprintHoidCursorProgressProjection(requestProjection),
    };

    const textoUsuario = input.trim();
    const nuevoMsgUsuario: Mensaje = { id: Date.now().toString(), emisor: 'usuario', texto: textoUsuario };
    setMensajes(prev => [...prev, nuevoMsgUsuario]);
    setInput('');
    setCargando(true);
    let answerSignal: AbortSignal | undefined;

    try {
      const intentPlan = classifyHoidConversationIntent(textoUsuario);
      let respuesta: string;
      let citas: readonly HoidPresentedCitation[] | undefined;
      let segmentos: readonly HoidPresentedSegment[] | undefined;
      let formato: HoidNarrativeLayout | undefined;
      let evidenciaTransversal: HoidCrossBookEvidenceSummary | undefined;
      let responseScope: HoidConversationProgressScope | null = null;

      if (intentPlan.status !== 'ready') {
        conversationContextRef.current = null;
        typedConversationContextRef.current = null;
        respuesta = 'No he podido validar la pregunta. No la enviaré a ningún proveedor ni ampliaré el contexto.';
      } else if (!conversationGateway) {
        conversationContextRef.current = null;
        typedConversationContextRef.current = null;
        respuesta = 'El runtime de conocimiento no está disponible. No se enviará la pregunta a un proveedor alternativo.';
      } else if (intentPlan.mode === 'reading-progress') {
        conversationContextRef.current = null;
        typedConversationContextRef.current = null;
        const result = await conversationGateway.readingContext({ progress: currentProgress });
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
              + `\n\nTienes ${result.context.startedCount} obras con progreso registrado de ${result.context.catalogSize}. Hay ${result.context.trackableUnstartedCount} obras sin empezar con estructura verificada y ${result.context.untrackedWorkCount} obras cuya segmentación todavía no está verificada. Esto describe únicamente tu posición registrada, no es un resumen narrativo.`;
        } else {
          respuesta = result.reason === 'progress-changed'
            ? 'Tu progreso ha cambiado mientras consultaba tu posición. He descartado el resultado; vuelve a preguntarme.'
            : 'No puedo verificar el progreso actual. No mostraré una posición de lectura estimada.';
        }
      } else if (intentPlan.mode === 'catalogue-recommendation') {
        conversationContextRef.current = null;
        typedConversationContextRef.current = null;
        const result = await conversationGateway.recommend({ progress: currentProgress, limit: 3 });
        if (result.status === 'ready') {
          responseScope = {
            revision: result.progressRevision,
            fingerprint: result.progressFingerprint,
          };
          const resumeItems = result.items.filter(
            (item): item is Extract<HoidRecommendation, { reason: 'resume-current-work' }> =>
              item.reason === 'resume-current-work',
          );
          const unreadItems = result.items.filter(item => item.reason === 'unread-source');
          const recommendationSections: string[] = [];
          if (resumeItems.length > 0) {
            recommendationSections.push(
              'Para retomar tus lecturas en curso:\\n'
              + resumeItems.map((item, index) =>
                `${index + 1}. ${item.title} · capítulo actual ${item.currentChapter} · completado hasta ${item.completedThroughChapter ?? 'ningún capítulo'}`
              ).join('\\n')
            );
          }
          if (unreadItems.length > 0) {
            recommendationSections.push(
              'Para descubrir obras que todavía no has empezado:\\n'
              + unreadItems.map((item, index) => `${index + 1}. ${item.title}`).join('\\n')
            );
          }
          respuesta = recommendationSections.length === 0
            ? 'No hay obras en curso que retomar ni obras sin empezar en el catálogo actual.'
            : recommendationSections.join('\\n\\n')
              + '\\n\\nLas obras nuevas siguen el orden del catálogo. No es una ruta canónica ni una recomendación argumental: no hay dependencias de lectura aprobadas para establecer ese orden.';
        } else {
          respuesta = result.reason === 'progress-changed'
            ? 'Tu progreso de lectura ha cambiado mientras preparaba la lista. He descartado el resultado; vuelve a solicitarla.'
            : result.reason === 'invalid-progress'
              ? 'No puedo verificar el progreso actual. No mostraré recomendaciones.'
              : 'No puedo verificar el catálogo o el runtime de recomendaciones. No mostraré una lista alternativa.';
        }
      } else if (!trustedAnswerPort) {
        conversationContextRef.current = null;
        typedConversationContextRef.current = null;
        responseScope = requestScope;
        respuesta = 'La presentación narrativa está desactivada porque el host todavía no ha provisionado una autoridad editorial firmada. Puedo consultar tu progreso y las recomendaciones de catálogo sin revelar contenido narrativo.';
      } else {
        const controller = new AbortController();
        answerAbortControllerRef.current = controller;
        answerSignal = controller.signal;
        setCanCancelAnswer(true);
        const result = await conversationGateway.answer({
          question: textoUsuario,
          progress: currentProgress,
          intent: intentPlan.intent,
          depth: explanationDepth,
          context: conversationContextRef.current ?? undefined,
          typedContext: typedConversationContextRef.current ?? undefined,
        }, { signal: controller.signal });
        if (result.status === 'ready' && result.answer.reason === 'request-cancelled') {
          responseScope = null;
          respuesta = 'Consulta cancelada. Hoid ha descartado cualquier resultado parcial o tardío.';
          conversationContextRef.current = null;
          typedConversationContextRef.current = null;
        } else if (result.status === 'ready') {
          responseScope = {
            revision: result.progressRevision,
            fingerprint: result.progressFingerprint,
          };
          const trustedResult = await trustedAnswerPort.present(result.answer, result.depth);
          if (trustedResult.status === 'ready') {
            const presentation = trustedResult.presentation;
            respuesta = presentation.text;
            citas = presentation.citations;
            segmentos = presentation.segments;
            formato = presentation.layout;
            conversationContextRef.current = result.conversationContext ?? null;
            typedConversationContextRef.current = result.typedConversationContext ?? null;
          } else {
            respuesta = trustedResult.text;
            conversationContextRef.current = null;
            typedConversationContextRef.current = null;
            responseScope = requestScope;
          }
        } else {
          conversationContextRef.current = null;
          typedConversationContextRef.current = null;
          respuesta = result.reason === 'progress-changed'
            ? 'Tu progreso de lectura ha cambiado mientras preparaba la respuesta. He descartado el resultado; vuelve a formular la pregunta.'
            : result.reason === 'invalid-progress'
              ? 'No puedo verificar el progreso actual. La respuesta queda bloqueada para evitar spoilers.'
              : result.reason === 'context-ambiguous'
                ? 'No puedo identificar con seguridad el referente. Repite los nombres de los personajes para evitar una suposición.'
                : result.reason === 'context-unavailable'
                  ? 'No hay una relación anterior inequívoca en esta conversación. Vuelve a mencionar los personajes.'
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
            result.reason === 'context-stale'
          ) responseScope = requestScope;
        }
      }

      // The gateway checks before and after its asynchronous work. This final
      // comparison closes the remaining interval before React commits the text.
      const latestProgress = await progressRefreshRef.current();
      const latestProjection = latestProgress
        ? projectHoidCursorProgressSnapshot(latestProgress)
        : null;
      const latestScope: HoidConversationProgressScope | null = latestProjection?.status === 'ready'
        ? {
            revision: latestProjection.revision,
            fingerprint: fingerprintHoidCursorProgressProjection(latestProjection),
          }
        : null;
      if (responseScope && !canCommitHoidProgressScopedResponse(requestScope, responseScope, latestScope)) {
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
      }

      if (answerSignal?.aborted) {
        respuesta = 'Consulta cancelada. Hoid ha descartado cualquier resultado parcial o tardío.';
        responseScope = null;
        citas = undefined;
        segmentos = undefined;
        formato = undefined;
        evidenciaTransversal = undefined;
        conversationContextRef.current = null;
        typedConversationContextRef.current = null;
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
      conversationContextRef.current = null;
      typedConversationContextRef.current = null;
      setMensajes(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        emisor: 'hoid',
        texto: 'No puedo responder de forma verificable en este momento. No enviaré la pregunta a un proveedor no configurado ni completaré la respuesta mediante suposiciones.',
      }]);
    } finally {
      answerAbortControllerRef.current = null;
      setCanCancelAnswer(false);
      setCargando(false);
    }
  };

  const cargarRecomendaciones = async () => {
    conversationContextRef.current = null;
    typedConversationContextRef.current = null;
    if (cargandoRecomendaciones || progresoPersistenciaEstado !== 'ready' || !conversationGateway) return;
    const currentProgress = await progressRefreshRef.current();
    if (!currentProgress) {
      setRecomendaciones([]);
      setRecommendationRevision(null);
      setRecommendationFingerprint(null);
      setRecommendationMessage('No puedo verificar el progreso actual. No mostraré recomendaciones.');
      return;
    }

    setCargandoRecomendaciones(true);
    setRecomendaciones([]);
    setRecommendationRevision(null);
    setRecommendationFingerprint(null);
    setRecommendationMessage('');

    try {
      const result = await conversationGateway.recommend({ progress: currentProgress, limit: 3 });
      if (result.status === 'ready') {
        const latestProgress = await progressRefreshRef.current();
        const latestProjection = latestProgress
          ? projectHoidCursorProgressSnapshot(latestProgress)
          : null;
        if (
          latestProjection?.status !== 'ready' ||
          latestProjection.revision !== result.progressRevision ||
          fingerprintHoidCursorProgressProjection(latestProjection) !== result.progressFingerprint
        ) {
          setRecomendaciones([]);
          setRecommendationRevision(null);
          setRecommendationFingerprint(null);
          setRecommendationMessage('Tu progreso ha cambiado. Vuelve a solicitar las recomendaciones.');
          return;
        }
        setRecomendaciones(result.items);
        setRecommendationRevision(result.progressRevision);
        setRecommendationFingerprint(result.progressFingerprint);
        const resumeCount = result.items.filter(item => item.reason === 'resume-current-work').length;
        const unreadCount = result.items.filter(item => item.reason === 'unread-source').length;
        setRecommendationMessage(result.items.length === 0
          ? 'No hay obras en curso que retomar ni obras sin empezar en el catálogo actual.'
          : `Se priorizan ${resumeCount} obras en curso para retomar y después aparecen ${unreadCount} obras sin empezar. No es una ruta canónica.`);
      } else {
        setRecomendaciones([]);
        setRecommendationRevision(null);
        setRecommendationFingerprint(null);
        setRecommendationMessage(result.reason === 'progress-changed'
          ? 'Tu progreso ha cambiado. Vuelve a solicitar las recomendaciones.'
          : 'No puedo verificar el progreso o el catálogo. No mostraré recomendaciones.');
      }
    } catch {
      setRecomendaciones([]);
      setRecommendationRevision(null);
      setRecommendationFingerprint(null);
      setRecommendationMessage('No puedo verificar el progreso o el catálogo. No mostraré recomendaciones.');
    } finally {
      setCargandoRecomendaciones(false);
    }
  };


  const toggleTopicInterest = (topicId: HoidTopicId) => {
    setSelectedTopicIds(previous => previous.includes(topicId)
      ? previous.filter(item => item !== topicId)
      : [...previous, topicId]);
    setTopicRecommendations([]);
    setTopicRecommendationRevision(null);
    setTopicRecommendationFingerprint(null);
    setTopicRecommendationSelectionKey(null);
    setTopicRecommendationMessage('');
  };

  const cargarRecomendacionesTematicas = async () => {
    conversationContextRef.current = null;
    typedConversationContextRef.current = null;
    setTopicRecommendations([]);
    setTopicRecommendationRevision(null);
    setTopicRecommendationFingerprint(null);
    setTopicRecommendationSelectionKey(null);
    setTopicRecommendationMessage('');

    if (!topicRecommendationsTrustReady || !trustedTopicRecommendationPresenter) {
      setTopicRecommendationMessage('Las recomendaciones temáticas están temporalmente bloqueadas hasta que cada afirmación pase por la autoridad editorial Ed25519 del host.');
      return;
    }
    if (selectedTopicIds.length === 0) {
      setTopicRecommendationMessage('Selecciona al menos un tema de interés explícito.');
      return;
    }
    if (progresoPersistenciaEstado !== 'ready' || !topicInterestGateway) {
      setTopicRecommendationMessage('El progreso o el servicio de recomendaciones no está disponible. No mostraré resultados.');
      return;
    }

    const currentProgress = await progressRefreshRef.current();
    const projection = currentProgress ? projectHoidCursorProgressSnapshot(currentProgress) : null;
    if (!currentProgress || projection?.status !== 'ready') {
      setTopicRecommendationMessage('No puedo verificar el progreso actual. No mostraré recomendaciones temáticas.');
      return;
    }
    const progressIdentity = {
      revision: projection.revision,
      fingerprint: fingerprintHoidCursorProgressProjection(projection),
    };
    const context = createHoidTopicInterestContext(selectedTopicIds, progressIdentity);
    if (!context) {
      setTopicRecommendationMessage('La selección temática no es válida. No mostraré recomendaciones.');
      return;
    }

    setCargandoRecomendaciones(true);
    try {
      const result = await topicInterestGateway.recommend({
        progress: currentProgress,
        context,
        limit: 5,
      });
      if (result.status === 'ready') {
        const verified = await trustedTopicRecommendationPresenter.present({
          items: result.items,
          progress: currentProgress,
          progressRevision: result.progressRevision,
          progressFingerprint: result.progressFingerprint,
        });
        if (verified.status !== 'ready') {
          setTopicRecommendations([]);
          setTopicRecommendationRevision(null);
          setTopicRecommendationFingerprint(null);
          setTopicRecommendationSelectionKey(null);
          setTopicRecommendationMessage(
            verified.reason === 'progress-changed'
              ? 'Tu progreso ha cambiado. Vuelve a buscar para recalcular las autorizaciones.'
              : 'No puedo verificar las afirmaciones y sus firmas editoriales. No mostraré recomendaciones temáticas.',
          );
          return;
        }

        const latestProgress = await progressRefreshRef.current();
        const latestProjection = latestProgress
          ? projectHoidCursorProgressSnapshot(latestProgress)
          : null;
        if (
          latestProjection?.status !== 'ready' ||
          latestProjection.revision !== result.progressRevision ||
          fingerprintHoidCursorProgressProjection(latestProjection) !== result.progressFingerprint
        ) {
          setTopicRecommendations([]);
          setTopicRecommendationRevision(null);
          setTopicRecommendationFingerprint(null);
          setTopicRecommendationSelectionKey(null);
          setTopicRecommendationMessage('Tu progreso ha cambiado. Vuelve a buscar para recalcular las autorizaciones.');
          return;
        }
        setTopicRecommendations(verified.items);
        setTopicRecommendationRevision(verified.progressRevision);
        setTopicRecommendationFingerprint(verified.progressFingerprint);
        setTopicRecommendationSelectionKey(selectedTopicIds.join('\\n'));
        setTopicRecommendationMessage(
          verified.items.length === 0
            ? 'No hay coincidencias temáticas aprobadas para esta selección.'
            : 'Estas recomendaciones utilizan afirmaciones firmadas, asociaciones editoriales aprobadas y evidencias ya desbloqueadas.',
        );
      } else if (result.status === 'none') {
        setTopicRecommendationSelectionKey(null);
        setTopicRecommendationMessage(
          'Todavía no hay asociaciones temáticas aprobadas y seguras para estos intereses. No inferiré recomendaciones por semejanza.',
        );
      } else {
        setTopicRecommendationSelectionKey(null);
        setTopicRecommendationMessage(
          result.reason === 'progress-changed' || result.reason === 'context-stale'
            ? 'Tu progreso ha cambiado. Vuelve a buscar para recalcular las autorizaciones.'
            : 'No puedo verificar las asociaciones temáticas o sus evidencias. No mostraré recomendaciones.',
        );
      }
    } catch {
      setTopicRecommendations([]);
      setTopicRecommendationRevision(null);
      setTopicRecommendationFingerprint(null);
      setTopicRecommendationSelectionKey(null);
      setTopicRecommendationMessage('No puedo verificar las recomendaciones temáticas. No mostraré resultados alternativos.');
    } finally {
      setCargandoRecomendaciones(false);
    }
  };

  const recommendationsAreCurrent =
    recommendationRevision !== null &&
    recommendationFingerprint !== null &&
    liveProgressScope !== null &&
    recommendationRevision === liveProgressScope.revision &&
    recommendationFingerprint === liveProgressScope.fingerprint;
  const visibleMessages = filterVisibleHoidMessages(mensajes, liveProgressScope);
  const topicRecommendationsAreCurrent =
    topicRecommendationsTrustReady &&
    topicRecommendationRevision !== null &&
    topicRecommendationFingerprint !== null &&
    liveProgressScope !== null &&
    topicRecommendationRevision === liveProgressScope.revision &&
    topicRecommendationFingerprint === liveProgressScope.fingerprint &&
    topicRecommendationSelectionKey === selectedTopicIds.join('\n');

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

      <HoidEpubImportPanel />

      <View style={styles.recommendationPanel}>
        <View style={styles.recommendationHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.recommendationTitle}>RETOMAR Y DESCUBRIR</Text>
            <Text style={styles.recommendationNote}>
              Primero lecturas en curso; después obras sin empezar. No establece un orden canónico.
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={progresoPersistenciaEstado !== 'ready' || cargandoRecomendaciones || !conversationGateway}
            style={[
              styles.recommendationButton,
              (progresoPersistenciaEstado !== 'ready' || cargandoRecomendaciones || !conversationGateway) && styles.disabledButton,
            ]}
            onPress={cargarRecomendaciones}
          >
            <Text style={styles.recommendationButtonText}>Explorar</Text>
          </TouchableOpacity>
        </View>
        {cargandoRecomendaciones && <ActivityIndicator color="#818cf8" style={{ marginTop: 8 }} />}
        {recommendationMessage.length > 0 && (
          <Text style={styles.recommendationMessage}>{recommendationMessage}</Text>
        )}
        {recommendationsAreCurrent && recomendaciones.map(item => (
          <View key={item.sourceId} style={styles.recommendationItem}>
            <Text style={styles.recommendationItemText}>{item.title}</Text>
            <Text style={styles.recommendationItemMeta}>
              {item.reason === 'resume-current-work'
                ? `En curso · capítulo actual ${item.currentChapter} · completado hasta ${item.completedThroughChapter ?? 'ninguno'}`
                : 'Todavía no empezada · orden de catálogo'}
            </Text>
          </View>
        ))}
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
              <View key={match.claimId} style={styles.provenanceSegment}>
                <Text style={styles.recommendationItemMeta}>
                  {match.topicLabel} · {match.dimensionLabel}
                </Text>
                <Text style={styles.bubbleText}>{match.reasonText}</Text>
                {match.citations.map(citation => (
                  <Text key={citation.evidenceId} style={styles.citationText}>
                    {citation.title} · capítulo {citation.chapter}
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
            {item.evidenciaTransversal && (
              <View style={styles.citationBlock}>
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
                      <Text style={styles.citationHeading}>FUENTES DE ESTE SEGMENTO</Text>
                      {segmento.citations.map(cita => (
                        <Text key={cita.evidenceId} style={styles.citationText}>
                          {cita.title} · capítulo {cita.chapter}
                        </Text>
                      ))}
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
                {item.citas.map(cita => (
                  <Text key={cita.evidenceId} style={styles.citationText}>
                    {cita.title} · capítulo {cita.chapter}
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
  topicInterestPanel: { padding: 12, backgroundColor: '#0d1526', borderBottomWidth: 1, borderColor: '#1e293b' },
  topicChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9, marginBottom: 10 },
  topicChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: '#475569', backgroundColor: '#111827' },
  topicChipSelected: { borderColor: '#818cf8', backgroundColor: '#312e81' },
  topicChipText: { color: '#cbd5e1', fontSize: 10 },
  topicChipTextSelected: { color: '#ffffff', fontWeight: '700' },
  topicRecommendationItem: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#26344d', marginTop: 8 },
  recommendationItem: { paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#26344d', marginTop: 7 },
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
