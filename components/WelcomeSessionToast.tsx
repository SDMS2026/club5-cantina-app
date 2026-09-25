'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  X,
  Truck,
  ArrowRight,
  Receipt,
  Sparkles,
} from 'lucide-react';
import { useSystemNotifications } from './NotificationsContext';
import { formatUSD, formatBs } from '@/lib/utils';

export function WelcomeSessionToast() {
  const { data, cargando } = useSystemNotifications();
  const [visible, setVisible] = useState<boolean>(false);
  const [infoNotificacion, setInfoNotificacion] = useState<{
    tipo: 'critico' | 'proximo' | 'pendiente' | 'solvente';
    titulo: string;
    resumenCorto: string;
    mensaje: string;
    subMensaje?: string;
    enlace: string;
    textoEnlace: string;
  } | null>(null);

  useEffect(() => {
    if (cargando) return;

    // Verificar si ya se mostró en esta sesión de navegador
    try {
      const yaMostrado = sessionStorage.getItem('club5_notif_sesion_mostrada');
      if (yaMostrado === 'true') return;

      // Armar contenido inteligente según la prioridad de alertas
      let notif: typeof infoNotificacion = null;

      if (data.proveedores.vencidas > 0) {
        notif = {
          tipo: 'critico',
          titulo: `${data.proveedores.vencidas} ${
            data.proveedores.vencidas === 1 ? 'Factura Vencida' : 'Facturas Vencidas'
          }`,
          resumenCorto: `${formatUSD(data.proveedores.totalPendienteUsd)} vencidos por liquidar`,
          mensaje: `Tienes ${data.proveedores.vencidas} factura(s) de proveedores con plazo vencido por liquidar (${formatUSD(
            data.proveedores.totalPendienteUsd
          )} / ${formatBs(data.proveedores.totalPendienteBs)}).`,
          subMensaje:
            data.deudas.clientesConDeuda > 0
              ? `Adicionalmente hay ${data.deudas.clientesConDeuda} clientes con saldo pendiente en fiados.`
              : undefined,
          enlace: '/proveedores',
          textoEnlace: 'Revisar Proveedores',
        };
      } else if (data.proveedores.proximas > 0) {
        notif = {
          tipo: 'proximo',
          titulo: `${data.proveedores.proximas} ${
            data.proveedores.proximas === 1 ? 'Pago Próximo' : 'Pagos Próximos'
          }`,
          resumenCorto: `Vencimiento en ≤ 3 días (${formatUSD(data.proveedores.totalPendienteUsd)})`,
          mensaje: `Tienes ${data.proveedores.proximas} factura(s) con vencimiento en ≤ 3 días. Total pendiente: ${formatUSD(
            data.proveedores.totalPendienteUsd
          )}.`,
          subMensaje:
            data.deudas.clientesConDeuda > 0
              ? `Hay ${data.deudas.clientesConDeuda} estudiantes/profesores con cuentas por cobrar.`
              : undefined,
          enlace: '/proveedores',
          textoEnlace: 'Ver Calendario',
        };
      } else if (data.proveedores.pendientes > 0) {
        notif = {
          tipo: 'pendiente',
          titulo: `${data.proveedores.pendientes} Cuentas Activas`,
          resumenCorto: `${formatUSD(data.proveedores.totalPendienteUsd)} dentro de plazo acordado`,
          mensaje: `Tienes ${data.proveedores.pendientes} pagos pendientes a proveedores dentro de plazo acordado (${formatUSD(
            data.proveedores.totalPendienteUsd
          )}).`,
          subMensaje:
            data.deudas.clientesConDeuda > 0
              ? `Hay ${data.deudas.clientesConDeuda} clientes con saldo en fiados.`
              : undefined,
          enlace: '/proveedores',
          textoEnlace: 'Ver Cuentas',
        };
      } else {
        notif = {
          tipo: 'solvente',
          titulo: '¡Cuentas al Día!',
          resumenCorto: 'Todas las facturas a proveedores liquidadas',
          mensaje:
            data.deudas.clientesConDeuda > 0
              ? `No tienes facturas vencidas a proveedores. Hay ${data.deudas.clientesConDeuda} clientes en cuentas por cobrar.`
              : 'Todas las facturas a proveedores están liquidadas y no hay deudas vencidas.',
          enlace: data.deudas.clientesConDeuda > 0 ? '/deudas' : '/proveedores',
          textoEnlace: data.deudas.clientesConDeuda > 0 ? 'Ver Cuentas por Cobrar' : 'Ver Proveedores',
        };
      }

      setInfoNotificacion(notif);

      // Esperar un momento breve para una entrada elegante y suave
      const timerEntrada = setTimeout(() => {
        setVisible(true);
        sessionStorage.setItem('club5_notif_sesion_mostrada', 'true');
      }, 1000);

      // Auto-ocultar después de 8.5 segundos
      const timerSalida = setTimeout(() => {
        setVisible(false);
      }, 9500);

      return () => {
        clearTimeout(timerEntrada);
        clearTimeout(timerSalida);
      };
    } catch (e) {
      console.error('Error al evaluar notificación de bienvenida:', e);
    }
  }, [cargando, data]);

  if (!infoNotificacion) return null;

  const esCritico = infoNotificacion.tipo === 'critico';
  const esProximo = infoNotificacion.tipo === 'proximo';
  const esSolvente = infoNotificacion.tipo === 'solvente';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.96 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-2.5 inset-x-2.5 sm:inset-x-auto sm:top-4 sm:right-4 z-50 sm:w-full sm:max-w-sm pointer-events-auto"
        >
          <div
            className={`rounded-2xl sm:rounded-3xl border p-2.5 sm:p-4 shadow-xl backdrop-blur-md transition-all ${
              esCritico
                ? 'border-rose-300/90 dark:border-rose-900/60 bg-rose-50/98 dark:bg-rose-950/90 text-rose-950 dark:text-rose-100 shadow-rose-500/10'
                : esProximo
                ? 'border-amber-300/90 dark:border-amber-900/60 bg-amber-50/98 dark:bg-amber-950/90 text-amber-950 dark:text-amber-100 shadow-amber-500/10'
                : esSolvente
                ? 'border-emerald-300/90 dark:border-emerald-900/60 bg-emerald-50/98 dark:bg-emerald-950/90 text-emerald-950 dark:text-emerald-100 shadow-emerald-500/10'
                : 'border-indigo-200/90 dark:border-indigo-900/60 bg-white/98 dark:bg-slate-900/95 text-gray-900 dark:text-slate-100 shadow-indigo-500/10'
            }`}
          >
            {/* Vista Compacta en Móvil (< sm): no tapa la pantalla */}
            <div className="flex sm:hidden items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl shadow-2xs ${
                    esCritico
                      ? 'bg-rose-600 text-white animate-pulse'
                      : esProximo
                      ? 'bg-amber-500 text-white'
                      : esSolvente
                      ? 'bg-emerald-600 text-white'
                      : 'bg-indigo-600 text-white'
                  }`}
                >
                  {esCritico ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : esProximo ? (
                    <Clock className="h-4 w-4" />
                  ) : esSolvente ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Truck className="h-4 w-4" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-gray-900 leading-tight">
                      {infoNotificacion.titulo}
                    </span>
                    <Link
                      href={infoNotificacion.enlace}
                      onClick={() => setVisible(false)}
                      className={`inline-flex items-center gap-0.5 text-[11px] font-bold underline ${
                        esCritico
                          ? 'text-rose-700'
                          : esProximo
                          ? 'text-amber-800'
                          : esSolvente
                          ? 'text-emerald-700'
                          : 'text-indigo-700'
                      }`}
                    >
                      <span>{infoNotificacion.textoEnlace}</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <p className="text-[10px] text-gray-600 truncate mt-0.5">
                    {infoNotificacion.resumenCorto}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setVisible(false)}
                className="shrink-0 rounded-full p-1 text-gray-400 hover:bg-black/5 hover:text-gray-700 transition"
                title="Cerrar notificación"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Vista Completa en Pantallas de Escritorio (>= sm) */}
            <div className="hidden sm:flex items-start gap-3">
              {/* Icono animado */}
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-2xs ${
                  esCritico
                    ? 'bg-rose-600 text-white animate-pulse'
                    : esProximo
                    ? 'bg-amber-500 text-white'
                    : esSolvente
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-600 text-white'
                }`}
              >
                {esCritico ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : esProximo ? (
                  <Clock className="h-5 w-5" />
                ) : esSolvente ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Truck className="h-5 w-5" />
                )}
              </div>

              {/* Contenido Completo */}
              <div className="flex-1 min-w-0 pr-1">
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`text-xs font-black uppercase tracking-wider ${
                      esCritico
                        ? 'text-rose-900'
                        : esProximo
                        ? 'text-amber-900'
                        : esSolvente
                        ? 'text-emerald-900'
                        : 'text-indigo-900'
                    }`}
                  >
                    Estado de Pagos
                  </span>

                  <button
                    type="button"
                    onClick={() => setVisible(false)}
                    className="rounded-full p-1 text-gray-400 hover:bg-black/5 hover:text-gray-700 transition"
                    title="Cerrar notificación"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <h4 className="text-sm font-bold text-gray-900 mt-0.5 leading-snug">
                  {infoNotificacion.titulo}
                </h4>

                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  {infoNotificacion.mensaje}
                </p>

                {infoNotificacion.subMensaje && (
                  <p className="text-[11px] text-gray-500 mt-1 italic">
                    {infoNotificacion.subMensaje}
                  </p>
                )}

                <div className="mt-3 flex items-center justify-between pt-2 border-t border-black/5">
                  <Link
                    href={infoNotificacion.enlace}
                    onClick={() => setVisible(false)}
                    className={`inline-flex items-center gap-1.5 text-xs font-bold transition hover:underline ${
                      esCritico
                        ? 'text-rose-700 hover:text-rose-900'
                        : esProximo
                        ? 'text-amber-800 hover:text-amber-950'
                        : esSolvente
                        ? 'text-emerald-700 hover:text-emerald-900'
                        : 'text-indigo-700 hover:text-indigo-900'
                    }`}
                  >
                    <span>{infoNotificacion.textoEnlace}</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>

                  <span className="text-[10px] text-gray-400 font-mono">Club 5 Cantina</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
