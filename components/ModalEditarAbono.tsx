'use client';

import React, { useState, useEffect, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Coins,
  DollarSign,
  Banknote,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  User,
  Calendar,
  Wallet,
} from 'lucide-react';
import { formatUSD, formatBs, calcularConversionBs, sanitizeDecimalInput, handleDecimalKeyDown } from '@/lib/utils';
import { useModalDragScroll } from '@/lib/useModalDragScroll';
import {
  parseConsumoAudit,
  obtenerMontoPagadoConsumo,
  obtenerSaldoPendienteConsumo,
  editarAbonoConsumo,
  ResultadoEdicionAbono,
} from '@/lib/clientBalance';

export interface ModalEditarAbonoProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  consumo: any | null;
  cliente?: {
    id: string;
    nombre_estudiante: string;
    grado_seccion?: string | null;
    saldo?: number;
  } | null;
  tasaBcv: number;
  onExito?: (resultado: ResultadoEdicionAbono) => void;
}

export function ModalEditarAbono({
  abierto,
  onOpenChange,
  consumo,
  cliente,
  tasaBcv,
  onExito,
}: ModalEditarAbonoProps) {
  const [montoInput, setMontoInput] = useState<string>('');
  const [moneda, setMoneda] = useState<'USD' | 'Bs'>('USD');
  const [procesando, setProcesando] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const dragScroll = useModalDragScroll({
    isOpen: abierto,
    onDismiss: () => !procesando && onOpenChange(false),
  });

  const montoTotalUsd = Number(consumo?.monto_total_usd || 0);
  const tasa = Number(consumo?.tasa_bcv_historica || tasaBcv || 1);

  // Inicializar el valor actual del abono al abrir el modal
  useEffect(() => {
    if (abierto && consumo) {
      const abonadoActual = obtenerMontoPagadoConsumo(consumo);
      setMontoInput(abonadoActual > 0 ? abonadoActual.toFixed(2) : '0.00');
      setMoneda('USD');
      setError(null);
      setProcesando(false);
    }
  }, [abierto, consumo]);

  const auditOriginal = useMemo(() => {
    if (!consumo) return null;
    return parseConsumoAudit({
      metodo_pago: consumo.metodo_pago,
      pagado: consumo.pagado,
      monto_total_usd: montoTotalUsd,
    });
  }, [consumo, montoTotalUsd]);

  const abonadoAnteriorUsd = useMemo(() => {
    if (!consumo) return 0;
    return obtenerMontoPagadoConsumo(consumo);
  }, [consumo]);

  const saldoPendienteAnteriorUsd = useMemo(() => {
    if (!consumo) return 0;
    return obtenerSaldoPendienteConsumo(consumo);
  }, [consumo]);

  // Cálculos en tiempo real según el input ingresado
  const { nuevoAbonadoUsd, nuevoSaldoPendienteUsd, deltaDeuda, nuevoSaldoClienteEstimado } = useMemo(() => {
    const num = parseFloat(montoInput.replace(',', '.')) || 0;
    const abonadoUsd = moneda === 'USD'
      ? num
      : (num > 0 && tasa > 0 ? Math.round((num / tasa) * 100) / 100 : 0);

    const abonadoClamped = Math.max(0, Math.min(montoTotalUsd, Math.round(abonadoUsd * 100) / 100));
    const pendiente = Math.max(0, Math.round((montoTotalUsd - abonadoClamped) * 100) / 100);

    const deudaAnterior = saldoPendienteAnteriorUsd;
    const deudaNueva = pendiente;
    const delta = Math.round((deudaNueva - deudaAnterior) * 100) / 100;

    let nuevoSaldoEst: number | undefined = undefined;
    if (cliente?.saldo !== undefined && cliente?.saldo !== null) {
      nuevoSaldoEst = Math.round((Number(cliente.saldo) - delta) * 100) / 100;
    }

    return {
      nuevoAbonadoUsd: abonadoClamped,
      nuevoSaldoPendienteUsd: pendiente,
      deltaDeuda: delta,
      nuevoSaldoClienteEstimado: nuevoSaldoEst,
    };
  }, [montoInput, moneda, tasa, montoTotalUsd, saldoPendienteAnteriorUsd, cliente?.saldo]);

  const fechaTxt = useMemo(() => {
    if (!consumo?.fecha) return 'Fecha no registrada';
    try {
      return new Date(consumo.fecha).toLocaleDateString('es-VE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(consumo.fecha);
    }
  }, [consumo?.fecha]);

  const handleGuardar = async () => {
    if (!consumo?.id) return;
    setProcesando(true);
    setError(null);

    try {
      const res = await editarAbonoConsumo({
        consumoId: consumo.id,
        nuevoMontoAbonadoUsd: nuevoAbonadoUsd,
      });

      if (onExito) {
        onExito(res);
      }
      onOpenChange(false);
    } catch (err: unknown) {
      console.error('Error al editar abono:', err);
      const msg = err instanceof Error ? err.message : 'Error inesperado al actualizar el abono.';
      setError(msg);
    } finally {
      setProcesando(false);
    }
  };

  if (!consumo) return null;

  return (
    <Dialog.Root open={abierto} onOpenChange={(open) => !procesando && onOpenChange(open)}>
      <Dialog.Portal>
        <Dialog.Overlay
          {...dragScroll.overlayProps}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in"
        />
        <Dialog.Content
          style={dragScroll.style}
          {...dragScroll.dragProps}
          className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto overscroll-contain touch-scroll-ios rounded-t-3xl sm:rounded-3xl border-t sm:border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-4 sm:p-6 pb-28 sm:pb-6 shadow-2xl outline-none duration-300 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in-0 sm:zoom-in-95 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[95vw] sm:max-w-lg cursor-grab active:cursor-grabbing"
        >
          {/* Manija táctil móvil */}
          <div className="mx-auto mb-3 -mt-1 flex h-6 w-full cursor-grab active:cursor-grabbing items-center justify-center sm:hidden touch-none">
            <div className="h-1.5 w-12 rounded-full bg-gray-300 dark:bg-slate-700" />
          </div>

          {/* Encabezado */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400">
              <Coins className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <Dialog.Title className="text-base font-bold text-gray-900 dark:text-slate-100">
                Editar / Revertir Abono
              </Dialog.Title>
              <Dialog.Description className="text-xs text-gray-500 dark:text-slate-400 truncate">
                Ticket #{consumo.id.slice(0, 8)} • {fechaTxt}
              </Dialog.Description>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            {/* Banner Cliente */}
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-[#111726] p-3">
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                  Cliente / Cuenta:
                </span>
                <span className="font-bold text-gray-900 dark:text-slate-100 text-xs truncate block">
                  {cliente?.nombre_estudiante || consumo.clientes?.nombre_estudiante || 'Venta en Caja'}
                </span>
                {(cliente?.grado_seccion || consumo.clientes?.grado_seccion) && (
                  <span className="text-[10px] text-gray-500 font-medium">
                    {cliente?.grado_seccion || consumo.clientes?.grado_seccion}
                  </span>
                )}
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                  Saldo Actual Ficha:
                </span>
                {cliente?.saldo !== undefined ? (
                  Number(cliente.saldo) < 0 ? (
                    <span className="font-mono font-bold text-amber-700 dark:text-amber-400 text-xs">
                      Deudor -{formatUSD(Math.abs(Number(cliente.saldo)))}
                    </span>
                  ) : Number(cliente.saldo) > 0 ? (
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-xs">
                      +{formatUSD(Number(cliente.saldo))} a favor
                    </span>
                  ) : (
                    <span className="font-mono font-bold text-gray-600 dark:text-slate-300 text-xs">
                      Solvente ($0.00)
                    </span>
                  )
                ) : (
                  <span className="text-gray-400 text-[10px]">Sin registro</span>
                )}
              </div>
            </div>

            {/* Resumen del Consumo Original */}
            <div className="rounded-2xl border border-indigo-100 dark:border-indigo-950/60 bg-indigo-50/30 dark:bg-indigo-950/20 p-3 space-y-1.5">
              <div className="flex justify-between items-center text-gray-600 dark:text-slate-300">
                <span className="font-medium">Total de la Orden:</span>
                <span className="font-mono font-bold text-gray-900 dark:text-slate-100 text-sm">
                  {formatUSD(montoTotalUsd)}{' '}
                  <span className="text-[10px] text-gray-400 font-normal">
                    ({formatBs(calcularConversionBs(montoTotalUsd, tasa))})
                  </span>
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-500 text-[11px] border-t border-indigo-100/60 dark:border-indigo-900/40 pt-1.5">
                <span>Abono actualmente registrado:</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                  {formatUSD(abonadoAnteriorUsd)}
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-500 text-[11px]">
                <span>Saldo pendiente actual:</span>
                <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                  {formatUSD(saldoPendienteAnteriorUsd)}
                </span>
              </div>
            </div>

            {/* Input y Selector de Moneda */}
            <div className="rounded-2xl border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-[#111726] p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Wallet className="h-4 w-4 text-indigo-600" />
                  <span>Nuevo Monto Abonado:</span>
                </label>
                <div className="flex items-center bg-gray-100 dark:bg-slate-800 rounded-lg p-0.5 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setMoneda('USD')}
                    className={`px-2 py-0.5 rounded-md transition ${
                      moneda === 'USD'
                        ? 'bg-white dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 shadow-2xs'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    💵 USD
                  </button>
                  <button
                    type="button"
                    onClick={() => setMoneda('Bs')}
                    className={`px-2 py-0.5 rounded-md transition ${
                      moneda === 'Bs'
                        ? 'bg-white dark:bg-amber-950 text-amber-800 dark:text-amber-300 shadow-2xs'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    🇻🇪 Bs.
                  </button>
                </div>
              </div>

              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                  {moneda === 'USD' ? '$' : 'Bs.'}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={montoInput}
                  onKeyDown={(e) => handleDecimalKeyDown(e, montoInput)}
                  onChange={(e) => setMontoInput(sanitizeDecimalInput(e.target.value))}
                  placeholder={
                    moneda === 'USD'
                      ? `Monto abonado en $ (Total: ${formatUSD(montoTotalUsd)})`
                      : `Monto abonado en Bs.`
                  }
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#0D111A] py-2.5 pl-9 pr-8 text-sm font-mono font-bold text-gray-900 dark:text-slate-100 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none"
                />
                {montoInput && (
                  <button
                    type="button"
                    onClick={() => setMontoInput('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 hover:text-gray-600 transition"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Botones de acción rápida: Poner en $0.00 / Pagar Total */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMoneda('USD');
                    setMontoInput('0.00');
                  }}
                  className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 px-2 py-1.5 text-[11px] font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition active:scale-95"
                  title="Revertir abono a $0.00 (dejar el 100% como deuda)"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Poner en $0.00 (Sin abono)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMoneda('USD');
                    setMontoInput(montoTotalUsd.toFixed(2));
                  }}
                  className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 px-2 py-1.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 transition active:scale-95"
                  title="Marcar como 100% pagado"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Pagar Total ({formatUSD(montoTotalUsd)})</span>
                </button>
              </div>
            </div>

            {/* Tarjeta de Recálculo en Tiempo Real del Saldo Pendiente y Ficha */}
            <div className="rounded-2xl border border-gray-200/90 dark:border-slate-800 bg-gray-50/80 dark:bg-[#111726] p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-600 dark:text-slate-300">
                  Nuevo Saldo Pendiente (Deuda restante):
                </span>
                <span className="font-mono font-black text-sm text-gray-900 dark:text-slate-100">
                  {formatUSD(nuevoSaldoPendienteUsd)}{' '}
                  <span className="text-[10px] text-gray-400 font-normal">
                    ({formatBs(calcularConversionBs(nuevoSaldoPendienteUsd, tasa))})
                  </span>
                </span>
              </div>

              {/* Insignia de Estado Resultante */}
              <div className="flex items-center justify-between border-t border-gray-200/60 dark:border-slate-800 pt-2 text-[11px]">
                <span className="text-gray-500 font-medium">Estado resultante:</span>
                {nuevoSaldoPendienteUsd === 0 ? (
                  <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold px-2 py-0.5 text-[10px] uppercase">
                    ✓ Pagado Total
                  </span>
                ) : nuevoAbonadoUsd === 0 ? (
                  <span className="rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold px-2 py-0.5 text-[10px] uppercase">
                    ⚠️ Pendiente / Por Cobrar ({formatUSD(montoTotalUsd)})
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold px-2 py-0.5 text-[10px] uppercase">
                    Parcial (Abona {formatUSD(nuevoAbonadoUsd)} • Debe {formatUSD(nuevoSaldoPendienteUsd)})
                  </span>
                )}
              </div>

              {/* Impacto en la cuenta del cliente */}
              {cliente && deltaDeuda !== 0 && (
                <div
                  className={`rounded-xl p-2.5 text-[11px] leading-relaxed border ${
                    deltaDeuda > 0
                      ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200/70 dark:border-amber-900/50 text-amber-900 dark:text-amber-200'
                      : 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200/70 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200'
                  }`}
                >
                  {deltaDeuda > 0 ? (
                    <p>
                      ⚠️ <strong>Aumento de deuda:</strong> Al disminuir el abono en{' '}
                      <strong>{formatUSD(deltaDeuda)}</strong>, el saldo deudor de{' '}
                      <strong>{cliente.nombre_estudiante}</strong> aumentará.
                      {nuevoSaldoClienteEstimado !== undefined && (
                        <span>
                          {' '}
                          Nuevo saldo proyectado:{' '}
                          <strong className="font-mono">
                            {nuevoSaldoClienteEstimado < 0
                              ? `-${formatUSD(Math.abs(nuevoSaldoClienteEstimado))}`
                              : formatUSD(nuevoSaldoClienteEstimado)}
                          </strong>
                          .
                        </span>
                      )}
                    </p>
                  ) : (
                    <p>
                      ✓ <strong>Disminución de deuda:</strong> Al aumentar el abono en{' '}
                      <strong>{formatUSD(Math.abs(deltaDeuda))}</strong>, el saldo adeudado de{' '}
                      <strong>{cliente.nombre_estudiante}</strong> se reducirá.
                      {nuevoSaldoClienteEstimado !== undefined && (
                        <span>
                          {' '}
                          Nuevo saldo proyectado:{' '}
                          <strong className="font-mono">
                            {nuevoSaldoClienteEstimado < 0
                              ? `-${formatUSD(Math.abs(nuevoSaldoClienteEstimado))}`
                              : formatUSD(nuevoSaldoClienteEstimado)}
                          </strong>
                          .
                        </span>
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800 font-medium">
                {error}
              </div>
            )}

            {/* Acciones del Modal */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                disabled={procesando}
                onClick={() => onOpenChange(false)}
                className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#111726] px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 transition"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={procesando}
                onClick={handleGuardar}
                className={`flex items-center gap-1.5 rounded-2xl px-5 py-2.5 text-xs font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-50 ${
                  nuevoSaldoPendienteUsd > 0
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {procesando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Guardando abono...</span>
                  </>
                ) : nuevoSaldoPendienteUsd === 0 ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Guardar como Pagado Total</span>
                  </>
                ) : nuevoAbonadoUsd === 0 ? (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    <span>Revertir Abono (Fía {formatUSD(montoTotalUsd)})</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      Guardar Abono ({formatUSD(nuevoAbonadoUsd)} • Fía {formatUSD(nuevoSaldoPendienteUsd)})
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
