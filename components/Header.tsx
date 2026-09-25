'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { RefreshCw, TrendingUp, ShieldCheck, Menu } from 'lucide-react';
import { formatBs } from '@/lib/utils';
import { NotificationBell } from './NotificationBell';
import { useSidebar } from './SidebarContext';
import { useTheme } from './ThemeContext';

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
  const { isKirby } = useTheme();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200/80 dark:border-[#1D263A] bg-white/90 dark:bg-[#090D16]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2 sm:px-6 lg:px-8">
        {/* Lado Izquierdo: Botón Hamburguesa (☰) + Identidad Club 5 */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          {/* Botón Hamburguesa: visible en móviles (< md) o en escritorio cuando el sidebar está cerrado (!abierto) */}
          <button
            type="button"
            onClick={toggleSidebar}
            className={`h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl border border-gray-200/90 dark:border-[#1D263A] bg-white dark:bg-[#111726] text-gray-700 dark:text-slate-200 shadow-2xs hover:bg-gray-100 dark:hover:bg-[#141C2E] hover:text-indigo-600 dark:hover:text-indigo-400 transition active:scale-95 ${
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
                  <span
                    className={`transition-colors duration-300 ${
                      isKirby
                        ? 'text-[#C72352] dark:text-pink-300 drop-shadow-[0_1.5px_0_#FFAEC0]'
                        : 'text-[#0E52A0] dark:text-white drop-shadow-[0_1.5px_0_#FACC15] dark:drop-shadow-none'
                    }`}
                  >
                    Club
                  </span>
                  <span
                    className={`relative inline-flex items-center justify-center rounded-md sm:rounded-lg px-1 sm:px-1.5 py-0.2 font-black text-xs sm:text-base shadow-xs -rotate-3 transition-all duration-300 ${
                      isKirby
                        ? 'bg-gradient-to-br from-pink-400 via-rose-400 to-pink-500 text-white ring-1 ring-pink-200'
                        : 'bg-gradient-to-br from-yellow-300 via-amber-400 to-amber-500 text-[#0A3D78] ring-1 ring-yellow-200'
                    }`}
                  >
                    5
                  </span>
                </span>
                <span
                  className={`rounded-full border px-1.5 py-0.2 text-[9px] sm:text-[10px] font-bold shadow-2xs transition-colors duration-300 ${
                    isKirby
                      ? 'border-pink-300 bg-pink-100 dark:bg-pink-950/80 dark:border-pink-800 text-[#8A2548] dark:text-pink-200'
                      : 'border-yellow-300/80 bg-yellow-50 dark:bg-amber-950/80 dark:border-amber-700/60 text-amber-900 dark:text-amber-200'
                  }`}
                >
                  {isKirby ? '★ POS' : 'POS'}
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-gray-500 dark:text-slate-400 hidden sm:block">
                Punto de Venta &bull; Facturación Bimoneda
              </p>
            </div>
          </Link>
        </div>

        {/* Lado Derecho: Campana de Notificaciones + Status */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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
