'use client';

import React, { useState, useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Mic,
  MicOff,
  Sparkles,
  Loader2,
  AlertCircle,
  X,
  RotateCcw,
  Volume2,
  Lightbulb,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useModalDragScroll } from '@/lib/useModalDragScroll';

export interface PedidoVozResultado {
  accion?: 'orden_pos' | 'abono_saldo_favor' | 'guardar_vuelto';
  monto_abono_usd?: number;
  metodo_pago_sugerido?: 'efectivo_usd' | 'pago_movil' | 'punto_debito' | 'pendiente' | 'saldo_favor';
  cliente_id: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cliente_creado?: any;
  items: {
    producto_id: string;
    cantidad: number;
  }[];
  pagado: boolean;
  resumen_interpretado?: string;
  detalle_abono?: {
    deudaLiquidadaUsd: number;
    saldoAFavorAcreditadoUsd: number;
    mensaje: string;
  } | null;
}

interface VoiceOrderModalProps {
  onPedidoProcesado: (resultado: PedidoVozResultado) => void;
  className?: string;
}

const EJEMPLOS_PEDIDOS = [
  'Abona $5 a favor del alumno Mateo Rivas',
  'Carga dos empanadas a la cuenta de Sebastián Martínez y paga usando su saldo a favor',
  'Registra un pago adelantado de $10 para la profesora Sofía Martínez',
  'Guarda el vuelto de $0.50 como saldo a favor de Alejandro Pérez',
  'Una empanada de queso, una malta y anótalo a la cuenta de Sofía Martínez de 5to A',
];

export function VoiceOrderModal({ onPedidoProcesado, className = '' }: VoiceOrderModalProps) {
  const [abierto, setAbierto] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [transcripcion, setTranscripcion] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [modoManual, setModoManual] = useState(false);
  const [soportaVoz, setSoportaVoz] = useState(true);

  // Deslizamiento vertical y arrastre (drag-to-scroll) para móviles y emuladores con Body Scroll Lock
  const dragScrollVoz = useModalDragScroll({
    isOpen: abierto,
    onDismiss: () => handleOpenChange(false),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef<string>('');
  const activoRef = useRef<boolean>(false);

  // Inicializar o comprobar soporte de SpeechRecognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setSoportaVoz(false);
        setModoManual(true);
      }
    }
  }, []);

  // Limpiar reconocimiento al desmontar o cerrar
  useEffect(() => {
    return () => {
      activoRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Silenciar errores al abortar
        }
      }
    };
  }, []);

  const iniciarReconocimiento = () => {
    setErrorMsg(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSoportaVoz(false);
      setModoManual(true);
      setErrorMsg('Tu navegador no soporta SpeechRecognition nativo. Puedes escribir el pedido abajo.');
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }

      activoRef.current = true;

      const recognition = new SpeechRecognition();
      recognition.lang = 'es-VE';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setEscuchando(true);
      };

      // Procesar únicamente el buffer con event.resultIndex para evitar bucles de palabras repetidas
      recognition.onresult = (event: any) => {
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          const texto = item[0]?.transcript || '';

          if (item.isFinal) {
            const fraseLimpia = texto.trim();
            if (fraseLimpia) {
              const palabrasActuales = finalTranscriptRef.current.trim().split(/\s+/);
              const ultimaPalabra = palabrasActuales[palabrasActuales.length - 1]?.toLowerCase();
              const primeraNueva = fraseLimpia.split(/\s+/)[0]?.toLowerCase();

              // Evitar bucles de repetición inmediata (agrega agrega... / listo listo...)
              if (
                ultimaPalabra &&
                primeraNueva &&
                ultimaPalabra === primeraNueva &&
                finalTranscriptRef.current.length > 0
              ) {
                const resto = fraseLimpia.split(/\s+/).slice(1).join(' ');
                if (resto) {
                  finalTranscriptRef.current = `${finalTranscriptRef.current} ${resto}`.trim();
                }
              } else {
                finalTranscriptRef.current = finalTranscriptRef.current
                  ? `${finalTranscriptRef.current} ${fraseLimpia}`
                  : fraseLimpia;
              }
            }
          } else {
            interimTranscript += texto;
          }
        }

        const acumulado = [finalTranscriptRef.current, interimTranscript.trim()]
          .filter(Boolean)
          .join(' ')
          .trim();

        if (acumulado) {
          setTranscripcion(acumulado);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('SpeechRecognition error:', event.error);
        if (event.error === 'not-allowed') {
          activoRef.current = false;
          setErrorMsg('Acceso al micrófono denegado. Permite el micrófono en tu navegador o usa el modo texto.');
          setEscuchando(false);
        } else if (event.error === 'no-speech') {
          // Silencio temporal: no cancelar si el usuario aún tiene el micrófono activo
        } else if (event.error === 'aborted') {
          // Aborto manual
        } else {
          setErrorMsg(`Error de captura de audio: ${event.error}`);
          setEscuchando(false);
        }
      };

      recognition.onend = () => {
        // Auto-reinicio cuando el micrófono siga activo para evitar pausas/congelamiento en iOS Safari (iPhone)
        if (activoRef.current) {
          try {
            recognition.start();
          } catch {
            setTimeout(() => {
              if (activoRef.current) {
                try {
                  recognition.start();
                } catch {
                  setEscuchando(false);
                  activoRef.current = false;
                }
              }
            }, 180);
          }
        } else {
          setEscuchando(false);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error iniciando micrófono';
      console.error('Error al iniciar reconocimiento:', err);
      setErrorMsg(msg);
      setEscuchando(false);
      activoRef.current = false;
    }
  };

  const detenerReconocimiento = () => {
    activoRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setEscuchando(false);
  };

  const toggleGrabacion = () => {
    if (escuchando) {
      detenerReconocimiento();
    } else {
      iniciarReconocimiento();
    }
  };

  const procesarConGemini = async (textoAProcesar?: string) => {
    const texto = (textoAProcesar ?? transcripcion).trim();
    if (!texto) {
      setErrorMsg('Por favor dicta o escribe un pedido antes de procesar.');
      return;
    }

    if (escuchando) {
      detenerReconocimiento();
    }

    setProcesando(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/voz-pos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ texto }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detalles || data.error || 'Ocurrió un error al procesar el pedido con Inteligencia Artificial.');
      }

      // Notificar al componente padre
      onPedidoProcesado(data);

      // Cerrar modal y limpiar
      setAbierto(false);
      setTranscripcion('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error de conexión con la IA';
      console.error('Error procesando pedido por voz:', err);
      setErrorMsg(msg);
    } finally {
      setProcesando(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setAbierto(open);
    if (!open) {
      detenerReconocimiento();
      finalTranscriptRef.current = '';
      setProcesando(false);
      setErrorMsg(null);
    } else {
      finalTranscriptRef.current = '';
      setTranscripcion('');
      setErrorMsg(null);
      // Iniciar automáticamente la escucha si el navegador lo permite
      if (soportaVoz && !modoManual) {
        setTimeout(() => {
          iniciarReconocimiento();
        }, 350);
      }
    }
  };

  return (
    <>
      {/* Botón Destacado junto al Carrito */}
      <button
        type="button"
        onClick={() => handleOpenChange(true)}
        className={`group relative flex w-full items-center justify-between overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-700 px-4 py-3 text-white shadow-md shadow-indigo-100 transition-all duration-200 hover:from-violet-700 hover:via-indigo-700 hover:to-purple-800 hover:shadow-lg hover:shadow-indigo-200 active:scale-[0.99] ${className}`}
      >
        {/* Resplandor decorativo de fondo */}
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />

        <div className="flex items-center gap-3 relative z-10">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-sm border border-white/20 group-hover:scale-105 transition-transform">
            <Mic className="h-5 w-5 text-violet-100 animate-pulse" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold tracking-tight text-white drop-shadow-xs">
                🎙️ Pedido por Voz
              </span>
              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-950 shadow-2xs">
                BETA
              </span>
            </div>
            <p className="text-[11px] font-medium text-violet-200">
              Dicta pedidos o registra estudiantes y profesores
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs font-semibold text-white/90 relative z-10 shrink-0 pl-2">
          <Sparkles className="h-4 w-4 text-amber-300 animate-spin-slow" />
        </div>
      </button>

      {/* Modal Dialog Radix UI */}
      <Dialog.Root open={abierto} onOpenChange={handleOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay
            {...dragScrollVoz.overlayProps}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in"
          />
          <Dialog.Content
            style={dragScrollVoz.style}
            {...dragScrollVoz.dragProps}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain touch-scroll-ios rounded-t-3xl sm:rounded-3xl border-t sm:border border-violet-100 bg-white p-4 sm:p-6 pb-28 sm:pb-6 shadow-2xl outline-none duration-300 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in-0 sm:zoom-in-95 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[95vw] sm:max-w-lg cursor-grab active:cursor-grabbing"
          >
            {/* Manija táctil para deslizar hacia arriba y abajo en móviles */}
            <div
              className="mx-auto mb-3 -mt-1 flex h-6 w-full cursor-grab active:cursor-grabbing items-center justify-center sm:hidden touch-none"
              title="Deslizar hacia abajo para cerrar"
            >
              <div className="h-1.5 w-12 rounded-full bg-violet-200 active:bg-violet-300 transition-colors" />
            </div>

            {/* Header del Modal */}
            <div className="flex items-start justify-between border-b border-gray-100 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-200">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <Dialog.Title className="text-sm sm:text-base font-bold text-gray-900">
                    Pedido y Registro por Voz
                  </Dialog.Title>
                  <p className="text-xs text-gray-500">
                    Habla naturalmente; puedes registrar alumnos/docentes o cargar productos al carrito.
                  </p>
                </div>
              </div>

              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>

            {/* Zona Principal de Grabación e Interacción */}
            <div className="my-5 flex flex-col items-center justify-center text-center">
              {/* Botón Central de Micrófono con Animación de Pulso */}
              <div className="relative flex items-center justify-center my-1.5">
                {escuchando && (
                  <>
                    <motion.div
                      animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0.1, 0.6] }}
                      transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                      className="absolute h-24 w-24 sm:h-28 sm:w-28 rounded-full bg-violet-500/25 pointer-events-none"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0, 0.4] }}
                      transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut', delay: 0.3 }}
                      className="absolute h-32 w-32 sm:h-36 sm:w-36 rounded-full bg-indigo-500/15 pointer-events-none"
                    />
                  </>
                )}

                <button
                  type="button"
                  onClick={toggleGrabacion}
                  disabled={procesando}
                  className={`relative z-10 flex h-18 w-18 sm:h-20 sm:w-20 items-center justify-center rounded-full text-white shadow-xl transition-all duration-300 ${
                    escuchando
                      ? 'bg-rose-600 shadow-rose-300 ring-4 ring-rose-200 animate-pulse'
                      : 'bg-gradient-to-br from-violet-600 to-indigo-600 shadow-violet-200 hover:scale-105 active:scale-95'
                  }`}
                  title={escuchando ? 'Pausar micrófono' : 'Comenzar a hablar'}
                >
                  {escuchando ? (
                    <MicOff className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
                  ) : (
                    <Mic className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
                  )}
                </button>
              </div>

              {/* Indicador de Estado */}
              <div className="mt-2.5 flex items-center gap-2">
                {escuchando ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 border border-rose-200 animate-pulse">
                    <span className="h-2 w-2 rounded-full bg-rose-600" />
                    Escuchando en vivo... Habla ahora
                  </span>
                ) : procesando ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700 border border-violet-200">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-600" />
                    Procesando con Inteligencia Artificial...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                    {transcripcion ? 'Voz capturada' : 'Presiona el micrófono para hablar'}
                  </span>
                )}
              </div>

              {/* Caja de Transcripción */}
              <div className="mt-3.5 w-full text-left">
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <Volume2 className="h-3.5 w-3.5 text-violet-600" />
                    Transcripción del Pedido:
                  </label>
                  {transcripcion && (
                    <button
                      type="button"
                      onClick={() => {
                        finalTranscriptRef.current = '';
                        setTranscripcion('');
                      }}
                      className="text-[11px] font-semibold text-gray-400 hover:text-rose-600 transition flex items-center gap-1"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Limpiar
                    </button>
                  )}
                </div>

                <div className="relative">
                  <textarea
                    rows={3}
                    value={transcripcion}
                    onChange={(e) => {
                      setTranscripcion(e.target.value);
                      finalTranscriptRef.current = e.target.value;
                    }}
                    placeholder={
                      escuchando
                        ? 'Habla ahora... "Una empanada de queso, una malta y anótalo a Sofía Martínez..."'
                        : 'El texto dictado aparecerá aquí, o puedes escribirlo directamente...'
                    }
                    className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50/70 p-3 sm:p-3.5 text-sm text-gray-800 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-violet-100 font-medium transition"
                  />
                </div>
              </div>

              {/* Mensaje de Error si lo hay */}
              <AnimatePresence>
                {errorMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="mt-3 flex w-full items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-left text-xs text-rose-800"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-bold">Aviso:</p>
                      <p className="text-rose-700">{errorMsg}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Ejemplos Sugeridos Rápidos */}
              <div className="mt-3.5 w-full text-left rounded-2xl border border-violet-100 bg-violet-50/50 p-2.5 sm:p-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-violet-900 mb-1.5">
                  <Lightbulb className="h-3.5 w-3.5 text-violet-600" />
                  <span>Prueba con ejemplos rápidos (haz clic para probar):</span>
                </div>
                <div className="space-y-1">
                  {EJEMPLOS_PEDIDOS.map((ejemplo, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setTranscripcion(ejemplo);
                      }}
                      className="w-full text-left text-[11px] text-violet-800 hover:text-violet-950 hover:bg-violet-100/70 rounded-xl px-2.5 py-1.5 transition font-medium border border-violet-200/50 flex items-center justify-between group"
                    >
                      <span className="truncate pr-2">«{ejemplo}»</span>
                      <span className="text-[10px] text-violet-500 font-bold opacity-0 group-hover:opacity-100 transition shrink-0">
                        Usar ↵
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer con Acciones */}
            <div className="flex items-center justify-between border-t border-gray-100 pt-3.5">
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition"
              >
                Cancelar
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => procesarConGemini()}
                  disabled={procesando || !transcripcion.trim()}
                  className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-violet-200 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {procesando ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      <span>Interpretando con IA...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-amber-300" />
                      <span>Cargar al Carrito</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
