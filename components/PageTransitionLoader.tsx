'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Duración exacta de la animación de carga (1 segundo)
 */
const DURACION_CARGA_MS = 1000;

/**
 * Disparador para transiciones de ruta programáticas (router.push)
 */
export function iniciarTransicionRuta() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('club5:route-change-start'));
  }
}

/**
 * Pantalla de carga central con círculo giratorio más grueso y fondo difuminado (blur),
 * sin tarjetas ni grids, activa ÚNICAMENTE al cambiar de página con una duración de 1 segundo.
 */
export function PageTransitionLoader() {
  const pathname = usePathname();
  const [cargando, setCargando] = useState(false);

  const tiempoInicioRef = useRef<number | null>(null);
  const timeoutCierreRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutSeguridadRef = useRef<NodeJS.Timeout | null>(null);
  const navegandoRef = useRef<boolean>(false);

  const iniciarCarga = useCallback(() => {
    navegandoRef.current = true;
    tiempoInicioRef.current = Date.now();
    setCargando(true);

    if (timeoutCierreRef.current) clearTimeout(timeoutCierreRef.current);
    if (timeoutSeguridadRef.current) clearTimeout(timeoutSeguridadRef.current);

    // Timeout de seguridad en caso de cancelación o red lenta
    timeoutSeguridadRef.current = setTimeout(() => {
      setCargando(false);
      navegandoRef.current = false;
      tiempoInicioRef.current = null;
    }, 4000);
  }, []);

  const finalizarConDuracion = useCallback(() => {
    if (!tiempoInicioRef.current) {
      setCargando(false);
      navegandoRef.current = false;
      return;
    }

    const tiempoTranscurrido = Date.now() - tiempoInicioRef.current;
    // Asegurar que dure exactamente 1 segundo (1000ms)
    const tiempoRestante = Math.max(0, DURACION_CARGA_MS - tiempoTranscurrido);

    if (timeoutCierreRef.current) clearTimeout(timeoutCierreRef.current);
    timeoutCierreRef.current = setTimeout(() => {
      setCargando(false);
      navegandoRef.current = false;
      tiempoInicioRef.current = null;
    }, tiempoRestante);
  }, []);

  // Al cambiar el pathname de Next.js, programar el cierre al cumplir 1 segundo
  useEffect(() => {
    if (navegandoRef.current || cargando) {
      finalizarConDuracion();
    }
  }, [pathname, finalizarConDuracion, cargando]);

  // Listener global de clics en enlaces (intercepta solo enlaces a rutas distintas)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Ignorar clics con modificadores (abrir en nueva pestaña, click secundario, etc.)
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.shiftKey
      ) {
        return;
      }

      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      // Omitir enlaces externos, target blank, anclas en la misma página, javascript, mailto, tel
      if (
        anchor.target === '_blank' ||
        href.startsWith('http://') ||
        href.startsWith('https://') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('#') ||
        href.startsWith('javascript:')
      ) {
        return;
      }

      try {
        const urlDestino = new URL(href, window.location.href);
        const rutaActual = window.location.pathname;

        // Solo activar si la ruta de destino es DIFERENTE a la página actual
        if (urlDestino.pathname !== rutaActual) {
          iniciarCarga();
        }
      } catch {
        // Enlace no parseable, ignorar
      }
    };

    const handleCustomRouteStart = () => {
      iniciarCarga();
    };

    document.addEventListener('click', handleClick, { capture: true });
    window.addEventListener('club5:route-change-start', handleCustomRouteStart);

    return () => {
      document.removeEventListener('click', handleClick, { capture: true });
      window.removeEventListener('club5:route-change-start', handleCustomRouteStart);
      if (timeoutCierreRef.current) clearTimeout(timeoutCierreRef.current);
      if (timeoutSeguridadRef.current) clearTimeout(timeoutSeguridadRef.current);
    };
  }, [iniciarCarga]);

  return (
    <AnimatePresence>
      {cargando && (
        <motion.div
          key="page-loader-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeInOut' }}
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black/20 backdrop-blur-md select-none pointer-events-auto"
          style={{ WebkitBackdropFilter: 'blur(12px)' }}
          aria-live="assertive"
          aria-busy="true"
        >
          {/* Contenedor sin tarjeta ni recuadro: Solo el círculo y el texto */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center justify-center gap-3"
          >
            {/* Círculo girando en el medio (grosor aumentado a 5.5px) */}
            <div className="relative flex items-center justify-center w-14 h-14">
              {/* Pista base circular */}
              <div className="w-14 h-14 rounded-full border-[5.5px] border-indigo-200/80 shadow-xs" />
              {/* Círculo giratorio Club 5 más grueso */}
              <div className="absolute inset-0 w-14 h-14 rounded-full border-[5.5px] border-transparent border-t-indigo-600 border-r-blue-600 animate-spin" />
            </div>

            {/* Texto de carga directo */}
            <span className="text-sm font-bold text-gray-900 tracking-wider drop-shadow-xs">
              Cargando...
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
