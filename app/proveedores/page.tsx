'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Truck,
  Plus,
  Search,
  DollarSign,
  TrendingUp,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  Pencil,
  Trash2,
  Receipt,
  Calendar,
  Clock,
  ShieldCheck,
  CalendarClock,
  Loader2,
  ArrowRight,
  RotateCcw,
  Menu,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { obtenerTasaBCV, TASA_BCV_FALLBACK_DEFAULT } from '@/lib/dolarApi';
import { formatUSD, formatBs, calcularConversionBs } from '@/lib/utils';
import { ProveedorCuenta } from '@/types/pos';
import { NotificationBell } from '@/components/NotificationBell';
import { refrescarNotificacionesGlobales } from '@/components/NotificationsContext';
import { useSidebar } from '@/components/SidebarContext';
import { useModalDragScroll } from '@/lib/useModalDragScroll';

// Helper: Formato de fecha YYYY-MM-DD
const obtenerFechaHoy = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const sumarDias = (dias: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const sumarDiasDesde = (fechaBaseStr: string, dias: number): string => {
  if (!fechaBaseStr) return sumarDias(dias);
  const [y, m, d] = fechaBaseStr.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  date.setDate(date.getDate() + dias);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatearFechaLegible = (fechaStr: string): string => {
  if (!fechaStr) return '';
  const [y, m, d] = fechaStr.split('-').map(Number);
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${d} ${meses[(m || 1) - 1]} ${y}`;
};

export default function ProveedoresPage() {
  const [montado, setMontado] = useState(false);
  const { toggleSidebar, abierto: sidebarAbierto } = useSidebar();

  // 1. Tasa BCV
  const [tasaBcv, setTasaBcv] = useState<number>(TASA_BCV_FALLBACK_DEFAULT);
  const [cargandoTasa, setCargandoTasa] = useState<boolean>(true);

  // 2. Cuentas de Proveedores
  const [cuentas, setCuentas] = useState<ProveedorCuenta[]>([]);
  const [cargandoCuentas, setCargandoCuentas] = useState<boolean>(true);

  // 3. Filtros
  const [busqueda, setBusqueda] = useState<string>('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'pendientes' | 'pagados' | 'vencidos'>('todos');

  // 4. Notificaciones Toast
  const [notificacion, setNotificacion] = useState<{
    tipo: 'exito' | 'info' | 'error';
    texto: string;
  } | null>(null);

  const mostrarNotificacion = useCallback(
    (tipo: 'exito' | 'info' | 'error', texto: string) => {
      setNotificacion({ tipo, texto });
      setTimeout(() => setNotificacion(null), 4000);
    },
    []
  );

  // 5. Modales
  // Modal Crear / Editar
  const [modalForm, setModalForm] = useState<{
    abierto: boolean;
    modo: 'crear' | 'editar';
    id?: string;
    nombre_proveedor: string;
    concepto_mercancia: string;
    monto_usd: string;
    fecha_recepcion: string;
    fecha_vencimiento_pago: string;
    guardando: boolean;
    error: string | null;
  }>({
    abierto: false,
    modo: 'crear',
    nombre_proveedor: '',
    concepto_mercancia: '',
    monto_usd: '',
    fecha_recepcion: obtenerFechaHoy(),
    fecha_vencimiento_pago: sumarDias(7),
    guardando: false,
    error: null,
  });

  // Previsualización y validación en vivo de fechas del modal
  const infoFechasModal = useMemo(() => {
    if (!modalForm.fecha_recepcion || !modalForm.fecha_vencimiento_pago) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const [y1, m1, d1] = modalForm.fecha_recepcion.split('-').map(Number);
    const [y2, m2, d2] = modalForm.fecha_vencimiento_pago.split('-').map(Number);

    const rec = new Date(y1, (m1 || 1) - 1, d1 || 1);
    rec.setHours(0, 0, 0, 0);

    const venc = new Date(y2, (m2 || 1) - 1, d2 || 1);
    venc.setHours(0, 0, 0, 0);

    const plazoDias = Math.round((venc.getTime() - rec.getTime()) / (1000 * 60 * 60 * 24));
    const diasDesdeHoy = Math.ceil((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

    return {
      plazoDias,
      diasDesdeHoy,
      invalido: plazoDias < 0,
      vencidaHoy: diasDesdeHoy < 0,
      venceHoy: diasDesdeHoy === 0,
      proxima: diasDesdeHoy > 0 && diasDesdeHoy <= 3,
    };
  }, [modalForm.fecha_recepcion, modalForm.fecha_vencimiento_pago]);

  // Modal Liquidar / Pagar
  const [modalLiquidar, setModalLiquidar] = useState<{
    abierto: boolean;
    cuenta: ProveedorCuenta | null;
    procesando: boolean;
    error: string | null;
  }>({
    abierto: false,
    cuenta: null,
    procesando: false,
    error: null,
  });

  // Modal Eliminar
  const [modalEliminar, setModalEliminar] = useState<{
    abierto: boolean;
    cuenta: ProveedorCuenta | null;
    eliminando: boolean;
    error: string | null;
  }>({
    abierto: false,
    cuenta: null,
    eliminando: false,
    error: null,
  });

  // Deslizamiento vertical y arrastre (drag-to-scroll) para móviles y emuladores con Body Scroll Lock
  const dragScrollProveedor = useModalDragScroll({
    isOpen: modalForm.abierto,
    onDismiss: () => setModalForm((prev) => ({ ...prev, abierto: false })),
  });

  const dragScrollLiquidar = useModalDragScroll({
    isOpen: modalLiquidar.abierto,
    onDismiss: () => setModalLiquidar((prev) => ({ ...prev, abierto: false })),
  });

  const dragScrollEliminar = useModalDragScroll({
    isOpen: modalEliminar.abierto,
    onDismiss: () => setModalEliminar((prev) => ({ ...prev, abierto: false })),
  });

  // 6. Cargar Tasa BCV
  const cargarTasa = useCallback(async () => {
    setCargandoTasa(true);
    try {
      const data = await obtenerTasaBCV();
      if (data && data > 0) {
        setTasaBcv(data);
      }
    } catch (err) {
      console.error('Error al cargar tasa BCV en proveedores:', err);
    } finally {
      setCargandoTasa(false);
    }
  }, []);

  // 7. Cargar Cuentas por Pagar desde Supabase
  const cargarCuentas = useCallback(async () => {
    setCargandoCuentas(true);
    try {
      const { data, error } = await supabase
        .from('proveedores_cuentas')
        .select('*')
        .order('fecha_vencimiento_pago', { ascending: true });

      if (error) throw error;
      setCuentas((data as ProveedorCuenta[]) || []);
    } catch (err: any) {
      console.error('Error al cargar cuentas de proveedores:', err);
      mostrarNotificacion('error', 'Error al cargar las cuentas por pagar desde Supabase.');
    } finally {
      setCargandoCuentas(false);
    }
  }, [mostrarNotificacion]);

  useEffect(() => {
    setMontado(true);
    cargarTasa();
    cargarCuentas();

    // Sincronización en tiempo real con Supabase entre dispositivos
    const canalRealtime = supabase
      .channel('proveedores_realtime_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'proveedores_cuentas' },
        () => {
          cargarCuentas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canalRealtime);
    };
  }, [cargarTasa, cargarCuentas]);

  // Lista de nombres de proveedores únicos para autocompletado rápido
  const proveedoresFrecuentes = useMemo(() => {
    const set = new Set<string>();
    cuentas.forEach((c) => {
      if (c.nombre_proveedor && c.nombre_proveedor.trim()) {
        set.add(c.nombre_proveedor.trim());
      }
    });
    return Array.from(set);
  }, [cuentas]);

  // Helper de cálculo de estado de vencimiento
  const calcularVencimiento = useCallback((fechaVencimiento: string, pagado: boolean) => {
    if (pagado) {
      return { estado: 'pagado', dias: 0, etiqueta: 'Liquidada', color: 'emerald' };
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const [year, month, day] = fechaVencimiento.split('-').map(Number);
    const venc = new Date(year, (month || 1) - 1, day || 1);
    venc.setHours(0, 0, 0, 0);

    const diffTime = venc.getTime() - hoy.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const diasVencidos = Math.abs(diffDays);
      return {
        estado: 'vencida',
        dias: diasVencidos,
        etiqueta: `Vencida hace ${diasVencidos} ${diasVencidos === 1 ? 'día' : 'días'}`,
        color: 'rose',
      };
    } else if (diffDays === 0) {
      return {
        estado: 'hoy',
        dias: 0,
        etiqueta: 'Vence hoy',
        color: 'amber',
      };
    } else if (diffDays <= 3) {
      return {
        estado: 'proxima',
        dias: diffDays,
        etiqueta: `Vence en ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`,
        color: 'amber',
      };
    } else {
      return {
        estado: 'al_dia',
        dias: diffDays,
        etiqueta: `Vence en ${diffDays} días`,
        color: 'indigo',
      };
    }
  }, []);

  // Métricas para las Tarjetas Superiores
  const metricas = useMemo(() => {
    let totalPendienteUsd = 0;
    let totalPagadoUsd = 0;
    let pendientes = 0;
    let pagadas = 0;
    let vencidas = 0;
    let proximas = 0;

    cuentas.forEach((c) => {
      const monto = Number(c.monto_usd || 0);
      if (c.pagado) {
        pagadas++;
        totalPagadoUsd += monto;
      } else {
        pendientes++;
        totalPendienteUsd += monto;

        const infoVenc = calcularVencimiento(c.fecha_vencimiento_pago, false);
        if (infoVenc.estado === 'vencida') {
          vencidas++;
        } else if (infoVenc.estado === 'hoy' || infoVenc.estado === 'proxima') {
          proximas++;
        }
      }
    });

    const totalPendienteBs = calcularConversionBs(totalPendienteUsd, tasaBcv);
    const totalPagadoBs = calcularConversionBs(totalPagadoUsd, tasaBcv);

    return {
      total: cuentas.length,
      pendientes,
      pagadas,
      vencidas,
      proximas,
      totalPendienteUsd,
      totalPendienteBs,
      totalPagadoUsd,
      totalPagadoBs,
    };
  }, [cuentas, tasaBcv, calcularVencimiento]);

  // Filtrado reactivo de cuentas
  const cuentasFiltradas = useMemo(() => {
    let lista = [...cuentas];

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      lista = lista.filter((c) => {
        const prov = (c.nombre_proveedor || '').toLowerCase();
        const conc = (c.concepto_mercancia || '').toLowerCase();
        const monto = c.monto_usd.toString();
        return prov.includes(q) || conc.includes(q) || monto.includes(q);
      });
    }

    if (filtroEstado === 'pendientes') {
      lista = lista.filter((c) => !c.pagado);
    } else if (filtroEstado === 'pagados') {
      lista = lista.filter((c) => c.pagado);
    } else if (filtroEstado === 'vencidos') {
      lista = lista.filter((c) => {
        if (c.pagado) return false;
        const v = calcularVencimiento(c.fecha_vencimiento_pago, false);
        return v.estado === 'vencida' || v.estado === 'hoy';
      });
    }

    return lista;
  }, [cuentas, busqueda, filtroEstado, calcularVencimiento]);

  // Handlers para el Formulario Crear / Editar
  const handleAbrirCrear = () => {
    setModalForm({
      abierto: true,
      modo: 'crear',
      nombre_proveedor: '',
      concepto_mercancia: '',
      monto_usd: '',
      fecha_recepcion: obtenerFechaHoy(),
      fecha_vencimiento_pago: sumarDias(7),
      guardando: false,
      error: null,
    });
  };

  const handleAbrirEditar = (cuenta: ProveedorCuenta) => {
    setModalForm({
      abierto: true,
      modo: 'editar',
      id: cuenta.id,
      nombre_proveedor: cuenta.nombre_proveedor,
      concepto_mercancia: cuenta.concepto_mercancia,
      monto_usd: cuenta.monto_usd.toString(),
      fecha_recepcion: cuenta.fecha_recepcion || obtenerFechaHoy(),
      fecha_vencimiento_pago: cuenta.fecha_vencimiento_pago || sumarDias(7),
      guardando: false,
      error: null,
    });
  };

  const handleGuardarForm = async (e: React.FormEvent) => {
    e.preventDefault();

    const prov = modalForm.nombre_proveedor.trim();
    const conc = modalForm.concepto_mercancia.trim();
    const monto = parseFloat(modalForm.monto_usd);

    if (!prov) {
      setModalForm((prev) => ({ ...prev, error: 'Por favor indica el nombre del proveedor.' }));
      return;
    }
    if (!conc) {
      setModalForm((prev) => ({ ...prev, error: 'Por favor detalla el concepto de la mercancía.' }));
      return;
    }
    if (isNaN(monto) || monto <= 0) {
      setModalForm((prev) => ({ ...prev, error: 'El monto en USD debe ser mayor a 0.' }));
      return;
    }
    if (!modalForm.fecha_vencimiento_pago) {
      setModalForm((prev) => ({ ...prev, error: 'Indica la fecha límite de pago.' }));
      return;
    }
    if (modalForm.fecha_recepcion && modalForm.fecha_vencimiento_pago) {
      if (modalForm.fecha_vencimiento_pago < modalForm.fecha_recepcion) {
        setModalForm((prev) => ({
          ...prev,
          error:
            'La fecha límite de pago no puede ser anterior a la fecha de recepción de la mercancía. Por favor revisa los meses y días seleccionados (ej. Septiembre vs Octubre).',
        }));
        return;
      }
    }

    setModalForm((prev) => ({ ...prev, guardando: true, error: null }));

    try {
      if (modalForm.modo === 'crear') {
        const { error } = await supabase.from('proveedores_cuentas').insert({
          nombre_proveedor: prov,
          concepto_mercancia: conc,
          monto_usd: monto,
          fecha_recepcion: modalForm.fecha_recepcion || obtenerFechaHoy(),
          fecha_vencimiento_pago: modalForm.fecha_vencimiento_pago,
          pagado: false,
        });

        if (error) throw error;
        mostrarNotificacion('exito', `Factura de "${prov}" registrada correctamente.`);
      } else {
        const { error } = await supabase
          .from('proveedores_cuentas')
          .update({
            nombre_proveedor: prov,
            concepto_mercancia: conc,
            monto_usd: monto,
            fecha_recepcion: modalForm.fecha_recepcion,
            fecha_vencimiento_pago: modalForm.fecha_vencimiento_pago,
          })
          .eq('id', modalForm.id!);

        if (error) throw error;
        mostrarNotificacion('exito', `Factura de "${prov}" actualizada correctamente.`);
      }

      setModalForm((prev) => ({ ...prev, abierto: false, guardando: false }));
      cargarCuentas();
      refrescarNotificacionesGlobales();
    } catch (err: any) {
      console.error('Error al guardar factura:', err);
      setModalForm((prev) => ({
        ...prev,
        guardando: false,
        error: err.message || 'Error al guardar la factura en Supabase.',
      }));
    }
  };

  // Handlers para Liquidar Pago
  const handleAbrirLiquidar = (cuenta: ProveedorCuenta) => {
    setModalLiquidar({
      abierto: true,
      cuenta,
      procesando: false,
      error: null,
    });
  };

  const handleConfirmarLiquidacion = async () => {
    if (!modalLiquidar.cuenta) return;
    setModalLiquidar((prev) => ({ ...prev, procesando: true, error: null }));

    try {
      const { error } = await supabase
        .from('proveedores_cuentas')
        .update({
          pagado: true,
          tasa_bcv_historica: tasaBcv,
        })
        .eq('id', modalLiquidar.cuenta.id);

      if (error) throw error;

      mostrarNotificacion(
        'exito',
        `Pago a "${modalLiquidar.cuenta.nombre_proveedor}" liquidado a tasa ${formatBs(tasaBcv)}.`
      );
      setModalLiquidar({ abierto: false, cuenta: null, procesando: false, error: null });
      cargarCuentas();
      refrescarNotificacionesGlobales();
    } catch (err: any) {
      console.error('Error al liquidar pago:', err);
      setModalLiquidar((prev) => ({
        ...prev,
        procesando: false,
        error: err.message || 'No se pudo liquidar la cuenta.',
      }));
    }
  };

  // Revertir estado pagado a pendiente
  const handleRevertirPago = async (cuenta: ProveedorCuenta) => {
    try {
      const { error } = await supabase
        .from('proveedores_cuentas')
        .update({
          pagado: false,
          tasa_bcv_historica: null,
        })
        .eq('id', cuenta.id);

      if (error) throw error;

      mostrarNotificacion('info', `La factura de "${cuenta.nombre_proveedor}" volvió a estado Pendiente.`);
      cargarCuentas();
      refrescarNotificacionesGlobales();
    } catch (err: any) {
      console.error('Error al revertir pago:', err);
      mostrarNotificacion('error', 'No se pudo revertir el estado de la factura.');
    }
  };

  // Handlers para Eliminar
  const handleAbrirEliminar = (cuenta: ProveedorCuenta) => {
    setModalEliminar({
      abierto: true,
      cuenta,
      eliminando: false,
      error: null,
    });
  };

  const handleConfirmarEliminar = async () => {
    if (!modalEliminar.cuenta) return;
    setModalEliminar((prev) => ({ ...prev, eliminando: true, error: null }));

    try {
      const { error } = await supabase
        .from('proveedores_cuentas')
        .delete()
        .eq('id', modalEliminar.cuenta.id);

      if (error) throw error;

      mostrarNotificacion(
        'exito',
        `Factura de "${modalEliminar.cuenta.nombre_proveedor}" eliminada exitosamente.`
      );
      setModalEliminar({ abierto: false, cuenta: null, eliminando: false, error: null });
      cargarCuentas();
      refrescarNotificacionesGlobales();
    } catch (err: any) {
      console.error('Error al eliminar factura:', err);
      setModalEliminar((prev) => ({
        ...prev,
        eliminando: false,
        error: err.message || 'No se pudo eliminar la factura.',
      }));
    }
  };

  if (!montado) {
    return (
      <div className="min-h-screen flex flex-col bg-[#FAFAFA] dark:bg-[#090D16]" suppressHydrationWarning>
        <header className="sticky top-0 z-30 w-full border-b border-gray-200/70 dark:border-slate-800 bg-white/80 dark:bg-[#0D111A]/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
            <div className="h-6 w-48 bg-gray-200 dark:bg-slate-800 rounded-md animate-pulse" />
            <div className="h-9 w-44 bg-amber-50 dark:bg-amber-950/30 rounded-2xl animate-pulse" />
          </div>
        </header>
        <main className="mx-auto max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="h-28 rounded-3xl bg-gray-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-28 rounded-3xl bg-gray-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-28 rounded-3xl bg-gray-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-28 rounded-3xl bg-gray-100 dark:bg-slate-800 animate-pulse" />
          </div>
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
              <Truck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-sm sm:text-lg font-bold tracking-tight text-gray-900 dark:text-white truncate">
                  Proveedores
                </h1>
                <span className="rounded-full border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.2 text-[10px] sm:text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 shrink-0">
                  {cuentas.length}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-gray-500 dark:text-slate-400 hidden sm:block">
                Recepción de mercancía, plazos de crédito y liquidación a tasa oficial BCV
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
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
            <div className="hidden sm:flex items-center gap-2 rounded-2xl border border-amber-200/80 dark:border-amber-900/50 bg-gradient-to-r from-amber-50/70 to-yellow-50/60 dark:from-amber-950/40 dark:to-yellow-950/30 px-3 py-1.5 shadow-xs">
              <TrendingUp className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase text-amber-800/80 dark:text-amber-400 hidden xs:inline">
                  Tasa BCV
                </span>
                <span className="font-mono text-xs font-bold text-gray-900 dark:text-amber-100 whitespace-nowrap">
                  {tasaBcv > 0 ? formatBs(tasaBcv) : '...'}
                </span>
              </div>
              <button
                type="button"
                onClick={cargarTasa}
                disabled={cargandoTasa}
                title="Actualizar tasa"
                className="ml-1 rounded-lg p-1 text-amber-800 hover:bg-amber-100 transition"
              >
                <RefreshCw className={`h-3 w-3 ${cargandoTasa ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Centro de Notificaciones y Alertas */}
            <NotificationBell />

            {/* Botón Registrar Nueva Factura */}
            <button
              type="button"
              onClick={handleAbrirCrear}
              title="Registrar Cuenta Proveedor"
              className="flex h-9 w-9 sm:h-auto sm:w-auto items-center justify-center gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl bg-indigo-600 sm:px-4 sm:py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition active:scale-95 shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Registrar Cuenta</span>
            </button>
          </div>
        </div>
      </header>

      {/* Toast Notificación */}
      {notificacion && (
        <div
          className={`fixed top-16 right-6 z-50 flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-semibold shadow-lg animate-in slide-in-from-top-2 ${
            notificacion.tipo === 'exito'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : notificacion.tipo === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-blue-200 bg-blue-50 text-blue-800'
          }`}
        >
          {notificacion.tipo === 'exito' && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
          {notificacion.tipo === 'error' && <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />}
          {notificacion.tipo === 'info' && <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />}
          <span>{notificacion.texto}</span>
        </div>
      )}

      {/* Contenido Principal */}
      <main className="mx-auto flex-1 w-full max-w-7xl px-3 sm:px-6 lg:px-8 py-5 sm:py-6 overflow-x-hidden">
        {/* Tarjetas Métricas Top Estilo Precedent */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Métrica 1: Total por Pagar (USD y Bs) */}
          <div className="rounded-3xl border border-rose-200/80 bg-gradient-to-br from-rose-50/40 to-orange-50/20 p-5 shadow-xs transition hover:border-rose-300">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-900/80">
              Total por Pagar
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <div>
                <span className="text-3xl font-black tracking-tight text-rose-950 font-mono">
                  {formatUSD(metricas.totalPendienteUsd)}
                </span>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-800">
                <Receipt className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-1 text-xs text-rose-800/90 font-mono font-medium">
              Equivalente: {formatBs(metricas.totalPendienteBs)}
            </p>
          </div>

          {/* Métrica 2: Cuentas Pendientes vs Pagadas */}
          <div className="rounded-3xl border border-gray-200/80 bg-white p-5 shadow-xs transition hover:border-gray-300">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Estado de Cuentas
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-black tracking-tight text-gray-900">
                {metricas.pendientes}{' '}
                <span className="text-sm font-normal text-gray-400">/ {metricas.total}</span>
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              {metricas.pagadas} liquidadas ({formatUSD(metricas.totalPagadoUsd)})
            </p>
          </div>

          {/* Métrica 3: Alertas de Vencimiento */}
          <div className="rounded-3xl border border-gray-200/80 bg-white p-5 shadow-xs transition hover:border-gray-300">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Plazos y Vencimientos
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span
                className={`text-3xl font-black tracking-tight ${
                  metricas.vencidas > 0
                    ? 'text-rose-600'
                    : metricas.proximas > 0
                    ? 'text-amber-600'
                    : 'text-emerald-600'
                }`}
              >
                {metricas.vencidas > 0 ? `${metricas.vencidas} vencidas` : 'Al día'}
              </span>
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-2xl ${
                  metricas.vencidas > 0
                    ? 'bg-rose-50 text-rose-600'
                    : metricas.proximas > 0
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-emerald-50 text-emerald-600'
                }`}
              >
                <CalendarClock className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              {metricas.proximas > 0
                ? `${metricas.proximas} por vencer en ≤ 3 días`
                : 'Sin urgencias inmediatas'}
            </p>
          </div>

          {/* Métrica 4: Registro Rápido */}
          <div
            onClick={handleAbrirCrear}
            className="group cursor-pointer rounded-3xl border-2 border-dashed border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-blue-50/30 p-5 shadow-2xs transition hover:border-indigo-400 hover:bg-indigo-50/80 hover:shadow-xs flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                Registro Rápido
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-xs group-hover:scale-110 transition-transform">
                <Plus className="h-4 w-4" />
              </div>
            </div>
            <div>
              <p className="text-sm font-black text-indigo-950">Nueva Cuenta / Factura</p>
              <p className="text-[11px] text-indigo-700/80">Registrar mercancía a crédito</p>
            </div>
          </div>
        </div>

        {/* Barra de Búsqueda y Filtros */}
        <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-gray-200/80 bg-white p-4 shadow-xs lg:flex-row lg:items-center lg:justify-between">
          {/* Buscador */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por proveedor, concepto de mercancía o monto..."
              className="w-full rounded-2xl border border-gray-200/90 bg-gray-50/50 py-2.5 pl-10 pr-9 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
                title="Limpiar búsqueda"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Pestañas de Estado */}
            <div className="flex items-center rounded-2xl border border-gray-200/90 bg-gray-50/70 p-1">
              <button
                type="button"
                onClick={() => setFiltroEstado('todos')}
                className={`rounded-xl px-3 py-1 text-xs font-bold transition ${
                  filtroEstado === 'todos'
                    ? 'bg-white text-gray-900 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Todas ({cuentas.length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroEstado('pendientes')}
                className={`flex items-center gap-1 rounded-xl px-3 py-1 text-xs font-bold transition ${
                  filtroEstado === 'pendientes'
                    ? 'bg-amber-100 text-amber-950 shadow-2xs'
                    : 'text-gray-500 hover:text-amber-800'
                }`}
              >
                <span>Pendientes</span>
                {metricas.pendientes > 0 && (
                  <span className="rounded-full bg-amber-200 px-1.5 py-0.2 text-[10px] text-amber-900 font-extrabold">
                    {metricas.pendientes}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setFiltroEstado('pagados')}
                className={`flex items-center gap-1 rounded-xl px-3 py-1 text-xs font-bold transition ${
                  filtroEstado === 'pagados'
                    ? 'bg-emerald-100 text-emerald-950 shadow-2xs'
                    : 'text-gray-500 hover:text-emerald-800'
                }`}
              >
                <span>Pagadas</span>
                {metricas.pagadas > 0 && (
                  <span className="rounded-full bg-emerald-200 px-1.5 py-0.2 text-[10px] text-emerald-900 font-extrabold">
                    {metricas.pagadas}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setFiltroEstado('vencidos')}
                className={`flex items-center gap-1 rounded-xl px-3 py-1 text-xs font-bold transition ${
                  filtroEstado === 'vencidos'
                    ? 'bg-rose-100 text-rose-950 shadow-2xs'
                    : 'text-gray-500 hover:text-rose-800'
                }`}
              >
                <span>Vencidas</span>
                {metricas.vencidas > 0 && (
                  <span className="rounded-full bg-rose-200 px-1.5 py-0.2 text-[10px] text-rose-900 font-extrabold">
                    {metricas.vencidas}
                  </span>
                )}
              </button>
            </div>

            {/* Refrescar */}
            <button
              type="button"
              onClick={cargarCuentas}
              disabled={cargandoCuentas}
              className="flex items-center gap-1.5 rounded-2xl border border-gray-200/80 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 transition disabled:opacity-60"
              title="Recargar cuentas"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${cargandoCuentas ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Grid de Tarjetas de Facturas */}
        {cargandoCuentas ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="h-64 rounded-3xl border border-gray-200/80 bg-white p-5 animate-pulse"
              />
            ))}
          </div>
        ) : cuentasFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 bg-white/70 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-indigo-50 border border-indigo-100 text-indigo-600 mb-3 shadow-xs">
              <Truck className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-gray-900">
              {busqueda || filtroEstado !== 'todos'
                ? 'No se encontraron coincidencias'
                : 'No hay cuentas por pagar registradas'}
            </h3>
            <p className="mt-1 text-xs text-gray-500 max-w-sm">
              {busqueda || filtroEstado !== 'todos'
                ? 'Prueba modificando los filtros de búsqueda o el estado seleccionado.'
                : 'Registra los pedidos de mercancía a crédito para llevar el control de tus deudas comerciales.'}
            </p>
            <button
              type="button"
              onClick={handleAbrirCrear}
              className="mt-5 flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Registrar Primera Factura</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {cuentasFiltradas.map((cuenta) => {
                const infoVenc = calcularVencimiento(cuenta.fecha_vencimiento_pago, cuenta.pagado);
                const montoBsHoy = calcularConversionBs(cuenta.monto_usd, tasaBcv);
                const montoBsHistorico = cuenta.tasa_bcv_historica
                  ? calcularConversionBs(cuenta.monto_usd, cuenta.tasa_bcv_historica)
                  : null;

                return (
                  <motion.div
                    key={cuenta.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.2 }}
                    className={`flex flex-col justify-between rounded-3xl border bg-white p-5 shadow-xs hover:shadow-md transition group ${
                      cuenta.pagado
                        ? 'border-gray-200/70 bg-gray-50/40 opacity-90'
                        : infoVenc.estado === 'vencida'
                        ? 'border-rose-200/90 bg-rose-50/15'
                        : infoVenc.estado === 'hoy' || infoVenc.estado === 'proxima'
                        ? 'border-amber-200/90 bg-amber-50/15'
                        : 'border-gray-200/80 hover:border-gray-300'
                    }`}
                  >
                    <div>
                      {/* Cabecera de la Tarjeta */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          {/* Icono Proveedor */}
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-sm font-black shadow-2xs ${
                              cuenta.pagado
                                ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                : infoVenc.estado === 'vencida'
                                ? 'bg-rose-50 border-rose-100 text-rose-700'
                                : 'bg-indigo-50 border-indigo-100 text-indigo-700'
                            }`}
                          >
                            <Truck className="h-5 w-5" />
                          </div>

                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-gray-900 group-hover:text-indigo-600 transition leading-snug truncate">
                              {cuenta.nombre_proveedor}
                            </h3>

                            {/* Badge de Vencimiento / Estado */}
                            <span
                              className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                                cuenta.pagado
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                  : infoVenc.estado === 'vencida'
                                  ? 'border-rose-200 bg-rose-50 text-rose-800 animate-pulse'
                                  : infoVenc.estado === 'hoy' || infoVenc.estado === 'proxima'
                                  ? 'border-amber-200 bg-amber-50 text-amber-900'
                                  : 'border-indigo-200 bg-indigo-50 text-indigo-700'
                              }`}
                            >
                              {cuenta.pagado ? (
                                <CheckCircle2 className="h-3 w-3 shrink-0" />
                              ) : infoVenc.estado === 'vencida' ? (
                                <AlertTriangle className="h-3 w-3 shrink-0 text-rose-600" />
                              ) : (
                                <Clock className="h-3 w-3 shrink-0" />
                              )}
                              <span>{infoVenc.etiqueta}</span>
                            </span>
                          </div>
                        </div>

                        {/* Botones Editar / Eliminar */}
                        <div className="flex items-center gap-1 shrink-0">
                          {!cuenta.pagado && (
                            <button
                              type="button"
                              onClick={() => handleAbrirEditar(cuenta)}
                              className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
                              title="Editar factura"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleAbrirEliminar(cuenta)}
                            className="rounded-xl p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600 transition"
                            title="Eliminar registro"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Concepto de Mercancía */}
                      <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50/70 p-2.5 text-xs text-gray-700">
                        <span className="font-semibold text-gray-500 uppercase text-[10px] tracking-wider block mb-0.5">
                          Mercancía / Concepto:
                        </span>
                        <p className="line-clamp-2 leading-relaxed text-gray-800">
                          {cuenta.concepto_mercancia}
                        </p>
                      </div>

                      {/* Bloque Financiero / Precios */}
                      <div className="mt-3 space-y-1.5 rounded-2xl border border-gray-100 bg-white p-3 text-xs shadow-2xs">
                        <div className="flex items-center justify-between text-gray-600">
                          <span className="text-gray-400 font-medium">Monto Factura:</span>
                          <span className="font-bold text-gray-900 font-mono text-base">
                            {formatUSD(cuenta.monto_usd)}
                          </span>
                        </div>

                        {cuenta.pagado ? (
                          <>
                            <div className="flex items-center justify-between text-gray-600">
                              <span className="text-gray-400 font-medium">Tasa Liquidación:</span>
                              <span className="font-mono font-medium text-emerald-800">
                                {cuenta.tasa_bcv_historica ? formatBs(cuenta.tasa_bcv_historica) : 'N/D'}
                              </span>
                            </div>
                            {montoBsHistorico !== null && (
                              <div className="flex items-center justify-between text-gray-600 border-t border-gray-100 pt-1">
                                <span className="text-gray-400 font-medium">Total Liquidado:</span>
                                <span className="font-mono font-bold text-emerald-700">
                                  {formatBs(montoBsHistorico)}
                                </span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center justify-between text-gray-600">
                            <span className="text-gray-400 font-medium">Equivalente BCV Hoy:</span>
                            <span className="font-mono font-bold text-gray-800">
                              {formatBs(montoBsHoy)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Fechas de Recepción y Límite */}
                      <div className="mt-3 flex flex-col gap-1.5 text-[11px]">
                        <div className="grid grid-cols-2 gap-2 text-gray-500">
                          <div className="flex items-center gap-1 rounded-xl bg-gray-50 px-2 py-1 border border-gray-100">
                            <Calendar className="h-3 w-3 text-gray-400 shrink-0" />
                            <span className="truncate">
                              Rec: {formatearFechaLegible(cuenta.fecha_recepcion)}
                            </span>
                          </div>
                          <div
                            className={`flex items-center gap-1 rounded-xl px-2 py-1 border ${
                              infoVenc.estado === 'vencida'
                                ? 'bg-rose-50 border-rose-100 text-rose-800 font-semibold'
                                : 'bg-gray-50 border-gray-100 text-gray-600'
                            }`}
                          >
                            <CalendarClock className="h-3 w-3 text-gray-400 shrink-0" />
                            <span className="truncate">
                              Vence: {formatearFechaLegible(cuenta.fecha_vencimiento_pago)}
                            </span>
                          </div>
                        </div>

                        {/* Plazo pactado y alerta si la fecha de pago es anterior a recepción */}
                        {(() => {
                          if (!cuenta.fecha_recepcion || !cuenta.fecha_vencimiento_pago) return null;
                          const [y1, m1, d1] = cuenta.fecha_recepcion.split('-').map(Number);
                          const [y2, m2, d2] = cuenta.fecha_vencimiento_pago.split('-').map(Number);
                          const t1 = new Date(y1, (m1 || 1) - 1, d1 || 1).getTime();
                          const t2 = new Date(y2, (m2 || 1) - 1, d2 || 1).getTime();
                          const diff = Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
                          if (diff < 0) {
                            return (
                              <div className="flex items-center justify-between rounded-lg bg-rose-50 px-2 py-0.5 text-[10px] text-rose-700 font-semibold border border-rose-200">
                                <span>⚠️ Fecha de pago anterior a recepción</span>
                                <button
                                  type="button"
                                  onClick={() => handleAbrirEditar(cuenta)}
                                  className="underline hover:text-rose-900"
                                >
                                  Corregir
                                </button>
                              </div>
                            );
                          }
                          return (
                            <div className="flex items-center justify-between px-1 text-[10px] text-gray-400">
                              <span>Plazo acordado con proveedor:</span>
                              <span className="font-semibold text-gray-700">
                                {diff} {diff === 1 ? 'día' : 'días'}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Acciones del Footer */}
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      {cuenta.pagado ? (
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <span>Factura Liquidada</span>
                          </span>

                          <button
                            type="button"
                            onClick={() => handleRevertirPago(cuenta)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-400 hover:text-gray-700 transition"
                            title="Revertir estado a Pendiente"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>Revertir</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAbrirLiquidar(cuenta)}
                          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-2.5 px-4 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition active:scale-98"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Marcar como Pagado</span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Modal Nueva / Editar Factura (Radix UI Dialog) */}
      <Dialog.Root
        open={modalForm.abierto}
        onOpenChange={(abierto) => setModalForm((prev) => ({ ...prev, abierto }))}
      >
        <Dialog.Portal>
          <Dialog.Overlay
            {...dragScrollProveedor.overlayProps}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          />
          <Dialog.Content
            style={dragScrollProveedor.style}
            {...dragScrollProveedor.dragProps}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain touch-scroll-ios rounded-t-3xl sm:rounded-3xl border-t sm:border border-gray-200/90 bg-white p-4 sm:p-6 pb-32 sm:pb-6 shadow-2xl outline-none duration-300 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in-0 sm:zoom-in-95 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[95vw] sm:max-w-lg cursor-grab active:cursor-grabbing"
          >
            {/* Manija táctil para deslizar hacia arriba y abajo en móviles */}
            <div
              className="mx-auto mb-3 -mt-1 flex h-6 w-full cursor-grab active:cursor-grabbing items-center justify-center sm:hidden touch-none"
              title="Deslizar hacia abajo para cerrar"
            >
              <div className="h-1.5 w-12 rounded-full bg-gray-300 active:bg-gray-400 transition-colors" />
            </div>

            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <Dialog.Title className="text-base font-bold text-gray-900">
                  {modalForm.modo === 'crear'
                    ? 'Registrar Cuenta por Pagar'
                    : 'Editar Factura de Proveedor'}
                </Dialog.Title>
                <Dialog.Description className="text-xs text-gray-500">
                  Ingresa los detalles de la mercancía recibida y el plazo de crédito acordado.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            <form onSubmit={handleGuardarForm} className="mt-4 space-y-4">
              {modalForm.error && (
                <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{modalForm.error}</span>
                </div>
              )}

              {/* Nombre del Proveedor */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nombre del Proveedor / Empresa *
                </label>
                <input
                  type="text"
                  required
                  value={modalForm.nombre_proveedor}
                  onChange={(e) =>
                    setModalForm((prev) => ({ ...prev, nombre_proveedor: e.target.value }))
                  }
                  placeholder="Ej. Distribuidora Polar, Panadería Central, etc."
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                />

                {/* Proveedores frecuentes */}
                {proveedoresFrecuentes.length > 0 && modalForm.modo === 'crear' && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-gray-400 font-medium">Frecuentes:</span>
                    {proveedoresFrecuentes.slice(0, 4).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() =>
                          setModalForm((prev) => ({ ...prev, nombre_proveedor: p }))
                        }
                        className="rounded-lg bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Concepto de Mercancía */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Concepto / Detalle de la Mercancía *
                </label>
                <textarea
                  required
                  rows={2}
                  value={modalForm.concepto_mercancia}
                  onChange={(e) =>
                    setModalForm((prev) => ({ ...prev, concepto_mercancia: e.target.value }))
                  }
                  placeholder="Ej. 10 cajas de malta, 5 paquetes de tequeños pre-cocidos y 2 fardos de servilletas"
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {/* Monto en USD y Conversión en vivo */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Monto Total de la Factura (USD $) *
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                    <span className="font-bold text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={modalForm.monto_usd}
                    onChange={(e) =>
                      setModalForm((prev) => ({ ...prev, monto_usd: e.target.value }))
                    }
                    placeholder="0.00"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 py-2.5 pl-8 pr-4 text-sm font-mono font-bold text-gray-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                {/* Previsualización en Bs */}
                {parseFloat(modalForm.monto_usd) > 0 && (
                  <div className="mt-2 flex items-center justify-between rounded-xl bg-amber-50/70 p-2.5 border border-amber-200/70 text-xs">
                    <span className="text-amber-800 font-medium">Equivalente en Bolívares:</span>
                    <span className="font-mono font-bold text-amber-950">
                      {formatBs(calcularConversionBs(parseFloat(modalForm.monto_usd), tasaBcv))}
                    </span>
                  </div>
                )}
              </div>

              {/* Fechas: Recepción y Vencimiento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Fecha de Recepción
                  </label>
                  <input
                    type="date"
                    required
                    value={modalForm.fecha_recepcion}
                    onChange={(e) =>
                      setModalForm((prev) => ({ ...prev, fecha_recepcion: e.target.value }))
                    }
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 px-3.5 py-2 text-xs text-gray-900 outline-none transition focus:border-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Fecha Límite de Pago *
                  </label>
                  <input
                    type="date"
                    required
                    value={modalForm.fecha_vencimiento_pago}
                    onChange={(e) =>
                      setModalForm((prev) => ({ ...prev, fecha_vencimiento_pago: e.target.value }))
                    }
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 px-3.5 py-2 text-xs text-gray-900 outline-none transition focus:border-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Atajos de plazo de pago y Simulación de estados */}
              <div className="flex flex-col gap-2 pt-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-gray-400 font-medium">Plazo comercial:</span>
                  <button
                    type="button"
                    onClick={() =>
                      setModalForm((prev) => ({
                        ...prev,
                        fecha_vencimiento_pago: sumarDiasDesde(prev.fecha_recepcion, 7),
                      }))
                    }
                    className="rounded-lg border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 transition active:scale-95"
                  >
                    +7 días
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setModalForm((prev) => ({
                        ...prev,
                        fecha_vencimiento_pago: sumarDiasDesde(prev.fecha_recepcion, 15),
                      }))
                    }
                    className="rounded-lg border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 transition active:scale-95"
                  >
                    +15 días
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setModalForm((prev) => ({
                        ...prev,
                        fecha_vencimiento_pago: sumarDiasDesde(prev.fecha_recepcion, 30),
                      }))
                    }
                    className="rounded-lg border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 transition active:scale-95"
                  >
                    +30 días
                  </button>
                </div>

                {/* Atajos para probar/simular alertas del sistema */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-gray-400 font-medium">Probar estado:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setModalForm((prev) => ({
                        ...prev,
                        fecha_recepcion: sumarDias(-10),
                        fecha_vencimiento_pago: sumarDias(-3),
                      }));
                    }}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 hover:bg-rose-100 transition active:scale-95 shadow-2xs"
                    title="Simular factura vencida hace 3 días"
                  >
                    🔴 Vencida (-3d)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModalForm((prev) => ({
                        ...prev,
                        fecha_recepcion: sumarDias(-7),
                        fecha_vencimiento_pago: obtenerFechaHoy(),
                      }));
                    }}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 hover:bg-amber-100 transition active:scale-95 shadow-2xs"
                    title="Simular factura que vence hoy"
                  >
                    🟡 Vence Hoy (0d)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModalForm((prev) => ({
                        ...prev,
                        fecha_recepcion: sumarDias(-5),
                        fecha_vencimiento_pago: sumarDias(2),
                      }));
                    }}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 hover:bg-amber-100 transition active:scale-95 shadow-2xs"
                    title="Simular factura que vence en 2 días"
                  >
                    🟡 Por Vencer (+2d)
                  </button>
                </div>
              </div>

              {/* Diagnóstico en vivo de las fechas */}
              {infoFechasModal && (
                <div
                  className={`rounded-2xl border p-3 text-xs transition ${
                    infoFechasModal.invalido
                      ? 'border-rose-300 bg-rose-50 text-rose-800'
                      : infoFechasModal.vencidaHoy
                      ? 'border-rose-200 bg-rose-50/70 text-rose-900'
                      : infoFechasModal.proxima || infoFechasModal.venceHoy
                      ? 'border-amber-200 bg-amber-50/80 text-amber-950'
                      : 'border-indigo-100 bg-indigo-50/60 text-indigo-950'
                  }`}
                >
                  {infoFechasModal.invalido ? (
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                      <div>
                        <span className="font-bold text-rose-900">¡Incoherencia en las fechas!</span>
                        <p className="mt-0.5 text-[11px] text-rose-700 leading-snug">
                          La fecha límite de pago ({formatearFechaLegible(modalForm.fecha_vencimiento_pago)}) es anterior al día que recibiste la mercancía ({formatearFechaLegible(modalForm.fecha_recepcion)}). Revisa el mes o año seleccionado.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 font-medium">Plazo de crédito acordado:</span>
                        <span className="font-mono font-bold text-indigo-700">
                          {infoFechasModal.plazoDias} {infoFechasModal.plazoDias === 1 ? 'día' : 'días'}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5 border-t border-black/5 pt-1.5 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 font-medium">Tiempo restante desde HOY:</span>
                          <span className="font-bold">
                            {infoFechasModal.vencidaHoy
                              ? `⚠️ Ya vencida hace ${Math.abs(infoFechasModal.diasDesdeHoy)} días (Alerta Roja)`
                              : infoFechasModal.venceHoy
                              ? '⚠️ Vence HOY (Alerta Ámbar)'
                              : infoFechasModal.proxima
                              ? `⚠️ Vence en ${infoFechasModal.diasDesdeHoy} días (Alerta Ámbar)`
                              : `✓ Vence en ${infoFechasModal.diasDesdeHoy} días (Al día)`}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          💡 Este plazo se calcula desde HOY hasta la <strong>Fecha Límite de Pago</strong>.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Botones de Acción */}
              <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setModalForm((prev) => ({ ...prev, abierto: false }))}
                  className="rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalForm.guardando}
                  className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition disabled:opacity-60"
                >
                  {modalForm.guardando && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>{modalForm.modo === 'crear' ? 'Registrar Factura' : 'Guardar Cambios'}</span>
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Modal Liquidar / Pagar Cuenta (Radix UI Dialog) */}
      <Dialog.Root
        open={modalLiquidar.abierto}
        onOpenChange={(abierto) =>
          !modalLiquidar.procesando && setModalLiquidar((prev) => ({ ...prev, abierto }))
        }
      >
        <Dialog.Portal>
          <Dialog.Overlay
            {...dragScrollLiquidar.overlayProps}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          />
          <Dialog.Content
            style={dragScrollLiquidar.style}
            {...dragScrollLiquidar.dragProps}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain touch-scroll-ios rounded-t-3xl sm:rounded-3xl border-t sm:border border-gray-200/90 bg-white p-4 sm:p-6 pb-28 sm:pb-6 shadow-2xl outline-none duration-300 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in-0 sm:zoom-in-95 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[95vw] sm:max-w-lg cursor-grab active:cursor-grabbing"
          >
            {/* Manija táctil para deslizar hacia arriba y abajo en móviles */}
            <div
              className="mx-auto mb-3 -mt-1 flex h-6 w-full cursor-grab active:cursor-grabbing items-center justify-center sm:hidden touch-none"
              title="Deslizar hacia abajo para cerrar"
            >
              <div className="h-1.5 w-12 rounded-full bg-gray-300 active:bg-gray-400 transition-colors" />
            </div>

            <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <Dialog.Title className="text-base font-bold text-gray-900">
                  Liquidar Cuenta por Pagar
                </Dialog.Title>
                <Dialog.Description className="text-xs text-gray-500">
                  Confirma el pago realizado al proveedor
                </Dialog.Description>
              </div>
            </div>

            {modalLiquidar.cuenta && (
              <div className="mt-4 space-y-3">
                {modalLiquidar.error && (
                  <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{modalLiquidar.error}</span>
                  </div>
                )}

                <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-gray-600">
                    <span className="text-gray-400">Proveedor:</span>
                    <span className="font-bold text-gray-900">
                      {modalLiquidar.cuenta.nombre_proveedor}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-gray-600">
                    <span className="text-gray-400">Concepto:</span>
                    <span className="font-medium text-gray-800 text-right truncate max-w-[200px]">
                      {modalLiquidar.cuenta.concepto_mercancia}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-gray-600">
                    <span className="text-gray-400">Vencimiento:</span>
                    <span className="font-mono text-gray-800">
                      {formatearFechaLegible(modalLiquidar.cuenta.fecha_vencimiento_pago)}
                    </span>
                  </div>
                </div>

                {/* Desglose de Pago al BCV Oficial */}
                <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 to-teal-50/50 p-4 space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-semibold text-emerald-900">Total en USD:</span>
                    <span className="font-mono text-lg font-black text-emerald-950">
                      {formatUSD(modalLiquidar.cuenta.monto_usd)}
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline text-xs text-emerald-800">
                    <span>Tasa BCV del Día:</span>
                    <span className="font-mono font-bold">{formatBs(tasaBcv)}</span>
                  </div>

                  <div className="border-t border-emerald-200/80 pt-2 flex justify-between items-baseline">
                    <span className="text-xs font-black uppercase text-emerald-900">
                      Total a Pagar (Bs.):
                    </span>
                    <span className="font-mono text-lg font-black text-emerald-700">
                      {formatBs(calcularConversionBs(modalLiquidar.cuenta.monto_usd, tasaBcv))}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-gray-500 text-center">
                  Al confirmar, la cuenta quedará registrada como pagada y se guardará la tasa oficial
                  histórica del día.
                </p>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={modalLiquidar.procesando}
                    onClick={() => setModalLiquidar((prev) => ({ ...prev, abierto: false }))}
                    className="rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={modalLiquidar.procesando}
                    onClick={handleConfirmarLiquidacion}
                    className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition disabled:opacity-60"
                  >
                    {modalLiquidar.procesando && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>Confirmar Liquidación</span>
                  </button>
                </div>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Modal Confirmar Eliminación (Radix UI Dialog) */}
      <Dialog.Root
        open={modalEliminar.abierto}
        onOpenChange={(abierto) =>
          !modalEliminar.eliminando && setModalEliminar((prev) => ({ ...prev, abierto }))
        }
      >
        <Dialog.Portal>
          <Dialog.Overlay
            {...dragScrollEliminar.overlayProps}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          />
          <Dialog.Content
            style={dragScrollEliminar.style}
            {...dragScrollEliminar.dragProps}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain touch-scroll-ios rounded-t-3xl sm:rounded-3xl border-t sm:border border-gray-200/90 bg-white p-4 sm:p-6 pb-28 sm:pb-6 shadow-2xl outline-none duration-300 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in-0 sm:zoom-in-95 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[95vw] sm:max-w-lg cursor-grab active:cursor-grabbing"
          >
            {/* Manija táctil para deslizar hacia arriba y abajo en móviles */}
            <div
              className="mx-auto mb-3 -mt-1 flex h-6 w-full cursor-grab active:cursor-grabbing items-center justify-center sm:hidden touch-none"
              title="Deslizar hacia abajo para cerrar"
            >
              <div className="h-1.5 w-12 rounded-full bg-gray-300 active:bg-gray-400 transition-colors" />
            </div>

            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 border border-rose-100">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <Dialog.Title className="text-base font-bold text-gray-900">
                Eliminar Registro
              </Dialog.Title>
            </div>

            <Dialog.Description className="text-xs text-gray-500 leading-relaxed">
              ¿Estás seguro de que deseas eliminar la factura de{' '}
              <strong className="text-gray-900">
                {modalEliminar.cuenta?.nombre_proveedor}
              </strong>{' '}
              por un monto de{' '}
              <strong className="text-gray-900">
                {modalEliminar.cuenta && formatUSD(modalEliminar.cuenta.monto_usd)}
              </strong>
              ? Esta acción no se puede deshacer.
            </Dialog.Description>

            {modalEliminar.error && (
              <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
                {modalEliminar.error}
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={modalEliminar.eliminando}
                onClick={() => setModalEliminar((prev) => ({ ...prev, abierto: false }))}
                className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={modalEliminar.eliminando}
                onClick={handleConfirmarEliminar}
                className="flex items-center gap-1.5 rounded-2xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition disabled:opacity-60"
              >
                {modalEliminar.eliminando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Sí, Eliminar</span>
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
