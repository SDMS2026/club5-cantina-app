'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Wrench,
  ShieldCheck,
  RefreshCw,
  Clock,
  Sparkles,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import { ejecutarCierreForzadoMantenimiento } from '@/lib/maintenance';

export function MaintenanceScreen() {
  const [limpiezaEjecutada, setLimpiezaEjecutada] = useState<boolean>(false);
  const [comprobando, setComprobando] = useState<boolean>(false);
  const [mensajeEstado, setMensajeEstado] = useState<string | null>(null);

  // Ejecución automática inmediata del cierre forzado de sesión y depuración de caché
  useEffect(() => {
    let montado = true;

    async function aplicarSeguridadMantenimiento() {
      try {
        await ejecutarCierreForzadoMantenimiento();
        if (montado) {
          setLimpiezaEjecutada(true);
        }
      } catch (err) {
        console.error('Error aplicando cierre forzado de mantenimiento:', err);
      }
    }

    aplicarSeguridadMantenimiento();

    // Verificación periódica en segundo plano para detectar cuando se levante el mantenimiento
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/mantenimiento', { cache: 'no-store' });
        const data = await res.json();
        if (data && data.mantenimiento === false) {
          // El mantenimiento se ha desactivado: recargar automáticamente
          window.location.href = '/login';
        }
      } catch {}
    }, 20000);

    return () => {
      montado = false;
      clearInterval(interval);
    };
  }, []);

  // Comprobar manualmente si el mantenimiento ya concluyó
  const handleComprobarDisponibilidad = async () => {
    setComprobando(true);
    setMensajeEstado(null);

    try {
      const res = await fetch('/api/mantenimiento', { cache: 'no-store' });
      const data = await res.json();

      if (data && data.mantenimiento === false) {
        setMensajeEstado('¡Mantenimiento concluido! Redirigiendo al sistema...');
        setTimeout(() => {
          window.location.href = '/login';
        }, 1200);
      } else {
        setMensajeEstado('El sistema aún se encuentra en mantenimiento. Por favor espera un momento.');
        setTimeout(() => setMensajeEstado(null), 4000);
      }
    } catch {
      // Si la API falla o está reiniciándose el servidor
      setMensajeEstado('Verificando conexión con el servidor. Por favor intenta en unos segundos.');
      setTimeout(() => setMensajeEstado(null), 4000);
    } finally {
      setComprobando(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden bg-gradient-to-b from-[#FAF8F5] via-[#FAFAFA] to-[#F3F4F6] text-slate-900 select-none">
      {/* Luces y esferas decorativas de fondo sutiles */}
      <div
        className="absolute top-[-15%] left-[-10%] w-96 sm:w-[480px] h-96 sm:h-[480px] rounded-full bg-amber-400/15 blur-3xl pointer-events-none animate-pulse"
        style={{ animationDuration: '6s' }}
        aria-hidden="true"
      />
      <div
        className="absolute bottom-[-15%] right-[-10%] w-96 sm:w-[480px] h-96 sm:h-[480px] rounded-full bg-orange-400/15 blur-3xl pointer-events-none animate-pulse"
        style={{ animationDuration: '8s' }}
        aria-hidden="true"
      />

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-lg"
      >
        {/* Tarjeta principal con cristal esmerilado */}
        <div className="rounded-3xl border border-amber-200/80 bg-white/95 backdrop-blur-xl p-6 sm:p-9 shadow-2xl shadow-amber-900/10 text-center">
          {/* Logo y Avatar con anillo animado de mantenimiento */}
          <div className="relative mx-auto mb-6 flex items-center justify-center">
            {/* Anillo de pulso exterior */}
            <div className="absolute -inset-2.5 rounded-full bg-gradient-to-r from-amber-400/30 via-orange-400/20 to-yellow-400/30 blur-md animate-pulse" />

            <div className="relative h-24 w-24 sm:h-28 sm:w-28 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 shadow-md flex items-center justify-center p-4">
              <Image
                src="/club5logo-transparent.png"
                alt="Club 5 Cantina Escolar"
                width={86}
                height={86}
                priority
                className="object-contain drop-shadow-xs"
              />
              <div className="absolute -bottom-2 -right-2 h-8 w-8 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md border-2 border-white">
                <Wrench className="h-4 w-4 animate-bounce" style={{ animationDuration: '2.5s' }} />
              </div>
            </div>
          </div>

          {/* Badge de Estado Activo */}
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50/90 px-3.5 py-1 text-xs font-bold text-amber-900 shadow-2xs mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-600" />
            </span>
            <span>MODO MANTENIMIENTO ACTIVO</span>
          </div>

          {/* Título Oficial Solicitado */}
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-gray-900 font-fredoka leading-snug sm:leading-tight">
            Sitio en Mantenimiento - Actualizando Club 5 Cantina Escolar
          </h1>

          {/* Subtítulo Oficial Solicitado */}
          <p className="mt-3 text-xs sm:text-sm text-gray-600 leading-relaxed max-w-md mx-auto">
            Estamos realizando mejoras en el sistema. Regresaremos en breve.
          </p>

          {/* Tarjeta de Seguridad y Limpieza de Sesiones */}
          <div className="mt-6 rounded-2xl border border-gray-200/90 bg-gray-50/70 p-4 text-left space-y-2.5">
            <div className="flex items-center justify-between border-b border-gray-200/60 pb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Protocolo de Seguridad y Sincronización</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {limpiezaEjecutada ? 'Ejecutado' : 'Procesando...'}
              </span>
            </div>

            <div className="space-y-1.5 text-[11px] text-gray-600">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Cierre forzado de sesiones:</strong> Se cerró la sesión activa de Supabase Auth en este dispositivo para salvaguardar la integridad de los datos.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Caché y almacenamiento depurados:</strong> Se eliminó la caché local para garantizar que al reanudar se carguen datos 100% frescos desde la base de datos.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Lock className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Acceso restringido:</strong> Las rutas del Punto de Venta, inventario y cuentas quedan temporalmente en pausa mientras se aplican las actualizaciones.
                </span>
              </div>
            </div>
          </div>

          {/* Mensaje de respuesta de comprobación */}
          {mensajeEstado && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3.5 rounded-xl border border-indigo-200 bg-indigo-50 p-2.5 text-xs font-medium text-indigo-900"
            >
              {mensajeEstado}
            </motion.div>
          )}

          {/* Botón de acción */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleComprobarDisponibilidad}
              disabled={comprobando}
              className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 rounded-2xl bg-gray-900 px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-black transition active:scale-95 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${comprobando ? 'animate-spin' : ''}`} />
              <span>{comprobando ? 'Comprobando estado...' : 'Comprobar disponibilidad'}</span>
            </button>
          </div>

          <p className="mt-4 text-[10px] text-gray-400 flex items-center justify-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Verificación automática periódica activa cada 20 segundos</span>
          </p>
        </div>

        {/* Footer branding */}
        <p className="mt-6 text-center text-xs text-gray-400 font-medium">
          Club 5 Cantina Escolar &bull; Desarrollado por SyncLogic
        </p>
      </motion.div>
    </div>
  );
}
