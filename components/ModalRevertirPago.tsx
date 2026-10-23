'use client';

import React, { useState, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  RotateCcw,
  AlertTriangle,
  X,
  Loader2,
  Calendar,
  User,
  DollarSign,
  ArrowRight,
  Receipt,
  Package,
} from 'lucide-react';
import { formatUSD, formatBs, calcularConversionBs } from '@/lib/utils';
import { useModalDragScroll } from '@/lib/useModalDragScroll';
import {
  parseConsumoAudit,
  obtenerMontoPagadoConsumo,
  revertirPagoConsumo,
  ResultadoReversionPago,
} from '@/lib/clientBalance';

export interface ModalRevertirPagoProps {
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
  onExito?: (resultado: ResultadoReversionPago) => void;
}

export function ModalRevertirPago({
  abierto,
  onOpenChange,
  consumo,
  cliente,
  tasaBcv,
  onExito,
}: ModalRevertirPagoProps) {
  const [procesando, setProcesando] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [motivo, setMotivo] = useState<string>('');

  const dragScroll = useModalDragScroll({
    isOpen: abierto,
    onDismiss: () => !procesando && onOpenChange(false),
  });

  const montoTotalUsd = Number(consumo?.monto_total_usd || 0);
  const tasa = Number(consumo?.tasa_bcv_historica || tasaBcv || 1);

  const audit = useMemo(() => {
    if (!consumo) return null;
    return parseConsumoAudit({
      metodo_pago: consumo.metodo_pago,
      pagado: consumo.pagado,
      monto_total_usd: montoTotalUsd,
    });
  }, [consumo, montoTotalUsd]);

  const montoPagadoUsd = useMemo(() => {
    if (!consumo) return 0;
    return obtenerMontoPagadoConsumo(consumo);
  }, [consumo]);

  // Monto que se sumará de vuelta como deuda
  const montoARevertirUsd = montoPagadoUsd > 0 ? montoPagadoUsd : montoTotalUsd;
  const montoARevertirBs = calcularConversionBs(montoARevertirUsd, tasa);

  // Estimación del nuevo saldo del cliente
  const saldoActual = cliente?.saldo !== undefined && cliente?.saldo !== null
    ? Number(cliente.saldo)
    : (consumo?.clientes?.saldo !== undefined ? Number(consumo.clientes.saldo) : 0);
  const nuevoSaldoEstimado = Math.round((saldoActual - montoARevertirUsd) * 100) / 100;

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

  const handleConfirmarReversion = async () => {
    if (!consumo?.id) return;
    setProcesando(true);
    setError(null);

    try {
      const res = await revertirPagoConsumo({
        consumoId: consumo.id,
        motivo: motivo.trim() || undefined,
      });

      if (onExito) {
        onExito(res);
      }
      onOpenChange(false);
    } catch (err: unknown) {
      console.error('Error al revertir pago:', err);
      const msg = err instanceof Error ? err.message : 'Error inesperado al revertir el pago.';
      setError(msg);
    } finally {
      setProcesando(false);
    }
  };

  if (!consumo) return null;

  const nombreEstudiante =
    cliente?.nombre_estudiante || consumo.clientes?.nombre_estudiante || 'Cliente Cantina';
  const gradoSeccion =
    cliente?.grado_seccion || consumo.clientes?.grado_seccion;

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
          <div className="flex items-start gap-3 mb-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-400">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-bold text-gray-900 dark:text-slate-100">
                ¿Deseas devolver esta cuenta a estado Pendiente?
              </Dialog.Title>
              <Dialog.Description className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Esta acción desmarcará el pago registrado y sumará el saldo adeudado de vuelta a la ficha del cliente en tiempo real.
              </Dialog.Description>
            </div>
            <button
              type="button"
              disabled={procesando}
              onClick={() => onOpenChange(false)}
              className="rounded-xl p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition"
              aria-label="Cerrar modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 text-xs">
            {/* Banner Cliente y Cuenta Corriente */}
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-[#111726] p-3.5">
              <div className="min-w-0 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 shrink-0">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-gray-900 dark:text-slate-100 text-xs truncate block">
                    {nombreEstudiante}
                  </span>
                  {gradoSeccion && (
                    <span className="text-[11px] text-gray-500 dark:text-slate-400 font-medium block">
                      {gradoSeccion}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                  Saldo Actual:
                </span>
                {saldoActual < 0 ? (
                  <span className="font-mono font-bold text-amber-700 dark:text-amber-400 text-xs">
                    Deudor -{formatUSD(Math.abs(saldoActual))}
                  </span>
                ) : saldoActual > 0 ? (
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-xs">
                    +{formatUSD(saldoActual)} a favor
                  </span>
                ) : (
                  <span className="font-mono font-bold text-gray-700 dark:text-slate-300 text-xs">
                    $0.00 (Solvente)
                  </span>
                )}
              </div>
            </div>

            {/* Detalles del Ticket a Revertir */}
            <div className="rounded-2xl border border-gray-200/80 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-gray-500 dark:text-slate-400 text-[11px]">
                <span className="flex items-center gap-1 font-semibold text-gray-700 dark:text-slate-300">
                  <Receipt className="h-3.5 w-3.5 text-indigo-600" />
                  Ticket #{consumo.id.slice(0, 8)}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {fechaTxt}
                </span>
              </div>

              {/* Artículos comprados si están presentes */}
              {consumo.consumo_detalles && consumo.consumo_detalles.length > 0 && (
                <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                    Productos del consumo:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {consumo.consumo_detalles.map((det: any, idx: number) => (
                      <span
                        key={det.id || idx}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-[#141C2E] px-2 py-0.5 text-[11px] text-gray-700 dark:text-slate-200"
                      >
                        <span className="font-bold">{det.cantidad}x</span>
                        <span className="truncate max-w-[140px]">
                          {det.productos?.nombre || 'Producto'}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Método de pago previo */}
              <div className="pt-2 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                <span className="text-gray-500 dark:text-slate-400">Método registrado:</span>
                <span className="font-semibold text-gray-800 dark:text-slate-200">
                  {audit?.nombreLegible || 'Pagado'}
                  {audit?.referencia ? ` (Ref: ${audit.referencia})` : ''}
                </span>
              </div>
            </div>

            {/* Tarjeta de Impacto Contable y Reversión */}
            <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-gradient-to-br from-amber-50/70 to-orange-50/40 dark:from-amber-950/30 dark:to-orange-950/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 block">
                    Monto que volverá a adeudarse:
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-black text-amber-900 dark:text-amber-200 font-mono">
                      {formatUSD(montoARevertirUsd)}
                    </span>
                    <span className="text-xs font-semibold text-amber-800/80 dark:text-amber-400 font-mono">
                      ({formatBs(montoARevertirBs)})
                    </span>
                  </div>
                </div>
                <div className="rounded-full bg-amber-100 dark:bg-amber-900/60 border border-amber-200 dark:border-amber-800 px-2.5 py-1 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                  Por Cobrar
                </div>
              </div>

              {/* Comparación Saldo Anterior vs Nuevo Saldo */}
              <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/50 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-amber-800/70 dark:text-amber-400/80 block">
                    Saldo previo ficha:
                  </span>
                  <span className="font-mono font-bold text-gray-800 dark:text-slate-200">
                    {formatUSD(saldoActual)}
                  </span>
                </div>

                <ArrowRight className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />

                <div className="text-right">
                  <span className="text-[10px] text-amber-800/70 dark:text-amber-400/80 block">
                    Nuevo saldo deudor:
                  </span>
                  <span className="font-mono font-bold text-rose-700 dark:text-rose-400">
                    {nuevoSaldoEstimado < 0
                      ? `-${formatUSD(Math.abs(nuevoSaldoEstimado))} (Deudor)`
                      : formatUSD(nuevoSaldoEstimado)}
                  </span>
                </div>
              </div>
            </div>

            {/* Mensaje de advertencia amigable */}
            <div className="flex items-start gap-2 rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-950/30 p-3 text-[11px] text-blue-800 dark:text-blue-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
              <span>
                El consumo mantendrá su fecha e ítems originales intactos. El método de pago y número de comprobante serán restablecidos a <strong>&quot;Por Cobrar / Pendiente&quot;</strong>.
              </span>
            </div>

            {/* Campo opcional de motivo */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 mb-1">
                Motivo / Justificación (Opcional):
              </label>
              <input
                type="text"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: Pago registrado a alumno incorrecto, anulación de comprobante..."
                disabled={procesando}
                className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#111726] px-3 py-2 text-xs text-gray-900 dark:text-slate-100 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-900/50 transition"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-800 dark:text-rose-300 font-medium">
                {error}
              </div>
            )}

            {/* Botones de Acción */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={procesando}
                onClick={() => onOpenChange(false)}
                className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#111726] px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition active:scale-95 disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={procesando}
                onClick={handleConfirmarReversion}
                className="flex items-center gap-1.5 rounded-2xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-amber-700 transition active:scale-95 disabled:opacity-50"
              >
                {procesando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Revirtiendo...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    <span>Sí, devolver a Pendiente</span>
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
