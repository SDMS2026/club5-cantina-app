'use client';

import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  X,
  CheckCircle2,
  DollarSign,
  Smartphone,
  CreditCard,
  Clock,
  AlertCircle,
  Loader2,
  User,
  ShoppingBag,
} from 'lucide-react';
import { Cliente, ItemCarrito, MetodoPagoId, MetodoPagoOpcion } from '@/types/pos';
import { supabase } from '@/lib/supabaseClient';
import { formatUSD, formatBs, calcularConversionBs } from '@/lib/utils';
import { useModalDragScroll } from '@/lib/useModalDragScroll';

interface PaymentModalProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  items: ItemCarrito[];
  cliente: Cliente | null;
  tasaBcv: number;
  metodoInicial?: MetodoPagoId;
  onTransaccionExitosa: () => void;
}

const METODOS_PAGO: MetodoPagoOpcion[] = [
  {
    id: 'efectivo_usd',
    nombre: 'Efectivo USD ($)',
    descripcion: 'Cobro en billetes divisa',
    moneda: 'USD',
    icono: 'dollar',
    marcarPagado: true,
  },
  {
    id: 'pago_movil',
    nombre: 'Pago Móvil (Bs.)',
    descripcion: 'Transferencia interbancaria al instante',
    moneda: 'Bs',
    icono: 'phone',
    marcarPagado: true,
  },
  {
    id: 'punto_debito',
    nombre: 'Punto de Venta / Tarjeta',
    descripcion: 'Tarjeta de débito en bolívares',
    moneda: 'Bs',
    icono: 'card',
    marcarPagado: true,
  },
  {
    id: 'pendiente',
    nombre: 'Cuenta Cantina (Pendiente)',
    descripcion: 'Cargar a la cuenta del estudiante (Por pagar)',
    moneda: 'USD',
    icono: 'clock',
    marcarPagado: false,
  },
];

export function PaymentModal({
  abierto,
  onOpenChange,
  items,
  cliente,
  tasaBcv,
  metodoInicial,
  onTransaccionExitosa,
}: PaymentModalProps) {
  const [metodoSeleccionado, setMetodoSeleccionado] = useState<MetodoPagoId>(metodoInicial || 'efectivo_usd');
  const [procesando, setProcesando] = useState(false);
  const [errorMensaje, setErrorMensaje] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const [consumoGuardadoId, setConsumoGuardadoId] = useState<string | null>(null);

  // Deslizamiento vertical y arrastre (drag-to-scroll) para móviles y emuladores con Body Scroll Lock
  const dragScrollPago = useModalDragScroll({
    isOpen: abierto,
    onDismiss: () => handleCerrar(false),
  });

  useEffect(() => {
    if (abierto && metodoInicial) {
      setMetodoSeleccionado(metodoInicial);
    }
  }, [abierto, metodoInicial]);

  const totalUsd = items.reduce(
    (sum, item) => sum + item.producto.precio_usd * item.cantidad,
    0
  );
  const totalBs = calcularConversionBs(totalUsd, tasaBcv);

  const handleConfirmarVenta = async () => {
    if (items.length === 0) return;
    setProcesando(true);
    setErrorMensaje(null);

    const metodoConfig = METODOS_PAGO.find((m) => m.id === metodoSeleccionado);
    const pagado = metodoConfig?.marcarPagado ?? true;

    try {
      // 1. Insertar consumo cabecera
      const { data: consumoData, error: consumoError } = await supabase
        .from('consumos')
        .insert({
          cliente_id: cliente ? cliente.id : null,
          monto_total_usd: totalUsd,
          tasa_bcv_historica: tasaBcv,
          metodo_pago: metodoSeleccionado,
          pagado: pagado,
        })
        .select()
        .single();

      if (consumoError || !consumoData) {
        throw new Error(consumoError?.message || 'Error al crear el registro de consumo');
      }

      // 2. Insertar renglones de consumo_detalles
      const detalles = items.map((item) => ({
        consumo_id: consumoData.id,
        producto_id: item.producto.id,
        cantidad: item.cantidad,
        precio_unitario_usd: item.producto.precio_usd,
      }));

      const { error: detallesError } = await supabase
        .from('consumo_detalles')
        .insert(detalles);

      if (detallesError) {
        throw new Error(detallesError.message || 'Error al guardar los detalles de la compra');
      }

      setConsumoGuardadoId(consumoData.id);
      setExito(true);
      setTimeout(() => {
        onTransaccionExitosa();
      }, 1500);
    } catch (err: unknown) {
      console.error('Error registrando transacción:', err);
      const msg = err instanceof Error ? err.message : 'Error inesperado al conectar con Supabase';
      setErrorMensaje(msg);
    } finally {
      setProcesando(false);
    }
  };

  const handleCerrar = (open: boolean) => {
    if (procesando) return;
    if (!open) {
      // Reset state tras animación
      setTimeout(() => {
        setExito(false);
        setErrorMensaje(null);
        setConsumoGuardadoId(null);
      }, 300);
    }
    onOpenChange(open);
  };

  return (
    <Dialog.Root open={abierto} onOpenChange={handleCerrar}>
      <Dialog.Portal>
        <Dialog.Overlay
          {...dragScrollPago.overlayProps}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
        />
        <Dialog.Content
          style={dragScrollPago.style}
          {...dragScrollPago.dragProps}
          className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain touch-scroll-ios rounded-t-3xl sm:rounded-3xl border-t sm:border border-gray-200/90 bg-white p-4 sm:p-6 pb-28 sm:pb-6 shadow-2xl outline-none duration-300 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in-0 sm:zoom-in-95 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[95vw] sm:max-w-lg cursor-grab active:cursor-grabbing"
        >
          {/* Manija táctil para deslizar hacia arriba y abajo en móviles */}
          <div
            className="mx-auto mb-3 -mt-1 flex h-6 w-full cursor-grab active:cursor-grabbing items-center justify-center sm:hidden touch-none"
            title="Deslizar hacia abajo para cerrar"
          >
            <div className="h-1.5 w-12 rounded-full bg-gray-300 active:bg-gray-400 transition-colors" />
          </div>

          {exito ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 mb-4 animate-in zoom-in">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <Dialog.Title className="text-xl font-bold text-gray-900">
                ¡Venta Registrada Exitosamente!
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-gray-500">
                El consumo fue guardado en Supabase bajo el ID{' '}
                <span className="font-mono text-xs text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                  {consumoGuardadoId?.slice(0, 8)}...
                </span>
              </Dialog.Description>

              <div className="mt-6 w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 text-left">
                <div className="flex justify-between text-xs text-gray-600 py-1">
                  <span>Monto Total USD:</span>
                  <span className="font-bold text-gray-900">{formatUSD(totalUsd)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-600 py-1">
                  <span>Equivalente Bs. (Tasa {formatBs(tasaBcv)}):</span>
                  <span className="font-mono font-bold text-gray-900">{formatBs(totalBs)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-600 py-1">
                  <span>Método de Pago:</span>
                  <span className="font-medium capitalize text-gray-900">
                    {METODOS_PAGO.find((m) => m.id === metodoSeleccionado)?.nombre}
                  </span>
                </div>
                {cliente && (
                  <div className="flex justify-between text-xs text-gray-600 py-1 border-t border-gray-200/60 mt-1 pt-1">
                    <span>Estudiante:</span>
                    <span className="font-medium text-indigo-700">
                      {cliente.nombre_estudiante} ({cliente.grado_seccion || 'General'})
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Encabezado del Modal */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <Dialog.Title className="text-lg font-bold text-gray-900">
                    Confirmar Cobro y Registro
                  </Dialog.Title>
                  <Dialog.Description className="text-xs text-gray-500">
                    Elige el método de pago para registrar la transacción en el sistema.
                  </Dialog.Description>
                </div>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    disabled={procesando}
                    className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </Dialog.Close>
              </div>

              {/* Alerta de error si ocurre */}
              {errorMensaje && (
                <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{errorMensaje}</span>
                </div>
              )}

              {/* Resumen del Monto */}
              <div className="my-4 rounded-2xl border border-gray-200/70 bg-gradient-to-r from-gray-50 to-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Total a Cobrar
                  </span>
                  <div className="text-right">
                    <div className="text-2xl font-black text-gray-900">
                      {formatUSD(totalUsd)}
                    </div>
                    <div className="text-xs font-bold text-amber-700 font-mono">
                      {formatBs(totalBs)}
                    </div>
                  </div>
                </div>

                <div className="mt-3 border-t border-gray-200/60 pt-2 flex items-center justify-between text-xs text-gray-600">
                  <span className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-gray-400" />
                    {cliente ? cliente.nombre_estudiante : 'Venta General (Sin registrar)'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <ShoppingBag className="h-3.5 w-3.5 text-gray-400" />
                    {items.reduce((acc, i) => acc + i.cantidad, 0)} artículos
                  </span>
                </div>
              </div>

              {/* Métodos de Pago */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700">
                  Selecciona el Método de Pago
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {METODOS_PAGO.map((metodo) => {
                    const seleccionado = metodoSeleccionado === metodo.id;
                    return (
                      <button
                        key={metodo.id}
                        type="button"
                        onClick={() => setMetodoSeleccionado(metodo.id)}
                        className={`flex flex-col items-start rounded-2xl border p-3 text-left transition-all ${
                          seleccionado
                            ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/20 shadow-xs'
                            : 'border-gray-200/80 bg-white hover:border-gray-300 hover:bg-gray-50/50'
                        }`}
                      >
                        <div className="flex w-full items-center justify-between mb-1.5">
                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                              seleccionado
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {metodo.id === 'efectivo_usd' && <DollarSign className="h-4 w-4" />}
                            {metodo.id === 'pago_movil' && <Smartphone className="h-4 w-4" />}
                            {metodo.id === 'punto_debito' && <CreditCard className="h-4 w-4" />}
                            {metodo.id === 'pendiente' && <Clock className="h-4 w-4" />}
                          </div>

                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              metodo.moneda === 'USD'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {metodo.moneda}
                          </span>
                        </div>

                        <span className="text-xs font-bold text-gray-900">{metodo.nombre}</span>
                        <span className="mt-0.5 text-[11px] text-gray-500 leading-tight">
                          {metodo.descripcion}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Botón de Confirmación */}
              <div className="mt-6 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 border-t border-gray-100 pt-4">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    disabled={procesando}
                    className="flex min-h-[44px] items-center justify-center rounded-2xl border border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 active:scale-95 transition"
                  >
                    Cancelar
                  </button>
                </Dialog.Close>

                <button
                  type="button"
                  onClick={handleConfirmarVenta}
                  disabled={procesando}
                  className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-gray-900 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-black active:scale-95 transition disabled:opacity-60"
                >
                  {procesando ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Registrando en Supabase...</span>
                    </>
                  ) : (
                    <span>Confirmar Transacción</span>
                  )}
                </button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
