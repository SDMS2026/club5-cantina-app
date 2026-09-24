'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import * as Popover from '@radix-ui/react-popover';
import {
  Bell,
  Truck,
  Users,
  AlertTriangle,
  Clock,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  TrendingUp,
  Receipt,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { useSystemNotifications } from './NotificationsContext';
import { formatUSD, formatBs } from '@/lib/utils';

export function NotificationBell() {
  const { data, cargando, refrescar } = useSystemNotifications();
  const [abierto, setAbierto] = useState<boolean>(false);
  const [tabActiva, setTabActiva] = useState<'todas' | 'proveedores' | 'deudas' | 'novedades'>('todas');
  const [refrescando, setRefrescando] = useState<boolean>(false);

  const handleRefrescar = async () => {
    setRefrescando(true);
    await refrescar();
    setRefrescando(false);
  };

  const hayCriticas = data.proveedores.vencidas > 0;
  const hayProximas = data.proveedores.proximas > 0;
  const hayDeudasAlumnos = data.deudas.clientesConDeuda > 0;
  const totalAlertas =
    data.proveedores.vencidas +
    data.proveedores.proximas +
    (data.deudas.clientesConDeuda > 0 ? data.deudas.clientesConDeuda : 0);

  return (
    <Popover.Root open={abierto} onOpenChange={setAbierto}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200/90 bg-white/95 text-gray-700 shadow-2xs transition hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600 active:scale-95"
          title="Centro de notificaciones y alertas"
          aria-label="Notificaciones"
        >
          <Bell className="h-4 w-4" />

          {/* Badge Indicador de Alertas */}
          {!cargando && (
            <>
              {hayCriticas ? (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black text-white shadow-xs animate-pulse ring-2 ring-white">
                  {data.proveedores.vencidas}
                </span>
              ) : hayProximas || hayDeudasAlumnos ? (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-black text-white shadow-xs ring-2 ring-white">
                  {data.proveedores.proximas + (hayDeudasAlumnos ? 1 : 0)}
                </span>
              ) : (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
              )}
            </>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-88 sm:w-96 rounded-3xl border border-gray-200 bg-white p-4 shadow-2xl outline-none backdrop-blur-xl animate-in fade-in-0 zoom-in-95 max-h-[85vh] overflow-y-auto"
        >
          {/* Header del Popover */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 leading-tight">
                  Notificaciones y Alertas
                </h3>
                <p className="text-[11px] text-gray-500">
                  {totalAlertas > 0
                    ? `${totalAlertas} pendientes de cobro y pago`
                    : 'Todas las cuentas están al día'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRefrescar}
              disabled={refrescando}
              title="Refrescar notificaciones"
              className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refrescando ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>

          {/* Selector de Pestañas */}
          <div className="mt-3 flex items-center rounded-2xl border border-gray-200/90 bg-gray-50/70 p-1">
            <button
              type="button"
              onClick={() => setTabActiva('todas')}
              className={`flex-1 rounded-xl py-1 text-center text-xs font-bold transition ${
                tabActiva === 'todas'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setTabActiva('proveedores')}
              className={`flex-1 flex items-center justify-center gap-1 rounded-xl py-1 text-center text-xs font-bold transition ${
                tabActiva === 'proveedores'
                  ? 'bg-white text-indigo-950 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <span>Proveedores</span>
              {data.proveedores.vencidas > 0 && (
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setTabActiva('deudas')}
              className={`flex-1 flex items-center justify-center gap-1 rounded-xl py-1 text-center text-xs font-bold transition ${
                tabActiva === 'deudas'
                  ? 'bg-white text-indigo-950 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <span>Alumnos</span>
              {data.deudas.clientesConDeuda > 0 && (
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setTabActiva('novedades')}
              className={`flex-1 rounded-xl py-1 text-center text-xs font-bold transition ${
                tabActiva === 'novedades'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Novedades
            </button>
          </div>

          {/* Contenido según pestaña */}
          <div className="mt-3 space-y-2.5">
            {/* Sección: Cuentas por Pagar a Proveedores */}
            {(tabActiva === 'todas' || tabActiva === 'proveedores') && (
              <div>
                <div className="flex items-center justify-between px-1 mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Proveedores / Cuentas por Pagar
                  </span>
                  <Link
                    href="/proveedores"
                    onClick={() => setAbierto(false)}
                    className="text-[10px] font-bold text-indigo-600 hover:underline inline-flex items-center gap-0.5"
                  >
                    <span>Ver módulo</span>
                    <ArrowRight className="h-2.5 w-2.5" />
                  </Link>
                </div>

                {data.proveedores.pendientes === 0 ? (
                  <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-3 text-xs flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold text-emerald-950">¡Proveedores al día!</p>
                      <p className="text-emerald-800 text-[11px]">
                        No tienes facturas de mercancía pendientes por liquidar.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {/* Alerta de Vencidas */}
                    {data.proveedores.vencidas > 0 && (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-3 text-xs flex items-start gap-2.5">
                        <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-rose-950">
                              {data.proveedores.vencidas}{' '}
                              {data.proveedores.vencidas === 1 ? 'Factura Vencida' : 'Facturas Vencidas'}
                            </p>
                            <span className="font-mono font-bold text-rose-700">
                              {formatUSD(data.proveedores.totalPendienteUsd)}
                            </span>
                          </div>
                          <p className="text-[11px] text-rose-800 mt-0.5">
                            Equivalente: {formatBs(data.proveedores.totalPendienteBs)} a tasa BCV.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Alerta de Próximas */}
                    {data.proveedores.proximas > 0 && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-xs flex items-start gap-2.5">
                        <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-amber-950">
                            {data.proveedores.proximas} por vencer en ≤ 3 días
                          </p>
                          <p className="text-[11px] text-amber-800 mt-0.5">
                            Revisa el calendario de pagos antes del vencimiento.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Resumen Total */}
                    <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-2.5 text-xs flex items-center justify-between">
                      <span className="text-gray-500 font-medium">
                        Total por Pagar ({data.proveedores.pendientes} facturas):
                      </span>
                      <span className="font-mono font-bold text-gray-900">
                        {formatUSD(data.proveedores.totalPendienteUsd)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sección: Cuentas por Cobrar (Estudiantes / Profesores) */}
            {(tabActiva === 'todas' || tabActiva === 'deudas') && (
              <div className="pt-1">
                <div className="flex items-center justify-between px-1 mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Estudiantes y Profesores / Fiados
                  </span>
                  <Link
                    href="/deudas"
                    onClick={() => setAbierto(false)}
                    className="text-[10px] font-bold text-indigo-600 hover:underline inline-flex items-center gap-0.5"
                  >
                    <span>Ver deudas</span>
                    <ArrowRight className="h-2.5 w-2.5" />
                  </Link>
                </div>

                {data.deudas.clientesConDeuda === 0 ? (
                  <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-3 text-xs flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold text-emerald-950">¡Todos los clientes al día!</p>
                      <p className="text-emerald-800 text-[11px]">
                        No hay consumos escolares pendientes de cobro.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-xs flex items-start gap-2.5">
                      <Receipt className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-amber-950">
                            {data.deudas.clientesConDeuda} clientes con saldo pendiente
                          </p>
                          <span className="font-mono font-bold text-amber-900">
                            {formatUSD(data.deudas.totalDeudaUsd)}
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          Equivalente total: {formatBs(data.deudas.totalDeudaBs)}
                        </p>
                      </div>
                    </div>

                    {/* Lista rápida de los primeros clientes con deuda */}
                    {data.deudas.alertas.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-gray-100 bg-gray-50/60 px-3 py-2 text-xs flex items-center justify-between"
                      >
                        <div className="truncate pr-2">
                          <p className="font-semibold text-gray-800 truncate">{item.titulo}</p>
                          <p className="text-[10px] text-gray-400">{item.descripcion}</p>
                        </div>
                        <span className="font-mono font-bold text-gray-900 shrink-0">
                          {item.montoUsd && formatUSD(item.montoUsd)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Sección: Novedades del Sistema */}
            {(tabActiva === 'todas' || tabActiva === 'novedades') && (
              <div className="pt-1">
                <div className="px-1 mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Novedades &bull; Tasa Oficial BCV
                  </span>
                </div>

                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-indigo-600" />
                    <div>
                      <p className="font-bold text-indigo-950">Tasa Oficial BCV Activa</p>
                      <p className="text-[10px] text-indigo-700/80">Conversión en vivo para la cantina</p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-indigo-900 text-sm">
                    {formatBs(data.tasaBcv)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Footer del Popover */}
          <div className="mt-4 border-t border-gray-100 pt-2.5 flex items-center justify-between text-[11px] text-gray-400">
            <span>Club 5 Cantina Escolar</span>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="text-indigo-600 font-semibold hover:underline"
            >
              Cerrar panel
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
