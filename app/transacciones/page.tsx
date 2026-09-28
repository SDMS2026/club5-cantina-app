'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ejecutarMiniRecarga, EVENTO_MINI_RECARGA } from '@/lib/syncUtils';
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
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Loader2,
  FileText,
  BadgeAlert,
  Hash,
  Menu,
  CreditCard,
  PiggyBank,
  Users,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
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

export interface GrupoDiaConsumos {
  diaKey: string;
  etiquetaDia: string;
  totalDiaUsd: number;
  totalDiaBs: number;
  totalTransacciones: number;
  transacciones: TransaccionRegistro[];
}

export interface GrupoMesConsumos {
  mesKey: string;
  etiquetaMes: string;
  totalMesUsd: number;
  totalMesBs: number;
  totalTransacciones: number;
  dias: GrupoDiaConsumos[];
}

export interface GrupoAnoConsumos {
  anoKey: string;
  etiquetaAno: string;
  totalAnoUsd: number;
  totalAnoBs: number;
  totalTransacciones: number;
  meses: GrupoMesConsumos[];
}

const MESES_COMPLETOS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const obtenerInfoFechaAgrupada = (fechaIso?: string) => {
  if (!fechaIso) {
    return {
      anoKey: 'sin-ano',
      etiquetaAno: 'Sin año asignado',
      mesKey: 'sin-mes',
      etiquetaMes: 'Sin mes asignado',
      diaKey: 'sin-fecha',
      etiquetaDia: 'Sin fecha asignada',
    };
  }
  const d = new Date(fechaIso);
  if (isNaN(d.getTime())) {
    return {
      anoKey: 'sin-ano',
      etiquetaAno: 'Sin año asignado',
      mesKey: 'sin-mes',
      etiquetaMes: 'Sin mes asignado',
      diaKey: 'sin-fecha',
      etiquetaDia: 'Sin fecha asignada',
    };
  }

  const y = d.getFullYear();
  const mIndex = d.getMonth();
  const mNum = String(mIndex + 1).padStart(2, '0');
  const diaNum = String(d.getDate()).padStart(2, '0');

  const anoKey = String(y);
  const etiquetaAno = `Año ${y}`;
  const mesKey = `${y}-${mNum}`;
  const etiquetaMes = `${MESES_COMPLETOS[mIndex]} ${y}`;
  const diaKey = `${y}-${mNum}-${diaNum}`;

  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);

  const mesesCortos = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const mesCorto = mesesCortos[mIndex];

  const esMismoDia = (d1: Date, d2: Date) =>
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear();

  let etiquetaDia = `${diaNum} de ${MESES_COMPLETOS[mIndex]}`;
  if (esMismoDia(d, hoy)) {
    etiquetaDia = `Hoy - ${diaNum} ${mesCorto}`;
  } else if (esMismoDia(d, ayer)) {
    etiquetaDia = `Ayer - ${diaNum} ${mesCorto}`;
  }

  return { anoKey, etiquetaAno, mesKey, etiquetaMes, diaKey, etiquetaDia };
};

function agruparTransaccionesPorAnoMesDia(
  transacciones: TransaccionRegistro[],
  tasaBcv: number
): GrupoAnoConsumos[] {
  const mapaAnos = new Map<string, {
    anoKey: string;
    etiquetaAno: string;
    totalAnoUsd: number;
    totalAnoBs: number;
    totalTransacciones: number;
    mapaMeses: Map<string, {
      mesKey: string;
      etiquetaMes: string;
      totalMesUsd: number;
      totalMesBs: number;
      totalTransacciones: number;
      mapaDias: Map<string, {
        diaKey: string;
        etiquetaDia: string;
        totalDiaUsd: number;
        totalDiaBs: number;
        totalTransacciones: number;
        transacciones: TransaccionRegistro[];
      }>;
    }>;
  }>();

  for (const t of transacciones) {
    const { anoKey, etiquetaAno, mesKey, etiquetaMes, diaKey, etiquetaDia } = obtenerInfoFechaAgrupada(t.fecha);

    if (!mapaAnos.has(anoKey)) {
      mapaAnos.set(anoKey, {
        anoKey,
        etiquetaAno,
        totalAnoUsd: 0,
        totalAnoBs: 0,
        totalTransacciones: 0,
        mapaMeses: new Map(),
      });
    }

    const gAno = mapaAnos.get(anoKey)!;
    gAno.totalTransacciones += 1;

    if (!gAno.mapaMeses.has(mesKey)) {
      gAno.mapaMeses.set(mesKey, {
        mesKey,
        etiquetaMes,
        totalMesUsd: 0,
        totalMesBs: 0,
        totalTransacciones: 0,
        mapaDias: new Map(),
      });
    }

    const gMes = gAno.mapaMeses.get(mesKey)!;
    gMes.totalTransacciones += 1;

    if (!gMes.mapaDias.has(diaKey)) {
      gMes.mapaDias.set(diaKey, {
        diaKey,
        etiquetaDia,
        totalDiaUsd: 0,
        totalDiaBs: 0,
        totalTransacciones: 0,
        transacciones: [],
      });
    }

    const gDia = gMes.mapaDias.get(diaKey)!;
    gDia.totalTransacciones += 1;
    gDia.transacciones.push(t);

    const audit = parseConsumoAudit({ metodo_pago: t.metodo_pago, pagado: t.pagado });
    if (!audit.esAnulado) {
      const monto = Number(t.monto_total_usd || 0);
      gDia.totalDiaUsd += monto;
      gMes.totalMesUsd += monto;
      gAno.totalAnoUsd += monto;
    }
  }

  const listaAnos: GrupoAnoConsumos[] = [];

  for (const gAno of mapaAnos.values()) {
    gAno.totalAnoUsd = Math.round(gAno.totalAnoUsd * 100) / 100;
    gAno.totalAnoBs = calcularConversionBs(gAno.totalAnoUsd, tasaBcv);

    const listaMeses: GrupoMesConsumos[] = [];

    for (const gMes of gAno.mapaMeses.values()) {
      gMes.totalMesUsd = Math.round(gMes.totalMesUsd * 100) / 100;
      gMes.totalMesBs = calcularConversionBs(gMes.totalMesUsd, tasaBcv);

      const listaDias: GrupoDiaConsumos[] = [];

      for (const gDia of gMes.mapaDias.values()) {
        gDia.totalDiaUsd = Math.round(gDia.totalDiaUsd * 100) / 100;
        gDia.totalDiaBs = calcularConversionBs(gDia.totalDiaUsd, tasaBcv);
        listaDias.push(gDia);
      }

      listaDias.sort((a, b) => b.diaKey.localeCompare(a.diaKey));
      listaMeses.push({
        mesKey: gMes.mesKey,
        etiquetaMes: gMes.etiquetaMes,
        totalMesUsd: gMes.totalMesUsd,
        totalMesBs: gMes.totalMesBs,
        totalTransacciones: gMes.totalTransacciones,
        dias: listaDias,
      });
    }

    listaMeses.sort((a, b) => b.mesKey.localeCompare(a.mesKey));
    listaAnos.push({
      anoKey: gAno.anoKey,
      etiquetaAno: gAno.etiquetaAno,
      totalAnoUsd: gAno.totalAnoUsd,
      totalAnoBs: gAno.totalAnoBs,
      totalTransacciones: gAno.totalTransacciones,
      meses: listaMeses,
    });
  }

  listaAnos.sort((a, b) => b.anoKey.localeCompare(a.anoKey));
  return listaAnos;
}

export default function TransaccionesPage() {
  const router = useRouter();
  const [montado, setMontado] = useState(false);
  const { toggleSidebar, abierto: sidebarAbierto } = useSidebar();

  // 1. Tasa BCV
  const [tasaBcv, setTasaBcv] = useState<number>(TASA_BCV_FALLBACK_DEFAULT);
  const [cargandoTasa, setCargandoTasa] = useState<boolean>(true);

  // 2. Transacciones
  const [transacciones, setTransacciones] = useState<TransaccionRegistro[]>([]);
  const [cargandoTransacciones, setCargandoTransacciones] = useState<boolean>(true);

  // 3. Filtros y Búsqueda con Debounce
  const [pestanaActiva, setPestanaActiva] = useState<'consumos' | 'liquidaciones'>('consumos');
  const [liquidaciones, setLiquidaciones] = useState<TransaccionRegistro[]>([]);
  const [cargandoLiquidaciones, setCargandoLiquidaciones] = useState<boolean>(false);
  const [busquedaLiquidaciones, setBusquedaLiquidaciones] = useState<string>('');

  // 4. Estados de Acordeón Jerárquico (Año -> Mes -> Día) para Consumos
  const [anoExpandido, setAnoExpandido] = useState<string | null>(null);
  const [mesExpandido, setMesExpandido] = useState<string | null>(null);
  const [diaExpandido, setDiaExpandido] = useState<string | null>(null);
  const [paginaDia, setPaginaDia] = useState<number>(1);

  // 5. Estados de Acordeón Jerárquico (Año -> Mes -> Día) para Liquidaciones
  const [anoExpandidoLiq, setAnoExpandidoLiq] = useState<string | null>(null);
  const [mesExpandidoLiq, setMesExpandidoLiq] = useState<string | null>(null);
  const [diaExpandidoLiq, setDiaExpandidoLiq] = useState<string | null>(null);
  const [paginaDiaLiq, setPaginaDiaLiq] = useState<number>(1);

  const toggleAno = (anoKey: string) => {
    setAnoExpandido((prev) => (prev === anoKey ? null : anoKey));
    setMesExpandido(null);
    setDiaExpandido(null);
    setPaginaDia(1);
  };

  const toggleMes = (mesKey: string) => {
    setMesExpandido((prev) => (prev === mesKey ? null : mesKey));
    setDiaExpandido(null);
    setPaginaDia(1);
  };

  const toggleDia = (diaKey: string) => {
    // "pero que sea solo una tarjeta del dia": solo una tarjeta de día abierta a la vez
    setDiaExpandido((prev) => (prev === diaKey ? null : diaKey));
    setPaginaDia(1);
  };

  const toggleAnoLiq = (anoKey: string) => {
    setAnoExpandidoLiq((prev) => (prev === anoKey ? null : anoKey));
    setMesExpandidoLiq(null);
    setDiaExpandidoLiq(null);
    setPaginaDiaLiq(1);
  };

  const toggleMesLiq = (mesKey: string) => {
    setMesExpandidoLiq((prev) => (prev === mesKey ? null : mesKey));
    setDiaExpandidoLiq(null);
    setPaginaDiaLiq(1);
  };

  const toggleDiaLiq = (diaKey: string) => {
    setDiaExpandidoLiq((prev) => (prev === diaKey ? null : diaKey));
    setPaginaDiaLiq(1);
  };

  const [busqueda, setBusqueda] = useState<string>('');
  const [busquedaDebounced, setBusquedaDebounced] = useState<string>('');
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

  // Debounce para la barra de búsqueda de transacciones (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setBusquedaDebounced(busqueda);
    }, 300);
    return () => clearTimeout(handler);
  }, [busqueda]);

  // Cargar métricas financieras de auditoría (KPIs globales de la fecha seleccionada)
  const [metricasData, setMetricasData] = useState({
    totalVentasUsd: 0,
    pagadasCajaUsd: 0,
    pendientesFiadoUsd: 0,
    anuladasTotalUsd: 0,
    cantidadAnuladas: 0,
    cantidadTotal: 0,
  });

  const cargarMetricasResumen = useCallback(async () => {
    try {
      let q = supabase
        .from('consumos')
        .select('monto_total_usd, metodo_pago, pagado, fecha');

      if (filtroFecha === 'hoy') {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        q = q.gte('fecha', hoy.toISOString());
      } else if (filtroFecha === 'semana') {
        const hace7 = new Date();
        hace7.setDate(hace7.getDate() - 7);
        hace7.setHours(0, 0, 0, 0);
        q = q.gte('fecha', hace7.toISOString());
      } else if (filtroFecha === 'mes') {
        const hace30 = new Date();
        hace30.setDate(hace30.getDate() - 30);
        hace30.setHours(0, 0, 0, 0);
        q = q.gte('fecha', hace30.toISOString());
      }

      const { data, error } = await q;
      if (error || !data) return;

      let totalVentasUsd = 0;
      let pagadasCajaUsd = 0;
      let pendientesFiadoUsd = 0;
      let anuladasTotalUsd = 0;
      let cantidadAnuladas = 0;
      let cantidadTotal = 0;

      data.forEach((t) => {
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

      setMetricasData({
        totalVentasUsd,
        pagadasCajaUsd,
        pendientesFiadoUsd,
        anuladasTotalUsd,
        cantidadAnuladas,
        cantidadTotal,
      });
    } catch (err) {
      console.error('Error calculando resumen de métricas:', err);
    }
  }, [filtroFecha]);

  // Tamaño máximo de transacciones por página adentro de cada día abierto
  const TAMANO_PAGINA_JERARQUIA = 20;

  // Cargar transacciones desde Supabase (sin corte a 25 para permitir agrupar todos los días 1-31)
  const cargarTransacciones = useCallback(async () => {
    setCargandoTransacciones(true);
    try {
      let query = supabase
        .from('consumos')
        .select(
          `
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
        `
        );

      // 1. Filtro en Base de Datos por Rango de Fecha (.gte)
      if (filtroFecha === 'hoy') {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        query = query.gte('fecha', hoy.toISOString());
      } else if (filtroFecha === 'semana') {
        const hace7 = new Date();
        hace7.setDate(hace7.getDate() - 7);
        hace7.setHours(0, 0, 0, 0);
        query = query.gte('fecha', hace7.toISOString());
      } else if (filtroFecha === 'mes') {
        const hace30 = new Date();
        hace30.setDate(hace30.getDate() - 30);
        hace30.setHours(0, 0, 0, 0);
        query = query.gte('fecha', hace30.toISOString());
      }

      // 2. Filtro en Base de Datos por Método de Pago / Estado
      if (filtroMetodo === 'anuladas') {
        query = query.ilike('metodo_pago', 'anulado%');
      } else if (filtroMetodo === 'pendientes') {
        query = query.eq('pagado', false).not('metodo_pago', 'ilike', 'anulado%');
      } else if (filtroMetodo === 'pago_movil') {
        query = query.ilike('metodo_pago', 'pago_movil%');
      } else if (filtroMetodo === 'efectivo') {
        query = query.or('metodo_pago.ilike.efectivo_usd%,metodo_pago.ilike.efectivo_bs%');
      } else if (filtroMetodo === 'saldo_favor') {
        query = query.or('metodo_pago.ilike.saldo_favor%,metodo_pago.ilike.mixto%');
      }

      // 3. Filtro en Base de Datos por Término de Búsqueda (.ilike en DB)
      const term = busquedaDebounced.trim();
      if (term) {
        const [resClientes, resDetalles] = await Promise.all([
          supabase
            .from('clientes')
            .select('id')
            .or(
              `nombre_estudiante.ilike.%${term}%,nombre_representante.ilike.%${term}%,grado_seccion.ilike.%${term}%`
            )
            .limit(80),
          supabase
            .from('consumo_detalles')
            .select('consumo_id, productos!inner(nombre)')
            .ilike('productos.nombre', `%${term}%`)
            .limit(80),
        ]);

        const clientIds = (resClientes.data || []).map((c) => c.id).filter(Boolean);
        const consumoIds = (resDetalles.data || []).map((d) => d.consumo_id).filter(Boolean);

        const orClauses: string[] = [`metodo_pago.ilike.%${term}%`];
        if (clientIds.length > 0) {
          orClauses.push(`cliente_id.in.(${clientIds.join(',')})`);
        }
        if (consumoIds.length > 0) {
          orClauses.push(`id.in.(${consumoIds.join(',')})`);
        }
        query = query.or(orClauses.join(','));
      }

      // 4. Traer transacciones ordenadas descendente (hasta 2500 para agrupar año -> mes -> días 1 al 31)
      query = query.order('fecha', { ascending: false }).limit(2500);

      const { data, error } = await query;

      if (error) {
        console.error('Error consultando historial de transacciones:', error);
        mostrarNotificacion('error', 'Error al consultar historial.');
      } else {
        const items = (data as unknown as TransaccionRegistro[]) || [];
        setTransacciones(items);
      }
    } catch (err) {
      console.error('Error inesperado cargando transacciones:', err);
    } finally {
      setCargandoTransacciones(false);
    }
  }, [filtroFecha, filtroMetodo, busquedaDebounced, mostrarNotificacion]);

  // Inicialización y recarga automática ante cambios de filtros o búsqueda
  useEffect(() => {
    setMontado(true);
    cargarTasa();
  }, [cargarTasa]);

  // Cargar historial de liquidaciones y abonos para auditoría contable (hasta 2500 registros)
  const cargarLiquidaciones = useCallback(async () => {
    setCargandoLiquidaciones(true);
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
        .eq('pagado', true)
        .not('metodo_pago', 'ilike', 'anulado%')
        .order('fecha', { ascending: false })
        .limit(2500);

      if (error) {
        console.error('Error cargando liquidaciones en Supabase:', error);
      } else {
        const normalizados: TransaccionRegistro[] = (data || []).map((d: any) => ({
          ...d,
          clientes: Array.isArray(d.clientes) ? d.clientes[0] || null : d.clientes || null,
          monto_total_usd: Number(d.monto_total_usd) || 0,
          consumo_detalles: Array.isArray(d.consumo_detalles) ? d.consumo_detalles : [],
        }));
        setLiquidaciones(normalizados);
      }
    } catch (e) {
      console.error('Excepción cargando historial de liquidaciones:', e);
    } finally {
      setCargandoLiquidaciones(false);
    }
  }, []);

  useEffect(() => {
    cargarTransacciones();
    cargarMetricasResumen();
    cargarLiquidaciones();
  }, [cargarTransacciones, cargarMetricasResumen, cargarLiquidaciones]);

  // Suscripción en tiempo real a la tabla 'consumos'
  useEffect(() => {
    const channel = supabase
      .channel('transacciones_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consumos' }, () => {
        cargarTransacciones();
        cargarMetricasResumen();
        cargarLiquidaciones();
      })
      .subscribe();

    const handleMiniRecarga = () => {
      cargarTransacciones();
      cargarMetricasResumen();
      cargarLiquidaciones();
    };

    window.addEventListener(EVENTO_MINI_RECARGA, handleMiniRecarga);

    return () => {
      window.removeEventListener(EVENTO_MINI_RECARGA, handleMiniRecarga);
      supabase.removeChannel(channel);
    };
  }, [cargarTransacciones, cargarMetricasResumen, cargarLiquidaciones]);

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
      await ejecutarMiniRecarga({
        router,
        recargarDatosLocales: async () => {
          await Promise.all([cargarTransacciones(), cargarMetricasResumen(), cargarLiquidaciones()]);
        },
      });
    } catch (err: unknown) {
      console.error('Error al anular transacción:', err);
      const msg = err instanceof Error ? err.message : 'Error al anular la transacción.';
      setModalAnular((prev) => ({ ...prev, procesando: false, error: msg }));
    }
  };

  // Agrupamiento jerárquico Año -> Mes -> Día para Consumos
  const consumosAgrupadosJerarquia = useMemo(() => {
    return agruparTransaccionesPorAnoMesDia(transacciones, tasaBcv);
  }, [transacciones, tasaBcv]);

  // Historial de liquidaciones filtrado por búsqueda
  const liquidacionesFiltradas = useMemo(() => {
    let lista = [...liquidaciones];
    if (busquedaLiquidaciones.trim()) {
      const q = busquedaLiquidaciones.toLowerCase().trim();
      lista = lista.filter((t) => {
        const est = t.clientes?.nombre_estudiante?.toLowerCase() || '';
        const rep = t.clientes?.nombre_representante?.toLowerCase() || '';
        const grado = t.clientes?.grado_seccion?.toLowerCase() || '';
        const met = t.metodo_pago?.toLowerCase() || '';
        const audit = parseConsumoAudit({ metodo_pago: t.metodo_pago, pagado: t.pagado });
        const ref = audit.referencia?.toLowerCase() || '';
        return est.includes(q) || rep.includes(q) || grado.includes(q) || met.includes(q) || ref.includes(q);
      });
    }
    return lista;
  }, [liquidaciones, busquedaLiquidaciones]);

  // Agrupamiento jerárquico Año -> Mes -> Día para Liquidaciones
  const liquidacionesAgrupadasJerarquia = useMemo(() => {
    return agruparTransaccionesPorAnoMesDia(liquidacionesFiltradas, tasaBcv);
  }, [liquidacionesFiltradas, tasaBcv]);

  // Auto-desplegar primer año, mes y día cuando el usuario escribe en el buscador de consumos
  useEffect(() => {
    if (busquedaDebounced.trim() && consumosAgrupadosJerarquia.length > 0) {
      const pAno = consumosAgrupadosJerarquia[0];
      setAnoExpandido(pAno.anoKey);
      if (pAno.meses.length > 0) {
        const pMes = pAno.meses[0];
        setMesExpandido(pMes.mesKey);
        if (pMes.dias.length > 0) {
          setDiaExpandido(pMes.dias[0].diaKey);
          setPaginaDia(1);
        }
      }
    }
  }, [busquedaDebounced, consumosAgrupadosJerarquia]);

  // Auto-desplegar primer año, mes y día cuando el usuario escribe en el buscador de liquidaciones
  useEffect(() => {
    if (busquedaLiquidaciones.trim() && liquidacionesAgrupadasJerarquia.length > 0) {
      const pAno = liquidacionesAgrupadasJerarquia[0];
      setAnoExpandidoLiq(pAno.anoKey);
      if (pAno.meses.length > 0) {
        const pMes = pAno.meses[0];
        setMesExpandidoLiq(pMes.mesKey);
        if (pMes.dias.length > 0) {
          setDiaExpandidoLiq(pMes.dias[0].diaKey);
          setPaginaDiaLiq(1);
        }
      }
    }
  }, [busquedaLiquidaciones, liquidacionesAgrupadasJerarquia]);

  const metricasLiquidaciones = useMemo(() => {
    const totalUsd = liquidacionesFiltradas.reduce((sum, item) => sum + Number(item.monto_total_usd || 0), 0);
    return {
      totalUsd,
      totalBs: calcularConversionBs(totalUsd, tasaBcv),
      totalOperaciones: liquidacionesFiltradas.length,
    };
  }, [liquidacionesFiltradas, tasaBcv]);

  // Resumen de Métricas Financieras (KPIs de Auditoría) con tasa BCV reactiva
  const metricas = useMemo(() => {
    return {
      ...metricasData,
      totalVentasBs: calcularConversionBs(metricasData.totalVentasUsd, tasaBcv),
      pagadasCajaBs: calcularConversionBs(metricasData.pagadasCajaUsd, tasaBcv),
      pendientesFiadoBs: calcularConversionBs(metricasData.pendientesFiadoUsd, tasaBcv),
    };
  }, [metricasData, tasaBcv]);

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
    <ErrorBoundary
      fallbackTitle="Historial de Transacciones"
      fallbackMessage="Ocurrió un error cargando el historial. Puedes reintentar sin riesgo de pérdida de datos."
      onReset={() => cargarTransacciones()}
    >
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
        {/* Selector de Pestañas: Consumos/Ventas vs Historial de Liquidaciones */}
        <div className="flex items-center gap-2 border-b border-gray-200/80 dark:border-slate-800 pb-3">
          <button
            type="button"
            onClick={() => setPestanaActiva('consumos')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition active:scale-95 ${
              pestanaActiva === 'consumos'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-[#0D111A] text-gray-600 dark:text-slate-300 border border-gray-200/90 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-[#111726]'
            }`}
          >
            <ShoppingBag className="h-4 w-4" />
            <span>Historial de Consumos (Agrupado por Días)</span>
          </button>

          <button
            type="button"
            onClick={() => setPestanaActiva('liquidaciones')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition active:scale-95 ${
              pestanaActiva === 'liquidaciones'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-[#0D111A] text-gray-600 dark:text-slate-300 border border-gray-200/90 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-[#111726]'
            }`}
          >
            <CreditCard className="h-4 w-4" />
            <span>Historial de Liquidaciones y Pagos</span>
            {liquidacionesFiltradas.length > 0 && (
              <span className="ml-1 rounded-full bg-indigo-100 dark:bg-indigo-950/80 px-2 py-0.5 text-[10px] text-indigo-700 dark:text-indigo-300">
                {liquidacionesFiltradas.length}
              </span>
            )}
          </button>
        </div>

        {pestanaActiva === 'consumos' ? (
          <>
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

            {/* Listado Agrupado Jerárquico: Año -> Mes -> Días (1 al 31) -> Tickets Paginados */}
            {cargandoTransacciones ? (
              <div className="rounded-3xl border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-12 text-center shadow-2xs">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
                <p className="mt-3 text-xs font-semibold text-gray-500 dark:text-slate-400">
                  Cargando transacciones desde Supabase...
                </p>
              </div>
            ) : consumosAgrupadosJerarquia.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-200 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-12 text-center">
                <FileText className="mx-auto h-10 w-10 text-gray-300 dark:text-slate-600" />
                <h3 className="mt-2 text-sm font-bold text-gray-800 dark:text-slate-200">
                  No se encontraron consumos registrados
                </h3>
                <p className="mt-1 text-xs text-gray-400">
                  Prueba cambiando los filtros de fecha, método de pago o el término de búsqueda.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {consumosAgrupadosJerarquia.map((gAno) => {
                  const anoAbierto = anoExpandido === gAno.anoKey;

                  return (
                    <div
                      key={gAno.anoKey}
                      className="overflow-hidden rounded-3xl border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#0D111A] shadow-2xs transition"
                    >
                      {/* NIVEL 1: Div / Botón del AÑO */}
                      <button
                        type="button"
                        onClick={() => toggleAno(gAno.anoKey)}
                        className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:px-5 hover:bg-gray-50/70 dark:hover:bg-[#111726]/60 transition text-left gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/60 font-black text-sm">
                            {gAno.anoKey}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h2 className="text-base font-black text-gray-900 dark:text-slate-100">
                                {gAno.etiquetaAno}
                              </h2>
                              <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                                {gAno.totalTransacciones} {gAno.totalTransacciones === 1 ? 'ticket' : 'tickets'} en el año
                              </span>
                            </div>
                            <span className="text-[11px] text-gray-400 mt-0.5 block">
                              {anoAbierto ? 'Clic para contraer año' : 'Clic para desplegar los meses de este año'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100 dark:border-slate-800">
                          <div className="text-left sm:text-right">
                            <div className="text-base sm:text-lg font-black text-gray-900 dark:text-slate-100">
                              {formatUSD(gAno.totalAnoUsd)}
                            </div>
                            <div className="text-[11px] font-mono text-amber-700 dark:text-amber-400 font-bold">
                              {formatBs(gAno.totalAnoBs)}
                            </div>
                          </div>

                          <div
                            className={`p-2 rounded-xl border border-gray-200/80 dark:border-slate-800 bg-gray-50 dark:bg-[#111726] text-gray-600 dark:text-slate-300 transition-transform ${
                              anoAbierto ? 'rotate-180' : ''
                            }`}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </div>
                        </div>
                      </button>

                      {/* NIVEL 2: Contenedor de MESES */}
                      {anoAbierto && (
                        <div className="border-t border-gray-100 dark:border-slate-800/80 p-3 sm:p-4 bg-gray-50/30 dark:bg-[#0a0e17]/30 space-y-3">
                          {gAno.meses.map((gMes) => {
                            const mesAbierto = mesExpandido === gMes.mesKey;

                            return (
                              <div
                                key={gMes.mesKey}
                                className="overflow-hidden rounded-2xl border border-gray-200/80 dark:border-slate-800/90 bg-white dark:bg-[#0D111A] shadow-2xs transition"
                              >
                                {/* Botón del MES */}
                                <button
                                  type="button"
                                  onClick={() => toggleMes(gMes.mesKey)}
                                  className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:px-4 hover:bg-gray-50/70 dark:hover:bg-[#111726]/60 transition text-left gap-2.5"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/40">
                                      <Calendar className="h-4 w-4" />
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">
                                          {gMes.etiquetaMes}
                                        </h3>
                                        <span className="rounded-full bg-purple-50 dark:bg-purple-950/60 border border-purple-200/80 dark:border-purple-800 px-2 py-0.2 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                                          {gMes.totalTransacciones} {gMes.totalTransacciones === 1 ? 'ticket' : 'tickets'}
                                        </span>
                                      </div>
                                      <span className="text-[10px] text-gray-400 mt-0.5 block">
                                        {mesAbierto ? 'Clic para contraer mes' : 'Clic para desplegar los días (1 al 31)'}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-1.5 sm:pt-0 border-gray-100 dark:border-slate-800">
                                    <div className="text-left sm:text-right">
                                      <div className="text-sm font-black text-gray-900 dark:text-slate-100">
                                        {formatUSD(gMes.totalMesUsd)}
                                      </div>
                                      <div className="text-[10px] font-mono text-amber-700 dark:text-amber-400 font-bold">
                                        {formatBs(gMes.totalMesBs)}
                                      </div>
                                    </div>

                                    <div
                                      className={`p-1.5 rounded-lg border border-gray-200/80 dark:border-slate-800 bg-gray-50 dark:bg-[#111726] text-gray-600 dark:text-slate-300 transition-transform ${
                                        mesAbierto ? 'rotate-180' : ''
                                      }`}
                                    >
                                      <ChevronDown className="h-3.5 w-3.5" />
                                    </div>
                                  </div>
                                </button>

                                {/* NIVEL 3: Contenedor de DÍAS (1 al 31) */}
                                {mesAbierto && (
                                  <div className="border-t border-gray-100 dark:border-slate-800/80 p-2.5 sm:p-3 bg-gray-50/50 dark:bg-[#0a0e17]/50 space-y-2.5">
                                    {gMes.dias.map((gDia) => {
                                      const diaAbierto = diaExpandido === gDia.diaKey;
                                      const totalPaginasDia = Math.max(1, Math.ceil(gDia.transacciones.length / TAMANO_PAGINA_JERARQUIA));
                                      const transaccionesPaginadas = gDia.transacciones.slice(
                                        (paginaDia - 1) * TAMANO_PAGINA_JERARQUIA,
                                        paginaDia * TAMANO_PAGINA_JERARQUIA
                                      );

                                      return (
                                        <div
                                          key={gDia.diaKey}
                                          className="overflow-hidden rounded-xl border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#0D111A] shadow-2xs transition"
                                        >
                                          {/* Tarjeta del DÍA - Exclusive Accordion */}
                                          <button
                                            type="button"
                                            onClick={() => toggleDia(gDia.diaKey)}
                                            className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:px-4 hover:bg-gray-50/70 dark:hover:bg-[#111726]/60 transition text-left gap-2.5"
                                          >
                                            <div className="flex items-center gap-2.5">
                                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
                                                <Clock className="h-4 w-4" />
                                              </div>
                                              <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                  <h4 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-slate-100">
                                                    {gDia.etiquetaDia}
                                                  </h4>
                                                  <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800 px-2 py-0.2 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                                                    {gDia.totalTransacciones} {gDia.totalTransacciones === 1 ? 'ticket' : 'tickets'}
                                                  </span>
                                                </div>
                                                <span className="text-[10px] text-gray-400 mt-0.5 block">
                                                  {diaAbierto ? 'Clic para contraer' : 'Clic para desplegar tickets de este día'}
                                                </span>
                                              </div>
                                            </div>

                                            <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-1.5 sm:pt-0 border-gray-100 dark:border-slate-800">
                                              <div className="text-left sm:text-right">
                                                <div className="text-xs sm:text-sm font-black text-gray-900 dark:text-slate-100">
                                                  {formatUSD(gDia.totalDiaUsd)}
                                                </div>
                                                <div className="text-[10px] font-mono text-amber-700 dark:text-amber-400 font-bold">
                                                  {formatBs(gDia.totalDiaBs)}
                                                </div>
                                              </div>

                                              <div
                                                className={`p-1.5 rounded-lg border border-gray-200/80 dark:border-slate-800 bg-gray-50 dark:bg-[#111726] text-gray-600 dark:text-slate-300 transition-transform ${
                                                  diaAbierto ? 'rotate-180' : ''
                                                }`}
                                              >
                                                <ChevronDown className="h-3.5 w-3.5" />
                                              </div>
                                            </div>
                                          </button>

                                          {/* NIVEL 4: Contenido del DÍA abierto con tickets y paginación interna */}
                                          {diaAbierto && (
                                            <div className="border-t border-gray-100 dark:border-slate-800/80 p-2.5 sm:p-3 bg-gray-50/40 dark:bg-[#0a0e17]/40 space-y-3">
                                              {/* Vista Móvil (< md) */}
                                              <div className="grid grid-cols-1 gap-2.5 md:hidden">
                                                <AnimatePresence>
                                                  {transaccionesPaginadas.map((t) => {
                                                    const audit = parseConsumoAudit({ metodo_pago: t.metodo_pago, pagado: t.pagado });
                                                    const fechaObj = formatearFechaHora(t.fecha);
                                                    const totalItems = t.consumo_detalles?.reduce((acc, i) => acc + i.cantidad, 0) || 0;
                                                    const tasaHistorica = t.tasa_bcv_historica || tasaBcv;
                                                    const totalBsEquiv = calcularConversionBs(t.monto_total_usd, tasaHistorica);

                                                    return (
                                                      <motion.div
                                                        key={t.id}
                                                        initial={{ opacity: 0, y: 8 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, scale: 0.95 }}
                                                        className={`rounded-2xl border p-3.5 shadow-2xs transition bg-white dark:bg-[#0D111A] ${
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
                                                              <span>{fechaObj.hora}</span>
                                                            </span>
                                                          </div>

                                                          <span
                                                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
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
                                                        <div className="mt-2.5 rounded-xl bg-gray-50 dark:bg-[#111726] p-2 text-xs text-gray-600 dark:text-slate-300">
                                                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">
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
                                                        <div className="mt-2.5 flex items-center justify-between border-t border-gray-100 dark:border-slate-800/80 pt-2">
                                                          <div className="flex flex-col">
                                                            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                                              Método:
                                                            </span>
                                                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                                              <span className="text-xs font-bold text-gray-800 dark:text-slate-200">
                                                                {audit.nombreLegible}
                                                              </span>
                                                              {audit.referencia && (
                                                                <span className="rounded-md bg-sky-50 dark:bg-sky-950/60 border border-sky-200 text-sky-800 dark:text-sky-300 px-1.5 py-0.2 text-[10px] font-mono font-bold">
                                                                  #{audit.referencia}
                                                                </span>
                                                              )}
                                                              {t.metodo_pago.includes('[Pago Familiar]') && (
                                                                <span className="rounded-md bg-purple-50 dark:bg-purple-950/60 border border-purple-200 text-purple-800 dark:text-purple-300 px-1.5 py-0.2 text-[10px] font-bold">
                                                                  Familiar
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
                                                        <div className="mt-2.5 flex items-center gap-2">
                                                          <button
                                                            type="button"
                                                            onClick={() => setModalDetalle({ abierto: true, transaccion: t })}
                                                            className="flex-1 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#111726] py-1.5 text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-50 transition active:scale-95 text-center"
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
                                                              className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition active:scale-95 flex items-center gap-1"
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

                                              {/* Vista Tabla Escritorio (>= md) */}
                                              <div className="hidden md:block overflow-hidden rounded-2xl border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#0D111A]">
                                                <table className="w-full text-left text-xs">
                                                  <thead className="border-b border-gray-200/80 dark:border-slate-800 bg-gray-50/70 dark:bg-[#111726] text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                                                    <tr>
                                                      <th className="py-3 pl-4 pr-3">Hora</th>
                                                      <th className="px-3 py-3">Cliente</th>
                                                      <th className="px-3 py-3">Artículos</th>
                                                      <th className="px-3 py-3">Método de Pago</th>
                                                      <th className="px-3 py-3">Total ($ / Bs)</th>
                                                      <th className="px-3 py-3">Estado</th>
                                                      <th className="py-3 pl-3 pr-4 text-right">Acciones</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80">
                                                    {transaccionesPaginadas.map((t) => {
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
                                                          <td className="py-2.5 pl-4 pr-3 whitespace-nowrap font-mono text-gray-600 dark:text-slate-400 font-bold">
                                                            {fechaObj.hora}
                                                          </td>
                                                          <td className="px-3 py-2.5">
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
                                                          <td className="px-3 py-2.5 max-w-[200px]">
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
                                                          <td className="px-3 py-2.5">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                              <span className="font-bold text-gray-800 dark:text-slate-200">
                                                                {audit.nombreLegible}
                                                              </span>
                                                              {audit.referencia && (
                                                                <span className="rounded-md bg-sky-50 dark:bg-sky-950/60 border border-sky-200 text-sky-800 dark:text-sky-300 px-1.5 py-0.5 text-[10px] font-mono font-bold">
                                                                  #{audit.referencia}
                                                                </span>
                                                              )}
                                                              {t.metodo_pago.includes('[Pago Familiar]') && (
                                                                <span className="rounded-md bg-purple-50 dark:bg-purple-950/60 border border-purple-200 text-purple-800 dark:text-purple-300 px-1.5 py-0.5 text-[10px] font-bold">
                                                                  Familiar
                                                                </span>
                                                              )}
                                                            </div>
                                                          </td>
                                                          <td className="px-3 py-2.5 whitespace-nowrap">
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
                                                          <td className="px-3 py-2.5 whitespace-nowrap">
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
                                                          </td>
                                                          <td className="py-2.5 pl-3 pr-4 text-right whitespace-nowrap">
                                                            <div className="flex items-center justify-end gap-1.5">
                                                              <button
                                                                type="button"
                                                                onClick={() => setModalDetalle({ abierto: true, transaccion: t })}
                                                                className="rounded-xl border border-gray-200 dark:border-slate-800 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#141C2E] transition active:scale-95"
                                                              >
                                                                Ticket
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
                                                                  className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-2 py-1 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition active:scale-95 flex items-center gap-1"
                                                                >
                                                                  <RotateCcw className="h-3 w-3" />
                                                                  <span>Anular</span>
                                                                </button>
                                                              )}
                                                            </div>
                                                          </td>
                                                        </tr>
                                                      );
                                                    })}
                                                  </tbody>
                                                </table>
                                              </div>

                                              {/* PAGINACIÓN ADENTRO DE ESTE DÍA (Máximo 20 por página) */}
                                              {gDia.transacciones.length > TAMANO_PAGINA_JERARQUIA && (
                                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-3 shadow-2xs mt-3">
                                                  <div className="text-xs text-gray-500 dark:text-slate-400 text-center sm:text-left">
                                                    Mostrando <span className="font-bold text-gray-900 dark:text-slate-100">{(paginaDia - 1) * TAMANO_PAGINA_JERARQUIA + 1}</span> -{' '}
                                                    <span className="font-bold text-gray-900 dark:text-slate-100">{Math.min(paginaDia * TAMANO_PAGINA_JERARQUIA, gDia.transacciones.length)}</span> de{' '}
                                                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{gDia.transacciones.length}</span> tickets de este día
                                                  </div>

                                                  <div className="flex items-center gap-2 self-center sm:self-auto">
                                                    <button
                                                      type="button"
                                                      disabled={paginaDia <= 1}
                                                      onClick={() => setPaginaDia((p) => Math.max(1, p - 1))}
                                                      className="flex items-center gap-1 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-[#111726] px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition active:scale-95"
                                                    >
                                                      <ChevronLeft className="h-4 w-4" />
                                                      <span>Anterior</span>
                                                    </button>

                                                    <div className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 text-xs font-bold text-gray-700 dark:text-slate-300">
                                                      Página <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{paginaDia}</span> de {totalPaginasDia}
                                                    </div>

                                                    <button
                                                      type="button"
                                                      disabled={paginaDia >= totalPaginasDia}
                                                      onClick={() => setPaginaDia((p) => Math.min(totalPaginasDia, p + 1))}
                                                      className="flex items-center gap-1 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-[#111726] px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition active:scale-95"
                                                    >
                                                      <span>Siguiente</span>
                                                      <ChevronRight className="h-4 w-4" />
                                                    </button>
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* Pestaña: Historial de Liquidaciones y Pagos */
          <div className="space-y-4">
            {/* KPIs de Liquidaciones */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
              <div className="rounded-3xl border border-emerald-200/90 dark:border-emerald-950/60 bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-[#0D111A] p-4 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4 text-emerald-600" />
                  <span>Total Liquidado (USD)</span>
                </span>
                <div className="mt-1 font-mono text-xl sm:text-2xl font-black text-emerald-800 dark:text-emerald-300">
                  {formatUSD(metricasLiquidaciones.totalUsd)}
                </div>
                <span className="text-[10px] text-emerald-600/80 mt-0.5 block">
                  Abonos y deudas saldadas
                </span>
              </div>

              <div className="rounded-3xl border border-sky-200/90 dark:border-sky-950/60 bg-gradient-to-br from-sky-50/60 to-white dark:from-sky-950/20 dark:to-[#0D111A] p-4 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 flex items-center gap-1.5">
                  <Banknote className="h-4 w-4 text-sky-600" />
                  <span>Equivalente en Bolívares</span>
                </span>
                <div className="mt-1 font-mono text-xl sm:text-2xl font-black text-sky-800 dark:text-sky-300">
                  {formatBs(metricasLiquidaciones.totalBs)}
                </div>
                <span className="text-[10px] text-sky-600/80 mt-0.5 block">
                  A tasa oficial BCV ({formatBs(tasaBcv)})
                </span>
              </div>

              <div className="rounded-3xl border border-indigo-200/90 dark:border-indigo-950/60 bg-gradient-to-br from-indigo-50/60 to-white dark:from-indigo-950/20 dark:to-[#0D111A] p-4 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                  <Receipt className="h-4 w-4 text-indigo-600" />
                  <span>Pagos Registrados</span>
                </span>
                <div className="mt-1 font-mono text-xl sm:text-2xl font-black text-indigo-900 dark:text-indigo-300">
                  {metricasLiquidaciones.totalOperaciones}
                </div>
                <span className="text-[10px] text-indigo-600/80 mt-0.5 block">
                  Operaciones auditadas
                </span>
              </div>
            </div>

            {/* Buscador Dinámico de Liquidaciones */}
            <div className="rounded-3xl border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-3 sm:p-4 shadow-2xs">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={busquedaLiquidaciones}
                  onChange={(e) => setBusquedaLiquidaciones(e.target.value)}
                  placeholder="Buscar liquidación por número de referencia (#123456), estudiante o grado..."
                  className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/60 dark:bg-[#111726] py-2.5 pl-10 pr-9 text-xs text-gray-900 dark:text-slate-100 placeholder:text-gray-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-[#111726] focus:outline-none transition"
                />
                {busquedaLiquidaciones && (
                  <button
                    type="button"
                    onClick={() => setBusquedaLiquidaciones('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Lista y Acordeón Jerárquico: Año -> Mes -> Días (1 al 31) -> Liquidaciones Paginadas */}
            {cargandoLiquidaciones ? (
              <div className="rounded-3xl border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-12 text-center shadow-2xs">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-600 dark:text-emerald-400" />
                <p className="mt-3 text-xs font-semibold text-gray-500 dark:text-slate-400">
                  Cargando liquidaciones y pagos de deuda desde Supabase...
                </p>
              </div>
            ) : liquidacionesAgrupadasJerarquia.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-200 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-12 text-center">
                <Receipt className="mx-auto h-10 w-10 text-gray-300 dark:text-slate-600" />
                <h3 className="mt-2 text-sm font-bold text-gray-800 dark:text-slate-200">
                  No se encontraron pagos ni liquidaciones
                </h3>
                <p className="mt-1 text-xs text-gray-400">
                  {busquedaLiquidaciones
                    ? 'No hay registros que coincidan con la búsqueda de referencia o estudiante.'
                    : 'Aún no se han registrado abonos o liquidaciones de cuentas.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {liquidacionesAgrupadasJerarquia.map((gAno) => {
                  const anoAbierto = anoExpandidoLiq === gAno.anoKey;

                  return (
                    <div
                      key={gAno.anoKey}
                      className="overflow-hidden rounded-3xl border border-emerald-200/80 dark:border-slate-800 bg-white dark:bg-[#0D111A] shadow-2xs transition"
                    >
                      {/* NIVEL 1: Div / Botón del AÑO en Liquidaciones */}
                      <button
                        type="button"
                        onClick={() => toggleAnoLiq(gAno.anoKey)}
                        className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:px-5 hover:bg-gray-50/70 dark:hover:bg-[#111726]/60 transition text-left gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60 font-black text-sm">
                            {gAno.anoKey}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h2 className="text-base font-black text-gray-900 dark:text-slate-100">
                                {gAno.etiquetaAno}
                              </h2>
                              <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                                {gAno.totalTransacciones} {gAno.totalTransacciones === 1 ? 'liquidación' : 'liquidaciones'}
                              </span>
                            </div>
                            <span className="text-[11px] text-gray-400 mt-0.5 block">
                              {anoAbierto ? 'Clic para contraer año' : 'Clic para desplegar los meses de este año'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100 dark:border-slate-800">
                          <div className="text-left sm:text-right">
                            <div className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-400">
                              {formatUSD(gAno.totalAnoUsd)}
                            </div>
                            <div className="text-[11px] font-mono text-gray-500 dark:text-slate-400 font-bold">
                              {formatBs(gAno.totalAnoBs)}
                            </div>
                          </div>

                          <div
                            className={`p-2 rounded-xl border border-gray-200/80 dark:border-slate-800 bg-gray-50 dark:bg-[#111726] text-gray-600 dark:text-slate-300 transition-transform ${
                              anoAbierto ? 'rotate-180' : ''
                            }`}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </div>
                        </div>
                      </button>

                      {/* NIVEL 2: Contenedor de MESES en Liquidaciones */}
                      {anoAbierto && (
                        <div className="border-t border-gray-100 dark:border-slate-800/80 p-3 sm:p-4 bg-gray-50/30 dark:bg-[#0a0e17]/30 space-y-3">
                          {gAno.meses.map((gMes) => {
                            const mesAbierto = mesExpandidoLiq === gMes.mesKey;

                            return (
                              <div
                                key={gMes.mesKey}
                                className="overflow-hidden rounded-2xl border border-gray-200/80 dark:border-slate-800/90 bg-white dark:bg-[#0D111A] shadow-2xs transition"
                              >
                                {/* Botón del MES */}
                                <button
                                  type="button"
                                  onClick={() => toggleMesLiq(gMes.mesKey)}
                                  className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:px-4 hover:bg-gray-50/70 dark:hover:bg-[#111726]/60 transition text-left gap-2.5"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-900/40">
                                      <Receipt className="h-4 w-4" />
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">
                                          {gMes.etiquetaMes}
                                        </h3>
                                        <span className="rounded-full bg-teal-50 dark:bg-teal-950/60 border border-teal-200/80 dark:border-teal-800 px-2 py-0.2 text-[10px] font-bold text-teal-700 dark:text-teal-300">
                                          {gMes.totalTransacciones} {gMes.totalTransacciones === 1 ? 'pago' : 'pagos'}
                                        </span>
                                      </div>
                                      <span className="text-[10px] text-gray-400 mt-0.5 block">
                                        {mesAbierto ? 'Clic para contraer mes' : 'Clic para desplegar los días (1 al 31)'}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-1.5 sm:pt-0 border-gray-100 dark:border-slate-800">
                                    <div className="text-left sm:text-right">
                                      <div className="text-sm font-black text-emerald-700 dark:text-emerald-400">
                                        {formatUSD(gMes.totalMesUsd)}
                                      </div>
                                      <div className="text-[10px] font-mono text-gray-500 dark:text-slate-400 font-bold">
                                        {formatBs(gMes.totalMesBs)}
                                      </div>
                                    </div>

                                    <div
                                      className={`p-1.5 rounded-lg border border-gray-200/80 dark:border-slate-800 bg-gray-50 dark:bg-[#111726] text-gray-600 dark:text-slate-300 transition-transform ${
                                        mesAbierto ? 'rotate-180' : ''
                                      }`}
                                    >
                                      <ChevronDown className="h-3.5 w-3.5" />
                                    </div>
                                  </div>
                                </button>

                                {/* NIVEL 3: Contenedor de DÍAS (1 al 31) en Liquidaciones */}
                                {mesAbierto && (
                                  <div className="border-t border-gray-100 dark:border-slate-800/80 p-2.5 sm:p-3 bg-gray-50/50 dark:bg-[#0a0e17]/50 space-y-2.5">
                                    {gMes.dias.map((gDia) => {
                                      const diaAbierto = diaExpandidoLiq === gDia.diaKey;
                                      const totalPaginasDiaLiq = Math.max(1, Math.ceil(gDia.transacciones.length / TAMANO_PAGINA_JERARQUIA));
                                      const liquidacionesPaginadas = gDia.transacciones.slice(
                                        (paginaDiaLiq - 1) * TAMANO_PAGINA_JERARQUIA,
                                        paginaDiaLiq * TAMANO_PAGINA_JERARQUIA
                                      );

                                      return (
                                        <div
                                          key={gDia.diaKey}
                                          className="overflow-hidden rounded-xl border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#0D111A] shadow-2xs transition"
                                        >
                                          {/* Tarjeta del DÍA - Exclusive Accordion */}
                                          <button
                                            type="button"
                                            onClick={() => toggleDiaLiq(gDia.diaKey)}
                                            className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:px-4 hover:bg-gray-50/70 dark:hover:bg-[#111726]/60 transition text-left gap-2.5"
                                          >
                                            <div className="flex items-center gap-2.5">
                                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
                                                <Calendar className="h-4 w-4" />
                                              </div>
                                              <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                  <h4 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-slate-100">
                                                    {gDia.etiquetaDia}
                                                  </h4>
                                                  <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 px-2 py-0.2 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                                    {gDia.totalTransacciones} {gDia.totalTransacciones === 1 ? 'pago' : 'pagos'}
                                                  </span>
                                                </div>
                                                <span className="text-[10px] text-gray-400 mt-0.5 block">
                                                  {diaAbierto ? 'Clic para contraer' : 'Clic para desplegar liquidaciones de este día'}
                                                </span>
                                              </div>
                                            </div>

                                            <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-1.5 sm:pt-0 border-gray-100 dark:border-slate-800">
                                              <div className="text-left sm:text-right">
                                                <div className="text-xs sm:text-sm font-black text-emerald-700 dark:text-emerald-400">
                                                  {formatUSD(gDia.totalDiaUsd)}
                                                </div>
                                                <div className="text-[10px] font-mono text-gray-500 dark:text-slate-400 font-bold">
                                                  {formatBs(gDia.totalDiaBs)}
                                                </div>
                                              </div>

                                              <div
                                                className={`p-1.5 rounded-lg border border-gray-200/80 dark:border-slate-800 bg-gray-50 dark:bg-[#111726] text-gray-600 dark:text-slate-300 transition-transform ${
                                                  diaAbierto ? 'rotate-180' : ''
                                                }`}
                                              >
                                                <ChevronDown className="h-3.5 w-3.5" />
                                              </div>
                                            </div>
                                          </button>

                                          {/* NIVEL 4: Contenido del DÍA abierto en Liquidaciones con paginación interna */}
                                          {diaAbierto && (
                                            <div className="border-t border-gray-100 dark:border-slate-800/80 p-2.5 sm:p-3 bg-gray-50/40 dark:bg-[#0a0e17]/40 space-y-3">
                                              {/* Mobile Cards (< md) */}
                                              <div className="grid grid-cols-1 gap-2.5 md:hidden">
                                                {liquidacionesPaginadas.map((liq) => {
                                                  const audit = parseConsumoAudit({ metodo_pago: liq.metodo_pago, pagado: liq.pagado });
                                                  const fechaObj = formatearFechaHora(liq.fecha);
                                                  const totalBsEquiv = calcularConversionBs(liq.monto_total_usd, liq.tasa_bcv_historica || tasaBcv);

                                                  return (
                                                    <div
                                                      key={liq.id}
                                                      className="rounded-2xl border border-emerald-200/70 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-3.5 shadow-2xs space-y-2.5"
                                                    >
                                                      <div className="flex items-start justify-between gap-2">
                                                        <div>
                                                          <span className="text-xs font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                                                            <User className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                                                            <span>{liq.clientes?.nombre_estudiante || 'Público General / Caja'}</span>
                                                          </span>
                                                          {liq.clientes?.grado_seccion && (
                                                            <span className="text-[11px] text-gray-500 font-medium block ml-5">
                                                              Grado / Sección: {liq.clientes.grado_seccion}
                                                            </span>
                                                          )}
                                                        </div>

                                                        <div className="text-right">
                                                          <div className="font-mono text-base font-black text-emerald-700 dark:text-emerald-400">
                                                            {formatUSD(liq.monto_total_usd)}
                                                          </div>
                                                          <div className="font-mono text-[10px] text-gray-400">
                                                            {formatBs(totalBsEquiv)}
                                                          </div>
                                                        </div>
                                                      </div>

                                                      <div className="rounded-xl bg-gray-50 dark:bg-[#111726] p-2 text-xs flex flex-wrap items-center justify-between gap-2">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                          <span className="font-bold text-gray-700 dark:text-slate-200">
                                                            {audit.nombreLegible}
                                                          </span>
                                                          {audit.referencia && (
                                                            <span className="rounded-md bg-sky-100 dark:bg-sky-950/80 border border-sky-300 text-sky-800 dark:text-sky-300 px-1.5 py-0.2 text-[10px] font-mono font-bold">
                                                              Ref: #{audit.referencia}
                                                            </span>
                                                          )}
                                                          {liq.metodo_pago.includes('[Pago Familiar]') && (
                                                            <span className="rounded-md bg-purple-100 dark:bg-purple-950/80 border border-purple-300 text-purple-800 dark:text-purple-300 px-1.5 py-0.2 text-[10px] font-bold">
                                                              Familiar
                                                            </span>
                                                          )}
                                                        </div>

                                                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                                          <Clock className="h-3 w-3" />
                                                          {fechaObj.hora}
                                                        </span>
                                                      </div>

                                                      <div className="flex justify-end pt-0.5">
                                                        <button
                                                          type="button"
                                                          onClick={() => setModalDetalle({ abierto: true, transaccion: liq })}
                                                          className="w-full rounded-xl border border-gray-200 dark:border-slate-800 py-1.5 text-xs font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-50 transition active:scale-95 text-center"
                                                        >
                                                          Ver Comprobante
                                                        </button>
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>

                                              {/* Desktop Table (>= md) */}
                                              <div className="hidden md:block overflow-hidden rounded-2xl border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#0D111A]">
                                                <table className="w-full text-left text-xs">
                                                  <thead className="border-b border-gray-200/80 dark:border-slate-800 bg-gray-50/70 dark:bg-[#111726] text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                                                    <tr>
                                                      <th className="py-3 pl-4 pr-3">Hora</th>
                                                      <th className="px-3 py-3">Estudiante</th>
                                                      <th className="px-3 py-3">Grado / Sección</th>
                                                      <th className="px-3 py-3">Método / Referencia</th>
                                                      <th className="px-3 py-3">Monto Liquidado</th>
                                                      <th className="py-3 pl-3 pr-4 text-right">Comprobante</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80">
                                                    {liquidacionesPaginadas.map((liq) => {
                                                      const audit = parseConsumoAudit({ metodo_pago: liq.metodo_pago, pagado: liq.pagado });
                                                      const fechaObj = formatearFechaHora(liq.fecha);
                                                      const totalBsEquiv = calcularConversionBs(liq.monto_total_usd, liq.tasa_bcv_historica || tasaBcv);

                                                      return (
                                                        <tr key={liq.id} className="hover:bg-gray-50/70 dark:hover:bg-[#111726]/60 transition">
                                                          <td className="py-2.5 pl-4 pr-3 whitespace-nowrap font-mono text-gray-600 dark:text-slate-400 font-bold">
                                                            {fechaObj.hora}
                                                          </td>

                                                          <td className="px-3 py-2.5">
                                                            <div className="font-bold text-gray-900 dark:text-slate-100">
                                                              {liq.clientes?.nombre_estudiante || 'Público General / Caja'}
                                                            </div>
                                                            {liq.clientes?.nombre_representante && (
                                                              <div className="text-[10px] text-gray-400">
                                                                Rep: {liq.clientes.nombre_representante}
                                                              </div>
                                                            )}
                                                          </td>

                                                          <td className="px-3 py-2.5">
                                                            <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 px-2 py-0.2 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                                                              {liq.clientes?.grado_seccion || 'Sin sección'}
                                                            </span>
                                                          </td>

                                                          <td className="px-3 py-2.5">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                              <span className="font-bold text-gray-800 dark:text-slate-200">
                                                                {audit.nombreLegible}
                                                              </span>
                                                              {audit.referencia && (
                                                                <span className="rounded-md bg-sky-100 dark:bg-sky-950/80 border border-sky-300 text-sky-800 dark:text-sky-300 px-1.5 py-0.2 text-[10px] font-mono font-bold">
                                                                  Ref: #{audit.referencia}
                                                                </span>
                                                              )}
                                                              {liq.metodo_pago.includes('[Pago Familiar]') && (
                                                                <span className="rounded-md bg-purple-100 dark:bg-purple-950/80 border border-purple-300 text-purple-800 dark:text-purple-300 px-1.5 py-0.2 text-[10px] font-bold">
                                                                  Familiar
                                                                </span>
                                                              )}
                                                            </div>
                                                          </td>

                                                          <td className="px-3 py-2.5 whitespace-nowrap">
                                                            <div className="font-mono font-black text-sm text-emerald-700 dark:text-emerald-400">
                                                              {formatUSD(liq.monto_total_usd)}
                                                            </div>
                                                            <div className="font-mono text-[10px] text-gray-400">
                                                              {formatBs(totalBsEquiv)}
                                                            </div>
                                                          </td>

                                                          <td className="py-2.5 pl-3 pr-4 text-right whitespace-nowrap">
                                                            <button
                                                              type="button"
                                                              onClick={() => setModalDetalle({ abierto: true, transaccion: liq })}
                                                              className="rounded-xl border border-gray-200 dark:border-slate-800 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#141C2E] transition active:scale-95"
                                                            >
                                                              Ver Detalle
                                                            </button>
                                                          </td>
                                                        </tr>
                                                      );
                                                    })}
                                                  </tbody>
                                                </table>
                                              </div>

                                              {/* PAGINACIÓN ADENTRO DE ESTE DÍA EN LIQUIDACIONES (Máximo 20 por página) */}
                                              {gDia.transacciones.length > TAMANO_PAGINA_JERARQUIA && (
                                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-3 shadow-2xs mt-3">
                                                  <div className="text-xs text-gray-500 dark:text-slate-400 text-center sm:text-left">
                                                    Mostrando <span className="font-bold text-gray-900 dark:text-slate-100">{(paginaDiaLiq - 1) * TAMANO_PAGINA_JERARQUIA + 1}</span> -{' '}
                                                    <span className="font-bold text-gray-900 dark:text-slate-100">{Math.min(paginaDiaLiq * TAMANO_PAGINA_JERARQUIA, gDia.transacciones.length)}</span> de{' '}
                                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{gDia.transacciones.length}</span> pagos de este día
                                                  </div>

                                                  <div className="flex items-center gap-2 self-center sm:self-auto">
                                                    <button
                                                      type="button"
                                                      disabled={paginaDiaLiq <= 1}
                                                      onClick={() => setPaginaDiaLiq((p) => Math.max(1, p - 1))}
                                                      className="flex items-center gap-1 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-[#111726] px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition active:scale-95"
                                                    >
                                                      <ChevronLeft className="h-4 w-4" />
                                                      <span>Anterior</span>
                                                    </button>

                                                    <div className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 text-xs font-bold text-gray-700 dark:text-slate-300">
                                                      Página <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{paginaDiaLiq}</span> de {totalPaginasDiaLiq}
                                                    </div>

                                                    <button
                                                      type="button"
                                                      disabled={paginaDiaLiq >= totalPaginasDiaLiq}
                                                      onClick={() => setPaginaDiaLiq((p) => Math.min(totalPaginasDiaLiq, p + 1))}
                                                      className="flex items-center gap-1 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-[#111726] px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition active:scale-95"
                                                    >
                                                      <span>Siguiente</span>
                                                      <ChevronRight className="h-4 w-4" />
                                                    </button>
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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
  </ErrorBoundary>
  );
}
