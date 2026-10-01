'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ejecutarMiniRecarga, EVENTO_MINI_RECARGA } from '@/lib/syncUtils';
import * as Dialog from '@radix-ui/react-dialog';
import * as Popover from '@radix-ui/react-popover';
import {
  Users,
  UserPlus,
  Search,
  GraduationCap,
  Phone,
  User,
  MessageCircle,
  Pencil,
  Trash2,
  Receipt,
  TrendingUp,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ShieldCheck,
  ExternalLink,
  Briefcase,
  BookOpen,
  ArrowLeft,
  PlusCircle,
  Menu,
  Wallet,
  PiggyBank,
  Coins,
  Sparkles,
  DollarSign,
  Smartphone,
  CreditCard,
  Banknote,
  History,
  RotateCcw,
  FileText,
  Hash,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { obtenerTasaBCV, TASA_BCV_FALLBACK_DEFAULT } from '@/lib/dolarApi';
import {
  formatUSD,
  formatBs,
  calcularConversionBs,
  calcularConversionUSD,
  sanitizeDecimalInput,
  handleDecimalKeyDown,
} from '@/lib/utils';
import { NotificationBell } from '@/components/NotificationBell';
import { refrescarNotificacionesGlobales } from '@/components/NotificationsContext';
import { useSidebar } from '@/components/SidebarContext';
import { FlagIcon } from '@/components/FlagIcon';
import {
  PREFIJOS_TELEFONICOS,
  CATEGORIAS_NIVELES,
  CATEGORIAS_DOS_PASOS,
  SECCIONES_PREDETERMINADAS,
  TODOS_LOS_GRADOS_SISTEMA,
  esProfesorOPersonal,
  esRepresentante,
  esAdultoOPersonal,
  separarGradoYSeccion,
  obtenerCategoriaDeGrado,
  separarTelefonoPrefijo,
  unirTelefonoPrefijo,
  encontrarVinculosCliente,
  VinculoCliente,
} from '@/lib/constants';
import { Cliente } from '@/types/pos';
import { useModalDragScroll } from '@/lib/useModalDragScroll';
import { useDraggableScroll } from '@/lib/useDraggableScroll';
import {
  obtenerSaldosTodosClientes,
  procesarAbonoCliente,
  anularConsumo,
  parseConsumoAudit,
  ResumenSaldoCliente,
} from '@/lib/clientBalance';

export default function EstudiantesPage() {
  const router = useRouter();
  const [montado, setMontado] = useState(false);
  const { toggleSidebar, abierto: sidebarAbierto } = useSidebar();

  // Tasa BCV
  const [tasaBcv, setTasaBcv] = useState<number>(TASA_BCV_FALLBACK_DEFAULT);
  const [cargandoTasa, setCargandoTasa] = useState<boolean>(true);

  // 2. Clientes y Paginación en Servidor (.range)
  const TAMANO_PAGINA_ESTUDIANTES = 24;
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargandoClientes, setCargandoClientes] = useState<boolean>(true);
  const [cargandoMas, setCargandoMas] = useState<boolean>(false);
  const [paginaActual, setPaginaActual] = useState<number>(1);
  const [totalEstudiantesDb, setTotalEstudiantesDb] = useState<number>(0);
  const [saldosClientes, setSaldosClientes] = useState<Record<string, ResumenSaldoCliente>>({});

  // Directorio completo ligero para vinculación familiar y grados
  const [directorioContactos, setDirectorioContactos] = useState<{
    id: string;
    nombre_estudiante: string;
    grado_seccion?: string | null;
    nombre_representante?: string | null;
    telefono_whatsapp?: string | null;
    saldo?: number;
  }[]>([]);

  // Métricas financieras globales del directorio escolar
  const [metricasGlobales, setMetricasGlobales] = useState({
    totalEstudiantes: 0,
    estudiantesConDeuda: 0,
    estudiantesConSaldoFavor: 0,
    totalDeudaGlobalUsd: 0,
    totalSaldoAFavorGlobalUsd: 0,
  });

  // 3. Filtros y Búsqueda con Debounce
  const [busqueda, setBusqueda] = useState<string>('');
  const [busquedaDebounced, setBusquedaDebounced] = useState<string>('');
  const [filtroGrado, setFiltroGrado] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'con_deuda' | 'con_saldo_favor' | 'solvente'>('todos');
  const [popoverGradoAbierto, setPopoverGradoAbierto] = useState<boolean>(false);
  const { ref: draggableFiltrosRef, events: draggableFiltrosEvents } = useDraggableScroll();

  // Notificaciones Toast
  const [notificacion, setNotificacion] = useState<{ tipo: 'exito' | 'info' | 'error'; texto: string } | null>(null);

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

  // Modal Crear / Editar
  const [modalForm, setModalForm] = useState<{
    abierto: boolean;
    modo: 'crear' | 'editar';
    id?: string;
    nombre_estudiante: string;
    grado_seccion: string;
    grado_personalizado: string;
    nombre_representante: string;
    telefono_prefijo: string;
    telefono_numero: string;
    guardando: boolean;
    error: string | null;
  }>({
    abierto: false,
    modo: 'crear',
    nombre_estudiante: '',
    grado_seccion: '1era Sala',
    grado_personalizado: '',
    nombre_representante: '',
    telefono_prefijo: '+58',
    telefono_numero: '',
    guardando: false,
    error: null,
  });

  // Estados interactivos para los selectores del modal (evita selects nativos largos)
  const [popoverGradoModalAbierto, setPopoverGradoModalAbierto] = useState<boolean>(false);
  const [categoriaActivaModal, setCategoriaActivaModal] = useState<string>('primaria');
  const [popoverPrefijoModalAbierto, setPopoverPrefijoModalAbierto] = useState<boolean>(false);

  // Estados para selector de dos pasos (Paso 1: Nivel/Año -> Paso 2: Secciones A a E)
  const [pasoSelectorGrado, setPasoSelectorGrado] = useState<'grados' | 'secciones'>('grados');
  const [gradoBaseSeleccionado, setGradoBaseSeleccionado] = useState<string>('1er Grado');
  const [seccionPersonalizadaInput, setSeccionPersonalizadaInput] = useState<string>('');
  const [mostrandoInputSeccionExtra, setMostrandoInputSeccionExtra] = useState<boolean>(false);

  // Categoría actual del grado seleccionado
  const categoriaActualObj = useMemo(() => {
    const val = modalForm.grado_seccion === 'otro' ? modalForm.grado_personalizado : modalForm.grado_seccion;
    const catId = obtenerCategoriaDeGrado(val);
    return CATEGORIAS_DOS_PASOS.find((c) => c.id === catId) || CATEGORIAS_DOS_PASOS[1];
  }, [modalForm.grado_seccion, modalForm.grado_personalizado]);

  // Categoría de dos pasos que se está explorando en el selector
  const categoriaDosPasosActiva = useMemo(() => {
    return (
      CATEGORIAS_DOS_PASOS.find((c) => c.id === categoriaActivaModal) ||
      CATEGORIAS_DOS_PASOS[1]
    );
  }, [categoriaActivaModal]);

  // Objeto de prefijo telefónico seleccionado
  const prefijoSeleccionadoObj = useMemo(() => {
    return (
      PREFIJOS_TELEFONICOS.find((p) => p.codigo === modalForm.telefono_prefijo) ||
      PREFIJOS_TELEFONICOS[0]
    );
  }, [modalForm.telefono_prefijo]);

  // Detección en tiempo real de vínculos familiares en el modal
  const vinculosDetectadosModal = useMemo(() => {
    if (!modalForm.abierto) return [];
    return encontrarVinculosCliente(
      {
        id: modalForm.id,
        nombre_estudiante: modalForm.nombre_estudiante,
        grado_seccion: modalForm.grado_seccion === 'otro' ? modalForm.grado_personalizado : modalForm.grado_seccion,
        nombre_representante: modalForm.nombre_representante,
        telefono_whatsapp: unirTelefonoPrefijo(modalForm.telefono_prefijo, modalForm.telefono_numero),
      },
      clientes
    );
  }, [modalForm, clientes]);

  // Validación: Detección en tiempo real de representante duplicado con el mismo teléfono
  const representanteDuplicado = useMemo(() => {
    if (!modalForm.abierto) return null;
    const gradoActual =
      modalForm.grado_seccion === 'otro'
        ? modalForm.grado_personalizado
        : modalForm.grado_seccion;
    if (!esRepresentante(gradoActual)) return null;

    const telNum = modalForm.telefono_numero.trim().replace(/\D/g, '');
    if (telNum.length < 7) return null;

    const telCompleto = unirTelefonoPrefijo(modalForm.telefono_prefijo, modalForm.telefono_numero);
    if (!telCompleto) return null;
    const telLimpio = telCompleto.replace(/\D/g, '');

    return (
      clientes.find((c) => {
        if (modalForm.id && c.id === modalForm.id) return false;
        if (!esRepresentante(c.grado_seccion)) return false;
        const cTel = (c.telefono_whatsapp || '').replace(/\D/g, '');
        if (cTel.length < 7) return false;
        return (
          telLimpio === cTel ||
          telLimpio.endsWith(cTel.slice(-8)) ||
          cTel.endsWith(telLimpio.slice(-8))
        );
      }) || null
    );
  }, [modalForm, clientes]);

  // Modal Confirmar Eliminación
  const [modalEliminar, setModalEliminar] = useState<{
    abierto: boolean;
    cliente: Cliente | null;
    tieneDeuda: boolean;
    totalDeudaUsd: number;
    eliminando: boolean;
    error: string | null;
  }>({
    abierto: false,
    cliente: null,
    tieneDeuda: false,
    totalDeudaUsd: 0,
    eliminando: false,
    error: null,
  });

  // Deslizamiento vertical y arrastre (drag-to-scroll) para móviles y emuladores con Body Scroll Lock
  const dragScrollEstudiante = useModalDragScroll({
    isOpen: modalForm.abierto,
    onDismiss: () => setModalForm((prev) => ({ ...prev, abierto: false })),
  });

  const dragScrollEliminar = useModalDragScroll({
    isOpen: modalEliminar.abierto,
    onDismiss: () => setModalEliminar((prev) => ({ ...prev, abierto: false })),
  });

  // Modal Ficha del Estudiante e Historial de Consumos
  const [modalFicha, setModalFicha] = useState<{
    abierto: boolean;
    cliente: Cliente | null;
    consumos: any[];
    cargando: boolean;
  }>({
    abierto: false,
    cliente: null,
    consumos: [],
    cargando: false,
  });

  // Modal Confirmar Anulación desde la Ficha
  const [modalAnular, setModalAnular] = useState<{
    abierto: boolean;
    consumo: any | null;
    procesando: boolean;
    error: string | null;
  }>({
    abierto: false,
    consumo: null,
    procesando: false,
    error: null,
  });

  const dragScrollFicha = useModalDragScroll({
    isOpen: modalFicha.abierto,
    onDismiss: () => setModalFicha((prev) => ({ ...prev, abierto: false })),
  });

  const dragScrollAnular = useModalDragScroll({
    isOpen: modalAnular.abierto,
    onDismiss: () =>
      !modalAnular.procesando && setModalAnular((prev) => ({ ...prev, abierto: false })),
  });

  // 1. Cargar Tasa BCV
  const cargarTasa = useCallback(async () => {
    setCargandoTasa(true);
    try {
      const tasa = await obtenerTasaBCV();
      setTasaBcv(tasa);
    } catch {
      setTasaBcv(TASA_BCV_FALLBACK_DEFAULT);
    } finally {
      setCargandoTasa(false);
    }
  }, []);

  // Debounce para la barra de búsqueda de estudiantes (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setBusquedaDebounced(busqueda);
    }, 300);
    return () => clearTimeout(handler);
  }, [busqueda]);

  // Cargar métricas financieras globales y directorio ligero para vínculos familiares
  const cargarMetricasDirectorio = useCallback(async () => {
    try {
      const { data: todos, error } = await supabase
        .from('clientes')
        .select('id, nombre_estudiante, grado_seccion, nombre_representante, telefono_whatsapp, saldo')
        .order('nombre_estudiante', { ascending: true })
        .limit(5000);

      if (error || !todos) return;

      let deudaCount = 0;
      let favorCount = 0;
      let deudaSum = 0;
      let favorSum = 0;

      const mapaSaldos: Record<string, ResumenSaldoCliente> = {};

      todos.forEach((c) => {
        const s = Math.round(Number(c.saldo || 0) * 100) / 100;
        mapaSaldos[c.id] = {
          clienteId: c.id,
          saldo: s,
          deudaTotalUsd: s < 0 ? Math.abs(s) : 0,
          saldoAFavorTotalUsd: s > 0 ? s : 0,
          saldoNetoUsd: s,
        };

        if (s < -0.001) {
          deudaCount++;
          deudaSum += Math.abs(s);
        } else if (s > 0.001) {
          favorCount++;
          favorSum += s;
        }
      });

      setSaldosClientes(mapaSaldos);
      setDirectorioContactos(todos);
      setMetricasGlobales({
        totalEstudiantes: todos.length,
        estudiantesConDeuda: deudaCount,
        estudiantesConSaldoFavor: favorCount,
        totalDeudaGlobalUsd: deudaSum,
        totalSaldoAFavorGlobalUsd: favorSum,
      });
    } catch (e) {
      console.error('Error calculando métricas globales de directorio:', e);
    }
  }, []);

  // Cargar clientes paginados desde Supabase usando .range(from, to) y filtros en DB
  const cargarDatos = useCallback(
    async (paginaDestino: number = 1, esCargarMas: boolean = false) => {
      if (esCargarMas) {
        setCargandoMas(true);
      } else {
        setCargandoClientes(true);
      }

      try {
        let q = supabase
          .from('clientes')
          .select('*', { count: 'exact' });

        // 1. Filtro en Base de Datos por Búsqueda (.ilike en DB)
        const term = busquedaDebounced.trim();
        if (term) {
          q = q.or(
            `nombre_estudiante.ilike.%${term}%,nombre_representante.ilike.%${term}%,grado_seccion.ilike.%${term}%,telefono_whatsapp.ilike.%${term}%`
          );
        }

        // 2. Filtro en Base de Datos por Grado / Sección (.eq en DB)
        if (filtroGrado !== 'todos') {
          q = q.eq('grado_seccion', filtroGrado);
        }

        // 3. Filtro en Base de Datos por Estado de Saldo (.lt, .gt, .gte / .lte en DB)
        if (filtroEstado === 'con_deuda') {
          q = q.lt('saldo', -0.001);
        } else if (filtroEstado === 'con_saldo_favor') {
          q = q.gt('saldo', 0.001);
        } else if (filtroEstado === 'solvente') {
          q = q.gte('saldo', -0.001).lte('saldo', 0.001);
        }

        // 4. Paginación en Servidor con .range(from, to)
        const from = (paginaDestino - 1) * TAMANO_PAGINA_ESTUDIANTES;
        const to = from + TAMANO_PAGINA_ESTUDIANTES - 1;

        q = q.order('nombre_estudiante', { ascending: true }).range(from, to);

        const { data: clientesDb, count, error: errClientes } = await q;

        if (errClientes) throw errClientes;

        const items = clientesDb || [];
        setTotalEstudiantesDb(count ?? items.length);
        setPaginaActual(paginaDestino);

        if (esCargarMas) {
          setClientes((prev) => [...prev, ...items]);
        } else {
          setClientes(items);
        }
      } catch (err) {
        console.error('Error cargando estudiantes paginados:', err);
        setNotificacion({
          tipo: 'error',
          texto: 'Error al conectar con la base de datos de Supabase.',
        });
        setTimeout(() => setNotificacion(null), 4000);
      } finally {
        setCargandoClientes(false);
        setCargandoMas(false);
      }
    },
    [busquedaDebounced, filtroGrado, filtroEstado]
  );

  // Inicialización y recarga automática ante cambios de filtros o búsqueda
  useEffect(() => {
    setMontado(true);
    cargarTasa();
    cargarMetricasDirectorio();
  }, [cargarTasa, cargarMetricasDirectorio]);

  useEffect(() => {
    cargarDatos(1, false);
  }, [cargarDatos]);

  // Referencias mutables para el canal Realtime sin recrear suscripciones
  const paginaActualRef = useRef(paginaActual);
  const cargarDatosRef = useRef(cargarDatos);
  const cargarMetricasRef = useRef(cargarMetricasDirectorio);

  useEffect(() => {
    paginaActualRef.current = paginaActual;
  }, [paginaActual]);

  useEffect(() => {
    cargarDatosRef.current = cargarDatos;
  }, [cargarDatos]);

  useEffect(() => {
    cargarMetricasRef.current = cargarMetricasDirectorio;
  }, [cargarMetricasDirectorio]);

  // Sincronización en tiempo real con Supabase estable (solo 1 suscripción en mount)
  useEffect(() => {
    let timerRecarga: NodeJS.Timeout | null = null;
    const recargarConDebounce = () => {
      if (timerRecarga) clearTimeout(timerRecarga);
      timerRecarga = setTimeout(() => {
        cargarDatosRef.current(paginaActualRef.current, false);
        cargarMetricasRef.current();
      }, 600);
    };

    const canalRealtime = supabase
      .channel('estudiantes_realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, recargarConDebounce)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consumos' }, recargarConDebounce)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'abonos' }, recargarConDebounce)
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
  }, []);

  // Grados / Secciones disponibles para el selector de filtro
  const gradosDisponibles = useMemo(() => {
    const set = new Set<string>();
    TODOS_LOS_GRADOS_SISTEMA.forEach((g) => set.add(g));
    directorioContactos.forEach((c) => {
      const g = (c.grado_seccion || '').trim();
      if (g) set.add(g);
    });
    return Array.from(set).sort();
  }, [directorioContactos]);

  // Como la búsqueda y filtros se ejecutan directamente en Supabase,
  // clientesFiltrados es la lista resultante del servidor para esta página.
  const clientesFiltrados = clientes;

  // Métricas de cuenta corriente unificada globales
  const totalEstudiantes = metricasGlobales.totalEstudiantes;
  const estudiantesConDeuda = metricasGlobales.estudiantesConDeuda;
  const estudiantesConSaldoFavor = metricasGlobales.estudiantesConSaldoFavor;
  const totalDeudaGlobalUsd = metricasGlobales.totalDeudaGlobalUsd;
  const totalDeudaGlobalBs = calcularConversionBs(totalDeudaGlobalUsd, tasaBcv);
  const totalSaldoAFavorGlobalUsd = metricasGlobales.totalSaldoAFavorGlobalUsd;
  const totalSaldoAFavorGlobalBs = calcularConversionBs(totalSaldoAFavorGlobalUsd, tasaBcv);

  // Cálculos para paginación compacta
  const totalPaginas = Math.max(1, Math.ceil(totalEstudiantesDb / TAMANO_PAGINA_ESTUDIANTES));
  const indiceInicial = totalEstudiantesDb === 0 ? 0 : (paginaActual - 1) * TAMANO_PAGINA_ESTUDIANTES + 1;
  const indiceFinal = Math.min(totalEstudiantesDb, paginaActual * TAMANO_PAGINA_ESTUDIANTES);

  // Abrir Modal de Abono
  const handleAbrirAbono = (c: Cliente) => {
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

  // Confirmar Abono
  const handleConfirmarAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalAbono.cliente) return;
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
          await Promise.all([cargarDatos(paginaActual, false), cargarMetricasDirectorio()]);
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

  // Abrir Ficha del Estudiante e Historial de Consumos
  const handleAbrirFicha = async (cliente: Cliente) => {
    setModalFicha({
      abierto: true,
      cliente,
      consumos: [],
      cargando: true,
    });

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
          consumo_detalles (
            id,
            cantidad,
            precio_unitario_usd,
            productos (
              id,
              nombre
            )
          )
        `)
        .eq('cliente_id', cliente.id)
        .order('fecha', { ascending: false });

      if (!error && data) {
        setModalFicha((prev) => ({ ...prev, consumos: data, cargando: false }));
      } else {
        setModalFicha((prev) => ({ ...prev, cargando: false }));
      }
    } catch (e) {
      console.error('Error cargando consumos de cliente:', e);
      setModalFicha((prev) => ({ ...prev, cargando: false }));
    }
  };

  // Confirmar Anulación de Transacción desde la Ficha
  const handleConfirmarAnulacionDesdeFicha = async () => {
    if (!modalAnular.consumo) return;
    setModalAnular((prev) => ({ ...prev, procesando: true, error: null }));

    try {
      const res = await anularConsumo({
        consumoId: modalAnular.consumo.id,
      });

      setNotificacion({
        tipo: 'exito',
        texto: res.mensaje,
      });
      setTimeout(() => setNotificacion(null), 4000);

      setModalAnular({
        abierto: false,
        consumo: null,
        procesando: false,
        error: null,
      });

      await cargarDatos();
      if (modalFicha.cliente) {
        const { data } = await supabase
          .from('consumos')
          .select(`
            id,
            cliente_id,
            monto_total_usd,
            tasa_bcv_historica,
            metodo_pago,
            pagado,
            fecha,
            consumo_detalles (
              id,
              cantidad,
              precio_unitario_usd,
              productos (
                id,
                nombre
              )
            )
          `)
          .eq('cliente_id', modalFicha.cliente.id)
          .order('fecha', { ascending: false });

        setModalFicha((prev) => ({ ...prev, consumos: data || [] }));
      }
    } catch (err: unknown) {
      console.error('Error anulando consumo desde ficha:', err);
      const msg = err instanceof Error ? err.message : 'Error al anular la transacción.';
      setModalAnular((prev) => ({ ...prev, procesando: false, error: msg }));
    }
  };

  // Abrir Modal Crear
  const handleAbrirCrear = () => {
    setModalForm({
      abierto: true,
      modo: 'crear',
      nombre_estudiante: '',
      grado_seccion: '1er Grado A',
      grado_personalizado: '',
      nombre_representante: '',
      telefono_prefijo: '+58',
      telefono_numero: '',
      guardando: false,
      error: null,
    });
    setCategoriaActivaModal('primaria');
    setPasoSelectorGrado('grados');
    setGradoBaseSeleccionado('1er Grado');
    setMostrandoInputSeccionExtra(false);
    setSeccionPersonalizadaInput('');
    setPopoverGradoModalAbierto(false);
    setPopoverPrefijoModalAbierto(false);
  };

  // Abrir Modal Editar
  const handleAbrirEditar = (c: Cliente) => {
    const { prefijo, numero } = separarTelefonoPrefijo(c.telefono_whatsapp);
    const gradoActual = c.grado_seccion || '';
    const esConocido = TODOS_LOS_GRADOS_SISTEMA.includes(gradoActual);
    const catId = obtenerCategoriaDeGrado(gradoActual);
    const { gradoBase } = separarGradoYSeccion(gradoActual);

    setModalForm({
      abierto: true,
      modo: 'editar',
      id: c.id,
      nombre_estudiante: c.nombre_estudiante || '',
      grado_seccion: esConocido ? gradoActual : (gradoActual ? 'otro' : '1er Grado A'),
      grado_personalizado: esConocido ? '' : gradoActual,
      nombre_representante: c.nombre_representante || '',
      telefono_prefijo: prefijo,
      telefono_numero: numero,
      guardando: false,
      error: null,
    });
    setCategoriaActivaModal(catId);
    setPasoSelectorGrado('grados');
    setGradoBaseSeleccionado(gradoBase || '1er Grado');
    setMostrandoInputSeccionExtra(false);
    setSeccionPersonalizadaInput('');
    setPopoverGradoModalAbierto(false);
    setPopoverPrefijoModalAbierto(false);
  };

  // Guardar (Crear o Actualizar) con validación estricta
  const handleGuardarEstudiante = async (e: React.FormEvent) => {
    e.preventDefault();

    const nombreLimpio = modalForm.nombre_estudiante.trim();
    if (!nombreLimpio) {
      setModalForm((prev) => ({ ...prev, error: 'El nombre es obligatorio.' }));
      return;
    }

    // Validación de números en nombres
    if (/\d/.test(nombreLimpio)) {
      setModalForm((prev) => ({
        ...prev,
        error: 'El nombre no puede contener números. Usa solo letras.',
      }));
      return;
    }

    const repLimpio = modalForm.nombre_representante.trim();
    if (repLimpio && /\d/.test(repLimpio)) {
      setModalForm((prev) => ({
        ...prev,
        error: 'El nombre del representante no puede contener números.',
      }));
      return;
    }

    // Validación de número de teléfono
    const telNum = modalForm.telefono_numero.trim();
    if (telNum && /[^\d]/.test(telNum)) {
      setModalForm((prev) => ({
        ...prev,
        error: 'El número de teléfono solo debe contener dígitos.',
      }));
      return;
    }

    if (telNum && telNum.length > 10) {
      setModalForm((prev) => ({
        ...prev,
        error: 'El número no puede exceder 10 dígitos (sin contar el prefijo).',
      }));
      return;
    }

    setModalForm((prev) => ({ ...prev, guardando: true, error: null }));

    try {
      // Determinar grado final
      const gradoFinal =
        modalForm.grado_seccion === 'otro'
          ? modalForm.grado_personalizado.trim() || null
          : modalForm.grado_seccion.trim() || null;

      // Unir prefijo y número
      const telefonoCompleto = unirTelefonoPrefijo(
        modalForm.telefono_prefijo,
        modalForm.telefono_numero
      );

      // Validación estricta: No puede haber 2 representantes con el mismo número de teléfono
      if (esRepresentante(gradoFinal)) {
        const telLimpio = telefonoCompleto ? telefonoCompleto.replace(/\D/g, '') : '';
        if (telLimpio.length >= 7) {
          const reprExistente = clientes.find((c) => {
            if (modalForm.id && c.id === modalForm.id) return false;
            if (!esRepresentante(c.grado_seccion)) return false;
            const cTel = (c.telefono_whatsapp || '').replace(/\D/g, '');
            if (cTel.length < 7) return false;
            return (
              telLimpio === cTel ||
              telLimpio.endsWith(cTel.slice(-8)) ||
              cTel.endsWith(telLimpio.slice(-8))
            );
          });

          if (reprExistente) {
            setModalForm((prev) => ({
              ...prev,
              guardando: false,
              error: `Ya existe un representante registrado con este número de teléfono (${reprExistente.nombre_estudiante}). No se permiten dos representantes con el mismo teléfono.`,
            }));
            return;
          }
        }
      }

      // Validación de duplicados (Nombre + Apellido + Sección):
      // Consulta en Supabase si ya existe un registro donde coincidan al mismo tiempo nombre_estudiante Y grado_seccion.
      // Permite alumnos con el mismo nombre y apellido SI están en secciones/grados distintos,
      // pero bloquea el registro si coinciden en la misma sección.
      const normalizarTexto = (str: string | null | undefined) =>
        (str || '')
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');

      let queryDuplicados = supabase
        .from('clientes')
        .select('id, nombre_estudiante, grado_seccion')
        .ilike('nombre_estudiante', nombreLimpio);

      if (modalForm.modo === 'editar' && modalForm.id) {
        queryDuplicados = queryDuplicados.neq('id', modalForm.id);
      }

      const { data: alumnosMismoNombre, error: errQueryDup } = await queryDuplicados;

      if (!errQueryDup && alumnosMismoNombre && alumnosMismoNombre.length > 0) {
        const alumnoDuplicadoMismaSeccion = alumnosMismoNombre.find((c) => {
          const mismoNombre = normalizarTexto(c.nombre_estudiante) === normalizarTexto(nombreLimpio);
          const mismaSeccion = normalizarTexto(c.grado_seccion) === normalizarTexto(gradoFinal);
          return mismoNombre && mismaSeccion;
        });

        if (alumnoDuplicadoMismaSeccion) {
          setModalForm((prev) => ({
            ...prev,
            guardando: false,
            error: `Ya existe un alumno registrado con el nombre "${nombreLimpio}" en la sección/grado "${gradoFinal || 'Sin sección'}". No se permiten dos alumnos con el mismo nombre y apellido en la misma sección.`,
          }));
          return;
        }
      }

      const payload: Record<string, any> = {
        nombre_estudiante: nombreLimpio,
        grado_seccion: gradoFinal,
        nombre_representante: repLimpio || null,
        telefono_whatsapp: telefonoCompleto,
      };

      if (modalForm.modo === 'crear') {
        payload.saldo = 0;
        const { error } = await supabase.from('clientes').insert([payload]);
        if (error) throw error;
        setNotificacion({
          tipo: 'exito',
          texto: `¡Registro de "${payload.nombre_estudiante}" creado con éxito!`,
        });
      } else {
        if (!modalForm.id) throw new Error('ID no encontrado para actualizar.');
        const { error } = await supabase
          .from('clientes')
          .update(payload)
          .eq('id', modalForm.id);
        if (error) throw error;
        setNotificacion({
          tipo: 'exito',
          texto: `¡Registro de "${payload.nombre_estudiante}" actualizado con éxito!`,
        });
      }

      setModalForm((prev) => ({ ...prev, abierto: false }));
      setTimeout(() => setNotificacion(null), 4000);
      await ejecutarMiniRecarga({
        router,
        recargarDatosLocales: async () => {
          await Promise.all([cargarDatos(paginaActual, false), cargarMetricasDirectorio()]);
        },
      });
    } catch (err: unknown) {
      console.error('Error guardando registro:', err);
      setModalForm((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Error inesperado al guardar.',
      }));
    } finally {
      setModalForm((prev) => ({ ...prev, guardando: false }));
    }
  };

  // Abrir Modal Eliminar
  const handleAbrirEliminar = (c: Cliente) => {
    const s = c.saldo !== undefined && c.saldo !== null ? Number(c.saldo) : (saldosClientes[c.id]?.saldoNetoUsd || 0);
    const tieneDeuda = s < 0;
    setModalEliminar({
      abierto: true,
      cliente: c,
      tieneDeuda,
      totalDeudaUsd: s < 0 ? Math.abs(s) : 0,
      eliminando: false,
      error: null,
    });
  };

  // Confirmar Eliminación
  const handleConfirmarEliminar = async () => {
    if (!modalEliminar.cliente) return;
    setModalEliminar((prev) => ({ ...prev, eliminando: true, error: null }));

    try {
      const { count, error: errCount } = await supabase
        .from('consumos')
        .select('id', { count: 'exact', head: true })
        .eq('cliente_id', modalEliminar.cliente.id);

      if (errCount) throw errCount;

      if (count && count > 0) {
        throw new Error(
          `No se puede eliminar porque tiene ${count} consumo(s) asociados en el historial contable. Para mantener la integridad de los reportes, no se permite borrar clientes con ventas previas.`
        );
      }

      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', modalEliminar.cliente.id);

      if (error) throw error;

      setModalEliminar((prev) => ({ ...prev, abierto: false }));
      setNotificacion({
        tipo: 'exito',
        texto: `Registro de "${modalEliminar.cliente.nombre_estudiante}" eliminado correctamente.`,
      });
      setTimeout(() => setNotificacion(null), 4000);
      await ejecutarMiniRecarga({
        router,
        recargarDatosLocales: async () => {
          await Promise.all([cargarDatos(paginaActual, false), cargarMetricasDirectorio()]);
        },
      });
    } catch (err: unknown) {
      console.error('Error eliminando cliente:', err);
      setModalEliminar((prev) => ({
        ...prev,
        error:
          err instanceof Error
            ? err.message
            : 'Error al intentar eliminar el registro de Supabase.',
      }));
    } finally {
      setModalEliminar((prev) => ({ ...prev, eliminando: false }));
    }
  };

  // Enviar mensaje de WhatsApp
  const handleAbrirWhatsApp = (c: Cliente) => {
    const esProf = esProfesorOPersonal(c.grado_seccion);
    const destinatario = esProf
      ? `Prof./Personal ${c.nombre_estudiante}`
      : c.nombre_representante || 'Estimado(a) Representante';
    const sujeto = esProf
      ? `su cuenta de cantina (${c.grado_seccion})`
      : `el estudiante *${c.nombre_estudiante}* (${c.grado_seccion || 'Cantina'})`;
    const s = c.saldo !== undefined && c.saldo !== null ? Number(c.saldo) : (saldosClientes[c.id]?.saldoNetoUsd || 0);

    let textoDeuda = 'Actualmente su cuenta se encuentra completamente al dia y solvente ($0.00).';
    if (s < 0) {
      const deuda = Math.abs(s);
      const bs = calcularConversionBs(deuda, tasaBcv);
      textoDeuda = `Le recordamos amablemente que presenta un saldo pendiente de ${formatUSD(deuda)} (${formatBs(bs)} a tasa oficial BCV: ${formatBs(tasaBcv)}).`;
    } else if (s > 0) {
      const bs = calcularConversionBs(s, tasaBcv);
      textoDeuda = `Le informamos cordialmente que cuenta con un saldo a favor disponible de +${formatUSD(s)} (+${formatBs(bs)} a tasa oficial BCV).`;
    }

    const mensaje = `Hola, *${destinatario}*.
Le escribimos cordialmente de *Club 5 Cantina Escolar* con relacion a ${sujeto}.

${textoDeuda}

Cualquier consulta o para gestionar su pedido en la cantina, estamos a su completa disposicion.
¡Que tenga un excelente dia!`;

    let telLimpio = (c.telefono_whatsapp || '').replace(/\D/g, '');
    if (telLimpio.startsWith('0')) {
      telLimpio = '58' + telLimpio.slice(1);
    } else if (!telLimpio.startsWith('58') && telLimpio.length === 10) {
      telLimpio = '58' + telLimpio;
    }

    if (!telLimpio) {
      navigator.clipboard.writeText(mensaje);
      setNotificacion({
        tipo: 'info',
        texto: 'Sin número de WhatsApp registrado. ¡Mensaje copiado al portapapeles!',
      });
      setTimeout(() => setNotificacion(null), 4000);
      return;
    }

    const url = `https://api.whatsapp.com/send?phone=${telLimpio}&text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };

  const getIniciales = (nombre: string) => {
    const partes = nombre.trim().split(' ');
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return (partes[0][0] + (partes[1]?.[0] || '')).toUpperCase();
  };

  const esModoProfesor = esProfesorOPersonal(modalForm.grado_seccion);
  const esModoRepresentante = esRepresentante(modalForm.grado_seccion);

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
      {/* Header Superior Sticky */}
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
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-sm sm:text-lg font-bold tracking-tight text-gray-900 dark:text-white truncate">
                  Estudiantes
                </h1>
                <span className="rounded-full border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.2 text-[10px] sm:text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 shrink-0">
                  {totalEstudiantesDb}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-gray-500 dark:text-slate-400 hidden sm:block">
                Directorio escolar (Preescolar, Primaria, Bachillerato y Profesores)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Centro de Notificaciones y Alertas */}
            <NotificationBell />

            {/* Botón Registrar Nuevo Alumno/Profesor */}
            <button
              type="button"
              onClick={handleAbrirCrear}
              title="Registrar Nuevo Alumno/Profesor"
              className="flex h-9 w-9 sm:h-auto sm:w-auto items-center justify-center gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl bg-indigo-600 sm:px-4 sm:py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition active:scale-95 shrink-0"
            >
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Nuevo Registro</span>
            </button>
          </div>
        </div>
      </header>

      {/* Notificación Toast */}
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
        {/* Tarjetas KPI */}
        <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <div className="rounded-3xl border border-gray-200/80 bg-white p-4 sm:p-5 shadow-xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Total Registrados
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">
                {totalEstudiantes}
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              {gradosDisponibles.length} salas, grados y personal
            </p>
          </div>

          <div className="rounded-3xl border border-amber-200/80 bg-gradient-to-br from-amber-50/40 to-orange-50/20 p-4 sm:p-5 shadow-xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-800/80">
              Con Deuda Pendiente
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <div>
                <span className="text-2xl sm:text-3xl font-black tracking-tight text-amber-950">
                  {estudiantesConDeuda}
                </span>
                <span className="text-xs text-amber-800 ml-1.5 font-semibold">
                  (-{formatUSD(totalDeudaGlobalUsd)})
                </span>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-800">
                <Receipt className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-1 text-xs text-amber-800/80 font-mono">
              Equivalente: -{formatBs(totalDeudaGlobalBs)}
            </p>
          </div>

          <div className="rounded-3xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/60 to-teal-50/30 p-4 sm:p-5 shadow-xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
              Saldos a Favor (Crédito)
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <div>
                <span className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-950">
                  +{formatUSD(totalSaldoAFavorGlobalUsd)}
                </span>
                <span className="text-xs text-emerald-700 ml-1.5 font-semibold">
                  ({estudiantesConSaldoFavor} clientes)
                </span>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-700">
                <PiggyBank className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-1 text-xs text-emerald-800/80 font-mono">
              Equivalente: +{formatBs(totalSaldoAFavorGlobalBs)}
            </p>
          </div>

          <div className="rounded-3xl border border-gray-200/80 bg-white p-4 sm:p-5 shadow-xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Clientes Solventes
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-600">
                {totalEstudiantes - estudiantesConDeuda}
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Al día sin saldos deudores
            </p>
          </div>
        </div>

        {/* Barra de Filtros */}
        <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-gray-200/80 bg-white p-3.5 sm:p-4 shadow-xs lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, representante, grado o teléfono..."
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

          <div
            ref={draggableFiltrosRef}
            {...draggableFiltrosEvents}
            className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 w-full min-w-0 max-w-full touch-scroll-ios scrollbar-none select-none cursor-grab active:cursor-grabbing"
          >
            {/* Popover Grado / Sección */}
            <Popover.Root open={popoverGradoAbierto} onOpenChange={setPopoverGradoAbierto}>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 shrink-0 whitespace-nowrap rounded-2xl border border-gray-200/90 bg-gray-50/70 px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-2xs hover:border-gray-300 hover:bg-white transition"
                >
                  <GraduationCap className="h-4 w-4 text-indigo-600 shrink-0" />
                  <span>
                    {filtroGrado === 'todos'
                      ? `Todos los Niveles (${gradosDisponibles.length})`
                      : filtroGrado}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-gray-400 shrink-0 transition-transform ${
                      popoverGradoAbierto ? 'rotate-180 text-gray-700' : ''
                    }`}
                  />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="z-50 min-w-[220px] rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl outline-none backdrop-blur-lg animate-in fade-in-0 zoom-in-95"
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
                      <span>Todos los Niveles ({gradosDisponibles.length})</span>
                      {filtroGrado === 'todos' && <Check className="h-3.5 w-3.5 text-indigo-600" />}
                    </button>

                    {gradosDisponibles.map((g) => {
                      const esProf = esProfesorOPersonal(g);
                      return (
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
                          <span className="flex items-center gap-1.5">
                            {esProf ? (
                              <Briefcase className="h-3 w-3 text-amber-600 shrink-0" />
                            ) : (
                              <GraduationCap className="h-3 w-3 text-indigo-500 shrink-0" />
                            )}
                            {g}
                          </span>
                          {filtroGrado === g && <Check className="h-3.5 w-3.5 text-indigo-600" />}
                        </button>
                      );
                    })}
                  </div>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>

            {/* Pestañas de Estado */}
            <div className="flex items-center shrink-0 whitespace-nowrap rounded-2xl border border-gray-200/90 bg-gray-50/70 p-1">
              <button
                type="button"
                onClick={() => setFiltroEstado('todos')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold shrink-0 whitespace-nowrap transition ${
                  filtroEstado === 'todos'
                    ? 'bg-white text-gray-900 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setFiltroEstado('con_deuda')}
                className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold shrink-0 whitespace-nowrap transition ${
                  filtroEstado === 'con_deuda'
                    ? 'bg-amber-100 text-amber-950 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <span>Con Deuda</span>
                {estudiantesConDeuda > 0 && (
                  <span className="rounded-full bg-amber-200 px-1.5 py-0.2 text-[10px] text-amber-900 font-extrabold">
                    {estudiantesConDeuda}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setFiltroEstado('con_saldo_favor')}
                className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold shrink-0 whitespace-nowrap transition ${
                  filtroEstado === 'con_saldo_favor'
                    ? 'bg-emerald-100 text-emerald-950 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <span>A Favor</span>
                {estudiantesConSaldoFavor > 0 && (
                  <span className="rounded-full bg-emerald-200 px-1.5 py-0.2 text-[10px] text-emerald-900 font-extrabold">
                    {estudiantesConSaldoFavor}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setFiltroEstado('solvente')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold shrink-0 whitespace-nowrap transition ${
                  filtroEstado === 'solvente'
                    ? 'bg-emerald-100 text-emerald-950 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Solventes
              </button>
            </div>

            {/* Refrescar */}
            <button
              type="button"
              onClick={() => {
                cargarDatos(1, false);
                cargarMetricasDirectorio();
              }}
              disabled={cargandoClientes}
              className="flex items-center gap-1.5 shrink-0 rounded-2xl border border-gray-200/80 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 transition disabled:opacity-60"
              title="Recargar directorio"
            >
              <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${cargandoClientes ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Grid de Tarjetas */}
        {cargandoClientes ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="h-52 rounded-3xl border border-gray-200/80 bg-white p-5 animate-pulse"
              />
            ))}
          </div>
        ) : clientesFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 dark:border-slate-800 bg-white/70 dark:bg-[#111726]/40 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-indigo-50 dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 mb-3 shadow-xs">
              <Users className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              {busqueda || filtroGrado !== 'todos' || filtroEstado !== 'todos'
                ? 'No se encontraron coincidencias'
                : 'Directorio escolar vacío'}
            </h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400 max-w-sm">
              {busqueda || filtroGrado !== 'todos' || filtroEstado !== 'todos'
                ? 'Prueba modificando los filtros de búsqueda o nivel escolar.'
                : 'Registra a los alumnos y profesores de la cantina para asociar sus consumos y cuentas por cobrar.'}
            </p>

            <button
              type="button"
              onClick={handleAbrirCrear}
              className="mt-5 flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition"
            >
              <UserPlus className="h-4 w-4" />
              <span>Registrar Primera Persona</span>
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {clientesFiltrados.map((cliente, index) => {
                const s = cliente.saldo !== undefined && cliente.saldo !== null ? Number(cliente.saldo) : (saldosClientes[cliente.id]?.saldoNetoUsd ?? 0);
                const tieneDeuda = s < 0;
                const tieneSaldoFavor = s > 0;
                const montoSaldoFavor = s > 0 ? s : 0;
                const montoDeuda = s < 0 ? Math.abs(s) : 0;
                const iniciales = getIniciales(cliente.nombre_estudiante);
                const esProf = esProfesorOPersonal(cliente.grado_seccion);
                const esPadre = esRepresentante(cliente.grado_seccion);
                const vinculos = encontrarVinculosCliente(cliente, directorioContactos.length > 0 ? directorioContactos : clientes);

                return (
                  <motion.div
                    key={cliente.id}
                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                    transition={{
                      duration: 0.22,
                      delay: Math.min(index * 0.02, 0.2),
                      ease: [0.25, 1, 0.5, 1],
                    }}
                    className="flex flex-col justify-between rounded-3xl border border-gray-200/80 bg-white p-5 shadow-xs hover:border-gray-300 hover:shadow-md transition group"
                  >
                    <div>
                      {/* Cabecera de la tarjeta */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          {/* Avatar */}
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-black text-sm shadow-2xs ${
                              esProf
                                ? 'bg-amber-100 border border-amber-200 text-amber-900'
                                : 'bg-indigo-50 border border-indigo-100 text-indigo-700'
                            }`}
                          >
                            {iniciales}
                          </div>

                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h3 className="text-sm font-bold text-gray-900 group-hover:text-indigo-600 transition leading-snug">
                                {cliente.nombre_estudiante}
                              </h3>
                            </div>

                            {cliente.grado_seccion ? (
                              <span
                                className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                                  esProf
                                    ? 'border-amber-300 bg-amber-50 text-amber-900'
                                    : 'border-indigo-200 bg-indigo-50 text-indigo-700'
                                }`}
                              >
                                {esProf ? (
                                  <Briefcase className="h-3 w-3" />
                                ) : (
                                  <GraduationCap className="h-3 w-3" />
                                )}
                                <span>{cliente.grado_seccion}</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-gray-400 italic">
                                Sin sala/grado asignado
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Botones Editar / Eliminar */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleAbrirEditar(cliente)}
                            className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAbrirEliminar(cliente)}
                            className="rounded-xl p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600 transition"
                            title="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Información de Contacto / Representante */}
                      <div className="mt-4 space-y-1.5 rounded-2xl border border-gray-100 bg-gray-50/60 p-3 text-xs">
                        {esPadre ? (
                          cliente.nombre_representante ? (
                            <div className="flex items-center justify-between text-gray-600">
                              <span className="text-gray-400 font-medium">Hijo(a) / Nota:</span>
                              <span className="font-semibold text-gray-800 text-right truncate max-w-[170px]">
                                {cliente.nombre_representante}
                              </span>
                            </div>
                          ) : null
                        ) : esProf ? (
                          <div className="flex items-center justify-between text-gray-600">
                            <span className="text-gray-400 font-medium">Cargo / Rol:</span>
                            <span className="font-semibold text-gray-800 text-right truncate max-w-[170px]">
                              {cliente.nombre_representante || 'Personal Directo'}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between text-gray-600">
                            <span className="text-gray-400 font-medium">Representante:</span>
                            <span className="font-semibold text-gray-800 text-right truncate max-w-[170px]">
                              {cliente.nombre_representante || 'No registrado'}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-gray-600">
                          <span className="text-gray-400 font-medium">Teléfono WhatsApp:</span>
                          <span className="inline-flex items-center gap-1 font-mono font-medium text-gray-800">
                            {cliente.telefono_whatsapp ? (
                              <>
                                <Phone className="h-3 w-3 text-emerald-600 shrink-0" />
                                <span>{cliente.telefono_whatsapp}</span>
                              </>
                            ) : (
                              'No registrado'
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Vínculo Familiar con Redirección */}
                      {vinculos.length > 0 && (
                        <div className="mt-2.5 space-y-1.5">
                          {vinculos.map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => setBusqueda(v.nombre)}
                              className="group/link flex w-full items-center justify-between rounded-2xl border border-indigo-100 bg-indigo-50/70 p-2 text-xs text-indigo-900 shadow-2xs hover:border-indigo-200 hover:bg-indigo-100/90 transition text-left"
                              title={`Filtrar para ver la tarjeta de ${v.nombre}`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm shrink-0">
                                  {v.tipo === 'padre' ? '👨‍👧' : v.tipo === 'hijo' ? '🎒' : '👥'}
                                </span>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600">
                                    {v.tipo === 'padre'
                                      ? 'Padre / Representante en sistema'
                                      : v.tipo === 'hijo'
                                      ? 'Hijo(a) / Estudiante en cantina'
                                      : 'Familiar vinculado'}
                                  </span>
                                  <span className="font-bold text-gray-900 truncate group-hover/link:text-indigo-600 transition">
                                    {v.nombre} {v.grado_seccion ? `• ${v.grado_seccion}` : ''}
                                  </span>
                                </div>
                              </div>
                              <span className="inline-flex items-center gap-1 rounded-xl bg-white px-2 py-1 text-[10px] font-bold text-indigo-700 shadow-2xs group-hover/link:bg-indigo-600 group-hover/link:text-white transition shrink-0 ml-1.5">
                                <span>Ver</span>
                                <ExternalLink className="h-3 w-3" />
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Estado de Cuenta: Saldo a Favor / Deuda / Solvencia */}
                      <div className="mt-3">
                        {tieneSaldoFavor ? (
                          <div className="rounded-2xl border border-emerald-300 bg-gradient-to-r from-emerald-50 via-teal-50/70 to-emerald-50/50 p-2.5 flex items-center justify-between shadow-2xs">
                            <div className="flex items-center gap-2">
                              <Wallet className="h-4 w-4 text-emerald-600 shrink-0" />
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold uppercase text-emerald-800 flex items-center gap-1">
                                  <span>Saldo a Favor Disponible</span>
                                </span>
                                <span className="font-mono text-xs font-black text-emerald-700">
                                  +{formatUSD(montoSaldoFavor)} a favor
                                  <span className="font-normal text-[10px] text-emerald-600 ml-1">
                                    (+{formatBs(calcularConversionBs(montoSaldoFavor, tasaBcv))})
                                  </span>
                                </span>
                              </div>
                            </div>
                            <span className="rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              Disponible
                            </span>
                          </div>
                        ) : tieneDeuda ? (
                          <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50/80 to-yellow-50/50 p-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Receipt className="h-4 w-4 text-amber-700 shrink-0" />
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold uppercase text-amber-900">
                                  Deuda / Cuenta por Cobrar
                                </span>
                                <span className="font-mono text-xs font-bold text-amber-950">
                                  -{formatUSD(montoDeuda)} &bull;{' '}
                                  {formatBs(calcularConversionBs(montoDeuda, tasaBcv))}
                                </span>
                              </div>
                            </div>
                            <Link
                              href="/deudas"
                              className="rounded-xl bg-amber-600/15 p-1.5 text-amber-800 hover:bg-amber-600 hover:text-white transition"
                              title="Ver en Cuentas por Cobrar"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-2.5 flex items-center gap-2 text-emerald-800">
                            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                            <span className="text-xs font-semibold">
                              Solvente &bull; Sin deudas pendientes ($0.00)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Acciones de la Tarjeta */}
                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleAbrirWhatsApp(cliente)}
                        className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 rounded-2xl border border-emerald-200/90 bg-emerald-50 px-2.5 py-2 text-xs font-bold text-emerald-800 shadow-2xs hover:bg-emerald-100 hover:border-emerald-300 transition active:scale-95"
                      >
                        <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                        <span>WhatsApp</span>
                      </button>

                      {/* Botón Ver Ficha / Historial de Consumos */}
                      <button
                        type="button"
                        onClick={() => handleAbrirFicha(cliente)}
                        className="flex items-center justify-center gap-1 rounded-2xl border border-gray-200 bg-white px-2.5 py-2 text-xs font-bold text-gray-700 shadow-2xs hover:bg-gray-50 hover:border-gray-300 transition active:scale-95"
                        title="Ver ficha del estudiante y compras registradas"
                      >
                        <History className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Historial</span>
                      </button>

                      {/* Botón Abonar / Depositar Saldo a Favor */}
                      <button
                        type="button"
                        onClick={() => handleAbrirAbono(cliente)}
                        className="flex items-center justify-center gap-1.5 rounded-2xl border border-indigo-200/90 bg-indigo-50 px-2.5 py-2 text-xs font-bold text-indigo-700 shadow-2xs hover:bg-indigo-100 hover:border-indigo-300 transition active:scale-95"
                        title="Registrar abono o pago adelantado para este cliente"
                      >
                        <PiggyBank className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Abonar</span>
                      </button>

                      {tieneDeuda && (
                        <Link
                          href="/deudas"
                          className="flex items-center justify-center gap-1 rounded-2xl bg-gray-900 px-3 py-2 text-xs font-bold text-white shadow-xs hover:bg-black transition active:scale-95"
                          title="Cobrar deudas en Cuentas por Cobrar"
                        >
                          <Receipt className="h-3.5 w-3.5" />
                          <span>Cobrar</span>
                        </Link>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Controles de Paginación en Servidor (.range) */}
          {totalEstudiantesDb > 0 && (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-3xl border border-gray-200/80 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-3.5 sm:px-5 shadow-2xs">
              {/* Resumen de conteo */}
              <div className="text-xs text-gray-500 dark:text-slate-400 text-center sm:text-left">
                Mostrando <span className="font-bold text-gray-900 dark:text-slate-100">{indiceInicial}</span> -{' '}
                <span className="font-bold text-gray-900 dark:text-slate-100">{indiceFinal}</span> de{' '}
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{totalEstudiantesDb}</span> personas
              </div>

              {/* Botón Cargar Más en Móviles (Progressive Append) */}
              {paginaActual < totalPaginas && (
                <button
                  type="button"
                  disabled={cargandoMas || cargandoClientes}
                  onClick={() => cargarDatos(paginaActual + 1, true)}
                  className="flex sm:hidden w-full items-center justify-center gap-2 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 py-2.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 active:scale-95 transition disabled:opacity-50"
                >
                  {cargandoMas ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span>Cargar más ({clientes.length} de {totalEstudiantesDb})</span>
                </button>
              )}

              {/* Navegación Anterior / Siguiente */}
              <div className="flex items-center gap-2 self-center sm:self-auto">
                <button
                  type="button"
                  disabled={paginaActual <= 1 || cargandoClientes}
                  onClick={() => {
                    const nueva = Math.max(1, paginaActual - 1);
                    cargarDatos(nueva, false);
                  }}
                  className="flex items-center gap-1 rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-[#111726] px-3.5 py-2 text-xs font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition active:scale-95"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Anterior</span>
                </button>

                <div className="px-3 py-1.5 rounded-xl bg-gray-100/70 dark:bg-slate-800 text-xs font-bold text-gray-700 dark:text-slate-300">
                  Página <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{paginaActual}</span> de{' '}
                  <span>{totalPaginas}</span>
                </div>

                <button
                  type="button"
                  disabled={paginaActual >= totalPaginas || cargandoClientes}
                  onClick={() => {
                    const nueva = Math.min(totalPaginas, paginaActual + 1);
                    cargarDatos(nueva, false);
                  }}
                  className="flex items-center gap-1 rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-[#111726] px-3.5 py-2 text-xs font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition active:scale-95"
                >
                  <span>Siguiente</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </main>

      {/* Modal Crear / Editar (Radix UI Dialog) */}
      <Dialog.Root
        open={modalForm.abierto}
        onOpenChange={(abierto) => setModalForm((prev) => ({ ...prev, abierto }))}
      >
        <Dialog.Portal>
          <Dialog.Overlay
            {...dragScrollEstudiante.overlayProps}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          />
          <Dialog.Content
            style={dragScrollEstudiante.style}
            {...dragScrollEstudiante.dragProps}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain touch-scroll-ios rounded-t-3xl sm:rounded-3xl border-t sm:border border-gray-200/90 bg-white p-4 sm:p-6 pb-32 sm:pb-6 shadow-2xl outline-none duration-300 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in-0 sm:zoom-in-95 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[95vw] sm:max-w-lg cursor-grab active:cursor-grabbing"
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
                  {modalForm.modo === 'crear' ? 'Registrar Persona / Alumno' : 'Editar Registro'}
                </Dialog.Title>
                <Dialog.Description className="text-xs text-gray-500">
                  Completa los datos para el directorio escolar y cuentas de cantina.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={modalForm.guardando}
                  className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            {modalForm.error && (
              <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{modalForm.error}</span>
              </div>
            )}

            <form onSubmit={handleGuardarEstudiante} className="mt-4 space-y-3.5">
              {/* Nivel / Grado / Rol con Selector Visual Categorizado y Compacto */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nivel Escolar / Grado / Rol *
                </label>

                <Popover.Root open={popoverGradoModalAbierto} onOpenChange={setPopoverGradoModalAbierto}>
                  <Popover.Trigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-2xl border border-gray-200 bg-gray-50/70 px-4 py-3 sm:py-2.5 text-left text-base sm:text-sm transition hover:border-gray-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <span className="text-base shrink-0">
                          {categoriaActualObj?.icono || '📚'}
                        </span>
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-bold text-gray-900 truncate">
                            {modalForm.grado_seccion === 'otro'
                              ? (modalForm.grado_personalizado || 'Nivel Personalizado')
                              : modalForm.grado_seccion}
                          </span>
                          <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                            {categoriaActualObj?.nombre || 'General'}
                          </span>
                        </div>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${
                          popoverGradoModalAbierto ? 'rotate-180 text-gray-700' : ''
                        }`}
                      />
                    </button>
                  </Popover.Trigger>

                  <Popover.Portal>
                    <Popover.Content
                      className="z-50 w-[calc(100vw-2.5rem)] max-w-sm sm:max-w-md rounded-3xl border border-gray-200/90 bg-white p-3.5 shadow-2xl outline-none backdrop-blur-xl animate-in fade-in-0 zoom-in-95"
                      align="start"
                      sideOffset={6}
                    >
                      {/* Pestañas de Categoría (Segmented control) */}
                      <div className="grid grid-cols-4 gap-1 rounded-2xl border border-gray-200/80 bg-gray-50/80 p-1 mb-3">
                        {CATEGORIAS_DOS_PASOS.map((cat) => {
                          const esActiva = categoriaActivaModal === cat.id;
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                setCategoriaActivaModal(cat.id);
                                setPasoSelectorGrado('grados');
                                setMostrandoInputSeccionExtra(false);
                              }}
                              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-bold transition ${
                                esActiva
                                  ? 'bg-white text-indigo-950 shadow-2xs border border-gray-200/60'
                                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
                              }`}
                            >
                              <span className="text-sm">{cat.icono}</span>
                              <span className="text-[10px] truncate max-w-full leading-tight mt-0.5">
                                {cat.nombre.split(' ')[0]}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Contenido interactivo: Paso 1 (Grados) o Paso 2 (Secciones A - E) */}
                      {pasoSelectorGrado === 'grados' ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between px-1 text-[11px] text-gray-400 font-semibold uppercase tracking-wider">
                            <span>{categoriaDosPasosActiva.subtitulo}</span>
                            <span>{categoriaDosPasosActiva.requiereSeccion ? 'Selecciona año/grado' : 'Selecciona rol'}</span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {categoriaDosPasosActiva.gradosBase.map((gradoItem) => {
                              const esSeleccionado = modalForm.grado_seccion.startsWith(gradoItem);
                              return (
                                <button
                                  key={gradoItem}
                                  type="button"
                                  onClick={() => {
                                    if (categoriaDosPasosActiva.requiereSeccion) {
                                      setGradoBaseSeleccionado(gradoItem);
                                      setPasoSelectorGrado('secciones');
                                      setMostrandoInputSeccionExtra(false);
                                      setSeccionPersonalizadaInput('');
                                    } else {
                                      setModalForm((prev) => ({
                                        ...prev,
                                        grado_seccion: gradoItem,
                                        grado_personalizado: '',
                                      }));
                                      setPopoverGradoModalAbierto(false);
                                    }
                                  }}
                                  className={`flex items-center justify-between rounded-2xl p-2.5 text-xs font-bold transition text-left ${
                                    esSeleccionado
                                      ? 'bg-indigo-50 border-2 border-indigo-600 text-indigo-950 shadow-2xs'
                                      : 'border border-gray-200/80 bg-gray-50/60 text-gray-800 hover:bg-white hover:border-gray-300'
                                  }`}
                                >
                                  <span className="truncate">{gradoItem}</span>
                                  {categoriaDosPasosActiva.requiereSeccion ? (
                                    <span className="text-[10px] text-indigo-600 font-extrabold ml-1 shrink-0">
                                      Secc →
                                    </span>
                                  ) : (
                                    esSeleccionado && <Check className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        /* Paso 2: Selección de Sección (A, B, C, D, E o personalizada) */
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                            <button
                              type="button"
                              onClick={() => setPasoSelectorGrado('grados')}
                              className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition"
                            >
                              <ArrowLeft className="h-3.5 w-3.5" />
                              <span>Volver</span>
                            </button>

                            <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                              {gradoBaseSeleccionado}
                            </span>
                          </div>

                          <div className="px-1 text-[11px] text-gray-500 font-medium">
                            Elige la sección para <strong className="text-gray-900">{gradoBaseSeleccionado}</strong>:
                          </div>

                          {/* Grid de Secciones A hasta E */}
                          <div className="grid grid-cols-3 gap-2">
                            {SECCIONES_PREDETERMINADAS.map((sec) => {
                              const valorCompleto = `${gradoBaseSeleccionado} ${sec}`;
                              const estaActivo = modalForm.grado_seccion === valorCompleto;

                              return (
                                <button
                                  key={sec}
                                  type="button"
                                  onClick={() => {
                                    setModalForm((prev) => ({
                                      ...prev,
                                      grado_seccion: valorCompleto,
                                      grado_personalizado: '',
                                    }));
                                    setPopoverGradoModalAbierto(false);
                                  }}
                                  className={`flex items-center justify-center gap-1.5 rounded-2xl py-2 px-2.5 text-xs font-bold transition ${
                                    estaActivo
                                      ? 'bg-indigo-600 text-white shadow-xs'
                                      : 'border border-gray-200 bg-gray-50/70 text-gray-800 hover:bg-white hover:border-gray-300'
                                  }`}
                                >
                                  <span>Sección {sec}</span>
                                  {estaActivo && <Check className="h-3.5 w-3.5 text-white" />}
                                </button>
                              );
                            })}

                            {/* Opción Única / Sin sección */}
                            <button
                              type="button"
                              onClick={() => {
                                setModalForm((prev) => ({
                                  ...prev,
                                  grado_seccion: gradoBaseSeleccionado,
                                  grado_personalizado: '',
                                }));
                                setPopoverGradoModalAbierto(false);
                              }}
                              className={`flex items-center justify-center gap-1 rounded-2xl py-2 px-2.5 text-xs font-bold transition ${
                                modalForm.grado_seccion === gradoBaseSeleccionado
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'border border-gray-200 bg-gray-50/70 text-gray-600 hover:bg-white hover:border-gray-300'
                              }`}
                            >
                              <span>Única</span>
                            </button>
                          </div>

                          {/* Sección Personalizada (+ F, G, etc.) */}
                          <div className="pt-2 border-t border-gray-100">
                            {!mostrandoInputSeccionExtra ? (
                              <button
                                type="button"
                                onClick={() => setMostrandoInputSeccionExtra(true)}
                                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                              >
                                <PlusCircle className="h-3.5 w-3.5" />
                                <span>+ Otra sección (Sección F, G...)</span>
                              </button>
                            ) : (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  maxLength={3}
                                  value={seccionPersonalizadaInput}
                                  onChange={(e) => setSeccionPersonalizadaInput(e.target.value.toUpperCase())}
                                  placeholder="Ej. F o G"
                                  className="w-24 rounded-xl border border-gray-200 px-3 py-1.5 text-xs text-gray-900 font-bold uppercase outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  disabled={!seccionPersonalizadaInput.trim()}
                                  onClick={() => {
                                    const sec = seccionPersonalizadaInput.trim().toUpperCase();
                                    const valorCompleto = `${gradoBaseSeleccionado} ${sec}`;
                                    setModalForm((prev) => ({
                                      ...prev,
                                      grado_seccion: valorCompleto,
                                      grado_personalizado: '',
                                    }));
                                    setPopoverGradoModalAbierto(false);
                                  }}
                                  className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition disabled:opacity-50"
                                >
                                  Aplicar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setMostrandoInputSeccionExtra(false)}
                                  className="text-xs text-gray-400 hover:text-gray-600"
                                >
                                  Cancelar
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Opción para escribir rol personalizado global */}
                      <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            setModalForm((prev) => ({ ...prev, grado_seccion: 'otro' }));
                            setPopoverGradoModalAbierto(false);
                          }}
                          className={`text-xs font-bold flex items-center gap-1.5 transition ${
                            modalForm.grado_seccion === 'otro'
                              ? 'text-indigo-600'
                              : 'text-gray-500 hover:text-gray-800'
                          }`}
                        >
                          <Pencil className="h-3 w-3" />
                          <span>Otro / Rol personalizado</span>
                        </button>

                        <span className="text-[10px] text-gray-400">
                          Click para seleccionar
                        </span>
                      </div>
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>

                {modalForm.grado_seccion === 'otro' && (
                  <input
                    type="text"
                    value={modalForm.grado_personalizado}
                    onChange={(e) =>
                      setModalForm((prev) => ({
                        ...prev,
                        grado_personalizado: e.target.value,
                      }))
                    }
                    placeholder="Escribe el nivel o rol personalizado"
                    className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50/50 py-3 sm:py-2 px-3.5 text-base sm:text-xs text-gray-900 outline-none focus:border-indigo-500 focus:bg-white"
                    autoFocus
                  />
                )}
              </div>

              {/* Nombre (Sin números) */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {esModoRepresentante
                    ? 'Nombre del Representante / Padre *'
                    : esModoProfesor
                    ? 'Nombre del Profesor(a) / Personal *'
                    : 'Nombre del Estudiante *'}
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={modalForm.nombre_estudiante}
                    onChange={(e) => {
                      // Impide escribir números directamente
                      const sinNumeros = e.target.value.replace(/[0-9]/g, '');
                      setModalForm((prev) => ({ ...prev, nombre_estudiante: sinNumeros }));
                    }}
                    placeholder={
                      esModoRepresentante
                        ? 'Ej. Carlos Martínez'
                        : esModoProfesor
                        ? 'Ej. Roberto Mendoza'
                        : 'Ej. Sofía Martínez'
                    }
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 py-3 sm:py-2.5 pl-10 pr-4 text-base sm:text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <p className="mt-1 text-[11px] text-gray-400">
                  Solo se permiten letras y espacios (sin dígitos numéricos).
                </p>
              </div>

              {/* Nombre del Representante / Cargo (Oculto para Modo Representante) */}
              {!esModoRepresentante && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {esModoProfesor
                      ? 'Cargo / Contacto de Emergencia (Opcional)'
                      : 'Nombre del Representante'}
                  </label>
                  <input
                    type="text"
                    value={modalForm.nombre_representante}
                    onChange={(e) => {
                      // Impide escribir números en el nombre del representante
                      const sinNumeros = e.target.value.replace(/[0-9]/g, '');
                      setModalForm((prev) => ({ ...prev, nombre_representante: sinNumeros }));
                    }}
                    placeholder={
                      esModoProfesor
                        ? 'Ej. Coordinador de Matemáticas'
                        : 'Ej. Carlos Martínez'
                    }
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 py-3 sm:py-2.5 px-4 text-base sm:text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              )}

              {/* Teléfono WhatsApp: Selector de Prefijo + Textbox Numérico (Máx 10 dígitos) */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Teléfono WhatsApp ({esModoRepresentante ? 'Representante' : esModoProfesor ? 'Profesor' : 'Representante'})
                </label>
                <div className="flex items-center gap-2">
                  {/* Selector de Prefijo Internacional con Popover Radix */}
                  <Popover.Root open={popoverPrefijoModalAbierto} onOpenChange={setPopoverPrefijoModalAbierto}>
                    <Popover.Trigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50/70 px-3 py-3 sm:py-2.5 text-base sm:text-xs font-bold text-gray-800 hover:bg-white hover:border-gray-300 transition shrink-0 shadow-2xs"
                      >
                        <FlagIcon codigo={modalForm.telefono_prefijo} className="w-5 h-3.5" />
                        <span className="font-mono">{modalForm.telefono_prefijo}</span>
                        <ChevronDown className={`h-3 w-3 text-gray-400 transition-transform ${popoverPrefijoModalAbierto ? 'rotate-180 text-gray-700' : ''}`} />
                      </button>
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Content
                        className="z-50 w-56 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl outline-none backdrop-blur-lg animate-in fade-in-0 zoom-in-95 max-h-56 overflow-y-auto"
                        align="start"
                        sideOffset={6}
                      >
                        <div className="space-y-0.5">
                          {PREFIJOS_TELEFONICOS.map((p) => {
                            const esActivo = modalForm.telefono_prefijo === p.codigo;
                            return (
                              <button
                                key={p.codigo}
                                type="button"
                                onClick={() => {
                                  setModalForm((prev) => ({
                                    ...prev,
                                    telefono_prefijo: p.codigo,
                                  }));
                                  setPopoverPrefijoModalAbierto(false);
                                }}
                                className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-semibold transition ${
                                  esActivo
                                    ? 'bg-indigo-50 text-indigo-900 font-bold'
                                    : 'text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <FlagIcon codigo={p.codigo} className="w-5 h-3.5" />
                                  <span className="font-mono font-bold">{p.codigo}</span>
                                  <span className="text-[11px] text-gray-400 truncate max-w-[90px]">{p.pais}</span>
                                </span>
                                {esActivo && <Check className="h-3.5 w-3.5 text-indigo-600 shrink-0 ml-1" />}
                              </button>
                            );
                          })}
                        </div>
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>

                  {/* Textbox para lo restante del número (Solo números, máx 10) */}
                  <div className="relative flex-1">
                    <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={10}
                      value={modalForm.telefono_numero}
                      onChange={(e) => {
                        // Solo permite números y corta a un máximo de 10 caracteres
                        const soloNums = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setModalForm((prev) => ({ ...prev, telefono_numero: soloNums }));
                      }}
                      placeholder="4125404830"
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 py-3 sm:py-2.5 pl-10 pr-12 text-base sm:text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 font-mono"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-gray-400">
                      {modalForm.telefono_numero.length}/10
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-gray-400">
                  Selecciona el código de país (ej. +58) e ingresa hasta 10 dígitos (ej: 4125404830).
                </p>
              </div>

              {/* Alerta de Teléfono Duplicado para Representantes */}
              {representanteDuplicado && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-3.5 space-y-1.5 animate-in fade-in-50 text-rose-900">
                  <div className="flex items-center gap-2 font-bold text-xs text-rose-700">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Número ya asignado a otro representante</span>
                  </div>
                  <p className="text-xs text-rose-800 leading-snug">
                    El representante <strong>{representanteDuplicado.nombre_estudiante}</strong> ya está registrado con este mismo teléfono ({representanteDuplicado.telefono_whatsapp}).
                  </p>
                  <p className="text-[11px] text-rose-600 font-medium">
                    No se permiten 2 representantes con el mismo número telefónico.
                  </p>
                </div>
              )}

              {/* Detección en tiempo real de familiares vinculados */}
              {!representanteDuplicado && vinculosDetectadosModal.length > 0 && (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 p-3.5 space-y-2 animate-in fade-in-50">
                  <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs">
                    <span className="text-base">👨‍👩‍👧</span>
                    <span>Vínculo familiar detectado en el sistema</span>
                  </div>
                  <div className="space-y-1.5">
                    {vinculosDetectadosModal.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between rounded-xl bg-white/95 p-2.5 text-xs border border-indigo-100 shadow-2xs"
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="font-bold text-indigo-950 truncate">{v.nombre}</span>
                          <span className="text-[11px] text-indigo-700/80">
                            {v.relacionTexto}
                          </span>
                        </div>
                        <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold text-indigo-800 shrink-0">
                          {v.tipo === 'padre' ? 'Representante' : v.tipo === 'hijo' ? 'Estudiante' : 'Familiar'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-indigo-700/70">
                    Al registrar, este contacto quedará enlazado con su familiar para fácil localización y seguimiento.
                  </p>
                </div>
              )}

              {/* Botones de acción */}
              <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-gray-100 pt-4">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    disabled={modalForm.guardando}
                    className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                  >
                    Cancelar
                  </button>
                </Dialog.Close>

                <button
                  type="submit"
                  disabled={modalForm.guardando || !!representanteDuplicado}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {modalForm.guardando ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>{modalForm.modo === 'crear' ? 'Registrar' : 'Guardar Cambios'}</span>
                  )}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Modal Confirmar Eliminación */}
      <Dialog.Root
        open={modalEliminar.abierto}
        onOpenChange={(abierto) => setModalEliminar((prev) => ({ ...prev, abierto }))}
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

            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="h-5 w-5" />
                <Dialog.Title className="text-base font-bold text-gray-900">
                  Confirmar Eliminación
                </Dialog.Title>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={modalEliminar.eliminando}
                  className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            <Dialog.Description className="mt-3 text-xs text-gray-600">
              ¿Estás seguro de que deseas eliminar a{' '}
              <strong className="text-gray-900 font-bold">
                {modalEliminar.cliente?.nombre_estudiante}
              </strong>{' '}
              del directorio? Esta acción no se puede deshacer.
            </Dialog.Description>

            {modalEliminar.tieneDeuda && (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <Receipt className="h-4 w-4 text-amber-700" />
                  <span>Atención: Presenta deudas pendientes</span>
                </div>
                <p>
                  Tiene consumos sin pagar por un total de{' '}
                  <strong>{formatUSD(modalEliminar.totalDeudaUsd)}</strong>.
                </p>
              </div>
            )}

            {modalEliminar.error && (
              <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{modalEliminar.error}</span>
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-gray-100 pt-4">
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={modalEliminar.eliminando}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
              </Dialog.Close>

              <button
                type="button"
                onClick={handleConfirmarEliminar}
                disabled={modalEliminar.eliminando}
                className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition disabled:opacity-60"
              >
                {modalEliminar.eliminando ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <span>Sí, Eliminar</span>
                )}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Modal para Registrar Abono / Pago Adelantado / Saldo a Favor */}
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
            className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain touch-scroll-ios rounded-t-3xl sm:rounded-3xl border-t sm:border border-gray-200/90 bg-white p-4 sm:p-6 pb-28 sm:pb-6 shadow-2xl outline-none duration-300 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in-0 sm:zoom-in-95 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[95vw] sm:max-w-md cursor-grab active:cursor-grabbing"
          >
            {/* Manija táctil para móviles */}
            <div
              className="mx-auto mb-3 -mt-1 flex h-6 w-full cursor-grab active:cursor-grabbing items-center justify-center sm:hidden touch-none"
              title="Deslizar hacia abajo para cerrar"
            >
              <div className="h-1.5 w-12 rounded-full bg-gray-300 active:bg-gray-400 transition-colors" />
            </div>

            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <Dialog.Title className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                  <PiggyBank className="h-5 w-5 text-indigo-600" />
                  <span>Abono o Pago Adelantado</span>
                </Dialog.Title>
                <Dialog.Description className="text-xs text-gray-500">
                  {modalAbono.cliente?.nombre_estudiante} ({modalAbono.cliente?.grado_seccion || 'Cliente'})
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={modalAbono.guardando}
                  className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            {/* Error si ocurre */}
            {modalAbono.error && (
              <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{modalAbono.error}</span>
              </div>
            )}

            {/* Estado actual del cliente */}
            {modalAbono.cliente && (() => {
              const s = modalAbono.cliente.saldo !== undefined && modalAbono.cliente.saldo !== null
                ? Number(modalAbono.cliente.saldo)
                : (saldosClientes[modalAbono.cliente.id]?.saldoNetoUsd || 0);
              const deudaActual = s < 0 ? Math.abs(s) : 0;
              const saldoAFavor = s > 0 ? s : 0;
              return (
                <div className="mt-3 rounded-2xl border border-gray-200/80 bg-gray-50/70 p-3 text-xs space-y-1">
                  <div className="flex justify-between text-gray-600">
                    <span>Deuda pendiente actual:</span>
                    <span className={`font-bold ${deudaActual > 0 ? 'text-amber-800' : 'text-gray-700'}`}>
                      {formatUSD(deudaActual)}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Saldo a favor disponible:</span>
                    <span className={`font-bold ${saldoAFavor > 0 ? 'text-emerald-700' : 'text-gray-700'}`}>
                      +{formatUSD(saldoAFavor)}
                    </span>
                  </div>
                </div>
              );
            })()}

            <form onSubmit={handleConfirmarAbono} className="mt-4 space-y-4">
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

      {/* Modal Ficha del Estudiante e Historial de Consumos (Radix UI Dialog) */}
      <Dialog.Root
        open={modalFicha.abierto}
        onOpenChange={(abierto) => setModalFicha((prev) => ({ ...prev, abierto }))}
      >
        <Dialog.Portal>
          <Dialog.Overlay
            {...dragScrollFicha.overlayProps}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          />
          <Dialog.Content
            style={dragScrollFicha.style}
            {...dragScrollFicha.dragProps}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto overscroll-contain touch-scroll-ios rounded-t-3xl sm:rounded-3xl border-t sm:border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-4 sm:p-6 pb-28 sm:pb-6 shadow-2xl outline-none duration-300 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in-0 sm:zoom-in-95 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[95vw] sm:max-w-2xl cursor-grab active:cursor-grabbing"
          >
            {/* Manija táctil */}
            <div className="mx-auto mb-3 -mt-1 flex h-6 w-full cursor-grab active:cursor-grabbing items-center justify-center sm:hidden touch-none">
              <div className="h-1.5 w-12 rounded-full bg-gray-300 dark:bg-slate-700" />
            </div>

            {modalFicha.cliente && (() => {
              const cli = modalFicha.cliente;
              const s = cli.saldo !== undefined && cli.saldo !== null
                ? Number(cli.saldo)
                : (saldosClientes[cli.id]?.saldoNetoUsd || 0);
              const saldoAFavor = s > 0 ? s : 0;
              const deuda = s < 0 ? Math.abs(s) : 0;

              return (
                <div className="space-y-4">
                  {/* Encabezado de la Ficha */}
                  <div className="flex items-start justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
                    <div>
                      <Dialog.Title className="text-base sm:text-lg font-black text-gray-900 dark:text-slate-100 flex items-center gap-2">
                        <User className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        <span>Ficha del Alumno / Cliente</span>
                      </Dialog.Title>
                      <Dialog.Description className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                        {cli.nombre_estudiante} &bull; {cli.grado_seccion || 'Sin sección'}
                        {cli.nombre_representante ? ` &bull; Rep: ${cli.nombre_representante}` : ''}
                      </Dialog.Description>
                    </div>

                    {/* Insignia de Saldo Actual */}
                    <div className="text-right">
                      {saldoAFavor > 0 ? (
                        <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 text-[11px] font-black text-emerald-800 dark:text-emerald-300">
                          +{formatUSD(saldoAFavor)} a favor
                        </span>
                      ) : deuda > 0 ? (
                        <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-2.5 py-1 text-[11px] font-black text-amber-800 dark:text-amber-300">
                          -{formatUSD(deuda)} deudor
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-gray-600 dark:text-slate-300">
                          Solvente ($0.00)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Lista de Consumos Registrados */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
                        <History className="h-4 w-4 text-indigo-600" />
                        <span>Historial de Consumos y Compras</span>
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {modalFicha.consumos.length} registros
                      </span>
                    </div>

                    {modalFicha.cargando ? (
                      <div className="py-8 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-600" />
                        <span className="text-xs text-gray-400 mt-2 block">Cargando compras...</span>
                      </div>
                    ) : modalFicha.consumos.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-gray-200 dark:border-slate-800 p-6 text-center text-xs text-gray-400">
                        No hay ventas o consumos registrados para este cliente todavía.
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                        {modalFicha.consumos.map((c) => {
                          const audit = parseConsumoAudit({
                            metodo_pago: c.metodo_pago,
                            pagado: c.pagado,
                          });
                          const fecha = c.fecha ? new Date(c.fecha).toLocaleDateString('es-VE', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          }) : 'Fecha no registrada';

                          return (
                            <div
                              key={c.id}
                              className={`rounded-2xl border p-3 text-xs transition ${
                                audit.esAnulado
                                  ? 'border-rose-200 dark:border-rose-950 bg-rose-50/20 opacity-75'
                                  : audit.esPendiente
                                  ? 'border-amber-200 dark:border-amber-950 bg-amber-50/20'
                                  : 'border-gray-200/80 dark:border-slate-800 bg-white dark:bg-[#111726]'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`font-mono font-black text-sm ${
                                        audit.esAnulado
                                          ? 'line-through text-gray-400'
                                          : 'text-gray-900 dark:text-slate-100'
                                      }`}
                                    >
                                      {formatUSD(c.monto_total_usd)}
                                    </span>
                                    <span className="font-mono text-[10px] text-gray-400">
                                      ({formatBs(calcularConversionBs(c.monto_total_usd, c.tasa_bcv_historica || tasaBcv))})
                                    </span>

                                    <span
                                      className={`rounded-full px-2 py-0.2 text-[9px] font-bold uppercase tracking-wider ${
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

                                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                                    {fecha} &bull; Método: {audit.nombreLegible}
                                    {audit.referencia ? ` (#${audit.referencia})` : ''}
                                  </span>
                                </div>

                                {/* Botón Anular Venta si no está anulada */}
                                {!audit.esAnulado && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setModalAnular({
                                        abierto: true,
                                        consumo: c,
                                        procesando: false,
                                        error: null,
                                      })
                                    }
                                    className="flex items-center gap-1 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 text-[11px] font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition active:scale-95 shrink-0"
                                    title="Anular venta y revertir deuda o saldo"
                                  >
                                    <RotateCcw className="h-3 w-3" />
                                    <span>Anular Venta</span>
                                  </button>
                                )}
                              </div>

                              {/* Artículos comprados */}
                              {c.consumo_detalles && c.consumo_detalles.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-800/80 text-[11px] text-gray-600 dark:text-slate-300">
                                  <span className="font-semibold text-gray-400 text-[10px] uppercase block mb-0.5">
                                    Ítems:
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {c.consumo_detalles.map((cd: any, idx: number) => (
                                      <span
                                        key={cd.id || idx}
                                        className="rounded-lg bg-gray-50 dark:bg-[#161D2E] px-2 py-0.5 border border-gray-100 dark:border-slate-800 text-[10px] font-medium"
                                      >
                                        {cd.cantidad}x {cd.productos?.nombre || 'Producto'} ({formatUSD(cd.precio_unitario_usd)})
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setModalFicha({ abierto: false, cliente: null, consumos: [], cargando: false })}
                      className="rounded-2xl border border-gray-200 dark:border-slate-800 px-4 py-2 text-xs font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-50 transition"
                    >
                      Cerrar Ficha
                    </button>
                  </div>
                </div>
              );
            })()}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Modal Confirmar Anulación desde Ficha (Radix UI Dialog) */}
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
                  Anular Venta / Devolución
                </Dialog.Title>
                <Dialog.Description className="text-xs text-gray-500 dark:text-slate-400">
                  Esta acción reajustará el saldo del cliente automáticamente.
                </Dialog.Description>
              </div>
            </div>

            {modalAnular.consumo && (() => {
              const c = modalAnular.consumo;
              const audit = parseConsumoAudit({ metodo_pago: c.metodo_pago, pagado: c.pagado });

              return (
                <div className="space-y-3 text-xs text-gray-600 dark:text-slate-300">
                  <div className="rounded-2xl border border-rose-100 dark:border-rose-950 bg-rose-50/60 dark:bg-rose-950/30 p-3 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-500">Monto:</span>
                      <span className="font-mono font-black text-rose-700 dark:text-rose-400">
                        {formatUSD(c.monto_total_usd)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-500">Método de Pago:</span>
                      <span className="font-bold text-gray-800 dark:text-slate-200">
                        {audit.nombreLegible}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/80 dark:bg-[#111726] p-3 text-xs">
                    <span className="font-bold text-gray-800 dark:text-slate-200 block mb-1">
                      Efecto Contable:
                    </span>
                    {audit.metodoBase === 'pendiente' ? (
                      <p className="text-amber-800 dark:text-amber-300">
                        ✓ <strong>Se reversará la deuda</strong> de {formatUSD(c.monto_total_usd)}, sumando +{formatUSD(c.monto_total_usd)} a la cuenta corriente del cliente.
                      </p>
                    ) : audit.metodoBase === 'saldo_favor' ? (
                      <p className="text-emerald-800 dark:text-emerald-300">
                        ✓ <strong>Se reembolsará el saldo a favor</strong> de {formatUSD(c.monto_total_usd)} a la cuenta del cliente.
                      </p>
                    ) : audit.esMixto ? (
                      <p className="text-indigo-800 dark:text-indigo-300">
                        ✓ <strong>Pago mixto:</strong> se reembolsará la porción de saldo a favor usada y se cancelará la transacción.
                      </p>
                    ) : (
                      <p className="text-gray-700 dark:text-slate-300">
                        ✓ <strong>Cobro en caja ({audit.nombreLegible}):</strong> la venta se registrará como anulada/devuelta en caja.
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
                      onClick={handleConfirmarAnulacionDesdeFicha}
                      className="flex items-center gap-1.5 rounded-2xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition disabled:opacity-50"
                    >
                      {modalAnular.procesando ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Anulando...</span>
                        </>
                      ) : (
                        <span>Confirmar Anulación</span>
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

