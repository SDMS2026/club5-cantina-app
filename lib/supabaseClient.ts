import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Faltan variables de entorno para Supabase: Asegúrate de configurar NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local.'
  );
}

// Clave en localStorage para recordar si el usuario eligió mantener sesión iniciada
export const MANTENER_SESION_KEY = 'club5_mantener_sesion';

function parseBrowserCookies(): { name: string; value: string }[] {
  if (typeof document === 'undefined') return [];
  const cookieString = document.cookie;
  if (!cookieString) return [];
  return cookieString
    .split('; ')
    .filter(Boolean)
    .map((c) => {
      const idx = c.indexOf('=');
      if (idx === -1) return { name: c, value: '' };
      return { name: c.slice(0, idx), value: c.slice(idx + 1) };
    });
}

let cookiesRespaldoRestauradas = false;

function restaurarCookiesDesdeRespaldoSiFaltan() {
  if (cookiesRespaldoRestauradas || typeof window === 'undefined') return;
  cookiesRespaldoRestauradas = true;
  try {
    const existentes = new Set(parseBrowserCookies().map((c) => c.name));
    const maxAge = 60 * 60 * 24 * 365;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb_backup_')) {
        const cookieName = key.replace('sb_backup_', '');
        if (!existentes.has(cookieName)) {
          const val = localStorage.getItem(key);
          if (val) {
            const secureFlag = window.location.protocol === 'https:' ? '; Secure' : '';
            document.cookie = `${cookieName}=${val}; path=/; max-age=${maxAge}; SameSite=Lax${secureFlag}`;
          }
        }
      }
    }
  } catch {
    // Silenciar errores de acceso a almacenamiento
  }
}

/**
 * Fetch resiliente para móviles (especialmente iOS Safari):
 * - Aplica un timeout máximo de 20s para evitar cuelgues de 4-5 minutos en sockets colgados.
 * - Reintenta 1 vez peticiones de solo lectura (GET/HEAD) si Safari cierra un socket keep-alive inactivo.
 */
async function fetchConTimeoutSupabase(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const TIMEOUT_MS = 20000;
  const method = (init?.method || 'GET').toUpperCase();
  const esLectura = method === 'GET' || method === 'HEAD';

  const ejecutarFetch = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const externalSignal = init?.signal;

    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) {
        clearTimeout(timer);
        controller.abort();
      } else {
        externalSignal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    try {
      return await fetch(input, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    }
  };

  try {
    return await ejecutarFetch();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    const esErrorRedTransitorio =
      esLectura &&
      !init?.signal?.aborted &&
      (msg.includes('Load failed') ||
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        (err instanceof Error && err.name === 'AbortError'));

    if (esErrorRedTransitorio) {
      return await ejecutarFetch();
    }
    throw err;
  }
}

/**
 * Cliente de Supabase configurado con almacenamiento persistente (localStorage + cookies).
 * Evita la destrucción del token cuando Safari / iOS suspende o minimiza la aplicación,
 * restaurando automáticamente las credenciales desde localStorage si Safari borra las cookies de sesión.
 */
export const supabase =
  typeof window !== 'undefined'
    ? createBrowserClient(supabaseUrl, supabaseAnonKey, {
        global: {
          fetch: fetchConTimeoutSupabase,
        },
        cookies: {
          getAll() {
            restaurarCookiesDesdeRespaldoSiFaltan();
            return parseBrowserCookies();
          },
          setAll(cookiesToSet) {
            const mantenerSesion =
              typeof window !== 'undefined'
                ? localStorage.getItem(MANTENER_SESION_KEY) !== 'false'
                : true;

            cookiesToSet.forEach(({ name, value, options }) => {
              const maxAge =
                options?.maxAge !== undefined
                  ? options.maxAge
                  : mantenerSesion
                  ? 60 * 60 * 24 * 365
                  : undefined;

              let cookieStr = `${name}=${value}; path=${options?.path || '/'}; SameSite=${
                options?.sameSite || 'Lax'
              }`;

              if (maxAge !== undefined) {
                cookieStr += `; max-age=${maxAge}`;
              }

              if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
                cookieStr += '; Secure';
              }

              document.cookie = cookieStr;

              // Guardar respaldo persistente en localStorage para iOS Safari
              try {
                if (maxAge && maxAge > 0 && value) {
                  localStorage.setItem(`sb_backup_${name}`, value);
                } else if (maxAge === 0 || !value) {
                  localStorage.removeItem(`sb_backup_${name}`);
                }
              } catch (e) {
                // Silenciar errores de almacenamiento
              }
            });
          },
        },
        cookieOptions: {
          maxAge: 60 * 60 * 24 * 365, // 1 año por defecto
          sameSite: 'lax',
          path: '/',
        },
      })
    : createClient(supabaseUrl, supabaseAnonKey);

export const createClientComponentClient = () => supabase;

/**
 * Helper para paginar y recuperar todos los registros de una consulta en Supabase,
 * superando la restricción predeterminada de max-rows (1000) por petición de PostgREST.
 * Ejecuta peticiones secuenciales en lotes usando .range(offset, offset + batchSize - 1).
 */
export async function fetchEnLotes<T = any>(
  queryBuilderFn: () => any,
  batchSize: number = 1000
): Promise<T[]> {
  let offset = 0;
  const resultados: T[] = [];
  while (true) {
    const { data, error } = await queryBuilderFn().range(offset, offset + batchSize - 1);
    if (error) {
      console.error('Error en fetchEnLotes:', error);
      throw error;
    }
    if (!data || data.length === 0) break;
    resultados.push(...data);
    if (data.length < batchSize) break;
    offset += batchSize;
  }
  return resultados;
}

export default supabase;
