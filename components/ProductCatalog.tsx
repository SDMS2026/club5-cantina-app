'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Check, X, ShoppingBag, Utensils, Coffee, Cookie, Sparkles } from 'lucide-react';
import { Producto, ItemCarrito } from '@/types/pos';
import { formatUSD, formatBs, calcularConversionBs } from '@/lib/utils';
import { esUrlImagen, CATEGORIAS_PRODUCTOS_SISTEMA } from '@/lib/productEmojis';
import { useDraggableScroll } from '@/lib/useDraggableScroll';

interface ProductCatalogProps {
  productos: Producto[];
  itemsCarrito: ItemCarrito[];
  tasaBcv: number;
  onAgregarProducto: (producto: Producto) => void;
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
            className="w-full rounded-2xl border border-gray-200/90 bg-white py-2.5 pl-10 pr-10 text-sm text-gray-900 placeholder-gray-400 shadow-xs outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
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
                ? 'bg-gray-900 text-white shadow-xs'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-gray-900'
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
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span>{cat}</span>
                {cantidad > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      esActiva
                        ? 'bg-indigo-700/80 text-white'
                        : 'bg-gray-100 text-gray-500'
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
              className="h-44 animate-pulse rounded-2xl border border-gray-200/80 bg-gray-100/60 p-4"
            />
          ))}
        </div>
      ) : productosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 bg-white/50 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 mb-3">
            <Utensils className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">
            No se encontraron productos
          </h3>
          <p className="mt-1 text-xs text-gray-500 max-w-sm">
            {busqueda
              ? `No hay coincidencias para "${busqueda}". Intenta con otro término.`
              : 'El catálogo de la cantina está vacío o no hay productos activos.'}
          </p>
        </div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
        >
          <AnimatePresence>
            {productosFiltrados.map((producto, index) => {
              const cantidad = cantidadesEnCarrito.get(producto.id) || 0;
              const precioBs = calcularConversionBs(producto.precio_usd, tasaBcv);

              return (
                <motion.div
                  key={producto.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
                  onClick={() => onAgregarProducto(producto)}
                  className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-white p-3.5 text-left transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-md ${
                    cantidad > 0
                      ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'border-gray-200/80 hover:border-gray-300'
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
                  <div className="relative mb-3 flex h-28 w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-gray-50 to-gray-100/70 border border-gray-100">
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
                      <h4 className="line-clamp-2 text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                        {producto.nombre}
                      </h4>
                    </div>

                    <div className="mt-2.5 flex items-end justify-between gap-1 pt-2 border-t border-gray-100">
                      <div>
                        <div className="text-base font-bold tracking-tight text-gray-900">
                          {formatUSD(producto.precio_usd)}
                        </div>
                        <div className="text-[11px] font-medium text-gray-500 font-mono">
                          {formatBs(precioBs)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAgregarProducto(producto);
                        }}
                        className={`flex h-9 w-9 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-xl transition-all active:scale-90 ${
                          cantidad > 0
                            ? 'bg-indigo-600 text-white shadow-xs hover:bg-indigo-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-900 hover:text-white'
                        }`}
                        title="Agregar al carrito"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
