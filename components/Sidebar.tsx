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
} from 'lucide-react';
import { formatBs } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';
import { useSidebar } from './SidebarContext';
import { useSystemNotifications } from './NotificationsContext';

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

// Variantes de animación progresiva y suave para el contenedor del Sidebar
const sidebarVariants = {
  open: {
    x: 0,
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1] as const, // Curva de aceleración suave y progresiva
    },
  },
  closed: {
    x: '-100%',
    transition: {
      duration: 0.48,
      ease: [0.16, 1, 0.3, 1] as const, // Salida suave y perfectamente sincronizada con el layout/navbar
    },
  },
};

// Variantes dinámicas para que cada elemento interno aparezca en cascada progresiva escalonada
const itemVariants = {
  open: (i: number = 0) => ({
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      delay: 0.1 + i * 0.055, // Entrada progresiva escalonada: 100ms, 155ms, 210ms, 265ms, 320ms, 375ms, 430ms...
      duration: 0.38,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  }),
  closed: {
    opacity: 0,
    x: -24,
    scale: 0.95,
    transition: {
      duration: 0.18,
      ease: 'easeInOut' as const,
    },
  },
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { abierto, setAbierto, toggleSidebar } = useSidebar();
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
          className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col justify-between border-r border-gray-200/80 bg-white/98 p-5 shadow-2xl backdrop-blur-xl rounded-r-3xl md:w-64 md:rounded-none md:shadow-xs"
        >
          {/* Parte Superior del Sidebar */}
          <div className="flex flex-col gap-6">
            {/* Header del Sidebar: Logo + Tipografía Efecto Club 5 + Botón Cerrar */}
            <motion.div
              custom={0}
              variants={itemVariants}
              className="flex items-center justify-between pb-2 border-b border-gray-100"
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
                      <span className="text-[#0E52A0] drop-shadow-[0_2px_0_#FACC15] transition-transform duration-200 group-hover:scale-105">
                        Club
                      </span>
                      <span className="relative inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-yellow-300 via-amber-400 to-amber-500 px-2 py-0.5 text-[#0A3D78] font-black text-xl shadow-xs ring-2 ring-yellow-200/80 -rotate-3 transition-transform duration-300 group-hover:rotate-0">
                        5
                      </span>
                    </span>
                    <span className="rounded-full border border-yellow-300/80 bg-yellow-50 px-1.5 py-0.2 text-[10px] font-bold text-amber-900 shadow-2xs">
                      POS
                    </span>
                  </div>
                  <span className="font-[family-name:var(--font-brand)] text-[11px] font-bold tracking-wide text-amber-700/90 -mt-0.5">
                    Cantina Escolar
                  </span>
                </div>
              </Link>

              {/* Botón para cerrar el Sidebar con animación suave */}
              <button
                type="button"
                onClick={toggleSidebar}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition active:scale-95"
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
                className="px-3 text-[10px] font-bold uppercase tracking-wider text-gray-400"
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
                            ? 'text-indigo-950 font-bold'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
                        }`}
                      >
                        {/* Indicador animado de pestaña activa */}
                        {activo && (
                          <motion.div
                            layoutId="sidebar-active-tab"
                            className="absolute inset-0 rounded-2xl border border-indigo-200/80 bg-indigo-50/70 shadow-xs"
                            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                          />
                        )}

                        <div className="relative z-10 flex items-center gap-3">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${
                              activo
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200 group-hover:text-gray-800'
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
                                activo ? 'text-indigo-700/80 font-normal' : 'text-gray-400'
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
                            <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-600 shrink-0" />
                          )}
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Sección Inferior: Tasa BCV Oficial + Estado del Sistema */}
          <div className="flex flex-col gap-3">
            {/* Tarjeta Oficial Tasa BCV */}
            <motion.div
              custom={7}
              variants={itemVariants}
              className="rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50 via-orange-50/40 to-yellow-50/80 p-3.5 shadow-2xs"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20 text-amber-800">
                    <TrendingUp className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
                    Tasa Oficial BCV
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => refrescar()}
                  disabled={notifCargando}
                  title="Actualizar tasa BCV en vivo"
                  className="rounded-lg p-1 text-amber-800 hover:bg-amber-200/60 transition disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${notifCargando ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="flex items-baseline justify-between">
                <div>
                  <span className="font-mono text-base font-black text-gray-900">
                    {notifData?.tasaBcv > 0 ? formatBs(notifData.tasaBcv) : 'Cargando...'}
                  </span>
                  <p className="text-[10px] text-amber-800/80">
                    1 USD = {notifData?.tasaBcv > 0 ? formatBs(notifData.tasaBcv) : '...'}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  En Vivo
                </span>
              </div>
            </motion.div>

            {/* Tarjeta estado del sistema */}
            <motion.div
              custom={8}
              variants={itemVariants}
              className="rounded-2xl border border-gray-100 bg-gray-50/80 p-3 shadow-2xs"
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200 animate-pulse" />
                <span className="text-xs font-semibold text-gray-900">
                  Sistema Operativo
                </span>
              </div>
              <p className="text-[10px] text-gray-500 leading-snug">
                Supabase conectado &bull; Facturación bimoneda lista.
              </p>
            </motion.div>

            {/* Botón de Cerrar Sesión */}
            <motion.div custom={9} variants={itemVariants}>
              <button
                type="button"
                onClick={handleCerrarSesion}
                disabled={cerrandoSesion}
                className="w-full flex items-center justify-center gap-2 rounded-2xl border border-rose-200/90 bg-rose-50/70 hover:bg-rose-100/80 active:scale-98 px-3.5 py-2.5 text-xs font-bold text-rose-700 transition shadow-2xs group disabled:opacity-60"
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
