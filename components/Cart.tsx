'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Plus, Minus, Trash2, ArrowRight, DollarSign } from 'lucide-react';
import { ItemCarrito, Cliente } from '@/types/pos';
import { formatUSD, formatBs, calcularConversionBs } from '@/lib/utils';

interface CartProps {
  items: ItemCarrito[];
  cliente: Cliente | null;
  tasaBcv: number;
  onModificarCantidad: (productoId: string, delta: number) => void;
  onEliminarItem: (productoId: string) => void;
  onVaciarCarrito: () => void;
  onProcederPago: () => void;
}

export function Cart({
  items,
  cliente,
  tasaBcv,
  onModificarCantidad,
  onEliminarItem,
  onVaciarCarrito,
  onProcederPago,
}: CartProps) {
  const totalUsd = items.reduce(
    (sum, item) => sum + item.producto.precio_usd * item.cantidad,
    0
  );
  const totalBs = calcularConversionBs(totalUsd, tasaBcv);
  const totalItems = items.reduce((sum, item) => sum + item.cantidad, 0);

  return (
    <div className="flex h-full flex-col justify-between rounded-3xl border border-gray-200/80 bg-white p-5 shadow-xs">
      <div>
        {/* Cabecera del Carrito */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-900 text-white shadow-xs">
              <ShoppingCart className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Orden Actual
              </h2>
              <span className="text-xs text-gray-500">
                {totalItems} {totalItems === 1 ? 'producto' : 'productos'}
              </span>
            </div>
          </div>

          {items.length > 0 && (
            <button
              type="button"
              onClick={onVaciarCarrito}
              className="rounded-xl px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
              title="Vaciar carrito"
            >
              Vaciar
            </button>
          )}
        </div>

        {/* Lista de productos en el carrito */}
        <div className="my-4 max-h-[380px] overflow-y-auto space-y-2.5 pr-1">
          <AnimatePresence initial={false}>
            {items.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 border border-gray-200/60 text-gray-400 mb-3">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-gray-800">
                  El carrito está vacío
                </p>
                <p className="mt-1 text-xs text-gray-400 max-w-[200px]">
                  Haz clic en cualquier producto del catálogo para comenzar la venta.
                </p>
              </motion.div>
            ) : (
              items.map((item) => {
                const subtotalItemUsd = item.producto.precio_usd * item.cantidad;
                const subtotalItemBs = calcularConversionBs(subtotalItemUsd, tasaBcv);

                return (
                  <motion.div
                    key={item.producto.id}
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50/50 p-3 transition hover:bg-gray-50"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-xs font-semibold text-gray-900">
                        {item.producto.nombre}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                        <span>{formatUSD(item.producto.precio_usd)} c/u</span>
                        <span>&bull;</span>
                        <span className="font-mono">{formatBs(subtotalItemBs)}</span>
                      </div>
                    </div>

                    {/* Controles de cantidad */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onModificarCantidad(item.producto.id, -1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-xs hover:bg-gray-100 transition active:scale-95"
                      >
                        {item.cantidad === 1 ? (
                          <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                        ) : (
                          <Minus className="h-3.5 w-3.5" />
                        )}
                      </button>

                      <span className="w-6 text-center text-xs font-bold text-gray-900">
                        {item.cantidad}
                      </span>

                      <button
                        type="button"
                        onClick={() => onModificarCantidad(item.producto.id, 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-xs hover:bg-gray-100 transition active:scale-95"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="text-right shrink-0 min-w-[55px]">
                      <div className="text-xs font-bold text-gray-900">
                        {formatUSD(subtotalItemUsd)}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Resumen Financiero y Botón de Pago */}
      <div className="border-t border-gray-100 pt-4">
        {cliente && (
          <div className="mb-3 rounded-xl bg-indigo-50/70 border border-indigo-100/80 px-3 py-2 text-xs">
            <span className="font-medium text-indigo-900">Asociado a:</span>{' '}
            <span className="font-bold text-indigo-950">{cliente.nombre_estudiante}</span>
            {cliente.grado_seccion && (
              <span className="text-indigo-700 font-medium"> ({cliente.grado_seccion})</span>
            )}
          </div>
        )}

        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span>
            <span className="font-medium text-gray-900">{formatUSD(totalUsd)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Tasa BCV del día</span>
            <span className="font-mono text-gray-700">
              {tasaBcv > 0 ? formatBs(tasaBcv) : '---'}
            </span>
          </div>

          <div className="my-2 border-t border-gray-100" />

          {/* Gran Total */}
          <div className="rounded-2xl bg-gradient-to-br from-gray-900 to-slate-800 p-4 text-white shadow-md">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium text-gray-300 uppercase tracking-wider">
                Total a Pagar
              </span>
              <span className="text-2xl font-black tracking-tight text-white">
                {formatUSD(totalUsd)}
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between border-t border-white/10 pt-2 text-amber-300">
              <span className="text-[11px] font-medium text-gray-300">
                Equivalente en Bolívares
              </span>
              <span className="font-mono text-base font-bold tracking-tight">
                {formatBs(totalBs)}
              </span>
            </div>
          </div>
        </div>

        {/* Botón de acción */}
        <button
          type="button"
          disabled={items.length === 0}
          onClick={onProcederPago}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
        >
          <span>Cobrar Venta</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
