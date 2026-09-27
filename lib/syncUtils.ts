'use client';

import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { refrescarNotificacionesGlobales } from '@/components/NotificationsContext';

export const EVENTO_MINI_RECARGA = 'club5:mini-recarga';
export const EVENTO_SYNC_STATUS = 'club5:sync-status';

export interface SyncStatusDetail {
  estado: 'sincronizando' | 'completado' | 'idle';
  mensaje?: string;
}

let syncTimeout: NodeJS.Timeout | null = null;

/**
 * Notifica al indicador visual de sincronización en pantalla.
 */
export function notificarEstadoSincronizacion(detail: SyncStatusDetail) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENTO_SYNC_STATUS, { detail }));
  }
}

/**
 * Ejecuta una mini recarga integral de la página y sincronización con Supabase:
 * 1. Muestra el indicador visual de "Sincronizando con base de datos..."
 * 2. Ejecuta la recarga de datos locales de la pantalla actual (Supabase query fresca).
 * 3. Dispara el evento global 'club5:mini-recarga' para que otros componentes en memoria se actualicen.
 * 4. Refresca badges y notificaciones globales en Sidebar y Navbar.
 * 5. Ejecuta router.refresh() de Next.js para revalidar componentes del servidor y caché.
 * 6. Actualiza el indicador visual a "Base de datos sincronizada" y lo oculta suavemente.
 */
export async function ejecutarMiniRecarga(options?: {
  router?: AppRouterInstance | null;
  recargarDatosLocales?: () => Promise<unknown> | unknown;
  mensaje?: string;
}): Promise<void> {
  // 1. Iniciar estado visual
  if (syncTimeout) clearTimeout(syncTimeout);
  notificarEstadoSincronizacion({
    estado: 'sincronizando',
    mensaje: options?.mensaje || 'Sincronizando con base de datos...',
  });

  try {
    // 2. Ejecutar la recarga local de datos de Supabase si fue provista
    if (options?.recargarDatosLocales) {
      await options.recargarDatosLocales();
    }
  } catch (err) {
    console.error('Error durante la recarga local de datos:', err);
  }

  // 3. Notificar a toda la aplicación mediante evento de ventana
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENTO_MINI_RECARGA));
  }

  // 4. Refrescar notificaciones contables globales
  refrescarNotificacionesGlobales();

  // 5. Mini recarga del Router de Next.js (RSC Payload / Server Cache)
  if (options?.router) {
    try {
      options.router.refresh();
    } catch (e) {
      console.warn('Aviso: router.refresh no disponible:', e);
    }
  }

  // 6. Notificar estado completado
  notificarEstadoSincronizacion({
    estado: 'completado',
    mensaje: 'Base de datos sincronizada',
  });

  // 7. Auto-ocultar indicador tras 1200ms
  syncTimeout = setTimeout(() => {
    notificarEstadoSincronizacion({ estado: 'idle' });
  }, 1200);
}
