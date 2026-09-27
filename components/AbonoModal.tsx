'use client';

import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  PiggyBank,
  X,
  AlertCircle,
  DollarSign,
  Banknote,
  Smartphone,
  CreditCard,
  Wallet,
  Loader2,
  Sparkles,
  Check,
} from 'lucide-react';
import { Cliente } from '@/types/pos';
import { procesarAbonoCliente, ResumenSaldoCliente } from '@/lib/clientBalance';
import {
  formatUSD,
  formatBs,
  calcularConversionBs,
  sanitizeDecimalInput,
  handleDecimalKeyDown,
} from '@/lib/utils';
import { ModernClientSelect } from '@/components/ModernClientSelect';
import { refrescarNotificacionesGlobales } from '@/components/NotificationsContext';
import { useModalDragScroll } from '@/lib/useModalDragScroll';
import { ejecutarMiniRecarga } from '@/lib/syncUtils';

interface AbonoModalProps {
  abierto: boolean;
  onCerrar: () => void;
  clientes: Cliente[];
  saldosClientes: Record<string, ResumenSaldoCliente>;
  tasaBcv: number;
  clientePreseleccionado?: Cliente | null;
  onAbonoExitoso?: (mensaje: string) => void;
}

export function AbonoModal({
  abierto,
  onCerrar,
  clientes,
  saldosClientes,
  tasaBcv,
  clientePreseleccionado = null,
  onAbonoExitoso,
}: AbonoModalProps) {
  const [modalAbono, setModalAbono] = useState<{
    cliente: Cliente | null;
    montoBs: string;
    montoUsd: string;
    metodoPago: string;
    numeroReferencia: string;
    guardando: boolean;
    error: string | null;
  }>({
    cliente: clientePreseleccionado,
    montoBs: '',
    montoUsd: '',
    metodoPago: 'efectivo_usd',
    numeroReferencia: '',
    guardando: false,
    error: null,
  });

  // Al abrirse, sincronizar cliente si viene preseleccionado o resetear
  useEffect(() => {
    if (abierto) {
      setModalAbono({
        cliente: clientePreseleccionado,
        montoBs: '',
        montoUsd: '',
        metodoPago: 'efectivo_usd',
        numeroReferencia: '',
        guardando: false,
        error: null,
      });
    }
  }, [abierto, clientePreseleccionado]);

  const dragScrollAbono = useModalDragScroll({
    isOpen: abierto,
    onDismiss: onCerrar,
  });

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

      onCerrar();
      if (onAbonoExitoso) {
        onAbonoExitoso(res.mensaje);
      }
      ejecutarMiniRecarga();
    } catch (err: unknown) {
      console.error('Error registrando abono:', err);
      setModalAbono((prev) => ({
        ...prev,
        guardando: false,
        error: err instanceof Error ? err.message : 'Error al registrar el abono.',
      }));
    }
  };

  return (
    <Dialog.Root open={abierto} onOpenChange={(ab) => !ab && onCerrar()}>
      <Dialog.Portal>
        <Dialog.Overlay
          {...dragScrollAbono.overlayProps}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
        />
        <Dialog.Content
          style={dragScrollAbono.style}
          {...dragScrollAbono.dragProps}
          className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain touch-scroll-ios rounded-t-3xl sm:rounded-3xl border-t sm:border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-4 sm:p-6 pb-28 sm:pb-6 shadow-2xl outline-none duration-300 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in-0 sm:zoom-in-95 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[95vw] sm:max-w-lg cursor-grab active:cursor-grabbing text-slate-900 dark:text-slate-100"
        >
          {/* Manija táctil móvil */}
          <div
            className="mx-auto mb-3 -mt-1 flex h-6 w-full cursor-grab active:cursor-grabbing items-center justify-center sm:hidden touch-none"
            title="Deslizar hacia abajo para cerrar"
          >
            <div className="h-1.5 w-12 rounded-full bg-gray-300 dark:bg-slate-700 active:bg-gray-400 transition-colors" />
          </div>

          <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                <PiggyBank className="h-5 w-5" />
              </div>
              <div>
                <Dialog.Title className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                  Abono / Saldo a Favor
                </Dialog.Title>
                <Dialog.Description className="text-xs text-gray-500 dark:text-slate-400">
                  Liquidación de deuda prioritaria y depósito de saldo a favor
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                disabled={modalAbono.guardando}
                className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-200 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {modalAbono.error && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-950/50 dark:border-rose-900 p-3 text-xs text-rose-700 dark:text-rose-300">
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
                clientes={clientes}
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
                    placeholder="Ej: 123456 o últimos dígitos"
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
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-slate-800">
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={modalAbono.guardando}
                  className="rounded-xl border border-gray-200 dark:border-slate-800 px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
              </Dialog.Close>

              <button
                type="submit"
                disabled={modalAbono.guardando || !(parseFloat(modalAbono.montoUsd.replace(',', '.')) > 0)}
                className="flex items-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition disabled:opacity-50"
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
  );
}
