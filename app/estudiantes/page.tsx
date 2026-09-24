'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
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
  Loader2,
  ShieldCheck,
  ExternalLink,
  Briefcase,
  BookOpen,
  ArrowLeft,
  PlusCircle,
  Menu,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { obtenerTasaBCV, TASA_BCV_FALLBACK_DEFAULT } from '@/lib/dolarApi';
import { formatUSD, formatBs, calcularConversionBs } from '@/lib/utils';
import { NotificationBell } from '@/components/NotificationBell';
import { useSidebar } from '@/components/SidebarContext';
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

interface DeudaResumenEstudiante {
  totalUsd: number;
  cantidadConsumos: number;
}

export default function EstudiantesPage() {
  const [montado, setMontado] = useState(false);
  const { toggleSidebar, abierto: sidebarAbierto } = useSidebar();

  // Tasa BCV
  const [tasaBcv, setTasaBcv] = useState<number>(TASA_BCV_FALLBACK_DEFAULT);
  const [cargandoTasa, setCargandoTasa] = useState<boolean>(true);

  // Clientes y Deudas desde Supabase
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargandoClientes, setCargandoClientes] = useState<boolean>(true);
  const [resumenDeudas, setResumenDeudas] = useState<Record<string, DeudaResumenEstudiante>>({});

  // Filtros
  const [busqueda, setBusqueda] = useState<string>('');
  const [filtroGrado, setFiltroGrado] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'con_deuda' | 'solvente'>('todos');
  const [popoverGradoAbierto, setPopoverGradoAbierto] = useState<boolean>(false);

  // Notificaciones Toast
  const [notificacion, setNotificacion] = useState<{ tipo: 'exito' | 'info' | 'error'; texto: string } | null>(null);

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

  // 2. Cargar Clientes y Consumos Pendientes
  const cargarDatos = useCallback(async () => {
    setCargandoClientes(true);
    try {
      const { data: clientesDb, error: errClientes } = await supabase
        .from('clientes')
        .select('*')
        .order('nombre_estudiante', { ascending: true });

      if (errClientes) throw errClientes;
      setClientes(clientesDb || []);

      const { data: consumosPendientes, error: errConsumos } = await supabase
        .from('consumos')
        .select('cliente_id, monto_total_usd')
        .eq('pagado', false);

      if (!errConsumos && consumosPendientes) {
        const mapa: Record<string, DeudaResumenEstudiante> = {};
        for (const item of consumosPendientes) {
          if (!item.cliente_id) continue;
          if (!mapa[item.cliente_id]) {
            mapa[item.cliente_id] = { totalUsd: 0, cantidadConsumos: 0 };
          }
          mapa[item.cliente_id].totalUsd += Number(item.monto_total_usd || 0);
          mapa[item.cliente_id].cantidadConsumos += 1;
        }
        setResumenDeudas(mapa);
      }
    } catch (err) {
      console.error('Error cargando estudiantes y deudas:', err);
      setNotificacion({
        tipo: 'error',
        texto: 'Error al conectar con la base de datos de Supabase.',
      });
      setTimeout(() => setNotificacion(null), 4000);
    } finally {
      setCargandoClientes(false);
    }
  }, []);

  useEffect(() => {
    setMontado(true);
    cargarTasa();
    cargarDatos();
  }, [cargarTasa, cargarDatos]);

  // Grados / Secciones únicos para el filtro
  const gradosDisponibles = useMemo(() => {
    const set = new Set<string>();
    clientes.forEach((c) => {
      if (c.grado_seccion && c.grado_seccion.trim()) {
        set.add(c.grado_seccion.trim());
      }
    });
    return Array.from(set).sort();
  }, [clientes]);

  // Filtrado reactivo de clientes
  const clientesFiltrados = useMemo(() => {
    let lista = [...clientes];

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      lista = lista.filter((c) => {
        const est = c.nombre_estudiante.toLowerCase();
        const rep = (c.nombre_representante || '').toLowerCase();
        const grado = (c.grado_seccion || '').toLowerCase();
        const tel = c.telefono_whatsapp || '';
        return est.includes(q) || rep.includes(q) || grado.includes(q) || tel.includes(q);
      });
    }

    if (filtroGrado !== 'todos') {
      lista = lista.filter((c) => c.grado_seccion === filtroGrado);
    }

    if (filtroEstado === 'con_deuda') {
      lista = lista.filter((c) => {
        const deuda = resumenDeudas[c.id];
        return deuda && deuda.totalUsd > 0;
      });
    } else if (filtroEstado === 'solvente') {
      lista = lista.filter((c) => {
        const deuda = resumenDeudas[c.id];
        return !deuda || deuda.totalUsd === 0;
      });
    }

    return lista;
  }, [clientes, busqueda, filtroGrado, filtroEstado, resumenDeudas]);

  // Métricas
  const totalEstudiantes = clientes.length;
  const estudiantesConDeuda = useMemo(() => {
    return clientes.filter((c) => (resumenDeudas[c.id]?.totalUsd || 0) > 0).length;
  }, [clientes, resumenDeudas]);

  const totalDeudaGlobalUsd = useMemo(() => {
    return Object.values(resumenDeudas).reduce((acc, curr) => acc + curr.totalUsd, 0);
  }, [resumenDeudas]);

  const totalDeudaGlobalBs = useMemo(() => {
    return calcularConversionBs(totalDeudaGlobalUsd, tasaBcv);
  }, [totalDeudaGlobalUsd, tasaBcv]);

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

      const payload = {
        nombre_estudiante: nombreLimpio,
        grado_seccion: gradoFinal,
        nombre_representante: repLimpio || null,
        telefono_whatsapp: telefonoCompleto,
      };

      if (modalForm.modo === 'crear') {
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
      await cargarDatos();
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
    const deuda = resumenDeudas[c.id];
    setModalEliminar({
      abierto: true,
      cliente: c,
      tieneDeuda: !!(deuda && deuda.totalUsd > 0),
      totalDeudaUsd: deuda ? deuda.totalUsd : 0,
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
      await cargarDatos();
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
    const deuda = resumenDeudas[c.id];

    let textoDeuda = 'Actualmente su cuenta se encuentra completamente al dia y solvente.';
    if (deuda && deuda.totalUsd > 0) {
      const bs = calcularConversionBs(deuda.totalUsd, tasaBcv);
      textoDeuda = `Le recordamos amablemente que presenta un saldo pendiente de ${formatUSD(deuda.totalUsd)} (${formatBs(bs)} a tasa oficial BCV: ${formatBs(tasaBcv)}).`;
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
      <div className="min-h-screen flex flex-col bg-[#FAFAFA]" suppressHydrationWarning>
        <header className="sticky top-0 z-30 w-full border-b border-gray-200/70 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <div className="h-6 w-48 bg-gray-200 rounded-md animate-pulse" />
            <div className="h-9 w-44 bg-amber-50 rounded-2xl animate-pulse" />
          </div>
        </header>
        <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-28 rounded-3xl bg-white border border-gray-200/80 p-5 animate-pulse" />
            ))}
          </div>
          <div className="h-72 rounded-3xl bg-white border border-gray-200/80 p-6 animate-pulse" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA]" suppressHydrationWarning>
      {/* Header Superior Sticky */}
      <header className="sticky top-0 z-40 w-full border-b border-gray-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            {/* Botón Hamburguesa: visible en móviles (< md) o en escritorio cuando el sidebar está cerrado (!abierto) */}
            <button
              type="button"
              onClick={toggleSidebar}
              className={`h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl border border-gray-200/90 bg-white text-gray-700 shadow-2xs hover:bg-gray-100 hover:text-indigo-600 transition active:scale-95 ${
                !sidebarAbierto ? 'flex' : 'flex md:hidden'
              }`}
              title="Abrir menú de navegación"
              aria-label="Abrir barra lateral"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 shadow-xs">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-sm sm:text-lg font-bold tracking-tight text-gray-900 truncate">
                  Estudiantes
                </h1>
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-1.5 py-0.2 text-[10px] sm:text-[11px] font-semibold text-indigo-700 shrink-0">
                  {clientes.length}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-gray-500 hidden sm:block">
                Directorio escolar (Preescolar, Primaria, Bachillerato y Profesores)
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
              className="flex sm:hidden items-center gap-1 rounded-full border border-amber-200/90 bg-amber-50/90 px-2 py-1 text-[11px] font-mono font-bold text-amber-900 shadow-2xs active:scale-95 transition"
            >
              <TrendingUp className="h-3 w-3 text-amber-700 shrink-0" />
              <span>{tasaBcv > 0 ? formatBs(tasaBcv) : '...'}</span>
              {cargandoTasa && <RefreshCw className="h-2.5 w-2.5 animate-spin text-amber-700" />}
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
                title="Actualizar tasa"
                className="ml-1 rounded-lg p-1 text-amber-800 hover:bg-amber-100 transition"
              >
                <RefreshCw className={`h-3 w-3 ${cargandoTasa ? 'animate-spin' : ''}`} />
              </button>
            </div>

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
        <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-3 mb-6">
          <div className="rounded-3xl border border-gray-200/80 bg-white p-4 sm:p-5 shadow-xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Total Personas Registradas
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
              {gradosDisponibles.length} salas, grados, años y personal escolar
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
                  ({formatUSD(totalDeudaGlobalUsd)})
                </span>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-800">
                <Receipt className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-1 text-xs text-amber-800/80 font-mono">
              Equivalente: {formatBs(totalDeudaGlobalBs)}
            </p>
          </div>

          <div className="rounded-3xl border border-gray-200/80 bg-white p-4 sm:p-5 shadow-xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Clientes Solventes (Al Día)
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
              Sin consumos pendientes de cobro
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

          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar">
            {/* Popover Grado / Sección */}
            <Popover.Root open={popoverGradoAbierto} onOpenChange={setPopoverGradoAbierto}>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-2xl border border-gray-200/90 bg-gray-50/70 px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-2xs hover:border-gray-300 hover:bg-white transition"
                >
                  <GraduationCap className="h-4 w-4 text-indigo-600" />
                  <span>
                    {filtroGrado === 'todos'
                      ? `Todos los Niveles (${gradosDisponibles.length})`
                      : filtroGrado}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-gray-400 transition-transform ${
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
                              <Briefcase className="h-3 w-3 text-amber-600" />
                            ) : (
                              <GraduationCap className="h-3 w-3 text-indigo-500" />
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
                Todos
              </button>
              <button
                type="button"
                onClick={() => setFiltroEstado('con_deuda')}
                className={`flex items-center gap-1 rounded-xl px-3 py-1 text-xs font-bold transition ${
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
                onClick={() => setFiltroEstado('solvente')}
                className={`rounded-xl px-3 py-1 text-xs font-bold transition ${
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
              onClick={cargarDatos}
              disabled={cargandoClientes}
              className="flex items-center gap-1.5 rounded-2xl border border-gray-200/80 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 transition disabled:opacity-60"
              title="Recargar directorio"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${cargandoClientes ? 'animate-spin' : ''}`} />
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
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 bg-white/70 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-indigo-50 border border-indigo-100 text-indigo-600 mb-3 shadow-xs">
              <Users className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-gray-900">
              {busqueda || filtroGrado !== 'todos' || filtroEstado !== 'todos'
                ? 'No se encontraron coincidencias'
                : 'Directorio escolar vacío'}
            </h3>
            <p className="mt-1 text-xs text-gray-500 max-w-sm">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {clientesFiltrados.map((cliente) => {
                const deuda = resumenDeudas[cliente.id];
                const tieneDeuda = !!(deuda && deuda.totalUsd > 0);
                const iniciales = getIniciales(cliente.nombre_estudiante);
                const esProf = esProfesorOPersonal(cliente.grado_seccion);
                const esPadre = esRepresentante(cliente.grado_seccion);
                const vinculos = encontrarVinculosCliente(cliente, clientes);

                return (
                  <motion.div
                    key={cliente.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.2 }}
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
                          <span className="font-mono font-medium text-gray-800">
                            {cliente.telefono_whatsapp || 'No registrado'}
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

                      {/* Estado de Deuda / Solvencia */}
                      <div className="mt-3">
                        {tieneDeuda ? (
                          <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50/80 to-yellow-50/50 p-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Receipt className="h-4 w-4 text-amber-700 shrink-0" />
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold uppercase text-amber-900">
                                  Saldo Pendiente ({deuda.cantidadConsumos}{' '}
                                  {deuda.cantidadConsumos === 1 ? 'consumo' : 'consumos'})
                                </span>
                                <span className="font-mono text-xs font-bold text-amber-950">
                                  {formatUSD(deuda.totalUsd)} &bull;{' '}
                                  {formatBs(calcularConversionBs(deuda.totalUsd, tasaBcv))}
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
                              Solvente &bull; Sin deudas pendientes
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Botón WhatsApp */}
                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleAbrirWhatsApp(cliente)}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl border border-emerald-200/90 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 shadow-2xs hover:bg-emerald-100 hover:border-emerald-300 transition active:scale-95"
                      >
                        <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Contactar por WhatsApp</span>
                      </button>

                      {tieneDeuda && (
                        <Link
                          href="/deudas"
                          className="flex items-center justify-center gap-1 rounded-2xl bg-gray-900 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-black transition active:scale-95"
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
            className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain rounded-t-3xl sm:rounded-3xl border-t sm:border border-gray-200/90 bg-white p-4 sm:p-6 shadow-2xl outline-none duration-300 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in-0 sm:zoom-in-95 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[95vw] sm:max-w-lg cursor-grab active:cursor-grabbing touch-pan-y"
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
                      className="flex w-full items-center justify-between rounded-2xl border border-gray-200 bg-gray-50/70 px-4 py-2.5 text-left text-sm transition hover:border-gray-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 shadow-2xs"
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
                    className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50/50 py-2 px-3 text-xs text-gray-900 outline-none focus:border-indigo-500 focus:bg-white"
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
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
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
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 py-2.5 px-4 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
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
                        className="flex items-center gap-1.5 rounded-2xl border border-gray-200 bg-gray-50/70 px-3 py-2.5 text-xs font-bold text-gray-800 hover:bg-white hover:border-gray-300 transition shrink-0 shadow-2xs"
                      >
                        <span className="text-sm">{prefijoSeleccionadoObj?.bandera || '🇻🇪'}</span>
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
                                  <span className="text-sm">{p.bandera}</span>
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
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 py-2.5 pl-10 pr-12 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 font-mono"
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
            className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain rounded-t-3xl sm:rounded-3xl border-t sm:border border-gray-200/90 bg-white p-4 sm:p-6 shadow-2xl outline-none duration-300 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in-0 sm:zoom-in-95 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[95vw] sm:max-w-lg cursor-grab active:cursor-grabbing touch-pan-y"
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
    </div>
  );
}
