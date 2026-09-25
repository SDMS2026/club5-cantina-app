'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Minus, Check, X, ShoppingBag, Utensils, Coffee, Cookie, Sparkles } from 'lucide-react';
import { Producto, ItemCarrito } from '@/types/pos';
import { formatUSD, formatBs, calcularConversionBs } from '@/lib/utils';
import { esUrlImagen, CATEGORIAS_PRODUCTOS_SISTEMA } from '@/lib/productEmojis';
import { useDraggableScroll } from '@/lib/useDraggableScroll';

interface ProductCatalogProps {
  productos: Producto[];
  itemsCarrito: ItemCarrito[];
  tasaBcv: number;
  onAgregarProducto: (producto: Producto) => void;
  onDisminuirProducto?: (productoId: string) => void;
  cargando?: boolean;
}

// Icono o fallback visual según el nombre del producto
function getProductEmojiFallback(nombre: string): string {
  const n = nombre.toLowerCase();
  if (n.includes('empanada')) return '🥟';
  if (n.includes('tequeño') || n.includes('tequeno')) return '🧀';
  if (n.includes('pastelito') || n.includes('pastel')) return '🥐';
  if (n.includes('jugo') || n.includes('naranja') || n.includes('parchita')) return '🧃';
  if (n.includes('malta') || n.includes('refresco') || n.includes('soda')) return '🥤';
  if (n.includes('agua')) return '💧';
  if (n.includes('sandwich') || n.includes('sanduwich')) return '🥪';
  if (n.includes('croissant')) return '🥐';
  if (n.includes('galleta') || n.includes('cookie')) return '🍪';
  if (n.includes('torta') || n.includes('cake') || n.includes('donut')) return '🍩';
  if (n.includes('chocolate')) return '🍫';
  if (n.includes('fruta') || n.includes('manzana')) return '🍎';
  return '🍴';
}

function coincideConCategoria(prodCat: string | undefined | null, selCat: string): boolean {
  if (selCat === 'todos') return true;
  if (!prodCat) return false;
  const p = prodCat.toLowerCase().trim();
  const s = selCat.toLowerCase().trim();
  if (p === s) return true;
  if (s.includes('desayuno') || s.includes('salado') || s.includes('comida')) {
    return p.includes('desayuno') || p.includes('salado') || p.includes('comida');
  }
  if (s.includes('bebida') || s.includes('jugo')) {
    return p.includes('bebida') || p.includes('jugo');
  }
  if (s.includes('snack') || s.includes('dulce')) {
    return p.includes('snack') || p.includes('dulce');
  }
  if (s.includes('fruta') || s.includes('saludable')) {
    return p.includes('fruta') || p.includes('saludable');
  }
  if (s.includes('útil') || s.includes('util') || s.includes('vario')) {
    return p.includes('útil') || p.includes('util') || p.includes('vario');
  }
  return false;
}

export function ProductCatalog({
  productos,
  itemsCarrito,
  tasaBcv,
  onAgregarProducto,
  onDisminuirProducto,
  cargando = false,
}: ProductCatalogProps) {
  const [busqueda, setBusqueda] = useState('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>('todos');
  const { ref: draggableRef, events: draggableEvents } = useDraggableScroll();

  // Mapa de cantidades en carrito por ID de producto
  const cantidadesEnCarrito = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const item of itemsCarrito) {
      mapa.set(item.producto.id, item.cantidad);
    }
    return mapa;
  }, [itemsCarrito]);

  // Lista de categorías disponibles (base del sistema + cualquier otra registrada en productos)
  const categorias = useMemo(() => {
    const set = new Set<string>(CATEGORIAS_PRODUCTOS_SISTEMA);
    for (const p of productos) {
      if (p.categoria && p.categoria.trim()) {
        set.add(p.categoria.trim());
      }
    }
    return Array.from(set);
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      if (!p.activo) return false;
      const coincideBusqueda =
        p.nombre.toLowerCase().includes(busqueda.toLowerCase().trim()) ||
        p.precio_usd.toString().includes(busqueda.trim());
      const coincideCategoria = coincideConCategoria(p.categoria, categoriaSeleccionada);
      return coincideBusqueda && coincideCategoria;
    });
  }, [productos, busqueda, categoriaSeleccionada]);

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de búsqueda y filtros */}
      <div className="flex flex-col gap-3">
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar empanada, jugo, malta, tequeños..."
            className="w-full rounded-2xl border border-gray-200/90 dark:border-[#1D263A] bg-white dark:bg-[#111726] py-2.5 pl-10 pr-10 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 shadow-xs outline-none transition focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950/50"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-white transition"
              title="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Pestañas de categorías completas con soporte táctil y arrastre con ratón */}
        <div
          ref={draggableRef}
          {...draggableEvents}
          className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar cursor-grab active:cursor-grabbing select-none touch-pan-x"
        >
          <button
            type="button"
            onClick={() => setCategoriaSeleccionada('todos')}
            className={`rounded-2xl px-3.5 py-2 min-h-[38px] text-xs font-bold whitespace-nowrap transition shrink-0 ${
              categoriaSeleccionada === 'todos'
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-950 shadow-xs'
                : 'bg-white dark:bg-[#111726] text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-[#1D263A] hover:bg-gray-50 dark:hover:bg-[#141C2E] hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Todos ({productos.filter((p) => p.activo).length})
          </button>
          {categorias.map((cat) => {
            const cantidad = productos.filter(
              (p) => p.activo && coincideConCategoria(p.categoria, cat)
            ).length;
            const esActiva = categoriaSeleccionada === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoriaSeleccionada(cat)}
                className={`rounded-2xl px-3.5 py-2 min-h-[38px] text-xs font-bold whitespace-nowrap transition shrink-0 flex items-center gap-1.5 ${
                  esActiva
                    ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-xs'
                    : 'bg-white dark:bg-[#111726] text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-[#1D263A] hover:bg-gray-50 dark:hover:bg-[#141C2E] hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <span>{cat}</span>
                {cantidad > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      esActiva
                        ? 'bg-indigo-700/80 dark:bg-indigo-600/80 text-white'
                        : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'
                    }`}
                  >
                    {cantidad}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid de productos animado con Framer Motion */}
      {cargando ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="h-44 animate-pulse rounded-2xl border border-gray-200/80 dark:border-[#1D263A] bg-gray-100/60 dark:bg-[#111726]/60 p-4"
            />
          ))}
        </div>
      ) : productosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 dark:border-slate-800 bg-white/50 dark:bg-[#111726]/40 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-400 mb-3">
            <Utensils className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            No se encontraron productos
          </h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400 max-w-sm">
            {busqueda
              ? `No hay coincidencias para "${busqueda}". Intenta con otro término.`
              : 'El catálogo de la cantina está vacío o no hay productos activos.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <AnimatePresence mode="popLayout">
            {productosFiltrados.map((producto, index) => {
              const cantidad = cantidadesEnCarrito.get(producto.id) || 0;
              const precioBs = calcularConversionBs(producto.precio_usd, tasaBcv);

              return (
                <motion.div
                  key={producto.id}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                  transition={{
                    duration: 0.22,
                    delay: Math.min(index * 0.02, 0.2),
                    ease: [0.25, 1, 0.5, 1],
                  }}
                  onClick={() => onAgregarProducto(producto)}
                  className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-white dark:bg-[#111726] p-3.5 text-left transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-md will-change-transform ${
                    cantidad > 0
                      ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'border-gray-200/80 dark:border-[#1D263A] hover:border-gray-300 dark:hover:border-slate-700'
                  }`}
                >
                  {/* Badge de cantidad si ya está en el carrito */}
                  {cantidad > 0 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute right-2.5 top-2.5 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs font-bold text-white shadow-sm"
                    >
                      {cantidad}
                    </motion.div>
                  )}

                  {/* Visual / Foto del producto */}
                  <div className="relative mb-3 flex h-28 w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-gray-50 to-gray-100/70 border border-gray-100 dark:from-slate-900/90 dark:to-[#141C2E] dark:border-slate-800">
                    {esUrlImagen(producto.imagen_url) ? (
                      <Image
                        src={producto.imagen_url!}
                        alt={producto.nombre}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                      />
                    ) : (
                      <span className="text-5xl filter drop-shadow-xs transition-transform duration-300 group-hover:scale-110 select-none">
                        {producto.imagen_url || getProductEmojiFallback(producto.nombre)}
                      </span>
                    )}
                  </div>

                  {/* Información del producto */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="line-clamp-2 text-sm font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {producto.nombre}
                      </h4>
                    </div>

                    <div className="mt-2.5 flex items-end justify-between gap-1 pt-2 border-t border-gray-100 dark:border-slate-800/80">
                      <div className="min-w-0 flex-1 pr-1">
                        <div className="text-sm sm:text-base font-bold tracking-tight text-gray-900 dark:text-white truncate">
                          {formatUSD(producto.precio_usd)}
                        </div>
                        <div className="text-[10px] sm:text-[11px] font-medium text-gray-500 dark:text-slate-400 font-mono truncate">
                          {formatBs(precioBs)}
                        </div>
                      </div>

                      {/* Controles de Acción: Aumentar y Disminuir */}
                      {cantidad > 0 ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {onDisminuirProducto && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDisminuirProducto(producto.id);
                              }}
                              className="flex h-8 w-8 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 shadow-2xs hover:bg-rose-100 dark:hover:bg-rose-900/60 hover:border-rose-300 active:scale-90 transition-all"
                              title="Disminuir 1 unidad"
                              aria-label="Disminuir 1 unidad"
                            >
                              <Minus className="h-3.5 w-3.5 stroke-[2.5]" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAgregarProducto(producto);
                            }}
                            className="flex h-8 w-8 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-2xs hover:bg-indigo-700 active:scale-90 transition-all"
                            title="Aumentar 1 unidad"
                            aria-label="Aumentar 1 unidad"
                          >
                            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAgregarProducto(producto);
                          }}
                          className="flex h-9 w-9 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-900 dark:hover:bg-indigo-600 hover:text-white active:scale-90 transition-all"
                          title="Agregar al carrito"
                          aria-label="Agregar al carrito"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
