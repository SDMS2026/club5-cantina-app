'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import * as Dialog from '@radix-ui/react-dialog';
import * as Popover from '@radix-ui/react-popover';
import {
  Receipt,
  Search,
  CheckCircle2,
  Calendar,
  User,
  GraduationCap,
  MessageCircle,
  CreditCard,
  DollarSign,
  Smartphone,
  Landmark,
  X,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  ArrowUpDown,
  Check,
  Copy,
  Info,
  Briefcase,
  Menu,
  Wallet,
  PiggyBank,
  Sparkles,
} from 'lucide-react';
import { obtenerTasaBCV, TASA_BCV_FALLBACK_DEFAULT } from '@/lib/dolarApi';
import { supabase } from '@/lib/supabaseClient';
import { formatUSD, formatBs, calcularConversionBs } from '@/lib/utils';
import { esProfesorOPersonal } from '@/lib/constants';
import { Cliente, Producto } from '@/types/pos';
import { NotificationBell } from '@/components/NotificationBell';
import { refrescarNotificacionesGlobales } from '@/components/NotificationsContext';
import { useSidebar } from '@/components/SidebarContext';
import { useModalDragScroll } from '@/lib/useModalDragScroll';
import {
  obtenerSaldosTodosClientes,
  procesarAbonoCliente,
  ResumenSaldoCliente,
} from '@/lib/clientBalance';

interface ConsumoDetalleExtendido {
  id: string;
  cantidad: number;
  precio_unitario_usd: number;
  productos?: Producto | null;
}

interface DeudaRegistro {
  id: string;
  cliente_id: string | null;
  monto_total_usd: number;
  tasa_bcv_historica: number;
  fecha: string;
  pagado: boolean;
  metodo_pago: string;
  clientes?: Cliente | null;
  consumo_detalles?: ConsumoDetalleExtendido[];
}

// Estructura consolidada por estudiante
interface CuentaEstudianteAgrupada {
  clienteKey: string;
  cliente: Cliente | null;
  totalDeudaUsd: number;
  totalDeudaBs: number;
  consumos: DeudaRegistro[];
  fechaMasReciente: string;
  fechaMasAntigua: string;
}

type MetodoCancelacionId = 'pago_movil' | 'efectivo_usd' | 'zelle' | 'punto_debito' | 'saldo_favor';

const METODOS_CANCELACION = [
  {
    id: 'pago_movil' as MetodoCancelacionId,
    nombre: 'Pago Móvil (Bs.)',
    icono: Smartphone,
    descripcion: 'BNC (0191) - 14.953.511 - 0412-5404830',
    moneda: 'Bs',
  },
  {
    id: 'efectivo_usd' as MetodoCancelacionId,
    nombre: 'Efectivo USD ($)',
    icono: DollarSign,
    descripcion: 'Pago directo en billetes divisa en cantina',
    moneda: 'USD',
  },
  {
    id: 'zelle' as MetodoCancelacionId,
    nombre: 'Zelle ($)',
    icono: Landmark,
    descripcion: 'Transferencia digital en dólares',
    moneda: 'USD',
  },
  {
    id: 'punto_debito' as MetodoCancelacionId,
    nombre: 'Punto de Venta (Bs.)',
    icono: CreditCard,
    descripcion: 'Tarjeta de débito en bolívares en caja',
    moneda: 'Bs',
  },
  {
    id: 'saldo_favor' as MetodoCancelacionId,
    nombre: 'Saldo a Favor (+)',
    icono: PiggyBank,
    descripcion: 'Usar crédito positivo prepagado del cliente',
    moneda: 'USD',
  },
];

type CriterioOrden = 'recientes' | 'antiguos' | 'mayor_monto' | 'menor_monto';

const OPCIONES_ORDEN = [
  { id: 'recientes' as CriterioOrden, label: 'Más recientes primero' },
  { id: 'antiguos' as CriterioOrden, label: 'Más antiguos primero' },
  { id: 'mayor_monto' as CriterioOrden, label: 'Mayor monto acumulado' },
  { id: 'menor_monto' as CriterioOrden, label: 'Menor monto acumulado' },
];

export default function DeudasPage() {
  const [montado, setMontado] = useState(false);
  const { toggleSidebar, abierto: sidebarAbierto } = useSidebar();

  // Tasa BCV
  const [tasaBcv, setTasaBcv] = useState<number>(TASA_BCV_FALLBACK_DEFAULT);
  const [cargandoTasa, setCargandoTasa] = useState<boolean>(true);
  const [ultimaActualizacionTasa, setUltimaActualizacionTasa] = useState<Date | null>(null);

  // Deudas y saldos desde Supabase
  const [deudas, setDeudas] = useState<DeudaRegistro[]>([]);
  const [saldosClientes, setSaldosClientes] = useState<Record<string, ResumenSaldoCliente>>({});
  const [todosLosClientes, setTodosLosClientes] = useState<Cliente[]>([]);
  const [cargandoDeudas, setCargandoDeudas] = useState<boolean>(true);

  // Filtros
  const [busqueda, setBusqueda] = useState<string>('');
  const [filtroGrado, setFiltroGrado] = useState<string>('todos');
  const [criterioOrden, setCriterioOrden] = useState<CriterioOrden>('recientes');

  // Estados de apertura de dropdowns personalizados
  const [popoverGradoAbierto, setPopoverGradoAbierto] = useState<boolean>(false);
  const [popoverOrdenAbierto, setPopoverOrdenAbierto] = useState<boolean>(false);

  // Acordeón de detalles por estudiante
  const [estudiantesDesplegados, setEstudiantesDesplegados] = useState<Record<string, boolean>>({});

  // Modal de liquidación
  const [modalLiquidacion, setModalLiquidacion] = useState<{
    abierto: boolean;
    titulo: string;
    subtitulo: string;
    montoUsd: number;
    idsConsumos: string[];
    nombreEstudiante: string;
    clienteId?: string | null;
  }>({
    abierto: false,
    titulo: '',
    subtitulo: '',
    montoUsd: 0,
    idsConsumos: [],
    nombreEstudiante: '',
    clienteId: null,
  });

  // Deslizamiento vertical y arrastre (drag-to-scroll) para móviles y emuladores con Body Scroll Lock
  const dragScrollDeuda = useModalDragScroll({
    isOpen: modalLiquidacion.abierto,
    onDismiss: () =>
      setModalLiquidacion((prev) => ({
        ...prev,
        abierto: false,
      })),
  });

  const [metodoPago, setMetodoPago] = useState<MetodoCancelacionId>('pago_movil');
  const [procesandoPago, setProcesandoPago] = useState<boolean>(false);
  const [errorPago, setErrorPago] = useState<string | null>(null);

  // Modal para Abonar / Depositar Saldo a Favor
  const [modalAbono, setModalAbono] = useState<{
    abierto: boolean;
    cliente: Cliente | null;
    montoUsd: string;
    metodoPago: string;
    guardando: boolean;
    error: string | null;
  }>({
    abierto: false,
    cliente: null,
    montoUsd: '',
    metodoPago: 'efectivo_usd',
    guardando: false,
    error: null,
  });

  const dragScrollAbono = useModalDragScroll({
    isOpen: modalAbono.abierto,
    onDismiss: () => setModalAbono((prev) => ({ ...prev, abierto: false })),
  });

  // Notificación toast
  const [notificacion, setNotificacion] = useState<{ tipo: 'exito' | 'info'; texto: string } | null>(null);
  const [creandoDeudaMuestra, setCreandoDeudaMuestra] = useState<boolean>(false);

  // Cargar Tasa BCV
  const cargarTasa = useCallback(async () => {
    setCargandoTasa(true);
    try {
      const tasa = await obtenerTasaBCV();
      setTasaBcv(tasa);
      setUltimaActualizacionTasa(new Date());
    } catch (e) {
      console.error('Error cargando tasa BCV:', e);
    } finally {
      setCargandoTasa(false);
    }
  }, []);

  // Cargar Deudas y Saldos desde Supabase
  const cargarDeudas = useCallback(async () => {
    setCargandoDeudas(true);
    try {
      const [{ data, error }, saldos, { data: clientesData }] = await Promise.all([
        supabase
          .from('consumos')
          .select(`
            id,
            cliente_id,
            monto_total_usd,
            tasa_bcv_historica,
            fecha,
            pagado,
            metodo_pago,
            clientes (
              id,
              nombre_estudiante,
              grado_seccion,
              nombre_representante,
              telefono_whatsapp
            ),
            consumo_detalles (
              id,
              cantidad,
              precio_unitario_usd,
              productos (
                id,
                nombre,
                imagen_url,
                precio_usd,
                activo
              )
            )
          `)
          .eq('pagado', false)
          .order('fecha', { ascending: false }),
        obtenerSaldosTodosClientes(),
        supabase.from('clientes').select('*').order('nombre_estudiante', { ascending: true }),
      ]);

      if (error) {
        console.error('Error al consultar deudas en Supabase:', error);
      } else {
        setDeudas((data as unknown as DeudaRegistro[]) || []);
      }
      setSaldosClientes(saldos);
      if (clientesData) {
        setTodosLosClientes(clientesData);
      }
    } catch (e) {
      console.error('Excepción cargando consumos pendientes y saldos:', e);
    } finally {
      setCargandoDeudas(false);
    }
  }, []);

  useEffect(() => {
    setMontado(true);
    cargarTasa();
    cargarDeudas();

    // Sincronización en tiempo real con Supabase entre dispositivos
    const canalRealtime = supabase
      .channel('deudas_realtime_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'consumos' },
        () => {
          cargarDeudas();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clientes' },
        () => {
          cargarDeudas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canalRealtime);
    };
  }, [cargarTasa, cargarDeudas]);

  // Lista única de Grados / Secciones para el selector desplegable
  const gradosDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const d of deudas) {
      if (d.clientes?.grado_seccion) {
        set.add(d.clientes.grado_seccion);
      }
    }
    return Array.from(set).sort();
  }, [deudas]);

  // Agrupar deudas pendientes por estudiante
  const cuentasAgrupadas = useMemo(() => {
    const mapa = new Map<string, CuentaEstudianteAgrupada>();

    for (const deuda of deudas) {
      const key = deuda.cliente_id || `sin-cliente-${deuda.id}`;
      if (!mapa.has(key)) {
        mapa.set(key, {
          clienteKey: key,
          cliente: deuda.clientes || null,
          totalDeudaUsd: 0,
          totalDeudaBs: 0,
          consumos: [],
          fechaMasReciente: deuda.fecha,
          fechaMasAntigua: deuda.fecha,
        });
      }

      const cuenta = mapa.get(key)!;
      cuenta.totalDeudaUsd += Number(deuda.monto_total_usd || 0);
      cuenta.consumos.push(deuda);

      if (new Date(deuda.fecha) > new Date(cuenta.fechaMasReciente)) {
        cuenta.fechaMasReciente = deuda.fecha;
      }
      if (new Date(deuda.fecha) < new Date(cuenta.fechaMasAntigua)) {
        cuenta.fechaMasAntigua = deuda.fecha;
      }
    }

    // Calcular montos en Bs y ordenar consumos internos
    for (const cuenta of mapa.values()) {
      cuenta.totalDeudaBs = calcularConversionBs(cuenta.totalDeudaUsd, tasaBcv);
      cuenta.consumos.sort(
        (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
      );
    }

    return Array.from(mapa.values());
  }, [deudas, tasaBcv]);

  // Filtrar y ordenar cuentas de estudiantes
  const cuentasFiltradas = useMemo(() => {
    let lista = [...cuentasAgrupadas];

    // Filtro por texto
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      lista = lista.filter((c) => {
        const est = c.cliente?.nombre_estudiante?.toLowerCase() || 'venta ocasional';
        const rep = c.cliente?.nombre_representante?.toLowerCase() || '';
        const grado = c.cliente?.grado_seccion?.toLowerCase() || '';
        const tel = c.cliente?.telefono_whatsapp || '';
        return est.includes(q) || rep.includes(q) || grado.includes(q) || tel.includes(q);
      });
    }

    // Filtro por Grado / Sección
    if (filtroGrado !== 'todos') {
      lista = lista.filter((c) => c.cliente?.grado_seccion === filtroGrado);
    }

    // Ordenamiento por Fecha o Monto
    lista.sort((a, b) => {
      if (criterioOrden === 'recientes') {
        return (
          new Date(b.fechaMasReciente).getTime() -
          new Date(a.fechaMasReciente).getTime()
        );
      }
      if (criterioOrden === 'antiguos') {
        return (
          new Date(a.fechaMasAntigua).getTime() -
          new Date(b.fechaMasAntigua).getTime()
        );
      }
      if (criterioOrden === 'mayor_monto') {
        return b.totalDeudaUsd - a.totalDeudaUsd;
      }
      if (criterioOrden === 'menor_monto') {
        return a.totalDeudaUsd - b.totalDeudaUsd;
      }
      return 0;
    });

    return lista;
  }, [cuentasAgrupadas, busqueda, filtroGrado, criterioOrden]);

  // Totales globales de deudas
  const granTotalUsd = useMemo(() => {
    return deudas.reduce((acc, d) => acc + (d.monto_total_usd || 0), 0);
  }, [deudas]);

  const granTotalBs = useMemo(() => {
    return calcularConversionBs(granTotalUsd, tasaBcv);
  }, [granTotalUsd, tasaBcv]);

  // Total global de saldos a favor (créditos positivos disponibles de todos los clientes)
  const totalSaldoAFavorGlobalUsd = useMemo(() => {
    return Object.values(saldosClientes).reduce(
      (acc, s) => acc + (s.saldoAFavorTotalUsd || 0),
      0
    );
  }, [saldosClientes]);

  const totalSaldoAFavorGlobalBs = useMemo(() => {
    return calcularConversionBs(totalSaldoAFavorGlobalUsd, tasaBcv);
  }, [totalSaldoAFavorGlobalUsd, tasaBcv]);

  // Toggle de acordeón por estudiante
  const toggleEstudiante = (key: string) => {
    setEstudiantesDesplegados((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Abrir modal para cancelar toda la cuenta del estudiante
  const handleAbrirPagoTotalEstudiante = (cuenta: CuentaEstudianteAgrupada) => {
    const nombre = cuenta.cliente?.nombre_estudiante || 'Venta General';
    setModalLiquidacion({
      abierto: true,
      titulo: 'Liquidar Cuenta Total',
      subtitulo: `Cancelación completa de todos los consumos (${cuenta.consumos.length}) asociados a ${nombre}.`,
      montoUsd: cuenta.totalDeudaUsd,
      idsConsumos: cuenta.consumos.map((c) => c.id),
      nombreEstudiante: nombre,
      clienteId: cuenta.cliente?.id || null,
    });
    setMetodoPago('pago_movil');
    setErrorPago(null);
  };

  // Abrir modal para cancelar un consumo específico
  const handleAbrirPagoConsumoIndividual = (
    deuda: DeudaRegistro,
    nombreEstudiante: string,
    clienteId?: string | null
  ) => {
    let fechaTxt = deuda.fecha;
    try {
      fechaTxt = new Date(deuda.fecha).toLocaleDateString('es-VE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {}

    setModalLiquidacion({
      abierto: true,
      titulo: 'Liquidar Consumo Individual',
      subtitulo: `Pago del consumo del ${fechaTxt} correspondiente a ${nombreEstudiante}.`,
      montoUsd: deuda.monto_total_usd,
      idsConsumos: [deuda.id],
      nombreEstudiante,
      clienteId: clienteId || deuda.cliente_id || null,
    });
    setMetodoPago('pago_movil');
    setErrorPago(null);
  };

  // Confirmar liquidación en Supabase
  const handleConfirmarLiquidacion = async () => {
    if (modalLiquidacion.idsConsumos.length === 0) return;
    setProcesandoPago(true);
    setErrorPago(null);

    try {
      // Si el método seleccionado es saldo a favor, verificar que el cliente posea crédito suficiente
      if (metodoPago === 'saldo_favor') {
        const saldoDisponible = modalLiquidacion.clienteId
          ? saldosClientes[modalLiquidacion.clienteId]?.saldoAFavorTotalUsd || 0
          : 0;

        if (saldoDisponible < modalLiquidacion.montoUsd) {
          throw new Error(
            `Saldo a favor insuficiente (+${formatUSD(saldoDisponible)} disponible vs ${formatUSD(modalLiquidacion.montoUsd)} a liquidar). Usa la opción 'Abonar' para realizar un pago mixto o abonar la diferencia.`
          );
        }
      }

      const { error } = await supabase
        .from('consumos')
        .update({
          pagado: true,
          metodo_pago: metodoPago,
        })
        .in('id', modalLiquidacion.idsConsumos);

      if (error) {
        throw new Error(error.message || 'Error al actualizar el estado de los consumos');
      }

      setModalLiquidacion((prev) => ({ ...prev, abierto: false }));
      setNotificacion({
        tipo: 'exito',
        texto: `¡Pago de ${formatUSD(modalLiquidacion.montoUsd)} procesado con éxito!`,
      });
      setTimeout(() => setNotificacion(null), 4000);
      await cargarDeudas();
      refrescarNotificacionesGlobales();
    } catch (err: unknown) {
      console.error('Error al procesar pago:', err);
      setErrorPago(
        err instanceof Error
          ? err.message
          : 'Error inesperado al conectar con Supabase'
      );
    } finally {
      setProcesandoPago(false);
    }
  };

  // Abrir Modal de Abono / Anticipo
  const handleAbrirAbono = (c: Cliente | null) => {
    setModalAbono({
      abierto: true,
      cliente: c,
      montoUsd: '',
      metodoPago: 'efectivo_usd',
      guardando: false,
      error: null,
    });
  };

  // Confirmar Abono aplicando reglas de negocio estrictas
  const handleConfirmarAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalAbono.cliente) {
      setModalAbono((prev) => ({ ...prev, error: 'Por favor selecciona un cliente.' }));
      return;
    }
    const monto = parseFloat(modalAbono.montoUsd.replace(',', '.'));
    if (!monto || monto <= 0) {
      setModalAbono((prev) => ({ ...prev, error: 'Ingresa un monto válido mayor a 0.' }));
      return;
    }

    setModalAbono((prev) => ({ ...prev, guardando: true, error: null }));
    try {
      const res = await procesarAbonoCliente({
        clienteId: modalAbono.cliente.id,
        montoUsd: monto,
        metodoPago: modalAbono.metodoPago,
        tasaBcv,
      });

      setModalAbono((prev) => ({ ...prev, abierto: false }));
      setNotificacion({
        tipo: 'exito',
        texto: res.mensaje,
      });
      setTimeout(() => setNotificacion(null), 4500);
      await cargarDeudas();
      refrescarNotificacionesGlobales();
    } catch (err: unknown) {
      console.error('Error registrando abono:', err);
      setModalAbono((prev) => ({
        ...prev,
        guardando: false,
        error: err instanceof Error ? err.message : 'Error al registrar el abono.',
      }));
    }
  };

  // Enviar resumen consolidado por WhatsApp con datos oficiales de pago móvil
  const handleEnviarWhatsAppConsolidado = (cuenta: CuentaEstudianteAgrupada) => {
    const estudiante = cuenta.cliente?.nombre_estudiante || 'el estudiante';
    const representante = cuenta.cliente?.nombre_representante || 'Estimado(a) Representante';
    const grado = cuenta.cliente?.grado_seccion ? `(${cuenta.cliente.grado_seccion})` : '';
    const telefono = cuenta.cliente?.telefono_whatsapp || '';

    const montoUsd = cuenta.totalDeudaUsd;
    const montoBs = cuenta.totalDeudaBs;

    // Desglose limpio de consumos
    const detalleConsumos = cuenta.consumos
      .map((c, index) => {
        let fTexto = 'Fecha';
        try {
          fTexto = new Date(c.fecha).toLocaleDateString('es-VE', {
            day: '2-digit',
            month: 'short',
          });
        } catch {
          fTexto = c.fecha;
        }

        let productosTexto = '';
        if (c.consumo_detalles && c.consumo_detalles.length > 0) {
          productosTexto = c.consumo_detalles
            .map(
              (d) =>
                `    - ${d.cantidad}x ${d.productos?.nombre || 'Producto'} (${formatUSD(d.precio_unitario_usd * d.cantidad)})`
            )
            .join('\n');
        } else {
          productosTexto = '    - Consumo en cantina escolar';
        }

        return `*Consumo #${index + 1} (${fTexto})* - ${formatUSD(c.monto_total_usd)}:\n${productosTexto}`;
      })
      .join('\n\n');

    const esProf = esProfesorOPersonal(cuenta.cliente?.grado_seccion);
    const encabezado = esProf
      ? `Hola, estimado(a) *Prof./Personal ${cuenta.cliente?.nombre_estudiante}* (${cuenta.cliente?.grado_seccion}).\nLe escribimos cordialmente de *Club 5 Cantina Escolar*.\n\nLe compartimos el estado de cuenta pendiente consolidado:`
      : `Hola, *${representante}*.\nLe escribimos cordialmente de *Club 5 Cantina Escolar*.\n\nLe compartimos el estado de cuenta pendiente consolidado de *${estudiante}* ${grado}:`;

    // Mensaje redactado con caracteres seguros que NO generan diamantes ni signos de interrogación
    const mensaje = `${encabezado}

*Detalle de consumos (${cuenta.consumos.length}):*
${detalleConsumos}

---------------------------------
*TOTAL A PAGAR:* ${formatUSD(montoUsd)}
*Equivalente en Bolívares:* ${formatBs(montoBs)}
(Tasa oficial BCV del día: ${formatBs(tasaBcv)})
---------------------------------

*Datos para realizar el Pago Móvil:*
- Banco: BNC (Banco Nacional de Crédito - 0191)
- Cédula: 14953511
- Teléfono Pago Móvil: 04125404830
- Efectivo: Directamente en caja de cantina ($ o Bs.)

*Reporte de Referencia:*
Por favor enviar la captura de la transferencia o referencia al WhatsApp: *04123588848*

¡Muchas gracias y que tenga un excelente día!`;

    // Sanitizar teléfono del representante
    let telefonoLimpio = telefono.replace(/\D/g, '');
    if (telefonoLimpio.startsWith('0')) {
      telefonoLimpio = '58' + telefonoLimpio.slice(1);
    } else if (!telefonoLimpio.startsWith('58') && telefonoLimpio.length === 10) {
      telefonoLimpio = '58' + telefonoLimpio;
    }

    if (!telefonoLimpio) {
      navigator.clipboard.writeText(mensaje);
      setNotificacion({
        tipo: 'info',
        texto: 'El estudiante no tiene WhatsApp registrado. ¡Mensaje copiado al portapapeles!',
      });
      setTimeout(() => setNotificacion(null), 4000);
      return;
    }

    // Usamos api.whatsapp.com directamente con encodeURIComponent estricto para evitar bugs de wa.me
    const url = `https://api.whatsapp.com/send?phone=${telefonoLimpio}&text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };

  // Crear consumo fiado de prueba si la lista está vacía
  const handleCrearDeudaPrueba = async () => {
    setCreandoDeudaMuestra(true);
    try {
      let clienteId: string | null = null;
      const { data: clientesDb } = await supabase.from('clientes').select('id').limit(1);
      if (clientesDb && clientesDb.length > 0) {
        clienteId = clientesDb[0].id;
      }

      let productoId: string | null = null;
      let precio = 2.5;
      const { data: productosDb } = await supabase.from('productos').select('id, precio_usd').limit(1);
      if (productosDb && productosDb.length > 0) {
        productoId = productosDb[0].id;
        precio = productosDb[0].precio_usd;
      }

      const { data: consumo, error: cErr } = await supabase
        .from('consumos')
        .insert({
          cliente_id: clienteId,
          monto_total_usd: precio,
          tasa_bcv_historica: tasaBcv,
          pagado: false,
          metodo_pago: 'pendiente',
        })
        .select()
        .single();

      if (cErr || !consumo) throw cErr;

      if (productoId) {
        await supabase.from('consumo_detalles').insert({
          consumo_id: consumo.id,
          producto_id: productoId,
          cantidad: 1,
          precio_unitario_usd: precio,
        });
      }

      await cargarDeudas();
      refrescarNotificacionesGlobales();
      setNotificacion({
        tipo: 'exito',
        texto: '¡Consumo pendiente de prueba creado con éxito!',
      });
      setTimeout(() => setNotificacion(null), 4000);
    } catch (e) {
      console.error('Error creando deuda de prueba:', e);
    } finally {
      setCreandoDeudaMuestra(false);
    }
  };

  if (!montado) {
    return (
      <div className="min-h-screen flex flex-col bg-[#FAFAFA] dark:bg-[#090D16]" suppressHydrationWarning>
        <header className="sticky top-0 z-30 w-full border-b border-gray-200/70 dark:border-slate-800 bg-white/80 dark:bg-[#0D111A]/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <div className="h-6 w-48 bg-gray-200 dark:bg-slate-800 rounded-md animate-pulse" />
            <div className="h-9 w-44 bg-amber-50 dark:bg-amber-950/30 rounded-2xl animate-pulse" />
          </div>
        </header>
        <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-28 rounded-3xl bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 p-5 animate-pulse" />
            ))}
          </div>
          <div className="h-72 rounded-3xl bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 p-6 animate-pulse" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] dark:bg-[#090D16] text-slate-900 dark:text-slate-100 transition-colors" suppressHydrationWarning>
      {/* Header Sticky con diseño unificado y navegación móvil */}
      <header className="sticky top-0 z-40 w-full border-b border-gray-200/80 dark:border-slate-800 bg-white/90 dark:bg-[#0D111A]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            {/* Botón Hamburguesa: visible en móviles (< md) o en escritorio cuando el sidebar está cerrado (!abierto) */}
            <button
              type="button"
              onClick={toggleSidebar}
              className={`h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 shadow-2xs hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition active:scale-95 ${
                !sidebarAbierto ? 'flex' : 'flex md:hidden'
              }`}
              title="Abrir menú de navegación"
              aria-label="Abrir barra lateral"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-400 shadow-xs">
              <Receipt className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-sm sm:text-lg font-bold tracking-tight text-gray-900 dark:text-white truncate">
                  Cuentas por Cobrar
                </h1>
                <span className="rounded-full border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.2 text-[10px] sm:text-[11px] font-semibold text-amber-800 dark:text-amber-300 shrink-0">
                  {cuentasAgrupadas.length}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-gray-500 dark:text-slate-400 hidden sm:block">
                Consumos fiados consolidados y sincronizados a tasa BCV
              </p>
            </div>
          </div>

          {/* Tasa BCV en tiempo real + Notificaciones */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Mini Burbuja Tasa BCV en Móviles (< sm) */}
            <button
              type="button"
              onClick={cargarTasa}
              disabled={cargandoTasa}
              title="Actualizar tasa oficial BCV"
              className="flex sm:hidden items-center gap-1 rounded-full border border-amber-200/90 dark:border-amber-900/50 bg-amber-50/90 dark:bg-amber-950/40 px-2 py-1 text-[11px] font-mono font-bold text-amber-900 dark:text-amber-300 shadow-2xs active:scale-95 transition"
            >
              <TrendingUp className="h-3 w-3 text-amber-700 dark:text-amber-400 shrink-0" />
              <span>{tasaBcv > 0 ? formatBs(tasaBcv) : '...'}</span>
              {cargandoTasa && <RefreshCw className="h-2.5 w-2.5 animate-spin text-amber-700 dark:text-amber-400" />}
            </button>

            {/* Tasa BCV Completa en Pantallas Mayores (≥ sm) */}
            <div className="hidden sm:flex items-center gap-2 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50/70 to-yellow-50/60 px-3 py-1.5 shadow-xs">
              <TrendingUp className="h-4 w-4 text-amber-700 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase text-amber-800/80 hidden xs:inline">
                  Tasa BCV
                </span>
                <span className="font-mono text-xs font-bold text-gray-900 whitespace-nowrap">
                  {tasaBcv > 0 ? formatBs(tasaBcv) : '...'}
                </span>
              </div>
              <button
                type="button"
                onClick={cargarTasa}
                disabled={cargandoTasa}
                title="Actualizar tasa oficial"
                className="ml-1 rounded-lg p-1 text-amber-800 hover:bg-amber-100 transition"
              >
                <RefreshCw className={`h-3 w-3 ${cargandoTasa ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Botón Registrar Abono / Saldo a Favor */}
            <button
              type="button"
              onClick={() => handleAbrirAbono(null)}
              className="flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition active:scale-95"
              title="Registrar abono de deuda o pago adelantado de saldo a favor"
            >
              <PiggyBank className="h-4 w-4" />
              <span className="hidden sm:inline">Nuevo Abono / Saldo</span>
              <span className="sm:hidden">Abonar</span>
            </button>

            {/* Centro de Notificaciones y Alertas */}
            <NotificationBell />
          </div>
        </div>
      </header>

      {/* Notificación flotante */}
      {notificacion && (
        <div className="fixed top-16 right-6 z-50 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 shadow-lg animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{notificacion.texto}</span>
        </div>
      )}

      {/* Contenido Principal */}
      <main className="mx-auto flex-1 w-full max-w-7xl px-3 sm:px-6 lg:px-8 py-5 sm:py-6 overflow-x-hidden">
        {/* Tarjetas KPI de Resumen */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <div className="rounded-3xl border border-gray-200/80 bg-white p-5 shadow-xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Total por Cobrar (USD)
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-black tracking-tight text-gray-900">
                {formatUSD(granTotalUsd)}
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              {deudas.length} consumos pendientes en total
            </p>
          </div>

          <div className="rounded-3xl border border-amber-200/80 bg-gradient-to-br from-amber-50/40 to-orange-50/20 p-5 shadow-xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-800/80">
              Equivalente en Bolívares (Bs.)
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-mono text-2xl font-black tracking-tight text-gray-900">
                {formatBs(granTotalBs)}
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-800">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-1 text-xs text-amber-800/70">
              Calculado a {formatBs(tasaBcv)} por dólar
            </p>
          </div>

          <div className="rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                Saldos a Favor (Crédito)
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                <Sparkles className="h-2.5 w-2.5 text-emerald-600" />
                Prepagado
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-black tracking-tight text-emerald-700">
                +{formatUSD(totalSaldoAFavorGlobalUsd)}
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <PiggyBank className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-1 font-mono text-xs font-semibold text-emerald-800/80">
              +{formatBs(totalSaldoAFavorGlobalBs)} disponible
            </p>
          </div>

          <div className="rounded-3xl border border-gray-200/80 bg-white p-5 shadow-xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Estudiantes con Deuda
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-black tracking-tight text-gray-900">
                {cuentasAgrupadas.length}
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gray-100 text-gray-700">
                <User className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Cuentas consolidadas activas
            </p>
          </div>
        </div>

        {/* Barra de Filtros y Búsqueda Avanzada */}
        <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-gray-200/80 bg-white p-4 shadow-xs lg:flex-row lg:items-center lg:justify-between">
          {/* Buscador de texto */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por estudiante, grado o representante..."
              className="w-full rounded-2xl border border-gray-200/90 bg-gray-50/50 py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Menús desplegables personalizados estilo Precedent con Radix UI */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* 1. Menú Desplegable Personalizado: Grado / Sección */}
            <Popover.Root open={popoverGradoAbierto} onOpenChange={setPopoverGradoAbierto}>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-2xl border border-gray-200/90 bg-gray-50/70 px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-2xs hover:border-gray-300 hover:bg-white transition"
                >
                  <GraduationCap className="h-4 w-4 text-indigo-600" />
                  <span>
                    {filtroGrado === 'todos'
                      ? `Todos los Grados (${gradosDisponibles.length})`
                      : filtroGrado}
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${popoverGradoAbierto ? 'rotate-180 text-gray-700' : ''}`} />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="z-50 min-w-[210px] rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl outline-none backdrop-blur-lg animate-in fade-in-0 zoom-in-95"
                  align="start"
                  sideOffset={6}
                >
                  <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                    <button
                      type="button"
                      onClick={() => {
                        setFiltroGrado('todos');
                        setPopoverGradoAbierto(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition ${
                        filtroGrado === 'todos'
                          ? 'bg-indigo-50 text-indigo-900'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span>Todos los Grados ({gradosDisponibles.length})</span>
                      {filtroGrado === 'todos' && <Check className="h-3.5 w-3.5 text-indigo-600" />}
                    </button>

                    {gradosDisponibles.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => {
                          setFiltroGrado(g);
                          setPopoverGradoAbierto(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition ${
                          filtroGrado === g
                            ? 'bg-indigo-50 text-indigo-900'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span>{g}</span>
                        {filtroGrado === g && <Check className="h-3.5 w-3.5 text-indigo-600" />}
                      </button>
                    ))}
                  </div>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>

            {/* 2. Menú Desplegable Personalizado: Criterio de Orden */}
            <Popover.Root open={popoverOrdenAbierto} onOpenChange={setPopoverOrdenAbierto}>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-2xl border border-gray-200/90 bg-gray-50/70 px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-2xs hover:border-gray-300 hover:bg-white transition"
                >
                  <ArrowUpDown className="h-4 w-4 text-gray-500" />
                  <span>
                    {OPCIONES_ORDEN.find((o) => o.id === criterioOrden)?.label || 'Ordenar'}
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${popoverOrdenAbierto ? 'rotate-180 text-gray-700' : ''}`} />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="z-50 min-w-[210px] rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl outline-none backdrop-blur-lg animate-in fade-in-0 zoom-in-95"
                  align="end"
                  sideOffset={6}
                >
                  <div className="space-y-1">
                    {OPCIONES_ORDEN.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setCriterioOrden(opt.id);
                          setPopoverOrdenAbierto(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition ${
                          criterioOrden === opt.id
                            ? 'bg-indigo-50 text-indigo-900'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {criterioOrden === opt.id && (
                          <Check className="h-3.5 w-3.5 text-indigo-600" />
                        )}
                      </button>
                    ))}
                  </div>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>

            {/* Botón Refrescar */}
            <button
              type="button"
              onClick={cargarDeudas}
              disabled={cargandoDeudas}
              className="flex items-center gap-1.5 rounded-2xl border border-gray-200/80 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 transition disabled:opacity-60"
              title="Recargar deudas"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${cargandoDeudas ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Listado de Cuentas Consolidadas por Estudiante */}
        {cargandoDeudas ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-36 rounded-3xl border border-gray-200/80 bg-white p-5 animate-pulse"
              />
            ))}
          </div>
        ) : cuentasFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 dark:border-slate-800 bg-white/70 dark:bg-[#111726]/40 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-800/40 text-emerald-600 dark:text-emerald-400 mb-3 shadow-xs">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              {busqueda || filtroGrado !== 'todos'
                ? 'No se encontraron coincidencias'
                : '¡Todas las cuentas están al día!'}
            </h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400 max-w-sm">
              {busqueda || filtroGrado !== 'todos'
                ? 'Prueba modificando los filtros de búsqueda o grado.'
                : 'No existen consumos pendientes por cobrar en este momento.'}
            </p>

            {!busqueda && filtroGrado === 'todos' && (
              <button
                type="button"
                disabled={creandoDeudaMuestra}
                onClick={handleCrearDeudaPrueba}
                className="mt-5 flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition disabled:opacity-60"
              >
                <PlusCircle className="h-4 w-4" />
                <span>{creandoDeudaMuestra ? 'Creando...' : 'Generar Consumo Fiado de Prueba'}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {cuentasFiltradas.map((cuenta, index) => {
                const abierto = !!estudiantesDesplegados[cuenta.clienteKey];
                const estudiante = cuenta.cliente?.nombre_estudiante || 'Venta General Ocasional';
                const grado = cuenta.cliente?.grado_seccion || 'Sin sección asignada';
                const esProf = esProfesorOPersonal(cuenta.cliente?.grado_seccion);
                const rep = cuenta.cliente?.nombre_representante;
                const tel = cuenta.cliente?.telefono_whatsapp;
                const saldoAFavorEstudiante = cuenta.cliente?.id
                  ? saldosClientes[cuenta.cliente.id]?.saldoAFavorTotalUsd || 0
                  : 0;

                let fechaRecienteTxt = cuenta.fechaMasReciente;
                try {
                  const d = new Date(cuenta.fechaMasReciente);
                  fechaRecienteTxt = d.toLocaleDateString('es-VE', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  });
                } catch {}

                return (
                  <motion.div
                    key={cuenta.clienteKey}
                    initial={{ opacity: 0, y: 10, scale: 0.99 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
                    transition={{
                      duration: 0.22,
                      delay: Math.min(index * 0.02, 0.2),
                      ease: [0.25, 1, 0.5, 1],
                    }}
                    className="overflow-hidden rounded-3xl border border-gray-200/80 bg-white p-5 shadow-xs transition hover:border-gray-300"
                  >
                    {/* Cabecera de la Cuenta del Estudiante / Profesor */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      {/* Información del alumno o profesor */}
                      <div className="flex items-start gap-3.5">
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-2xs ${
                            esProf
                              ? 'bg-amber-100 border border-amber-200 text-amber-800'
                              : 'bg-indigo-50 border border-indigo-100 text-indigo-700'
                          }`}
                        >
                          {esProf ? (
                            <Briefcase className="h-6 w-6" />
                          ) : (
                            <User className="h-6 w-6" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-gray-900">
                              {estudiante}
                            </h3>
                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                                esProf
                                  ? 'border-amber-300 bg-amber-50 text-amber-900'
                                  : 'border-indigo-200 bg-indigo-50 text-indigo-700'
                              }`}
                            >
                              {grado}
                            </span>
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                              {cuenta.consumos.length} {cuenta.consumos.length === 1 ? 'consumo' : 'consumos'}
                            </span>
                            {/* Saldo a Favor en verde con signo positivo */}
                            {saldoAFavorEstudiante > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800 shadow-2xs">
                                <PiggyBank className="h-3 w-3 text-emerald-600" />
                                <span>+{formatUSD(saldoAFavorEstudiante)} a favor</span>
                              </span>
                            )}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                            {rep && (
                              <span>
                                <strong className="text-gray-700">
                                  {esProf ? 'Rol / Contacto:' : 'Representante:'}
                                </strong>{' '}
                                {rep}
                              </span>
                            )}
                            {tel && (
                              <span className="font-mono text-emerald-700 font-semibold">
                                📞 {tel}
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-gray-400">
                              <Calendar className="h-3 w-3" />
                              Último: {fechaRecienteTxt}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Montos consolidados y botones de acción principal */}
                      <div className="flex flex-col sm:items-end gap-3 border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-100">
                        <div className="flex sm:flex-col items-baseline justify-between sm:items-end gap-1">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xs text-gray-400 uppercase font-semibold">Total:</span>
                            <span className="text-2xl font-black text-gray-900">
                              {formatUSD(cuenta.totalDeudaUsd)}
                            </span>
                          </div>
                          <span className="font-mono text-xs font-bold text-amber-700">
                            {formatBs(cuenta.totalDeudaBs)}
                          </span>
                        </div>

                        {/* Botones de acción */}
                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                          {/* Botón WhatsApp Consolidado */}
                          <button
                            type="button"
                            onClick={() => handleEnviarWhatsAppConsolidado(cuenta)}
                            className="flex items-center gap-1.5 rounded-2xl border border-emerald-200/90 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-2xs hover:bg-emerald-100 hover:border-emerald-300 transition active:scale-95"
                            title="Enviar resumen consolidado a WhatsApp"
                          >
                            <MessageCircle className="h-4 w-4 text-emerald-600" />
                            <span>WhatsApp</span>
                          </button>

                          {/* Botón Abonar / Anticipo */}
                          <button
                            type="button"
                            onClick={() => handleAbrirAbono(cuenta.cliente)}
                            className="flex items-center gap-1.5 rounded-2xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-2xs hover:bg-emerald-100 transition active:scale-95"
                            title="Registrar abono de deuda o anticipo"
                          >
                            <PiggyBank className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Abonar</span>
                          </button>

                          {/* Botón Liquidar Cuenta Total */}
                          <button
                            type="button"
                            onClick={() => handleAbrirPagoTotalEstudiante(cuenta)}
                            className="flex items-center gap-1.5 rounded-2xl bg-gray-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-black transition active:scale-95"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            <span>Liquidar Total</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Botón para desplegar / ocultar consumos individuales */}
                    <div className="mt-4 border-t border-gray-100 pt-3 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => toggleEstudiante(cuenta.clienteKey)}
                        className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 transition"
                      >
                        <span>
                          {abierto
                            ? 'Ocultar consumos individuales'
                            : `Ver ${cuenta.consumos.length} consumos individuales`}
                        </span>
                        {abierto ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>

                      <span className="text-[11px] text-gray-400">
                        {cuenta.consumos.length} transacciones sin liquidar
                      </span>
                    </div>

                    {/* Desglose de consumos individuales */}
                    {abierto && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-3 space-y-2 border-t border-gray-100 pt-3"
                      >
                        {cuenta.consumos.map((consumo, idx) => {
                          const montoBsConsumo = calcularConversionBs(
                            consumo.monto_total_usd,
                            tasaBcv
                          );
                          let fechaConsumoTxt = consumo.fecha;
                          try {
                            const d = new Date(consumo.fecha);
                            fechaConsumoTxt = d.toLocaleDateString('es-VE', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            });
                          } catch {}

                          return (
                            <div
                              key={consumo.id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50/60 p-3.5 hover:bg-gray-50 transition"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-gray-900">
                                    Consumo #{idx + 1}
                                  </span>
                                  <span className="flex items-center gap-1 text-[11px] text-gray-500">
                                    <Calendar className="h-3 w-3" />
                                    {fechaConsumoTxt}
                                  </span>
                                </div>

                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                  {consumo.consumo_detalles &&
                                  consumo.consumo_detalles.length > 0 ? (
                                    consumo.consumo_detalles.map((det) => (
                                      <span
                                        key={det.id}
                                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200/80 bg-white px-2 py-0.5 text-[11px] text-gray-700"
                                      >
                                        <span className="font-bold">
                                          {det.cantidad}x
                                        </span>
                                        <span>
                                          {det.productos?.nombre || 'Producto'}
                                        </span>
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-xs text-gray-400">
                                      Consumo general de cantina
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-200/50">
                                <div className="text-left sm:text-right">
                                  <div className="text-sm font-bold text-gray-900">
                                    {formatUSD(consumo.monto_total_usd)}
                                  </div>
                                  <div className="text-[11px] font-mono text-amber-700 font-semibold">
                                    {formatBs(montoBsConsumo)}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAbrirPagoConsumoIndividual(
                                      consumo,
                                      estudiante,
                                      cuenta.cliente?.id
                                    )
                                  }
                                  className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-2xs hover:bg-gray-100 hover:border-gray-300 transition active:scale-95"
                                  title="Liquidar únicamente este consumo"
                                >
                                  <span>Pagar este</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Modal de Liquidación / Pago (Radix UI Dialog) */}
      <Dialog.Root
        open={modalLiquidacion.abierto}
        onOpenChange={(abierto) =>
          setModalLiquidacion((prev) => ({ ...prev, abierto }))
        }
      >
        <Dialog.Portal>
          <Dialog.Overlay
            {...dragScrollDeuda.overlayProps}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          />
          <Dialog.Content
            style={dragScrollDeuda.style}
            {...dragScrollDeuda.dragProps}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain touch-scroll-ios rounded-t-3xl sm:rounded-3xl border-t sm:border border-gray-200/90 bg-white p-4 sm:p-6 pb-28 sm:pb-6 shadow-2xl outline-none duration-300 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in-0 sm:zoom-in-95 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[95vw] sm:max-w-lg cursor-grab active:cursor-grabbing"
          >
            {/* Manija táctil para deslizar hacia arriba y abajo en móviles */}
            <div
              className="mx-auto mb-3 -mt-1 flex h-6 w-full cursor-grab active:cursor-grabbing items-center justify-center sm:hidden touch-none"
              title="Deslizar hacia abajo para cerrar"
            >
              <div className="h-1.5 w-12 rounded-full bg-gray-300 active:bg-gray-400 transition-colors" />
            </div>

            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <Dialog.Title className="text-lg font-bold text-gray-900">
                  {modalLiquidacion.titulo}
                </Dialog.Title>
                <Dialog.Description className="text-xs text-gray-500">
                  {modalLiquidacion.subtitulo}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={procesandoPago}
                  className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            {errorPago && (
              <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorPago}</span>
              </div>
            )}

            {/* Resumen del Monto a Liquidar */}
            <div className="my-4 rounded-2xl border border-gray-200/80 bg-gradient-to-r from-gray-50 to-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Monto a Liquidar
                  </span>
                  <div className="text-2xl font-black text-gray-900">
                    {formatUSD(modalLiquidacion.montoUsd)}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium text-amber-800">
                    Equivalente en Bs.
                  </span>
                  <div className="font-mono text-sm font-bold text-amber-900">
                    {formatBs(calcularConversionBs(modalLiquidacion.montoUsd, tasaBcv))}
                  </div>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-gray-200/60 flex items-center justify-between text-xs text-gray-600">
                <span>Estudiante / Cliente:</span>
                <span className="font-bold text-indigo-900">
                  {modalLiquidacion.nombreEstudiante}
                </span>
              </div>
            </div>

            {/* Aviso de Saldo a Favor disponible si el cliente posee crédito */}
            {(() => {
              const saldoDisp = modalLiquidacion.clienteId
                ? saldosClientes[modalLiquidacion.clienteId]?.saldoAFavorTotalUsd || 0
                : 0;
              if (saldoDisp <= 0) return null;
              return (
                <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PiggyBank className="h-4 w-4 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold">Saldo a favor disponible del cliente:</p>
                      <p className="text-[11px] text-emerald-700">
                        {saldoDisp >= modalLiquidacion.montoUsd
                          ? 'Cubre el 100% de esta liquidación'
                          : 'Cubre parcialmente esta deuda'}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-sm text-emerald-800">
                    +{formatUSD(saldoDisp)}
                  </span>
                </div>
              );
            })()}

            {/* Métodos de Pago */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700">
                Selecciona el Método de Pago
              </label>
              <div className="grid grid-cols-2 gap-2">
                {METODOS_CANCELACION.map((metodo) => {
                  const seleccionado = metodoPago === metodo.id;
                  const Icono = metodo.icono;
                  const saldoDisp = modalLiquidacion.clienteId
                    ? saldosClientes[modalLiquidacion.clienteId]?.saldoAFavorTotalUsd || 0
                    : 0;
                  const esSaldoFavor = metodo.id === 'saldo_favor';
                  const sinSaldo = esSaldoFavor && saldoDisp <= 0;

                  return (
                    <button
                      key={metodo.id}
                      type="button"
                      disabled={sinSaldo}
                      onClick={() => setMetodoPago(metodo.id)}
                      className={`flex flex-col items-start rounded-2xl border p-3 text-left transition ${
                        sinSaldo
                          ? 'opacity-40 cursor-not-allowed bg-gray-50 border-gray-200'
                          : seleccionado
                          ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-600/20 shadow-xs'
                          : 'border-gray-200/80 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between mb-1">
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                            seleccionado
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          <Icono className="h-4 w-4" />
                        </div>
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                            metodo.moneda === 'USD'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {metodo.moneda}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-gray-900 leading-tight">
                        {metodo.nombre}
                      </span>
                      {esSaldoFavor && (
                        <span className="text-[10px] font-medium text-emerald-700 mt-0.5">
                          {saldoDisp > 0 ? `Disp: +${formatUSD(saldoDisp)}` : 'Sin saldo'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Información bancaria oficial si seleccionan Pago Móvil */}
              {metodoPago === 'pago_movil' && (
                <div className="mt-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3 text-xs text-indigo-950">
                  <div className="font-bold flex items-center gap-1.5 mb-1 text-indigo-900">
                    <Smartphone className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Datos Oficiales Pago Móvil:</span>
                  </div>
                  <div className="space-y-0.5 text-[11px] font-mono">
                    <p><strong>Banco:</strong> BNC (Banco Nacional de Crédito - 0191)</p>
                    <p><strong>Cédula:</strong> 14953511</p>
                    <p><strong>Teléfono:</strong> 04125404830</p>
                    <p><strong>WhatsApp Referencia:</strong> 04123588848</p>
                  </div>
                </div>
              )}
            </div>

            {/* Botones de acción */}
            <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-gray-100 pt-4">
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={procesandoPago}
                  className="min-h-[44px] rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
              </Dialog.Close>

              <button
                type="button"
                onClick={handleConfirmarLiquidacion}
                disabled={procesandoPago}
                className="min-h-[44px] flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-black transition disabled:opacity-60"
              >
                {procesandoPago ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Liquidando...</span>
                  </>
                ) : (
                  <span>Confirmar Liquidación</span>
                )}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Modal para Registrar Abono / Depósito de Saldo a Favor */}
      <Dialog.Root
        open={modalAbono.abierto}
        onOpenChange={(abierto) => setModalAbono((prev) => ({ ...prev, abierto }))}
      >
        <Dialog.Portal>
          <Dialog.Overlay
            {...dragScrollAbono.overlayProps}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          />
          <Dialog.Content
            style={dragScrollAbono.style}
            {...dragScrollAbono.dragProps}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain touch-scroll-ios rounded-t-3xl sm:rounded-3xl border-t sm:border border-gray-200/90 bg-white p-4 sm:p-6 pb-28 sm:pb-6 shadow-2xl outline-none duration-300 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in-0 sm:zoom-in-95 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[95vw] sm:max-w-lg cursor-grab active:cursor-grabbing"
          >
            {/* Manija táctil móvil */}
            <div
              className="mx-auto mb-3 -mt-1 flex h-6 w-full cursor-grab active:cursor-grabbing items-center justify-center sm:hidden touch-none"
              title="Deslizar hacia abajo para cerrar"
            >
              <div className="h-1.5 w-12 rounded-full bg-gray-300 active:bg-gray-400 transition-colors" />
            </div>

            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <PiggyBank className="h-5 w-5" />
                </div>
                <div>
                  <Dialog.Title className="text-base sm:text-lg font-bold text-gray-900">
                    Abono / Saldo a Favor
                  </Dialog.Title>
                  <Dialog.Description className="text-xs text-gray-500">
                    Liquidación de deuda prioritaria y depósito de saldo a favor
                  </Dialog.Description>
                </div>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={modalAbono.guardando}
                  className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            {modalAbono.error && (
              <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{modalAbono.error}</span>
              </div>
            )}

            <form onSubmit={handleConfirmarAbono} className="mt-4 space-y-4">
              {/* Selección del Cliente si no fue preseleccionado */}
              {!modalAbono.cliente ? (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Seleccionar Cliente o Estudiante *
                  </label>
                  <select
                    onChange={(e) => {
                      const c = todosLosClientes.find((cl) => cl.id === e.target.value) || null;
                      setModalAbono((prev) => ({ ...prev, cliente: c, error: null }));
                    }}
                    defaultValue=""
                    className="w-full rounded-2xl border border-gray-200 bg-white py-2.5 px-3 text-xs font-bold text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                  >
                    <option value="" disabled>-- Elige un cliente para abonar --</option>
                    {todosLosClientes.map((cl) => {
                      const s = saldosClientes[cl.id];
                      const tieneDeuda = (s?.deudaTotalUsd || 0) > 0;
                      const tieneSaldo = (s?.saldoAFavorTotalUsd || 0) > 0;
                      let label = `${cl.nombre_estudiante} (${cl.grado_seccion || 'Sin sección'})`;
                      if (tieneDeuda) label += ` [Debe: $${s.deudaTotalUsd.toFixed(2)}]`;
                      if (tieneSaldo) label += ` [A favor: +$${s.saldoAFavorTotalUsd.toFixed(2)}]`;
                      return (
                        <option key={cl.id} value={cl.id}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ) : (
                <div className="rounded-2xl border border-gray-200/80 bg-gray-50/70 p-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-semibold">Cliente seleccionado</p>
                      <h4 className="font-bold text-sm text-gray-900">
                        {modalAbono.cliente.nombre_estudiante}
                      </h4>
                      <p className="text-xs text-indigo-700 font-medium">
                        {modalAbono.cliente.grado_seccion || 'Personal / General'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setModalAbono((prev) => ({ ...prev, cliente: null }))}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline"
                    >
                      Cambiar
                    </button>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-gray-200/60 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500 text-[11px]">Deuda Actual:</span>
                      <p className="font-bold text-gray-900">
                        {formatUSD(saldosClientes[modalAbono.cliente.id]?.deudaTotalUsd || 0)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[11px]">Saldo a Favor Actual:</span>
                      <p className="font-bold text-emerald-700">
                        +{formatUSD(saldosClientes[modalAbono.cliente.id]?.saldoAFavorTotalUsd || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Monto a Abonar */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Monto a Abonar (en $ USD) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={modalAbono.montoUsd}
                    onChange={(e) =>
                      setModalAbono((prev) => ({ ...prev, montoUsd: e.target.value, error: null }))
                    }
                    placeholder="0.00 (ej: 5.00 o 10.00)"
                    className="w-full rounded-2xl border border-gray-200 bg-white py-2.5 pl-8 pr-3 text-sm font-bold text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                    autoFocus
                  />
                </div>
                {modalAbono.montoUsd && parseFloat(modalAbono.montoUsd.replace(',', '.')) > 0 && (
                  <p className="mt-1 text-[11px] font-mono text-gray-500">
                    Equivalente en Bs: {formatBs(calcularConversionBs(parseFloat(modalAbono.montoUsd.replace(',', '.')), tasaBcv))} (Tasa BCV {formatBs(tasaBcv)})
                  </p>
                )}
              </div>

              {/* Selector de Método de Pago */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Método de Pago Entregado *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'efectivo_usd', label: 'Efectivo USD ($)' },
                    { id: 'pago_movil', label: 'Pago Móvil (Bs)' },
                    { id: 'zelle', label: 'Zelle ($)' },
                    { id: 'punto_debito', label: 'Punto de Venta (Bs)' },
                  ].map((met) => (
                    <button
                      key={met.id}
                      type="button"
                      onClick={() => setModalAbono((prev) => ({ ...prev, metodoPago: met.id }))}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-left transition ${
                        modalAbono.metodoPago === met.id
                          ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-1 ring-indigo-600'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {met.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vista Previa de Liquidación Prioritaria de Negocio */}
              {(() => {
                const montoNum = parseFloat(modalAbono.montoUsd.replace(',', '.')) || 0;
                if (montoNum <= 0 || !modalAbono.cliente) return null;
                const deudaActual = saldosClientes[modalAbono.cliente.id]?.deudaTotalUsd || 0;

                if (deudaActual > 0) {
                  if (montoNum >= deudaActual) {
                    const sobrante = Math.round((montoNum - deudaActual) * 100) / 100;
                    return (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900 space-y-1">
                        <p className="font-bold flex items-center gap-1.5 text-emerald-800">
                          <Check className="h-4 w-4 text-emerald-600" />
                          Regla de Liquidación Prioritaria:
                        </p>
                        <p className="text-[11px]">
                          ✓ Se liquidarán prioritariamente los <strong>{formatUSD(deudaActual)}</strong> de deuda pendiente.
                        </p>
                        {sobrante > 0 ? (
                          <p className="text-[11px] font-semibold text-emerald-800">
                            ✓ El excedente de <strong>+{formatUSD(sobrante)}</strong> se acreditará automáticamente como <strong>Saldo a Favor</strong> disponible.
                          </p>
                        ) : (
                          <p className="text-[11px]">
                            ✓ La cuenta quedará 100% solvente ($0.00).
                          </p>
                        )}
                      </div>
                    );
                  } else {
                    const restante = Math.round((deudaActual - montoNum) * 100) / 100;
                    return (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 space-y-1">
                        <p className="font-bold text-amber-800">Abono Parcial a Deuda:</p>
                        <p className="text-[11px]">
                          ✓ Se abonarán los <strong>{formatUSD(montoNum)}</strong> a la deuda pendiente.
                        </p>
                        <p className="text-[11px]">
                          ✓ La deuda restante será de <strong>{formatUSD(restante)}</strong>.
                        </p>
                      </div>
                    );
                  }
                } else {
                  return (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900 space-y-1">
                      <p className="font-bold flex items-center gap-1.5 text-emerald-800">
                        <Sparkles className="h-4 w-4 text-emerald-600" />
                        Abono sin Deuda Previa:
                      </p>
                      <p className="text-[11px]">
                        ✓ El cliente no posee deuda pendiente. El monto total de <strong>+{formatUSD(montoNum)}</strong> se guardará directamente como <strong>Saldo a Favor</strong> disponible.
                      </p>
                    </div>
                  );
                }
              })()}

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    disabled={modalAbono.guardando}
                    className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                  >
                    Cancelar
                  </button>
                </Dialog.Close>

                <button
                  type="submit"
                  disabled={modalAbono.guardando || !(parseFloat(modalAbono.montoUsd.replace(',', '.')) > 0)}
                  className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {modalAbono.guardando ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Registrando en Supabase...</span>
                    </>
                  ) : (
                    <span>Confirmar Abono</span>
                  )}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
