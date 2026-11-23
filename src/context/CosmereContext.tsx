import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { SISTEMAS_COSMERE_COMPLETO } from '../data/cosmereUniverse';
import { RANGOS_COSMERICOS, RangoCosmere } from '../data/gamification';
import { createEmptyAtlasReadingProgress } from '../hoid/initialProgress';
import { createExpoHoidCursorProgressCoordinator } from '../hoid/expoCursorProgressCoordinator';
import {
  HoidCursorProgressCoordinator,
  type HoidCursorCoordinatorResult,
  type HoidReaderProgressConfirmation,
} from '../hoid/cursorProgressCoordinator';
import type { HoidCursorProgressSnapshot } from '../hoid/cursorProgressLedger';
import { createHoidReadingCursor } from '../hoid/readingManifest';
import { atlasProgressFromCursorSnapshot } from '../hoid/cursorAtlasAdapter';
import type { HoidReaderBoundary } from '../hoid/readingBoundary';

interface ComentarioComunidad {
  id: string;
  usuario: string;
  sagaId: string;
  libroId: string;
  capituloMaximo: number;
  contenido: string;
  luzTormentosaLikes: number;
}

interface CosmereContextType {
  reinoCognitivoActivo: boolean;
  librosLeidos: Readonly<{ [libroId: string]: boolean }>;
  capituloActualPorLibro: Readonly<{ [libroId: string]: number }>;
  /** Canonical, per-work boundary used by Community spoiler authorization. */
  communityReadingBoundaryByBook: Readonly<Record<string, HoidReaderBoundary>>;
  puntosInvestidura: number;
  rangoActual: RangoCosmere;
  apodoActivo: string;
  nombreUsuario: string;
  comentarios: ComentarioComunidad[];
  testsCompletadosExitosos: { [testId: string]: boolean };
  toggleReinoCognitivo: () => void;
  toggleLibroLeido: (libroId: string) => void;
  setCapituloLibro: (libroId: string, cap: number) => Promise<HoidCursorCoordinatorResult | null>;
  /** Record a reader-confirmed chapter and move the cursor to the next chapter, if the opening snapshot is still current. */
  markHoidChapterReadIfCurrent: (
    libroId: string,
    completedChapter: number,
    expectedRevision: number,
    expectedFingerprint: string,
    confirmation: HoidReaderProgressConfirmation,
  ) => Promise<HoidCursorCoordinatorResult | null>;
  /** Record final-work completion only after explicit confirmation and a matching reader snapshot. */
  completeHoidWorkIfCurrent: (
    libroId: string,
    expectedRevision: number,
    expectedFingerprint: string,
    confirmation: HoidReaderProgressConfirmation,
  ) => Promise<HoidCursorCoordinatorResult | null>;
  hoidCursorProgressSnapshot: HoidCursorProgressSnapshot | null;
  /** Reads the coordinator's live snapshot, including commits not yet projected into React state. */
  getHoidCursorProgressSnapshot: () => HoidCursorProgressSnapshot | null;
  /** Reloads the SQLite v2 ledger before spoiler-sensitive work. */
  refreshHoidCursorProgressSnapshot: () => Promise<HoidCursorProgressSnapshot | null>;
  /** Payload-free notifications emitted after a durable progress commit. */
  subscribeHoidCursorProgressChanges: (listener: () => void) => () => void;
  sumarPuntosTestUnico: (testId: string, puntos: number) => boolean;
  setApodoActivo: (apodo: string) => void;
  setNombreUsuario: (nombre: string) => void;
  agregarComentario: (sagaId: string, libroId: string, capitulo: number, texto: string) => void;
  darLuzTormentosa: (comentarioId: string) => void;
  esContenidoDesbloqueado: (desbloqueoLibroId: string) => boolean;
  todosLosLibrosLeidos: boolean;
  progresoPersistenciaEstado: 'loading' | 'ready' | 'unavailable';
}

const CosmereContext = createContext<CosmereContextType | undefined>(undefined);

export const CosmereProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [reinoCognitivoActivo, setReinoCognitivoActivo] = useState(false);
  const [initialReadingProgress] = useState(createEmptyAtlasReadingProgress);
  const [atlasReadingProgress, setAtlasReadingProgress] = useState(initialReadingProgress);
  const librosLeidos = atlasReadingProgress.completedByBook;
  const capituloActualPorLibro = atlasReadingProgress.chaptersByBook;
  const communityReadingBoundaryByBook = atlasReadingProgress.communityBoundariesByBook;
  const [progresoPersistenciaEstado, setProgresoPersistenciaEstado] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [cursorProgressCoordinator, setCursorProgressCoordinator] = useState<HoidCursorProgressCoordinator | null>(null);
  const [hoidCursorProgressSnapshot, setHoidCursorProgressSnapshot] = useState<HoidCursorProgressSnapshot | null>(null);

  const aplicarResultadoProgreso = (result: HoidCursorCoordinatorResult) => {
    if (result.status === 'ready' || result.status === 'conflict') {
      const restored = atlasProgressFromCursorSnapshot(result.snapshot);
      if (restored.status !== 'ready') {
        setHoidCursorProgressSnapshot(null);
        setAtlasReadingProgress(createEmptyAtlasReadingProgress());
        setProgresoPersistenciaEstado('unavailable');
        return;
      }
      setHoidCursorProgressSnapshot(restored.snapshot);
      setAtlasReadingProgress(Object.freeze({
        chaptersByBook: restored.chaptersByBook,
        completedByBook: restored.completedByBook,
        communityBoundariesByBook: restored.communityBoundariesByBook,
      }));
      setProgresoPersistenciaEstado('ready');
    } else if (result.status === 'unavailable') {
      setHoidCursorProgressSnapshot(null);
      setAtlasReadingProgress(createEmptyAtlasReadingProgress());
      setProgresoPersistenciaEstado('unavailable');
    }
  };

  useEffect(() => {
    let mounted = true;
    createExpoHoidCursorProgressCoordinator().then(async coordinator => {
      if (!mounted) return;
      setCursorProgressCoordinator(coordinator);
      const result = await coordinator.initialize();
      if (mounted) aplicarResultadoProgreso(result);
    }).catch(() => {
      if (mounted) {
        setHoidCursorProgressSnapshot(null);
        setAtlasReadingProgress(createEmptyAtlasReadingProgress());
        setProgresoPersistenciaEstado('unavailable');
      }
    });

    return () => {
      mounted = false;
    };
  }, []);
  const [puntosInvestidura, setPuntosInvestidura] = useState<number>(450);
  const [apodoActivo, setApodoActivo] = useState<string>('Ojo de Estaño');
  const [nombreUsuario, setNombreUsuario] = useState<string>('Trotamundos de Silverlight');
  const [testsCompletadosExitosos, setTestsCompletadosExitosos] = useState<{ [testId: string]: boolean }>({});

  const [comentarios, setComentarios] = useState<ComentarioComunidad[]>([
    {
      id: 'c1',
      usuario: 'KholinScout',
      sagaId: 'Archivo de las Tormentas',
      libroId: 'twok',
      capituloMaximo: 75,
      contenido: 'El puente cuatro saltando el abismo al final sigue poniéndome la piel de gallina.',
      luzTormentosaLikes: 34
    }
  ]);

  const toggleReinoCognitivo = () => setReinoCognitivoActivo(prev => !prev);

  const totalLibrosEnUniverso = SISTEMAS_COSMERE_COMPLETO.reduce((acc, sis) => acc + sis.libros.length, 0);
  const totalLeidosCount = Object.values(librosLeidos).filter(Boolean).length;
  const todosLosLibrosLeidos = totalLeidosCount >= totalLibrosEnUniverso;

  const toggleLibroLeido = (libroId: string) => {
    if (!cursorProgressCoordinator || progresoPersistenciaEstado !== 'ready') return;

    if (librosLeidos[libroId]) {
      Alert.alert(
        'Reabrir libro',
        '¿Quieres retirar la marca de leído y volver a situar el progreso al inicio? Esta acción cambiará qué información puede revelar Hoid.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Reabrir',
            style: 'destructive',
            onPress: () => {
              void cursorProgressCoordinator.reopenCompletedWork(libroId, { confirmed: true }).then(result => {
                aplicarResultadoProgreso(result);
                if (result.status === 'rejected' && result.reason === 'unsupported-position') {
                  Alert.alert('Estructura no verificada', 'Esta obra todavía no dispone de una primera unidad de lectura inequívoca. No se ha modificado el progreso.');
                }
              });
            },
          },
        ],
      );
      return;
    }

    void cursorProgressCoordinator.complete(libroId).then(aplicarResultadoProgreso);
  };

  const setCapituloLibro = async (libroId: string, cap: number): Promise<HoidCursorCoordinatorResult | null> => {
    if (!cursorProgressCoordinator || progresoPersistenciaEstado !== 'ready') return null;

    const created = createHoidReadingCursor(libroId, cap);
    if (created.status !== 'ready') {
      const reason = created.reason === 'unknown-work'
        ? 'unknown-work'
        : created.reason === 'segmentation-unverified'
          ? 'unsupported-position'
          : 'invalid-cursor';
      return { status: 'rejected', reason };
    }

    const result = await cursorProgressCoordinator.advance(libroId, created.cursor);
    aplicarResultadoProgreso(result);
    return result;
  };

  const markHoidChapterReadIfCurrent = async (
    libroId: string,
    completedChapter: number,
    expectedRevision: number,
    expectedFingerprint: string,
    confirmation: HoidReaderProgressConfirmation,
  ): Promise<HoidCursorCoordinatorResult | null> => {
    if (!cursorProgressCoordinator || progresoPersistenciaEstado !== 'ready') return null;
    const result = await cursorProgressCoordinator.markChapterReadIfCurrent(
      libroId,
      completedChapter,
      expectedRevision,
      expectedFingerprint,
      confirmation,
    );
    aplicarResultadoProgreso(result);
    return result;
  };

  const completeHoidWorkIfCurrent = async (
    libroId: string,
    expectedRevision: number,
    expectedFingerprint: string,
    confirmation: HoidReaderProgressConfirmation,
  ): Promise<HoidCursorCoordinatorResult | null> => {
    if (!cursorProgressCoordinator || progresoPersistenciaEstado !== 'ready') return null;
    const result = await cursorProgressCoordinator.completeWorkIfCurrent(
      libroId,
      expectedRevision,
      expectedFingerprint,
      confirmation,
    );
    aplicarResultadoProgreso(result);
    return result;
  };

  const sumarPuntosTestUnico = (testId: string, puntos: number): boolean => {
    if (testsCompletadosExitosos[testId]) return false;
    setTestsCompletadosExitosos(prev => ({ ...prev, [testId]: true }));
    setPuntosInvestidura(prev => prev + puntos);
    return true;
  };

  const rangoActual = (() => {
    const rangosOrdenados = [...RANGOS_COSMERICOS].reverse();
    for (const r of rangosOrdenados) {
      if (puntosInvestidura >= r.puntosMinimos) {
        if (r.requiereTodosLosLibros && !todosLosLibrosLeidos) continue;
        return r;
      }
    }
    return RANGOS_COSMERICOS[0];
  })();

  const esContenidoDesbloqueado = (desbloqueoLibroId: string) => !!librosLeidos[desbloqueoLibroId];

  const getHoidCursorProgressSnapshot = (): HoidCursorProgressSnapshot | null => {
    return cursorProgressCoordinator
      ? cursorProgressCoordinator.getSnapshot()
      : hoidCursorProgressSnapshot;
  };

  const refreshHoidCursorProgressSnapshot = async (): Promise<HoidCursorProgressSnapshot | null> => {
    if (!cursorProgressCoordinator) return null;
    const result = await cursorProgressCoordinator.refresh();
    aplicarResultadoProgreso(result);
    return result.status === 'ready' ? result.snapshot : null;
  };

  const subscribeHoidCursorProgressChanges = (listener: () => void): (() => void) => {
    if (!cursorProgressCoordinator) return () => {};
    return cursorProgressCoordinator.subscribe(listener);
  };

  const agregarComentario = (sagaId: string, libroId: string, capitulo: number, texto: string) => {
    const nuevo: ComentarioComunidad = {
      id: Date.now().toString(),
      usuario: nombreUsuario,
      sagaId,
      libroId,
      capituloMaximo: capitulo,
      contenido: texto,
      luzTormentosaLikes: 0
    };
    setComentarios([nuevo, ...comentarios]);
  };

  const darLuzTormentosa = (id: string) => {
    setComentarios(prev => prev.map(c => c.id === id ? { ...c, luzTormentosaLikes: c.luzTormentosaLikes + 1 } : c));
  };

  return (
    <CosmereContext.Provider value={{
      reinoCognitivoActivo,
      librosLeidos,
      capituloActualPorLibro,
      communityReadingBoundaryByBook,
      puntosInvestidura,
      rangoActual,
      apodoActivo,
      nombreUsuario,
      comentarios,
      testsCompletadosExitosos,
      toggleReinoCognitivo,
      toggleLibroLeido,
      setCapituloLibro,
      markHoidChapterReadIfCurrent,
      completeHoidWorkIfCurrent,
      sumarPuntosTestUnico,
      setApodoActivo,
      setNombreUsuario,
      agregarComentario,
      darLuzTormentosa,
      esContenidoDesbloqueado,
      todosLosLibrosLeidos,
      progresoPersistenciaEstado,
      hoidCursorProgressSnapshot,
      getHoidCursorProgressSnapshot,
      refreshHoidCursorProgressSnapshot,
      subscribeHoidCursorProgressChanges,
    }}>
      {children}
    </CosmereContext.Provider>
  );
};

export const useCosmere = () => {
  const context = useContext(CosmereContext);
  if (!context) throw new Error('useCosmere debe usarse dentro de CosmereProvider');
  return context;
};
