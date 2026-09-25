'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { createClientComponentClient } from '@/lib/supabaseClient';
import { ejecutarCierreForzadoMantenimiento } from '@/lib/maintenance';

export function MaintenanceScreen() {
  const [comprobando, setComprobando] = useState<boolean>(false);
  const [mensajeEstado, setMensajeEstado] = useState<string | null>(null);

  // Cierre Activo de Sesión (signOut) e invalidación de almacenamiento local inmediato
  useEffect(() => {
    const supabase = createClientComponentClient();
    supabase.auth.signOut({ scope: 'local' });
    if (typeof window !== 'undefined') {
      localStorage.clear();
      sessionStorage.clear();
    }

    // Depuración complementaria de cachés en el navegador
    ejecutarCierreForzadoMantenimiento().catch(() => {});

    // Verificación periódica en segundo plano para detectar cuando se levante el mantenimiento
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/mantenimiento', { cache: 'no-store' });
        const data = await res.json();
        if (data && data.mantenimiento === false) {
          // El mantenimiento se ha desactivado: recargar automáticamente hacia el login
          window.location.href = '/login';
        }
      } catch {}
    }, 20000);

    return () => {
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
        setMensajeEstado('El sistema aún se encuentra en mantenimiento. Regresaremos en breve.');
        setTimeout(() => setMensajeEstado(null), 4000);
      }
    } catch {
      setMensajeEstado('Verificando conexión con el servidor. Intenta en unos segundos.');
      setTimeout(() => setMensajeEstado(null), 4000);
    } finally {
      setComprobando(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden bg-[#F8FAFC] text-slate-900 select-none">
      {/* Luces y esferas decorativas de fondo sutiles */}
      <div
        className="absolute top-[-10%] left-[-10%] w-96 h-96 rounded-full bg-amber-200/20 blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-[-10%] right-[-10%] w-96 h-96 rounded-full bg-blue-200/20 blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[440px]"
      >
        {/* Tarjeta principal limpia, moderna y elegante */}
        <div className="rounded-3xl border border-gray-100 bg-white/95 backdrop-blur-md p-7 sm:p-9 shadow-xl shadow-gray-200/60 text-center">
          {/* Logo limpio y destacado sin contenedor ni bordes pesados */}
          <div className="relative mb-5 flex items-center justify-center">
            <Image
              src="/club5logo-transparent.png"
              alt="Club 5 Cantina Escolar"
              width={84}
              height={84}
              priority
              className="object-contain drop-shadow-xs"
            />
          </div>

          {/* Badge sutil de estado activo */}
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/90 bg-amber-50/90 px-3 py-1 text-[11px] font-bold text-amber-800 shadow-2xs mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-600" />
            </span>
            <span>Mantenimiento en Progreso</span>
          </div>

          {/* Título Oficial */}
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-gray-900 font-fredoka leading-snug">
            Sitio en Mantenimiento - Actualizando Club 5 Cantina Escolar
          </h1>

          {/* Subtítulo Oficial */}
          <p className="mt-2.5 text-xs sm:text-sm text-gray-500 leading-relaxed max-w-sm mx-auto">
            Estamos realizando mejoras en el sistema. Regresaremos en breve.
          </p>

          {/* Mensaje de respuesta interactivo */}
          {mensajeEstado && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/80 p-2.5 text-xs font-semibold text-indigo-900"
            >
              {mensajeEstado}
            </motion.div>
          )}

          {/* Botón de Comprobar Disponibilidad */}
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={handleComprobarDisponibilidad}
              disabled={comprobando}
              className="w-full sm:w-auto min-h-[42px] flex items-center justify-center gap-2 rounded-2xl bg-gray-900 px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-black transition active:scale-95 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${comprobando ? 'animate-spin' : ''}`} />
              <span>{comprobando ? 'Comprobando estado...' : 'Comprobar disponibilidad'}</span>
            </button>
          </div>
        </div>

        {/* Footer branding */}
        <p className="mt-6 text-center text-xs text-gray-400 font-medium">
          Club 5 Cantina Escolar &bull; Desarrollado por SyncLogic
        </p>
      </motion.div>
    </div>
  );
}
