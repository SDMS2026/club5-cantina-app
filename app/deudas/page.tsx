'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ejecutarMiniRecarga, EVENTO_MINI_RECARGA } from '@/lib/syncUtils';
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
  Phone,
  Landmark,
  X,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
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
  Banknote,
  Users,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { obtenerTasaBCV, TASA_BCV_FALLBACK_DEFAULT } from '@/lib/dolarApi';
import { supabase } from '@/lib/supabaseClient';
import {
  formatUSD,
  formatBs,
  calcularConversionBs,
  calcularConversionUSD,
  sanitizeDecimalInput,
  handleDecimalKeyDown,
} from '@/lib/utils';
import { ModernClientSelect } from '@/components/ModernClientSelect';
import { esProfesorOPersonal, normalizarTelefonoWhatsApp } from '@/lib/constants';
import { Cliente, Producto } from '@/types/pos';
import { NotificationBell } from '@/components/NotificationBell';
import { refrescarNotificacionesGlobales } from '@/components/NotificationsContext';
import { useSidebar } from '@/components/SidebarContext';
import { useModalDragScroll } from '@/lib/useModalDragScroll';
import { useDraggableScroll } from '@/lib/useDraggableScroll';
import {
  obtenerSaldosTodosClientes,
  procesarAbonoCliente,
  ResumenSaldoCliente,
} from '@/lib/clientBalance';
import {
  generarMensajeCobroIndividual,
  generarMensajeCobroFamiliar,
  obtenerConfiguracion,
  EVENTO_CONFIG_ACTUALIZADA,
  SistemaConfig,
} from '@/lib/whatsappConfig';

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

type MetodoCancelacionId = 'pago_movil' | 'efectivo_usd' | 'efectivo_bs' | 'zelle' | 'punto_debito' | 'saldo_favor';

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
    id: 'efectivo_bs' as MetodoCancelacionId,
    nombre: 'Efectivo Bs.',
    icono: Banknote,
    descripcion: 'Cobro en billetes bolívares en caja',
    moneda: 'Bs',
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
  const router = useRouter();
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
  const { ref: draggableFiltrosRef, events: draggableFiltrosEvents } = useDraggableScroll();

  // Acordeón de detalles por estudiante
  const [estudiantesDesplegados, setEstudiantesDesplegados] = useState<Record<string, boolean>>({});

  // Modal de liquidación con calculadora de vuelto y saldo a favor
  const [modalLiquidacion, setModalLiquidacion] = useState<{
    abierto: boolean;
    titulo: string;
    subtitulo: string;
    montoUsd: number;
    idsConsumos: string[];
    nombreEstudiante: string;
    clienteId?: string | null;
    montoRecibidoInput: string;
    dejarVueltoComoSaldo: boolean;
  }>({
    abierto: false,
    titulo: '',
    subtitulo: '',
    montoUsd: 0,
    idsConsumos: [],
    nombreEstudiante: '',
    clienteId: null,
    montoRecibidoInput: '',
    dejarVueltoComoSaldo: false,
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
  const [numeroReferenciaLiquidacion, setNumeroReferenciaLiquidacion] = useState<string>('');
  const [esPagoFamiliar, setEsPagoFamiliar] = useState<boolean>(false);
  const [ultimaReferenciaFamiliar, setUltimaReferenciaFamiliar] = useState<string>('');
  const [procesandoPago, setProcesandoPago] = useState<boolean>(false);
  const [errorPago, setErrorPago] = useState<string | null>(null);

  // Modal para Abonar / Depositar Saldo a Favor
  const [modalAbono, setModalAbono] = useState<{
    abierto: boolean;
    cliente: Cliente | null;
    montoUsd: string;
    montoBs: string;
    metodoPago: string;
    numeroReferencia: string;
    guardando: boolean;
    error: string | null;
  }>({
    abierto: false,
    cliente: null,
    montoUsd: '',
    montoBs: '',
    metodoPago: 'efectivo_usd',
    numeroReferencia: '',
    guardando: false,
    error: null,
  });

  const dragScrollAbono = useModalDragScroll({
    isOpen: modalAbono.abierto,
    onDismiss: () => setModalAbono((prev) => ({ ...prev, abierto: false })),
  });

  // Modal WhatsApp Consolidado Familiar
  const [modalWhatsAppFamiliar, setModalWhatsAppFamiliar] = useState<{
    abierto: boolean;
    cuentaPrincipal: CuentaEstudianteAgrupada | null;
    cuentasFamiliares: CuentaEstudianteAgrupada[];
    seleccionadosKeys: string[];
    telefonoDestino: string;
    nombreRepresentante: string;
    copiado: boolean;
  }>({
    abierto: false,
    cuentaPrincipal: null,
    cuentasFamiliares: [],
    seleccionadosKeys: [],
    telefonoDestino: '',
    nombreRepresentante: '',
    copiado: false,
  });

  const dragScrollWhatsApp = useModalDragScroll({
    isOpen: modalWhatsAppFamiliar.abierto,
    onDismiss: () => setModalWhatsAppFamiliar((prev) => ({ ...prev, abierto: false })),
  });

  // Notificación toast
  const [notificacion, setNotificacion] = useState<{ tipo: 'exito' | 'info'; texto: string } | null>(null);
  const [creandoDeudaMuestra, setCreandoDeudaMuestra] = useState<boolean>(false);

  // Configuración del sistema (plantillas de WhatsApp y datos de Pago Móvil)
  const [configuracionSistema, setConfiguracionSistema] = useState<SistemaConfig>(obtenerConfiguracion);

  useEffect(() => {
    setConfiguracionSistema(obtenerConfiguracion());
    const handler = (e: Event) => {
      const custom = e as CustomEvent<SistemaConfig>;
      if (custom.detail) {
        setConfiguracionSistema(custom.detail);
      }
    };
    window.addEventListener(EVENTO_CONFIG_ACTUALIZADA, handler);
    return () => window.removeEventListener(EVENTO_CONFIG_ACTUALIZADA, handler);
  }, []);

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
        setDeudas([]);
      } else {
        const registrosNormalizados: DeudaRegistro[] = (data || []).map((d: any) => {
          const cli = Array.isArray(d.clientes) ? d.clientes[0] || null : d.clientes || null;
          return {
            ...d,
            clientes: cli,
            monto_total_usd: Number(d.monto_total_usd) || 0,
            fecha: d.fecha || new Date().toISOString(),
            consumo_detalles: Array.isArray(d.consumo_detalles) ? d.consumo_detalles : [],
          };
        });
        setDeudas(registrosNormalizados);
      }
      setSaldosClientes(saldos || {});
      setTodosLosClientes(Array.isArray(clientesData) ? clientesData : []);
    } catch (e) {
      console.error('Excepción cargando consumos pendientes y saldos:', e);
      setDeudas([]);
    } finally {
      setCargandoDeudas(false);
    }
  }, []);

  useEffect(() => {
    setMontado(true);
    cargarTasa();
    cargarDeudas();

    // Sincronización en tiempo real con Supabase con debounce protector
    let timerRecarga: NodeJS.Timeout | null = null;
    const recargarConDebounce = () => {
      if (timerRecarga) clearTimeout(timerRecarga);
      timerRecarga = setTimeout(() => {
        cargarDeudas();
      }, 600);
    };

    const canalRealtime = supabase
      .channel('deudas_realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consumos' }, recargarConDebounce)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, recargarConDebounce)
      .subscribe();

    const handleMiniRecarga = () => {
      recargarConDebounce();
    };

    window.addEventListener(EVENTO_MINI_RECARGA, handleMiniRecarga);

    return () => {
      if (timerRecarga) clearTimeout(timerRecarga);
      window.removeEventListener(EVENTO_MINI_RECARGA, handleMiniRecarga);
      canalRealtime.unsubscribe();
      supabase.removeChannel(canalRealtime);
    };
  }, [cargarTasa, cargarDeudas]);

  // Lista única de Grados / Secciones para el selector desplegable
  const gradosDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const d of (deudas || [])) {
      const cli = Array.isArray(d.clientes) ? d.clientes[0] : d.clientes;
      if (cli?.grado_seccion) {
        set.add(cli.grado_seccion);
      }
    }
    return Array.from(set).sort();
  }, [deudas]);

  // Agrupar deudas pendientes por estudiante basado en clientes.saldo
  const cuentasAgrupadas = useMemo(() => {
    const mapa = new Map<string, CuentaEstudianteAgrupada>();

    for (const deuda of (deudas || [])) {
      if (!deuda || !deuda.id) continue;
      const key = deuda.cliente_id || `sin-cliente-${deuda.id}`;
      // Si el cliente tiene id, verificar si su cuenta corriente unificada tiene saldo negativo
      if (deuda.cliente_id) {
        const s = saldosClientes?.[deuda.cliente_id]?.saldoNetoUsd ?? deuda.clientes?.saldo ?? 0;
        // Si el cliente ya está solvente o a favor (saldo >= 0), no tiene deuda activa
        if (s >= 0) continue;
      }

      const clienteNormalizado = Array.isArray(deuda.clientes)
        ? deuda.clientes[0] || null
        : deuda.clientes || null;

      if (!mapa.has(key)) {
        mapa.set(key, {
          clienteKey: key,
          cliente: clienteNormalizado,
          totalDeudaUsd: 0,
          totalDeudaBs: 0,
          consumos: [],
          fechaMasReciente: deuda.fecha || new Date().toISOString(),
          fechaMasAntigua: deuda.fecha || new Date().toISOString(),
        });
      }

      const cuenta = mapa.get(key)!;
      cuenta.totalDeudaUsd += Number(deuda.monto_total_usd || 0);
      cuenta.consumos.push(deuda);

      const fDeudaTime = new Date(deuda.fecha).getTime();
      const fRecienteTime = new Date(cuenta.fechaMasReciente).getTime();
      const fAntiguaTime = new Date(cuenta.fechaMasAntigua).getTime();

      if (!isNaN(fDeudaTime)) {
        if (isNaN(fRecienteTime) || fDeudaTime > fRecienteTime) {
          cuenta.fechaMasReciente = deuda.fecha;
        }
        if (isNaN(fAntiguaTime) || fDeudaTime < fAntiguaTime) {
          cuenta.fechaMasAntigua = deuda.fecha;
        }
      }
    }

    // Asegurar que si un cliente tiene clientes.saldo < 0, su totalDeudaUsd refleje el saldo adeudado real
    for (const cuenta of mapa.values()) {
      if (cuenta.cliente?.id) {
        const s = saldosClientes?.[cuenta.cliente.id]?.saldoNetoUsd ?? cuenta.cliente.saldo;
        if (s !== undefined && s !== null && s < 0) {
          cuenta.totalDeudaUsd = Math.abs(s);
        }
      }
      cuenta.totalDeudaBs = calcularConversionBs(cuenta.totalDeudaUsd, tasaBcv);
      cuenta.consumos.sort((a, b) => {
        const tA = new Date(a.fecha).getTime();
        const tB = new Date(b.fecha).getTime();
        return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
      });
    }

    return Array.from(mapa.values());
  }, [deudas, tasaBcv, saldosClientes]);

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

  // Paginación en Cuentas por Cobrar
  const TAMANO_PAGINA_DEUDAS = 15;
  const [paginaActualDeudas, setPaginaActualDeudas] = useState<number>(1);

  useEffect(() => {
    setPaginaActualDeudas(1);
  }, [busqueda, filtroGrado, criterioOrden]);

  const totalPaginasDeudas = Math.max(1, Math.ceil(cuentasFiltradas.length / TAMANO_PAGINA_DEUDAS));

  const cuentasPaginadas = useMemo(() => {
    const inicio = (paginaActualDeudas - 1) * TAMANO_PAGINA_DEUDAS;
    return cuentasFiltradas.slice(inicio, inicio + TAMANO_PAGINA_DEUDAS);
  }, [cuentasFiltradas, paginaActualDeudas, TAMANO_PAGINA_DEUDAS]);

  // Totales globales de deudas y saldos leyendo directamente clientes.saldo
  const granTotalUsd = useMemo(() => {
    return todosLosClientes.reduce((acc, c) => {
      const s = c.saldo !== undefined && c.saldo !== null ? Number(c.saldo) : (saldosClientes[c.id]?.saldoNetoUsd || 0);
      return s < 0 ? acc + Math.abs(s) : acc;
    }, 0);
  }, [todosLosClientes, saldosClientes]);

  const granTotalBs = useMemo(() => {
    return calcularConversionBs(granTotalUsd, tasaBcv);
  }, [granTotalUsd, tasaBcv]);

  // Total global de saldos a favor (créditos positivos disponibles de todos los clientes)
  const totalSaldoAFavorGlobalUsd = useMemo(() => {
    return todosLosClientes.reduce((acc, c) => {
      const s = c.saldo !== undefined && c.saldo !== null ? Number(c.saldo) : (saldosClientes[c.id]?.saldoNetoUsd || 0);
      return s > 0 ? acc + s : acc;
    }, 0);
  }, [todosLosClientes, saldosClientes]);

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
      montoRecibidoInput: '',
      dejarVueltoComoSaldo: false,
    });
    setMetodoPago('pago_movil');
    setNumeroReferenciaLiquidacion('');
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
      montoRecibidoInput: '',
      dejarVueltoComoSaldo: false,
    });
    setMetodoPago('pago_movil');
    setNumeroReferenciaLiquidacion('');
    setErrorPago(null);
  };

  // Confirmar liquidación en Supabase con blindaje total, cálculo de vuelto y saldo a favor
  const handleConfirmarLiquidacion = async () => {
    const idsValidos = (modalLiquidacion.idsConsumos || []).filter(
      (id): id is string => typeof id === 'string' && id.trim().length > 0
    );

    if (idsValidos.length === 0) {
      setErrorPago('No se encontraron registros de consumos válidos para liquidar.');
      return;
    }

    const montoTotalLiquidado = Number(modalLiquidacion.montoUsd) || 0;
    const nombreClienteLiquidado = modalLiquidacion.nombreEstudiante || 'Estudiante';
    const clienteIdLiquidado = modalLiquidacion.clienteId || null;

    // Validación del monto entregado / recibido
    const montoRecibidoNum = parseFloat(modalLiquidacion.montoRecibidoInput.replace(',', '.')) || 0;
    if (montoRecibidoNum > 0 && montoRecibidoNum < montoTotalLiquidado) {
      setErrorPago(
        `El monto recibido (${formatUSD(montoRecibidoNum)}) es menor que la deuda total (${formatUSD(montoTotalLiquidado)}). Ingresa el monto completo o usa la opción 'Abonar' para pagos parciales.`
      );
      return;
    }

    const vueltoUsd =
      montoRecibidoNum > montoTotalLiquidado
        ? Math.round((montoRecibidoNum - montoTotalLiquidado) * 100) / 100
        : 0;
    const dejarVueltoComoSaldo = modalLiquidacion.dejarVueltoComoSaldo && vueltoUsd > 0;

    setProcesandoPago(true);
    setErrorPago(null);

    try {
      // Si el método seleccionado es saldo a favor, verificar que el cliente posea crédito suficiente
      if (metodoPago === 'saldo_favor') {
        const saldoDisponible = clienteIdLiquidado
          ? saldosClientes[clienteIdLiquidado]?.saldoAFavorTotalUsd || 0
          : 0;

        if (saldoDisponible < montoTotalLiquidado) {
          throw new Error(
            `Saldo a favor insuficiente (+${formatUSD(saldoDisponible)} disponible vs ${formatUSD(montoTotalLiquidado)} a liquidar). Usa la opción 'Abonar' para realizar un pago mixto o abonar la diferencia.`
          );
        }
      }

      let metodoFinal = metodoPago as string;
      const refLimpia = numeroReferenciaLiquidacion.trim();
      if (metodoPago === 'pago_movil' && refLimpia) {
        metodoFinal = esPagoFamiliar
          ? `pago_movil#ref:${refLimpia} [Pago Familiar]`
          : `pago_movil#ref:${refLimpia}`;
        setUltimaReferenciaFamiliar(refLimpia);
      }

      const { error: errorUpdateConsumos } = await supabase
        .from('consumos')
        .update({
          pagado: true,
          metodo_pago: metodoFinal,
        })
        .in('id', idsValidos);

      if (errorUpdateConsumos) {
        throw new Error(
          errorUpdateConsumos.message || 'Error al actualizar el estado de los consumos en Supabase'
        );
      }

      // Actualizar clientes.saldo en Supabase
      if (clienteIdLiquidado) {
        try {
          const { data: cli, error: cliErr } = await supabase
            .from('clientes')
            .select('saldo')
            .eq('id', clienteIdLiquidado)
            .maybeSingle();

          if (!cliErr && cli) {
            const saldoActual = Number(cli.saldo || 0);
            let nuevoSaldo = saldoActual;

            if (metodoPago === 'saldo_favor') {
              // Se pagó la deuda descontando de su saldo a favor existente
              nuevoSaldo = Math.round((saldoActual - montoTotalLiquidado) * 100) / 100;
            } else {
              // Se pagó con dinero externo (efectivo, pago móvil, etc.)
              // Salda la deuda (+montoTotalLiquidado) y si el cliente dejó vuelto como saldo a favor, se le suma (+vueltoUsd)
              const abonoExtra = dejarVueltoComoSaldo ? vueltoUsd : 0;
              nuevoSaldo = Math.round((saldoActual + montoTotalLiquidado + abonoExtra) * 100) / 100;
            }

            await supabase
              .from('clientes')
              .update({ saldo: nuevoSaldo })
              .eq('id', clienteIdLiquidado);
          }
        } catch (e) {
          console.error('Error actualizando clientes.saldo tras liquidar deuda:', e);
        }
      }

      // Si el cliente eligió dejar el vuelto como saldo a favor, registrar el abono en consumos para auditoría
      if (clienteIdLiquidado && dejarVueltoComoSaldo && vueltoUsd > 0) {
        try {
          let refVuelto = 'vuelto_saldo_favor';
          if (refLimpia) {
            refVuelto = `vuelto_saldo_favor#ref:${refLimpia}`;
          }
          await supabase.from('consumos').insert({
            cliente_id: clienteIdLiquidado,
            monto_total_usd: vueltoUsd,
            tasa_bcv_historica: tasaBcv,
            metodo_pago: refVuelto,
            pagado: true,
          });
        } catch (vueltoErr) {
          console.warn('Aviso guardando registro de vuelto en consumos:', vueltoErr);
        }
      }

      // Limpieza exhaustiva e inmediata del estado local para prevenir desincronización
      setModalLiquidacion({
        abierto: false,
        titulo: '',
        subtitulo: '',
        montoUsd: 0,
        idsConsumos: [],
        nombreEstudiante: '',
        clienteId: null,
        montoRecibidoInput: '',
        dejarVueltoComoSaldo: false,
      });
      setNumeroReferenciaLiquidacion('');
      setEsPagoFamiliar(false);
      setErrorPago(null);

      // Notificación toast informativa y precisa
      let textoNotif = `¡Deuda de ${nombreClienteLiquidado} por ${formatUSD(montoTotalLiquidado)} liquidada con éxito!`;
      if (dejarVueltoComoSaldo && vueltoUsd > 0) {
        textoNotif = `¡Deuda de ${nombreClienteLiquidado} por ${formatUSD(montoTotalLiquidado)} liquidada y vuelto de ${formatUSD(vueltoUsd)} acreditado como saldo a favor!`;
      } else if (vueltoUsd > 0) {
        const vueltoBs = calcularConversionBs(vueltoUsd, tasaBcv);
        textoNotif = `¡Deuda liquidada con éxito! Entregar vuelto de ${formatUSD(vueltoUsd)} (${formatBs(vueltoBs)}).`;
      }

      setNotificacion({
        tipo: 'exito',
        texto: textoNotif,
      });
      setTimeout(() => setNotificacion(null), 5000);

      try {
        await ejecutarMiniRecarga({
          router,
          recargarDatosLocales: async () => {
            await cargarDeudas();
          },
          mensaje: 'Liquidación completada y base de datos sincronizada',
        });
      } catch (syncErr) {
        console.error('Aviso: error sincronizando tras liquidación:', syncErr);
        await cargarDeudas();
      }
    } catch (err: unknown) {
      console.error('Error al procesar pago de liquidación:', err);
      setErrorPago(
        err instanceof Error
          ? err.message
          : 'Error inesperado al procesar la liquidación en Supabase.'
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
      montoBs: '',
      metodoPago: 'efectivo_usd',
      numeroReferencia: '',
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
        numeroReferencia: modalAbono.numeroReferencia,
        tasaBcv,
      });

      setModalAbono((prev) => ({ ...prev, abierto: false }));
      setNotificacion({
        tipo: 'exito',
        texto: res.mensaje,
      });
      setTimeout(() => setNotificacion(null), 4500);
      await ejecutarMiniRecarga({
        router,
        recargarDatosLocales: async () => {
          await cargarDeudas();
        },
      });
    } catch (err: unknown) {
      console.error('Error registrando abono:', err);
      setModalAbono((prev) => ({
        ...prev,
        guardando: false,
        error: err instanceof Error ? err.message : 'Error al registrar el abono.',
      }));
    }
  };

  /**
   * Agrupa estrictamente por NÚMERO DE TELÉFONO DE WHATSAPP (telefono_whatsapp) O representante_id.
   * Dos o más estudiantes SOLO pertenecen a la misma familia si comparten exactamente el mismo número telefónico registrado.
   * NUNCA agrupa por coincidencias de texto de nombre_representante o apellidos para evitar falsos positivos.
   */
  const obtenerGrupoFamiliarCuentas = useCallback(
    (cuentaPrincipal: CuentaEstudianteAgrupada, todasLasCuentas: CuentaEstudianteAgrupada[]) => {
      if (!cuentaPrincipal?.cliente) return [cuentaPrincipal];

      const telPrincipal = normalizarTelefonoWhatsApp(cuentaPrincipal.cliente.telefono_whatsapp);
      const repIdPrincipal = (cuentaPrincipal.cliente as any).representante_id || '';

      // Si no tiene número de teléfono WhatsApp válido ni representante_id, es un estudiante individual sin grupo familiar
      if (!telPrincipal && !repIdPrincipal) {
        return [cuentaPrincipal];
      }

      const familiares: CuentaEstudianteAgrupada[] = [cuentaPrincipal];

      for (const c of todasLasCuentas) {
        if (!c.cliente) continue;
        if (c.clienteKey === cuentaPrincipal.clienteKey) continue;

        let esMismaFamilia = false;

        // 1. Criterio Único Principal: Mismo número telefónico WhatsApp normalizado (limpiando espacios, guiones y prefijos)
        if (telPrincipal) {
          const telOtro = normalizarTelefonoWhatsApp(c.cliente.telefono_whatsapp);
          if (telOtro && telPrincipal === telOtro) {
            esMismaFamilia = true;
          }
        }

        // 2. Coincidencia por representante_id (si existiera en la base de datos)
        if (!esMismaFamilia && repIdPrincipal) {
          const repIdOtro = (c.cliente as any).representante_id || '';
          if (repIdOtro && repIdPrincipal === repIdOtro) {
            esMismaFamilia = true;
          }
        }

        if (esMismaFamilia) {
          familiares.push(c);
        }
      }

      return familiares;
    },
    []
  );

  /**
   * Genera el texto del mensaje para WhatsApp, unificando la deuda familiar
   * con formato limpio, desglose con nombres en paréntesis y datos de pago móvil oficiales.
   */
  const generarMensajeWhatsAppFamiliar = useCallback(
    ({
      nombreRepresentante,
      cuentas,
      tasaBcvActual,
    }: {
      nombreRepresentante: string;
      cuentas: CuentaEstudianteAgrupada[];
      tasaBcvActual: number;
    }): string => {
      if (cuentas.length === 0) return '';

      // Caso de 1 solo estudiante (o profesor/personal)
      if (cuentas.length === 1) {
        const cuenta = cuentas[0];
        const estudiante = cuenta.cliente?.nombre_estudiante || 'el estudiante';
        const rep = nombreRepresentante || cuenta.cliente?.nombre_representante || 'Estimado(a) Representante';
        const grado = cuenta.cliente?.grado_seccion ? `(${cuenta.cliente.grado_seccion})` : '';
        const esProf = esProfesorOPersonal(cuenta.cliente?.grado_seccion);

        return generarMensajeCobroIndividual({
          representante: rep,
          estudiante: estudiante,
          grado: grado,
          esProfesorOPersonal: esProf,
          consumos: cuenta.consumos,
          totalUsd: cuenta.totalDeudaUsd,
          totalBs: cuenta.totalDeudaBs,
          tasaBcv: tasaBcvActual,
          config: configuracionSistema,
        });
      }

      // Caso familiar consolidado (2 o más estudiantes)
      return generarMensajeCobroFamiliar({
        representante: nombreRepresentante,
        cuentas: cuentas,
        tasaBcv: tasaBcvActual,
        config: configuracionSistema,
      });
    },
    [configuracionSistema]
  );

  // Abrir modal unificado de WhatsApp (individual o consolidado familiar)
  const handleAbrirModalWhatsApp = (cuenta: CuentaEstudianteAgrupada) => {
    const grupo = obtenerGrupoFamiliarCuentas(cuenta, cuentasAgrupadas);

    // Teléfono de destino: el del estudiante actual
    const tel = (cuenta.cliente?.telefono_whatsapp || '').trim();

    // Nombre del representante del estudiante
    let rep = (cuenta.cliente?.nombre_representante || '').trim();
    if (!rep && grupo.length > 1) {
      const otroConRep = grupo.find((g) => g.cliente?.nombre_representante?.trim());
      if (otroConRep) {
        rep = otroConRep.cliente?.nombre_representante?.trim() || '';
      }
    }

    if (!rep) {
      rep = 'Estimado(a) Representante';
    }

    setModalWhatsAppFamiliar({
      abierto: true,
      cuentaPrincipal: cuenta,
      cuentasFamiliares: grupo,
      seleccionadosKeys: grupo.map((g) => g.clienteKey),
      telefonoDestino: tel,
      nombreRepresentante: rep,
      copiado: false,
    });
  };

  const handleToggleSeleccionEstudianteModal = (key: string) => {
    setModalWhatsAppFamiliar((prev) => {
      const yaEsta = prev.seleccionadosKeys.includes(key);
      const nuevasKeys = yaEsta
        ? prev.seleccionadosKeys.filter((k) => k !== key)
        : [...prev.seleccionadosKeys, key];
      return { ...prev, seleccionadosKeys: nuevasKeys };
    });
  };

  const handleEnviarMensajeModal = (soloPrincipal: boolean = false) => {
    if (!modalWhatsAppFamiliar.cuentaPrincipal) return;

    let cuentasAEnviar = modalWhatsAppFamiliar.cuentasFamiliares.filter((c) =>
      modalWhatsAppFamiliar.seleccionadosKeys.includes(c.clienteKey)
    );

    if (soloPrincipal || cuentasAEnviar.length === 0) {
      cuentasAEnviar = [modalWhatsAppFamiliar.cuentaPrincipal];
    }

    const mensaje = generarMensajeWhatsAppFamiliar({
      nombreRepresentante: modalWhatsAppFamiliar.nombreRepresentante,
      cuentas: cuentasAEnviar,
      tasaBcvActual: tasaBcv,
    });

    const telefonoLimpio = normalizarTelefonoWhatsApp(modalWhatsAppFamiliar.telefonoDestino);

    if (!telefonoLimpio) {
      navigator.clipboard.writeText(mensaje);
      setNotificacion({
        tipo: 'info',
        texto: 'No se detectó número WhatsApp válido. ¡Mensaje copiado al portapapeles!',
      });
      setTimeout(() => setNotificacion(null), 4000);
      return;
    }

    const url = `https://api.whatsapp.com/send?phone=${telefonoLimpio}&text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };

  const handleCopiarMensajeModal = () => {
    if (!modalWhatsAppFamiliar.cuentaPrincipal) return;

    let cuentasAEnviar = modalWhatsAppFamiliar.cuentasFamiliares.filter((c) =>
      modalWhatsAppFamiliar.seleccionadosKeys.includes(c.clienteKey)
    );

    if (cuentasAEnviar.length === 0) {
      cuentasAEnviar = [modalWhatsAppFamiliar.cuentaPrincipal];
    }

    const mensaje = generarMensajeWhatsAppFamiliar({
      nombreRepresentante: modalWhatsAppFamiliar.nombreRepresentante,
      cuentas: cuentasAEnviar,
      tasaBcvActual: tasaBcv,
    });

    navigator.clipboard.writeText(mensaje);
    setModalWhatsAppFamiliar((prev) => ({ ...prev, copiado: true }));
    setTimeout(() => {
      setModalWhatsAppFamiliar((prev) => ({ ...prev, copiado: false }));
    }, 3000);
    setNotificacion({
      tipo: 'exito',
      texto: '¡Mensaje copiado al portapapeles!',
    });
    setTimeout(() => setNotificacion(null), 3500);
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
    <ErrorBoundary
      fallbackTitle="Gestión de Cuentas por Cobrar"
      fallbackMessage="Ocurrió un error al procesar la vista de deudas. Tus datos siguen seguros en Supabase."
      onReset={() => cargarDeudas()}
    >
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

          {/* Botón Registrar Abono / Saldo a Favor */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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
          <div
            ref={draggableFiltrosRef}
            {...draggableFiltrosEvents}
            className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 w-full min-w-0 max-w-full touch-scroll-ios scrollbar-none select-none cursor-grab active:cursor-grabbing lg:w-auto"
          >
            {/* 1. Menú Desplegable Personalizado: Grado / Sección */}
            <Popover.Root open={popoverGradoAbierto} onOpenChange={setPopoverGradoAbierto}>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 shrink-0 whitespace-nowrap rounded-2xl border border-gray-200/90 bg-gray-50/70 px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-2xs hover:border-gray-300 hover:bg-white transition"
                >
                  <GraduationCap className="h-4 w-4 text-indigo-600 shrink-0" />
                  <span>
                    {filtroGrado === 'todos'
                      ? `Todos los Grados (${gradosDisponibles.length})`
                      : filtroGrado}
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 text-gray-400 shrink-0 transition-transform ${popoverGradoAbierto ? 'rotate-180 text-gray-700' : ''}`} />
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
                  className="flex items-center gap-2 shrink-0 whitespace-nowrap rounded-2xl border border-gray-200/90 bg-gray-50/70 px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-2xs hover:border-gray-300 hover:bg-white transition"
                >
                  <ArrowUpDown className="h-4 w-4 text-gray-500 shrink-0" />
                  <span>
                    {OPCIONES_ORDEN.find((o) => o.id === criterioOrden)?.label || 'Ordenar'}
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 text-gray-400 shrink-0 transition-transform ${popoverOrdenAbierto ? 'rotate-180 text-gray-700' : ''}`} />
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
              className="flex items-center gap-1.5 shrink-0 rounded-2xl border border-gray-200/80 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 transition disabled:opacity-60"
              title="Recargar deudas"
            >
              <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${cargandoDeudas ? 'animate-spin' : ''}`} />
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
              {cuentasPaginadas.map((cuenta, index) => {
                const abierto = !!estudiantesDesplegados[cuenta.clienteKey];
                const estudiante = cuenta.cliente?.nombre_estudiante || 'Venta General Ocasional';
                const grado = cuenta.cliente?.grado_seccion || 'Sin sección asignada';
                const esProf = esProfesorOPersonal(cuenta.cliente?.grado_seccion);
                const rep = cuenta.cliente?.nombre_representante;
                const tel = cuenta.cliente?.telefono_whatsapp;
                const saldoAFavorEstudiante = cuenta.cliente?.id
                  ? saldosClientes[cuenta.cliente.id]?.saldoAFavorTotalUsd || 0
                  : 0;

                const grupoFamiliar = obtenerGrupoFamiliarCuentas(cuenta, cuentasAgrupadas);
                const esFamiliaConVarios = grupoFamiliar.length > 1;

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
                            {/* Badge de Familia vinculada */}
                            {esFamiliaConVarios && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-800 shadow-2xs">
                                <Users className="h-3 w-3 text-purple-600" />
                                <span>Familia ({grupoFamiliar.length} estudiantes con deuda)</span>
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
                              <span className="inline-flex items-center gap-1 font-mono text-emerald-700 font-semibold">
                                <Phone className="h-3 w-3 shrink-0 text-emerald-600" />
                                <span>{tel}</span>
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
                          {/* Botón WhatsApp Consolidado Familiar */}
                          <button
                            type="button"
                            onClick={() => handleAbrirModalWhatsApp(cuenta)}
                            className={`flex items-center gap-1.5 rounded-2xl border px-3.5 py-2 text-xs font-bold shadow-2xs transition active:scale-95 ${
                              esFamiliaConVarios
                                ? 'border-purple-300 bg-purple-50 text-purple-800 hover:bg-purple-100 hover:border-purple-400'
                                : 'border-emerald-200/90 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-300'
                            }`}
                            title={
                              esFamiliaConVarios
                                ? `Reporte Consolidado Familiar (${grupoFamiliar.length} estudiantes)`
                                : 'Enviar resumen a WhatsApp'
                            }
                          >
                            {esFamiliaConVarios ? (
                              <Users className="h-4 w-4 text-purple-600" />
                            ) : (
                              <MessageCircle className="h-4 w-4 text-emerald-600" />
                            )}
                            <span>
                              {esFamiliaConVarios
                                ? `WhatsApp Familiar (${grupoFamiliar.length})`
                                : 'WhatsApp'}
                            </span>
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

            {/* Controles de Paginación para Cuentas por Cobrar */}
            {cuentasFiltradas.length > TAMANO_PAGINA_DEUDAS && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-3xl border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-3.5 sm:px-5 shadow-2xs mt-4">
                <div className="text-xs text-gray-500 dark:text-slate-400 text-center sm:text-left">
                  Mostrando <span className="font-bold text-gray-900 dark:text-slate-100">{(paginaActualDeudas - 1) * TAMANO_PAGINA_DEUDAS + 1}</span> -{' '}
                  <span className="font-bold text-gray-900 dark:text-slate-100">{Math.min(paginaActualDeudas * TAMANO_PAGINA_DEUDAS, cuentasFiltradas.length)}</span> de{' '}
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{cuentasFiltradas.length}</span> cuentas por cobrar
                </div>

                <div className="flex items-center gap-2 self-center sm:self-auto">
                  <button
                    type="button"
                    disabled={paginaActualDeudas <= 1}
                    onClick={() => setPaginaActualDeudas((p) => Math.max(1, p - 1))}
                    className="flex items-center gap-1 rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-[#111726] px-3.5 py-2 text-xs font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition active:scale-95"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Anterior</span>
                  </button>

                  <div className="px-3 py-1.5 rounded-xl bg-gray-100/70 dark:bg-slate-800 text-xs font-bold text-gray-700 dark:text-slate-300">
                    Página <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{paginaActualDeudas}</span> de{' '}
                    <span>{totalPaginasDeudas}</span>
                  </div>

                  <button
                    type="button"
                    disabled={paginaActualDeudas >= totalPaginasDeudas}
                    onClick={() => setPaginaActualDeudas((p) => Math.min(totalPaginasDeudas, p + 1))}
                    className="flex items-center gap-1 rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-[#111726] px-3.5 py-2 text-xs font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition active:scale-95"
                  >
                    <span>Siguiente</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
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
            className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain touch-scroll-ios rounded-t-3xl sm:rounded-3xl border-t sm:border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-4 sm:p-6 pb-28 sm:pb-6 shadow-2xl outline-none duration-300 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in-0 sm:zoom-in-95 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[95vw] sm:max-w-lg cursor-grab active:cursor-grabbing text-slate-900 dark:text-slate-100"
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
                <div className="mb-3 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/60 p-3 text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PiggyBank className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <p className="font-bold">Saldo a favor disponible del cliente:</p>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                        {saldoDisp >= modalLiquidacion.montoUsd
                          ? 'Cubre el 100% de esta liquidación'
                          : 'Cubre parcialmente esta deuda'}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-sm text-emerald-800 dark:text-emerald-200">
                    +{formatUSD(saldoDisp)}
                  </span>
                </div>
              );
            })()}

            {/* Campo "Monto Recibido ($)" y Calculadora de Vuelto en Liquidaciones */}
            <div className="mb-4 rounded-2xl border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#111726] p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Monto Recibido / Entregado ($)</span>
                </label>
                <span className="text-[10px] text-gray-400 dark:text-slate-500">
                  Opcional si entrega el monto exacto
                </span>
              </div>

              {/* Input con chips rápidos */}
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400 font-mono">
                  $
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={modalLiquidacion.montoRecibidoInput}
                  onKeyDown={(e) => handleDecimalKeyDown(e, modalLiquidacion.montoRecibidoInput)}
                  onChange={(e) =>
                    setModalLiquidacion((prev) => ({
                      ...prev,
                      montoRecibidoInput: sanitizeDecimalInput(e.target.value),
                    }))
                  }
                  placeholder={`Ej: ${modalLiquidacion.montoUsd.toFixed(2)} o billete entregado`}
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-900 py-2.5 pl-8 pr-8 text-sm font-mono font-bold text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none transition"
                />
                {modalLiquidacion.montoRecibidoInput && (
                  <button
                    type="button"
                    onClick={() =>
                      setModalLiquidacion((prev) => ({ ...prev, montoRecibidoInput: '' }))
                    }
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Botones de montos rápidos */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() =>
                    setModalLiquidacion((prev) => ({
                      ...prev,
                      montoRecibidoInput: prev.montoUsd.toFixed(2),
                    }))
                  }
                  className="rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 px-2 py-1 text-[11px] font-bold text-gray-700 dark:text-slate-300 transition active:scale-95"
                >
                  Exacto (${modalLiquidacion.montoUsd.toFixed(2)})
                </button>
                {(() => {
                  const deud = modalLiquidacion.montoUsd;
                  const chips: number[] = [];
                  const ceilVal = Math.ceil(deud);
                  if (ceilVal > deud) chips.push(ceilVal);
                  [5, 10, 20, 50, 100].forEach((billete) => {
                    if (billete > deud && !chips.includes(billete)) {
                      chips.push(billete);
                    }
                  });
                  return chips.slice(0, 4).map((billete) => (
                    <button
                      key={billete}
                      type="button"
                      onClick={() =>
                        setModalLiquidacion((prev) => ({
                          ...prev,
                          montoRecibidoInput: billete.toFixed(2),
                        }))
                      }
                      className="rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 px-2 py-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 transition active:scale-95"
                    >
                      ${billete}
                    </button>
                  ));
                })()}
              </div>

              {/* Cálculo en tiempo real: Vuelto o Advertencia de faltante */}
              {(() => {
                const montoRec = parseFloat(modalLiquidacion.montoRecibidoInput.replace(',', '.')) || 0;
                if (montoRec <= 0) return null;

                const diff = Math.round((montoRec - modalLiquidacion.montoUsd) * 100) / 100;

                if (diff > 0) {
                  const vueltoBs = calcularConversionBs(diff, tasaBcv);
                  return (
                    <div className="mt-3 space-y-2.5 animate-in fade-in">
                      {/* Tarjeta de Vuelto a entregar */}
                      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/90 dark:bg-emerald-950/70 p-3 text-xs flex items-center justify-between shadow-2xs">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold shrink-0">
                            <Banknote className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="font-bold text-emerald-950 dark:text-emerald-200 block">
                              Vuelto a entregar al cliente:
                            </span>
                            <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                              Equivalente: {formatBs(vueltoBs)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-base font-black text-emerald-800 dark:text-emerald-200">
                            {formatUSD(diff)}
                          </span>
                        </div>
                      </div>

                      {/* Switch / Checkbox para Dejar Vuelto como Saldo a Favor */}
                      <label className="flex items-start gap-2.5 rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/70 dark:bg-indigo-950/40 p-3 text-xs cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/40 transition select-none">
                        <input
                          type="checkbox"
                          checked={modalLiquidacion.dejarVueltoComoSaldo}
                          onChange={(e) =>
                            setModalLiquidacion((prev) => ({
                              ...prev,
                              dejarVueltoComoSaldo: e.target.checked,
                            }))
                          }
                          className="mt-0.5 h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div className="space-y-0.5">
                          <span className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                            <PiggyBank className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                            Dejar vuelto como saldo a favor (+{formatUSD(diff)})
                          </span>
                          <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/80 leading-snug">
                            No entregar vuelto en efectivo. Quedará acreditado inmediatamente en la cuenta del estudiante ({modalLiquidacion.nombreEstudiante}) para sus futuras compras en la cantina.
                          </p>
                        </div>
                      </label>
                    </div>
                  );
                }

                if (diff < 0) {
                  const falta = Math.abs(diff);
                  return (
                    <div className="mt-2 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/80 dark:bg-amber-950/50 p-2.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2 animate-in fade-in">
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Monto recibido menor que la deuda total:</p>
                        <p className="text-[11px] text-amber-800 dark:text-amber-300">
                          Faltan <strong>{formatUSD(falta)}</strong> ({formatBs(calcularConversionBs(falta, tasaBcv))}) para cubrir la liquidación completa. Para abonar parcialmente sin liquidar toda la cuenta, usa la opción <strong>&apos;Abonar&apos;</strong>.
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="mt-2 rounded-xl bg-gray-50 dark:bg-slate-800/60 p-2 text-[11px] text-gray-500 dark:text-slate-400 text-center">
                    ✓ Pago exacto ({formatUSD(montoRec)}) sin vuelto pendiente.
                  </div>
                );
              })()}
            </div>

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

              {/* Información bancaria oficial y número de referencia si seleccionan Pago Móvil */}
              {metodoPago === 'pago_movil' && (
                <div className="mt-3 space-y-2.5">
                  <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/40 p-3 text-xs text-indigo-950 dark:text-indigo-200">
                    <div className="font-bold flex items-center gap-1.5 mb-1 text-indigo-900 dark:text-indigo-300">
                      <Smartphone className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>Datos Oficiales Pago Móvil:</span>
                    </div>
                    <div className="space-y-0.5 text-[11px] font-mono">
                      <p><strong>Banco:</strong> BNC (Banco Nacional de Crédito - 0191)</p>
                      <p><strong>Cédula:</strong> 14953511</p>
                      <p><strong>Teléfono:</strong> 04125404830</p>
                      <p><strong>WhatsApp Referencia:</strong> 04123588848</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/70 dark:bg-sky-950/40 p-3 text-xs text-sky-950 dark:text-sky-200 animate-in fade-in space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-bold flex items-center gap-1.5 text-sky-900 dark:text-sky-300">
                        <Smartphone className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                        <span>Número de Referencia (Pago Móvil):</span>
                      </label>
                      <span className="text-[10px] text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/60 font-bold px-2 py-0.5 rounded-full">
                        Pago Móvil
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={numeroReferenciaLiquidacion}
                        onChange={(e) => setNumeroReferenciaLiquidacion(e.target.value)}
                        placeholder="Ej: 123456 o comprobante bancario"
                        className="w-full rounded-xl border border-sky-300 dark:border-sky-800 bg-white dark:bg-slate-900 py-2 pl-3 pr-8 text-xs font-mono font-bold text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-sky-500 focus:outline-none"
                      />
                      {numeroReferenciaLiquidacion && (
                        <button
                          type="button"
                          onClick={() => setNumeroReferenciaLiquidacion('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-sky-700 dark:text-sky-400 leading-tight">
                      Quedará guardado en la transacción de la base de datos para auditoría y consulta en el Historial.
                    </p>

                    {/* Soporte para Pago Familiar (Múltiples Hermanos) */}
                    <div className="mt-2 flex items-center justify-between rounded-xl bg-sky-100/70 dark:bg-sky-900/30 p-2.5">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-sky-700 dark:text-sky-300 shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-sky-950 dark:text-sky-200">
                            Pago Familiar (Hermanos)
                          </span>
                          <p className="text-[10px] text-sky-700 dark:text-sky-400">
                            Habilita compartir la misma transferencia/referencia entre hermanos.
                          </p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={esPagoFamiliar}
                        onChange={(e) => setEsPagoFamiliar(e.target.checked)}
                        className="h-4 w-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                      />
                    </div>

                    {ultimaReferenciaFamiliar && !numeroReferenciaLiquidacion && (
                      <button
                        type="button"
                        onClick={() => {
                          setNumeroReferenciaLiquidacion(ultimaReferenciaFamiliar);
                          setEsPagoFamiliar(true);
                        }}
                        className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-sky-700 dark:text-sky-300 hover:underline"
                      >
                        <Copy className="h-3 w-3" />
                        <span>Pegar referencia anterior: #{ultimaReferenciaFamiliar}</span>
                      </button>
                    )}
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
              {/* Selección del Cliente con ModernClientSelect */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Seleccionar Cliente o Estudiante *
                </label>
                <ModernClientSelect
                  clientes={todosLosClientes}
                  clienteSeleccionado={modalAbono.cliente}
                  onSeleccionarCliente={(c) =>
                    setModalAbono((prev) => ({ ...prev, cliente: c, error: null }))
                  }
                  saldosClientes={saldosClientes}
                  placeholder="-- Elige un cliente para abonar --"
                />
              </div>

              {/* Selector de Método de Pago con Autodetección de Divisa */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                    Método de Pago Entregado *
                  </label>
                  <span className="text-[10px] text-gray-500 dark:text-slate-400 font-mono">
                    Tasa: {formatBs(tasaBcv)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'efectivo_usd', label: 'Efectivo USD', sub: 'Cobro en $', moneda: 'USD', icono: DollarSign },
                    { id: 'efectivo_bs', label: 'Efectivo Bs.', sub: 'Billetes (Bs)', moneda: 'Bs', icono: Banknote },
                    { id: 'pago_movil', label: 'Pago Móvil', sub: 'Bolívares (Bs)', moneda: 'Bs', icono: Smartphone },
                    { id: 'punto_debito', label: 'Punto de Venta', sub: 'Tarjeta Débito (Bs)', moneda: 'Bs', icono: CreditCard },
                    { id: 'zelle', label: 'Zelle', sub: 'Transferencia $', moneda: 'USD', icono: Wallet },
                  ].map((met) => {
                    const seleccionado = modalAbono.metodoPago === met.id;
                    const Icono = met.icono;
                    return (
                      <button
                        key={met.id}
                        type="button"
                        onClick={() => {
                          setModalAbono((prev) => {
                            let nuevoBs = prev.montoBs;
                            let nuevoUsd = prev.montoUsd;
                            if (met.moneda === 'Bs' && (!nuevoBs || nuevoBs === '0') && nuevoUsd) {
                              const val = parseFloat(nuevoUsd.replace(',', '.'));
                              if (val > 0) nuevoBs = (val * tasaBcv).toFixed(2);
                            } else if (met.moneda === 'USD' && (!nuevoUsd || nuevoUsd === '0') && nuevoBs) {
                              const val = parseFloat(nuevoBs.replace(',', '.'));
                              if (val > 0) nuevoUsd = (val / tasaBcv).toFixed(2);
                            }
                            return { ...prev, metodoPago: met.id, montoBs: nuevoBs, montoUsd: nuevoUsd, error: null };
                          });
                        }}
                        className={`flex items-center gap-2 p-2.5 rounded-2xl border text-left transition-all ${
                          seleccionado
                            ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 ring-2 ring-indigo-500/20 shadow-xs'
                            : 'border-gray-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-700 hover:bg-gray-50/50'
                        }`}
                      >
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                            seleccionado
                              ? 'bg-indigo-600 text-white'
                              : met.moneda === 'Bs'
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                              : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          <Icono className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold truncate">{met.label}</span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                                met.moneda === 'Bs'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                              }`}
                            >
                              {met.moneda}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-500 dark:text-slate-400 truncate">{met.sub}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Campo para Número de Referencia si es Pago Móvil */}
              {modalAbono.metodoPago === 'pago_movil' && (
                <div className="rounded-2xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/70 dark:bg-sky-950/40 p-3 text-xs text-sky-950 dark:text-sky-200 animate-in fade-in space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold flex items-center gap-1.5 text-sky-900 dark:text-sky-300">
                      <Smartphone className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                      <span>Número de Referencia (Pago Móvil):</span>
                    </label>
                    <span className="text-[10px] text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/60 font-bold px-2 py-0.5 rounded-full">
                      Pago Móvil
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={modalAbono.numeroReferencia}
                      onChange={(e) => setModalAbono((prev) => ({ ...prev, numeroReferencia: e.target.value }))}
                      placeholder="Ej: 123456 o comprobante bancario"
                      className="w-full rounded-xl border border-sky-300 dark:border-sky-800 bg-white dark:bg-slate-900 py-2 pl-3 pr-8 text-xs font-mono font-bold text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-sky-500 focus:outline-none"
                    />
                    {modalAbono.numeroReferencia && (
                      <button
                        type="button"
                        onClick={() => setModalAbono((prev) => ({ ...prev, numeroReferencia: '' }))}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-sky-700 dark:text-sky-400 leading-tight">
                    Quedará registrado en la transacción para conciliación contable en el Historial de Transacciones.
                  </p>
                </div>
              )}

              {/* Inputs de Monto Bimoneda con Validación Numérica Estricta */}
              {(() => {
                const esMetodoBs = modalAbono.metodoPago === 'pago_movil' || modalAbono.metodoPago === 'punto_debito' || modalAbono.metodoPago === 'efectivo_bs';

                return (
                  <div className="rounded-2xl border border-gray-200/90 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-900/60 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-800 dark:text-slate-200">
                        {esMetodoBs ? 'Monto a Abonar (Bolívares / Dólares)' : 'Monto a Abonar (Dólares / Bolívares)'}
                      </label>
                      <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full">
                        {esMetodoBs ? '🇻🇪 Entrada en Bs. detectada' : '💵 Entrada en USD'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Campo Bolívares (Bs.) */}
                      <div>
                        <span className="text-[11px] font-semibold text-gray-600 dark:text-slate-400 block mb-1">
                          Monto en Bolívares (Bs.)
                        </span>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-600 dark:text-amber-400">
                            Bs.
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={modalAbono.montoBs}
                            onKeyDown={(e) => handleDecimalKeyDown(e, modalAbono.montoBs)}
                            onChange={(e) => {
                              const sanitized = sanitizeDecimalInput(e.target.value);
                              const numBs = parseFloat(sanitized);
                              const usd = sanitized && !isNaN(numBs) && numBs > 0 && tasaBcv > 0
                                ? (numBs / tasaBcv).toFixed(2)
                                : '';
                              setModalAbono((prev) => ({
                                ...prev,
                                montoBs: sanitized,
                                montoUsd: usd,
                                error: null,
                              }));
                            }}
                            placeholder="0,00"
                            className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#111726] py-2 pl-9 pr-3 text-xs font-mono font-bold text-gray-900 dark:text-slate-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950 outline-none"
                            autoFocus={esMetodoBs}
                          />
                        </div>
                      </div>

                      {/* Campo Dólares ($ USD) */}
                      <div>
                        <span className="text-[11px] font-semibold text-gray-600 dark:text-slate-400 block mb-1">
                          Equivalente en Dólares ($ USD)
                        </span>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            $
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={modalAbono.montoUsd}
                            onKeyDown={(e) => handleDecimalKeyDown(e, modalAbono.montoUsd)}
                            onChange={(e) => {
                              const sanitized = sanitizeDecimalInput(e.target.value);
                              const numUsd = parseFloat(sanitized);
                              const bs = sanitized && !isNaN(numUsd) && numUsd > 0 && tasaBcv > 0
                                ? (numUsd * tasaBcv).toFixed(2)
                                : '';
                              setModalAbono((prev) => ({
                                ...prev,
                                montoUsd: sanitized,
                                montoBs: bs,
                                error: null,
                              }));
                            }}
                            placeholder="0.00"
                            className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#111726] py-2 pl-7 pr-3 text-xs font-mono font-bold text-gray-900 dark:text-slate-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950 outline-none"
                            autoFocus={!esMetodoBs}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Desglose Multimoneda Transparente y Validación de Reglas Financieras */}
              {(() => {
                const montoNumUsd = parseFloat(modalAbono.montoUsd.replace(',', '.')) || 0;
                const montoNumBs = parseFloat(modalAbono.montoBs.replace(',', '.')) || (montoNumUsd > 0 ? calcularConversionBs(montoNumUsd, tasaBcv) : 0);
                if (montoNumUsd <= 0 || !modalAbono.cliente) return null;

                const s = modalAbono.cliente.saldo !== undefined && modalAbono.cliente.saldo !== null
                  ? Number(modalAbono.cliente.saldo)
                  : (saldosClientes[modalAbono.cliente.id]?.saldoNetoUsd || 0);
                const deudaActualUsd = s < 0 ? Math.abs(s) : 0;
                const deudaActualBs = calcularConversionBs(deudaActualUsd, tasaBcv);

                return (
                  <div className="rounded-2xl border border-indigo-200/90 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/40 dark:from-slate-900 dark:via-[#111726] dark:to-slate-900 p-3.5 space-y-2.5 text-xs shadow-xs">
                    <div className="flex items-center justify-between border-b border-indigo-100/80 dark:border-indigo-950 pb-2">
                      <span className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        Desglose Multimoneda de la Transacción:
                      </span>
                      <span className="font-mono text-[10px] text-gray-500 dark:text-slate-400">
                        1 USD = {formatBs(tasaBcv)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-gray-500 dark:text-slate-400 block">Total en USD:</span>
                        <span className="font-mono font-black text-sm text-gray-900 dark:text-slate-100">
                          {formatUSD(montoNumUsd)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 dark:text-slate-400 block">Total en Bolívares:</span>
                        <span className="font-mono font-black text-sm text-amber-700 dark:text-amber-400">
                          {formatBs(montoNumBs)}
                        </span>
                      </div>
                    </div>

                    {/* Explicación de Liquidación */}
                    <div className="pt-2 border-t border-indigo-100/60 dark:border-indigo-950/60 space-y-1">
                      {deudaActualUsd > 0 ? (
                        montoNumUsd >= deudaActualUsd ? (
                          <>
                            <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold flex items-center gap-1">
                              <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              Se liquida el 100% de la deuda: {formatUSD(deudaActualUsd)} ({formatBs(deudaActualBs)}).
                            </p>
                            {montoNumUsd > deudaActualUsd ? (
                              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                                <PiggyBank className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                Sobrante a Saldo a Favor: +{formatUSD(Math.round((montoNumUsd - deudaActualUsd) * 100) / 100)} (+{formatBs(calcularConversionBs(montoNumUsd - deudaActualUsd, tasaBcv))}).
                              </p>
                            ) : (
                              <p className="text-[11px] text-gray-600 dark:text-slate-400">
                                La cuenta quedará totalmente solvente ($0.00 / Bs. 0,00).
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold">
                              Abono parcial a deuda: Se descuentan {formatUSD(montoNumUsd)} ({formatBs(montoNumBs)}).
                            </p>
                            <p className="text-[11px] text-gray-600 dark:text-slate-400">
                              Deuda restante: {formatUSD(Math.round((deudaActualUsd - montoNumUsd) * 100) / 100)} ({formatBs(calcularConversionBs(deudaActualUsd - montoNumUsd, tasaBcv))}).
                            </p>
                          </>
                        )
                      ) : (
                        <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold flex items-center gap-1">
                          <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          Sin deuda previa: El 100% (+{formatUSD(montoNumUsd)} / +{formatBs(montoNumBs)}) se acreditará como Saldo a Favor disponible.
                        </p>
                      )}
                    </div>
                  </div>
                );
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

      {/* Modal Reporte Consolidado Familiar para WhatsApp (Radix UI Dialog) */}
      <Dialog.Root
        open={modalWhatsAppFamiliar.abierto}
        onOpenChange={(abierto) =>
          setModalWhatsAppFamiliar((prev) => ({ ...prev, abierto }))
        }
      >
        <Dialog.Portal>
          <Dialog.Overlay
            {...dragScrollWhatsApp.overlayProps}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          />
          <Dialog.Content
            style={dragScrollWhatsApp.style}
            {...dragScrollWhatsApp.dragProps}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto overscroll-contain touch-scroll-ios rounded-t-3xl sm:rounded-3xl border-t sm:border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-4 sm:p-6 pb-28 sm:pb-6 shadow-2xl outline-none duration-300 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in-0 sm:zoom-in-95 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[95vw] sm:max-w-xl cursor-grab active:cursor-grabbing"
          >
            {/* Manija táctil */}
            <div className="mx-auto mb-3 -mt-1 flex h-6 w-full cursor-grab active:cursor-grabbing items-center justify-center sm:hidden touch-none">
              <div className="h-1.5 w-12 rounded-full bg-gray-300 dark:bg-slate-700" />
            </div>

            {modalWhatsAppFamiliar.cuentaPrincipal && (() => {
              const esGrupoFamiliar = modalWhatsAppFamiliar.cuentasFamiliares.length > 1;
              const cuentasSeleccionadas = modalWhatsAppFamiliar.cuentasFamiliares.filter((c) =>
                modalWhatsAppFamiliar.seleccionadosKeys.includes(c.clienteKey)
              );
              const cuentasParaMensaje =
                cuentasSeleccionadas.length > 0
                  ? cuentasSeleccionadas
                  : [modalWhatsAppFamiliar.cuentaPrincipal];

              const totalUsdFamiliar = cuentasParaMensaje.reduce((acc, c) => acc + c.totalDeudaUsd, 0);
              const totalBsFamiliar = calcularConversionBs(totalUsdFamiliar, tasaBcv);

              const mensajeVistaPrevia = generarMensajeWhatsAppFamiliar({
                nombreRepresentante: modalWhatsAppFamiliar.nombreRepresentante,
                cuentas: cuentasParaMensaje,
                tasaBcvActual: tasaBcv,
              });

              return (
                <div className="space-y-4 text-xs">
                  {/* Encabezado del Modal */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 shadow-2xs">
                      {esGrupoFamiliar ? (
                        <Users className="h-6 w-6" />
                      ) : (
                        <MessageCircle className="h-6 w-6" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <Dialog.Title className="text-base font-bold text-gray-900 dark:text-slate-100">
                        {esGrupoFamiliar
                          ? 'Reporte Consolidado Familiar (WhatsApp)'
                          : 'Reporte de Cuenta para WhatsApp'}
                      </Dialog.Title>
                      <Dialog.Description className="text-xs text-gray-500 dark:text-slate-400 truncate">
                        {esGrupoFamiliar
                          ? `Se unifican ${modalWhatsAppFamiliar.cuentasFamiliares.length} estudiantes vinculados en un solo mensaje profesional.`
                          : `Resumen de consumos pendientes para ${modalWhatsAppFamiliar.cuentaPrincipal.cliente?.nombre_estudiante || 'el estudiante'}.`}
                      </Dialog.Description>
                    </div>
                  </div>

                  {/* Banner de Familia Detectada con Checkboxes */}
                  {esGrupoFamiliar && (
                    <div className="rounded-2xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/60 dark:bg-purple-950/30 p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-purple-900 dark:text-purple-300 text-[11px] flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                          Estudiantes Vinculados al Representante:
                        </span>
                        <span className="font-mono text-[10px] text-purple-700 dark:text-purple-300 font-bold">
                          {cuentasSeleccionadas.length} de {modalWhatsAppFamiliar.cuentasFamiliares.length} incluidos
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {modalWhatsAppFamiliar.cuentasFamiliares.map((c) => {
                          const estaSeleccionado = modalWhatsAppFamiliar.seleccionadosKeys.includes(c.clienteKey);
                          const esPrincipal = c.clienteKey === modalWhatsAppFamiliar.cuentaPrincipal?.clienteKey;

                          return (
                            <div
                              key={c.clienteKey}
                              onClick={() => handleToggleSeleccionEstudianteModal(c.clienteKey)}
                              className={`flex items-center justify-between p-2 rounded-xl border cursor-pointer transition select-none ${
                                estaSeleccionado
                                  ? 'border-purple-300 bg-white dark:bg-[#111726] shadow-2xs'
                                  : 'border-purple-100 dark:border-purple-900/40 bg-purple-50/40 dark:bg-purple-950/10 opacity-60'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border text-white transition ${
                                    estaSeleccionado
                                      ? 'border-purple-600 bg-purple-600'
                                      : 'border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800'
                                  }`}
                                >
                                  {estaSeleccionado && <Check className="h-3 w-3 stroke-[3]" />}
                                </div>
                                <div className="truncate">
                                  <span className="font-bold text-gray-900 dark:text-slate-100 text-xs">
                                    {c.cliente?.nombre_estudiante}
                                  </span>
                                  {c.cliente?.grado_seccion && (
                                    <span className="text-[10px] text-gray-500 ml-1.5 font-medium">
                                      ({c.cliente.grado_seccion})
                                    </span>
                                  )}
                                  {esPrincipal && (
                                    <span className="ml-1.5 rounded-full bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 text-[9px] font-bold text-indigo-700">
                                      Seleccionado
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="font-mono font-bold text-gray-900 dark:text-slate-100 text-xs block">
                                  {formatUSD(c.totalDeudaUsd)}
                                </span>
                                <span className="font-mono text-[10px] text-amber-700 dark:text-amber-400 block">
                                  {formatBs(c.totalDeudaBs)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Campos de Representante y Teléfono destino */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 block mb-1">
                        Nombre Representante / Familia:
                      </label>
                      <input
                        type="text"
                        value={modalWhatsAppFamiliar.nombreRepresentante}
                        onChange={(e) =>
                          setModalWhatsAppFamiliar((prev) => ({
                            ...prev,
                            nombreRepresentante: e.target.value,
                          }))
                        }
                        placeholder="Ej: Juan Pérez"
                        className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/60 dark:bg-[#111726] px-3 py-2 text-xs font-medium text-gray-900 dark:text-slate-100 outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-[#0D111A]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 block mb-1">
                        Teléfono WhatsApp de Envío:
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-600" />
                        <input
                          type="text"
                          value={modalWhatsAppFamiliar.telefonoDestino}
                          onChange={(e) =>
                            setModalWhatsAppFamiliar((prev) => ({
                              ...prev,
                              telefonoDestino: e.target.value,
                            }))
                          }
                          placeholder="Ej: 04125404830 o +58..."
                          className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/60 dark:bg-[#111726] pl-8 pr-3 py-2 text-xs font-mono font-medium text-gray-900 dark:text-slate-100 outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-[#0D111A]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Resumen Total y Totales Familiares */}
                  <div className="flex items-center justify-between rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 block">
                        {esGrupoFamiliar ? 'Gran Total Familiar a Pagar:' : 'Total de la Cuenta a Pagar:'}
                      </span>
                      <span className="text-[11px] text-gray-500 dark:text-slate-400">
                        {cuentasParaMensaje.length} {cuentasParaMensaje.length === 1 ? 'estudiante' : 'estudiantes'} &bull; Tasa BCV: {formatBs(tasaBcv)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-black text-lg text-gray-900 dark:text-slate-100 block">
                        {formatUSD(totalUsdFamiliar)}
                      </span>
                      <span className="font-mono font-bold text-xs text-amber-700 dark:text-amber-400 block">
                        {formatBs(totalBsFamiliar)}
                      </span>
                    </div>
                  </div>

                  {/* Vista Previa del Mensaje formateado */}
                  <div>
                    <div className="flex items-center justify-between text-gray-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1 px-1">
                      <span>Vista previa del mensaje a enviar:</span>
                      <span className="text-emerald-700 dark:text-emerald-400">Formato limpio Club 5</span>
                    </div>
                    <div className="rounded-2xl border border-gray-200/90 dark:border-slate-800 bg-[#EFEAE2]/60 dark:bg-[#0B141A] p-3 text-[11px] font-sans text-gray-800 dark:text-slate-200 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-inner">
                      {mensajeVistaPrevia}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-slate-800 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setModalWhatsAppFamiliar((prev) => ({ ...prev, abierto: false }))}
                        className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#111726] px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 transition"
                      >
                        Cerrar
                      </button>

                      <button
                        type="button"
                        onClick={handleCopiarMensajeModal}
                        className="flex items-center gap-1 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#111726] px-3.5 py-2 text-xs font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-50 transition active:scale-95 shadow-2xs"
                      >
                        {modalWhatsAppFamiliar.copiado ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="text-emerald-600">¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 text-gray-500" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {esGrupoFamiliar && (
                        <button
                          type="button"
                          onClick={() => handleEnviarMensajeModal(true)}
                          className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#111726] px-3 py-2 text-xs font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 transition"
                          title="Enviar solo el reporte individual del estudiante seleccionado"
                        >
                          Solo {modalWhatsAppFamiliar.cuentaPrincipal?.cliente?.nombre_estudiante?.split(' ')[0]}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleEnviarMensajeModal(false)}
                        className="flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition active:scale-95"
                      >
                        <MessageCircle className="h-4 w-4" />
                        <span>
                          {esGrupoFamiliar
                            ? `Enviar Familiar (${formatUSD(totalUsdFamiliar)})`
                            : `Enviar WhatsApp (${formatUSD(totalUsdFamiliar)})`}
                        </span>
                      </button>
                    </div>
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
