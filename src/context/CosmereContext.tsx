import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SISTEMAS_COSMERE_COMPLETO } from '../data/cosmereUniverse';
import { RANGOS_COSMERICOS, RangoCosmere } from '../data/gamification';

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
  reinoCognitivoActivo: boolean; // INTERRUPTOR DE SHADESMAR
  librosLeidos: { [libroId: string]: boolean };
  capituloActualPorLibro: { [libroId: string]: number };
  puntosInvestidura: number;
  rangoActual: RangoCosmere;
  apodoActivo: string;
  nombreUsuario: string;
  comentarios: ComentarioComunidad[];
  testsCompletadosExitosos: { [testId: string]: boolean };
  toggleReinoCognitivo: () => void;
  toggleLibroLeido: (libroId: string) => void;
  setCapituloLibro: (libroId: string, cap: number) => void;
  sumarPuntosTestUnico: (testId: string, puntos: number) => boolean;
  setApodoActivo: (apodo: string) => void;
  setNombreUsuario: (nombre: string) => void;
  agregarComentario: (sagaId: string, libroId: string, capitulo: number, texto: string) => void;
  darLuzTormentosa: (comentarioId: string) => void;
  esContenidoDesbloqueado: (desbloqueoLibroId: string) => boolean;
  todosLosLibrosLeidos: boolean;
}

const CosmereContext = createContext<CosmereContextType | undefined>(undefined);
const COSMERE_STORAGE_KEY = '@atlas-cosmere/state-v1';

export const CosmereProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [reinoCognitivoActivo, setReinoCognitivoActivo] = useState(false);
  const [librosLeidos, setLibrosLeidos] = useState<{ [libroId: string]: boolean }>({
    'tfe': true,
    'twok': true
  });
  const [capituloActualPorLibro, setCapituloActualPorLibro] = useState<{ [libroId: string]: number }>({
    'twok': 75,
    'tfe': 38
  });
  const [puntosInvestidura, setPuntosInvestidura] = useState<number>(450);
  const [apodoActivo, setApodoActivo] = useState<string>('Ojo de Estaño');
  const [nombreUsuario, setNombreUsuario] = useState<string>('Trotamundos de Silverlight');
  const [testsCompletadosExitosos, setTestsCompletadosExitosos] = useState<{ [testId: string]: boolean }>({});
  const testsCompletadosRef = useRef<{ [testId: string]: boolean }>({});
  const comentarioCounterRef = useRef(0);
  const [estadoHidratado, setEstadoHidratado] = useState(false);

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

  useEffect(() => {
    let activo = true;
    const cargarEstado = async () => {
      try {
        const guardado = await AsyncStorage.getItem(COSMERE_STORAGE_KEY);
        if (guardado && activo) {
          const datos = JSON.parse(guardado);
          const idsLibros = new Set(librosDelCatalogo.map(libro => libro.id));
          if (datos.librosLeidos && typeof datos.librosLeidos === 'object') {
            const lecturas: { [id: string]: boolean } = {};
            Object.entries(datos.librosLeidos).forEach(([id, valor]) => {
              if (idsLibros.has(id) && typeof valor === 'boolean') lecturas[id] = valor;
            });
            setLibrosLeidos(lecturas);
          }
          if (datos.capituloActualPorLibro && typeof datos.capituloActualPorLibro === 'object') {
            const capitulos: { [id: string]: number } = {};
            Object.entries(datos.capituloActualPorLibro).forEach(([id, valor]) => {
              const libro = librosDelCatalogo.find(item => item.id === id);
              if (libro && typeof valor === 'number' && Number.isFinite(valor)) {
                capitulos[id] = Math.min(libro.totalCapitulos, Math.max(0, Math.floor(valor)));
              }
            });
            setCapituloActualPorLibro(capitulos);
          }
          if (typeof datos.reinoCognitivoActivo === 'boolean') setReinoCognitivoActivo(datos.reinoCognitivoActivo);
          if (typeof datos.puntosInvestidura === 'number' && Number.isFinite(datos.puntosInvestidura)) setPuntosInvestidura(Math.max(0, datos.puntosInvestidura));
          if (typeof datos.apodoActivo === 'string') setApodoActivo(datos.apodoActivo);
          if (typeof datos.nombreUsuario === 'string') setNombreUsuario(datos.nombreUsuario);
          if (Array.isArray(datos.comentarios)) {
            const comentariosValidos = datos.comentarios.filter((item: any) =>
              item && typeof item.id === 'string' && typeof item.usuario === 'string' &&
              typeof item.sagaId === 'string' && idsLibros.has(item.libroId) &&
              typeof item.contenido === 'string' && Number.isFinite(item.capituloMaximo) &&
              Number.isFinite(item.luzTormentosaLikes)
            );
            setComentarios(comentariosValidos);
          }
          if (datos.testsCompletadosExitosos && typeof datos.testsCompletadosExitosos === 'object') {
            const tests = Object.fromEntries(Object.entries(datos.testsCompletadosExitosos).filter(([, valor]) => valor === true)) as { [id: string]: boolean };
            testsCompletadosRef.current = tests;
            setTestsCompletadosExitosos(tests);
          }
        }
      } catch {
        // Si el almacenamiento está dañado o no disponible, la app conserva los valores iniciales.
      } finally {
        if (activo) setEstadoHidratado(true);
      }
    };
    cargarEstado();
    return () => { activo = false; };
  }, []);

  useEffect(() => {
    if (!estadoHidratado) return;
    const estado = {
      reinoCognitivoActivo,
      librosLeidos,
      capituloActualPorLibro,
      puntosInvestidura,
      apodoActivo,
      nombreUsuario,
      comentarios,
      testsCompletadosExitosos
    };
    AsyncStorage.setItem(COSMERE_STORAGE_KEY, JSON.stringify(estado)).catch(() => {
      // La app sigue funcionando aunque el dispositivo no permita persistir datos.
    });
  }, [estadoHidratado, reinoCognitivoActivo, librosLeidos, capituloActualPorLibro, puntosInvestidura, apodoActivo, nombreUsuario, comentarios, testsCompletadosExitosos]);

  const toggleReinoCognitivo = () => {
    setReinoCognitivoActivo(prev => !prev);
  };

  const librosDelCatalogo = SISTEMAS_COSMERE_COMPLETO.flatMap(sis => sis.libros);
  const todosLosLibrosLeidos = librosDelCatalogo.length > 0 && librosDelCatalogo.every(libro => !!librosLeidos[libro.id]);

  const toggleLibroLeido = (libroId: string) => {
    const libro = librosDelCatalogo.find(item => item.id === libroId);
    if (!libro) return;
    const marcarComoLeido = !librosLeidos[libroId];
    setLibrosLeidos(prev => ({ ...prev, [libroId]: marcarComoLeido }));
    setCapituloActualPorLibro(prev => ({ ...prev, [libroId]: marcarComoLeido ? libro.totalCapitulos : 0 }));
  };

  const setCapituloLibro = (libroId: string, cap: number) => {
    const libro = librosDelCatalogo.find(item => item.id === libroId);
    if (!libro || !Number.isFinite(cap)) return;
    const capituloSeguro = Math.min(libro.totalCapitulos, Math.max(0, Math.floor(cap)));
    setCapituloActualPorLibro(prev => ({ ...prev, [libroId]: capituloSeguro }));
    if (capituloSeguro === libro.totalCapitulos) setLibrosLeidos(prev => ({ ...prev, [libroId]: true }));
    else setLibrosLeidos(prev => prev[libroId] ? { ...prev, [libroId]: false } : prev);
  };

  const sumarPuntosTestUnico = (testId: string, puntos: number): boolean => {
    if (!testId || !Number.isFinite(puntos) || puntos <= 0 || testsCompletadosRef.current[testId]) return false;
    // El ref bloquea dobles envíos antes del siguiente render; el estado mantiene la UI sincronizada.
    testsCompletadosRef.current[testId] = true;
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

  const agregarComentario = (sagaId: string, libroId: string, capitulo: number, texto: string) => {
    const libro = librosDelCatalogo.find(item => item.id === libroId);
    const contenido = texto.trim();
    if (!libro || !contenido) return;
    const capituloSeguro = Math.min(libro.totalCapitulos, Math.max(1, Math.floor(capitulo)));
    const nuevo: ComentarioComunidad = {
      id: `${Date.now()}-${++comentarioCounterRef.current}`,
      usuario: nombreUsuario,
      sagaId,
      libroId,
      capituloMaximo: capituloSeguro,
      contenido,
      luzTormentosaLikes: 0
    };
    setComentarios(prev => [nuevo, ...prev]);
  };

  const darLuzTormentosa = (id: string) => {
    setComentarios(prev => prev.map(c => c.id === id ? { ...c, luzTormentosaLikes: c.luzTormentosaLikes + 1 } : c));
  };

  if (!estadoHidratado) {
    return <View style={{ flex: 1, backgroundColor: '#090d16', alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#38bdf8" size="large" /></View>;
  }

  return (
    <CosmereContext.Provider value={{
      reinoCognitivoActivo,
      librosLeidos,
      capituloActualPorLibro,
      puntosInvestidura,
      rangoActual,
      apodoActivo,
      nombreUsuario,
      comentarios,
      testsCompletadosExitosos,
      toggleReinoCognitivo,
      toggleLibroLeido,
      setCapituloLibro,
      sumarPuntosTestUnico,
      setApodoActivo,
      setNombreUsuario,
      agregarComentario,
      darLuzTormentosa,
      esContenidoDesbloqueado,
      todosLosLibrosLeidos
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