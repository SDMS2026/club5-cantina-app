'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store,
  Receipt,
  Users,
  Package,
  Truck,
  Menu,
  X,
  ShieldCheck,
  ChevronRight,
  PanelLeftClose,
  TrendingUp,
  RefreshCw,
  LogOut,
  Loader2,
  Star,
  Sparkles,
} from 'lucide-react';
import { formatBs } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';
import { useSidebar } from './SidebarContext';
import { useTheme } from './ThemeContext';
import { useSystemNotifications } from './NotificationsContext';
import { iniciarTransicionRuta } from './PageTransitionLoader';

interface NavItem {
  nombre: string;
  href: string;
  icono: React.ElementType;
  descripcion: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    nombre: 'Punto de Venta',
    href: '/',
    icono: Store,
    descripcion: 'Cobro rápido y catálogo',
  },
  {
    nombre: 'Inventario / Productos',
    href: '/productos',
    icono: Package,
    descripcion: 'Catálogo, precios y visibilidad',
  },
  {
    nombre: 'Cuentas por Cobrar',
    href: '/deudas',
    icono: Receipt,
    descripcion: 'Fiados y pagos pendientes',
  },
  {
    nombre: 'Cuentas por Pagar',
    href: '/proveedores',
    icono: Truck,
    descripcion: 'Facturas y proveedores',
  },
  {
    nombre: 'Estudiantes',
    href: '/estudiantes',
    icono: Users,
    descripcion: 'Directorio y representantes',
  },
];

// Variantes de animación de alto rendimiento a 60fps / 120fps nativos
const sidebarVariants = {
  open: {
    x: 0,
    transition: {
      duration: 0.28,
      ease: [0.32, 0.72, 0, 1] as const, // Curva iOS UIKit / Material fluida y elástica
    },
  },
  closed: {
    x: '-100%',
    transition: {
      duration: 0.22,
      ease: [0.32, 0.72, 0, 1] as const,
    },
  },
};

// Variantes dinámicas ultra-ligeras sin forzar re-rasterización (sin scale)
const itemVariants = {
  open: (i: number = 0) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: 0.03 + i * 0.025, // Cascada ágil y reactiva: 30ms, 55ms, 80ms, 105ms...
      duration: 0.2,
      ease: [0.32, 0.72, 0, 1] as const,
    },
  }),
  closed: {
    opacity: 0,
    x: -12,
    transition: {
      duration: 0.1,
      ease: 'easeIn' as const,
    },
  },
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { abierto, setAbierto, toggleSidebar } = useSidebar();
  const { isDark, toggleTheme, isKirby, toggleKirby } = useTheme();
  const { data: notifData, cargando: notifCargando, refrescar } = useSystemNotifications();
  const [cerrandoSesion, setCerrandoSesion] = useState(false);

  const handleCerrarMovil = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setAbierto(false);
    }
  };

  const handleCerrarSesion = async () => {
    try {
      setCerrandoSesion(true);
      iniciarTransicionRuta();
      await supabase.auth.signOut();
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        setAbierto(false);
      }
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    } finally {
      setCerrandoSesion(false);
    }
  };

  return (
    <AnimatePresence>
      {abierto && (
        <motion.aside
          key="app-sidebar"
          variants={sidebarVariants}
          initial="closed"
          animate="open"
          exit="closed"
          style={{ transform: 'translate3d(0,0,0)', WebkitTransform: 'translate3d(0,0,0)' }}
          className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col justify-between overflow-y-auto no-scrollbar border-r border-gray-200/80 dark:border-[#1D263A] bg-white dark:bg-[#090D16] p-5 shadow-2xl dark:shadow-black/60 rounded-r-3xl md:w-64 md:rounded-none md:shadow-xs will-change-transform transform-gpu"
        >
          {/* Parte Superior del Sidebar */}
          <div className="flex flex-col gap-6">
            {/* Header del Sidebar: Logo + Tipografía Efecto Club 5 + Botón Cerrar */}
            <motion.div
              custom={0}
              variants={itemVariants}
              className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-[#1D263A]"
            >
              <Link href="/" onClick={handleCerrarMovil} className="group flex items-center gap-3">
                {/* Logo circular limpio */}
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full overflow-hidden transition-transform duration-300 group-hover:scale-110">
                  <Image
                    src="/logo-club5.png"
                    alt="Club 5 Logo"
                    width={44}
                    height={44}
                    className="h-full w-full object-contain rounded-full"
                    priority
                  />
                </div>

                {/* Tipografía estilizada acorde al logo Club 5 */}
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-[family-name:var(--font-brand)] text-2xl font-black tracking-tight inline-flex items-center gap-1 select-none">
                      <span
                        className={`transition-colors duration-300 ${
                          isKirby
                            ? 'text-[#C72352] dark:text-pink-300 drop-shadow-[0_2px_0_#FFAEC0]'
                            : 'text-[#0E52A0] dark:text-white drop-shadow-[0_2px_0_#FACC15] dark:drop-shadow-none'
                        } transition-transform duration-200 group-hover:scale-105`}
                      >
                        Club
                      </span>
                      <span
                        className={`relative inline-flex items-center justify-center rounded-xl px-2 py-0.5 font-black text-xl shadow-xs -rotate-3 transition-all duration-300 group-hover:rotate-0 ${
                          isKirby
                            ? 'bg-gradient-to-br from-pink-400 via-rose-400 to-pink-500 text-white ring-2 ring-pink-200'
                            : 'bg-gradient-to-br from-yellow-300 via-amber-400 to-amber-500 text-[#0A3D78] ring-2 ring-yellow-200/80'
                        }`}
                      >
                        5
                      </span>
                    </span>
                    <span
                      className={`rounded-full border px-1.5 py-0.2 text-[10px] font-bold shadow-2xs transition-colors duration-300 ${
                        isKirby
                          ? 'border-pink-300 bg-pink-100 dark:bg-pink-950/80 dark:border-pink-800 text-[#8A2548] dark:text-pink-200'
                          : 'border-yellow-300/80 bg-yellow-50 dark:bg-amber-950/80 dark:border-amber-700/60 text-amber-900 dark:text-amber-200'
                      }`}
                    >
                      {isKirby ? '★ POS' : 'POS'}
                    </span>
                  </div>
                  <span
                    className={`font-[family-name:var(--font-brand)] text-[11px] font-bold tracking-wide -mt-0.5 transition-colors duration-300 ${
                      isKirby ? 'text-[#A0284F] dark:text-pink-400' : 'text-amber-700/90 dark:text-amber-400'
                    }`}
                  >
                    Cantina Escolar
                  </span>
                </div>
              </Link>

              {/* Botón para cerrar el Sidebar con animación suave */}
              <button
                type="button"
                onClick={toggleSidebar}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-200 transition active:scale-95"
                title="Cerrar barra lateral"
                aria-label="Cerrar barra lateral"
              >
                <X className="h-5 w-5 md:hidden" />
                <Menu className="h-5 w-5 hidden md:block" />
              </button>
            </motion.div>

            {/* Menú de Navegación */}
            <div className="flex flex-col gap-1.5">
              {/* Etiqueta de Sección con animación */}
              <motion.span
                custom={1}
                variants={itemVariants}
                className="px-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500"
              >
                Menú Principal
              </motion.span>

              {/* Enlaces de Navegación Progresivos con efecto cascada */}
              <nav className="flex flex-col gap-1.5 mt-1">
                {NAV_ITEMS.map((item, index) => {
                  const activo = pathname === item.href;
                  const Icono = item.icono;

                  // Cálculo de Badge dinámico para Cuentas por Pagar y Cuentas por Cobrar
                  let badge: { numero: string; clase: string; titulo: string } | null = null;

                  if (!notifCargando) {
                    if (item.href === '/proveedores') {
                      const { pendientes, vencidas, proximas } = notifData.proveedores;
                      if (pendientes === 0) {
                        badge = {
                          numero: '0',
                          clase: 'bg-emerald-100 text-emerald-800 border-emerald-300/80',
                          titulo: 'Todo pagado: 0 cuentas pendientes a proveedores',
                        };
                      } else if (vencidas > 0) {
                        badge = {
                          numero: String(pendientes),
                          clase: 'bg-rose-100 text-rose-700 border-rose-300 font-bold animate-pulse ring-2 ring-rose-200/50',
                          titulo: `${pendientes} cuenta${pendientes > 1 ? 's' : ''} pendiente${pendientes > 1 ? 's' : ''} (${vencidas} vencida${vencidas > 1 ? 's' : ''})`,
                        };
                      } else if (proximas > 0) {
                        badge = {
                          numero: String(pendientes),
                          clase: 'bg-amber-100 text-amber-800 border-amber-300 font-bold ring-2 ring-amber-200/40',
                          titulo: `${pendientes} cuenta${pendientes > 1 ? 's' : ''} pendiente${pendientes > 1 ? 's' : ''} (${proximas} por vencer en ≤ 3 días)`,
                        };
                      } else {
                        badge = {
                          numero: String(pendientes),
                          clase: 'bg-emerald-100 text-emerald-800 border-emerald-300/80 font-bold',
                          titulo: `${pendientes} cuenta${pendientes > 1 ? 's' : ''} pendiente${pendientes > 1 ? 's' : ''} al día`,
                        };
                      }
                    } else if (item.href === '/deudas') {
                      const { clientesConDeuda, consumosPendientes } = notifData.deudas;
                      if (clientesConDeuda === 0) {
                        badge = {
                          numero: '0',
                          clase: 'bg-emerald-100 text-emerald-800 border-emerald-300/80',
                          titulo: 'Sin deudas: 0 clientes con saldo pendiente',
                        };
                      } else {
                        badge = {
                          numero: String(clientesConDeuda),
                          clase: 'bg-amber-100 text-amber-800 border-amber-300 font-bold',
                          titulo: `${clientesConDeuda} cliente${clientesConDeuda > 1 ? 's' : ''} con fiados pendientes (${consumosPendientes} consumos)`,
                        };
                      }
                    }
                  }

                  return (
                    <motion.div key={item.href} custom={index + 2} variants={itemVariants}>
                      <Link
                        href={item.href}
                        onClick={handleCerrarMovil}
                        className={`group relative flex items-center justify-between rounded-2xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                          activo
                            ? 'text-indigo-950 dark:text-indigo-200 font-bold'
                            : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/60 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        {/* Indicador animado de pestaña activa */}
                        {activo && (
                          <motion.div
                            layoutId="sidebar-active-tab"
                            className="absolute inset-0 rounded-2xl border border-indigo-200/80 dark:border-indigo-500/30 bg-indigo-50/70 dark:bg-indigo-950/40 shadow-xs"
                            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                          />
                        )}

                        <div className="relative z-10 flex items-center gap-3">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${
                              activo
                                ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-xs'
                                : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 group-hover:bg-gray-200 dark:group-hover:bg-slate-700 group-hover:text-gray-800 dark:group-hover:text-slate-200'
                            }`}
                          >
                            <Icono className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold leading-tight">
                              {item.nombre}
                            </span>
                            <span
                              className={`text-[10px] leading-tight ${
                                activo ? 'text-indigo-700/80 dark:text-indigo-300 font-normal' : 'text-gray-400 dark:text-slate-500'
                              }`}
                            >
                              {item.descripcion}
                            </span>
                          </div>
                        </div>

                        {/* Indicadores en el extremo derecho: Badge de estado y punto activo */}
                        <div className="relative z-10 flex items-center gap-1.5 shrink-0">
                          {badge && (
                            <span
                              title={badge.titulo}
                              className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold border transition-transform duration-200 group-hover:scale-105 shadow-2xs ${badge.clase}`}
                            >
                              {badge.numero}
                            </span>
                          )}
                          {activo && (
                            <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 shrink-0" />
                          )}
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Sección Inferior: Tasa BCV Oficial + Estado del Sistema + Selector Modo Oscuro + Logout */}
          <div className="flex flex-col gap-2.5 mt-8 pt-4 border-t border-gray-100 dark:border-[#1D263A]">
            {/* Tarjeta Oficial Tasa BCV */}
            <motion.div
              custom={7}
              variants={itemVariants}
              className="rounded-2xl border border-amber-200/90 dark:border-amber-900/40 bg-gradient-to-br from-amber-50 via-orange-50/40 to-yellow-50/80 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-yellow-950/20 p-3 shadow-2xs"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20 dark:bg-amber-500/30 text-amber-800 dark:text-amber-300">
                    <TrendingUp className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                    Tasa Oficial BCV
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => refrescar()}
                  disabled={notifCargando}
                  title="Actualizar tasa BCV en vivo"
                  className="rounded-lg p-1 text-amber-800 dark:text-amber-300 hover:bg-amber-200/60 dark:hover:bg-amber-900/40 transition disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${notifCargando ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="flex items-baseline justify-between">
                <div>
                  <span className="font-mono text-base font-black text-gray-900 dark:text-amber-100">
                    {notifData?.tasaBcv > 0 ? formatBs(notifData.tasaBcv) : 'Cargando...'}
                  </span>
                  <p className="text-[10px] text-amber-800/80 dark:text-amber-400">
                    1 USD = {notifData?.tasaBcv > 0 ? formatBs(notifData.tasaBcv) : '...'}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/70 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-300/40 dark:border-emerald-800/40">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  En Vivo
                </span>
              </div>
            </motion.div>

            {/* Tarjeta estado del sistema */}
            <motion.div
              custom={8}
              variants={itemVariants}
              className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-900/60 p-2.5 shadow-2xs"
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900 animate-pulse" />
                <span className="text-xs font-semibold text-gray-900 dark:text-slate-200">
                  Sistema Operativo
                </span>
              </div>
              <p className="text-[10px] text-gray-500 dark:text-slate-400 leading-snug">
                Supabase conectado &bull; Facturación bimoneda lista.
              </p>
            </motion.div>

            {/* Selectores de Tema en el Slidebar: Modo Oscuro (ditdot-dev) + Modo Kirby (Estrellita) */}
            <motion.div custom={9} variants={itemVariants} className="flex items-center justify-center gap-3 py-1">
              {/* Toggle Modo Oscuro / Claro */}
              <button
                type="button"
                onClick={toggleTheme}
                role="switch"
                aria-checked={isDark}
                aria-label={isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
                title={isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
                className="ditdot-switch relative inline-block w-[58px] h-[34px] cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-transform active:scale-95 select-none shrink-0"
              >
                <span
                  className={`ditdot-slider absolute inset-0 rounded-full transition-colors duration-300 shadow-sm ${
                    isDark ? 'bg-[#1e38ff]' : 'bg-[#bae6fd]'
                  }`}
                >
                  {/* Icono de luna en el extremo derecho en modo claro (estilo ditdot-dev) */}
                  <svg
                    className={`ditdot-slider-icon absolute right-[6px] top-[7px] transform rotate-[250deg] transition-opacity duration-200 ${
                      isDark ? 'opacity-0' : 'opacity-90'
                    }`}
                    viewBox="0 0 24 24"
                    fill="none"
                    height="20"
                    stroke="#0284c7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    width="20"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                  </svg>

                  {/* Perilla deslizante blanca estilo ditdot-dev */}
                  <span
                    className={`absolute left-[4px] bottom-[4px] h-[26px] w-[26px] rounded-full bg-white shadow-md transform transition-transform duration-300 ease-out flex items-center justify-center ${
                      isDark ? 'translate-x-[24px]' : 'translate-x-0'
                    }`}
                  >
                    {isDark && (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        height="15"
                        stroke="#1e38ff"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        width="15"
                        className="transform rotate-[250deg]"
                      >
                        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                      </svg>
                    )}
                  </span>
                </span>
              </button>

              {/* Botón Estrellita de Modo Kirby */}
              <button
                type="button"
                onClick={toggleKirby}
                role="switch"
                aria-checked={isKirby}
                aria-label={isKirby ? 'Desactivar Modo Kirby' : 'Activar Modo Kirby ✦'}
                title={isKirby ? 'Modo Kirby Activo (Haz clic para desactivar)' : 'Activar Modo Kirby ✦'}
                className={`relative flex items-center justify-center h-[34px] px-3 rounded-full border transition-all duration-300 shadow-sm active:scale-95 select-none shrink-0 group ${
                  isKirby
                    ? 'bg-gradient-to-r from-pink-400 via-rose-400 to-pink-500 border-pink-300 text-white shadow-pink-400/40 ring-2 ring-pink-200/80 animate-pulse'
                    : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 text-amber-500 hover:border-pink-300 hover:text-pink-500 hover:bg-pink-50/60 dark:hover:bg-pink-950/40'
                }`}
              >
                <Star
                  className={`h-4 w-4 transition-transform duration-300 ${
                    isKirby
                      ? 'fill-amber-300 text-amber-300 rotate-12 scale-110 drop-shadow-xs'
                      : 'fill-amber-400/40 text-amber-500 group-hover:fill-pink-400 group-hover:text-pink-500 group-hover:scale-110'
                  }`}
                />
                <span
                  className={`ml-1 text-[11px] font-black tracking-tight transition-colors ${
                    isKirby
                      ? 'text-white drop-shadow-xs'
                      : 'text-gray-600 dark:text-slate-400 group-hover:text-pink-600 dark:group-hover:text-pink-300'
                  }`}
                >
                  Kirby
                </span>
              </button>
            </motion.div>

            {/* Botón de Cerrar Sesión */}
            <motion.div custom={10} variants={itemVariants}>
              <button
                type="button"
                onClick={handleCerrarSesion}
                disabled={cerrandoSesion}
                className="w-full flex items-center justify-center gap-2 rounded-2xl border border-rose-200/90 dark:border-rose-900/40 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100/80 dark:hover:bg-rose-900/40 active:scale-98 px-3.5 py-2 text-xs font-bold text-rose-700 dark:text-rose-300 transition shadow-2xs group disabled:opacity-60"
                title="Cerrar sesión en Club 5"
              >
                {cerrandoSesion ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
                    <span>Cerrando sesión...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="h-4 w-4 text-rose-500 transition-transform group-hover:-translate-x-0.5" />
                    <span>Cerrar Sesión</span>
                  </>
                )}
              </button>
            </motion.div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
