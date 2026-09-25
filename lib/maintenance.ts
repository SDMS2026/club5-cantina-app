import { supabase } from '@/lib/supabaseClient';

/**
 * Determina si el Modo Mantenimiento está activo leyendo la variable de entorno.
 * Retorna true si NEXT_PUBLIC_MAINTENANCE_MODE es 'true' o '1'.
 */
export function isMaintenanceMode(): boolean {
  const val = process.env.NEXT_PUBLIC_MAINTENANCE_MODE?.toLowerCase().trim();
  return val === 'true' || val === '1';
}

/**
 * Ejecuta el cierre forzado de sesión en Supabase Auth y la depuración exhaustiva
 * de caché, almacenamiento local (localStorage) y de sesión (sessionStorage).
 * Garantiza que al desactivar el mantenimiento, todos los usuarios deban iniciar
 * sesión nuevamente y se descarguen datos frescos desde Supabase.
 */
export async function ejecutarCierreForzadoMantenimiento(): Promise<{
  sesionCerrada: boolean;
  almacenamientoLimpio: boolean;
}> {
  let sesionCerrada = false;
  let almacenamientoLimpio = false;

  // 1. Cerrar sesión activa en Supabase Auth
  try {
    await supabase.auth.signOut({ scope: 'local' });
    sesionCerrada = true;
  } catch (err) {
    console.warn('Aviso al cerrar sesión de Supabase Auth en mantenimiento:', err);
    // Intentar signOut sin parámetros por compatibilidad
    try {
      await supabase.auth.signOut();
      sesionCerrada = true;
    } catch {}
  }

  // 2. Limpieza de LocalStorage, SessionStorage y Cache Storage en el navegador
  if (typeof window !== 'undefined') {
    try {
      // Eliminar tokens de supabase, carritos, banderas de sesión y estados locales
      window.localStorage.clear();
      window.sessionStorage.clear();
      almacenamientoLimpio = true;

      // 3. Invalidar y eliminar cachés de la Cache API del navegador
      if ('caches' in window) {
        try {
          const cacheNames = await window.caches.keys();
          await Promise.all(cacheNames.map((name) => window.caches.delete(name)));
        } catch (cacheErr) {
          console.warn('Aviso depurando Cache Storage:', cacheErr);
        }
      }
    } catch (storageErr) {
      console.warn('Aviso limpiando almacenamiento local:', storageErr);
    }
  }

  return { sesionCerrada, almacenamientoLimpio };
}
