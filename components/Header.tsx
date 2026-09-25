'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { RefreshCw, TrendingUp, ShieldCheck, Menu } from 'lucide-react';
import { formatBs } from '@/lib/utils';
import { NotificationBell } from './NotificationBell';
import { useSidebar } from './SidebarContext';

interface HeaderProps {
  tasaBcv: number;
  cargandoTasa: boolean;
  onRefrescarTasa: () => void;
  ultimaActualizacion?: Date | null;
}

export function Header({
  tasaBcv,
  cargandoTasa,
  onRefrescarTasa,
  ultimaActualizacion,
}: HeaderProps) {
  const { abierto, toggleSidebar } = useSidebar();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200/80 dark:border-slate-800 bg-white/90 dark:bg-[#0f172a]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2 sm:px-6 lg:px-8">
        {/* Lado Izquierdo: Botón Hamburguesa (☰) + Identidad Club 5 */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          {/* Botón Hamburguesa: visible en móviles (< md) o en escritorio cuando el sidebar está cerrado (!abierto) */}
          <button
            type="button"
            onClick={toggleSidebar}
            className={`h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl border border-gray-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 shadow-2xs hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition active:scale-95 ${
              !abierto ? 'flex' : 'flex md:hidden'
            }`}
            title="Abrir menú de navegación"
            aria-label="Abrir barra lateral"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Logo Oficial Club 5 + Tipografía de Marca */}
          <Link href="/" className="flex items-center gap-1.5 sm:gap-3 group min-w-0">
            <div className="relative flex h-8 w-8 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full overflow-hidden transition-transform group-hover:scale-105">
              <Image
                src="/logo-club5.png"
                alt="Club 5 Cantina Escolar Logo"
                width={44}
                height={44}
                className="h-full w-full object-contain rounded-full"
                priority
              />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <span className="font-[family-name:var(--font-brand)] text-base sm:text-xl font-black tracking-tight inline-flex items-center gap-0.5 sm:gap-1 select-none">
                  <span className="text-[#0E52A0] dark:text-blue-400 drop-shadow-[0_1.5px_0_#FACC15]">
                    Club
                  </span>
                  <span className="relative inline-flex items-center justify-center rounded-md sm:rounded-lg bg-gradient-to-br from-yellow-300 via-amber-400 to-amber-500 px-1 sm:px-1.5 py-0.2 text-[#0A3D78] font-black text-xs sm:text-base shadow-xs ring-1 ring-yellow-200 -rotate-3">
                    5
                  </span>
                </span>
                <span className="rounded-full border border-yellow-300/80 bg-yellow-50 px-1.5 py-0.2 text-[9px] sm:text-[10px] font-bold text-amber-900 shadow-2xs">
                  POS
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-gray-500 dark:text-slate-400 hidden sm:block">
                Punto de Venta &bull; Facturación Bimoneda
              </p>
            </div>
          </Link>
        </div>

        {/* Lado Derecho: Badge de Tasa BCV + Campana de Notificaciones + Status */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Mini Burbuja Tasa BCV en Móviles (< sm) */}
          <button
            type="button"
            onClick={onRefrescarTasa}
            disabled={cargandoTasa}
            title={
              ultimaActualizacion
                ? `Tasa BCV: ${formatBs(tasaBcv)} (Click para actualizar)`
                : 'Actualizar tasa oficial BCV'
            }
            className="flex sm:hidden items-center gap-1 rounded-full border border-amber-200/90 dark:border-amber-900/50 bg-amber-50/90 dark:bg-amber-950/40 px-2 py-1 text-[11px] font-mono font-bold text-amber-900 dark:text-amber-300 shadow-2xs active:scale-95 transition"
          >
            <TrendingUp className="h-3 w-3 text-amber-700 dark:text-amber-400 shrink-0" />
            <span>{tasaBcv > 0 ? formatBs(tasaBcv) : '...'}</span>
            {cargandoTasa && <RefreshCw className="h-2.5 w-2.5 animate-spin text-amber-700 dark:text-amber-400" />}
          </button>

          {/* Badge Tasa BCV Completo en Pantallas Mayores (≥ sm) */}
          <div className="hidden sm:flex items-center gap-2.5 rounded-2xl border border-amber-200/80 dark:border-amber-900/40 bg-gradient-to-r from-amber-50/80 via-orange-50/50 to-yellow-50/70 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-yellow-950/20 px-3.5 py-1.5 shadow-2xs transition hover:border-amber-300 dark:hover:border-amber-700">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/15 dark:bg-amber-500/25 text-amber-700 dark:text-amber-400 shrink-0">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800/80 dark:text-amber-400">
                  Tasa BCV
                </span>
                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900" />
              </div>
              <span
                className="font-mono text-xs sm:text-sm font-bold text-gray-900 dark:text-amber-100 whitespace-nowrap"
                suppressHydrationWarning
              >
                {tasaBcv > 0 ? (
                  <>
                    <span className="hidden md:inline">1 USD = </span>
                    {formatBs(tasaBcv)}
                  </>
                ) : (
                  'Cargando...'
                )}
              </span>
            </div>

            <button
              type="button"
              onClick={onRefrescarTasa}
              disabled={cargandoTasa}
              title={
                ultimaActualizacion
                  ? `Sincronizado: ${ultimaActualizacion.toLocaleTimeString()}`
                  : 'Actualizar tasa oficial BCV'
              }
              className="ml-1 rounded-lg p-1 text-amber-800/70 dark:text-amber-400 hover:bg-amber-100/60 dark:hover:bg-amber-900/40 hover:text-amber-900 dark:hover:text-amber-200 transition disabled:opacity-40"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${cargandoTasa ? 'animate-spin' : ''}`}
              />
            </button>
          </div>

          {/* Botón de Notificaciones Globales */}
          <NotificationBell />

          <div className="hidden md:flex items-center gap-1.5 rounded-xl border border-gray-200/80 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-800/80 px-2.5 py-1 text-xs text-gray-600 dark:text-slate-300">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Supabase Conectado</span>
          </div>
        </div>
      </div>
    </header>
  );
}
