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
  return cookieString.split('; ').map((c) => {
    const [name, ...val] = c.split('=');
    return { name, value: val.join('=') };
  });
}

/**
 * Cliente de Supabase configurado con almacenamiento persistente (localStorage + cookies).
 * Evita la destrucción del token cuando Safari / iOS suspende o minimiza la aplicación,
 * restaurando automáticamente las credenciales desde localStorage si Safari borra las cookies de sesión.
 */
export const supabase =
  typeof window !== 'undefined'
    ? createBrowserClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            const browserCookies = parseBrowserCookies();
            const cookieMap = new Map<string, string>();
            browserCookies.forEach((c) => cookieMap.set(c.name, c.value));

            // Respaldo resiliente para iOS Safari: si las cookies fueron purgadas en segundo plano,
            // restaurarlas inmediatamente desde localStorage para no cerrar la sesión.
            try {
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('sb_backup_')) {
                  const cookieName = key.replace('sb_backup_', '');
                  if (!cookieMap.has(cookieName)) {
                    const val = localStorage.getItem(key);
                    if (val) {
                      cookieMap.set(cookieName, val);
                      // Restaurar también en document.cookie
                      const maxAge = 60 * 60 * 24 * 365; // 1 año
                      document.cookie = `${cookieName}=${val}; path=/; max-age=${maxAge}; SameSite=Lax`;
                    }
                  }
                }
              }
            } catch (e) {
              // Silenciar errores de acceso a almacenamiento
            }

            return Array.from(cookieMap.entries()).map(([name, value]) => ({
              name,
              value,
            }));
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

export default supabase;
