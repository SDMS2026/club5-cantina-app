'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

/**
 * Disparador para transiciones de ruta programáticas (router.push)
 */
export function iniciarTransicionRuta() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('club5:route-change-start'));
  }
}

/**
 * Indicador y barra de progreso suave para cambios de página.
 * Se activa ÚNICAMENTE al navegar entre rutas diferentes.
 */
export function PageTransitionLoader() {
  const pathname = usePathname();
  const [cargando, setCargando] = useState(false);
  const [progreso, setProgreso] = useState(0);

  const timeoutSeguridadRef = useRef<NodeJS.Timeout | null>(null);
  const animIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const navegandoRef = useRef(false);

  const iniciarCarga = useCallback(() => {
    navegandoRef.current = true;
    setCargando(true);
    setProgreso(18);

    if (animIntervalRef.current) clearInterval(animIntervalRef.current);
    if (timeoutSeguridadRef.current) clearTimeout(timeoutSeguridadRef.current);

    // Incremento suave y no-lineal mientras la página de destino carga
    animIntervalRef.current = setInterval(() => {
      setProgreso((prev) => {
        if (prev >= 86) {
          if (animIntervalRef.current) clearInterval(animIntervalRef.current);
          return 86;
        }
        const delta = Math.max(0.8, (86 - prev) * 0.22);
        return Math.min(86, prev + delta);
      });
    }, 120);

    // Timeout de seguridad en caso de cancelación o red lenta
    timeoutSeguridadRef.current = setTimeout(() => {
      finalizarCarga();
    }, 7000);
  }, []);

  const finalizarCarga = useCallback(() => {
    navegandoRef.current = false;
    if (animIntervalRef.current) clearInterval(animIntervalRef.current);
    if (timeoutSeguridadRef.current) clearTimeout(timeoutSeguridadRef.current);

    setProgreso(100);

    // Breve pausa para apreciar el 100% y desvanecimiento suave
    const fadeTimer = setTimeout(() => {
      setCargando(false);
      const resetTimer = setTimeout(() => {
        setProgreso(0);
      }, 250);
      return () => clearTimeout(resetTimer);
    }, 180);

    return () => clearTimeout(fadeTimer);
  }, []);

  // Al cambiar el pathname de Next.js, se completa la carga
  useEffect(() => {
    if (navegandoRef.current || cargando) {
      finalizarCarga();
    }
  }, [pathname, finalizarCarga, cargando]);

  // Listener global de clics en enlaces (intercepta solo enlaces a rutas distintas)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Ignorar clics con modificadores (abrir en nueva pestaña, etc.)
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
      if (timeoutSeguridadRef.current) clearTimeout(timeoutSeguridadRef.current);
      if (animIntervalRef.current) clearInterval(animIntervalRef.current);
    };
  }, [iniciarCarga]);

  return (
    <>
      {/* 1. Barra superior luminosa con gradiente Club 5 */}
      <AnimatePresence>
        {cargando && (
          <div className="fixed top-0 left-0 right-0 z-[99999] h-1 pointer-events-none overflow-hidden">
            <motion.div
              initial={{ width: '0%', opacity: 1 }}
              animate={{ width: `${progreso}%`, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ ease: 'easeOut', duration: 0.2 }}
              className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-amber-400 shadow-[0_0_14px_rgba(99,102,241,0.85),0_0_6px_rgba(250,204,21,0.9)]"
            />
          </div>
        )}
      </AnimatePresence>

      {/* 2. Badge flotante suave y estilizado ("Cargando...") */}
      <AnimatePresence>
        {cargando && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.94 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-3.5 left-1/2 -translate-x-1/2 z-[99999] pointer-events-none select-none"
          >
            <div className="flex items-center gap-2 rounded-full border border-indigo-100 bg-white/95 px-3.5 py-1.5 shadow-lg shadow-indigo-500/10 backdrop-blur-md">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
              <span className="text-xs font-semibold text-gray-700 tracking-tight">
                Cargando página...
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
