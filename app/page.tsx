'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Header } from '@/components/Header';
import { ClientSelector } from '@/components/ClientSelector';
import { ProductCatalog } from '@/components/ProductCatalog';
import { Cart } from '@/components/Cart';
import { PaymentModal } from '@/components/PaymentModal';
import { VoiceOrderModal, PedidoVozResultado } from '@/components/VoiceOrderModal';
import { Cliente, Producto, ItemCarrito, MetodoPagoId } from '@/types/pos';
import { obtenerTasaBCV, TASA_BCV_FALLBACK_DEFAULT } from '@/lib/dolarApi';
import { supabase } from '@/lib/supabaseClient';
import { formatUSD, formatBs, calcularConversionBs } from '@/lib/utils';
import { Sparkles, CheckCircle2, ShoppingBag, Plus, Minus, Trash2, X, ArrowRight } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { refrescarNotificacionesGlobales } from '@/components/NotificationsContext';
import { useModalDragScroll } from '@/lib/useModalDragScroll';
import { obtenerSaldosTodosClientes, ResumenSaldoCliente } from '@/lib/clientBalance';

const PRODUCTOS_MUESTRA_SEMILLA: Omit<Producto, 'id'>[] = [
  { nombre: 'Empanada de Queso Blanco', precio_usd: 1.5, activo: true, categoria: 'Desayunos' },
  { nombre: 'Empanada de Carne Mechada', precio_usd: 1.8, activo: true, categoria: 'Desayunos' },
  { nombre: 'Ración de Tequeños (5 uds)', precio_usd: 2.5, activo: true, categoria: 'Desayunos' },
  { nombre: 'Pastelito de Pollo', precio_usd: 1.5, activo: true, categoria: 'Desayunos' },
  { nombre: 'Sándwich Jamón y Queso', precio_usd: 2.0, activo: true, categoria: 'Desayunos' },
  { nombre: 'Jugo Natural de Naranja 400ml', precio_usd: 1.2, activo: true, categoria: 'Bebidas' },
  { nombre: 'Malta Polar Botella', precio_usd: 1.0, activo: true, categoria: 'Bebidas' },
  { nombre: 'Agua Mineral 500ml', precio_usd: 0.8, activo: true, categoria: 'Bebidas' },
  { nombre: 'Galleta de Chocolate con Chispas', precio_usd: 1.0, activo: true, categoria: 'Snacks' },
  { nombre: 'Brownie Artesanal', precio_usd: 1.5, activo: true, categoria: 'Snacks' },
];

const CLIENTES_MUESTRA_SEMILLA: Omit<Cliente, 'id'>[] = [
  {
    nombre_estudiante: 'Mateo Rivas',
    grado_seccion: '1era Sala',
    nombre_representante: 'Patricia Rivas',
    telefono_whatsapp: '+58 4125556677',
  },
  {
    nombre_estudiante: 'Sofía Martínez',
    grado_seccion: '5to Grado A',
    nombre_representante: 'Carlos Martínez',
    telefono_whatsapp: '+58 4141234567',
  },
  {
    nombre_estudiante: 'Alejandro Pérez',
    grado_seccion: '3er Año B',
    nombre_representante: 'María Pérez',
    telefono_whatsapp: '+58 4249876543',
  },
  {
    nombre_estudiante: 'Prof. Roberto Mendoza',
    grado_seccion: 'Profesor / Docente',
    nombre_representante: 'Coordinación Ciencias',
    telefono_whatsapp: '+58 4125404830',
  },
];

export default function PosPage() {
  const [montado, setMontado] = useState(false);

  // Estado de tasa BCV
  const [tasaBcv, setTasaBcv] = useState<number>(TASA_BCV_FALLBACK_DEFAULT);
  const [cargandoTasa, setCargandoTasa] = useState<boolean>(true);
  const [ultimaActualizacionTasa, setUltimaActualizacionTasa] = useState<Date | null>(null);

  // Estado de clientes y productos desde Supabase
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargandoClientes, setCargandoClientes] = useState<boolean>(true);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [saldosClientes, setSaldosClientes] = useState<Record<string, ResumenSaldoCliente>>({});

  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargandoProductos, setCargandoProductos] = useState<boolean>(true);

  // Estado del carrito y modal de pago
  const [itemsCarrito, setItemsCarrito] = useState<ItemCarrito[]>([]);
  const [modalPagoAbierto, setModalPagoAbierto] = useState<boolean>(false);
  const [modalOrdenMovilAbierto, setModalOrdenMovilAbierto] = useState<boolean>(false);

  // Deslizamiento vertical y arrastre (drag-to-scroll) para móviles y emuladores con Body Scroll Lock
  const dragScrollOrden = useModalDragScroll({
    isOpen: modalOrdenMovilAbierto,
    onDismiss: () => setModalOrdenMovilAbierto(false),
  });

  const [metodoPagoSugerido, setMetodoPagoSugerido] = useState<MetodoPagoId>('efectivo_usd');
  const [notificacion, setNotificacion] = useState<{ tipo: 'exito' | 'info'; texto: string } | null>(null);
  const [sembrandoDatos, setSembrandoDatos] = useState<boolean>(false);

  // 1. Cargar Tasa BCV
  const cargarTasa = useCallback(async () => {
    setCargandoTasa(true);
    try {
      const tasa = await obtenerTasaBCV();
      setTasaBcv(tasa);
      setUltimaActualizacionTasa(new Date());
    } catch (err) {
      console.error('Error cargando tasa BCV:', err);
    } finally {
      setCargandoTasa(false);
    }
  }, []);

  // 2. Cargar Clientes y Saldos desde Supabase
  const cargarClientes = useCallback(async () => {
    setCargandoClientes(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nombre_estudiante', { ascending: true });

      if (error) {
        console.error('Error al obtener clientes de Supabase:', error);
      } else {
        setClientes(data || []);
      }

      // Cargar saldos consolidados
      const saldos = await obtenerSaldosTodosClientes();
      setSaldosClientes(saldos);
    } catch (err) {
      console.error('Excepción al consultar clientes y saldos:', err);
    } finally {
      setCargandoClientes(false);
    }
  }, []);

  // 3. Cargar Productos desde Supabase
  const cargarProductos = useCallback(async () => {
    setCargandoProductos(true);
    try {
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (error) {
        console.error('Error al obtener productos de Supabase:', error);
      } else {
        setProductos(data || []);
      }
    } catch (err) {
      console.error('Excepción al consultar productos:', err);
    } finally {
      setCargandoProductos(false);
    }
  }, []);

  // Control de montaje, inicialización y sincronización en tiempo real
  useEffect(() => {
    setMontado(true);
    cargarTasa();
    cargarClientes();
    cargarProductos();

    // Suscripción Realtime en Supabase para sincronización instantánea entre dispositivos
    const canalRealtime = supabase
      .channel('pos_realtime_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'productos' },
        () => {
          cargarProductos();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clientes' },
        () => {
          cargarClientes();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'consumos' },
        () => {
          obtenerSaldosTodosClientes().then(setSaldosClientes).catch(console.error);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canalRealtime);
    };
  }, [cargarTasa, cargarClientes, cargarProductos]);

  // Manejador para agregar producto al carrito
  const handleAgregarProducto = (producto: Producto) => {
    setItemsCarrito((prev) => {
      const existenteIndex = prev.findIndex((i) => i.producto.id === producto.id);
      if (existenteIndex >= 0) {
        const nuevo = [...prev];
        nuevo[existenteIndex] = {
          ...nuevo[existenteIndex],
          cantidad: nuevo[existenteIndex].cantidad + 1,
        };
        return nuevo;
      }
      return [...prev, { producto, cantidad: 1 }];
    });
  };

  // Manejador para modificar cantidad (+1 o -1)
  const handleModificarCantidad = (productoId: string, delta: number) => {
    setItemsCarrito((prev) => {
      return prev
        .map((item) => {
          if (item.producto.id === productoId) {
            const nuevaCantidad = item.cantidad + delta;
            return nuevaCantidad > 0 ? { ...item, cantidad: nuevaCantidad } : null;
          }
          return item;
        })
        .filter((item): item is ItemCarrito => item !== null);
    });
  };

  // Manejador para eliminar item completo
  const handleEliminarItem = (productoId: string) => {
    setItemsCarrito((prev) => prev.filter((i) => i.producto.id !== productoId));
  };

  // Vaciar carrito
  const handleVaciarCarrito = () => {
    setItemsCarrito([]);
  };

  // Manejador del resultado de Pedido y Registro por Voz
  const handlePedidoPorVoz = (resultado: PedidoVozResultado) => {
    // Si la acción fue un abono financiero o guardar vuelto:
    if (resultado.accion === 'abono_saldo_favor' || resultado.accion === 'guardar_vuelto') {
      obtenerSaldosTodosClientes().then(setSaldosClientes).catch(console.error);
      refrescarNotificacionesGlobales();
      setNotificacion({
        tipo: 'exito',
        texto: resultado.resumen_interpretado || '¡Abono registrado con éxito!',
      });
      setTimeout(() => setNotificacion(null), 5000);
      return;
    }

    // 1. Si se creó o detectó un nuevo cliente:
    if (resultado.cliente_creado) {
      setClientes((prev) => {
        const existe = prev.some((c) => c.id === resultado.cliente_creado.id);
        return existe ? prev : [resultado.cliente_creado, ...prev];
      });
      setClienteSeleccionado(resultado.cliente_creado);
    } else if (resultado.cliente_id) {
      const clienteEncontrado = clientes.find((c) => c.id === resultado.cliente_id);
      if (clienteEncontrado) {
        setClienteSeleccionado(clienteEncontrado);
      }
    }

    // 2. Llena el itemsCarrito con los productos identificados y sus cantidades
    const tieneItems = Boolean(resultado.items && resultado.items.length > 0);
    if (tieneItems) {
      setItemsCarrito((prev) => {
        const nuevoCarrito = [...prev];
        for (const item of resultado.items) {
          const prod = productos.find((p) => p.id === item.producto_id);
          if (prod) {
            const idxExistente = nuevoCarrito.findIndex((i) => i.producto.id === prod.id);
            if (idxExistente >= 0) {
              nuevoCarrito[idxExistente] = {
                ...nuevoCarrito[idxExistente],
                cantidad: nuevoCarrito[idxExistente].cantidad + item.cantidad,
              };
            } else {
              nuevoCarrito.push({
                producto: prod,
                cantidad: item.cantidad,
              });
            }
          }
        }
        return nuevoCarrito;
      });
    }

    // 3. Método de pago sugerido (saldo_favor, pendiente, efectivo_usd, etc.)
    if (resultado.metodo_pago_sugerido) {
      setMetodoPagoSugerido(resultado.metodo_pago_sugerido);
      if (resultado.metodo_pago_sugerido === 'saldo_favor' && tieneItems) {
        setModalPagoAbierto(true);
      }
    } else if (resultado.pagado === false) {
      setMetodoPagoSugerido('pendiente');
    } else {
      setMetodoPagoSugerido('efectivo_usd');
    }

    // 4. Muestra un feedback visual o toast:
    let mensajeToast = resultado.resumen_interpretado || '¡Pedido cargado por Inteligencia Artificial!';
    if (resultado.cliente_creado && tieneItems) {
      mensajeToast = `¡"${resultado.cliente_creado.nombre_estudiante}" registrado y orden cargada con IA!`;
    } else if (resultado.cliente_creado && !tieneItems) {
      mensajeToast = `¡"${resultado.cliente_creado.nombre_estudiante}" registrado exitosamente en el sistema!`;
    }

    setNotificacion({
      tipo: 'exito',
      texto: mensajeToast,
    });
    setTimeout(() => {
      setNotificacion(null);
    }, 4500);
  };

  // Finalizar transacción exitosa
  const handleTransaccionExitosa = () => {
    setItemsCarrito([]);
    setModalPagoAbierto(false);
    setModalOrdenMovilAbierto(false);
    setMetodoPagoSugerido('efectivo_usd');
    obtenerSaldosTodosClientes().then(setSaldosClientes).catch(console.error);
    setNotificacion({
      tipo: 'exito',
      texto: '¡Venta registrada con éxito en Supabase!',
    });
    refrescarNotificacionesGlobales();
    setTimeout(() => {
      setNotificacion(null);
    }, 4000);
  };

  // Sembrar datos de prueba iniciales en Supabase si la base de datos está vacía
  const handleSembrarDatosIniciales = async () => {
    setSembrandoDatos(true);
    try {
      if (productos.length === 0) {
        const { error: errProd } = await supabase.from('productos').insert(
          PRODUCTOS_MUESTRA_SEMILLA.map((p) => ({
            nombre: p.nombre,
            precio_usd: p.precio_usd,
            activo: true,
          }))
        );
        if (errProd) console.error('Error insertando productos muestra:', errProd);
      }

      if (clientes.length === 0) {
        const { error: errCli } = await supabase.from('clientes').insert(
          CLIENTES_MUESTRA_SEMILLA.map((c) => ({
            nombre_estudiante: c.nombre_estudiante,
            grado_seccion: c.grado_seccion,
            nombre_representante: c.nombre_representante,
            telefono_whatsapp: c.telefono_whatsapp,
          }))
        );
        if (errCli) console.error('Error insertando clientes muestra:', errCli);
      }

      await cargarProductos();
      await cargarClientes();
      setNotificacion({
        tipo: 'exito',
        texto: '¡Catálogo y alumnos iniciales cargados exitosamente!',
      });
      setTimeout(() => setNotificacion(null), 4000);
    } catch (e) {
      console.error('Error sembrando datos:', e);
    } finally {
      setSembrandoDatos(false);
    }
  };

  // Skeleton inicial limpio mientras se monta en el navegador
  // Esto elimina cualquier discrepancia de hidratación con extensiones de navegador
  if (!montado) {
    return (
      <div className="min-h-screen flex flex-col bg-[#FAFAFA] dark:bg-[#090D16]" suppressHydrationWarning>
        <header className="sticky top-0 z-40 w-full border-b border-gray-200/70 dark:border-slate-800 bg-white/80 dark:bg-[#0D111A]/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full overflow-hidden">
                <Image
                  src="/logo-club5.png"
                  alt="Club 5 Logo"
                  width={48}
                  height={48}
                  className="h-full w-full object-contain rounded-full"
                  priority
                />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
                  Club 5 Cantina Escolar
                </h1>
                <p className="text-xs text-gray-500 dark:text-slate-400">Punto de Venta &bull; Facturación Bimoneda</p>
              </div>
            </div>
            <div className="h-9 w-48 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/50 animate-pulse" />
          </div>
        </header>

        <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="flex flex-col gap-5 lg:col-span-8">
              <div className="h-16 rounded-3xl border border-gray-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs animate-pulse" />
              <div className="h-96 rounded-3xl border border-gray-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs animate-pulse" />
            </div>
            <div className="lg:col-span-4">
              <div className="h-96 rounded-3xl border border-gray-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs animate-pulse" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Totales acumulados para barra flotante móvil y modales
  const totalUsdCarrito = itemsCarrito.reduce(
    (sum, item) => sum + item.producto.precio_usd * item.cantidad,
    0
  );
  const totalBsCarrito = calcularConversionBs(totalUsdCarrito, tasaBcv);
  const totalItemsCarrito = itemsCarrito.reduce((sum, item) => sum + item.cantidad, 0);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] dark:bg-[#090D16] text-slate-900 dark:text-slate-100 transition-colors" suppressHydrationWarning>
      {/* Header Precedent con Logo Oficial */}
      <Header
        tasaBcv={tasaBcv}
        cargandoTasa={cargandoTasa}
        onRefrescarTasa={cargarTasa}
        ultimaActualizacion={ultimaActualizacionTasa}
      />

      {/* Notificación Flotante */}
      {notificacion && (
        <div className="fixed top-16 right-6 z-50 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 shadow-lg animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{notificacion.texto}</span>
        </div>
      )}

      {/* Contenido Principal con padding inferior extra en móvil para la barra flotante */}
      <main className="mx-auto flex-1 w-full max-w-7xl px-3 sm:px-6 lg:px-8 py-5 sm:py-6 pb-28 lg:pb-8 overflow-x-hidden">
        {/* Banner de ayuda si no hay productos aún en la base de datos */}
        {!cargandoProductos && productos.length === 0 && (
          <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-3xl border border-amber-200 bg-amber-50/80 p-5 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-950">
                  Base de datos lista pero sin productos registrados
                </h3>
                <p className="text-xs text-amber-800/80">
                  ¿Deseas poblar el catálogo de la cantina con productos típicos (empanadas, tequeños, jugos, malta) y alumnos de ejemplo?
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={sembrandoDatos}
              onClick={handleSembrarDatosIniciales}
              className="shrink-0 rounded-xl bg-amber-900 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-black transition disabled:opacity-60"
            >
              {sembrandoDatos ? 'Cargando datos...' : 'Cargar Productos de Prueba'}
            </button>
          </div>
        )}

        {/* Layout en dos columnas: Izquierda (Selector de Cliente + Catálogo), Derecha (Carrito en Desktop) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Columna Izquierda: Cliente + Catálogo */}
          <div className="flex flex-col gap-4 sm:gap-5 lg:col-span-8">
            {/* Acceso Rápido a Pedido por Voz en Pantallas Móviles (< lg) */}
            <div className="lg:hidden">
              <VoiceOrderModal onPedidoProcesado={handlePedidoPorVoz} />
            </div>

            {/* Selector de Cliente */}
            <div className="rounded-3xl border border-gray-200/80 bg-white p-3 sm:p-4 shadow-xs min-w-0 max-w-full overflow-hidden">
              <ClientSelector
                clientes={clientes}
                clienteSeleccionado={clienteSeleccionado}
                onSeleccionarCliente={setClienteSeleccionado}
                onClienteCreado={(nuevo) => {
                  setClientes((prev) => [nuevo, ...prev]);
                  setClienteSeleccionado(nuevo);
                  setNotificacion({
                    tipo: 'exito',
                    texto: `¡"${nuevo.nombre_estudiante}" registrado y asociado a la venta!`,
                  });
                  setTimeout(() => setNotificacion(null), 4000);
                }}
                cargando={cargandoClientes}
                saldosClientes={saldosClientes}
              />
            </div>

            {/* Catálogo de Productos */}
            <div className="rounded-3xl border border-gray-200/80 bg-white p-4 sm:p-5 shadow-xs">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    Catálogo de Productos
                  </h2>
                  <p className="text-xs text-gray-500">
                    Precios en USD y cálculo en tiempo real con tasa BCV
                  </p>
                </div>
                <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-600">
                  {productos.length} items activos
                </span>
              </div>

              <ProductCatalog
                productos={productos}
                itemsCarrito={itemsCarrito}
                tasaBcv={tasaBcv}
                onAgregarProducto={handleAgregarProducto}
                onDisminuirProducto={(id) => handleModificarCantidad(id, -1)}
                cargando={cargandoProductos}
              />
            </div>
          </div>

          {/* Columna Derecha: Carrito y Totales (Sticky en Desktop, oculta en móvil < lg) */}
          <div className="hidden lg:block lg:col-span-4">
            <div className="sticky top-20 flex flex-col gap-3.5">
              {/* Botón Destacado de Pedido y Registro por Voz */}
              <VoiceOrderModal onPedidoProcesado={handlePedidoPorVoz} />

              <Cart
                items={itemsCarrito}
                cliente={clienteSeleccionado}
                tasaBcv={tasaBcv}
                onModificarCantidad={handleModificarCantidad}
                onEliminarItem={handleEliminarItem}
                onVaciarCarrito={handleVaciarCarrito}
                onProcederPago={() => setModalPagoAbierto(true)}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Barra Flotante de Carrito en Pantallas Móviles (< lg) */}
      <AnimatePresence>
        {itemsCarrito.length > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-4 left-3 right-3 sm:left-6 sm:right-6 z-40 lg:hidden"
          >
            <button
              type="button"
              onClick={() => setModalOrdenMovilAbierto(true)}
              className="w-full flex items-center justify-between rounded-full bg-gray-900/95 text-white p-2 sm:p-2.5 pl-3.5 sm:pl-4 pr-2.5 sm:pr-3 shadow-2xl backdrop-blur-md border border-gray-800 hover:bg-black transition-all transform active:scale-[0.98]"
            >
              {/* Badge circular con la cantidad + Totales */}
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 font-black text-sm text-white shadow-xs">
                  {totalItemsCarrito}
                </div>
                <div className="flex flex-col text-left">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-base font-bold text-white tracking-tight">
                      {formatUSD(totalUsdCarrito)}
                    </span>
                    <span className="text-xs font-semibold text-amber-300 font-mono">
                      &bull; {formatBs(totalBsCarrito)}
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-400 truncate max-w-[140px] sm:max-w-[220px]">
                    {clienteSeleccionado ? clienteSeleccionado.nombre_estudiante : 'Cliente General'}
                  </span>
                </div>
              </div>

              {/* Botón Ver Orden con ShoppingBag */}
              <div className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-indigo-600 px-3.5 sm:px-4 py-2 sm:py-2.5 font-bold text-xs text-white shadow-xs shrink-0">
                <ShoppingBag className="h-4 w-4" />
                <span>Ver Orden</span>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal / Bottom Sheet de Orden en Móviles (Radix UI Dialog) */}
      <Dialog.Root open={modalOrdenMovilAbierto} onOpenChange={setModalOrdenMovilAbierto}>
        <Dialog.Portal>
          <Dialog.Overlay
            {...dragScrollOrden.overlayProps}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in"
          />
          <Dialog.Content
            style={dragScrollOrden.style}
            {...dragScrollOrden.dragProps}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain touch-scroll-ios pb-28 sm:pb-6 rounded-t-3xl sm:rounded-3xl border-t sm:border border-gray-200/90 bg-white p-4 sm:p-6 shadow-2xl outline-none duration-300 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in-0 sm:zoom-in-95 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[95vw] sm:max-w-lg cursor-grab active:cursor-grabbing"
          >
            {/* Manija táctil interactiva en móvil */}
            <div
              className="mx-auto mb-3 -mt-1 flex h-6 w-full cursor-grab active:cursor-grabbing items-center justify-center sm:hidden touch-none"
              title="Deslizar hacia abajo para cerrar"
            >
              <div className="h-1.5 w-12 rounded-full bg-gray-300 active:bg-gray-400 transition-colors" />
            </div>

            {/* Header del Modal de Orden Móvil */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-900 text-white shadow-xs">
                  <ShoppingBag className="h-4 w-4" />
                </div>
                <div>
                  <Dialog.Title className="text-base font-bold text-gray-900">
                    Orden Actual
                  </Dialog.Title>
                  <Dialog.Description className="text-xs text-gray-500">
                    {totalItemsCarrito} {totalItemsCarrito === 1 ? 'producto' : 'productos'} seleccionados
                  </Dialog.Description>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {itemsCarrito.length > 0 && (
                  <button
                    type="button"
                    onClick={handleVaciarCarrito}
                    className="rounded-xl px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                  >
                    Vaciar
                  </button>
                )}
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </Dialog.Close>
              </div>
            </div>

            <div className="my-4 space-y-4">
              {/* 1. Selector de Cliente (con registro express) */}
              <div>
                <span className="block mb-1.5 text-xs font-bold text-gray-700">
                  Cliente o Estudiante Asignado
                </span>
                <ClientSelector
                  clientes={clientes}
                  clienteSeleccionado={clienteSeleccionado}
                  onSeleccionarCliente={setClienteSeleccionado}
                  onClienteCreado={(nuevo) => {
                    setClientes((prev) => [nuevo, ...prev]);
                    setClienteSeleccionado(nuevo);
                    setNotificacion({
                      tipo: 'exito',
                      texto: `¡"${nuevo.nombre_estudiante}" registrado y asociado a la venta!`,
                    });
                    setTimeout(() => setNotificacion(null), 4000);
                  }}
                  cargando={cargandoClientes}
                />
              </div>

              {/* 2. Disparador de Pedido por Voz */}
              <VoiceOrderModal onPedidoProcesado={handlePedidoPorVoz} />

              {/* 3. Lista de productos con botones grandes para pulgar */}
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {itemsCarrito.map((item) => {
                  const subtotalUsd = item.producto.precio_usd * item.cantidad;
                  const subtotalBs = calcularConversionBs(subtotalUsd, tasaBcv);
                  return (
                    <div
                      key={item.producto.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50/70 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-xs font-bold text-gray-900">
                          {item.producto.nombre}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                          <span>{formatUSD(item.producto.precio_usd)} c/u</span>
                          <span>&bull;</span>
                          <span className="font-mono text-amber-700">{formatBs(subtotalBs)}</span>
                        </div>
                      </div>

                      {/* Botones de cantidad accesibles */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleModificarCantidad(item.producto.id, -1)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-xs hover:bg-gray-100 active:scale-95 transition"
                          title="Restar o eliminar"
                        >
                          {item.cantidad === 1 ? (
                            <Trash2 className="h-4 w-4 text-rose-600" />
                          ) : (
                            <Minus className="h-4 w-4" />
                          )}
                        </button>
                        <span className="w-6 text-center text-sm font-bold text-gray-900">
                          {item.cantidad}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleModificarCantidad(item.producto.id, 1)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-xs hover:bg-gray-100 active:scale-95 transition"
                          title="Sumar"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="text-right shrink-0 min-w-[55px]">
                        <div className="text-xs font-bold text-gray-900">
                          {formatUSD(subtotalUsd)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 4. Total a Pagar en USD y Bs */}
              <div className="rounded-2xl bg-gradient-to-br from-gray-900 to-slate-800 p-4 text-white shadow-md">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Total a Pagar
                  </span>
                  <span className="text-2xl font-black tracking-tight text-white">
                    {formatUSD(totalUsdCarrito)}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline justify-between border-t border-white/10 pt-2 text-amber-300">
                  <span className="text-[11px] font-medium text-gray-300">
                    Equivalente en Bolívares (Tasa {formatBs(tasaBcv)})
                  </span>
                  <span className="font-mono text-base font-bold tracking-tight">
                    {formatBs(totalBsCarrito)}
                  </span>
                </div>
              </div>

              {/* 5. Botón grande y accesible 'Cobrar Venta' */}
              <button
                type="button"
                disabled={itemsCarrito.length === 0}
                onClick={() => {
                  setModalOrdenMovilAbierto(false);
                  setModalPagoAbierto(true);
                }}
                className="flex h-12 min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-base font-bold text-white shadow-md transition hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
              >
                <span>Cobrar Venta</span>
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Modal de Pago con Radix UI */}
      <PaymentModal
        abierto={modalPagoAbierto}
        onOpenChange={setModalPagoAbierto}
        items={itemsCarrito}
        cliente={clienteSeleccionado}
        tasaBcv={tasaBcv}
        metodoInicial={metodoPagoSugerido}
        onTransaccionExitosa={handleTransaccionExitosa}
      />
    </div>
  );
}
