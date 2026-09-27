'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, CheckCircle2 } from 'lucide-react';
import { EVENTO_SYNC_STATUS, SyncStatusDetail } from '@/lib/syncUtils';

/**
 * Indicador visual flotante y minimalista de Mini Recarga / Sincronización con Supabase.
 * Aparece sutilmente en la parte superior central al realizar cualquier operación
 * de registro o guardado, confirmando que la base de datos se encuentra sincronizada.
 */
export function MiniSyncIndicator() {
  const [status, setStatus] = useState<SyncStatusDetail>({ estado: 'idle' });

  useEffect(() => {
    const handleStatus = (e: Event) => {
      const customEvent = e as CustomEvent<SyncStatusDetail>;
      if (customEvent.detail) {
        setStatus(customEvent.detail);
      }
    };

    window.addEventListener(EVENTO_SYNC_STATUS, handleStatus);
    return () => window.removeEventListener(EVENTO_SYNC_STATUS, handleStatus);
  }, []);

  return (
    <AnimatePresence>
      {status.estado !== 'idle' && (
        <motion.aside
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -24, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.94 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className={`fixed top-3 sm:top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 rounded-full px-3.5 py-1.5 shadow-xl backdrop-blur-md text-xs font-bold pointer-events-none select-none border transition-colors ${
            status.estado === 'sincronizando'
              ? 'border-indigo-300/80 dark:border-indigo-700/80 bg-white/95 dark:bg-[#0D1322]/95 text-indigo-950 dark:text-indigo-200 shadow-indigo-500/10'
              : 'border-emerald-300/80 dark:border-emerald-700/80 bg-white/95 dark:bg-[#081B15]/95 text-emerald-950 dark:text-emerald-200 shadow-emerald-500/10'
          }`}
        >
          {status.estado === 'sincronizando' ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>{status.mensaje || 'Sincronizando con base de datos...'}</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{status.mensaje || 'Base de datos sincronizada'}</span>
            </>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
