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
  Wallet,
  PiggyBank,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Cliente, ItemCarrito, MetodoPagoId, MetodoPagoOpcion } from '@/types/pos';
import { supabase } from '@/lib/supabaseClient';
import { formatUSD, formatBs, calcularConversionBs } from '@/lib/utils';
import { useModalDragScroll } from '@/lib/useModalDragScroll';
import { obtenerSaldoCliente, procesarAbonoCliente, ResumenSaldoCliente } from '@/lib/clientBalance';

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
    id: 'saldo_favor',
    nombre: 'Usar Saldo a Favor',
    descripcion: 'Cobrar usando crédito a favor del cliente',
    moneda: 'USD',
    icono: 'wallet',
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

  // Estado del saldo del cliente
  const [saldoInfo, setSaldoInfo] = useState<ResumenSaldoCliente | null>(null);
  const [cargandoSaldo, setCargandoSaldo] = useState(false);

  // Pago mixto: si el saldo a favor no alcanza el total de la orden
  const [subMetodoDiferencia, setSubMetodoDiferencia] = useState<'efectivo_usd' | 'pago_movil' | 'punto_debito'>('efectivo_usd');

  // Calculadora de vuelto / cambio recibido
  const [montoEntregadoInput, setMontoEntregadoInput] = useState<string>('');
  const [guardarVueltoComoSaldo, setGuardarVueltoComoSaldo] = useState<boolean>(false);
  const [vueltoAcreditadoExito, setVueltoAcreditadoExito] = useState<number | null>(null);

  // Deslizamiento vertical y arrastre (drag-to-scroll) para móviles y emuladores con Body Scroll Lock
  const dragScrollPago = useModalDragScroll({
    isOpen: abierto,
    onDismiss: () => handleCerrar(false),
  });

  const totalUsd = items.reduce(
    (sum, item) => sum + item.producto.precio_usd * item.cantidad,
    0
  );
  const totalBs = calcularConversionBs(totalUsd, tasaBcv);

  // Cargar saldo del cliente al abrir o cambiar de cliente
  useEffect(() => {
    if (abierto && cliente?.id) {
      setCargandoSaldo(true);
      obtenerSaldoCliente(cliente.id)
        .then((s) => setSaldoInfo(s))
        .catch((e) => console.error('Error cargando saldo cliente:', e))
        .finally(() => setCargandoSaldo(false));
    } else {
      setSaldoInfo(null);
    }
  }, [abierto, cliente]);

  useEffect(() => {
    if (abierto && metodoInicial) {
      setMetodoSeleccionado(metodoInicial);
    }
  }, [abierto, metodoInicial]);

  // Vuelto calculado
  const montoEntregadoNum = parseFloat(montoEntregadoInput.replace(',', '.')) || 0;
  const vueltoUsd = montoEntregadoNum > totalUsd ? Math.round((montoEntregadoNum - totalUsd) * 100) / 100 : 0;
  const vueltoBs = vueltoUsd > 0 ? calcularConversionBs(vueltoUsd, tasaBcv) : 0;

  // Manejo de confirmación de venta
  const handleConfirmarVenta = async () => {
    if (items.length === 0) return;
    setProcesando(true);
    setErrorMensaje(null);

    const saldoDisponible = saldoInfo?.saldoAFavorTotalUsd || 0;

    // Validación de Saldo a Favor
    if (metodoSeleccionado === 'saldo_favor') {
      if (!cliente) {
        setErrorMensaje('Debes seleccionar un cliente registrado para cobrar con Saldo a Favor.');
        setProcesando(false);
        return;
      }
      if (saldoDisponible <= 0) {
        setErrorMensaje('El cliente no cuenta con saldo a favor disponible ($0.00).');
        setProcesando(false);
        return;
      }
    }

    try {
      let metodoPagoFinal = metodoSeleccionado as string;
      const pagado = metodoSeleccionado !== 'pendiente';

      // Determinar si es pago con saldo total o pago mixto
      if (metodoSeleccionado === 'saldo_favor') {
        if (saldoDisponible >= totalUsd) {
          // Cubre el 100%
          metodoPagoFinal = 'saldo_favor';
        } else {
          // Pago mixto: se usa todo el saldo a favor disponible y la diferencia por el sub-método
          const saldoUsado = saldoDisponible;
          const diferencia = Math.round((totalUsd - saldoUsado) * 100) / 100;
          metodoPagoFinal = `mixto:saldo_favor=${saldoUsado.toFixed(2)},${subMetodoDiferencia}=${diferencia.toFixed(2)}`;
        }
      }

      // 1. Insertar consumo cabecera
      const { data: consumoData, error: consumoError } = await supabase
        .from('consumos')
        .insert({
          cliente_id: cliente ? cliente.id : null,
          monto_total_usd: totalUsd,
          tasa_bcv_historica: tasaBcv,
          metodo_pago: metodoPagoFinal,
          pagado: pagado,
        })
        .select()
        .single();

      if (consumoError || !consumoData) {
        throw new Error(consumoError?.message || 'Error al crear el registro de consumo en Supabase');
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

      // 3. Si se marcó guardar vuelto como saldo a favor del cliente
      if (guardarVueltoComoSaldo && vueltoUsd > 0 && cliente?.id) {
        try {
          await procesarAbonoCliente({
            clienteId: cliente.id,
            montoUsd: vueltoUsd,
            metodoPago: 'vuelto_saldo_favor',
            tasaBcv,
            esVuelto: true,
          });
          setVueltoAcreditadoExito(vueltoUsd);
        } catch (errVuelto) {
          console.error('Error acreditando vuelto como saldo:', errVuelto);
        }
      }

      setConsumoGuardadoId(consumoData.id);
      setExito(true);
      setTimeout(() => {
        onTransaccionExitosa();
      }, 1600);
    } catch (err: unknown) {
      console.error('Error registrando transacción:', err);
      const msg = err instanceof Error ? err.message : 'Error inesperado al conectar con Supabase';
      setErrorMensaje(msg);
    } finally {
      setProcesando(false);
    }
  };

  // Guardar vuelto directo desde la pantalla de éxito si no se había marcado antes
  const handleGuardarVueltoExito = async () => {
    if (!cliente?.id || vueltoUsd <= 0 || vueltoAcreditadoExito !== null) return;
    setProcesando(true);
    try {
      await procesarAbonoCliente({
        clienteId: cliente.id,
        montoUsd: vueltoUsd,
        metodoPago: 'vuelto_saldo_favor',
        tasaBcv,
        esVuelto: true,
      });
      setVueltoAcreditadoExito(vueltoUsd);
    } catch (e) {
      console.error('Error guardando vuelto:', e);
    } finally {
      setProcesando(false);
    }
  };

  const handleCerrar = (open: boolean) => {
    if (procesando) return;
    if (!open) {
      setTimeout(() => {
        setExito(false);
        setErrorMensaje(null);
        setConsumoGuardadoId(null);
        setMontoEntregadoInput('');
        setGuardarVueltoComoSaldo(false);
        setVueltoAcreditadoExito(null);
      }, 300);
    }
    onOpenChange(open);
  };

  const saldoDisponible = saldoInfo?.saldoAFavorTotalUsd || 0;
  const esSaldoSuficiente = saldoDisponible >= totalUsd;
  const esSaldoParcial = saldoDisponible > 0 && saldoDisponible < totalUsd;
  const diferenciaAPagar = Math.max(0, Math.round((totalUsd - saldoDisponible) * 100) / 100);

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
          className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain touch-scroll-ios rounded-t-3xl sm:rounded-3xl border-t sm:border border-gray-200/90 bg-white p-4 sm:p-6 pb-28 sm:pb-6 shadow-2xl outline-none duration-300 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in-0 sm:zoom-in-95 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[95vw] sm:max-w-lg cursor-grab active:cursor-grabbing"
        >
          {/* Manija táctil para deslizar hacia abajo en móviles */}
          <div
            className="mx-auto mb-3 -mt-1 flex h-6 w-full cursor-grab active:cursor-grabbing items-center justify-center sm:hidden touch-none"
            title="Deslizar hacia abajo para cerrar"
          >
            <div className="h-1.5 w-12 rounded-full bg-gray-300 active:bg-gray-400 transition-colors" />
          </div>

          {exito ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
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

              <div className="mt-5 w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 text-left space-y-2">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Monto Total:</span>
                  <span className="font-bold text-gray-900">{formatUSD(totalUsd)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Equivalente Bs. (Tasa {formatBs(tasaBcv)}):</span>
                  <span className="font-mono font-bold text-gray-900">{formatBs(totalBs)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Método de Pago:</span>
                  <span className="font-medium text-gray-900">
                    {metodoSeleccionado === 'saldo_favor'
                      ? esSaldoSuficiente
                        ? 'Saldo a Favor (Total)'
                        : `Pago Mixto (Saldo a Favor $${saldoDisponible.toFixed(2)} + ${subMetodoDiferencia})`
                      : METODOS_PAGO.find((m) => m.id === metodoSeleccionado)?.nombre}
                  </span>
                </div>
                {cliente && (
                  <div className="flex justify-between text-xs text-gray-600 border-t border-gray-200/60 pt-2">
                    <span>Estudiante:</span>
                    <span className="font-medium text-indigo-700">
                      {cliente.nombre_estudiante} ({cliente.grado_seccion || 'General'})
                    </span>
                  </div>
                )}

                {vueltoAcreditadoExito !== null && (
                  <div className="mt-2 rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 flex items-center justify-between text-xs text-emerald-800">
                    <span className="flex items-center gap-1.5 font-bold">
                      <PiggyBank className="h-4 w-4 text-emerald-600" />
                      Vuelto guardado como saldo a favor:
                    </span>
                    <span className="font-black text-emerald-700">
                      +{formatUSD(vueltoAcreditadoExito)}
                    </span>
                  </div>
                )}
              </div>

              {/* Botón rápido para guardar vuelto si sobró y no se guardó automáticamente */}
              {cliente && vueltoUsd > 0 && vueltoAcreditadoExito === null && (
                <div className="mt-4 w-full">
                  <button
                    type="button"
                    onClick={handleGuardarVueltoExito}
                    disabled={procesando}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs py-3 px-4 shadow-sm transition"
                  >
                    <PiggyBank className="h-4 w-4" />
                    <span>Guardar vuelto de {formatUSD(vueltoUsd)} como saldo a favor</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Encabezado del Modal */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <Dialog.Title className="text-lg font-bold text-gray-900">
                    Confirmar Cobro y Registro
                  </Dialog.Title>
                  <Dialog.Description className="text-xs text-gray-500">
                    Elige el método de pago o usa saldo a favor del estudiante.
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

              {/* Alerta de error */}
              {errorMensaje && (
                <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{errorMensaje}</span>
                </div>
              )}

              {/* Resumen del Monto y Cliente */}
              <div className="my-3 rounded-2xl border border-gray-200/70 bg-gradient-to-r from-gray-50 to-slate-50 p-4">
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
                  <span className="flex items-center gap-1.5 font-medium">
                    <User className="h-3.5 w-3.5 text-gray-400" />
                    {cliente ? cliente.nombre_estudiante : 'Venta General (Sin registrar)'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <ShoppingBag className="h-3.5 w-3.5 text-gray-400" />
                    {items.reduce((acc, i) => acc + i.cantidad, 0)} artículos
                  </span>
                </div>

                {/* Banner de Saldo a Favor si el cliente tiene crédito positivo */}
                {cliente && saldoInfo && (
                  <div className="mt-2.5 flex items-center justify-between rounded-xl bg-white p-2 border border-gray-100 shadow-2xs text-xs">
                    <span className="text-gray-500 flex items-center gap-1">
                      <Wallet className="h-3.5 w-3.5 text-emerald-600" />
                      Estado de cuenta del cliente:
                    </span>
                    {saldoInfo.saldoAFavorTotalUsd > 0 ? (
                      <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                        +{formatUSD(saldoInfo.saldoAFavorTotalUsd)} disponible
                      </span>
                    ) : saldoInfo.deudaTotalUsd > 0 ? (
                      <span className="font-bold text-rose-700 bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded-full">
                        -{formatUSD(saldoInfo.deudaTotalUsd)} deuda
                      </span>
                    ) : (
                      <span className="font-medium text-gray-600 bg-gray-50 px-2 py-0.5 rounded-full">
                        Solvente ($0.00)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Selector de Métodos de Pago */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700">
                  Selecciona el Método de Pago
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {METODOS_PAGO.map((metodo) => {
                    const seleccionado = metodoSeleccionado === metodo.id;
                    const esSaldo = metodo.id === 'saldo_favor';
                    const deshabilitado = esSaldo && (!cliente || saldoDisponible <= 0);

                    return (
                      <button
                        key={metodo.id}
                        type="button"
                        onClick={() => {
                          if (!deshabilitado) setMetodoSeleccionado(metodo.id);
                        }}
                        disabled={deshabilitado}
                        className={`flex flex-col items-start rounded-2xl border p-3 text-left transition-all relative ${
                          deshabilitado
                            ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50/50'
                            : seleccionado
                            ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/20 shadow-xs'
                            : 'border-gray-200/80 bg-white hover:border-gray-300 hover:bg-gray-50/50'
                        }`}
                      >
                        <div className="flex w-full items-center justify-between mb-1.5">
                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                              seleccionado
                                ? 'bg-indigo-600 text-white'
                                : esSaldo
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {metodo.id === 'efectivo_usd' && <DollarSign className="h-4 w-4" />}
                            {metodo.id === 'pago_movil' && <Smartphone className="h-4 w-4" />}
                            {metodo.id === 'punto_debito' && <CreditCard className="h-4 w-4" />}
                            {metodo.id === 'saldo_favor' && <Wallet className="h-4 w-4" />}
                            {metodo.id === 'pendiente' && <Clock className="h-4 w-4" />}
                          </div>

                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              esSaldo
                                ? 'bg-emerald-100 text-emerald-800'
                                : metodo.moneda === 'USD'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {esSaldo ? 'Crédito' : metodo.moneda}
                          </span>
                        </div>

                        <span className="text-xs font-bold text-gray-900">{metodo.nombre}</span>
                        <span className="mt-0.5 text-[11px] text-gray-500 leading-tight">
                          {esSaldo
                            ? cliente
                              ? saldoDisponible > 0
                                ? `Disponible: +${formatUSD(saldoDisponible)}`
                                : 'Sin saldo a favor'
                              : 'Requiere seleccionar cliente'
                            : metodo.descripcion}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sub-panel si se selecciona Usar Saldo a Favor */}
              {metodoSeleccionado === 'saldo_favor' && cliente && (
                <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-xs text-emerald-900 animate-in fade-in">
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Pago con Saldo a Favor del Estudiante</span>
                  </div>

                  {esSaldoSuficiente ? (
                    <p className="text-emerald-700 text-[11px]">
                      El saldo cubre el 100% de la orden. Se debitarán{' '}
                      <strong>{formatUSD(totalUsd)}</strong>. Saldo restante tras la compra:{' '}
                      <strong>{formatUSD(saldoDisponible - totalUsd)}</strong>.
                    </p>
                  ) : esSaldoParcial ? (
                    <div className="space-y-2 mt-2">
                      <p className="text-amber-800 text-[11px] font-medium bg-amber-50 p-2 rounded-xl border border-amber-200">
                        El saldo ({formatUSD(saldoDisponible)}) no cubre la orden total. Se aplicará un{' '}
                        <strong>Pago Mixto</strong>: se descontarán {formatUSD(saldoDisponible)} y
                        debes cobrar la diferencia de{' '}
                        <strong>{formatUSD(diferenciaAPagar)}</strong> ({formatBs(calcularConversionBs(diferenciaAPagar, tasaBcv))}).
                      </p>

                      <div>
                        <label className="font-bold text-gray-700 block mb-1">
                          ¿Cómo pagará la diferencia ({formatUSD(diferenciaAPagar)})?
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(['efectivo_usd', 'pago_movil', 'punto_debito'] as const).map((sub) => (
                            <button
                              key={sub}
                              type="button"
                              onClick={() => setSubMetodoDiferencia(sub)}
                              className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition ${
                                subMetodoDiferencia === sub
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              {sub === 'efectivo_usd' && 'Efectivo $'}
                              {sub === 'pago_movil' && 'Pago Móvil'}
                              {sub === 'punto_debito' && 'Punto (Bs)'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-rose-700 text-[11px] font-medium">
                      Este cliente no tiene saldo a favor. Selecciona otro método de pago.
                    </p>
                  )}
                </div>
              )}

              {/* Calculadora de Vuelto para Efectivo USD o Pago Móvil */}
              {(metodoSeleccionado === 'efectivo_usd' || metodoSeleccionado === 'pago_movil') && (
                <div className="mt-3 rounded-2xl border border-gray-200/80 bg-gray-50/80 p-3 text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-bold text-gray-700 flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-gray-500" />
                      Calculadora de Vuelto (Opcional):
                    </label>
                    <span className="text-[11px] text-gray-500">
                      Total a pagar: <strong>{formatUSD(totalUsd)}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={montoEntregadoInput}
                      onChange={(e) => setMontoEntregadoInput(e.target.value)}
                      placeholder="Monto entregado en $ (ej: 5.00)"
                      className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none"
                    />
                    {montoEntregadoInput && (
                      <button
                        type="button"
                        onClick={() => setMontoEntregadoInput('')}
                        className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 transition"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Resultado del Vuelto */}
                  {vueltoUsd > 0 && (
                    <div className="mt-2.5 rounded-xl bg-white border border-emerald-200 p-2.5 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-gray-600">Vuelto o cambio:</span>
                        <div className="text-right">
                          <span className="font-black text-emerald-700 text-sm">
                            {formatUSD(vueltoUsd)}
                          </span>
                          <span className="text-[10px] text-gray-500 ml-1.5 font-mono font-bold">
                            ({formatBs(vueltoBs)})
                          </span>
                        </div>
                      </div>

                      {/* Botón interactivo para guardar vuelto como saldo a favor */}
                      {cliente ? (
                        <button
                          type="button"
                          onClick={() => setGuardarVueltoComoSaldo(!guardarVueltoComoSaldo)}
                          className={`w-full flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-bold transition border ${
                            guardarVueltoComoSaldo
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/70'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <PiggyBank className="h-4 w-4 shrink-0" />
                            {guardarVueltoComoSaldo
                              ? '✓ Guardando vuelto como saldo a favor'
                              : `Guardar vuelto (${formatUSD(vueltoUsd)}) como Saldo a Favor`}
                          </span>
                          <span className="text-[10px] uppercase tracking-wider underline">
                            {guardarVueltoComoSaldo ? 'Cancelar' : 'Aplicar'}
                          </span>
                        </button>
                      ) : (
                        <p className="text-[10px] text-gray-500 italic">
                          (Para guardar el vuelto como saldo a favor, selecciona un cliente en la pantalla principal).
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Botón de Confirmación */}
              <div className="mt-5 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 border-t border-gray-100 pt-3">
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
                  disabled={procesando || (metodoSeleccionado === 'saldo_favor' && (!cliente || saldoDisponible <= 0))}
                  className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-gray-900 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-black active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
