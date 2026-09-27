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
  CheckCircle2,
  ShoppingCart,
  User,
  GraduationCap,
  Plus,
  Minus,
  Trash2,
  Search,
  ChevronDown,
  Check,
  DollarSign,
  Banknote,
  Smartphone,
  CreditCard,
  Wallet,
  Edit2,
  UserPlus,
  ArrowLeft,
  Receipt,
  PiggyBank,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useModalDragScroll } from '@/lib/useModalDragScroll';
import { Cliente, Producto, MetodoPagoId } from '@/types/pos';
import { ResumenSaldoCliente, procesarAbonoCliente } from '@/lib/clientBalance';
import { formatUSD, formatBs, calcularConversionBs, sanitizeDecimalInput, handleDecimalKeyDown } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';
import { refrescarNotificacionesGlobales } from '@/components/NotificationsContext';

export interface PedidoVozResultado {
  accion?: 'orden_pos' | 'abono_saldo_favor' | 'guardar_vuelto';
  monto_abono_usd?: number;
  metodo_pago_sugerido?: 'efectivo_usd' | 'efectivo_bs' | 'pago_movil' | 'punto_debito' | 'pendiente' | 'saldo_favor';
  cliente_id: string | null;
  nuevo_cliente?: {
    nombre_estudiante: string;
    grado_seccion?: string;
    nombre_representante?: string;
    cargo?: string;
    telefono_whatsapp?: string;
  } | null;
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

export interface VoiceOrderModalProps {
  productos?: Producto[];
  clientes?: Cliente[];
  tasaBcv?: number;
  saldosClientes?: Record<string, ResumenSaldoCliente>;
  onClienteCreado?: (cliente: Cliente) => void;
  onCargarAlCarrito?: (
    items: { producto: Producto; cantidad: number }[],
    cliente: Cliente | null,
    metodoPago?: MetodoPagoId
  ) => void;
  onVentaExitosa?: (mensaje: string) => void;
  onVentaFiadaExitosa?: (mensaje: string) => void;
  onAbonoExitoso?: (mensaje: string) => void;
  onAlerta?: (tipo: 'error' | 'advertencia' | 'exito' | 'info', texto: string) => void;
  onPedidoProcesado?: (resultado: PedidoVozResultado) => void;
  className?: string;
}

const EJEMPLOS_PEDIDOS = [
  'Abona $5 a favor del alumno Mateo Rivas',
  'Carga dos empanadas a la cuenta de Sebastián Martínez y paga usando su saldo a favor',
  'Registra un pago adelantado de $10 para la profesora Sofía Martínez',
  'Guarda el vuelto de $0.50 como saldo a favor de Alejandro Pérez',
  'Una empanada de queso, una malta y anótalo a la cuenta de Sofía Martínez de 5to A',
];

export function VoiceOrderModal({
  productos = [],
  clientes = [],
  tasaBcv = 40,
  saldosClientes = {},
  onClienteCreado,
  onCargarAlCarrito,
  onVentaExitosa,
  onVentaFiadaExitosa,
  onAbonoExitoso,
  onAlerta,
  onPedidoProcesado,
  className = '',
}: VoiceOrderModalProps) {
  const [abierto, setAbierto] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [transcripcion, setTranscripcion] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [clienteInexistente, setClienteInexistente] = useState<string | null>(null);
  const [modoManual, setModoManual] = useState(false);
  const [soportaVoz, setSoportaVoz] = useState(true);

  // Paso actual del flujo de voz: 'dictado' o 'confirmacion'
  const [paso, setPaso] = useState<'dictado' | 'confirmacion'>('dictado');

  // Estados de la pantalla de confirmación previa
  const [accionConfirmacion, setAccionConfirmacion] = useState<'cobrar_venta' | 'fiar' | 'abono' | 'cargar_carrito'>('cobrar_venta');
  const [clienteIdSeleccionado, setClienteIdSeleccionado] = useState<string | null>(null);
  const [cambiandoCliente, setCambiandoCliente] = useState<boolean>(false);
  const [busquedaCliente, setBusquedaCliente] = useState<string>('');
  const [nuevoCliente, setNuevoCliente] = useState<{
    nombre_estudiante: string;
    grado_seccion: string;
    nombre_representante?: string;
    telefono_whatsapp?: string;
  } | null>(null);
  const [itemsConfirmados, setItemsConfirmados] = useState<{
    producto: Producto;
    cantidad: number;
  }[]>([]);
  const [montoAbono, setMontoAbono] = useState<string>('');
  const [metodoPagoSugerido, setMetodoPagoSugerido] = useState<MetodoPagoId>('efectivo_usd');
  const [referenciaPagoMovil, setReferenciaPagoMovil] = useState<string>('');
  const [metodoPagoAbono, setMetodoPagoAbono] = useState<string>('efectivo_usd');
  const [productoAAgregarId, setProductoAAgregarId] = useState<string>('');
  const [confirmando, setConfirmando] = useState<boolean>(false);
  const [errorConfirmacion, setErrorConfirmacion] = useState<string | null>(null);

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // Interpretar con Gemini y pasar a la pantalla de confirmación previa
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();

      if (!res.ok) {
        throw new Error(data.detalles || data.error || 'Ocurrió un error al interpretar el pedido con Inteligencia Artificial.');
      }

      // VALIDACIÓN ESTRICTA: Cliente inexistente en la base de datos
      // Si el usuario nombró a un cliente que no existe en el sistema (ej: "abona 10$ a felipe"):
      if (data.cliente_no_encontrado) {
        const nombreNoExiste = data.cliente_no_encontrado;
        const msgAlerta = `No existe ningún cliente llamado "${nombreNoExiste}" registrado en la base de datos.`;
        setErrorMsg(msgAlerta);
        setClienteInexistente(nombreNoExiste);

        if (onAlerta) {
          onAlerta('advertencia', msgAlerta);
        }

        // NO abre el modal de confirmación: se queda en la pantalla de dictado con la alerta visible
        return;
      }

      // Si es un abono pero no se indicó cliente en absoluto:
      if ((data.accion === 'abono_saldo_favor' || data.accion === 'guardar_vuelto') && !data.cliente_id && !data.nuevo_cliente) {
        const msgAlerta = 'Debes indicar el nombre de un estudiante o cliente registrado para registrar un abono.';
        setErrorMsg(msgAlerta);
        if (onAlerta) {
          onAlerta('advertencia', msgAlerta);
        }
        return;
      }

      setClienteInexistente(null);

      // 1. Determinar Acción interpretada
      let accionSugerida: 'cobrar_venta' | 'fiar' | 'abono' | 'cargar_carrito' = 'cobrar_venta';
      if (data.accion === 'abono_saldo_favor' || data.accion === 'guardar_vuelto') {
        accionSugerida = 'abono';
      } else if (data.metodo_pago_sugerido === 'pendiente' || data.pagado === false) {
        accionSugerida = 'fiar';
      }
      setAccionConfirmacion(accionSugerida);

      // 2. Determinar Cliente interpretado
      setClienteIdSeleccionado(data.cliente_id || null);
      if (data.nuevo_cliente) {
        setNuevoCliente({
          nombre_estudiante: data.nuevo_cliente.nombre_estudiante || '',
          grado_seccion: data.nuevo_cliente.grado_seccion || 'Estudiante',
          nombre_representante: data.nuevo_cliente.nombre_representante || data.nuevo_cliente.cargo || '',
          telefono_whatsapp: data.nuevo_cliente.telefono_whatsapp || '',
        });
      } else {
        setNuevoCliente(null);
      }
      setCambiandoCliente(false);
      setBusquedaCliente('');

      // 3. Mapear productos entendidos
      const itemsMap: { producto: Producto; cantidad: number }[] = [];
      if (Array.isArray(data.items)) {
        for (const it of data.items) {
          const prod = productos.find((p) => p.id === it.producto_id);
          if (prod) {
            itemsMap.push({
              producto: prod,
              cantidad: Math.max(1, it.cantidad),
            });
          }
        }
      }
      setItemsConfirmados(itemsMap);

      // 4. Monto de abono
      setMontoAbono(data.monto_abono_usd && data.monto_abono_usd > 0 ? String(data.monto_abono_usd) : '');

      // 5. Métodos de pago y referencia
      if (data.numero_referencia) {
        setReferenciaPagoMovil(data.numero_referencia);
      } else {
        setReferenciaPagoMovil('');
      }

      if (data.metodo_pago_sugerido) {
        setMetodoPagoSugerido(data.metodo_pago_sugerido);
        setMetodoPagoAbono(data.metodo_pago_sugerido);
      } else {
        setMetodoPagoSugerido(accionSugerida === 'fiar' ? 'pendiente' : 'efectivo_usd');
        setMetodoPagoAbono('efectivo_usd');
      }

      setErrorConfirmacion(null);
      // Pasar a la pantalla de previsualización / confirmación obligatoria
      setPaso('confirmacion');
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
      setClienteInexistente(null);
      setPaso('dictado');
      setErrorConfirmacion(null);
      setNuevoCliente(null);
      setItemsConfirmados([]);
      setReferenciaPagoMovil('');
      setCambiandoCliente(false);
      setBusquedaCliente('');
      setConfirmando(false);
    } else {
      finalTranscriptRef.current = '';
      setTranscripcion('');
      setErrorMsg(null);
      setClienteInexistente(null);
      setPaso('dictado');
      setErrorConfirmacion(null);
      setNuevoCliente(null);
      setItemsConfirmados([]);
      setReferenciaPagoMovil('');
      setCambiandoCliente(false);
      setBusquedaCliente('');
      setConfirmando(false);
      if (soportaVoz && !modoManual) {
        setTimeout(() => {
          iniciarReconocimiento();
        }, 350);
      }
    }
  };

  // Modificar cantidad de un producto en la lista confirmada
  const handleModificarCantidadItem = (productoId: string, delta: number) => {
    setItemsConfirmados((prev) =>
      prev
        .map((it) => {
          if (it.producto.id === productoId) {
            const nueva = it.cantidad + delta;
            return nueva > 0 ? { ...it, cantidad: nueva } : null;
          }
          return it;
        })
        .filter((it): it is { producto: Producto; cantidad: number } => it !== null)
    );
  };

  // Eliminar un producto de la lista confirmada
  const handleEliminarItem = (productoId: string) => {
    setItemsConfirmados((prev) => prev.filter((it) => it.producto.id !== productoId));
  };

  // Agregar otro producto manualmente desde el catálogo
  const handleAgregarOtroProducto = (prodId: string) => {
    if (!prodId) return;
    const prod = productos.find((p) => p.id === prodId);
    if (!prod) return;

    setItemsConfirmados((prev) => {
      const idx = prev.findIndex((it) => it.producto.id === prod.id);
      if (idx >= 0) {
        const nuevo = [...prev];
        nuevo[idx] = { ...nuevo[idx], cantidad: nuevo[idx].cantidad + 1 };
        return nuevo;
      }
      return [...prev, { producto: prod, cantidad: 1 }];
    });
    setProductoAAgregarId('');
  };

  // Confirmar y procesar la acción definitiva tras la revisión manual
  const handleConfirmarYProcesar = async () => {
    setErrorConfirmacion(null);
    setConfirmando(true);

    try {
      // 1. Manejo de Registro de Nuevo Cliente si aplica
      let cliId = clienteIdSeleccionado;
      let clienteObj: Cliente | null = clientes.find((c) => c.id === cliId) || null;

      if (nuevoCliente && !cliId) {
        const nom = nuevoCliente.nombre_estudiante.trim();
        const grado = nuevoCliente.grado_seccion.trim() || 'Estudiante';
        if (!nom) {
          throw new Error('Por favor ingresa el nombre del nuevo alumno o personal.');
        }

        // Consultar clientes que coincidan
        const { data: alumnosMismoNombre } = await supabase
          .from('clientes')
          .select('*')
          .ilike('nombre_estudiante', `%${nom}%`);

        const normalizar = (s: string | null | undefined) =>
          (s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        const duplicado = alumnosMismoNombre?.find(
          (c) =>
            normalizar(c.nombre_estudiante) === normalizar(nom) &&
            (normalizar(c.grado_seccion) === normalizar(grado) ||
             !grado || grado === 'Estudiante' || grado === 'General' ||
             !c.grado_seccion || c.grado_seccion === 'Estudiante' || c.grado_seccion === 'General')
        ) || alumnosMismoNombre?.find(
          (c) => normalizar(c.nombre_estudiante) === normalizar(nom)
        ) || (alumnosMismoNombre && alumnosMismoNombre.length === 1 ? alumnosMismoNombre[0] : null);

        if (duplicado) {
          cliId = duplicado.id;
          clienteObj = duplicado;
        } else {
          const { data: insertado, error: errIns } = await supabase
            .from('clientes')
            .insert([
              {
                nombre_estudiante: nom,
                grado_seccion: grado,
                nombre_representante: nuevoCliente.nombre_representante?.trim() || null,
                telefono_whatsapp: nuevoCliente.telefono_whatsapp?.trim() || null,
                saldo: 0,
              },
            ])
            .select()
            .single();

          if (errIns || !insertado) {
            throw new Error(errIns?.message || 'Error registrando nuevo cliente');
          }

          cliId = insertado.id;
          clienteObj = insertado;
          if (onClienteCreado) {
            onClienteCreado(insertado);
          }
        }
      }

      // 2. Ejecución según la Acción
      if (accionConfirmacion === 'cobrar_venta') {
        if (itemsConfirmados.length === 0) {
          throw new Error('Debes incluir al menos un producto para registrar y procesar la venta.');
        }

        const totalUsd = itemsConfirmados.reduce(
          (sum, item) => sum + item.producto.precio_usd * item.cantidad,
          0
        );

        if (metodoPagoSugerido === 'saldo_favor') {
          if (!cliId) {
            throw new Error('Para pagar con Saldo a Favor debes seleccionar o ingresar un cliente registrado.');
          }
          if (saldoClienteActivo <= 0) {
            throw new Error('El cliente no cuenta con saldo a favor disponible ($0.00). Selecciona otro método de pago.');
          }
        }

        let metodoFinal: string = metodoPagoSugerido;
        if (metodoPagoSugerido === 'pago_movil' && referenciaPagoMovil.trim()) {
          metodoFinal = `pago_movil#ref:${referenciaPagoMovil.trim()}`;
        }

        let ventaGuardada = false;

        // Intentar guardar primero a través del endpoint /api/voz-pos
        try {
          const resp = await fetch('/api/voz-pos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accion: 'guardar_venta',
              cliente_id: cliId || null,
              items: itemsConfirmados.map((it) => ({
                producto_id: it.producto.id,
                cantidad: it.cantidad,
                precio_unitario_usd: it.producto.precio_usd,
              })),
              monto_total_usd: totalUsd,
              tasa_bcv: tasaBcv,
              metodo_pago: metodoFinal,
              numero_referencia: referenciaPagoMovil.trim() || null,
              pagado: true,
            }),
          });

          if (resp.ok) {
            ventaGuardada = true;
          }
        } catch (apiErr) {
          console.warn('API /api/voz-pos falló, guardando directo en Supabase:', apiErr);
        }

        // Si la API no lo procesó o falló, guardar directo en Supabase
        if (!ventaGuardada) {
          const { data: consumo, error: errConsumo } = await supabase
            .from('consumos')
            .insert({
              cliente_id: cliId || null,
              monto_total_usd: totalUsd,
              tasa_bcv_historica: tasaBcv,
              metodo_pago: metodoFinal,
              pagado: true,
            })
            .select()
            .single();

          if (errConsumo || !consumo) {
            throw new Error(errConsumo?.message || 'Error guardando venta en Supabase');
          }

          const detalles = itemsConfirmados.map((it) => ({
            consumo_id: consumo.id,
            producto_id: it.producto.id,
            cantidad: it.cantidad,
            precio_unitario_usd: it.producto.precio_usd,
          }));

          const { error: errDet } = await supabase.from('consumo_detalles').insert(detalles);
          if (errDet) {
            console.error('Error guardando detalles de consumo:', errDet);
          }

          if (cliId && metodoPagoSugerido === 'saldo_favor') {
            try {
              const { data: cliData } = await supabase
                .from('clientes')
                .select('saldo')
                .eq('id', cliId)
                .single();
              const saldoActual = Number(cliData?.saldo || 0);
              const nuevoSaldo = Math.round((saldoActual - totalUsd) * 100) / 100;
              await supabase.from('clientes').update({ saldo: nuevoSaldo }).eq('id', cliId);
            } catch (e) {
              console.error('Error actualizando saldo cliente:', e);
            }
          }
        }

        refrescarNotificacionesGlobales();

        const nombreCli = clienteObj?.nombre_estudiante || 'Venta General';
        const msgExito = `¡Venta de $${totalUsd.toFixed(2)} procesada exitosamente en el historial para ${nombreCli}!`;

        if (onVentaExitosa) {
          onVentaExitosa(msgExito);
        } else if (onAlerta) {
          onAlerta('exito', msgExito);
        }

        if (onPedidoProcesado) {
          onPedidoProcesado({
            accion: 'orden_pos',
            cliente_id: cliId,
            items: itemsConfirmados.map((it) => ({ producto_id: it.producto.id, cantidad: it.cantidad })),
            pagado: true,
            metodo_pago_sugerido: metodoPagoSugerido,
            resumen_interpretado: msgExito,
          });
        }

        handleOpenChange(false);
      } else if (accionConfirmacion === 'cargar_carrito') {
        if (itemsConfirmados.length === 0) {
          throw new Error('Debes incluir al menos un producto para cargar al carrito.');
        }

        if (onCargarAlCarrito) {
          onCargarAlCarrito(itemsConfirmados, clienteObj, metodoPagoSugerido);
        } else if (onPedidoProcesado) {
          onPedidoProcesado({
            accion: 'orden_pos',
            cliente_id: cliId,
            items: itemsConfirmados.map((it) => ({ producto_id: it.producto.id, cantidad: it.cantidad })),
            pagado: true,
            metodo_pago_sugerido: metodoPagoSugerido,
            resumen_interpretado: 'Pedido cargado al carrito',
          });
        }

        handleOpenChange(false);
      } else if (accionConfirmacion === 'fiar') {
        if (!cliId) {
          throw new Error('Para fiar (Cuenta Cantina) debes asignar un cliente registrado o ingresar uno nuevo.');
        }
        if (itemsConfirmados.length === 0) {
          throw new Error('Debes incluir al menos un producto para registrar la deuda fiada.');
        }

        const totalUsd = itemsConfirmados.reduce(
          (sum, item) => sum + item.producto.precio_usd * item.cantidad,
          0
        );

        let metodoFinalFiado = 'pendiente';
        if (referenciaPagoMovil.trim()) {
          metodoFinalFiado = `pendiente#ref:${referenciaPagoMovil.trim()}`;
        }

        // Insertar consumo fiado en Supabase
        const { data: consumo, error: errConsumo } = await supabase
          .from('consumos')
          .insert({
            cliente_id: cliId,
            monto_total_usd: totalUsd,
            tasa_bcv_historica: tasaBcv,
            metodo_pago: metodoFinalFiado,
            pagado: false,
          })
          .select()
          .single();

        if (errConsumo || !consumo) {
          throw new Error(errConsumo?.message || 'Error guardando consumo fiado en Supabase');
        }

        // Insertar detalles
        const detalles = itemsConfirmados.map((it) => ({
          consumo_id: consumo.id,
          producto_id: it.producto.id,
          cantidad: it.cantidad,
          precio_unitario_usd: it.producto.precio_usd,
        }));
        await supabase.from('consumo_detalles').insert(detalles);

        // Descontar de clientes.saldo
        try {
          const { data: cliData } = await supabase
            .from('clientes')
            .select('saldo')
            .eq('id', cliId)
            .single();
          const saldoActual = Number(cliData?.saldo || 0);
          const nuevoSaldo = Math.round((saldoActual - totalUsd) * 100) / 100;
          await supabase.from('clientes').update({ saldo: nuevoSaldo }).eq('id', cliId);
        } catch (e) {
          console.error('Error actualizando saldo cliente fiado:', e);
        }

        refrescarNotificacionesGlobales();

        const nombreCli = clienteObj?.nombre_estudiante || 'el cliente';
        if (onVentaFiadaExitosa) {
          onVentaFiadaExitosa(`¡Consumo fiado de $${totalUsd.toFixed(2)} registrado para ${nombreCli}!`);
        }

        handleOpenChange(false);
      } else if (accionConfirmacion === 'abono') {
        if (!cliId) {
          throw new Error('Debes seleccionar un cliente para registrar el abono.');
        }
        const montoNum = parseFloat(montoAbono.replace(',', '.'));
        if (!montoNum || montoNum <= 0) {
          throw new Error('Ingresa un monto de abono válido mayor a 0.');
        }

        let metodoFinalAbono = metodoPagoAbono;
        if (metodoPagoAbono === 'pago_movil' && referenciaPagoMovil.trim()) {
          metodoFinalAbono = `pago_movil#ref:${referenciaPagoMovil.trim()}`;
        }

        const res = await procesarAbonoCliente({
          clienteId: cliId,
          montoUsd: montoNum,
          metodoPago: metodoFinalAbono,
          tasaBcv: tasaBcv,
        });

        refrescarNotificacionesGlobales();

        if (onAbonoExitoso) {
          const nombreCli = clienteObj?.nombre_estudiante || 'el cliente';
          onAbonoExitoso(res.mensaje || `¡Abono de $${montoNum.toFixed(2)} procesado para ${nombreCli}!`);
        }

        handleOpenChange(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al procesar';
      console.error('Error al confirmar pedido por voz:', err);
      setErrorConfirmacion(msg);
    } finally {
      setConfirmando(false);
    }
  };

  // Cálculo de totales de productos en la pantalla de confirmación
  const totalUsdItems = itemsConfirmados.reduce(
    (sum, item) => sum + item.producto.precio_usd * item.cantidad,
    0
  );
  const totalBsItems = calcularConversionBs(totalUsdItems, tasaBcv);
  const totalCantidadItems = itemsConfirmados.reduce((sum, item) => sum + item.cantidad, 0);

  // Cliente activo detectado
  const clienteActivo = clientes.find((c) => c.id === clienteIdSeleccionado) || null;
  const saldoClienteActivo = clienteActivo
    ? (clienteActivo.saldo !== undefined && clienteActivo.saldo !== null
        ? Number(clienteActivo.saldo)
        : saldosClientes[clienteActivo.id]?.saldoNetoUsd || 0)
    : 0;

  // Clientes filtrados para selector de cambio con normalización de acentos y seguridad contra nulos
  const normalizarBusquedaVoz = (s?: string | null) =>
    (s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const clientesFiltrados = clientes.filter((c) => {
    if (!busquedaCliente.trim()) return true;
    const q = normalizarBusquedaVoz(busquedaCliente);
    const est = normalizarBusquedaVoz(c.nombre_estudiante);
    const grado = normalizarBusquedaVoz(c.grado_seccion);
    const rep = normalizarBusquedaVoz(c.nombre_representante);
    return est.includes(q) || grado.includes(q) || rep.includes(q);
  });

  return (
    <>
      {/* Botón Disparador en la Pantalla */}
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
                Pedido por Voz
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
            className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain touch-scroll-ios rounded-t-3xl sm:rounded-3xl border-t sm:border border-violet-100 bg-white dark:bg-[#0D111A] p-4 sm:p-6 pb-28 sm:pb-6 shadow-2xl outline-none duration-300 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in-0 sm:zoom-in-95 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[95vw] sm:max-w-xl cursor-grab active:cursor-grabbing"
          >
            {/* Manija táctil para deslizar hacia arriba y abajo en móviles */}
            <div
              className="mx-auto mb-3 -mt-1 flex h-6 w-full cursor-grab active:cursor-grabbing items-center justify-center sm:hidden touch-none"
              title="Deslizar hacia abajo para cerrar"
            >
              <div className="h-1.5 w-12 rounded-full bg-violet-200 active:bg-violet-300 transition-colors" />
            </div>

            {/* Header del Modal */}
            <div className="flex items-start justify-between border-b border-gray-100 dark:border-slate-800 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-200">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <Dialog.Title className="text-sm sm:text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    {paso === 'dictado' ? 'Pedido y Registro por Voz' : 'Confirmar Pedido por Voz'}
                    {paso === 'confirmacion' && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 dark:bg-violet-950/80 dark:text-violet-300">
                        Previsualización
                      </span>
                    )}
                  </Dialog.Title>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {paso === 'dictado'
                      ? 'Habla naturalmente; puedes registrar alumnos/docentes o pedir productos.'
                      : 'Revisa y edita lo que la IA interpretó antes de procesar.'}
                  </p>
                </div>
              </div>

              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-200 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>

            {/* ======================================================== */}
            {/* PASO 1: DICTADO POR VOZ                                 */}
            {/* ======================================================== */}
            {paso === 'dictado' && (
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
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 dark:bg-rose-950/50 px-3 py-1 text-xs font-bold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 animate-pulse">
                      <span className="h-2 w-2 rounded-full bg-rose-600" />
                      Escuchando en vivo... Habla ahora
                    </span>
                  ) : procesando ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 dark:bg-violet-950/50 px-3 py-1 text-xs font-bold text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-900">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-600" />
                      Interpretando con Inteligencia Artificial...
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-slate-800 px-3 py-1 text-xs font-semibold text-gray-600 dark:text-slate-300">
                      {transcripcion ? 'Voz capturada' : 'Presiona el micrófono para hablar'}
                    </span>
                  )}
                </div>

                {/* Caja de Transcripción */}
                <div className="mt-3.5 w-full text-left">
                  <div className="flex items-center justify-between mb-1.5 px-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
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
                      className="w-full resize-none rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-[#111726] p-3 sm:p-3.5 text-sm text-gray-800 dark:text-slate-100 focus:border-violet-500 focus:bg-white dark:focus:bg-[#0D111A] focus:outline-none focus:ring-3 focus:ring-violet-100 font-medium transition"
                    />
                  </div>
                </div>

                {/* Mensaje de Error o Alerta de Cliente Inexistente */}
                <AnimatePresence>
                  {clienteInexistente ? (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="mt-3 w-full rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-3.5 text-left space-y-2.5 animate-in fade-in"
                    >
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-extrabold text-amber-950 dark:text-amber-100">
                            Cliente no registrado en la base de datos
                          </h4>
                          <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                            No existe ningún alumno ni personal registrado como <strong>«{clienteInexistente}»</strong>. Para poder registrar un abono o cargar a cuenta, el cliente debe existir en el sistema.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-amber-200 dark:border-amber-900">
                        <button
                          type="button"
                          onClick={() => {
                            setNuevoCliente({
                              nombre_estudiante: clienteInexistente,
                              grado_seccion: '',
                              nombre_representante: '',
                              telefono_whatsapp: '',
                            });
                            setClienteIdSeleccionado(null);
                            setClienteInexistente(null);
                            setErrorMsg(null);
                            setPaso('confirmacion');
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition active:scale-95"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Registrar a «{clienteInexistente}» ahora
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setClienteInexistente(null);
                            setErrorMsg(null);
                          }}
                          className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium"
                        >
                          Corregir nombre
                        </button>
                      </div>
                    </motion.div>
                  ) : errorMsg ? (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="mt-3 flex w-full items-start gap-2.5 rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-3 text-left text-xs text-rose-800 dark:text-rose-200"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-bold">Aviso:</p>
                        <p className="text-rose-700 dark:text-rose-300">{errorMsg}</p>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                {/* Ejemplos Sugeridos Rápidos */}
                <div className="mt-3.5 w-full text-left rounded-2xl border border-violet-100 dark:border-violet-950/60 bg-violet-50/50 dark:bg-violet-950/20 p-2.5 sm:p-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-violet-900 dark:text-violet-300 mb-1.5">
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
                          finalTranscriptRef.current = ejemplo;
                        }}
                        className="w-full text-left text-[11px] text-violet-800 dark:text-violet-300 hover:text-violet-950 dark:hover:text-white hover:bg-violet-100/70 dark:hover:bg-violet-900/40 rounded-xl px-2.5 py-1.5 transition font-medium border border-violet-200/50 dark:border-violet-800/40 flex items-center justify-between group"
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
            )}

            {/* Footer de Paso 1 */}
            {paso === 'dictado' && (
              <div className="flex items-center justify-between border-t border-gray-100 dark:border-slate-800 pt-3.5">
                <button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  className="rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => procesarConGemini()}
                    disabled={procesando || !transcripcion.trim()}
                    className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-violet-200 dark:shadow-none hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {procesando ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                        <span>Interpretando con IA...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 text-amber-300" />
                        <span>Interpretar Pedido</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* PASO 2: MODAL DE CONFIRMACIÓN Y PREVISUALIZACIÓN          */}
            {/* ======================================================== */}
            {paso === 'confirmacion' && (
              <div className="my-4 space-y-4 text-left">
                {/* Frase original dictada */}
                <div className="rounded-2xl bg-violet-50/70 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/50 p-2.5 text-xs text-violet-950 dark:text-violet-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Volume2 className="h-4 w-4 text-violet-600 shrink-0" />
                    <p className="truncate text-[11px]">
                      <span className="font-bold">Dictado:</span> <em>«{transcripcion}»</em>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPaso('dictado')}
                    className="text-[11px] font-bold text-violet-600 dark:text-violet-400 hover:underline shrink-0 flex items-center gap-1"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Modificar
                  </button>
                </div>

                {/* 1. SELECCIÓN DE ACCIÓN A REALIZAR */}
                <div>
                  <label className="text-xs font-bold text-gray-800 dark:text-slate-200 flex items-center justify-between mb-1.5">
                    <span>Acción a Realizar *</span>
                    <span className="text-[10px] text-gray-500 font-normal">Toca para cambiar</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {/* Cobrar Venta Directa */}
                    <button
                      type="button"
                      onClick={() => setAccionConfirmacion('cobrar_venta')}
                      className={`p-2.5 rounded-2xl border text-left flex flex-col items-start gap-1.5 transition ${
                        accionConfirmacion === 'cobrar_venta'
                          ? 'border-emerald-600 bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-500/20 shadow-xs'
                          : 'border-gray-200/80 dark:border-slate-800 bg-white dark:bg-[#111726] text-gray-700 dark:text-slate-300 hover:bg-gray-50'
                      }`}
                    >
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${
                          accionConfirmacion === 'cobrar_venta'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700'
                        }`}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">Cobrar Venta</div>
                        <div className="text-[10px] text-gray-500 dark:text-slate-400 truncate">Guardar en historial</div>
                      </div>
                    </button>

                    {/* Fiar / Cuenta Cantina */}
                    <button
                      type="button"
                      onClick={() => setAccionConfirmacion('fiar')}
                      className={`p-2.5 rounded-2xl border text-left flex flex-col items-start gap-1.5 transition ${
                        accionConfirmacion === 'fiar'
                          ? 'border-amber-500 bg-amber-50/90 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 ring-2 ring-amber-500/20 shadow-xs'
                          : 'border-gray-200/80 dark:border-slate-800 bg-white dark:bg-[#111726] text-gray-700 dark:text-slate-300 hover:bg-gray-50'
                      }`}
                    >
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${
                          accionConfirmacion === 'fiar'
                            ? 'bg-amber-500 text-white'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-700'
                        }`}
                      >
                        <Receipt className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">Fiar (Cuenta)</div>
                        <div className="text-[10px] text-gray-500 dark:text-slate-400 truncate">Anotar deuda al alumno</div>
                      </div>
                    </button>

                    {/* Registrar Abono */}
                    <button
                      type="button"
                      onClick={() => setAccionConfirmacion('abono')}
                      className={`p-2.5 rounded-2xl border text-left flex flex-col items-start gap-1.5 transition ${
                        accionConfirmacion === 'abono'
                          ? 'border-indigo-600 bg-indigo-50/90 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 ring-2 ring-indigo-500/20 shadow-xs'
                          : 'border-gray-200/80 dark:border-slate-800 bg-white dark:bg-[#111726] text-gray-700 dark:text-slate-300 hover:bg-gray-50'
                      }`}
                    >
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${
                          accionConfirmacion === 'abono'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700'
                        }`}
                      >
                        <PiggyBank className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">Registrar Abono</div>
                        <div className="text-[10px] text-gray-500 dark:text-slate-400 truncate">Saldo a favor o pago</div>
                      </div>
                    </button>

                    {/* Cargar al Carrito */}
                    <button
                      type="button"
                      onClick={() => setAccionConfirmacion('cargar_carrito')}
                      className={`p-2.5 rounded-2xl border text-left flex flex-col items-start gap-1.5 transition ${
                        accionConfirmacion === 'cargar_carrito'
                          ? 'border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 ring-2 ring-slate-500/20 shadow-xs'
                          : 'border-gray-200/80 dark:border-slate-800 bg-white dark:bg-[#111726] text-gray-700 dark:text-slate-300 hover:bg-gray-50'
                      }`}
                    >
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${
                          accionConfirmacion === 'cargar_carrito'
                            ? 'bg-slate-700 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                        }`}
                      >
                        <ShoppingCart className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">Solo Carrito</div>
                        <div className="text-[10px] text-gray-500 dark:text-slate-400 truncate">Cargar a la orden</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 2. CLIENTE DETECTADO (EDITABLE) */}
                <div className="rounded-2xl border border-gray-200/90 dark:border-slate-800 bg-gray-50/70 dark:bg-[#111726] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-violet-600" />
                      Cliente Detectado:
                    </label>

                    {!cambiandoCliente && !nuevoCliente && (
                      <button
                        type="button"
                        onClick={() => setCambiandoCliente(true)}
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <Edit2 className="h-3 w-3" />
                        Cambiar Cliente
                      </button>
                    )}
                  </div>

                  {/* Caso A: Registro de Nuevo Alumno / Personal */}
                  {nuevoCliente ? (
                    <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-white dark:bg-[#0D111A] p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
                          <UserPlus className="h-3.5 w-3.5" />
                          Nuevo Cliente Detectado en el Dictado
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setNuevoCliente(null);
                            setCambiandoCliente(true);
                          }}
                          className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
                        >
                          Cancelar y elegir existente
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-semibold text-gray-600 dark:text-slate-400 block mb-0.5">
                            Nombre del Alumno / Personal *
                          </label>
                          <input
                            type="text"
                            value={nuevoCliente.nombre_estudiante}
                            onChange={(e) =>
                              setNuevoCliente((prev) => prev ? { ...prev, nombre_estudiante: e.target.value } : null)
                            }
                            placeholder="Ej: Alexis Real"
                            className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:border-violet-500"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-semibold text-gray-600 dark:text-slate-400 block mb-0.5">
                            Grado y Sección *
                          </label>
                          <input
                            type="text"
                            value={nuevoCliente.grado_seccion}
                            onChange={(e) =>
                              setNuevoCliente((prev) => prev ? { ...prev, grado_seccion: e.target.value } : null)
                            }
                            placeholder="Ej: 4to Grado A"
                            className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-gray-900 dark:text-white focus:outline-none focus:border-violet-500"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-semibold text-gray-600 dark:text-slate-400 block mb-0.5">
                            Representante / Cargo (Opcional)
                          </label>
                          <input
                            type="text"
                            value={nuevoCliente.nombre_representante || ''}
                            onChange={(e) =>
                              setNuevoCliente((prev) => prev ? { ...prev, nombre_representante: e.target.value } : null)
                            }
                            placeholder="Ej: María Real (Madre)"
                            className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900 px-2.5 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-violet-500"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-semibold text-gray-600 dark:text-slate-400 block mb-0.5">
                            Teléfono WhatsApp (Opcional)
                          </label>
                          <input
                            type="text"
                            value={nuevoCliente.telefono_whatsapp || ''}
                            onChange={(e) =>
                              setNuevoCliente((prev) => prev ? { ...prev, telefono_whatsapp: e.target.value } : null)
                            }
                            placeholder="Ej: 04121234567"
                            className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900 px-2.5 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-violet-500"
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                        ✨ Se guardará automáticamente en el sistema al confirmar el pedido.
                      </p>
                    </div>
                  ) : cambiandoCliente ? (
                    /* Caso B: Modo Selector / Búsqueda de Cliente */
                    <div className="space-y-2 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-2.5">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                        <input
                          type="text"
                          value={busquedaCliente}
                          onChange={(e) => setBusquedaCliente(e.target.value)}
                          placeholder="Buscar por nombre o sección..."
                          className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 pl-8 pr-2 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                        {/* Opción Venta General */}
                        <button
                          type="button"
                          onClick={() => {
                            setClienteIdSeleccionado(null);
                            setCambiandoCliente(false);
                          }}
                          className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between transition ${
                            !clienteIdSeleccionado
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 font-bold text-indigo-900 dark:text-indigo-200 border border-indigo-200'
                              : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300'
                          }`}
                        >
                          <span>Venta General / Ocasional (Sin cliente)</span>
                          {!clienteIdSeleccionado && <Check className="h-3.5 w-3.5 text-indigo-600" />}
                        </button>

                        {/* Botón Registrar Nuevo Alumno manual */}
                        <button
                          type="button"
                          onClick={() => {
                            setNuevoCliente({
                              nombre_estudiante: '',
                              grado_seccion: 'Estudiante',
                              nombre_representante: '',
                              telefono_whatsapp: '',
                            });
                            setClienteIdSeleccionado(null);
                            setCambiandoCliente(false);
                          }}
                          className="w-full text-left p-2 rounded-xl text-xs text-violet-700 dark:text-violet-300 font-bold hover:bg-violet-50 dark:hover:bg-violet-950/40 flex items-center gap-1.5"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          + Registrar Nuevo Alumno o Personal
                        </button>

                        {/* Lista de clientes registrados */}
                        {clientesFiltrados.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setClienteIdSeleccionado(c.id);
                              setCambiandoCliente(false);
                            }}
                            className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between transition ${
                              clienteIdSeleccionado === c.id
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 font-bold text-indigo-900 dark:text-indigo-200 border border-indigo-200'
                                : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="min-w-0">
                              <span className="truncate block">{c.nombre_estudiante}</span>
                              <span className="text-[10px] text-gray-400 font-normal">
                                {c.grado_seccion || 'Estudiante'}
                              </span>
                            </div>
                            {clienteIdSeleccionado === c.id && <Check className="h-3.5 w-3.5 text-indigo-600" />}
                          </button>
                        ))}
                      </div>

                      <div className="text-right pt-1">
                        <button
                          type="button"
                          onClick={() => setCambiandoCliente(false)}
                          className="text-[10px] text-gray-500 hover:text-gray-700"
                        >
                          Cerrar lista
                        </button>
                      </div>
                    </div>
                  ) : clienteActivo ? (
                    /* Caso C: Cliente Registrado Activo */
                    <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300">
                          <GraduationCap className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-gray-900 dark:text-white truncate block">
                            {clienteActivo.nombre_estudiante}
                          </span>
                          <span className="text-[10px] text-gray-500 dark:text-slate-400 truncate block">
                            {clienteActivo.grado_seccion || 'Estudiante'}
                          </span>
                        </div>
                      </div>

                      {/* Insignia de Saldo unificado */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          saldoClienteActivo > 0
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                            : saldoClienteActivo < 0
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {saldoClienteActivo > 0
                          ? `+${formatUSD(saldoClienteActivo)} a Favor`
                          : saldoClienteActivo < 0
                          ? `Debe ${formatUSD(Math.abs(saldoClienteActivo))}`
                          : '$0.00 Solvente'}
                      </span>
                    </div>
                  ) : (
                    /* Caso D: Venta General (Sin cliente asignado) */
                    <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-2.5">
                      <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-slate-300">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="font-semibold">Venta General / Ocasional (Sin cliente)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCambiandoCliente(true)}
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        Asignar Cliente
                      </button>
                    </div>
                  )}
                </div>

                {/* 3. PRODUCTOS ENTENDIDOS (VISIBLE SI ACCION ES 'cobrar_venta', 'cargar_carrito' O 'fiar') */}
                {(accionConfirmacion === 'cobrar_venta' || accionConfirmacion === 'cargar_carrito' || accionConfirmacion === 'fiar') && (
                  <div className="rounded-2xl border border-gray-200/90 dark:border-slate-800 bg-gray-50/70 dark:bg-[#111726] p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
                        <ShoppingCart className="h-3.5 w-3.5 text-violet-600" />
                        Productos Entendidos ({totalCantidadItems}):
                      </label>
                      <span className="text-[10px] font-mono text-gray-500">
                        Tasa: {formatBs(tasaBcv)}
                      </span>
                    </div>

                    {/* Lista de Items */}
                    {itemsConfirmados.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-300 dark:border-slate-700 p-3 text-center text-xs text-gray-500">
                        No se detectaron productos específicos en el dictado. Puedes agregar productos abajo.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {itemsConfirmados.map((it) => {
                          const subUsd = it.producto.precio_usd * it.cantidad;
                          const subBs = calcularConversionBs(subUsd, tasaBcv);
                          return (
                            <div
                              key={it.producto.id}
                              className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-2"
                            >
                              <div className="min-w-0 flex-1">
                                <span className="text-xs font-bold text-gray-900 dark:text-white truncate block">
                                  {it.producto.nombre}
                                </span>
                                <span className="text-[10px] text-gray-500 dark:text-slate-400 font-mono">
                                  {formatUSD(it.producto.precio_usd)} c/u
                                </span>
                              </div>

                              {/* Stepper de Cantidad */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleModificarCantidadItem(it.producto.id, -1)}
                                  className="h-6 w-6 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 flex items-center justify-center text-gray-700 dark:text-slate-200 hover:bg-gray-100 active:scale-95"
                                  title="Disminuir"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="w-5 text-center text-xs font-mono font-bold text-gray-900 dark:text-white">
                                  {it.cantidad}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleModificarCantidadItem(it.producto.id, 1)}
                                  className="h-6 w-6 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 flex items-center justify-center text-gray-700 dark:text-slate-200 hover:bg-gray-100 active:scale-95"
                                  title="Aumentar"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>

                              {/* Subtotal del item */}
                              <div className="text-right min-w-[65px] shrink-0 font-mono">
                                <span className="text-xs font-bold text-gray-900 dark:text-white block">
                                  {formatUSD(subUsd)}
                                </span>
                                <span className="text-[9px] text-amber-700 dark:text-amber-400 block">
                                  {formatBs(subBs)}
                                </span>
                              </div>

                              {/* Eliminar item */}
                              <button
                                type="button"
                                onClick={() => handleEliminarItem(it.producto.id)}
                                className="p-1 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition shrink-0"
                                title="Eliminar ítem"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Selector rápido para añadir otro producto del catálogo */}
                    <div className="flex items-center gap-2 pt-1">
                      <select
                        value={productoAAgregarId}
                        onChange={(e) => handleAgregarOtroProducto(e.target.value)}
                        className="flex-1 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#0D111A] px-2.5 py-1.5 text-xs text-gray-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">+ Agregar otro producto del catálogo...</option>
                        {productos.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre} ({formatUSD(p.precio_usd)})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Barra de Totales */}
                    <div className="flex items-center justify-between border-t border-gray-200/80 dark:border-slate-800 pt-2 font-mono">
                      <span className="text-xs font-bold text-gray-700 dark:text-slate-300">
                        Total a {accionConfirmacion === 'fiar' ? 'Fiar' : 'Cobrar'}:
                      </span>
                      <div className="text-right">
                        <span className="text-sm font-extrabold text-gray-900 dark:text-white mr-1.5">
                          {formatUSD(totalUsdItems)}
                        </span>
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                          ({formatBs(totalBsItems)})
                        </span>
                      </div>
                    </div>

                    {/* Método de Pago y Referencia si es Cobrar Venta o Cargar al Carrito */}
                    {(accionConfirmacion === 'cobrar_venta' || accionConfirmacion === 'cargar_carrito') && (
                      <div className="pt-2 border-t border-gray-200/80 dark:border-slate-800 space-y-2">
                        <label className="text-[11px] font-semibold text-gray-700 dark:text-slate-300 block">
                          Método de Pago {accionConfirmacion === 'cobrar_venta' ? 'a Registrar:' : 'Sugerido en Caja:'}
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                          {[
                            { id: 'efectivo_usd' as MetodoPagoId, label: 'Efectivo $' },
                            { id: 'efectivo_bs' as MetodoPagoId, label: 'Efectivo Bs.' },
                            { id: 'pago_movil' as MetodoPagoId, label: 'Pago Móvil' },
                            { id: 'punto_debito' as MetodoPagoId, label: 'Punto Débito' },
                            { id: 'saldo_favor' as MetodoPagoId, label: 'Saldo a Favor' },
                          ].map((met) => (
                            <button
                              key={met.id}
                              type="button"
                              onClick={() => setMetodoPagoSugerido(met.id)}
                              className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition ${
                                metodoPagoSugerido === met.id
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                  : 'bg-white dark:bg-[#0D111A] text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-800 hover:bg-gray-50'
                              }`}
                            >
                              {met.label}
                            </button>
                          ))}
                        </div>

                        {/* Campo de Referencia de Pago Móvil en Modal de Voz */}
                        {metodoPagoSugerido === 'pago_movil' && (
                          <div className="mt-2 rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50/70 dark:bg-sky-950/40 p-2.5 space-y-1 animate-in fade-in">
                            <label className="text-[10px] font-bold text-sky-900 dark:text-sky-200 flex items-center gap-1.5">
                              <Smartphone className="h-3.5 w-3.5 text-sky-600" />
                              Número de Referencia de Pago Móvil (Opcional):
                            </label>
                            <input
                              type="text"
                              value={referenciaPagoMovil}
                              onChange={(e) => setReferenciaPagoMovil(e.target.value)}
                              placeholder="Ej: 4 últimos dígitos o comprobante completo (0123)"
                              className="w-full rounded-xl border border-sky-200 dark:border-sky-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono font-bold text-gray-900 dark:text-white placeholder:font-normal focus:outline-none focus:border-sky-500"
                            />
                            <p className="text-[9px] text-sky-700 dark:text-sky-400">
                              Se registrará en la transacción y aparecerá en el Historial de Transacciones.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. MONTO Y MÉTODO DE ABONO (VISIBLE SI ACCION ES 'abono') */}
                {accionConfirmacion === 'abono' && (
                  <div className="rounded-2xl border border-gray-200/90 dark:border-slate-800 bg-gray-50/70 dark:bg-[#111726] p-3 space-y-3">
                    <label className="text-xs font-bold text-gray-800 dark:text-slate-200 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5 text-indigo-600" />
                        Monto a Abonar:
                      </span>
                      <span className="text-[10px] font-mono text-gray-500">
                        Tasa: {formatBs(tasaBcv)}
                      </span>
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <span className="text-[10px] font-semibold text-gray-600 dark:text-slate-400 block mb-0.5">
                          Monto en Dólares ($) *
                        </span>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600">
                            $
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={montoAbono}
                            onKeyDown={(e) => handleDecimalKeyDown(e, montoAbono)}
                            onChange={(e) => setMontoAbono(sanitizeDecimalInput(e.target.value))}
                            placeholder="0.00"
                            className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#0D111A] py-1.5 pl-7 pr-3 text-xs font-mono font-bold text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-semibold text-gray-600 dark:text-slate-400 block mb-0.5">
                          Equivalente en Bolívares (Bs.)
                        </span>
                        <div className="rounded-xl border border-gray-200/80 dark:border-slate-800 bg-gray-100/60 dark:bg-slate-900 py-1.5 px-3 text-xs font-mono font-bold text-amber-700 dark:text-amber-400 flex items-center h-[34px]">
                          {montoAbono && parseFloat(montoAbono.replace(',', '.')) > 0
                            ? formatBs(calcularConversionBs(parseFloat(montoAbono.replace(',', '.')), tasaBcv))
                            : 'Bs. 0,00'}
                        </div>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-semibold text-gray-600 dark:text-slate-400 block mb-1">
                        Método de Abono Entregado:
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {[
                          { id: 'efectivo_usd', label: 'Efectivo $' },
                          { id: 'efectivo_bs', label: 'Efectivo Bs.' },
                          { id: 'pago_movil', label: 'Pago Móvil' },
                          { id: 'punto_debito', label: 'Punto Débito' },
                          { id: 'zelle', label: 'Zelle' },
                        ].map((met) => (
                          <button
                            key={met.id}
                            type="button"
                            onClick={() => setMetodoPagoAbono(met.id)}
                            className={`py-1 px-2 rounded-xl text-[11px] font-bold border transition ${
                              metodoPagoAbono === met.id
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                : 'bg-white dark:bg-[#0D111A] text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-800 hover:bg-gray-50'
                            }`}
                          >
                            {met.label}
                          </button>
                        ))}
                      </div>

                      {/* Campo de Referencia para Abono por Pago Móvil */}
                      {metodoPagoAbono === 'pago_movil' && (
                        <div className="mt-2 rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50/70 dark:bg-sky-950/40 p-2.5 space-y-1 animate-in fade-in">
                          <label className="text-[10px] font-bold text-sky-900 dark:text-sky-200 flex items-center gap-1.5">
                            <Smartphone className="h-3.5 w-3.5 text-sky-600" />
                            Número de Referencia de Pago Móvil (Opcional):
                          </label>
                          <input
                            type="text"
                            value={referenciaPagoMovil}
                            onChange={(e) => setReferenciaPagoMovil(e.target.value)}
                            placeholder="Ej: 4 últimos dígitos o comprobante completo (0123)"
                            className="w-full rounded-xl border border-sky-200 dark:border-sky-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono font-bold text-gray-900 dark:text-white placeholder:font-normal focus:outline-none focus:border-sky-500"
                          />
                          <p className="text-[9px] text-sky-700 dark:text-sky-400">
                            Se registrará en el recibo de abono y en el Historial de Transacciones.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Alerta de Error en la Confirmación */}
                <AnimatePresence>
                  {errorConfirmacion && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-2.5 text-xs text-rose-800 dark:text-rose-200"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                      <p className="flex-1 font-semibold">{errorConfirmacion}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Footer de Confirmación */}
                <div className="flex items-center justify-between border-t border-gray-100 dark:border-slate-800 pt-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPaso('dictado')}
                      disabled={confirmando}
                      className="rounded-xl px-3 py-2 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                    >
                      ← Volver a Dictar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenChange(false)}
                      disabled={confirmando}
                      className="rounded-xl px-3 py-2 text-xs font-semibold text-gray-400 hover:text-gray-600 transition"
                    >
                      Cancelar
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmarYProcesar}
                    disabled={confirmando}
                    className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-violet-200 dark:shadow-none hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 transition active:scale-95"
                  >
                    {confirmando ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                        <span>Procesando...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                        <span>Confirmar y Procesar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
