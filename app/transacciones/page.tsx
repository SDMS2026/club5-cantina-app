'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Dialog from '@radix-ui/react-dialog';
import {
  History,
  Search,
  Filter,
  RefreshCw,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  X,
  Calendar,
  Clock,
  ArrowRight,
  RotateCcw,
  Smartphone,
  Banknote,
  DollarSign,
  Wallet,
  Receipt,
  User,
  ShoppingBag,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
  FileText,
  BadgeAlert,
  Hash,
  Menu,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { obtenerTasaBCV, TASA_BCV_FALLBACK_DEFAULT } from '@/lib/dolarApi';
import { formatUSD, formatBs, calcularConversionBs } from '@/lib/utils';
import { NotificationBell } from '@/components/NotificationBell';
import { refrescarNotificacionesGlobales } from '@/components/NotificationsContext';
import { useSidebar } from '@/components/SidebarContext';
import { useModalDragScroll } from '@/lib/useModalDragScroll';
import {
  parseConsumoAudit,
  anularConsumo,
  ConsumoInfoAudit,
} from '@/lib/clientBalance';

interface TransaccionCliente {
  id: string;
  nombre_estudiante: string;
  grado_seccion?: string | null;
  nombre_representante?: string | null;
  telefono_whatsapp?: string | null;
  saldo?: number;
}

interface TransaccionDetalleItem {
  id: string;
  cantidad: number;
  precio_unitario_usd: number;
  producto_id?: string | null;
  productos?: {
    id: string;
    nombre: string;
    precio_usd: number;
    imagen_url?: string | null;
  } | null;
}

interface TransaccionRegistro {
  id: string;
  cliente_id: string | null;
  monto_total_usd: number;
  tasa_bcv_historica: number;
  metodo_pago: string;
  pagado: boolean;
  fecha: string;
  clientes?: TransaccionCliente | null;
  consumo_detalles?: TransaccionDetalleItem[];
}

// Helpers para fechas
const formatearFechaHora = (fechaIso?: string): { fecha: string; hora: string; esHoy: boolean } => {
  if (!fechaIso) return { fecha: 'Fecha desconocida', hora: '', esHoy: false };
  const d = new Date(fechaIso);
  const hoy = new Date();
  const esHoy =
    d.getDate() === hoy.getDate() &&
    d.getMonth() === hoy.getMonth() &&
    d.getFullYear() === hoy.getFullYear();

  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const dia = d.getDate();
  const mes = meses[d.getMonth()];
  const año = d.getFullYear();

  let horas = d.getHours();
  const minutos = String(d.getMinutes()).padStart(2, '0');
  const ampm = horas >= 12 ? 'PM' : 'AM';
  horas = horas % 12 || 12;

  const horaStr = `${horas}:${minutos} ${ampm}`;
  const fechaStr = esHoy ? 'Hoy' : `${dia} ${mes} ${año}`;

  return { fecha: fechaStr, hora: horaStr, esHoy };
};

export default function TransaccionesPage() {
  const [montado, setMontado] = useState(false);
  const { toggleSidebar, abierto: sidebarAbierto } = useSidebar();

  // 1. Tasa BCV
  const [tasaBcv, setTasaBcv] = useState<number>(TASA_BCV_FALLBACK_DEFAULT);
  const [cargandoTasa, setCargandoTasa] = useState<boolean>(true);

  // 2. Transacciones
  const [transacciones, setTransacciones] = useState<TransaccionRegistro[]>([]);
  const [cargandoTransacciones, setCargandoTransacciones] = useState<boolean>(true);

  // 3. Filtros
  const [busqueda, setBusqueda] = useState<string>('');
  const [filtroMetodo, setFiltroMetodo] = useState<
    'todas' | 'pago_movil' | 'efectivo' | 'pendientes' | 'saldo_favor' | 'anuladas'
  >('todas');
  const [filtroFecha, setFiltroFecha] = useState<'hoy' | 'semana' | 'mes' | 'todas'>('todas');

  // 4. Modal Detalle de Transacción
  const [modalDetalle, setModalDetalle] = useState<{
    abierto: boolean;
    transaccion: TransaccionRegistro | null;
  }>({
    abierto: false,
    transaccion: null,
  });

  // 5. Modal Confirmación de Anulación
  const [modalAnular, setModalAnular] = useState<{
    abierto: boolean;
    transaccion: TransaccionRegistro | null;
    procesando: boolean;
    error: string | null;
  }>({
    abierto: false,
    transaccion: null,
    procesando: false,
    error: null,
  });

  // 6. Notificación Toast
  const [notificacion, setNotificacion] = useState<{
    tipo: 'exito' | 'error' | 'info';
    texto: string;
  } | null>(null);

  const mostrarNotificacion = useCallback((tipo: 'exito' | 'error' | 'info', texto: string) => {
    setNotificacion({ tipo, texto });
    setTimeout(() => setNotificacion(null), 4000);
  }, []);

  const dragScrollDetalle = useModalDragScroll({
    isOpen: modalDetalle.abierto,
    onDismiss: () => setModalDetalle((prev) => ({ ...prev, abierto: false })),
  });

  const dragScrollAnular = useModalDragScroll({
    isOpen: modalAnular.abierto,
    onDismiss: () =>
      !modalAnular.procesando && setModalAnular((prev) => ({ ...prev, abierto: false })),
  });

  // Cargar Tasa BCV
  const cargarTasa = useCallback(async () => {
    setCargandoTasa(true);
    try {
      const tasa = await obtenerTasaBCV();
      setTasaBcv(tasa);
    } catch (e) {
      console.error('Error cargando tasa BCV:', e);
    } finally {
      setCargandoTasa(false);
    }
  }, []);

  // Cargar todas las transacciones desde Supabase
  const cargarTransacciones = useCallback(async () => {
    setCargandoTransacciones(true);
    try {
      const { data, error } = await supabase
        .from('consumos')
        .select(`
          id,
          cliente_id,
          monto_total_usd,
          tasa_bcv_historica,
          metodo_pago,
          pagado,
          fecha,
          clientes (
            id,
            nombre_estudiante,
            grado_seccion,
            nombre_representante,
            telefono_whatsapp,
            saldo
          ),
          consumo_detalles (
            id,
            cantidad,
            precio_unitario_usd,
            producto_id,
            productos (
              id,
              nombre,
              precio_usd,
              imagen_url
            )
          )
        `)
        .order('fecha', { ascending: false });

      if (error) {
        console.error('Error consultando historial de transacciones:', error);
      } else {
        setTransacciones((data as unknown as TransaccionRegistro[]) || []);
      }
    } catch (err) {
      console.error('Error inesperado cargando transacciones:', err);
    } finally {
      setCargandoTransacciones(false);
    }
  }, []);

  useEffect(() => {
    setMontado(true);
    cargarTasa();
    cargarTransacciones();

    // Suscripción en tiempo real a la tabla 'consumos'
    const channel = supabase
      .channel('transacciones_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consumos' }, () => {
        cargarTransacciones();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cargarTasa, cargarTransacciones]);

  // Manejo de la acción de anular transacción
  const handleConfirmarAnulacion = async () => {
    if (!modalAnular.transaccion) return;
    setModalAnular((prev) => ({ ...prev, procesando: true, error: null }));

    try {
      const res = await anularConsumo({
        consumoId: modalAnular.transaccion.id,
      });

      mostrarNotificacion('exito', res.mensaje);
      setModalAnular({
        abierto: false,
        transaccion: null,
        procesando: false,
        error: null,
      });
      if (modalDetalle.abierto) {
        setModalDetalle({ abierto: false, transaccion: null });
      }
      await cargarTransacciones();
      refrescarNotificacionesGlobales();
    } catch (err: unknown) {
      console.error('Error al anular transacción:', err);
      const msg = err instanceof Error ? err.message : 'Error al anular la transacción.';
      setModalAnular((prev) => ({ ...prev, procesando: false, error: msg }));
    }
  };

  // Filtrado reactivo de transacciones
  const transaccionesFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    return transacciones.filter((t) => {
      const audit = parseConsumoAudit({
        metodo_pago: t.metodo_pago,
        pagado: t.pagado,
      });

      // 1. Filtro por Método / Estado
      if (filtroMetodo === 'anuladas' && !audit.esAnulado) return false;
      if (filtroMetodo === 'pendientes' && (audit.esAnulado || !audit.esPendiente)) return false;
      if (filtroMetodo === 'pago_movil' && audit.metodoBase !== 'pago_movil') return false;
      if (
        filtroMetodo === 'efectivo' &&
        audit.metodoBase !== 'efectivo_usd' &&
        audit.metodoBase !== 'efectivo_bs'
      )
        return false;
      if (filtroMetodo === 'saldo_favor' && audit.metodoBase !== 'saldo_favor' && !audit.esMixto)
        return false;

      // 2. Filtro por Fecha
      if (filtroFecha !== 'todas' && t.fecha) {
        const d = new Date(t.fecha);
        const diasDiff = (hoy.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);

        if (filtroFecha === 'hoy') {
          const esMismoDia =
            d.getDate() === hoy.getDate() &&
            d.getMonth() === hoy.getMonth() &&
            d.getFullYear() === hoy.getFullYear();
          if (!esMismoDia) return false;
        } else if (filtroFecha === 'semana') {
          if (diasDiff > 7) return false;
        } else if (filtroFecha === 'mes') {
          if (diasDiff > 31) return false;
        }
      }

      // 3. Filtro por Búsqueda de texto
      if (q) {
        const nombreCliente = t.clientes?.nombre_estudiante?.toLowerCase() || '';
        const seccion = t.clientes?.grado_seccion?.toLowerCase() || '';
        const rep = t.clientes?.nombre_representante?.toLowerCase() || '';
        const ref = audit.referencia?.toLowerCase() || '';
        const metodo = audit.nombreLegible.toLowerCase();

        // Buscar también en nombres de productos comprados
        const productosNombres =
          t.consumo_detalles
            ?.map((cd) => cd.productos?.nombre?.toLowerCase() || '')
            .join(' ') || '';

        const coincide =
          nombreCliente.includes(q) ||
          seccion.includes(q) ||
          rep.includes(q) ||
          ref.includes(q) ||
          metodo.includes(q) ||
          productosNombres.includes(q);

        if (!coincide) return false;
      }

      return true;
    });
  }, [transacciones, busqueda, filtroMetodo, filtroFecha]);

  // Resumen de Métricas Financieras (KPIs de Auditoría)
  const metricas = useMemo(() => {
    let totalVentasUsd = 0;
    let pagadasCajaUsd = 0;
    let pendientesFiadoUsd = 0;
    let anuladasTotalUsd = 0;
    let cantidadAnuladas = 0;
    let cantidadTotal = 0;

    transacciones.forEach((t) => {
      const monto = Number(t.monto_total_usd || 0);
      cantidadTotal++;
      const audit = parseConsumoAudit({ metodo_pago: t.metodo_pago, pagado: t.pagado });

      if (audit.esAnulado) {
        anuladasTotalUsd += monto;
        cantidadAnuladas++;
      } else {
        totalVentasUsd += monto;
        if (audit.esPendiente) {
          pendientesFiadoUsd += monto;
        } else {
          pagadasCajaUsd += monto;
        }
      }
    });

    return {
      totalVentasUsd,
      totalVentasBs: calcularConversionBs(totalVentasUsd, tasaBcv),
      pagadasCajaUsd,
      pagadasCajaBs: calcularConversionBs(pagadasCajaUsd, tasaBcv),
      pendientesFiadoUsd,
      pendientesFiadoBs: calcularConversionBs(pendientesFiadoUsd, tasaBcv),
      anuladasTotalUsd,
      cantidadAnuladas,
      cantidadTotal,
    };
  }, [transacciones, tasaBcv]);

  if (!montado) {
    return (
      <div className="min-h-screen flex flex-col bg-[#FAFAFA] dark:bg-[#090D16]">
        <div className="flex h-16 items-center border-b border-gray-200 px-4">
          <div className="h-6 w-32 animate-pulse rounded-md bg-gray-200 dark:bg-slate-800" />
        </div>
        <div className="p-4 space-y-4">
          <div className="h-28 animate-pulse rounded-3xl bg-gray-200 dark:bg-slate-800" />
          <div className="h-64 animate-pulse rounded-3xl bg-gray-200 dark:bg-slate-800" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] dark:bg-[#090D16] text-gray-900 dark:text-slate-100">
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
              <History className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-sm sm:text-lg font-bold tracking-tight text-gray-900 dark:text-white truncate">
                  Historial de Transacciones
                </h1>
                <span className="rounded-full border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.2 text-[10px] sm:text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 shrink-0">
                  {transacciones.length}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-gray-500 dark:text-slate-400 hidden sm:block">
                Auditoría de ventas en tiempo real, comprobantes de pago y reversión de transacciones
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <NotificationBell />
          </div>
        </div>
      </header>

      {/* Notificación Toast Flotante */}
      <AnimatePresence>
        {notificacion && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-16 right-4 z-50 flex items-center gap-2 rounded-2xl px-4 py-3 shadow-xl text-xs font-bold border ${
              notificacion.tipo === 'exito'
                ? 'bg-emerald-600 text-white border-emerald-500'
                : notificacion.tipo === 'error'
                ? 'bg-rose-600 text-white border-rose-500'
                : 'bg-indigo-600 text-white border-indigo-500'
            }`}
          >
            {notificacion.tipo === 'exito' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
            {notificacion.tipo === 'error' && <AlertTriangle className="h-4 w-4 shrink-0" />}
            {notificacion.tipo === 'info' && <ShieldCheck className="h-4 w-4 shrink-0" />}
            <span>{notificacion.texto}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-6 lg:px-8 space-y-4">
        {/* Tarjetas de Resumen Financiero (KPIs) */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {/* 1. Total Ventas */}
          <div className="rounded-3xl border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
              <ShoppingBag className="h-3 w-3 text-indigo-600" />
              <span>Ventas Netas</span>
            </span>
            <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
              <span className="font-mono text-lg sm:text-xl font-black text-gray-900 dark:text-slate-100">
                {formatUSD(metricas.totalVentasUsd)}
              </span>
              <span className="text-[11px] font-mono text-gray-400">
                ({formatBs(metricas.totalVentasBs)})
              </span>
            </div>
            <span className="text-[10px] text-gray-400 mt-0.5 block">
              {metricas.cantidadTotal - metricas.cantidadAnuladas} transacciones activas
            </span>
          </div>

          {/* 2. Cobrado en Caja */}
          <div className="rounded-3xl border border-emerald-200/80 dark:border-emerald-950/60 bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-950/20 dark:to-[#0D111A] p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              <span>Cobrado en Caja</span>
            </span>
            <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
              <span className="font-mono text-lg sm:text-xl font-black text-emerald-700 dark:text-emerald-400">
                {formatUSD(metricas.pagadasCajaUsd)}
              </span>
              <span className="text-[11px] font-mono text-emerald-600/70">
                ({formatBs(metricas.pagadasCajaBs)})
              </span>
            </div>
            <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400/70 mt-0.5 block">
              Efectivo, Pago Móvil y Tarjeta
            </span>
          </div>

          {/* 3. Fiado / Cuentas por Cobrar */}
          <div className="rounded-3xl border border-amber-200/80 dark:border-amber-950/60 bg-gradient-to-br from-amber-50/50 to-white dark:from-amber-950/20 dark:to-[#0D111A] p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400 flex items-center gap-1">
              <Clock className="h-3 w-3 text-amber-600" />
              <span>Por Cobrar (Fiado)</span>
            </span>
            <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
              <span className="font-mono text-lg sm:text-xl font-black text-amber-700 dark:text-amber-400">
                {formatUSD(metricas.pendientesFiadoUsd)}
              </span>
              <span className="text-[11px] font-mono text-amber-600/70">
                ({formatBs(metricas.pendientesFiadoBs)})
              </span>
            </div>
            <span className="text-[10px] text-amber-700/80 dark:text-amber-400/70 mt-0.5 block">
              Cargado a cuentas de alumnos
            </span>
          </div>

          {/* 4. Anuladas / Devoluciones */}
          <div className="rounded-3xl border border-rose-200/80 dark:border-rose-950/60 bg-gradient-to-br from-rose-50/50 to-white dark:from-rose-950/20 dark:to-[#0D111A] p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1">
              <RotateCcw className="h-3 w-3 text-rose-600" />
              <span>Anuladas</span>
            </span>
            <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
              <span className="font-mono text-lg sm:text-xl font-black text-rose-700 dark:text-rose-400">
                {formatUSD(metricas.anuladasTotalUsd)}
              </span>
            </div>
            <span className="text-[10px] text-rose-600/80 dark:text-rose-400/70 mt-0.5 block">
              {metricas.cantidadAnuladas} ventas canceladas / reversadas
            </span>
          </div>
        </div>

        {/* Barra de Búsqueda y Filtros Rápidos */}
        <div className="rounded-3xl border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-3 sm:p-4 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Buscador de texto */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por cliente, grado, producto o referencia bancaria..."
                className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/60 dark:bg-[#111726] py-2.5 pl-10 pr-9 text-xs text-gray-900 dark:text-slate-100 placeholder:text-gray-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-[#111726] focus:outline-none transition"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filtro de Rango de Fechas */}
            <div className="flex items-center rounded-2xl bg-gray-100 dark:bg-slate-800 p-1 text-xs font-bold shrink-0 self-start sm:self-auto">
              {(
                [
                  { id: 'todas', label: 'Todas' },
                  { id: 'hoy', label: 'Hoy' },
                  { id: 'semana', label: '7 días' },
                  { id: 'mes', label: 'Mes' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltroFecha(f.id)}
                  className={`px-3 py-1.5 rounded-xl transition ${
                    filtroFecha === f.id
                      ? 'bg-white dark:bg-[#111726] text-gray-900 dark:text-slate-100 shadow-2xs'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filtros Rápidos por Método de Pago */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 touch-scroll-ios scrollbar-none">
            {(
              [
                { id: 'todas', label: 'Todas las Ventas', icono: ShoppingBag },
                { id: 'pago_movil', label: 'Pago Móvil', icono: Smartphone },
                { id: 'efectivo', label: 'Efectivo ($ / Bs)', icono: DollarSign },
                { id: 'pendientes', label: 'Pendientes / Fiado', icono: Clock },
                { id: 'saldo_favor', label: 'Saldo a Favor', icono: Wallet },
                { id: 'anuladas', label: 'Anuladas', icono: RotateCcw },
              ] as const
            ).map((filtro) => {
              const Icono = filtro.icono;
              const activo = filtroMetodo === filtro.id;
              return (
                <button
                  key={filtro.id}
                  type="button"
                  onClick={() => setFiltroMetodo(filtro.id)}
                  className={`flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-xs font-bold shrink-0 transition border ${
                    activo
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-white dark:bg-[#111726] text-gray-600 dark:text-slate-300 border-gray-200/90 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-[#141C2E]'
                  }`}
                >
                  <Icono className="h-3.5 w-3.5 shrink-0" />
                  <span>{filtro.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tabla / Lista de Transacciones */}
        {cargandoTransacciones ? (
          <div className="rounded-3xl border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-12 text-center shadow-2xs">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
            <p className="mt-3 text-xs font-semibold text-gray-500 dark:text-slate-400">
              Cargando historial de transacciones desde Supabase...
            </p>
          </div>
        ) : transaccionesFiltradas.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-gray-300 dark:text-slate-600" />
            <h3 className="mt-2 text-sm font-bold text-gray-800 dark:text-slate-200">
              No se encontraron transacciones
            </h3>
            <p className="mt-1 text-xs text-gray-400">
              Prueba cambiando los filtros de fecha, método de pago o el término de búsqueda.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Vista en Tarjetas para Móviles (< md) */}
            <div className="grid grid-cols-1 gap-2.5 md:hidden">
              <AnimatePresence>
                {transaccionesFiltradas.map((t) => {
                  const audit = parseConsumoAudit({ metodo_pago: t.metodo_pago, pagado: t.pagado });
                  const fechaObj = formatearFechaHora(t.fecha);
                  const totalItems = t.consumo_detalles?.reduce((acc, i) => acc + i.cantidad, 0) || 0;
                  const tasaHistorica = t.tasa_bcv_historica || tasaBcv;
                  const totalBsEquiv = calcularConversionBs(t.monto_total_usd, tasaHistorica);

                  return (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`rounded-3xl border p-4 shadow-2xs transition bg-white dark:bg-[#0D111A] ${
                        audit.esAnulado
                          ? 'border-rose-200/70 dark:border-rose-950/40 bg-rose-50/20 opacity-80'
                          : audit.esPendiente
                          ? 'border-amber-200/80 dark:border-amber-950/40'
                          : 'border-gray-200/90 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-indigo-600" />
                            {t.clientes ? (
                              <>
                                <span>{t.clientes.nombre_estudiante}</span>
                                {t.clientes.grado_seccion && (
                                  <span className="text-[10px] text-gray-500 font-normal">
                                    ({t.clientes.grado_seccion})
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-gray-600 dark:text-slate-400">Público General / Caja</span>
                            )}
                          </span>
                          <span className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            <span>
                              {fechaObj.fecha} &bull; {fechaObj.hora}
                            </span>
                          </span>
                        </div>

                        {/* Badge de Estado */}
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            audit.esAnulado
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : audit.esPendiente
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {audit.estadoBadge.texto}
                        </span>
                      </div>

                      {/* Resumen de Productos */}
                      <div className="mt-3 rounded-2xl bg-gray-50 dark:bg-[#111726] p-2.5 text-xs text-gray-600 dark:text-slate-300">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                          Productos ({totalItems}):
                        </span>
                        <div className="line-clamp-2 text-[11px] leading-relaxed">
                          {t.consumo_detalles && t.consumo_detalles.length > 0 ? (
                            t.consumo_detalles.map((cd, idx) => (
                              <span key={cd.id || idx}>
                                {cd.cantidad}x {cd.productos?.nombre || 'Producto'}
                                {idx < (t.consumo_detalles?.length || 0) - 1 ? ', ' : ''}
                              </span>
                            ))
                          ) : (
                            <span className="italic text-gray-400">Sin desglose registrado</span>
                          )}
                        </div>
                      </div>

                      {/* Método de Pago y Monto */}
                      <div className="mt-3 flex items-center justify-between border-t border-gray-100 dark:border-slate-800/80 pt-2.5">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            Método de Pago:
                          </span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-xs font-bold text-gray-800 dark:text-slate-200">
                              {audit.nombreLegible}
                            </span>
                            {audit.referencia && (
                              <span className="rounded-md bg-sky-50 dark:bg-sky-950/60 border border-sky-200 text-sky-800 dark:text-sky-300 px-1.5 py-0.2 text-[10px] font-mono font-bold">
                                #{audit.referencia}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <span
                            className={`font-mono text-base font-black ${
                              audit.esAnulado
                                ? 'line-through text-gray-400'
                                : 'text-gray-900 dark:text-slate-100'
                            }`}
                          >
                            {formatUSD(t.monto_total_usd)}
                          </span>
                          <span className="block font-mono text-[10px] text-gray-400">
                            {formatBs(totalBsEquiv)}
                          </span>
                        </div>
                      </div>

                      {/* Botones de Acción */}
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setModalDetalle({ abierto: true, transaccion: t })}
                          className="flex-1 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#111726] py-2 text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-50 transition active:scale-95 text-center"
                        >
                          Ver Ticket
                        </button>

                        {!audit.esAnulado && (
                          <button
                            type="button"
                            onClick={() =>
                              setModalAnular({
                                abierto: true,
                                transaccion: t,
                                procesando: false,
                                error: null,
                              })
                            }
                            className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition active:scale-95 flex items-center gap-1"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>Anular</span>
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Vista en Tabla para Escritorio (>= md) */}
            <div className="hidden md:block overflow-hidden rounded-3xl border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#0D111A] shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-gray-200/80 dark:border-slate-800 bg-gray-50/70 dark:bg-[#111726] text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 pl-4 pr-3">Fecha / Hora</th>
                    <th className="px-3 py-3.5">Cliente</th>
                    <th className="px-3 py-3.5">Artículos</th>
                    <th className="px-3 py-3.5">Método de Pago</th>
                    <th className="px-3 py-3.5">Total ($ / Bs)</th>
                    <th className="px-3 py-3.5">Estado</th>
                    <th className="py-3.5 pl-3 pr-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80">
                  {transaccionesFiltradas.map((t) => {
                    const audit = parseConsumoAudit({
                      metodo_pago: t.metodo_pago,
                      pagado: t.pagado,
                    });
                    const fechaObj = formatearFechaHora(t.fecha);
                    const totalItems =
                      t.consumo_detalles?.reduce((acc, i) => acc + i.cantidad, 0) || 0;
                    const tasaHistorica = t.tasa_bcv_historica || tasaBcv;
                    const totalBsEquiv = calcularConversionBs(t.monto_total_usd, tasaHistorica);

                    return (
                      <tr
                        key={t.id}
                        className={`hover:bg-gray-50/70 dark:hover:bg-[#111726]/60 transition ${
                          audit.esAnulado ? 'bg-rose-50/15 opacity-75' : ''
                        }`}
                      >
                        {/* Fecha y Hora */}
                        <td className="py-3 pl-4 pr-3 whitespace-nowrap">
                          <div className="font-bold text-gray-900 dark:text-slate-100">
                            {fechaObj.fecha}
                          </div>
                          <div className="text-[10px] text-gray-400">{fechaObj.hora}</div>
                        </td>

                        {/* Cliente */}
                        <td className="px-3 py-3">
                          {t.clientes ? (
                            <div>
                              <div className="font-bold text-gray-900 dark:text-slate-100">
                                {t.clientes.nombre_estudiante}
                              </div>
                              {t.clientes.grado_seccion && (
                                <div className="text-[10px] text-gray-500">
                                  {t.clientes.grado_seccion}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">Público General / Caja</span>
                          )}
                        </td>

                        {/* Artículos */}
                        <td className="px-3 py-3 max-w-[200px]">
                          <button
                            type="button"
                            onClick={() => setModalDetalle({ abierto: true, transaccion: t })}
                            className="text-left group"
                          >
                            <span className="font-bold text-gray-800 dark:text-slate-200 group-hover:text-indigo-600 transition block">
                              {totalItems} {totalItems === 1 ? 'artículo' : 'artículos'}
                            </span>
                            <span className="text-[11px] text-gray-400 truncate block max-w-[180px]">
                              {t.consumo_detalles && t.consumo_detalles.length > 0
                                ? t.consumo_detalles.map((c) => c.productos?.nombre).join(', ')
                                : 'Ver detalle'}
                            </span>
                          </button>
                        </td>

                        {/* Método de Pago */}
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-gray-800 dark:text-slate-200">
                              {audit.nombreLegible}
                            </span>
                            {audit.referencia && (
                              <span className="rounded-md bg-sky-50 dark:bg-sky-950/60 border border-sky-200 text-sky-800 dark:text-sky-300 px-1.5 py-0.5 text-[10px] font-mono font-bold">
                                #{audit.referencia}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Total */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div
                            className={`font-mono font-black text-sm ${
                              audit.esAnulado
                                ? 'line-through text-gray-400'
                                : 'text-gray-900 dark:text-slate-100'
                            }`}
                          >
                            {formatUSD(t.monto_total_usd)}
                          </div>
                          <div className="font-mono text-[10px] text-gray-400">
                            {formatBs(totalBsEquiv)}
                          </div>
                        </td>

                        {/* Estado */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                              audit.esAnulado
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : audit.esPendiente
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {audit.estadoBadge.texto}
                          </span>
                        </td>

                        {/* Acciones */}
                        <td className="py-3 pl-3 pr-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setModalDetalle({ abierto: true, transaccion: t })}
                              className="rounded-xl border border-gray-200 dark:border-slate-800 px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#141C2E] transition active:scale-95"
                              title="Ver comprobante / ticket"
                            >
                              Detalle
                            </button>

                            {!audit.esAnulado ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setModalAnular({
                                    abierto: true,
                                    transaccion: t,
                                    procesando: false,
                                    error: null,
                                  })
                                }
                                className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition active:scale-95 flex items-center gap-1"
                                title="Anular venta y revertir saldo"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                <span>Anular</span>
                              </button>
                            ) : (
                              <span className="text-[10px] font-semibold text-rose-400 italic">
                                Anulada
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Modal Detalle de Transacción / Ticket Radix UI */}
      <Dialog.Root
        open={modalDetalle.abierto}
        onOpenChange={(abierto) => setModalDetalle((prev) => ({ ...prev, abierto }))}
      >
        <Dialog.Portal>
          <Dialog.Overlay
            {...dragScrollDetalle.overlayProps}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          />
          <Dialog.Content
            style={dragScrollDetalle.style}
            {...dragScrollDetalle.dragProps}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto overscroll-contain touch-scroll-ios rounded-t-3xl sm:rounded-3xl border-t sm:border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-4 sm:p-6 pb-28 sm:pb-6 shadow-2xl outline-none duration-300 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in-0 sm:zoom-in-95 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[95vw] sm:max-w-lg cursor-grab active:cursor-grabbing"
          >
            {/* Manija táctil */}
            <div className="mx-auto mb-3 -mt-1 flex h-6 w-full cursor-grab active:cursor-grabbing items-center justify-center sm:hidden touch-none">
              <div className="h-1.5 w-12 rounded-full bg-gray-300 dark:bg-slate-700" />
            </div>

            {modalDetalle.transaccion && (() => {
              const t = modalDetalle.transaccion;
              const audit = parseConsumoAudit({ metodo_pago: t.metodo_pago, pagado: t.pagado });
              const fechaObj = formatearFechaHora(t.fecha);
              const tasa = t.tasa_bcv_historica || tasaBcv;
              const totalBs = calcularConversionBs(t.monto_total_usd, tasa);

              return (
                <div className="space-y-4">
                  <div className="flex items-start justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
                    <div>
                      <Dialog.Title className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        <span>Comprobante de Venta</span>
                      </Dialog.Title>
                      <Dialog.Description className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                        Transacción #{t.id.slice(0, 8)} &bull; {fechaObj.fecha} {fechaObj.hora}
                      </Dialog.Description>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        audit.esAnulado
                          ? 'bg-rose-100 text-rose-800'
                          : audit.esPendiente
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {audit.estadoBadge.texto}
                    </span>
                  </div>

                  {/* Datos del Cliente */}
                  <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-[#111726] p-3 text-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                      Cliente / Comprador:
                    </span>
                    {t.clientes ? (
                      <div className="space-y-0.5">
                        <div className="font-bold text-gray-900 dark:text-slate-100">
                          {t.clientes.nombre_estudiante}
                        </div>
                        {t.clientes.grado_seccion && (
                          <div className="text-gray-500">Grado: {t.clientes.grado_seccion}</div>
                        )}
                        {t.clientes.nombre_representante && (
                          <div className="text-gray-500">
                            Representante: {t.clientes.nombre_representante}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="font-semibold text-gray-600 dark:text-slate-400">
                        Venta en Mostrador (Público General)
                      </span>
                    )}
                  </div>

                  {/* Desglose de Productos */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                      Productos Comprados:
                    </span>
                    <div className="divide-y divide-gray-100 dark:divide-slate-800 rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-[#111726] p-3 text-xs max-h-48 overflow-y-auto">
                      {t.consumo_detalles && t.consumo_detalles.length > 0 ? (
                        t.consumo_detalles.map((item) => (
                          <div key={item.id} className="py-2 flex items-center justify-between first:pt-0 last:pb-0">
                            <div>
                              <span className="font-bold text-gray-900 dark:text-slate-100">
                                {item.cantidad}x {item.productos?.nombre || 'Producto'}
                              </span>
                              <span className="block text-[10px] text-gray-400 font-mono">
                                c/u {formatUSD(item.precio_unitario_usd)}
                              </span>
                            </div>
                            <span className="font-mono font-bold text-gray-800 dark:text-slate-200">
                              {formatUSD(item.cantidad * item.precio_unitario_usd)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-400 italic py-2 text-center">
                          Detalles no disponibles para este registro
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Resumen Financiero y Método de Pago */}
                  <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-[#111726] p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 font-medium">Método de Pago:</span>
                      <span className="font-bold text-gray-900 dark:text-slate-100">
                        {audit.nombreLegible}
                      </span>
                    </div>

                    {audit.referencia && (
                      <div className="flex items-center justify-between bg-sky-50 dark:bg-sky-950/40 p-2 rounded-xl border border-sky-100 dark:border-sky-900">
                        <span className="text-sky-800 dark:text-sky-300 font-bold flex items-center gap-1">
                          <Hash className="h-3 w-3" />
                          <span>Referencia Pago Móvil:</span>
                        </span>
                        <span className="font-mono font-black text-sky-900 dark:text-sky-200 text-xs">
                          {audit.referencia}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-gray-500 text-[11px]">
                      <span>Tasa BCV Aplicada:</span>
                      <span className="font-mono font-medium">{formatBs(tasa)}</span>
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-200/80 dark:border-slate-800 pt-2 text-sm">
                      <span className="font-bold text-gray-900 dark:text-slate-100">Total Transacción:</span>
                      <div className="text-right">
                        <span className="font-mono font-black text-gray-900 dark:text-slate-100 text-base">
                          {formatUSD(t.monto_total_usd)}
                        </span>
                        <span className="block font-mono text-[10px] text-gray-400">
                          {formatBs(totalBs)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Botones de acción */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setModalDetalle({ abierto: false, transaccion: null })}
                      className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#111726] px-4 py-2.5 text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-50 transition"
                    >
                      Cerrar
                    </button>

                    {!audit.esAnulado && (
                      <button
                        type="button"
                        onClick={() => {
                          setModalAnular({
                            abierto: true,
                            transaccion: t,
                            procesando: false,
                            error: null,
                          });
                        }}
                        className="flex items-center gap-1.5 rounded-2xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Anular Venta / Devolución</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Modal Confirmación de Anulación (Radix UI Dialog) */}
      <Dialog.Root
        open={modalAnular.abierto}
        onOpenChange={(abierto) =>
          !modalAnular.procesando && setModalAnular((prev) => ({ ...prev, abierto }))
        }
      >
        <Dialog.Portal>
          <Dialog.Overlay
            {...dragScrollAnular.overlayProps}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          />
          <Dialog.Content
            style={dragScrollAnular.style}
            {...dragScrollAnular.dragProps}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto overscroll-contain touch-scroll-ios rounded-t-3xl sm:rounded-3xl border-t sm:border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-4 sm:p-6 pb-28 sm:pb-6 shadow-2xl outline-none duration-300 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in-0 sm:zoom-in-95 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[95vw] sm:max-w-md cursor-grab active:cursor-grabbing"
          >
            {/* Manija táctil */}
            <div className="mx-auto mb-3 -mt-1 flex h-6 w-full cursor-grab active:cursor-grabbing items-center justify-center sm:hidden touch-none">
              <div className="h-1.5 w-12 rounded-full bg-gray-300 dark:bg-slate-700" />
            </div>

            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-100 dark:border-rose-900">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <Dialog.Title className="text-base font-bold text-gray-900 dark:text-slate-100">
                  Anular Transacción / Devolución
                </Dialog.Title>
                <Dialog.Description className="text-xs text-gray-500 dark:text-slate-400">
                  Esta acción no se puede deshacer.
                </Dialog.Description>
              </div>
            </div>

            {modalAnular.transaccion && (() => {
              const t = modalAnular.transaccion;
              const audit = parseConsumoAudit({ metodo_pago: t.metodo_pago, pagado: t.pagado });

              return (
                <div className="space-y-3 text-xs leading-relaxed text-gray-600 dark:text-slate-300">
                  <div className="rounded-2xl border border-rose-100 dark:border-rose-950 bg-rose-50/60 dark:bg-rose-950/30 p-3 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-500">Monto Venta:</span>
                      <span className="font-mono font-black text-rose-700 dark:text-rose-400">
                        {formatUSD(t.monto_total_usd)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-500">Método Original:</span>
                      <span className="font-bold text-gray-800 dark:text-slate-200">
                        {audit.nombreLegible}
                      </span>
                    </div>
                    {t.clientes && (
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-500">Cliente Asociado:</span>
                        <span className="font-bold text-gray-800 dark:text-slate-200">
                          {t.clientes.nombre_estudiante}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Impacto en el saldo del cliente */}
                  <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/80 dark:bg-[#111726] p-3 text-xs">
                    <span className="font-bold text-gray-800 dark:text-slate-200 block mb-1">
                      Efecto Contable Automático:
                    </span>
                    {audit.metodoBase === 'pendiente' ? (
                      <p className="text-amber-800 dark:text-amber-300">
                        ✓ <strong>Se reversará la deuda</strong> de{' '}
                        {formatUSD(t.monto_total_usd)}, sumando +{formatUSD(t.monto_total_usd)} al saldo de {t.clientes?.nombre_estudiante || 'el cliente'}.
                      </p>
                    ) : audit.metodoBase === 'saldo_favor' ? (
                      <p className="text-emerald-800 dark:text-emerald-300">
                        ✓ <strong>Se reembolsará el saldo a favor</strong> de{' '}
                        {formatUSD(t.monto_total_usd)} a la cuenta de {t.clientes?.nombre_estudiante || 'el cliente'}.
                      </p>
                    ) : audit.esMixto ? (
                      <p className="text-indigo-800 dark:text-indigo-300">
                        ✓ <strong>Pago mixto:</strong> se reembolsará la porción de saldo a favor usada y se anulará la transacción.
                      </p>
                    ) : (
                      <p className="text-gray-700 dark:text-slate-300">
                        ✓ <strong>Cobro en caja ({audit.nombreLegible}):</strong> la venta se marcará como anulada y devuelta en el arqueo de caja.
                      </p>
                    )}
                  </div>

                  {modalAnular.error && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800 font-medium">
                      {modalAnular.error}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                    <button
                      type="button"
                      disabled={modalAnular.procesando}
                      onClick={() => setModalAnular((prev) => ({ ...prev, abierto: false }))}
                      className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#111726] px-4 py-2 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={modalAnular.procesando}
                      onClick={handleConfirmarAnulacion}
                      className="flex items-center gap-1.5 rounded-2xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition disabled:opacity-50"
                    >
                      {modalAnular.procesando ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Anulando...</span>
                        </>
                      ) : (
                        <span>Confirmar y Anular</span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })()}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
