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
  X,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { useSystemNotifications } from './NotificationsContext';
import { formatUSD, formatBs } from '@/lib/utils';

export function NotificationBell() {
  const { data, cargando, refrescar } = useSystemNotifications();
  const [abierto, setAbierto] = useState<boolean>(false);
  const [tabActiva, setTabActiva] = useState<'todas' | 'deudas' | 'proveedores'>('todas');
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
          className="relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl sm:rounded-2xl border border-gray-200/90 dark:border-slate-800 bg-white/95 dark:bg-[#111726] text-gray-700 dark:text-slate-200 shadow-2xs transition hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-95"
          title="Centro de notificaciones y alertas"
          aria-label="Notificaciones"
        >
          <Bell className="h-4 w-4" />

          {/* Badge Indicador de Alertas */}
          {!cargando && (
            <>
              {hayCriticas ? (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black text-white shadow-xs animate-pulse ring-2 ring-white dark:ring-slate-900">
                  {data.proveedores.vencidas}
                </span>
              ) : hayProximas || hayDeudasAlumnos ? (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-black text-white shadow-xs ring-2 ring-white dark:ring-slate-900">
                  {data.proveedores.proximas + (hayDeudasAlumnos ? 1 : 0)}
                </span>
              ) : (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
              )}
            </>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 w-[calc(100vw-32px)] max-w-[330px] sm:w-[350px] rounded-3xl border border-gray-200/90 dark:border-slate-800 bg-white/95 dark:bg-[#0D111A]/95 p-3.5 shadow-2xl outline-none backdrop-blur-xl animate-in fade-in-0 zoom-in-95 flex flex-col text-gray-900 dark:text-slate-100 max-h-[72vh] sm:max-h-[480px]"
        >
          {/* Header del Popover */}
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/60">
                <Bell className="h-3.5 w-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-gray-900 dark:text-slate-100 leading-tight">
                  Notificaciones y Alertas
                </h3>
                <p className="text-[10px] text-gray-400">
                  {totalAlertas > 0
                    ? `${totalAlertas} pendientes de cobro y pago`
                    : 'Todo solvente y al día'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleRefrescar}
                disabled={refrescando}
                title="Refrescar notificaciones"
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 transition"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refrescando ? 'animate-spin text-indigo-600' : ''}`} />
              </button>
              <Popover.Close asChild>
                <button
                  type="button"
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 transition"
                  title="Cerrar"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </Popover.Close>
            </div>
          </div>

          {/* Selector de Pestañas Compacto */}
          <div className="mt-2.5 flex items-center rounded-xl border border-gray-200/80 dark:border-slate-800 bg-gray-50/80 dark:bg-[#111726] p-0.5 text-xs font-bold shrink-0">
            <button
              type="button"
              onClick={() => setTabActiva('todas')}
              className={`flex-1 rounded-lg py-1 text-center text-[11px] transition ${
                tabActiva === 'todas'
                  ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-slate-200'
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setTabActiva('deudas')}
              className={`flex-1 flex items-center justify-center gap-1 rounded-lg py-1 text-center text-[11px] transition ${
                tabActiva === 'deudas'
                  ? 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-slate-200'
              }`}
            >
              <span>Alumnos</span>
              {data.deudas.clientesConDeuda > 0 && (
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setTabActiva('proveedores')}
              className={`flex-1 flex items-center justify-center gap-1 rounded-lg py-1 text-center text-[11px] transition ${
                tabActiva === 'proveedores'
                  ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-slate-200'
              }`}
            >
              <span>Proveedores</span>
              {data.proveedores.vencidas > 0 ? (
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
              ) : data.proveedores.pendientes > 0 ? (
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
              ) : null}
            </button>
          </div>

          {/* Contenido con Scroll Interno Controlado */}
          <div className="mt-2.5 space-y-2 overflow-y-auto overscroll-contain pr-0.5 flex-1 text-xs">
            {/* Si no hay ninguna alerta */}
            {data.deudas.clientesConDeuda === 0 && data.proveedores.pendientes === 0 ? (
              <div className="rounded-2xl border border-emerald-200/70 dark:border-emerald-950/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 text-center">
                <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-600 dark:text-emerald-400 mb-1.5" />
                <p className="font-bold text-emerald-950 dark:text-emerald-200 text-xs">
                  ¡Cuentas al día!
                </p>
                <p className="text-[11px] text-emerald-800 dark:text-emerald-400/90 mt-0.5">
                  No hay fiados escolares ni facturas pendientes en este momento.
                </p>
              </div>
            ) : null}

            {/* SECCIÓN ALUMNOS / FIADOS (Consolidada: NO LISTA INFINITA) */}
            {(tabActiva === 'todas' || tabActiva === 'deudas') && data.deudas.clientesConDeuda > 0 && (
              <div className="rounded-2xl border border-amber-200/90 dark:border-amber-900/60 bg-gradient-to-br from-amber-50/80 to-amber-50/40 dark:from-amber-950/30 dark:to-[#111726] p-3 space-y-2">
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300">
                      <Receipt className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <span className="font-black text-amber-950 dark:text-amber-200 text-xs block">
                        Cuentas por Cobrar
                      </span>
                      <span className="text-[10px] text-amber-800/80 dark:text-amber-400">
                        {data.deudas.clientesConDeuda} {data.deudas.clientesConDeuda === 1 ? 'alumno con fiado' : 'alumnos con fiados'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-mono font-black text-amber-950 dark:text-amber-200 text-xs block">
                      {formatUSD(data.deudas.totalDeudaUsd)}
                    </span>
                    <span className="font-mono text-[9px] text-amber-700 dark:text-amber-400">
                      {formatBs(data.deudas.totalDeudaBs)}
                    </span>
                  </div>
                </div>

                {/* Vista previa compacta de 2 alumnos máximo (evita lista infinita) */}
                {data.deudas.alertas.length > 0 && (
                  <div className="rounded-xl bg-white/80 dark:bg-[#0D111A]/80 border border-amber-100 dark:border-amber-950/60 p-2 text-[11px] space-y-1">
                    {data.deudas.alertas.slice(0, 2).map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-gray-700 dark:text-slate-300">
                        <span className="truncate pr-2 font-medium">{item.titulo}</span>
                        <span className="font-mono font-bold text-amber-900 dark:text-amber-300 shrink-0">
                          {item.montoUsd && formatUSD(item.montoUsd)}
                        </span>
                      </div>
                    ))}
                    {data.deudas.clientesConDeuda > 2 && (
                      <div className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold pt-0.5 text-center border-t border-amber-100/60 dark:border-amber-950/40">
                        +{data.deudas.clientesConDeuda - 2} alumnos más con saldo pendiente
                      </div>
                    )}
                  </div>
                )}

                {/* Botón directo a Cuentas por Cobrar */}
                <Link
                  href="/deudas"
                  onClick={() => setAbierto(false)}
                  className="flex items-center justify-between rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold py-1.5 px-3 text-[11px] shadow-2xs transition active:scale-95"
                >
                  <span>Ir a Cuentas por Cobrar</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}

            {/* SECCIÓN PROVEEDORES (Consolidada: NO REPETITIVA) */}
            {(tabActiva === 'todas' || tabActiva === 'proveedores') && data.proveedores.pendientes > 0 && (
              <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#111726] p-3 space-y-2">
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                      <Truck className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <span className="font-black text-gray-900 dark:text-slate-100 text-xs block">
                        Cuentas por Pagar
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {data.proveedores.pendientes} {data.proveedores.pendientes === 1 ? 'factura pendiente' : 'facturas pendientes'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-mono font-black text-gray-900 dark:text-slate-100 text-xs block">
                      {formatUSD(data.proveedores.totalPendienteUsd)}
                    </span>
                    <span className="font-mono text-[9px] text-gray-400">
                      {formatBs(data.proveedores.totalPendienteBs)}
                    </span>
                  </div>
                </div>

                {/* Alerta de Vencidas si existen */}
                {data.proveedores.vencidas > 0 && (
                  <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/80 dark:bg-rose-950/40 p-2 text-[11px] flex items-center justify-between text-rose-800 dark:text-rose-300">
                    <span className="flex items-center gap-1 font-bold">
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                      <span>{data.proveedores.vencidas} {data.proveedores.vencidas === 1 ? 'factura vencida' : 'facturas vencidas'}</span>
                    </span>
                    <span className="text-[10px] underline">Atención urgente</span>
                  </div>
                )}

                {/* Alerta de Próximas a vencer si no hay vencidas pero sí próximas */}
                {data.proveedores.vencidas === 0 && data.proveedores.proximas > 0 && (
                  <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/80 dark:bg-amber-950/40 p-2 text-[11px] flex items-center gap-1 text-amber-800 dark:text-amber-300 font-medium">
                    <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <span>{data.proveedores.proximas} por vencer en ≤ 3 días</span>
                  </div>
                )}

                {/* Botón directo a Cuentas por Pagar */}
                <Link
                  href="/proveedores"
                  onClick={() => setAbierto(false)}
                  className="flex items-center justify-between rounded-xl bg-gray-900 dark:bg-slate-800 hover:bg-black text-white font-bold py-1.5 px-3 text-[11px] shadow-2xs transition active:scale-95"
                >
                  <span>Ir a Cuentas por Pagar</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>

          {/* Footer Compacto */}
          <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-gray-400 dark:text-slate-500">
            <span>Club 5 Cantina Escolar</span>
            <span className="font-mono">Tasa BCV: {formatBs(data.tasaBcv)}</span>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
