'use client';

import React, { useState, useMemo } from 'react';
import * as Popover from '@radix-ui/react-popover';
import * as Dialog from '@radix-ui/react-dialog';
import {
  User,
  Search,
  Check,
  X,
  Phone,
  GraduationCap,
  ChevronDown,
  UserCheck,
  Briefcase,
  UserPlus,
  Loader2,
  AlertCircle,
  Sparkles,
  ArrowLeft,
  PlusCircle,
  Pencil,
  Users,
} from 'lucide-react';
import { Cliente } from '@/types/pos';
import { supabase } from '@/lib/supabaseClient';
import { useModalDragScroll } from '@/lib/useModalDragScroll';
import {
  esProfesorOPersonal,
  esRepresentante,
  esAdultoOPersonal,
  CATEGORIAS_DOS_PASOS,
  SECCIONES_PREDETERMINADAS,
  PREFIJOS_TELEFONICOS,
  obtenerCategoriaDeGrado,
  encontrarVinculosCliente,
} from '@/lib/constants';

interface ClientSelectorProps {
  clientes: Cliente[];
  clienteSeleccionado: Cliente | null;
  onSeleccionarCliente: (cliente: Cliente | null) => void;
  onClienteCreado?: (cliente: Cliente) => void;
  cargando?: boolean;
}

export function ClientSelector({
  clientes,
  clienteSeleccionado,
  onSeleccionarCliente,
  onClienteCreado,
  cargando = false,
}: ClientSelectorProps) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  // Estados para Modal de Alta Rápida de Cliente (Radix UI Dialog)
  const [modalRegistroAbierto, setModalRegistroAbierto] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoGrado, setNuevoGrado] = useState('1er Grado A');
  const [nuevoGradoCustom, setNuevoGradoCustom] = useState('');
  const [nuevoRepresentante, setNuevoRepresentante] = useState('');
  const [nuevoPrefijo, setNuevoPrefijo] = useState('+58');
  const [nuevoTelefonoNumero, setNuevoTelefonoNumero] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorRegistro, setErrorRegistro] = useState<string | null>(null);

  // Deslizamiento vertical y arrastre (drag-to-scroll) para móviles y emuladores con Body Scroll Lock
  const dragScrollRegistro = useModalDragScroll({
    isOpen: modalRegistroAbierto,
    onDismiss: () => setModalRegistroAbierto(false),
  });

  // Estados del selector de Grado/Nivel interactivo idéntico al módulo de Gestión
  const [popoverGradoModalAbierto, setPopoverGradoModalAbierto] = useState(false);
  const [categoriaActivaModal, setCategoriaActivaModal] = useState<
    'preescolar' | 'primaria' | 'bachillerato' | 'personal'
  >('primaria');
  const [pasoSelectorGrado, setPasoSelectorGrado] = useState<'grados' | 'secciones'>('grados');
  const [gradoBaseSeleccionado, setGradoBaseSeleccionado] = useState('1er Grado');
  const [mostrandoInputSeccionExtra, setMostrandoInputSeccionExtra] = useState(false);
  const [seccionPersonalizadaInput, setSeccionPersonalizadaInput] = useState('');

  const clientesFiltrados = useMemo(() => {
    if (!busqueda.trim()) return clientes;
    const q = busqueda.toLowerCase().trim();
    return clientes.filter(
      (c) =>
        c.nombre_estudiante.toLowerCase().includes(q) ||
        (c.grado_seccion && c.grado_seccion.toLowerCase().includes(q)) ||
        (c.nombre_representante && c.nombre_representante.toLowerCase().includes(q)) ||
        (c.telefono_whatsapp && c.telefono_whatsapp.includes(q))
    );
  }, [clientes, busqueda]);

  // Verificar si hay coincidencia exacta con lo que el usuario escribió
  const existeCoincidenciaExacta = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return false;
    return clientes.some((c) => c.nombre_estudiante.trim().toLowerCase() === q);
  }, [clientes, busqueda]);

  // Grado final actual calculado
  const gradoFinalCalculado = useMemo(() => {
    if (nuevoGrado === 'otro') return nuevoGradoCustom.trim() || 'Nivel Personalizado';
    return nuevoGrado;
  }, [nuevoGrado, nuevoGradoCustom]);

  // Determinación de roles
  const esRep = useMemo(() => esRepresentante(gradoFinalCalculado), [gradoFinalCalculado]);
  const esDocente = useMemo(() => esProfesorOPersonal(gradoFinalCalculado), [gradoFinalCalculado]);

  // Objeto de la categoría activa en el selector de grado
  const categoriaDosPasosActiva = useMemo(() => {
    return (
      CATEGORIAS_DOS_PASOS.find((c) => c.id === categoriaActivaModal) ||
      CATEGORIAS_DOS_PASOS[1]
    );
  }, [categoriaActivaModal]);

  // Categoría actual seleccionada
  const categoriaActualObj = useMemo(() => {
    const catId = obtenerCategoriaDeGrado(nuevoGrado);
    return CATEGORIAS_DOS_PASOS.find((c) => c.id === catId);
  }, [nuevoGrado]);

  // Detección automática en vivo de vínculos familiares por número de teléfono
  const vinculosDetectados = useMemo(() => {
    const telDigits = nuevoTelefonoNumero.trim().replace(/\D/g, '');
    if (telDigits.length < 7) return [];
    const telCompleto = `${nuevoPrefijo} ${telDigits}`;
    return encontrarVinculosCliente(
      {
        nombre_estudiante: nuevoNombre,
        grado_seccion: gradoFinalCalculado,
        telefono_whatsapp: telCompleto,
      },
      clientes
    );
  }, [nuevoTelefonoNumero, nuevoPrefijo, nuevoNombre, gradoFinalCalculado, clientes]);

  // Abrir modal de alta rápida pre-llenando el nombre con lo buscado
  const handleAbrirRegistroExpress = (nombreInicial: string = '') => {
    setNuevoNombre(nombreInicial);
    setNuevoGrado('1er Grado A');
    setNuevoGradoCustom('');
    setNuevoRepresentante('');
    setNuevoPrefijo('+58');
    setNuevoTelefonoNumero('');
    setErrorRegistro(null);
    setCategoriaActivaModal('primaria');
    setPasoSelectorGrado('grados');
    setGradoBaseSeleccionado('1er Grado');
    setMostrandoInputSeccionExtra(false);
    setSeccionPersonalizadaInput('');
    setPopoverGradoModalAbierto(false);
    setAbierto(false); // Cierra el popover de selección
    setModalRegistroAbierto(true); // Abre el modal de alta rápida
  };

  // Guardar en Supabase y asociar inmediatamente a la orden actual
  const handleGuardarNuevoCliente = async (e: React.FormEvent) => {
    e.preventDefault();

    const nombreLimpio = nuevoNombre.trim();
    if (!nombreLimpio) {
      setErrorRegistro('El nombre es obligatorio.');
      return;
    }

    if (/\d/.test(nombreLimpio)) {
      setErrorRegistro('El nombre no debe contener números.');
      return;
    }

    const repLimpio = nuevoRepresentante.trim();
    if (repLimpio && /\d/.test(repLimpio)) {
      setErrorRegistro('El nombre del representante no debe contener números.');
      return;
    }

    // Teléfono WhatsApp
    const telDigits = nuevoTelefonoNumero.trim().replace(/\D/g, '');
    let telefonoCompleto: string | null = null;
    if (telDigits) {
      telefonoCompleto = `${nuevoPrefijo} ${telDigits}`;
    }

    // Determinar Grado / Rol final
    const gradoFinal =
      nuevoGrado === 'otro'
        ? nuevoGradoCustom.trim() || null
        : nuevoGrado.trim() || null;

    // Validación estricta para Representantes:
    // 1. Teléfono obligatorio para poder vincular a sus representados
    // 2. No puede haber dos representantes con el mismo número de teléfono
    if (esRepresentante(gradoFinal)) {
      if (!telDigits || telDigits.length < 7) {
        setErrorRegistro(
          'Para registrar a un Representante es obligatorio ingresar su número de WhatsApp (mínimo 7 dígitos) para su vinculación familiar.'
        );
        return;
      }

      const reprExistente = clientes.find((c) => {
        if (!esRepresentante(c.grado_seccion)) return false;
        const cTel = (c.telefono_whatsapp || '').replace(/\D/g, '');
        if (cTel.length < 7) return false;
        return (
          telDigits === cTel ||
          telDigits.endsWith(cTel.slice(-8)) ||
          cTel.endsWith(telDigits.slice(-8))
        );
      });

      if (reprExistente) {
        setErrorRegistro(
          `Ya existe un representante registrado con este número de teléfono (${reprExistente.nombre_estudiante}). No se permiten dos representantes con el mismo teléfono.`
        );
        return;
      }
    }

    setGuardando(true);
    setErrorRegistro(null);

    try {
      const payload = {
        nombre_estudiante: nombreLimpio,
        grado_seccion: gradoFinal,
        nombre_representante: esRep ? null : repLimpio || null,
        telefono_whatsapp: telefonoCompleto,
      };

      const { data, error } = await supabase
        .from('clientes')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        // 1. Notificar al componente padre para agregarlo al estado en memoria
        if (onClienteCreado) {
          onClienteCreado(data);
        }
        // 2. Asociar automáticamente como cliente activo en la orden actual
        onSeleccionarCliente(data);
      }

      // Limpiar y cerrar modal
      setBusqueda('');
      setModalRegistroAbierto(false);
    } catch (err: unknown) {
      console.error('Error al registrar estudiante express:', err);
      setErrorRegistro(
        err instanceof Error
          ? err.message
          : 'Error inesperado al registrar el cliente en la base de datos.'
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <div className="flex w-full items-center gap-2 min-w-0">
        <Popover.Root open={abierto} onOpenChange={setAbierto}>
          <Popover.Trigger asChild>
            <button
              type="button"
              className={`group relative flex flex-1 min-w-0 items-center justify-between gap-2.5 sm:gap-3 rounded-2xl border px-3 sm:px-4 py-2.5 sm:py-3 text-left transition-all ${
                clienteSeleccionado
                  ? 'border-indigo-200/90 bg-indigo-50/40 hover:border-indigo-300 hover:bg-indigo-50/70 shadow-xs'
                  : 'border-gray-200/80 bg-white hover:border-gray-300 hover:bg-gray-50/70 shadow-xs'
              }`}
            >
              <div className="flex items-center gap-2.5 sm:gap-3 overflow-hidden min-w-0 flex-1">
                <div
                  className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                    clienteSeleccionado
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'
                  }`}
                >
                  {clienteSeleccionado ? (
                    <UserCheck className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                  ) : (
                    <User className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                  )}
                </div>

                <div className="overflow-hidden min-w-0 flex-1">
                  <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-gray-500 truncate">
                    {clienteSeleccionado && esRepresentante(clienteSeleccionado.grado_seccion)
                      ? 'Representante / Padre'
                      : clienteSeleccionado && esProfesorOPersonal(clienteSeleccionado.grado_seccion)
                      ? 'Docente / Personal'
                      : 'Estudiante / Cliente'}
                  </div>
                  <div className="truncate text-xs sm:text-sm font-semibold text-gray-900">
                    {clienteSeleccionado ? (
                      clienteSeleccionado.nombre_estudiante
                    ) : (
                      <span className="font-normal text-gray-500 truncate block">
                        Venta General / Ocasional <span className="hidden sm:inline">(Click para asociar)</span>
                      </span>
                    )}
                  </div>
                  {clienteSeleccionado && (
                    <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs truncate">
                      {clienteSeleccionado.grado_seccion && (
                        <span
                          className={`flex items-center gap-1 font-semibold shrink-0 ${
                            esRepresentante(clienteSeleccionado.grado_seccion)
                              ? 'text-purple-800'
                              : esProfesorOPersonal(clienteSeleccionado.grado_seccion)
                              ? 'text-amber-800'
                              : 'text-indigo-700'
                          }`}
                        >
                          {esRepresentante(clienteSeleccionado.grado_seccion) ? (
                            <Users className="h-3 w-3 text-purple-600" />
                          ) : esProfesorOPersonal(clienteSeleccionado.grado_seccion) ? (
                            <Briefcase className="h-3 w-3 text-amber-600" />
                          ) : (
                            <GraduationCap className="h-3 w-3 text-indigo-600" />
                          )}
                          {clienteSeleccionado.grado_seccion}
                        </span>
                      )}
                      {clienteSeleccionado.nombre_representante && (
                        <span className="text-gray-500 truncate">
                          &bull; {esProfesorOPersonal(clienteSeleccionado.grado_seccion) ? 'Área: ' : 'Rep: '}
                          {clienteSeleccionado.nombre_representante}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center shrink-0">
                <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-hover:text-gray-600" />
              </div>
            </button>
          </Popover.Trigger>

          {clienteSeleccionado && (
            <button
              type="button"
              onClick={() => onSeleccionarCliente(null)}
              title="Quitar cliente (Cambiar a Venta General)"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-gray-200/80 bg-white text-gray-400 hover:border-gray-300 hover:bg-gray-100 hover:text-gray-700 shadow-xs transition"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          <Popover.Portal>
            <Popover.Content
              className="z-50 w-[calc(100vw-2rem)] max-w-md rounded-2xl border border-gray-200 bg-white p-3 shadow-xl outline-none backdrop-blur-lg animate-in fade-in-0 zoom-in-95"
              align="start"
              sideOffset={8}
            >
              {/* Buscador de clientes */}
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre, grado o representante..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50/70 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                  autoFocus
                />
                {busqueda && (
                  <button
                    type="button"
                    onClick={() => setBusqueda('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Botón de Registro Express destacado cuando no existe coincidencia exacta */}
              {busqueda.trim().length > 0 && !existeCoincidenciaExacta && (
                <button
                  type="button"
                  onClick={() => handleAbrirRegistroExpress(busqueda.trim())}
                  className="mb-2.5 flex w-full items-center justify-between gap-2.5 rounded-xl border border-indigo-200/90 bg-gradient-to-r from-indigo-50/90 via-blue-50/80 to-indigo-50/90 p-2.5 text-left transition hover:border-indigo-300 hover:shadow-xs group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs group-hover:scale-105 transition-transform">
                      <UserPlus className="h-4 w-4" />
                    </div>
                    <div className="truncate">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                        Registro Express
                      </span>
                      <span className="block text-xs font-bold text-gray-900 truncate">
                        + Registrar &ldquo;{busqueda.trim()}&rdquo; como Nuevo Cliente
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-lg bg-indigo-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-2xs">
                    Alta Rápida
                  </span>
                </button>
              )}

              {/* Opción venta general / sin cliente */}
              <button
                type="button"
                onClick={() => {
                  onSeleccionarCliente(null);
                  setAbierto(false);
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                  !clienteSeleccionado
                    ? 'bg-indigo-50 font-medium text-indigo-900'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Venta General / Ocasional</div>
                    <div className="text-xs text-gray-500">Sin asociar a cuenta personal</div>
                  </div>
                </div>
                {!clienteSeleccionado && <Check className="h-4 w-4 text-indigo-600" />}
              </button>

              {/* Botón rápido para registrar si la búsqueda está vacía */}
              {!busqueda.trim() && (
                <button
                  type="button"
                  onClick={() => handleAbrirRegistroExpress('')}
                  className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-indigo-600 hover:bg-indigo-50/80 transition"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-100/70 text-indigo-700">
                    <UserPlus className="h-3.5 w-3.5" />
                  </div>
                  <span>+ Registrar nuevo estudiante, docente o representante</span>
                </button>
              )}

              <div className="my-2 border-t border-gray-100" />

              {/* Lista de clientes */}
              <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                {cargando ? (
                  <div className="py-6 text-center text-xs text-gray-500">
                    Cargando directorio...
                  </div>
                ) : clientesFiltrados.length === 0 ? (
                  <div className="py-6 px-3 text-center flex flex-col items-center justify-center">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-2">
                      <UserPlus className="h-5 w-5" />
                    </div>
                    <p className="text-xs font-semibold text-gray-900">
                      No se encontró a &ldquo;{busqueda}&rdquo;
                    </p>
                    <p className="text-[11px] text-gray-500 mb-3 max-w-[240px]">
                      ¿Es un nuevo estudiante, docente o representante? Puedes registrarlo en 5 segundos.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleAbrirRegistroExpress(busqueda.trim())}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition active:scale-95"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>+ Registrar &ldquo;{busqueda.trim()}&rdquo;</span>
                    </button>
                  </div>
                ) : (
                  clientesFiltrados.map((cliente) => {
                    const estaSeleccionado = clienteSeleccionado?.id === cliente.id;
                    const esRepItem = esRepresentante(cliente.grado_seccion);
                    const esProfItem = esProfesorOPersonal(cliente.grado_seccion);

                    return (
                      <button
                        key={cliente.id}
                        type="button"
                        onClick={() => {
                          onSeleccionarCliente(cliente);
                          setAbierto(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                          estaSeleccionado
                            ? 'bg-indigo-50 text-indigo-950 font-medium'
                            : 'hover:bg-gray-50 text-gray-800'
                        }`}
                      >
                        <div className="overflow-hidden">
                          <div className="flex items-center gap-1.5 font-medium text-gray-900 truncate">
                            {esRepItem ? (
                              <Users className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                            ) : esProfItem ? (
                              <Briefcase className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                            ) : null}
                            <span className="truncate">{cliente.nombre_estudiante}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 truncate">
                            {cliente.grado_seccion && (
                              <span
                                className={`font-semibold ${
                                  esRepItem
                                    ? 'text-purple-800'
                                    : esProfItem
                                    ? 'text-amber-800'
                                    : 'text-indigo-700'
                                }`}
                              >
                                {cliente.grado_seccion}
                              </span>
                            )}
                            {cliente.nombre_representante && (
                              <span>
                                &bull; {esProfItem ? 'Área: ' : 'Rep: '}
                                {cliente.nombre_representante}
                              </span>
                            )}
                          </div>
                          {cliente.telefono_whatsapp && (
                            <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-mono">
                              <Phone className="h-2.5 w-2.5" />
                              {cliente.telefono_whatsapp}
                            </div>
                          )}
                        </div>

                        {estaSeleccionado && (
                          <Check className="h-4 w-4 shrink-0 text-indigo-600" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>

      {/* Modal de Alta Rápida de Cliente (Radix UI Dialog) */}
      <Dialog.Root open={modalRegistroAbierto} onOpenChange={setModalRegistroAbierto}>
        <Dialog.Portal>
          <Dialog.Overlay
            {...dragScrollRegistro.overlayProps}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          />
          <Dialog.Content
            style={dragScrollRegistro.style}
            {...dragScrollRegistro.dragProps}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain touch-scroll-ios rounded-t-3xl sm:rounded-3xl border-t sm:border border-gray-200/90 bg-white p-4 sm:p-6 pb-28 sm:pb-6 shadow-2xl outline-none duration-300 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in-0 sm:zoom-in-95 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[95vw] sm:max-w-lg cursor-grab active:cursor-grabbing"
          >
            {/* Manija táctil para deslizar hacia arriba y abajo en móviles */}
            <div
              className="mx-auto mb-3 -mt-1 flex h-6 w-full cursor-grab active:cursor-grabbing items-center justify-center sm:hidden touch-none"
              title="Deslizar hacia abajo para cerrar"
            >
              <div className="h-1.5 w-12 rounded-full bg-gray-300 active:bg-gray-400 transition-colors" />
            </div>

            {/* Header del Modal */}
            <div className="flex items-start justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-200/60 text-indigo-600 shadow-2xs">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <Dialog.Title className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <span>Alta Rápida de Cliente</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                        esRep
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : esDocente
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200/80'
                      }`}
                    >
                      {esRep ? 'Representante' : esDocente ? 'Docente / Personal' : 'Estudiante'}
                    </span>
                  </Dialog.Title>
                  <Dialog.Description className="text-xs text-gray-500">
                    Se asociará automáticamente a la venta actual sin modificar tu carrito.
                  </Dialog.Description>
                </div>
              </div>

              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={guardando}
                  className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            {/* Formulario */}
            <form onSubmit={handleGuardarNuevoCliente} className="mt-5 space-y-4">
              {/* Alerta de Error */}
              {errorRegistro && (
                <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{errorRegistro}</span>
                </div>
              )}

              {/* 1. Selector de Año, Grado y Rol Idéntico al Módulo de Gestión */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Nivel Escolar / Grado / Rol <span className="text-rose-500">*</span>
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
                            {nuevoGrado === 'otro'
                              ? (nuevoGradoCustom || 'Nivel Personalizado')
                              : nuevoGrado}
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
                      className="z-[70] w-[calc(100vw-2.5rem)] max-w-sm sm:max-w-md rounded-3xl border border-gray-200/90 bg-white p-3.5 shadow-2xl outline-none backdrop-blur-xl animate-in fade-in-0 zoom-in-95"
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
                            <span>
                              {categoriaDosPasosActiva.requiereSeccion
                                ? 'Selecciona año/grado'
                                : 'Selecciona rol'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {categoriaDosPasosActiva.gradosBase.map((gradoItem) => {
                              const esSeleccionado = nuevoGrado.startsWith(gradoItem);
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
                                      setNuevoGrado(gradoItem);
                                      setNuevoGradoCustom('');
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
                                    esSeleccionado && (
                                      <Check className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                                    )
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
                            Elige la sección para{' '}
                            <strong className="text-gray-900">{gradoBaseSeleccionado}</strong>:
                          </div>

                          {/* Grid de Secciones A hasta E */}
                          <div className="grid grid-cols-3 gap-2">
                            {SECCIONES_PREDETERMINADAS.map((sec) => {
                              const valorCompleto = `${gradoBaseSeleccionado} ${sec}`;
                              const estaActivo = nuevoGrado === valorCompleto;

                              return (
                                <button
                                  key={sec}
                                  type="button"
                                  onClick={() => {
                                    setNuevoGrado(valorCompleto);
                                    setNuevoGradoCustom('');
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
                                setNuevoGrado(gradoBaseSeleccionado);
                                setNuevoGradoCustom('');
                                setPopoverGradoModalAbierto(false);
                              }}
                              className={`flex items-center justify-center gap-1 rounded-2xl py-2 px-2.5 text-xs font-bold transition ${
                                nuevoGrado === gradoBaseSeleccionado
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
                                  onChange={(e) =>
                                    setSeccionPersonalizadaInput(e.target.value.toUpperCase())
                                  }
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
                                    setNuevoGrado(valorCompleto);
                                    setNuevoGradoCustom('');
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
                            setNuevoGrado('otro');
                            setPopoverGradoModalAbierto(false);
                          }}
                          className={`text-xs font-bold flex items-center gap-1.5 transition ${
                            nuevoGrado === 'otro'
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

                {nuevoGrado === 'otro' && (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={nuevoGradoCustom}
                      onChange={(e) => setNuevoGradoCustom(e.target.value)}
                      placeholder="Escribe el grado, rol o departamento..."
                      className="w-full rounded-2xl border border-gray-200/90 bg-gray-50/60 py-2 px-3.5 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                      autoFocus
                    />
                  </div>
                )}
              </div>

              {/* 2. Nombre Completo (Adaptado al rol seleccionado) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  {esRep
                    ? 'Nombre Completo del Representante / Adulto'
                    : esDocente
                    ? 'Nombre Completo del Docente / Personal'
                    : 'Nombre Completo del Estudiante'}{' '}
                  <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    placeholder={
                      esRep
                        ? 'Ej. Carlos Martínez (Representante)'
                        : esDocente
                        ? 'Ej. Prof. Andrea Ramírez'
                        : 'Ej. Sofía Martínez'
                    }
                    className="w-full rounded-2xl border border-gray-200/90 bg-gray-50/60 py-2.5 pl-10 pr-3.5 text-sm font-medium text-gray-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>

              {/* 3. Nombre del Representante (Solo para Estudiantes o Docentes) */}
              {!esRep && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    {esDocente ? 'Área o Departamento' : 'Nombre del Representante / Contacto'}{' '}
                    <span className="text-[11px] font-normal text-gray-400">(Opcional)</span>
                  </label>
                  <div className="relative">
                    {esDocente ? (
                      <Briefcase className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    ) : (
                      <UserCheck className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    )}
                    <input
                      type="text"
                      value={nuevoRepresentante}
                      onChange={(e) => setNuevoRepresentante(e.target.value)}
                      placeholder={
                        esDocente
                          ? 'Ej. Coordinación de Ciencias'
                          : 'Ej. María Pérez (Mamá / Papá)'
                      }
                      className="w-full rounded-2xl border border-gray-200/90 bg-gray-50/60 py-2.5 pl-10 pr-3.5 text-sm font-medium text-gray-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </div>
              )}

              {/* 4. Teléfono WhatsApp (Con regla de Representantes y vinculación) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center justify-between">
                  <span>
                    Teléfono / WhatsApp{' '}
                    {esRep ? (
                      <span className="text-rose-500">* (Obligatorio para vincular)</span>
                    ) : (
                      <span className="text-[11px] font-normal text-gray-400">(Para vinculación)</span>
                    )}
                  </span>
                  {esRep && (
                    <span className="text-[10px] text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                      Vínculo Único
                    </span>
                  )}
                </label>
                <div className="flex gap-2">
                  <div className="relative w-28 shrink-0">
                    <select
                      value={nuevoPrefijo}
                      onChange={(e) => setNuevoPrefijo(e.target.value)}
                      className="w-full appearance-none rounded-2xl border border-gray-200/90 bg-gray-50/60 py-2.5 pl-3 pr-7 text-xs font-bold text-gray-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 cursor-pointer font-mono"
                    >
                      {PREFIJOS_TELEFONICOS.map((pref) => (
                        <option key={pref.codigo} value={pref.codigo}>
                          {pref.bandera} {pref.codigo}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>

                  <div className="relative flex-1">
                    <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="tel"
                      required={esRep}
                      value={nuevoTelefonoNumero}
                      onChange={(e) => setNuevoTelefonoNumero(e.target.value)}
                      placeholder="Ej. 4121234567"
                      className="w-full rounded-2xl border border-gray-200/90 bg-gray-50/60 py-2.5 pl-10 pr-3.5 text-sm font-mono text-gray-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </div>
              </div>

              {/* Caja de detección en vivo de Vinculación Familiar por Teléfono */}
              {vinculosDetectados.length > 0 && (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 p-3 text-xs text-indigo-950 space-y-1.5 animate-in fade-in">
                  <div className="font-bold flex items-center gap-1.5 text-indigo-900">
                    <Sparkles className="h-4 w-4 text-indigo-600 shrink-0" />
                    <span>Vinculación familiar detectada por teléfono:</span>
                  </div>
                  <div className="space-y-1 pl-1">
                    {vinculosDetectados.map((v) => (
                      <div key={v.id} className="flex items-center gap-2 text-[11px] text-indigo-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                        <span className="font-semibold">{v.relacionTexto}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Banner informativo de preservación de carrito */}
              <div className="flex items-center gap-2 rounded-2xl bg-indigo-50/60 border border-indigo-100 p-3 text-xs text-indigo-900">
                <Sparkles className="h-4 w-4 text-indigo-600 shrink-0" />
                <span>
                  Al guardar, se asociará al instante y tu carrito se conservará para cobrar de inmediato.
                </span>
              </div>

              {/* Botones de Acción */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => setModalRegistroAbierto(false)}
                  className="flex min-h-[44px] items-center justify-center rounded-2xl border border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-900 active:scale-95 transition"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={guardando}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition active:scale-95 disabled:opacity-50"
                >
                  {guardando ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Guardando en Supabase...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      <span>Guardar y Asociar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
