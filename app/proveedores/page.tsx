'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Phone,
  Tag,
  FileText,
  ChevronRight,
  ChevronDown,
  Building2,
  User,
  Check,
  Users,
  Copy,
  ExternalLink,
  Smartphone,
  CreditCard,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { obtenerTasaBCV, TASA_BCV_FALLBACK_DEFAULT } from '@/lib/dolarApi';
import { formatUSD, formatBs, calcularConversionBs } from '@/lib/utils';
import { Proveedor, ProveedorCuenta } from '@/types/pos';
import { NotificationBell } from '@/components/NotificationBell';
import { useSidebar } from '@/components/SidebarContext';
import { useModalDragScroll } from '@/lib/useModalDragScroll';
import { useRouter } from 'next/navigation';
import { ejecutarMiniRecarga, EVENTO_MINI_RECARGA } from '@/lib/syncUtils';
import { normalizarTelefonoWhatsApp } from '@/lib/constants';

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

// Bancos comunes de Venezuela para Pago Móvil
const BANCOS_VENEZUELA = [
  '0102 - Banco de Venezuela',
  '0108 - Provincial (BBVA)',
  '0105 - Mercantil',
  '0134 - Banesco',
  '0114 - Bancamiga',
  '0172 - Bancaribe',
  '0163 - Banco del Tesoro',
  '0115 - Banco Exterior',
  '0175 - Banco Bicentenario',
  '0191 - BNC (Banco Nacional de Crédito)',
  '0174 - Banplus',
  '0169 - Mi Banco',
  '0151 - BFC (Banco Fondo Común)',
  '0138 - Banco Plaza',
  '0104 - Venezolano de Crédito',
  '0128 - Banco Caroní',
  '0137 - Banco Sofitasa',
];

// Categorías predefinidas comunes para proveedores de cantina
const CATEGORIAS_PROVEEDORES = [
  'Galletas y Snacks',
  'Bebidas y Refrescos',
  'Panadería y Pastelería',
  'Helados y Lácteos',
  'Empanadas y Desayunos',
  'Golosinas y Dulces',
  'Desechables y Limpieza',
  'Víveres Generales',
  'Varios',
];

// Helper: Cálculo de tiempo exacto y días restantes de vencimiento por factura
export interface InfoVencimiento {
  estado: 'pagado' | 'vencida' | 'hoy' | 'proxima' | 'al_dia';
  diffDays: number;
  diasAbsolutos: number;
  etiqueta: string;
  badgeClass: string;
  colorTema: 'emerald' | 'rose' | 'amber' | 'indigo';
}

export function calcularDetalleVencimiento(fechaVencimientoStr: string, pagado: boolean): InfoVencimiento {
  if (pagado) {
    return {
      estado: 'pagado',
      diffDays: 0,
      diasAbsolutos: 0,
      etiqueta: '🟢 Liquidada',
      badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-300',
      colorTema: 'emerald',
    };
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const [y, m, d] = fechaVencimientoStr.split('-').map(Number);
  const venc = new Date(y, (m || 1) - 1, d || 1);
  venc.setHours(0, 0, 0, 0);

  const diffTime = venc.getTime() - hoy.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const diasAbsolutos = Math.abs(diffDays);

  if (diffDays < 0) {
    return {
      estado: 'vencida',
      diffDays,
      diasAbsolutos,
      etiqueta: `🔴 Vencida hace ${diasAbsolutos} ${diasAbsolutos === 1 ? 'día' : 'días'}`,
      badgeClass: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/80 dark:bg-rose-950/70 dark:text-rose-200 animate-pulse',
      colorTema: 'rose',
    };
  } else if (diffDays === 0) {
    return {
      estado: 'hoy',
      diffDays: 0,
      diasAbsolutos: 0,
      etiqueta: '🟡 Vence hoy',
      badgeClass: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/80 dark:bg-amber-950/70 dark:text-amber-200 font-black',
      colorTema: 'amber',
    };
  } else if (diffDays === 1) {
    return {
      estado: 'proxima',
      diffDays: 1,
      diasAbsolutos: 1,
      etiqueta: '🟡 Vence en 1 día',
      badgeClass: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/80 dark:bg-amber-950/70 dark:text-amber-200',
      colorTema: 'amber',
    };
  } else if (diffDays <= 3) {
    return {
      estado: 'proxima',
      diffDays,
      diasAbsolutos,
      etiqueta: `🟡 Vence en ${diffDays} días`,
      badgeClass: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/80 dark:bg-amber-950/70 dark:text-amber-200',
      colorTema: 'amber',
    };
  } else {
    return {
      estado: 'al_dia',
      diffDays,
      diasAbsolutos,
      etiqueta: `🟢 Vence en ${diffDays} días`,
      badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-300',
      colorTema: 'emerald',
    };
  }
}

// Estructura consolidada por proveedor
interface ProveedorConsolidado {
  id: string;
  nombre: string;
  telefono: string;
  categoria: string;
  notas: string;
  banco: string;
  telefono_pagomovil: string;
  cedula_rif: string;
  isDbRecord: boolean;
  totalPendienteUsd: number;
  totalPendienteBs: number;
  totalPagadoUsd: number;
  totalFacturas: number;
  facturasPendientes: number;
  facturasPagadas: number;
  facturasVencidas: number;
  facturasProximas: number;
  maxDiasVencida: number;
  minDiasRestantes: number | null;
  etiquetaVencimientoConsolidada: string;
  badgeClassConsolidada: string;
  estadoGeneral: 'vencido' | 'proximo' | 'al_dia' | 'solvente';
  cuentas: ProveedorCuenta[];
}

export default function ProveedoresPage() {
  const router = useRouter();
  const [montado, setMontado] = useState(false);
  const { toggleSidebar, abierto: sidebarAbierto } = useSidebar();

  // 1. Tasa BCV
  const [tasaBcv, setTasaBcv] = useState<number>(TASA_BCV_FALLBACK_DEFAULT);
  const [cargandoTasa, setCargandoTasa] = useState<boolean>(true);

  // 2. Datos de Supabase
  const [proveedoresDb, setProveedoresDb] = useState<Proveedor[]>([]);
  const [cargandoProveedores, setCargandoProveedores] = useState<boolean>(true);
  const [tablaProveedoresExiste, setTablaProveedoresExiste] = useState<boolean>(true);

  const [cuentas, setCuentas] = useState<ProveedorCuenta[]>([]);
  const [cargandoCuentas, setCargandoCuentas] = useState<boolean>(true);

  // 3. Vista y Filtros
  const [vistaActiva, setVistaActiva] = useState<'proveedores' | 'facturas'>('proveedores');
  const [busqueda, setBusqueda] = useState<string>('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'pendientes' | 'pagados' | 'vencidos'>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas');

  // Estado del Acordeón Desplegable (IDs de proveedores expandidos)
  const [proveedoresExpandidos, setProveedoresExpandidos] = useState<Set<string>>(new Set());

  const toggleExpandido = (id: string) => {
    setProveedoresExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandirTodos = () => {
    setProveedoresExpandidos(new Set(proveedoresConsolidados.map((p) => p.id)));
  };

  const colapsarTodos = () => {
    setProveedoresExpandidos(new Set());
  };

  // 4. Notificaciones Toast
  const [notificacion, setNotificacion] = useState<{
    tipo: 'exito' | 'info' | 'error';
    texto: string;
  } | null>(null);

  const mostrarNotificacion = useCallback((tipo: 'exito' | 'info' | 'error', texto: string) => {
    setNotificacion({ tipo, texto });
    setTimeout(() => setNotificacion(null), 4000);
  }, []);

  // 5. Modales
  // Modal Crear / Editar Factura (Registro de Compras / Notas de Entrega)
  const [modalForm, setModalForm] = useState<{
    abierto: boolean;
    modo: 'crear' | 'editar';
    id?: string;
    proveedor_id: string;
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
    proveedor_id: '',
    nombre_proveedor: '',
    concepto_mercancia: '',
    monto_usd: '',
    fecha_recepcion: obtenerFechaHoy(),
    fecha_vencimiento_pago: sumarDias(7),
    guardando: false,
    error: null,
  });

  // Selector desplegable de proveedores en el formulario
  const [selectorAbierto, setSelectorAbierto] = useState<boolean>(false);
  const [selectorBusqueda, setSelectorBusqueda] = useState<string>('');
  const selectorRef = useRef<HTMLDivElement | null>(null);

  // Modal rápido de "Crear Nuevo Proveedor" desde el selector de compras
  const [modalNuevoProveedorRapido, setModalNuevoProveedorRapido] = useState<{
    abierto: boolean;
    nombre: string;
    telefono: string;
    categoria: string;
    notas: string;
    banco: string;
    telefono_pagomovil: string;
    cedula_rif: string;
    guardando: boolean;
    error: string | null;
  }>({
    abierto: false,
    nombre: '',
    telefono: '',
    categoria: '',
    notas: '',
    banco: '',
    telefono_pagomovil: '',
    cedula_rif: '',
    guardando: false,
    error: null,
  });

  // Modal CRUD General de Proveedor (Crear / Editar)
  const [modalProveedorCrud, setModalProveedorCrud] = useState<{
    abierto: boolean;
    modo: 'crear' | 'editar';
    id?: string;
    nombreOriginal?: string;
    nombre: string;
    telefono: string;
    categoria: string;
    notas: string;
    banco: string;
    telefono_pagomovil: string;
    cedula_rif: string;
    guardando: boolean;
    error: string | null;
  }>({
    abierto: false,
    modo: 'crear',
    nombre: '',
    telefono: '',
    categoria: '',
    notas: '',
    banco: '',
    telefono_pagomovil: '',
    cedula_rif: '',
    guardando: false,
    error: null,
  });

  // Modal Eliminar Proveedor
  const [modalEliminarProveedor, setModalEliminarProveedor] = useState<{
    abierto: boolean;
    proveedor: ProveedorConsolidado | null;
    eliminando: boolean;
    error: string | null;
  }>({
    abierto: false,
    proveedor: null,
    eliminando: false,
    error: null,
  });

  // Modal Liquidar / Pagar Factura Individual
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

  // Modal Liquidar Total de un Proveedor
  const [modalLiquidarTotal, setModalLiquidarTotal] = useState<{
    abierto: boolean;
    proveedor: ProveedorConsolidado | null;
    procesando: boolean;
    error: string | null;
  }>({
    abierto: false,
    proveedor: null,
    procesando: false,
    error: null,
  });

  // Modal Eliminar Factura
  const [modalEliminarFactura, setModalEliminarFactura] = useState<{
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

  // Cerrar selector al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setSelectorAbierto(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

  // Drag Scroll Hooks para modales
  const dragScrollProveedor = useModalDragScroll({
    isOpen: modalForm.abierto,
    onDismiss: () => setModalForm((prev) => ({ ...prev, abierto: false })),
  });

  const dragScrollLiquidar = useModalDragScroll({
    isOpen: modalLiquidar.abierto,
    onDismiss: () => setModalLiquidar((prev) => ({ ...prev, abierto: false })),
  });

  const dragScrollLiquidarTotal = useModalDragScroll({
    isOpen: modalLiquidarTotal.abierto,
    onDismiss: () => setModalLiquidarTotal((prev) => ({ ...prev, abierto: false })),
  });

  const dragScrollEliminar = useModalDragScroll({
    isOpen: modalEliminarFactura.abierto,
    onDismiss: () => setModalEliminarFactura((prev) => ({ ...prev, abierto: false })),
  });

  const dragScrollCrudProveedor = useModalDragScroll({
    isOpen: modalProveedorCrud.abierto,
    onDismiss: () => setModalProveedorCrud((prev) => ({ ...prev, abierto: false })),
  });

  const dragScrollEliminarProveedor = useModalDragScroll({
    isOpen: modalEliminarProveedor.abierto,
    onDismiss: () => setModalEliminarProveedor((prev) => ({ ...prev, abierto: false })),
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

  // 8. Cargar Proveedores Registrados desde la tabla 'proveedores'
  const cargarProveedores = useCallback(async () => {
    setCargandoProveedores(true);
    try {
      const { data, error } = await supabase
        .from('proveedores')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) {
        if (error.message?.includes('does not exist') || error.code === '42P01') {
          setTablaProveedoresExiste(false);
          setProveedoresDb([]);
          return;
        }
        throw error;
      }

      setTablaProveedoresExiste(true);
      setProveedoresDb((data as Proveedor[]) || []);
    } catch (err: any) {
      console.warn('Tabla proveedores no accesible o pendiente de migración:', err?.message);
      setTablaProveedoresExiste(false);
    } finally {
      setCargandoProveedores(false);
    }
  }, []);

  useEffect(() => {
    setMontado(true);
    cargarTasa();
    cargarCuentas();
    cargarProveedores();

    const canalRealtimeCuentas = supabase
      .channel('proveedores_cuentas_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proveedores_cuentas' }, () => {
        cargarCuentas();
      })
      .subscribe();

    const canalRealtimeProveedores = supabase
      .channel('proveedores_db_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proveedores' }, () => {
        cargarProveedores();
      })
      .subscribe();

    const handleMiniRecarga = () => {
      cargarCuentas();
      cargarProveedores();
    };
    window.addEventListener(EVENTO_MINI_RECARGA, handleMiniRecarga);

    return () => {
      supabase.removeChannel(canalRealtimeCuentas);
      supabase.removeChannel(canalRealtimeProveedores);
      window.removeEventListener(EVENTO_MINI_RECARGA, handleMiniRecarga);
    };
  }, [cargarTasa, cargarCuentas, cargarProveedores]);

  // Consolidación de Proveedores (DB + Cuentas Históricas) con cálculo exacto de días de vencimiento
  const proveedoresConsolidados = useMemo<ProveedorConsolidado[]>(() => {
    const mapa = new Map<string, ProveedorConsolidado>();

    proveedoresDb.forEach((p) => {
      const clave = p.nombre.trim().toLowerCase();
      mapa.set(clave, {
        id: p.id,
        nombre: p.nombre.trim(),
        telefono: p.telefono || '',
        categoria: p.categoria || 'Varios',
        notas: p.notas || '',
        banco: p.banco || '',
        telefono_pagomovil: p.telefono_pagomovil || '',
        cedula_rif: p.cedula_rif || '',
        isDbRecord: true,
        totalPendienteUsd: 0,
        totalPendienteBs: 0,
        totalPagadoUsd: 0,
        totalFacturas: 0,
        facturasPendientes: 0,
        facturasPagadas: 0,
        facturasVencidas: 0,
        facturasProximas: 0,
        maxDiasVencida: 0,
        minDiasRestantes: null,
        etiquetaVencimientoConsolidada: '🟢 Solvente',
        badgeClassConsolidada: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-300',
        estadoGeneral: 'solvente',
        cuentas: [],
      });
    });

    cuentas.forEach((c) => {
      const nombreLimpio = (c.nombre_proveedor || 'Sin Nombre').trim();
      const clave = nombreLimpio.toLowerCase();

      if (!mapa.has(clave)) {
        mapa.set(clave, {
          id: c.proveedor_id || `sintetico-${clave}`,
          nombre: nombreLimpio,
          telefono: '',
          categoria: 'Varios',
          notas: '',
          banco: '',
          telefono_pagomovil: '',
          cedula_rif: '',
          isDbRecord: false,
          totalPendienteUsd: 0,
          totalPendienteBs: 0,
          totalPagadoUsd: 0,
          totalFacturas: 0,
          facturasPendientes: 0,
          facturasPagadas: 0,
          facturasVencidas: 0,
          facturasProximas: 0,
          maxDiasVencida: 0,
          minDiasRestantes: null,
          etiquetaVencimientoConsolidada: '🟢 Solvente',
          badgeClassConsolidada: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-300',
          estadoGeneral: 'solvente',
          cuentas: [],
        });
      }

      const p = mapa.get(clave)!;
      p.cuentas.push(c);
      p.totalFacturas++;

      const monto = Number(c.monto_usd || 0);
      if (c.pagado) {
        p.facturasPagadas++;
        p.totalPagadoUsd += monto;
      } else {
        p.facturasPendientes++;
        p.totalPendienteUsd += monto;

        const infoV = calcularDetalleVencimiento(c.fecha_vencimiento_pago, false);
        if (infoV.estado === 'vencida') {
          p.facturasVencidas++;
          if (infoV.diasAbsolutos > p.maxDiasVencida) {
            p.maxDiasVencida = infoV.diasAbsolutos;
          }
        } else {
          if (infoV.estado === 'hoy' || infoV.estado === 'proxima') {
            p.facturasProximas++;
          }
          if (p.minDiasRestantes === null || infoV.diffDays < p.minDiasRestantes) {
            p.minDiasRestantes = infoV.diffDays;
          }
        }
      }
    });

    const lista = Array.from(mapa.values()).map((p) => {
      p.totalPendienteBs = calcularConversionBs(p.totalPendienteUsd, tasaBcv);

      p.cuentas.sort((a, b) => {
        if (a.pagado !== b.pagado) return a.pagado ? 1 : -1;
        return a.fecha_vencimiento_pago.localeCompare(b.fecha_vencimiento_pago);
      });

      // Cálculo del Contador de Días de Vencimiento Consolidado
      if (p.totalPendienteUsd === 0) {
        p.estadoGeneral = 'solvente';
        p.etiquetaVencimientoConsolidada = '🟢 Solvente';
        p.badgeClassConsolidada =
          'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200';
      } else if (p.facturasVencidas > 0) {
        p.estadoGeneral = 'vencido';
        const d = p.maxDiasVencida;
        p.etiquetaVencimientoConsolidada = `🔴 Vencida hace ${d} ${d === 1 ? 'día' : 'días'}`;
        p.badgeClassConsolidada =
          'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200 animate-pulse';
      } else if (p.minDiasRestantes !== null) {
        const d = p.minDiasRestantes;
        if (d === 0) {
          p.estadoGeneral = 'proximo';
          p.etiquetaVencimientoConsolidada = '🟡 Vence hoy';
          p.badgeClassConsolidada =
            'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200 font-black';
        } else if (d === 1) {
          p.estadoGeneral = 'proximo';
          p.etiquetaVencimientoConsolidada = '🟡 Vence en 1 día';
          p.badgeClassConsolidada =
            'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200';
        } else if (d <= 3) {
          p.estadoGeneral = 'proximo';
          p.etiquetaVencimientoConsolidada = `🟡 Vence en ${d} días`;
          p.badgeClassConsolidada =
            'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200';
        } else {
          p.estadoGeneral = 'al_dia';
          p.etiquetaVencimientoConsolidada = `🟢 Vence en ${d} días`;
          p.badgeClassConsolidada =
            'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300';
        }
      }

      return p;
    });

    lista.sort((a, b) => {
      if (a.facturasVencidas !== b.facturasVencidas) {
        return b.facturasVencidas - a.facturasVencidas;
      }
      if (b.totalPendienteUsd !== a.totalPendienteUsd) {
        return b.totalPendienteUsd - a.totalPendienteUsd;
      }
      return a.nombre.localeCompare(b.nombre);
    });

    return lista;
  }, [proveedoresDb, cuentas, tasaBcv]);

  // Copiar Pago Móvil al portapapeles
  const handleCopiarPagoMovil = (p: ProveedorConsolidado, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const lineas: string[] = [];
    if (p.banco) lineas.push(`Banco: ${p.banco}`);
    if (p.telefono_pagomovil) lineas.push(`Teléfono: ${p.telefono_pagomovil}`);
    if (p.cedula_rif) lineas.push(`Cédula/RIF: ${p.cedula_rif}`);
    lineas.push(`Beneficiario: ${p.nombre}`);

    const texto = lineas.join('\n');
    navigator.clipboard.writeText(texto);
    mostrarNotificacion('exito', `¡Datos de Pago Móvil de "${p.nombre}" copiados al portapapeles!`);
  };

  // Lista de proveedores filtrados
  const proveedoresFiltrados = useMemo(() => {
    let lista = [...proveedoresConsolidados];

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      lista = lista.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          p.categoria.toLowerCase().includes(q) ||
          p.telefono.includes(q) ||
          p.telefono_pagomovil.includes(q) ||
          p.cedula_rif.toLowerCase().includes(q) ||
          p.banco.toLowerCase().includes(q) ||
          p.notas.toLowerCase().includes(q)
      );
    }

    if (filtroCategoria !== 'todas') {
      lista = lista.filter((p) => p.categoria.toLowerCase() === filtroCategoria.toLowerCase());
    }

    if (filtroEstado === 'pendientes') {
      lista = lista.filter((p) => p.totalPendienteUsd > 0);
    } else if (filtroEstado === 'pagados') {
      lista = lista.filter((p) => p.totalPendienteUsd === 0);
    } else if (filtroEstado === 'vencidos') {
      lista = lista.filter((p) => p.facturasVencidas > 0);
    }

    return lista;
  }, [proveedoresConsolidados, busqueda, filtroCategoria, filtroEstado]);

  // Métricas Globales
  const metricas = useMemo(() => {
    let totalPendienteUsd = 0;
    let totalPagadoUsd = 0;
    let facturasPendientes = 0;
    let facturasPagadas = 0;
    let facturasVencidas = 0;
    let facturasProximas = 0;
    let proveedoresConDeuda = 0;

    proveedoresConsolidados.forEach((p) => {
      totalPendienteUsd += p.totalPendienteUsd;
      totalPagadoUsd += p.totalPagadoUsd;
      facturasPendientes += p.facturasPendientes;
      facturasPagadas += p.facturasPagadas;
      facturasVencidas += p.facturasVencidas;
      facturasProximas += p.facturasProximas;
      if (p.totalPendienteUsd > 0) proveedoresConDeuda++;
    });

    const totalPendienteBs = calcularConversionBs(totalPendienteUsd, tasaBcv);
    const totalPagadoBs = calcularConversionBs(totalPagadoUsd, tasaBcv);

    return {
      totalProveedores: proveedoresConsolidados.length,
      proveedoresConDeuda,
      totalFacturas: cuentas.length,
      facturasPendientes,
      facturasPagadas,
      facturasVencidas,
      facturasProximas,
      totalPendienteUsd,
      totalPendienteBs,
      totalPagadoUsd,
      totalPagadoBs,
    };
  }, [proveedoresConsolidados, cuentas, tasaBcv]);

  // Facturas individuales filtradas
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
        const v = calcularDetalleVencimiento(c.fecha_vencimiento_pago, false);
        return v.estado === 'vencida' || v.estado === 'hoy';
      });
    }

    return lista;
  }, [cuentas, busqueda, filtroEstado]);

  // Proveedores en Selector de Compra
  const proveedoresParaSelector = useMemo(() => {
    if (!selectorBusqueda.trim()) return proveedoresConsolidados;
    const q = selectorBusqueda.toLowerCase().trim();
    return proveedoresConsolidados.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.categoria.toLowerCase().includes(q) ||
        p.telefono.includes(q)
    );
  }, [proveedoresConsolidados, selectorBusqueda]);

  // Handlers para el Formulario de Registro de Factura
  const handleAbrirCrear = (proveedorPreseleccionado?: ProveedorConsolidado) => {
    setModalForm({
      abierto: true,
      modo: 'crear',
      proveedor_id: proveedorPreseleccionado ? (proveedorPreseleccionado.isDbRecord ? proveedorPreseleccionado.id : '') : '',
      nombre_proveedor: proveedorPreseleccionado ? proveedorPreseleccionado.nombre : '',
      concepto_mercancia: '',
      monto_usd: '',
      fecha_recepcion: obtenerFechaHoy(),
      fecha_vencimiento_pago: sumarDias(7),
      guardando: false,
      error: null,
    });
    setSelectorBusqueda('');
    setSelectorAbierto(false);
  };

  const handleAbrirEditar = (cuenta: ProveedorCuenta) => {
    setModalForm({
      abierto: true,
      modo: 'editar',
      id: cuenta.id,
      proveedor_id: cuenta.proveedor_id || '',
      nombre_proveedor: cuenta.nombre_proveedor,
      concepto_mercancia: cuenta.concepto_mercancia,
      monto_usd: cuenta.monto_usd.toString(),
      fecha_recepcion: cuenta.fecha_recepcion || obtenerFechaHoy(),
      fecha_vencimiento_pago: cuenta.fecha_vencimiento_pago || sumarDias(7),
      guardando: false,
      error: null,
    });
    setSelectorBusqueda('');
    setSelectorAbierto(false);
  };

  const handleGuardarForm = async (e: React.FormEvent) => {
    e.preventDefault();

    const prov = modalForm.nombre_proveedor.trim();
    const conc = modalForm.concepto_mercancia.trim();
    const monto = parseFloat(modalForm.monto_usd);

    if (!prov) {
      setModalForm((prev) => ({ ...prev, error: 'Por favor selecciona o indica el nombre del proveedor.' }));
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
            'La fecha límite de pago no puede ser anterior a la fecha de recepción de la mercancía.',
        }));
        return;
      }
    }

    setModalForm((prev) => ({ ...prev, guardando: true, error: null }));

    try {
      let provId = modalForm.proveedor_id;
      if (!provId && tablaProveedoresExiste) {
        const existente = proveedoresDb.find(
          (p) => p.nombre.toLowerCase().trim() === prov.toLowerCase().trim()
        );
        if (existente) {
          provId = existente.id;
        } else {
          const { data: nuevoP, error: errorP } = await supabase
            .from('proveedores')
            .insert({ nombre: prov })
            .select('id')
            .maybeSingle();

          if (!errorP && nuevoP) {
            provId = nuevoP.id;
            await cargarProveedores();
          }
        }
      }

      const payloadBase: any = {
        nombre_proveedor: prov,
        concepto_mercancia: conc,
        monto_usd: monto,
        fecha_recepcion: modalForm.fecha_recepcion || obtenerFechaHoy(),
        fecha_vencimiento_pago: modalForm.fecha_vencimiento_pago,
      };

      if (provId) {
        payloadBase.proveedor_id = provId;
      }

      if (modalForm.modo === 'crear') {
        payloadBase.pagado = false;

        let insertError = null;
        const res1 = await supabase.from('proveedores_cuentas').insert(payloadBase);
        insertError = res1.error;

        if (insertError && insertError.message?.includes('column "proveedor_id" of relation')) {
          delete payloadBase.proveedor_id;
          const res2 = await supabase.from('proveedores_cuentas').insert(payloadBase);
          insertError = res2.error;
        }

        if (insertError) throw insertError;
        mostrarNotificacion('exito', `Factura de "${prov}" registrada correctamente.`);
      } else {
        let updateError = null;
        const res1 = await supabase
          .from('proveedores_cuentas')
          .update(payloadBase)
          .eq('id', modalForm.id!);
        updateError = res1.error;

        if (updateError && updateError.message?.includes('column "proveedor_id" of relation')) {
          delete payloadBase.proveedor_id;
          const res2 = await supabase
            .from('proveedores_cuentas')
            .update(payloadBase)
            .eq('id', modalForm.id!);
          updateError = res2.error;
        }

        if (updateError) throw updateError;
        mostrarNotificacion('exito', `Factura de "${prov}" actualizada correctamente.`);
      }

      setModalForm((prev) => ({ ...prev, abierto: false, guardando: false }));
      await ejecutarMiniRecarga({
        router,
        recargarDatosLocales: async () => {
          await cargarCuentas();
          await cargarProveedores();
        },
        mensaje: modalForm.modo === 'crear' ? 'Factura guardada y sincronizada' : 'Factura actualizada y sincronizada',
      });
    } catch (err: any) {
      console.error('Error al guardar factura:', err);
      setModalForm((prev) => ({
        ...prev,
        guardando: false,
        error: err.message || 'Error al guardar la factura en Supabase.',
      }));
    }
  };

  // Guardar Nuevo Proveedor Rápido desde el Selector con Datos de Pago Móvil
  const handleGuardarNuevoProveedorRapido = async (e: React.FormEvent) => {
    e.preventDefault();
    const nombre = modalNuevoProveedorRapido.nombre.trim();
    if (!nombre) {
      setModalNuevoProveedorRapido((prev) => ({
        ...prev,
        error: 'El nombre del proveedor es obligatorio.',
      }));
      return;
    }

    setModalNuevoProveedorRapido((prev) => ({ ...prev, guardando: true, error: null }));

    try {
      let nuevoId = '';

      if (tablaProveedoresExiste) {
        const payloadProv: any = {
          nombre,
          telefono: modalNuevoProveedorRapido.telefono.trim() || null,
          categoria: modalNuevoProveedorRapido.categoria.trim() || 'Varios',
          notas: modalNuevoProveedorRapido.notas.trim() || null,
          banco: modalNuevoProveedorRapido.banco.trim() || null,
          telefono_pagomovil: modalNuevoProveedorRapido.telefono_pagomovil.trim() || null,
          cedula_rif: modalNuevoProveedorRapido.cedula_rif.trim() || null,
        };

        const { data, error } = await supabase
          .from('proveedores')
          .insert(payloadProv)
          .select('id')
          .single();

        // Fallback si las columnas de banco no han sido corridas en SQL
        if (error && error.message?.includes('column "banco" of relation')) {
          delete payloadProv.banco;
          delete payloadProv.telefono_pagomovil;
          delete payloadProv.cedula_rif;
          const retry = await supabase.from('proveedores').insert(payloadProv).select('id').single();
          if (retry.error) throw retry.error;
          if (retry.data) nuevoId = retry.data.id;
        } else if (error) {
          throw error;
        } else if (data) {
          nuevoId = data.id;
        }

        await cargarProveedores();
      } else {
        nuevoId = `temp-${Date.now()}`;
      }

      setModalForm((prev) => ({
        ...prev,
        proveedor_id: nuevoId,
        nombre_proveedor: nombre,
      }));

      mostrarNotificacion('exito', `Proveedor "${nombre}" creado y seleccionado.`);
      setModalNuevoProveedorRapido({
        abierto: false,
        nombre: '',
        telefono: '',
        categoria: '',
        notas: '',
        banco: '',
        telefono_pagomovil: '',
        cedula_rif: '',
        guardando: false,
        error: null,
      });
      setSelectorAbierto(false);
    } catch (err: any) {
      console.error('Error al crear proveedor rápido:', err);
      setModalNuevoProveedorRapido((prev) => ({
        ...prev,
        guardando: false,
        error: err.message || 'Error al guardar proveedor.',
      }));
    }
  };

  // CRUD General de Proveedores (Crear / Editar con Pago Móvil)
  const handleAbrirCrearProveedor = () => {
    setModalProveedorCrud({
      abierto: true,
      modo: 'crear',
      nombre: '',
      telefono: '',
      categoria: '',
      notas: '',
      banco: '',
      telefono_pagomovil: '',
      cedula_rif: '',
      guardando: false,
      error: null,
    });
  };

  const handleAbrirEditarProveedor = (p: ProveedorConsolidado, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setModalProveedorCrud({
      abierto: true,
      modo: 'editar',
      id: p.isDbRecord ? p.id : undefined,
      nombreOriginal: p.nombre,
      nombre: p.nombre,
      telefono: p.telefono,
      categoria: p.categoria,
      notas: p.notas,
      banco: p.banco,
      telefono_pagomovil: p.telefono_pagomovil,
      cedula_rif: p.cedula_rif,
      guardando: false,
      error: null,
    });
  };

  const handleGuardarProveedorCrud = async (e: React.FormEvent) => {
    e.preventDefault();
    const nombre = modalProveedorCrud.nombre.trim();
    if (!nombre) {
      setModalProveedorCrud((prev) => ({ ...prev, error: 'El nombre es obligatorio.' }));
      return;
    }

    setModalProveedorCrud((prev) => ({ ...prev, guardando: true, error: null }));

    try {
      const payload: any = {
        nombre,
        telefono: modalProveedorCrud.telefono.trim() || null,
        categoria: modalProveedorCrud.categoria.trim() || 'Varios',
        notas: modalProveedorCrud.notas.trim() || null,
        banco: modalProveedorCrud.banco.trim() || null,
        telefono_pagomovil: modalProveedorCrud.telefono_pagomovil.trim() || null,
        cedula_rif: modalProveedorCrud.cedula_rif.trim() || null,
      };

      if (modalProveedorCrud.modo === 'crear') {
        if (tablaProveedoresExiste) {
          const { error } = await supabase.from('proveedores').insert(payload);
          if (error && error.message?.includes('column "banco" of relation')) {
            delete payload.banco;
            delete payload.telefono_pagomovil;
            delete payload.cedula_rif;
            const retry = await supabase.from('proveedores').insert(payload);
            if (retry.error) throw retry.error;
          } else if (error) {
            throw error;
          }
        }
        mostrarNotificacion('exito', `Proveedor "${nombre}" registrado exitosamente.`);
      } else {
        if (modalProveedorCrud.id && tablaProveedoresExiste) {
          const { error } = await supabase
            .from('proveedores')
            .update(payload)
            .eq('id', modalProveedorCrud.id);

          if (error && error.message?.includes('column "banco" of relation')) {
            delete payload.banco;
            delete payload.telefono_pagomovil;
            delete payload.cedula_rif;
            const retry = await supabase.from('proveedores').update(payload).eq('id', modalProveedorCrud.id);
            if (retry.error) throw retry.error;
          } else if (error) {
            throw error;
          }
        }

        if (modalProveedorCrud.nombreOriginal && modalProveedorCrud.nombreOriginal !== nombre) {
          await supabase
            .from('proveedores_cuentas')
            .update({ nombre_proveedor: nombre })
            .eq('nombre_proveedor', modalProveedorCrud.nombreOriginal);
        }

        mostrarNotificacion('exito', `Proveedor "${nombre}" actualizado correctamente.`);
      }

      setModalProveedorCrud((prev) => ({ ...prev, abierto: false, guardando: false }));
      await cargarProveedores();
      await cargarCuentas();
    } catch (err: any) {
      console.error('Error al guardar proveedor:', err);
      setModalProveedorCrud((prev) => ({
        ...prev,
        guardando: false,
        error: err.message || 'Error al guardar el proveedor.',
      }));
    }
  };

  // Eliminar Proveedor
  const handleAbrirEliminarProveedor = (p: ProveedorConsolidado, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setModalEliminarProveedor({
      abierto: true,
      proveedor: p,
      eliminando: false,
      error: null,
    });
  };

  const handleConfirmarEliminarProveedor = async () => {
    if (!modalEliminarProveedor.proveedor) return;
    setModalEliminarProveedor((prev) => ({ ...prev, eliminando: true, error: null }));

    try {
      const p = modalEliminarProveedor.proveedor;

      if (p.isDbRecord) {
        const { error } = await supabase.from('proveedores').delete().eq('id', p.id);
        if (error) throw error;
      }

      await supabase
        .from('proveedores_cuentas')
        .update({ proveedor_id: null })
        .eq('proveedor_id', p.id);

      mostrarNotificacion('exito', `Proveedor "${p.nombre}" eliminado.`);
      setModalEliminarProveedor({ abierto: false, proveedor: null, eliminando: false, error: null });

      await cargarProveedores();
      await cargarCuentas();
    } catch (err: any) {
      console.error('Error al eliminar proveedor:', err);
      setModalEliminarProveedor((prev) => ({
        ...prev,
        eliminando: false,
        error: err.message || 'No se pudo eliminar el proveedor.',
      }));
    }
  };

  // Liquidar Factura Individual
  const handleAbrirLiquidar = (cuenta: ProveedorCuenta, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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
        `Factura de "${modalLiquidar.cuenta.nombre_proveedor}" liquidada a tasa ${formatBs(tasaBcv)}.`
      );
      setModalLiquidar({ abierto: false, cuenta: null, procesando: false, error: null });
      await ejecutarMiniRecarga({
        router,
        recargarDatosLocales: async () => {
          await cargarCuentas();
        },
        mensaje: 'Factura liquidada y sincronizada',
      });
    } catch (err: any) {
      console.error('Error al liquidar pago:', err);
      setModalLiquidar((prev) => ({
        ...prev,
        procesando: false,
        error: err.message || 'No se pudo liquidar la cuenta.',
      }));
    }
  };

  // Liquidar Total de Cuentas de un Proveedor
  const handleAbrirLiquidarTotal = (p: ProveedorConsolidado, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setModalLiquidarTotal({
      abierto: true,
      proveedor: p,
      procesando: false,
      error: null,
    });
  };

  const handleConfirmarLiquidarTotal = async () => {
    if (!modalLiquidarTotal.proveedor) return;
    setModalLiquidarTotal((prev) => ({ ...prev, procesando: true, error: null }));

    try {
      const p = modalLiquidarTotal.proveedor;
      const idsPendientes = p.cuentas.filter((c) => !c.pagado).map((c) => c.id);

      if (idsPendientes.length === 0) {
        mostrarNotificacion('info', 'Este proveedor no tiene facturas pendientes por pagar.');
        setModalLiquidarTotal({ abierto: false, proveedor: null, procesando: false, error: null });
        return;
      }

      const { error } = await supabase
        .from('proveedores_cuentas')
        .update({
          pagado: true,
          tasa_bcv_historica: tasaBcv,
        })
        .in('id', idsPendientes);

      if (error) throw error;

      mostrarNotificacion(
        'exito',
        `¡Deuda total de "${p.nombre}" (${formatUSD(p.totalPendienteUsd)}) liquidada exitosamente!`
      );
      setModalLiquidarTotal({ abierto: false, proveedor: null, procesando: false, error: null });
      await ejecutarMiniRecarga({
        router,
        recargarDatosLocales: async () => {
          await cargarCuentas();
        },
        mensaje: 'Deuda de proveedor liquidada en su totalidad',
      });
    } catch (err: any) {
      console.error('Error al liquidar total del proveedor:', err);
      setModalLiquidarTotal((prev) => ({
        ...prev,
        procesando: false,
        error: err.message || 'No se pudo liquidar la deuda total del proveedor.',
      }));
    }
  };

  // Revertir estado pagado a pendiente
  const handleRevertirPago = async (cuenta: ProveedorCuenta, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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
      await ejecutarMiniRecarga({
        router,
        recargarDatosLocales: async () => {
          await cargarCuentas();
        },
        mensaje: 'Factura revertida a pendiente',
      });
    } catch (err: any) {
      console.error('Error al revertir pago:', err);
      mostrarNotificacion('error', 'No se pudo revertir el estado de la factura.');
    }
  };

  // Eliminar Factura Individual
  const handleAbrirEliminarFactura = (cuenta: ProveedorCuenta, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setModalEliminarFactura({
      abierto: true,
      cuenta,
      eliminando: false,
      error: null,
    });
  };

  const handleConfirmarEliminarFactura = async () => {
    if (!modalEliminarFactura.cuenta) return;
    setModalEliminarFactura((prev) => ({ ...prev, eliminando: true, error: null }));

    try {
      const { error } = await supabase
        .from('proveedores_cuentas')
        .delete()
        .eq('id', modalEliminarFactura.cuenta.id);

      if (error) throw error;

      mostrarNotificacion(
        'exito',
        `Factura de "${modalEliminarFactura.cuenta.nombre_proveedor}" eliminada exitosamente.`
      );
      setModalEliminarFactura({ abierto: false, cuenta: null, eliminando: false, error: null });
      await ejecutarMiniRecarga({
        router,
        recargarDatosLocales: async () => {
          await cargarCuentas();
        },
        mensaje: 'Factura eliminada y sincronizada',
      });
    } catch (err: any) {
      console.error('Error al eliminar factura:', err);
      setModalEliminarFactura((prev) => ({
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
      {/* Header Sticky con diseño unificado */}
      <header className="sticky top-0 z-40 w-full border-b border-gray-200/80 dark:border-slate-800 bg-white/90 dark:bg-[#0D111A]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
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
                  Proveedores y Cuentas por Pagar
                </h1>
                <span className="rounded-full border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.2 text-[10px] sm:text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 shrink-0">
                  {proveedoresConsolidados.length} proveedores
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-gray-500 dark:text-slate-400 hidden sm:block">
                Consolidación en acordeón, plazos exactos y datos de Pago Móvil
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <NotificationBell />

            {/* Botón Crear Proveedor */}
            <button
              type="button"
              onClick={handleAbrirCrearProveedor}
              title="Registrar Nuevo Proveedor"
              className="flex items-center justify-center gap-1.5 rounded-xl sm:rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/50 px-2.5 sm:px-3 py-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 shadow-2xs hover:bg-indigo-100 transition active:scale-95 shrink-0"
            >
              <Building2 className="h-4 w-4" />
              <span className="hidden md:inline">Proveedor</span>
            </button>

            {/* Botón Registrar Nueva Compra / Factura (Texto limpio: sin duplicado ++) */}
            <button
              type="button"
              onClick={() => handleAbrirCrear()}
              title="Registrar Factura / Compra"
              className="flex h-9 w-9 sm:h-auto sm:w-auto items-center justify-center gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl bg-indigo-600 sm:px-4 sm:py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition active:scale-95 shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nueva Factura</span>
            </button>
          </div>
        </div>
      </header>

      {/* Banner Informativo si supabase_proveedores.sql no ha sido ejecutado */}
      {!tablaProveedoresExiste && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 px-4 py-2 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              💡 <strong>Base de datos en transición:</strong> Se ha actualizado el archivo <code>supabase_proveedores.sql</code> con las columnas de Pago Móvil para ejecutar en Supabase SQL Editor.
            </span>
          </div>
          <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium shrink-0">
            Operando en modo compatible
          </span>
        </div>
      )}

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
        {/* Tarjetas Métricas Top */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-rose-200/80 dark:border-rose-900/50 bg-gradient-to-br from-rose-50/40 to-orange-50/20 dark:from-rose-950/20 dark:to-orange-950/10 p-5 shadow-xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-900/80 dark:text-rose-300">
              Total Cuentas por Pagar
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-black tracking-tight text-rose-950 dark:text-rose-200 font-mono">
                {formatUSD(metricas.totalPendienteUsd)}
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-800 dark:text-rose-300">
                <Receipt className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-1 text-xs text-rose-800/90 dark:text-rose-400 font-mono font-medium">
              Equivalente: {formatBs(metricas.totalPendienteBs)} (BCV: {formatBs(tasaBcv)})
            </p>
          </div>

          <div className="rounded-3xl border border-gray-200/80 dark:border-slate-800 bg-white dark:bg-[#111726] p-5 shadow-xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
              Proveedores con Deuda
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">
                {metricas.proveedoresConDeuda}{' '}
                <span className="text-sm font-normal text-gray-400">/ {metricas.totalProveedores}</span>
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-400 dark:text-slate-400">
              {metricas.facturasPendientes} facturas activas ({metricas.facturasPagadas} liquidadas)
            </p>
          </div>

          <div className="rounded-3xl border border-gray-200/80 dark:border-slate-800 bg-white dark:bg-[#111726] p-5 shadow-xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
              Alertas de Vencimiento
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span
                className={`text-2xl sm:text-3xl font-black tracking-tight ${
                  metricas.facturasVencidas > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : metricas.facturasProximas > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {metricas.facturasVencidas > 0
                  ? `${metricas.facturasVencidas} vencidas`
                  : metricas.facturasProximas > 0
                  ? `${metricas.facturasProximas} por vencer`
                  : 'Al día'}
              </span>
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-2xl ${
                  metricas.facturasVencidas > 0
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600'
                    : metricas.facturasProximas > 0
                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600'
                    : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600'
                }`}
              >
                <CalendarClock className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-400 dark:text-slate-400">
              {metricas.facturasProximas > 0
                ? `${metricas.facturasProximas} facturas en plazo crítico (≤ 3 días)`
                : 'Sin urgencias inmediatas'}
            </p>
          </div>

          <div className="rounded-3xl border border-gray-200/80 dark:border-slate-800 bg-white dark:bg-[#111726] p-5 shadow-xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
              Total Histórico Pagado
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 font-mono">
                {formatUSD(metricas.totalPagadoUsd)}
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-400 dark:text-slate-400">
              {metricas.facturasPagadas} cuentas liquidadas a tasa BCV
            </p>
          </div>
        </div>

        {/* Barra de Navegación y Filtros */}
        <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-gray-200/80 dark:border-slate-800 bg-white dark:bg-[#111726] p-4 shadow-xs">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Pestañas de Vista */}
            <div className="flex items-center rounded-2xl border border-gray-200/90 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-900/80 p-1 shrink-0">
              <button
                type="button"
                onClick={() => setVistaActiva('proveedores')}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  vistaActiva === 'proveedores'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Building2 className="h-4 w-4" />
                <span>Proveedores (Acordeón)</span>
                <span className="rounded-full bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.2 text-[10px] text-indigo-700 dark:text-indigo-300">
                  {proveedoresConsolidados.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setVistaActiva('facturas')}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  vistaActiva === 'facturas'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Receipt className="h-4 w-4" />
                <span>Facturas Sueltas</span>
                <span className="rounded-full bg-gray-200 dark:bg-slate-700 px-1.5 py-0.2 text-[10px] text-gray-700 dark:text-slate-300">
                  {cuentas.length}
                </span>
              </button>
            </div>

            {/* Buscador */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder={
                  vistaActiva === 'proveedores'
                    ? 'Buscar proveedor, pago móvil, cédula o banco...'
                    : 'Buscar por factura o mercancía...'
                }
                className="w-full rounded-2xl border border-gray-200/90 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 py-2 pl-10 pr-9 text-xs sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 transition"
                  title="Limpiar búsqueda"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Fila 2: Filtros de Estado y Acciones de Acordeón */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-gray-100 dark:border-slate-800/80">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 mr-1">Filtrar:</span>
              <button
                type="button"
                onClick={() => setFiltroEstado('todos')}
                className={`rounded-xl px-2.5 py-1 text-xs font-bold transition ${
                  filtroEstado === 'todos'
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setFiltroEstado('pendientes')}
                className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold transition ${
                  filtroEstado === 'pendientes'
                    ? 'bg-amber-500 text-white'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100'
                }`}
              >
                <span>Con Deuda</span>
                {metricas.proveedoresConDeuda > 0 && (
                  <span className="rounded-full bg-amber-200 dark:bg-amber-800 px-1.5 py-0.2 text-[10px] text-amber-950 dark:text-amber-100 font-black">
                    {vistaActiva === 'proveedores' ? metricas.proveedoresConDeuda : metricas.facturasPendientes}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setFiltroEstado('vencidos')}
                className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold transition ${
                  filtroEstado === 'vencidos'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 hover:bg-rose-100'
                }`}
              >
                <span>Vencidas</span>
                {metricas.facturasVencidas > 0 && (
                  <span className="rounded-full bg-rose-200 dark:bg-rose-800 px-1.5 py-0.2 text-[10px] text-rose-950 dark:text-rose-100 font-black">
                    {metricas.facturasVencidas}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setFiltroEstado('pagados')}
                className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold transition ${
                  filtroEstado === 'pagados'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100'
                }`}
              >
                <span>Solventes</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {vistaActiva === 'proveedores' && proveedoresFiltrados.length > 0 && (
                <div className="flex items-center gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={expandirTodos}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline px-1 py-0.5"
                  >
                    Expandir todo
                  </button>
                  <span className="text-gray-300 dark:text-slate-700">•</span>
                  <button
                    type="button"
                    onClick={colapsarTodos}
                    className="text-gray-500 hover:underline px-1 py-0.5"
                  >
                    Colapsar todo
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  cargarCuentas();
                  cargarProveedores();
                }}
                disabled={cargandoCuentas || cargandoProveedores}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-slate-300 shadow-2xs hover:bg-gray-50 transition disabled:opacity-60"
                title="Recargar datos"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${cargandoCuentas || cargandoProveedores ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Sincronizar</span>
              </button>
            </div>
          </div>
        </div>

        {/* VISTA 1: TARJETA ÚNICA DESPLEGABLE POR PROVEEDOR (ACORDEÓN) */}
        {vistaActiva === 'proveedores' && (
          <div className="space-y-4">
            {cargandoProveedores && cargandoCuentas ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-28 rounded-3xl border border-gray-200/80 bg-white dark:bg-slate-800 p-5 animate-pulse" />
                ))}
              </div>
            ) : proveedoresFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 dark:border-slate-800 bg-white/70 dark:bg-[#111726]/40 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-indigo-50 dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 mb-3 shadow-xs">
                  <Building2 className="h-7 w-7" />
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  {busqueda || filtroEstado !== 'todos'
                    ? 'No se encontraron proveedores con ese criterio'
                    : 'Aún no hay proveedores registrados'}
                </h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400 max-w-sm">
                  {busqueda || filtroEstado !== 'todos'
                    ? 'Prueba modificando la búsqueda o los filtros activos.'
                    : 'Registra a tus proveedores para llevar sus cuentas por pagar y datos de Pago Móvil unificados.'}
                </p>
                <div className="mt-5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAbrirCrearProveedor}
                    className="flex items-center gap-1.5 rounded-2xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition"
                  >
                    <Building2 className="h-4 w-4" />
                    <span>Crear Proveedor</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAbrirCrear()}
                    className="flex items-center gap-1.5 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-50 transition"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Factura</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {proveedoresFiltrados.map((p) => {
                  const expandido = proveedoresExpandidos.has(p.id);
                  const tieneDeuda = p.totalPendienteUsd > 0;
                  const tienePagoMovil = Boolean(p.telefono_pagomovil || p.banco || p.cedula_rif);

                  return (
                    <div
                      key={p.id}
                      className={`rounded-3xl border bg-white dark:bg-[#111726] shadow-xs transition-all overflow-hidden ${
                        p.estadoGeneral === 'vencido'
                          ? 'border-rose-300 dark:border-rose-900/60'
                          : p.estadoGeneral === 'proximo'
                          ? 'border-amber-300 dark:border-amber-900/60'
                          : tieneDeuda
                          ? 'border-gray-200 dark:border-slate-800 hover:border-indigo-300'
                          : 'border-emerald-200/80 dark:border-emerald-950/60'
                      }`}
                    >
                      {/* Cabecera / Barra Acordeón Principal de la Tarjeta */}
                      <div
                        onClick={() => toggleExpandido(p.id)}
                        className={`p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 cursor-pointer select-none transition ${
                          expandido
                            ? 'bg-gray-50/70 dark:bg-slate-900/60 border-b border-gray-100 dark:border-slate-800'
                            : 'hover:bg-gray-50/40 dark:hover:bg-slate-900/30'
                        }`}
                      >
                        {/* Bloque Izquierdo: Icono, Nombre, Tags y Teléfono */}
                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-sm font-black shadow-2xs ${
                              p.estadoGeneral === 'vencido'
                                ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-100 dark:border-rose-900/60 text-rose-700 dark:text-rose-300'
                                : p.estadoGeneral === 'proximo'
                                ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-100 dark:border-amber-900/60 text-amber-700 dark:text-amber-300'
                                : tieneDeuda
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-100 dark:border-indigo-900/60 text-indigo-700 dark:text-indigo-300'
                                : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-100 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            <Building2 className="h-5 w-5" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight truncate">
                                {p.nombre}
                              </h3>

                              {/* Contador exacto de días de vencimiento */}
                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${p.badgeClassConsolidada}`}
                              >
                                {p.etiquetaVencimientoConsolidada}
                              </span>
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                              {p.categoria && (
                                <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:text-slate-300">
                                  <Tag className="h-2.5 w-2.5" />
                                  <span>{p.categoria}</span>
                                </span>
                              )}

                              {p.telefono && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-slate-400">
                                  <Phone className="h-3 w-3 text-emerald-600" />
                                  <span>{p.telefono}</span>
                                </span>
                              )}

                              {tienePagoMovil && (
                                <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">
                                  <Smartphone className="h-2.5 w-2.5" />
                                  <span>Pago Móvil disponible</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Bloque Derecho: Saldo Adeudado, Conteo de Facturas y Controles */}
                        <div className="flex items-center justify-between lg:justify-end gap-3 sm:gap-4 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-gray-100 dark:border-slate-800">
                          {/* Resumen Financiero */}
                          <div className="text-left lg:text-right">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 block">
                              Saldo Adeudado:
                            </span>
                            <span
                              className={`text-lg sm:text-xl font-black font-mono tracking-tight ${
                                tieneDeuda ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              {formatUSD(p.totalPendienteUsd)}
                            </span>
                            {tieneDeuda && (
                              <p className="text-[11px] font-mono text-gray-500 dark:text-slate-400">
                                {formatBs(p.totalPendienteBs)}
                              </p>
                            )}
                          </div>

                          {/* Facturas Activas */}
                          <div className="hidden sm:block text-left lg:text-right text-xs text-gray-500 dark:text-slate-400">
                            <span className="block font-bold text-gray-900 dark:text-white">
                              {p.facturasPendientes} pendientes
                            </span>
                            <span className="text-[11px] text-gray-400">
                              {p.totalFacturas} facturas total
                            </span>
                          </div>

                          {/* Botón Acción Rápida: + Factura (Limpio, sin duplicación ++) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAbrirCrear(p);
                            }}
                            className="flex items-center gap-1 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition active:scale-95 shadow-2xs"
                            title="Registrar factura para este proveedor"
                          >
                            <Plus className="h-3.5 w-3.5 text-indigo-600" />
                            <span>Factura</span>
                          </button>

                          {/* Flecha Chevron Desplegable */}
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-300 transition-transform duration-200 ${
                              expandido ? 'rotate-180 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600' : ''
                            }`}
                            title={expandido ? 'Colapsar tarjeta' : 'Desplegar facturas y datos bancarios'}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </div>
                        </div>
                      </div>

                      {/* CONTENIDO DESPLEGABLE (ACORDEÓN EXPANDIDO) */}
                      {expandido && (
                        <div className="p-4 sm:p-6 bg-white dark:bg-[#111726] border-t border-gray-100 dark:border-slate-800 space-y-4 animate-in fade-in-50 duration-200">
                          {/* Fila Superior del Acordeón: Datos de Pago Móvil y Acciones del Proveedor */}
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                            {/* Tarjeta de Datos de Pago Móvil */}
                            <div className="lg:col-span-2 rounded-2xl border border-indigo-100 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/50 to-blue-50/30 dark:from-indigo-950/30 dark:to-blue-950/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-2xs">
                                    <Smartphone className="h-3.5 w-3.5" />
                                  </div>
                                  <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 uppercase tracking-wider">
                                    Datos de Pago Móvil / Transferencia
                                  </span>
                                </div>

                                {tienePagoMovil ? (
                                  <div className="pt-1 text-xs text-indigo-900 dark:text-indigo-300 space-y-0.5">
                                    {p.banco && (
                                      <p>
                                        <span className="text-indigo-700/80 dark:text-indigo-400 font-semibold">Banco:</span>{' '}
                                        <strong>{p.banco}</strong>
                                      </p>
                                    )}
                                    <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
                                      {p.telefono_pagomovil && (
                                        <span>
                                          Tel: <strong>{p.telefono_pagomovil}</strong>
                                        </span>
                                      )}
                                      {p.cedula_rif && (
                                        <span>
                                          CI/RIF: <strong>{p.cedula_rif}</strong>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <p className="pt-1 text-xs text-gray-500 dark:text-slate-400 italic">
                                    Sin datos bancarios registrados aún.
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                                {tienePagoMovil ? (
                                  <button
                                    type="button"
                                    onClick={(e) => handleCopiarPagoMovil(p, e)}
                                    className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition active:scale-95"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                    <span>Copiar Pago Móvil</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => handleAbrirEditarProveedor(p, e)}
                                    className="flex items-center gap-1 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    <span>Agregar Pago Móvil</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Acciones y Gestión de Proveedor */}
                            <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-900/60 p-4 flex flex-col justify-between gap-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-600 dark:text-slate-300">
                                  Opciones de Proveedor
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={(e) => handleAbrirEditarProveedor(p, e)}
                                    className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-800 hover:text-gray-900 transition"
                                    title="Editar datos y pago móvil del proveedor"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => handleAbrirEliminarProveedor(p, e)}
                                    className="rounded-lg p-1.5 text-gray-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 transition"
                                    title="Eliminar proveedor"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {p.totalPendienteUsd > 0 && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleAbrirLiquidarTotal(p, e)}
                                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2 px-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition active:scale-95"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    <span>Liquidar Total ({formatUSD(p.totalPendienteUsd)})</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Notas / Observaciones */}
                          {p.notas && (
                            <div className="rounded-xl bg-gray-50 dark:bg-slate-900/80 px-3 py-2 text-xs text-gray-600 dark:text-slate-400 border border-gray-100 dark:border-slate-800">
                              <span className="font-semibold text-gray-500">Notas comerciales:</span> {p.notas}
                            </div>
                          )}

                          {/* Lista e Historial de Facturas (Una debajo de la otra) */}
                          <div className="space-y-2 pt-1">
                            <div className="flex items-center justify-between pb-1 border-b border-gray-100 dark:border-slate-800">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                                Historial de Facturas ({p.cuentas.length})
                              </h4>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAbrirCrear(p);
                                }}
                                className="flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                              >
                                <Plus className="h-3 w-3" />
                                <span>Nueva Factura</span>
                              </button>
                            </div>

                            {p.cuentas.length === 0 ? (
                              <div className="py-6 text-center text-xs text-gray-400 border border-dashed rounded-2xl">
                                Sin facturas registradas para este proveedor.
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {p.cuentas.map((c) => {
                                  const infoV = calcularDetalleVencimiento(c.fecha_vencimiento_pago, c.pagado);
                                  const montoBsHoy = calcularConversionBs(c.monto_usd, tasaBcv);

                                  return (
                                    <div
                                      key={c.id}
                                      className={`rounded-2xl border p-3 sm:p-3.5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                        c.pagado
                                          ? 'border-gray-200/60 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/40 opacity-75'
                                          : infoV.estado === 'vencida'
                                          ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20'
                                          : infoV.estado === 'hoy' || infoV.estado === 'proxima'
                                          ? 'border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20'
                                          : 'border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#111726]'
                                      }`}
                                    >
                                      {/* Detalle y Concepto */}
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span
                                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${infoV.badgeClass}`}
                                          >
                                            {infoV.etiqueta}
                                          </span>
                                          <span className="text-[11px] text-gray-400 dark:text-slate-500">
                                            Recibido: {formatearFechaLegible(c.fecha_recepcion)} • Límite: {formatearFechaLegible(c.fecha_vencimiento_pago)}
                                          </span>
                                        </div>
                                        <p className="mt-1 text-xs font-semibold text-gray-800 dark:text-slate-200 leading-snug">
                                          {c.concepto_mercancia}
                                        </p>
                                      </div>

                                      {/* Monto y Botones */}
                                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-slate-800">
                                        <div className="text-left sm:text-right">
                                          <span className="font-mono text-base font-black text-gray-900 dark:text-white block">
                                            {formatUSD(c.monto_usd)}
                                          </span>
                                          <span className="text-[10px] font-mono text-gray-500 dark:text-slate-400 block">
                                            {c.pagado && c.tasa_bcv_historica
                                              ? `Pagado: ${formatBs(calcularConversionBs(c.monto_usd, c.tasa_bcv_historica))}`
                                              : `Hoy: ${formatBs(montoBsHoy)}`}
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                          {!c.pagado && (
                                            <button
                                              type="button"
                                              onClick={(e) => handleAbrirEditar(c)}
                                              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 transition"
                                              title="Editar factura"
                                            >
                                              <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                          )}

                                          <button
                                            type="button"
                                            onClick={(e) => handleAbrirEliminarFactura(c, e)}
                                            className="rounded-lg p-1.5 text-gray-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 transition"
                                            title="Eliminar factura"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>

                                          {c.pagado ? (
                                            <button
                                              type="button"
                                              onClick={(e) => handleRevertirPago(c, e)}
                                              className="inline-flex items-center gap-1 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-50 transition"
                                              title="Revertir a Pendiente"
                                            >
                                              <RotateCcw className="h-3 w-3" />
                                              <span>Revertir</span>
                                            </button>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={(e) => handleAbrirLiquidar(c, e)}
                                              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition active:scale-95"
                                            >
                                              <CheckCircle2 className="h-3.5 w-3.5" />
                                              <span>Liquidar</span>
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VISTA 2: LISTA DE FACTURAS INDIVIDUALES (MODO TABLA/TARJETAS) */}
        {vistaActiva === 'facturas' && (
          <div>
            {cargandoCuentas ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div key={n} className="h-64 rounded-3xl border border-gray-200/80 bg-white p-5 animate-pulse" />
                ))}
              </div>
            ) : cuentasFiltradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 dark:border-slate-800 bg-white/70 dark:bg-[#111726]/40 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-indigo-50 dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 mb-3 shadow-xs">
                  <Receipt className="h-7 w-7" />
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  No se encontraron facturas con los filtros seleccionados
                </h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400 max-w-sm">
                  Prueba cambiando el estado o registrando una nueva compra de mercancía.
                </p>
                <button
                  type="button"
                  onClick={() => handleAbrirCrear()}
                  className="mt-5 flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition"
                >
                  <Plus className="h-4 w-4" />
                  <span>Registrar Nueva Factura</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {cuentasFiltradas.map((cuenta, index) => {
                    const infoV = calcularDetalleVencimiento(cuenta.fecha_vencimiento_pago, cuenta.pagado);
                    const montoBsHoy = calcularConversionBs(cuenta.monto_usd, tasaBcv);
                    const montoBsHistorico = cuenta.tasa_bcv_historica
                      ? calcularConversionBs(cuenta.monto_usd, cuenta.tasa_bcv_historica)
                      : null;

                    return (
                      <motion.div
                        key={cuenta.id}
                        initial={{ opacity: 0, y: 12, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.2) }}
                        className={`flex flex-col justify-between rounded-3xl border bg-white dark:bg-[#111726] p-5 shadow-xs hover:shadow-md transition group ${
                          cuenta.pagado
                            ? 'border-gray-200/70 bg-gray-50/40 opacity-90'
                            : infoV.estado === 'vencida'
                            ? 'border-rose-200/90 bg-rose-50/15'
                            : infoV.estado === 'hoy' || infoV.estado === 'proxima'
                            ? 'border-amber-200/90 bg-amber-50/15'
                            : 'border-gray-200/80 hover:border-gray-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div
                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-sm font-black shadow-2xs ${
                                  cuenta.pagado
                                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                    : infoV.estado === 'vencida'
                                    ? 'bg-rose-50 border-rose-100 text-rose-700'
                                    : 'bg-indigo-50 border-indigo-100 text-indigo-700'
                                }`}
                              >
                                <Truck className="h-5 w-5" />
                              </div>

                              <div className="min-w-0">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 transition leading-snug truncate">
                                  {cuenta.nombre_proveedor}
                                </h3>

                                <span
                                  className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${infoV.badgeClass}`}
                                >
                                  <span>{infoV.etiqueta}</span>
                                </span>
                              </div>
                            </div>

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
                                onClick={(e) => handleAbrirEliminarFactura(cuenta, e)}
                                className="rounded-xl p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600 transition"
                                title="Eliminar registro"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="mt-3 rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-900/60 p-2.5 text-xs text-gray-700 dark:text-slate-300">
                            <span className="font-semibold text-gray-500 uppercase text-[10px] tracking-wider block mb-0.5">
                              Mercancía / Concepto:
                            </span>
                            <p className="line-clamp-2 leading-relaxed text-gray-800 dark:text-slate-200">
                              {cuenta.concepto_mercancia}
                            </p>
                          </div>

                          <div className="mt-3 space-y-1.5 rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-xs shadow-2xs">
                            <div className="flex items-center justify-between text-gray-600 dark:text-slate-400">
                              <span className="font-medium">Monto Factura:</span>
                              <span className="font-bold text-gray-900 dark:text-white font-mono text-base">
                                {formatUSD(cuenta.monto_usd)}
                              </span>
                            </div>

                            {cuenta.pagado ? (
                              <>
                                <div className="flex items-center justify-between text-gray-600 dark:text-slate-400">
                                  <span>Tasa Liquidación:</span>
                                  <span className="font-mono font-medium text-emerald-800 dark:text-emerald-400">
                                    {cuenta.tasa_bcv_historica ? formatBs(cuenta.tasa_bcv_historica) : 'N/D'}
                                  </span>
                                </div>
                                {montoBsHistorico !== null && (
                                  <div className="flex items-center justify-between text-gray-600 dark:text-slate-400 border-t border-gray-100 dark:border-slate-800 pt-1">
                                    <span>Total Liquidado:</span>
                                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                      {formatBs(montoBsHistorico)}
                                    </span>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="flex items-center justify-between text-gray-600 dark:text-slate-400">
                                <span>Equivalente BCV Hoy:</span>
                                <span className="font-mono font-bold text-gray-800 dark:text-slate-200">
                                  {formatBs(montoBsHoy)}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-gray-500 dark:text-slate-400">
                            <div className="flex items-center gap-1 rounded-xl bg-gray-50 dark:bg-slate-900 px-2 py-1 border border-gray-100 dark:border-slate-800">
                              <Calendar className="h-3 w-3 text-gray-400 shrink-0" />
                              <span className="truncate">Rec: {formatearFechaLegible(cuenta.fecha_recepcion)}</span>
                            </div>
                            <div
                              className={`flex items-center gap-1 rounded-xl px-2 py-1 border ${
                                infoV.estado === 'vencida'
                                  ? 'bg-rose-50 border-rose-100 text-rose-800 font-semibold'
                                  : 'bg-gray-50 dark:bg-slate-900 border-gray-100 dark:border-slate-800 text-gray-600 dark:text-slate-400'
                              }`}
                            >
                              <CalendarClock className="h-3 w-3 text-gray-400 shrink-0" />
                              <span className="truncate">Vence: {formatearFechaLegible(cuenta.fecha_vencimiento_pago)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center gap-2">
                          {cuenta.pagado ? (
                            <>
                              <div className="flex-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="h-4 w-4 shrink-0" />
                                <span>Liquidada</span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => handleRevertirPago(cuenta, e)}
                                className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-gray-500 hover:bg-gray-50 transition"
                                title="Revertir a Pendiente"
                              >
                                <RotateCcw className="h-3 w-3" />
                                <span>Revertir</span>
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => handleAbrirLiquidar(cuenta, e)}
                              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-2.5 px-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition active:scale-98"
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
          </div>
        )}
      </main>

      {/* MODAL REGISTRAR / EDITAR FACTURA */}
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
            className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain touch-scroll-ios rounded-t-3xl sm:rounded-3xl border-t sm:border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#111726] p-4 sm:p-6 pb-32 sm:pb-6 shadow-2xl outline-none duration-300 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in-0 sm:zoom-in-95 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[95vw] sm:max-w-lg cursor-grab active:cursor-grabbing"
          >
            <div className="mx-auto mb-3 -mt-1 flex h-6 w-full cursor-grab active:cursor-grabbing items-center justify-center sm:hidden touch-none">
              <div className="h-1.5 w-12 rounded-full bg-gray-300 dark:bg-slate-700 transition-colors" />
            </div>

            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div>
                <Dialog.Title className="text-base font-bold text-gray-900 dark:text-white">
                  {modalForm.modo === 'crear' ? 'Registrar Compra / Factura de Proveedor' : 'Editar Factura'}
                </Dialog.Title>
                <Dialog.Description className="text-xs text-gray-500 dark:text-slate-400">
                  Ingresa los detalles de la mercancía recibida y el plazo de crédito acordado.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 transition"
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

              {/* Selector / Autocompletado de Proveedores */}
              <div className="relative" ref={selectorRef}>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                    Proveedor Registrado *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setModalNuevoProveedorRapido({
                        abierto: true,
                        nombre: selectorBusqueda || '',
                        telefono: '',
                        categoria: '',
                        notas: '',
                        banco: '',
                        telefono_pagomovil: '',
                        cedula_rif: '',
                        guardando: false,
                        error: null,
                      });
                    }}
                    className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Crear Nuevo Proveedor</span>
                  </button>
                </div>

                <div
                  onClick={() => setSelectorAbierto((prev) => !prev)}
                  className="flex items-center justify-between w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white cursor-pointer hover:border-indigo-500 transition"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Building2 className="h-4 w-4 text-indigo-600 shrink-0" />
                    <span className={modalForm.nombre_proveedor ? 'font-bold' : 'text-gray-400 font-normal'}>
                      {modalForm.nombre_proveedor || 'Seleccionar o buscar proveedor...'}
                    </span>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${selectorAbierto ? 'rotate-180' : ''}`} />
                </div>

                {selectorAbierto && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-60 overflow-y-auto rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-2 animate-in fade-in-50 zoom-in-95">
                    <div className="relative mb-2">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <input
                        type="text"
                        value={selectorBusqueda}
                        onChange={(e) => setSelectorBusqueda(e.target.value)}
                        placeholder="Buscar por nombre o categoría..."
                        className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-indigo-500"
                        autoFocus
                      />
                    </div>

                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {proveedoresParaSelector.length === 0 ? (
                        <div className="py-3 px-2 text-center">
                          <p className="text-xs text-gray-500 mb-2">No se encontró ningún proveedor.</p>
                          <button
                            type="button"
                            onClick={() => {
                              setModalNuevoProveedorRapido({
                                abierto: true,
                                nombre: selectorBusqueda,
                                telefono: '',
                                categoria: '',
                                notas: '',
                                banco: '',
                                telefono_pagomovil: '',
                                cedula_rif: '',
                                guardando: false,
                                error: null,
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-indigo-700 transition"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Crear "{selectorBusqueda}"</span>
                          </button>
                        </div>
                      ) : (
                        proveedoresParaSelector.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => {
                              setModalForm((prev) => ({
                                ...prev,
                                proveedor_id: p.isDbRecord ? p.id : '',
                                nombre_proveedor: p.nombre,
                              }));
                              setSelectorAbierto(false);
                            }}
                            className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition ${
                              modalForm.nombre_proveedor === p.nombre
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold'
                                : 'hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="truncate font-semibold">{p.nombre}</p>
                              <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                                <span>{p.categoria}</span>
                                {p.telefono_pagomovil && <span>• PM: {p.telefono_pagomovil}</span>}
                              </div>
                            </div>
                            {p.totalPendienteUsd > 0 && (
                              <span className="font-mono text-rose-600 dark:text-rose-400 font-bold shrink-0">
                                Deuda: {formatUSD(p.totalPendienteUsd)}
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Concepto de Mercancía */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Concepto / Detalle de la Mercancía *
                </label>
                <textarea
                  required
                  rows={2}
                  value={modalForm.concepto_mercancia}
                  onChange={(e) =>
                    setModalForm((prev) => ({ ...prev, concepto_mercancia: e.target.value }))
                  }
                  placeholder="Ej. 10 cajas de malta, 5 paquetes de tequeños y servilletas"
                  className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900"
                />
              </div>

              {/* Monto en USD */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
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
                    className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 py-2.5 pl-8 pr-4 text-sm font-mono font-bold text-gray-900 dark:text-white outline-none transition focus:border-indigo-500"
                  />
                </div>

                {parseFloat(modalForm.monto_usd) > 0 && (
                  <div className="mt-2 flex items-center justify-between rounded-xl bg-amber-50/70 dark:bg-amber-950/40 p-2.5 border border-amber-200/70 dark:border-amber-900/60 text-xs">
                    <span className="text-amber-800 dark:text-amber-300 font-medium">Equivalente BCV:</span>
                    <span className="font-mono font-bold text-amber-950 dark:text-amber-100">
                      {formatBs(calcularConversionBs(parseFloat(modalForm.monto_usd), tasaBcv))}
                    </span>
                  </div>
                )}
              </div>

              {/* Fechas: Recepción y Vencimiento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Fecha de Recepción
                  </label>
                  <input
                    type="date"
                    required
                    value={modalForm.fecha_recepcion}
                    onChange={(e) =>
                      setModalForm((prev) => ({ ...prev, fecha_recepcion: e.target.value }))
                    }
                    className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 px-3.5 py-2 text-xs text-gray-900 dark:text-white outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Fecha Límite de Pago *
                  </label>
                  <input
                    type="date"
                    required
                    value={modalForm.fecha_vencimiento_pago}
                    onChange={(e) =>
                      setModalForm((prev) => ({ ...prev, fecha_vencimiento_pago: e.target.value }))
                    }
                    className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 px-3.5 py-2 text-xs text-gray-900 dark:text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Atajos de plazo */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[11px] text-gray-400 font-medium">Plazo crédito:</span>
                <button
                  type="button"
                  onClick={() =>
                    setModalForm((prev) => ({
                      ...prev,
                      fecha_vencimiento_pago: sumarDiasDesde(prev.fecha_recepcion, 7),
                    }))
                  }
                  className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50"
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
                  className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50"
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
                  className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50"
                >
                  +30 días
                </button>
              </div>

              {/* Botones de Acción */}
              <div className="flex items-center justify-between gap-2 border-t border-gray-100 dark:border-slate-800 pt-4">
                <div />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalForm((prev) => ({ ...prev, abierto: false }))}
                    className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50"
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
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* MODAL RÁPIDO: CREAR NUEVO PROVEEDOR (CON PAGO MÓVIL) */}
      <Dialog.Root
        open={modalNuevoProveedorRapido.abierto}
        onOpenChange={(abierto) => setModalNuevoProveedorRapido((prev) => ({ ...prev, abierto }))}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 max-h-[92vh] overflow-y-auto w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#111726] p-5 sm:p-6 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <Dialog.Title className="text-base font-bold text-gray-900 dark:text-white">
                    Crear Nuevo Proveedor
                  </Dialog.Title>
                  <Dialog.Description className="text-xs text-gray-500">
                    Registra datos de contacto y datos bancarios para Pago Móvil.
                  </Dialog.Description>
                </div>
              </div>
              <Dialog.Close asChild>
                <button type="button" className="p-1.5 text-gray-400 hover:text-gray-700">
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            <form onSubmit={handleGuardarNuevoProveedorRapido} className="mt-4 space-y-3.5">
              {modalNuevoProveedorRapido.error && (
                <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{modalNuevoProveedorRapido.error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Nombre del Proveedor / Empresa *
                </label>
                <input
                  type="text"
                  required
                  value={modalNuevoProveedorRapido.nombre}
                  onChange={(e) =>
                    setModalNuevoProveedorRapido((prev) => ({ ...prev, nombre: e.target.value }))
                  }
                  placeholder="Ej. Prof Oli Galletas"
                  className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Teléfono General
                  </label>
                  <input
                    type="text"
                    value={modalNuevoProveedorRapido.telefono}
                    onChange={(e) =>
                      setModalNuevoProveedorRapido((prev) => ({ ...prev, telefono: e.target.value }))
                    }
                    placeholder="Ej. 0412 1234567"
                    className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 px-3 py-2 text-xs outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Categoría
                  </label>
                  <input
                    type="text"
                    list="categorias-list-rapido"
                    value={modalNuevoProveedorRapido.categoria}
                    onChange={(e) =>
                      setModalNuevoProveedorRapido((prev) => ({ ...prev, categoria: e.target.value }))
                    }
                    placeholder="Ej. Galletas..."
                    className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 px-3 py-2 text-xs outline-none focus:border-indigo-500"
                  />
                  <datalist id="categorias-list-rapido">
                    {CATEGORIAS_PROVEEDORES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Sección Datos de Pago Móvil */}
              <div className="p-3 rounded-2xl border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2.5">
                <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Datos para Pago Móvil (Opcional)</span>
                </span>

                <div>
                  <label className="block text-[11px] font-medium text-gray-600 dark:text-slate-300 mb-0.5">
                    Banco de Pago Móvil
                  </label>
                  <input
                    type="text"
                    list="bancos-venezuela-rapido"
                    value={modalNuevoProveedorRapido.banco}
                    onChange={(e) =>
                      setModalNuevoProveedorRapido((prev) => ({ ...prev, banco: e.target.value }))
                    }
                    placeholder="Ej. 0102 - Banco de Venezuela"
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs outline-none focus:border-indigo-500"
                  />
                  <datalist id="bancos-venezuela-rapido">
                    {BANCOS_VENEZUELA.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 dark:text-slate-300 mb-0.5">
                      Teléfono Pago Móvil
                    </label>
                    <input
                      type="text"
                      value={modalNuevoProveedorRapido.telefono_pagomovil}
                      onChange={(e) =>
                        setModalNuevoProveedorRapido((prev) => ({ ...prev, telefono_pagomovil: e.target.value }))
                      }
                      placeholder="04141234567"
                      className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 dark:text-slate-300 mb-0.5">
                      Cédula o RIF
                    </label>
                    <input
                      type="text"
                      value={modalNuevoProveedorRapido.cedula_rif}
                      onChange={(e) =>
                        setModalNuevoProveedorRapido((prev) => ({ ...prev, cedula_rif: e.target.value }))
                      }
                      placeholder="V-12345678"
                      className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Notas / Observaciones (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={modalNuevoProveedorRapido.notas}
                  onChange={(e) =>
                    setModalNuevoProveedorRapido((prev) => ({ ...prev, notas: e.target.value }))
                  }
                  placeholder="Ej. Entrega los martes, crédito a 7 días..."
                  className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 px-3.5 py-2 text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalNuevoProveedorRapido((prev) => ({ ...prev, abierto: false }))}
                  className="rounded-2xl border border-gray-200 dark:border-slate-800 px-4 py-2 text-xs font-semibold text-gray-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalNuevoProveedorRapido.guardando}
                  className="flex items-center gap-1.5 rounded-2xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition"
                >
                  {modalNuevoProveedorRapido.guardando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Guardar y Seleccionar</span>
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* MODAL CRUD GENERAL DE PROVEEDORES (CREAR / EDITAR) */}
      <Dialog.Root
        open={modalProveedorCrud.abierto}
        onOpenChange={(abierto) => setModalProveedorCrud((prev) => ({ ...prev, abierto }))}
      >
        <Dialog.Portal>
          <Dialog.Overlay
            {...dragScrollCrudProveedor.overlayProps}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          />
          <Dialog.Content
            style={dragScrollCrudProveedor.style}
            {...dragScrollCrudProveedor.dragProps}
            className="fixed inset-x-0 bottom-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 max-h-[92vh] overflow-y-auto w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#111726] p-5 sm:p-6 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 cursor-grab active:cursor-grabbing"
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <Dialog.Title className="text-base font-bold text-gray-900 dark:text-white">
                    {modalProveedorCrud.modo === 'crear' ? 'Registrar Proveedor' : 'Editar Ficha de Proveedor'}
                  </Dialog.Title>
                  <Dialog.Description className="text-xs text-gray-500">
                    Datos comerciales y de Pago Móvil para transferencias rápidas
                  </Dialog.Description>
                </div>
              </div>
              <Dialog.Close asChild>
                <button type="button" className="p-1.5 text-gray-400 hover:text-gray-700">
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            <form onSubmit={handleGuardarProveedorCrud} className="mt-4 space-y-3.5">
              {modalProveedorCrud.error && (
                <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{modalProveedorCrud.error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Nombre del Proveedor / Empresa *
                </label>
                <input
                  type="text"
                  required
                  value={modalProveedorCrud.nombre}
                  onChange={(e) =>
                    setModalProveedorCrud((prev) => ({ ...prev, nombre: e.target.value }))
                  }
                  placeholder="Ej. Prof Oli Galletas"
                  className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Teléfono General
                  </label>
                  <input
                    type="text"
                    value={modalProveedorCrud.telefono}
                    onChange={(e) =>
                      setModalProveedorCrud((prev) => ({ ...prev, telefono: e.target.value }))
                    }
                    placeholder="Ej. 0412 1234567"
                    className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 px-3 py-2 text-xs outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Categoría / Rubro
                  </label>
                  <input
                    type="text"
                    list="categorias-crud"
                    value={modalProveedorCrud.categoria}
                    onChange={(e) =>
                      setModalProveedorCrud((prev) => ({ ...prev, categoria: e.target.value }))
                    }
                    placeholder="Ej. Galletas y Snacks..."
                    className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 px-3 py-2 text-xs outline-none focus:border-indigo-500"
                  />
                  <datalist id="categorias-crud">
                    {CATEGORIAS_PROVEEDORES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Bloque Datos de Pago Móvil */}
              <div className="p-3.5 rounded-2xl border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2.5">
                <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Datos Bancarios (Pago Móvil)</span>
                </span>

                <div>
                  <label className="block text-[11px] font-medium text-gray-600 dark:text-slate-300 mb-0.5">
                    Banco de Pago Móvil
                  </label>
                  <input
                    type="text"
                    list="bancos-venezuela-crud"
                    value={modalProveedorCrud.banco}
                    onChange={(e) =>
                      setModalProveedorCrud((prev) => ({ ...prev, banco: e.target.value }))
                    }
                    placeholder="Ej. 0102 - Banco de Venezuela"
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs outline-none focus:border-indigo-500"
                  />
                  <datalist id="bancos-venezuela-crud">
                    {BANCOS_VENEZUELA.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 dark:text-slate-300 mb-0.5">
                      Teléfono Pago Móvil
                    </label>
                    <input
                      type="text"
                      value={modalProveedorCrud.telefono_pagomovil}
                      onChange={(e) =>
                        setModalProveedorCrud((prev) => ({ ...prev, telefono_pagomovil: e.target.value }))
                      }
                      placeholder="04141234567"
                      className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 dark:text-slate-300 mb-0.5">
                      Cédula / RIF
                    </label>
                    <input
                      type="text"
                      value={modalProveedorCrud.cedula_rif}
                      onChange={(e) =>
                        setModalProveedorCrud((prev) => ({ ...prev, cedula_rif: e.target.value }))
                      }
                      placeholder="V-12345678"
                      className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Notas / Observaciones
                </label>
                <textarea
                  rows={2}
                  value={modalProveedorCrud.notas}
                  onChange={(e) =>
                    setModalProveedorCrud((prev) => ({ ...prev, notas: e.target.value }))
                  }
                  placeholder="Ej. Pedidos los lunes por la mañana..."
                  className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 px-3.5 py-2 text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalProveedorCrud((prev) => ({ ...prev, abierto: false }))}
                  className="rounded-2xl border border-gray-200 dark:border-slate-800 px-4 py-2 text-xs font-semibold text-gray-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalProveedorCrud.guardando}
                  className="flex items-center gap-1.5 rounded-2xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition"
                >
                  {modalProveedorCrud.guardando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{modalProveedorCrud.modo === 'crear' ? 'Registrar Proveedor' : 'Guardar Cambios'}</span>
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* MODAL LIQUIDAR FACTURA INDIVIDUAL */}
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
            className="fixed inset-x-0 bottom-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 max-h-[90vh] overflow-y-auto w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#111726] p-5 sm:p-6 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 cursor-grab active:cursor-grabbing"
          >
            <div className="flex items-center gap-3 border-b border-gray-100 dark:border-slate-800 pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <Dialog.Title className="text-base font-bold text-gray-900 dark:text-white">
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

                <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-900/60 p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-gray-600 dark:text-slate-400">
                    <span>Proveedor:</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {modalLiquidar.cuenta.nombre_proveedor}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-gray-600 dark:text-slate-400">
                    <span>Concepto:</span>
                    <span className="font-medium text-gray-800 dark:text-slate-200 text-right truncate max-w-[200px]">
                      {modalLiquidar.cuenta.concepto_mercancia}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-gray-600 dark:text-slate-400">
                    <span>Vencimiento:</span>
                    <span className="font-mono text-gray-800 dark:text-slate-200">
                      {formatearFechaLegible(modalLiquidar.cuenta.fecha_vencimiento_pago)}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-gradient-to-br from-emerald-50/70 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/20 p-4 space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-300">Total en USD:</span>
                    <span className="font-mono text-lg font-black text-emerald-950 dark:text-emerald-200">
                      {formatUSD(modalLiquidar.cuenta.monto_usd)}
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline text-xs text-emerald-800 dark:text-emerald-400">
                    <span>Tasa BCV del Día:</span>
                    <span className="font-mono font-bold">{formatBs(tasaBcv)}</span>
                  </div>

                  <div className="border-t border-emerald-200/80 dark:border-emerald-900/60 pt-2 flex justify-between items-baseline">
                    <span className="text-xs font-black uppercase text-emerald-900 dark:text-emerald-300">
                      Total a Pagar (Bs.):
                    </span>
                    <span className="font-mono text-lg font-black text-emerald-700 dark:text-emerald-300">
                      {formatBs(calcularConversionBs(modalLiquidar.cuenta.monto_usd, tasaBcv))}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-gray-500 text-center">
                  Al confirmar, la cuenta quedará registrada como pagada con la tasa oficial histórica.
                </p>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={modalLiquidar.procesando}
                    onClick={() => setModalLiquidar((prev) => ({ ...prev, abierto: false }))}
                    className="rounded-2xl border border-gray-200 dark:border-slate-800 px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50"
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

      {/* MODAL LIQUIDAR TOTAL DE PROVEEDOR */}
      <Dialog.Root
        open={modalLiquidarTotal.abierto}
        onOpenChange={(abierto) =>
          !modalLiquidarTotal.procesando && setModalLiquidarTotal((prev) => ({ ...prev, abierto }))
        }
      >
        <Dialog.Portal>
          <Dialog.Overlay
            {...dragScrollLiquidarTotal.overlayProps}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          />
          <Dialog.Content
            style={dragScrollLiquidarTotal.style}
            {...dragScrollLiquidarTotal.dragProps}
            className="fixed inset-x-0 bottom-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 max-h-[90vh] overflow-y-auto w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#111726] p-5 sm:p-6 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 cursor-grab active:cursor-grabbing"
          >
            <div className="flex items-center gap-3 border-b border-gray-100 dark:border-slate-800 pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <Dialog.Title className="text-base font-bold text-gray-900 dark:text-white">
                  Liquidar Total de Deuda
                </Dialog.Title>
                <Dialog.Description className="text-xs text-gray-500">
                  Saldar todas las facturas pendientes de este proveedor
                </Dialog.Description>
              </div>
            </div>

            {modalLiquidarTotal.proveedor && (
              <div className="mt-4 space-y-3">
                {modalLiquidarTotal.error && (
                  <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{modalLiquidarTotal.error}</span>
                  </div>
                )}

                <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-900/60 p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-gray-600 dark:text-slate-400">
                    <span>Proveedor:</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {modalLiquidarTotal.proveedor.nombre}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-gray-600 dark:text-slate-400">
                    <span>Facturas por Liquidar:</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      {modalLiquidarTotal.proveedor.facturasPendientes} facturas
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-gradient-to-br from-emerald-50/70 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/20 p-4 space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-300">Total en USD:</span>
                    <span className="font-mono text-xl font-black text-emerald-950 dark:text-emerald-200">
                      {formatUSD(modalLiquidarTotal.proveedor.totalPendienteUsd)}
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline text-xs text-emerald-800 dark:text-emerald-400">
                    <span>Tasa BCV Oficial:</span>
                    <span className="font-mono font-bold">{formatBs(tasaBcv)}</span>
                  </div>

                  <div className="border-t border-emerald-200/80 dark:border-emerald-900/60 pt-2 flex justify-between items-baseline">
                    <span className="text-xs font-black uppercase text-emerald-900 dark:text-emerald-300">
                      Total a Pagar (Bs.):
                    </span>
                    <span className="font-mono text-xl font-black text-emerald-700 dark:text-emerald-300">
                      {formatBs(modalLiquidarTotal.proveedor.totalPendienteBs)}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-gray-500 text-center">
                  Se marcarán como pagadas las {modalLiquidarTotal.proveedor.facturasPendientes} facturas pendientes de este proveedor simultáneamente.
                </p>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={modalLiquidarTotal.procesando}
                    onClick={() => setModalLiquidarTotal((prev) => ({ ...prev, abierto: false }))}
                    className="rounded-2xl border border-gray-200 dark:border-slate-800 px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={modalLiquidarTotal.procesando}
                    onClick={handleConfirmarLiquidarTotal}
                    className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition disabled:opacity-60"
                  >
                    {modalLiquidarTotal.procesando && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>Confirmar Liquidación Total</span>
                  </button>
                </div>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* MODAL ELIMINAR FACTURA */}
      <Dialog.Root
        open={modalEliminarFactura.abierto}
        onOpenChange={(abierto) =>
          !modalEliminarFactura.eliminando && setModalEliminarFactura((prev) => ({ ...prev, abierto }))
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
            className="fixed inset-x-0 bottom-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 max-h-[90vh] overflow-y-auto w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#111726] p-5 sm:p-6 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 cursor-grab active:cursor-grabbing"
          >
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 border border-rose-100">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <Dialog.Title className="text-base font-bold text-gray-900 dark:text-white">
                Eliminar Factura
              </Dialog.Title>
            </div>

            <Dialog.Description className="text-xs text-gray-500 leading-relaxed">
              ¿Estás seguro de que deseas eliminar la factura de{' '}
              <strong className="text-gray-900 dark:text-white">
                {modalEliminarFactura.cuenta?.nombre_proveedor}
              </strong>{' '}
              por{' '}
              <strong className="text-gray-900 dark:text-white">
                {modalEliminarFactura.cuenta && formatUSD(modalEliminarFactura.cuenta.monto_usd)}
              </strong>
              ? Esta acción no se puede deshacer.
            </Dialog.Description>

            {modalEliminarFactura.error && (
              <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
                {modalEliminarFactura.error}
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={modalEliminarFactura.eliminando}
                onClick={() => setModalEliminarFactura((prev) => ({ ...prev, abierto: false }))}
                className="rounded-2xl border border-gray-200 dark:border-slate-800 px-4 py-2 text-xs font-semibold text-gray-700 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={modalEliminarFactura.eliminando}
                onClick={handleConfirmarEliminarFactura}
                className="flex items-center gap-1.5 rounded-2xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition"
              >
                {modalEliminarFactura.eliminando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Sí, Eliminar</span>
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* MODAL ELIMINAR PROVEEDOR */}
      <Dialog.Root
        open={modalEliminarProveedor.abierto}
        onOpenChange={(abierto) =>
          !modalEliminarProveedor.eliminando && setModalEliminarProveedor((prev) => ({ ...prev, abierto }))
        }
      >
        <Dialog.Portal>
          <Dialog.Overlay
            {...dragScrollEliminarProveedor.overlayProps}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          />
          <Dialog.Content
            style={dragScrollEliminarProveedor.style}
            {...dragScrollEliminarProveedor.dragProps}
            className="fixed inset-x-0 bottom-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 max-h-[90vh] overflow-y-auto w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#111726] p-5 sm:p-6 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 cursor-grab active:cursor-grabbing"
          >
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 border border-rose-100">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <Dialog.Title className="text-base font-bold text-gray-900 dark:text-white">
                Eliminar Proveedor
              </Dialog.Title>
            </div>

            <Dialog.Description className="text-xs text-gray-500 leading-relaxed">
              ¿Estás seguro de que deseas eliminar la ficha de{' '}
              <strong className="text-gray-900 dark:text-white">
                {modalEliminarProveedor.proveedor?.nombre}
              </strong>
              ?
              {modalEliminarProveedor.proveedor && modalEliminarProveedor.proveedor.totalPendienteUsd > 0 && (
                <span className="block mt-2 font-bold text-rose-600 dark:text-rose-400">
                  ⚠️ Este proveedor tiene una deuda pendiente de {formatUSD(modalEliminarProveedor.proveedor.totalPendienteUsd)}.
                </span>
              )}
            </Dialog.Description>

            {modalEliminarProveedor.error && (
              <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
                {modalEliminarProveedor.error}
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={modalEliminarProveedor.eliminando}
                onClick={() => setModalEliminarProveedor((prev) => ({ ...prev, abierto: false }))}
                className="rounded-2xl border border-gray-200 dark:border-slate-800 px-4 py-2 text-xs font-semibold text-gray-700 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={modalEliminarProveedor.eliminando}
                onClick={handleConfirmarEliminarProveedor}
                className="flex items-center gap-1.5 rounded-2xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition"
              >
                {modalEliminarProveedor.eliminando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Sí, Eliminar Proveedor</span>
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
