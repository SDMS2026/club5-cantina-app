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
            data.proveedores.proximas === 1 ? 'Pago Próximo a Vencer' : 'Pagos Próximos a Vencer'
          }`,
          mensaje: `Tienes ${data.proveedores.proximas} factura(s) con vencimiento en ≤ 3 días. Total pendiente: ${formatUSD(
            data.proveedores.totalPendienteUsd
          )}.`,
          subMensaje:
            data.deudas.clientesConDeuda > 0
              ? `Hay ${data.deudas.clientesConDeuda} estudiantes/profesores con cuentas por cobrar.`
              : undefined,
          enlace: '/proveedores',
          textoEnlace: 'Ver Calendario de Pagos',
        };
      } else if (data.proveedores.pendientes > 0) {
        notif = {
          tipo: 'pendiente',
          titulo: `${data.proveedores.pendientes} Cuentas por Pagar Activas`,
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
          initial={{ opacity: 0, y: -24, scale: 0.95, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -20, scale: 0.95, filter: 'blur(4px)' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-4 right-4 z-50 w-full max-w-sm"
        >
          <div
            className={`rounded-3xl border p-4 shadow-2xl backdrop-blur-xl transition-all ${
              esCritico
                ? 'border-rose-300/90 bg-rose-50/95 text-rose-950 shadow-rose-500/10'
                : esProximo
                ? 'border-amber-300/90 bg-amber-50/95 text-amber-950 shadow-amber-500/10'
                : esSolvente
                ? 'border-emerald-300/90 bg-emerald-50/95 text-emerald-950 shadow-emerald-500/10'
                : 'border-indigo-200/90 bg-white/95 text-gray-900 shadow-indigo-500/10'
            }`}
          >
            <div className="flex items-start gap-3">
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

              {/* Contenido */}
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
