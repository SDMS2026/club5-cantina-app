'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import * as Dialog from '@radix-ui/react-dialog';
import * as Popover from '@radix-ui/react-popover';
import {
  Package,
  Plus,
  Search,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Check,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  Pencil,
  Trash2,
  Loader2,
  Tag,
  Eye,
  EyeOff,
  LayoutGrid,
  ShoppingBag,
  Sparkles,
  Utensils,
  ChevronDown,
  Menu,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { obtenerTasaBCV, TASA_BCV_FALLBACK_DEFAULT } from '@/lib/dolarApi';
import { formatUSD, formatBs, calcularConversionBs } from '@/lib/utils';
import { Producto } from '@/types/pos';
import { NotificationBell } from '@/components/NotificationBell';
import { useSidebar } from '@/components/SidebarContext';
import {
  CATALOGO_EMOJIS,
  CATEGORIAS_EMOJIS,
  CATEGORIAS_PRODUCTOS_SISTEMA,
  CategoriaEmoji,
  CategoriaProducto,
  buscarEmojis,
  esUrlImagen,
  obtenerEmojiPorNombre,
} from '@/lib/productEmojis';
import { useDraggableScroll } from '@/lib/useDraggableScroll';
import { useModalDragScroll } from '@/lib/useModalDragScroll';

export default function ProductosPage() {
  const [montado, setMontado] = useState(false);
  const { toggleSidebar, abierto: sidebarAbierto } = useSidebar();

  // 1. Tasa BCV
  const [tasaBcv, setTasaBcv] = useState<number>(TASA_BCV_FALLBACK_DEFAULT);
  const [cargandoTasa, setCargandoTasa] = useState<boolean>(true);

  // 2. Productos
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargandoProductos, setCargandoProductos] = useState<boolean>(true);

  // 3. Filtros
  const [busqueda, setBusqueda] = useState<string>('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activos' | 'inactivos'>('todos');
  const { ref: draggableCategoriasRef, events: draggableCategoriasEvents } = useDraggableScroll();

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

  // 5. Modal Crear / Editar
  const [modalForm, setModalForm] = useState<{
    abierto: boolean;
    modo: 'crear' | 'editar';
    id?: string;
    nombre: string;
    categoria: string;
    precio_usd: string;
    imagen_url: string;
    activo: boolean;
    guardando: boolean;
    error: string | null;
  }>({
    abierto: false,
    modo: 'crear',
    nombre: '',
    categoria: 'Desayunos y Salados',
    precio_usd: '',
    imagen_url: '🥟',
    activo: true,
    guardando: false,
    error: null,
  });

  // Selector de Emojis dentro del modal
  const [categoriaEmojiActiva, setCategoriaEmojiActiva] = useState<string>('comidas');
  const [busquedaEmoji, setBusquedaEmoji] = useState<string>('');

  // 6. Modal Eliminar
  const [modalEliminar, setModalEliminar] = useState<{
    abierto: boolean;
    producto: Producto | null;
    eliminando: boolean;
    error: string | null;
  }>({
    abierto: false,
    producto: null,
    eliminando: false,
    error: null,
  });

  // Selector de Emojis desplegable dentro del modal
  const [mostrarSelectorEmojis, setMostrarSelectorEmojis] = useState<boolean>(false);

  // Drag-to-scroll vertical con ratón y táctil para deslizar hacia arriba y abajo en móviles con Body Scroll Lock
  const dragScrollProducto = useModalDragScroll({
    isOpen: modalForm.abierto,
    onDismiss: () => setModalForm((prev) => ({ ...prev, abierto: false })),
  });

  const dragScrollEliminar = useModalDragScroll({
    isOpen: modalEliminar.abierto,
    onDismiss: () => setModalEliminar((prev) => ({ ...prev, abierto: false })),
  });

  // 7. Cargar Tasa BCV
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

  // 8. Cargar Productos desde Supabase
  const cargarProductos = useCallback(async () => {
    setCargandoProductos(true);
    try {
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) throw error;
      setProductos(data || []);
    } catch (err) {
      console.error('Error al cargar productos:', err);
      mostrarNotificacion('error', 'Error al conectar con la base de datos de productos.');
    } finally {
      setCargandoProductos(false);
    }
  }, [mostrarNotificacion]);

  useEffect(() => {
    setMontado(true);
    cargarTasa();
    cargarProductos();
  }, [cargarTasa, cargarProductos]);

  // Lista de categorías detectadas de los productos cargados
  const categoriasDisponibles = useMemo(() => {
    const set = new Set<string>(CATEGORIAS_PRODUCTOS_SISTEMA);
    productos.forEach((p) => {
      if (p.categoria && p.categoria.trim()) {
        set.add(p.categoria.trim());
      }
    });
    return Array.from(set);
  }, [productos]);

  // Métricas para las Tarjetas Metrik
  const metricas = useMemo(() => {
    const total = productos.length;
    const activos = productos.filter((p) => p.activo).length;
    const inactivos = total - activos;

    let sumaPrecios = 0;
    productos.forEach((p) => {
      sumaPrecios += Number(p.precio_usd || 0);
    });

    const precioPromedioUsd = total > 0 ? sumaPrecios / total : 0;
    const precioPromedioBs = calcularConversionBs(precioPromedioUsd, tasaBcv);

    return {
      total,
      activos,
      inactivos,
      precioPromedioUsd,
      precioPromedioBs,
      porcentajeActivos: total > 0 ? Math.round((activos / total) * 100) : 0,
    };
  }, [productos, tasaBcv]);

  // Filtrado reactivo de productos
  const productosFiltrados = useMemo(() => {
    let lista = [...productos];

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      lista = lista.filter((p) => {
        const coincideNombre = p.nombre.toLowerCase().includes(q);
        const coincidePrecio = p.precio_usd.toString().includes(q);
        const coincideCat = (p.categoria || '').toLowerCase().includes(q);
        return coincideNombre || coincidePrecio || coincideCat;
      });
    }

    if (filtroCategoria !== 'todos') {
      lista = lista.filter((p) => p.categoria === filtroCategoria);
    }

    if (filtroEstado === 'activos') {
      lista = lista.filter((p) => p.activo);
    } else if (filtroEstado === 'inactivos') {
      lista = lista.filter((p) => !p.activo);
    }

    return lista;
  }, [productos, busqueda, filtroCategoria, filtroEstado]);

  // Lista de emojis filtrados para el selector
  const emojisFiltrados = useMemo(() => {
    return buscarEmojis(busquedaEmoji, categoriaEmojiActiva);
  }, [busquedaEmoji, categoriaEmojiActiva]);

  // Handlers para el Modal
  const handleAbrirCrear = () => {
    setModalForm({
      abierto: true,
      modo: 'crear',
      nombre: '',
      categoria: 'Desayunos y Salados',
      precio_usd: '',
      imagen_url: '🥟',
      activo: true,
      guardando: false,
      error: null,
    });
    setCategoriaEmojiActiva('comidas');
    setBusquedaEmoji('');
    setMostrarSelectorEmojis(false);
  };

  const handleAbrirEditar = (producto: Producto) => {
    setModalForm({
      abierto: true,
      modo: 'editar',
      id: producto.id,
      nombre: producto.nombre,
      categoria: producto.categoria || 'Desayunos y Salados',
      precio_usd: producto.precio_usd.toString(),
      imagen_url: producto.imagen_url || obtenerEmojiPorNombre(producto.nombre),
      activo: producto.activo,
      guardando: false,
      error: null,
    });
    setCategoriaEmojiActiva('comidas');
    setBusquedaEmoji('');
    setMostrarSelectorEmojis(false);
  };

  // Alternar visibilidad en el POS directamente desde la tarjeta
  const handleToggleActivo = async (producto: Producto, e: React.MouseEvent) => {
    e.stopPropagation();
    const nuevoEstado = !producto.activo;

    // Actualización optimista local
    setProductos((prev) =>
      prev.map((p) => (p.id === producto.id ? { ...p, activo: nuevoEstado } : p))
    );

    try {
      const { error } = await supabase
        .from('productos')
        .update({ activo: nuevoEstado })
        .eq('id', producto.id);

      if (error) throw error;

      mostrarNotificacion(
        'info',
        nuevoEstado
          ? `"${producto.nombre}" ahora está visible en el Punto de Venta.`
          : `"${producto.nombre}" se pausó y no aparecerá en el Punto de Venta.`
      );
    } catch (err) {
      console.error('Error al cambiar visibilidad:', err);
      // Revertir optimismo
      setProductos((prev) =>
        prev.map((p) => (p.id === producto.id ? { ...p, activo: producto.activo } : p))
      );
      mostrarNotificacion('error', 'No se pudo actualizar el estado del producto.');
    }
  };

  // Guardar (Crear o Editar)
  const handleGuardarProducto = async (e: React.FormEvent) => {
    e.preventDefault();

    const nombreLimpio = modalForm.nombre.trim();
    if (!nombreLimpio) {
      setModalForm((prev) => ({ ...prev, error: 'El nombre del producto es obligatorio.' }));
      return;
    }

    const precioNumero = parseFloat(modalForm.precio_usd.replace(',', '.'));
    if (isNaN(precioNumero) || precioNumero < 0) {
      setModalForm((prev) => ({ ...prev, error: 'Ingresa un precio en USD válido (mayor o igual a 0).' }));
      return;
    }

    setModalForm((prev) => ({ ...prev, guardando: true, error: null }));

    try {
      const emojiFinal = modalForm.imagen_url || obtenerEmojiPorNombre(nombreLimpio);

      const payload = {
        nombre: nombreLimpio,
        categoria: modalForm.categoria.trim() || 'General',
        precio_usd: Math.round(precioNumero * 100) / 100,
        imagen_url: emojiFinal,
        activo: modalForm.activo,
      };

      if (modalForm.modo === 'crear') {
        const { error } = await supabase.from('productos').insert([payload]);
        if (error) throw error;
        mostrarNotificacion('exito', `¡Producto "${payload.nombre}" registrado con éxito!`);
      } else {
        if (!modalForm.id) throw new Error('ID no encontrado para actualizar.');
        const { error } = await supabase
          .from('productos')
          .update(payload)
          .eq('id', modalForm.id);
        if (error) throw error;
        mostrarNotificacion('exito', `¡Producto "${payload.nombre}" actualizado con éxito!`);
      }

      setModalForm((prev) => ({ ...prev, abierto: false }));
      cargarProductos();
    } catch (err: any) {
      console.error('Error guardando producto:', err);
      setModalForm((prev) => ({
        ...prev,
        guardando: false,
        error: err.message || 'Error al guardar el producto en Supabase.',
      }));
    }
  };

  // Abrir modal eliminar
  const handleAbrirEliminar = (producto: Producto, e: React.MouseEvent) => {
    e.stopPropagation();
    setModalEliminar({
      abierto: true,
      producto,
      eliminando: false,
      error: null,
    });
  };

  // Confirmar eliminación
  const handleConfirmarEliminar = async () => {
    if (!modalEliminar.producto) return;
    setModalEliminar((prev) => ({ ...prev, eliminando: true, error: null }));

    try {
      const { error } = await supabase
        .from('productos')
        .delete()
        .eq('id', modalEliminar.producto.id);

      if (error) {
        // Si hay una restricción de clave foránea con ventas históricas
        if (error.code === '23503' || error.message.includes('foreign key')) {
          throw new Error(
            'Este producto ya tiene consumos o ventas registradas en el historial. Para conservarlo en las estadísticas, utiliza el botón "Solo Pausar en POS" en lugar de borrarlo.'
          );
        }
        throw error;
      }

      mostrarNotificacion('exito', `"${modalEliminar.producto.nombre}" ha sido eliminado del catálogo.`);
      setModalEliminar({ abierto: false, producto: null, eliminando: false, error: null });
      cargarProductos();
    } catch (err: any) {
      console.error('Error al eliminar producto:', err);
      setModalEliminar((prev) => ({
        ...prev,
        eliminando: false,
        error: err.message || 'No se pudo eliminar el producto.',
      }));
    }
  };

  // Desactivar en lugar de borrar (alternativa segura para productos con ventas)
  const handlePausarEnVezDeEliminar = async () => {
    if (!modalEliminar.producto) return;
    setModalEliminar((prev) => ({ ...prev, eliminando: true, error: null }));

    try {
      const { error } = await supabase
        .from('productos')
        .update({ activo: false })
        .eq('id', modalEliminar.producto.id);

      if (error) throw error;

      mostrarNotificacion(
        'info',
        `"${modalEliminar.producto.nombre}" fue pausado del Punto de Venta. Su historial de ventas se mantiene intacto.`
      );
      setModalEliminar({ abierto: false, producto: null, eliminando: false, error: null });
      cargarProductos();
    } catch (err: any) {
      setModalEliminar((prev) => ({
        ...prev,
        eliminando: false,
        error: err.message || 'No se pudo pausar el producto.',
      }));
    }
  };

  if (!montado) {
    return (
      <div className="min-h-screen flex flex-col bg-[#FAFAFA]" suppressHydrationWarning>
        <header className="sticky top-0 z-30 w-full border-b border-gray-200/70 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <div className="h-6 w-48 bg-gray-200 rounded-md animate-pulse" />
            <div className="h-9 w-44 bg-amber-50 rounded-2xl animate-pulse" />
          </div>
        </header>
        <main className="mx-auto max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-28 rounded-3xl bg-gray-100 animate-pulse" />
            <div className="h-28 rounded-3xl bg-gray-100 animate-pulse" />
            <div className="h-28 rounded-3xl bg-gray-100 animate-pulse" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] w-full max-w-full overflow-x-hidden">


      {/* Header Sticky con diseño unificado y navegación móvil */}
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
              <Package className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-sm sm:text-lg font-bold tracking-tight text-gray-900 truncate">
                  Inventario
                </h1>
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-1.5 py-0.2 text-[10px] sm:text-[11px] font-semibold text-indigo-700 shrink-0">
                  {productos.length}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-gray-500 hidden sm:block">
                Catálogo oficial de la cantina, precios duales ($/Bs) y visibilidad en el Punto de Venta
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

            {/* Botón Registrar Nuevo Producto */}
            <button
              type="button"
              onClick={handleAbrirCrear}
              title="Añadir Nuevo Producto"
              className="flex h-9 w-9 sm:h-auto sm:w-auto items-center justify-center gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl bg-indigo-600 sm:px-4 sm:py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition active:scale-95 shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nuevo Producto</span>
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
      <main className="mx-auto flex-1 w-full max-w-7xl px-3 sm:px-6 lg:px-8 py-5 sm:py-6 min-w-0 overflow-x-hidden">
        {/* Tarjetas Metrik Estilo Precedent */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Métrica 1: Total Productos */}
          <div className="rounded-3xl border border-gray-200/80 bg-white p-4 sm:p-5 shadow-xs transition hover:border-gray-300">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Total Catálogo
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">
                {metricas.total}
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Package className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              {metricas.activos} activos en POS &bull; {metricas.inactivos} pausados
            </p>
          </div>

          {/* Métrica 2: Precio Promedio */}
          <div className="rounded-3xl border border-gray-200/80 bg-white p-4 sm:p-5 shadow-xs transition hover:border-gray-300">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Precio Promedio
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">
                {formatUSD(metricas.precioPromedioUsd)}
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-1 text-xs text-emerald-700 font-mono font-medium">
              Equivalente: {formatBs(metricas.precioPromedioBs)}
            </p>
          </div>

          {/* Métrica 3: Disponibilidad POS */}
          <div className="rounded-3xl border border-gray-200/80 bg-white p-4 sm:p-5 shadow-xs transition hover:border-gray-300">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Disponibilidad POS
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-indigo-600">
                {metricas.porcentajeActivos}%
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Eye className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              {metricas.activos} listos para cobro inmediato
            </p>
          </div>

          {/* Métrica 4: Acceso Rápido Crear */}
          <div
            onClick={handleAbrirCrear}
            className="group cursor-pointer rounded-3xl border-2 border-dashed border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-blue-50/30 p-4 sm:p-5 shadow-2xs transition hover:border-indigo-400 hover:bg-indigo-50/80 hover:shadow-xs flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                Registro Rápido
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-xs group-hover:scale-110 transition-transform">
                <Plus className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2">
              <p className="text-sm font-black text-indigo-950">Añadir Nuevo Producto</p>
              <p className="text-[11px] text-indigo-700/80">Con emoji 3D y precios duales</p>
            </div>
          </div>
        </div>

        {/* Barra de Búsqueda y Filtros */}
        <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-gray-200/80 bg-white p-3.5 sm:p-4 shadow-xs lg:flex-row lg:items-center lg:justify-between">
          {/* Buscador */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar producto por nombre, categoría o precio..."
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

          <div className="flex items-center justify-between sm:justify-start gap-2 overflow-x-auto pb-0.5 no-scrollbar w-full sm:w-auto max-w-full min-w-0">
            {/* Pestañas de Estado (Todos, Activos, Inactivos) */}
            <div className="flex items-center rounded-2xl border border-gray-200/90 bg-gray-50/70 p-1 shrink-0">
              <button
                type="button"
                onClick={() => setFiltroEstado('todos')}
                className={`rounded-xl px-2.5 sm:px-3 py-1 text-xs font-bold transition shrink-0 ${
                  filtroEstado === 'todos'
                    ? 'bg-white text-gray-900 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Todos ({productos.length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroEstado('activos')}
                className={`flex items-center gap-1 rounded-xl px-2.5 sm:px-3 py-1 text-xs font-bold transition shrink-0 ${
                  filtroEstado === 'activos'
                    ? 'bg-emerald-50 text-emerald-800 shadow-2xs'
                    : 'text-gray-500 hover:text-emerald-700'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>Activos ({metricas.activos})</span>
              </button>
              <button
                type="button"
                onClick={() => setFiltroEstado('inactivos')}
                className={`flex items-center gap-1 rounded-xl px-2.5 sm:px-3 py-1 text-xs font-bold transition shrink-0 ${
                  filtroEstado === 'inactivos'
                    ? 'bg-gray-200/70 text-gray-800 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                <span>Pausados ({metricas.inactivos})</span>
              </button>
            </div>

            {/* Refrescar */}
            <button
              type="button"
              onClick={cargarProductos}
              disabled={cargandoProductos}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-gray-200/80 bg-white text-gray-700 shadow-2xs hover:bg-gray-50 transition disabled:opacity-60"
              title="Recargar catálogo"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${cargandoProductos ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Pestañas de Categorías Rápidas con soporte de arrastre con ratón y táctil */}
        <div
          ref={draggableCategoriasRef}
          {...draggableCategoriasEvents}
          className="mb-6 flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar cursor-grab active:cursor-grabbing select-none touch-pan-x w-full max-w-full min-w-0"
        >
          <button
            type="button"
            onClick={() => setFiltroCategoria('todos')}
            className={`rounded-2xl px-4 py-2 text-xs font-bold transition shrink-0 ${
              filtroCategoria === 'todos'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Todas las Categorías
          </button>
          {categoriasDisponibles.map((cat) => {
            const esActiva = filtroCategoria === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setFiltroCategoria(cat)}
                className={`rounded-2xl px-4 py-2 text-xs font-bold transition shrink-0 ${
                  esActiva
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Grid de Productos */}
        {cargandoProductos ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 w-full min-w-0 max-w-full">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="h-64 rounded-3xl bg-white border border-gray-100 p-4 animate-pulse flex flex-col justify-between w-full min-w-0 max-w-full">
                <div className="h-32 bg-gray-100 rounded-2xl" />
                <div className="space-y-2 mt-3">
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : productosFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 bg-white py-16 text-center w-full min-w-0 max-w-full">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gray-50 text-gray-400 mb-3 border border-gray-100">
              <Package className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-gray-900">
              No se encontraron productos
            </h3>
            <p className="mt-1 text-xs text-gray-400 max-w-sm px-4">
              {busqueda
                ? `No hay productos que coincidan con "${busqueda}". Intenta con otro término.`
                : 'Aún no hay productos registrados en esta categoría.'}
            </p>
            <button
              type="button"
              onClick={handleAbrirCrear}
              className="mt-5 flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Registrar Primer Producto</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 w-full min-w-0 max-w-full">
            <AnimatePresence>
              {productosFiltrados.map((producto) => {
                const precioBs = calcularConversionBs(producto.precio_usd, tasaBcv);
                const emojiMostrar = producto.imagen_url || obtenerEmojiPorNombre(producto.nombre);
                const esUrl = esUrlImagen(producto.imagen_url);

                return (
                  <motion.div
                    key={producto.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.2 }}
                    className={`group relative flex flex-col justify-between rounded-3xl border bg-white p-4 shadow-xs transition hover:shadow-md w-full min-w-0 max-w-full overflow-hidden ${
                      producto.activo
                        ? 'border-gray-200/80 hover:border-gray-300'
                        : 'border-dashed border-gray-300/80 opacity-75 bg-gray-50/50'
                    }`}
                  >
                    <div>
                      {/* Cabecera del Producto: Emoji 3D Grande + Badges de Estado */}
                      <div className="relative mb-3 flex h-36 w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-gray-50 to-gray-100/60 border border-gray-100/80">
                        {esUrl ? (
                          <Image
                            src={producto.imagen_url!}
                            alt={producto.nombre}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 25vw"
                          />
                        ) : (
                          <span className="text-6xl filter drop-shadow-sm transition-transform duration-300 group-hover:scale-110 select-none">
                            {emojiMostrar}
                          </span>
                        )}

                        {/* Badge de Categoría */}
                        <span className="absolute left-2.5 top-2.5 max-w-[55%] truncate rounded-full border border-gray-200/80 bg-white/90 px-2 py-0.5 text-[10px] font-bold text-gray-700 backdrop-blur-xs shadow-2xs">
                          {producto.categoria || 'General'}
                        </span>

                        {/* Botones de Acción (Editar / Eliminar) */}
                        <div className="absolute right-2.5 top-2.5 flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleAbrirEditar(producto)}
                            className="rounded-xl bg-white/95 p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-white shadow-2xs transition active:scale-95"
                            title="Editar producto"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleAbrirEliminar(producto, e)}
                            className="rounded-xl bg-white/95 p-1.5 text-gray-600 hover:text-rose-600 hover:bg-white shadow-2xs transition active:scale-95"
                            title="Eliminar producto"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Información del Producto */}
                      <div className="min-w-0">
                        <h3 className="line-clamp-2 text-sm font-bold text-gray-900 group-hover:text-indigo-600 transition leading-snug break-words">
                          {producto.nombre}
                        </h3>

                        {/* Precios Duales ($ y Bs) */}
                        <div className="mt-2 flex items-baseline justify-between gap-2 min-w-0">
                          <div className="flex flex-col min-w-0">
                            <span className="text-base font-black text-gray-950 font-mono truncate">
                              {formatUSD(producto.precio_usd)}
                            </span>
                            <span className="text-[11px] font-semibold text-emerald-700 font-mono truncate">
                              {formatBs(precioBs)}
                            </span>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-[10px] font-medium text-gray-400">
                              Tasa BCV
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Switch de Visibilidad en POS */}
                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            producto.activo ? 'bg-emerald-500' : 'bg-gray-300'
                          }`}
                        />
                        <span className="text-[11px] font-semibold text-gray-600 truncate">
                          {producto.activo ? 'Visible en POS' : 'Pausado'}
                        </span>
                      </div>

                      {/* Switch Toggle */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleActivo(producto, e)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          producto.activo ? 'bg-indigo-600' : 'bg-gray-200'
                        }`}
                        title={producto.activo ? 'Ocultar del POS' : 'Hacer visible en el POS'}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                            producto.activo ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Modal Crear / Editar Producto (Radix UI Dialog) */}
      <Dialog.Root
        open={modalForm.abierto}
        onOpenChange={(abierto) => setModalForm((prev) => ({ ...prev, abierto }))}
      >
        <Dialog.Portal>
          <Dialog.Overlay
            {...dragScrollProducto.overlayProps}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          />
          <Dialog.Content
            style={dragScrollProducto.style}
            {...dragScrollProducto.dragProps}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain rounded-t-3xl sm:rounded-3xl border-t sm:border border-gray-200/90 bg-white p-4 sm:p-6 shadow-2xl outline-none duration-300 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in-0 sm:zoom-in-95 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[95vw] sm:max-w-lg cursor-grab active:cursor-grabbing touch-pan-y"
          >
            {/* Manija táctil para deslizar hacia arriba y abajo en móviles */}
            <div
              className="mx-auto mb-3 -mt-1 flex h-6 w-full cursor-grab active:cursor-grabbing items-center justify-center sm:hidden touch-none"
              title="Deslizar hacia abajo para cerrar"
            >
              <div className="h-1.5 w-12 rounded-full bg-gray-300 active:bg-gray-400 transition-colors" />
            </div>

            {/* Header del Modal */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <Dialog.Title className="text-base font-bold text-gray-900">
                  {modalForm.modo === 'crear' ? 'Registrar Nuevo Producto' : 'Editar Producto'}
                </Dialog.Title>
                <Dialog.Description className="text-xs text-gray-500">
                  Define el nombre, categoría, precio en USD y selecciona un icono estilo WhatsApp.
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

            <form onSubmit={handleGuardarProducto} className="mt-4 space-y-4">
              {/* Display y Previsualización del Icono / Emoji Seleccionado */}
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3 sm:p-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl bg-white shadow-2xs border border-indigo-100 text-3xl sm:text-4xl select-none">
                    {modalForm.imagen_url || '🥟'}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">
                      Icono Asignado
                    </span>
                    <p className="text-xs font-bold text-gray-900 truncate">
                      {modalForm.nombre || 'Nuevo Producto'}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {mostrarSelectorEmojis ? 'Toca para cerrar catálogo' : 'Toca Cambiar para elegir otro'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMostrarSelectorEmojis(!mostrarSelectorEmojis)}
                  className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-indigo-700 shadow-2xs hover:bg-indigo-50 transition shrink-0 active:scale-95"
                >
                  <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                  <span>{mostrarSelectorEmojis ? 'Ocultar' : 'Cambiar Icono'}</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${
                      mostrarSelectorEmojis ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </div>

              {/* Selector de Iconos / Emojis Clasificados (Desplegable) */}
              {mostrarSelectorEmojis && (
                <div className="rounded-2xl border border-gray-200 bg-gray-50/60 p-3 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Seleccionar Icono / Emoji</span>
                    </label>
                    <span className="text-[10px] text-gray-400">
                      {emojisFiltrados.length} disponibles
                    </span>
                  </div>

                  {/* Buscador de Emojis dentro del picker */}
                  <div className="relative mb-2.5">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={busquedaEmoji}
                      onChange={(e) => setBusquedaEmoji(e.target.value)}
                      placeholder="Buscar emoji (ej. malta, jugo, empanada, dona, galleta)..."
                      className="w-full rounded-xl border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-xs text-gray-800 placeholder-gray-400 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100"
                    />
                    {busquedaEmoji && (
                      <button
                        type="button"
                        onClick={() => setBusquedaEmoji('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Pestañas de Categoría de Emojis */}
                  <div className="grid grid-cols-5 gap-1 border-b border-gray-200 pb-2 mb-2">
                    {CATEGORIAS_EMOJIS.map((cat) => {
                      const esActiva = categoriaEmojiActiva === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setCategoriaEmojiActiva(cat.id);
                            setBusquedaEmoji('');
                          }}
                          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[10px] font-bold transition ${
                            esActiva
                              ? 'bg-white text-indigo-900 shadow-2xs border border-indigo-200/80 font-black'
                              : 'text-gray-500 hover:text-gray-800 hover:bg-white/60'
                          }`}
                          title={cat.nombre}
                        >
                          <span className="text-base">{cat.icono}</span>
                          <span className="truncate max-w-full mt-0.5">{cat.nombre.split('/')[0].trim()}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Cuadrícula de Emojis estilo Teclado WhatsApp */}
                  <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 max-h-36 overflow-y-auto p-1 bg-white rounded-xl border border-gray-200/80">
                    {emojisFiltrados.map((item) => {
                      const esSeleccionado = modalForm.imagen_url === item.emoji;
                      return (
                        <button
                          key={item.emoji + item.nombre}
                          type="button"
                          onClick={() => {
                            setModalForm((prev) => ({
                              ...prev,
                              imagen_url: item.emoji,
                            }));
                            setMostrarSelectorEmojis(false);
                          }}
                          title={item.nombre}
                          className={`flex h-10 w-10 items-center justify-center rounded-xl text-2xl transition hover:scale-125 hover:bg-indigo-50 active:scale-95 select-none ${
                            esSeleccionado
                              ? 'bg-indigo-100 ring-2 ring-indigo-500 shadow-2xs scale-110'
                              : 'hover:shadow-2xs'
                          }`}
                        >
                          {item.emoji}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Nombre del Producto */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nombre del Producto *
                </label>
                <input
                  type="text"
                  required
                  value={modalForm.nombre}
                  onChange={(e) => setModalForm((prev) => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Ej. Malta Polar Botella, Empanada de Queso..."
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 py-2.5 px-3.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {/* Categoría del Producto */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Categoría del Menú *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {CATEGORIAS_PRODUCTOS_SISTEMA.map((cat) => {
                    const esActiva = modalForm.categoria === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setModalForm((prev) => ({ ...prev, categoria: cat }))}
                        className={`rounded-xl py-2 px-2 text-xs font-semibold transition text-center truncate ${
                          esActiva
                            ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                            : 'border border-gray-200 bg-gray-50/70 text-gray-700 hover:bg-white'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Precio en USD ($) con cálculo en Bs en vivo */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Precio en USD ($) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-gray-400 text-sm">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={modalForm.precio_usd}
                    onChange={(e) => setModalForm((prev) => ({ ...prev, precio_usd: e.target.value }))}
                    placeholder="1.50"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 py-2.5 pl-8 pr-4 text-sm font-mono font-bold text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                {/* Previsualización en Bolívares */}
                {modalForm.precio_usd && !isNaN(parseFloat(modalForm.precio_usd)) && (
                  <p className="mt-1.5 text-xs text-emerald-700 font-mono font-semibold flex items-center gap-1">
                    <span>Equivalente:</span>
                    <strong>
                      {formatBs(calcularConversionBs(parseFloat(modalForm.precio_usd), tasaBcv))}
                    </strong>
                    <span className="text-[11px] text-gray-400 font-normal">
                      (Tasa: Bs. {tasaBcv.toFixed(2)})
                    </span>
                  </p>
                )}
              </div>

              {/* Switch de Visibilidad en POS */}
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50/60 p-3">
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-gray-900">
                    Visibilidad en el Punto de Venta (POS)
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Si está activado, aparecerá inmediatamente para cobro en el POS.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setModalForm((prev) => ({ ...prev, activo: !prev.activo }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    modalForm.activo ? 'bg-indigo-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      modalForm.activo ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Botones de Acción */}
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
                  disabled={modalForm.guardando}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition disabled:opacity-60"
                >
                  {modalForm.guardando ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>{modalForm.modo === 'crear' ? 'Registrar Producto' : 'Guardar Cambios'}</span>
                  )}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Modal Confirmar Eliminación (Radix UI Dialog) */}
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
              ¿Estás seguro de que deseas eliminar{' '}
              <strong className="text-gray-900 font-bold">
                {modalEliminar.producto?.nombre}
              </strong>{' '}
              del inventario?
            </Dialog.Description>

            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
              <span className="font-bold">Recomendación:</span>
              <p className="mt-0.5 text-[11px] text-amber-800">
                Si este producto ya ha sido vendido antes en el POS, te recomendamos <strong>Solo Pausar en POS</strong> para mantener intacto el historial de ventas y auditorías.
              </p>
            </div>

            {modalEliminar.error && (
              <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{modalEliminar.error}</span>
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-end gap-2 border-t border-gray-100 pt-4">
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={modalEliminar.eliminando}
                  className="w-full sm:w-auto rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
              </Dialog.Close>

              <button
                type="button"
                onClick={handlePausarEnVezDeEliminar}
                disabled={modalEliminar.eliminando}
                className="w-full sm:w-auto rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition"
              >
                Solo Pausar en POS
              </button>

              <button
                type="button"
                onClick={handleConfirmarEliminar}
                disabled={modalEliminar.eliminando}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition disabled:opacity-60"
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
