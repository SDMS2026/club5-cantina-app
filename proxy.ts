import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  // 1. Verificación Global Prioritaria de Modo Mantenimiento
  // Intercepta CUALQUIER ruta ANTES de comprobar cookies o sesiones de Supabase Auth
  const maintenanceEnv = process.env.NEXT_PUBLIC_MAINTENANCE_MODE?.toLowerCase().trim();
  const isMaintenance = maintenanceEnv === 'true' || maintenanceEnv === '1';

  if (isMaintenance) {
    // Si es una petición a la API (excepto /api/mantenimiento para monitorear el estado)
    if (
      request.nextUrl.pathname.startsWith('/api') &&
      !request.nextUrl.pathname.startsWith('/api/mantenimiento')
    ) {
      return NextResponse.json(
        {
          error: 'Sitio en Mantenimiento - Actualizando Club 5 Cantina Escolar. Regresaremos en breve.',
          mantenimiento: true,
        },
        {
          status: 503,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Retry-After': '60',
          },
        }
      );
    }

    // Para todas las páginas, inyectar cabeceras estrictas contra caché y permitir que RootLayout renderice MaintenanceScreen
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('x-maintenance-active', 'true');
    return response;
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Si no hay configuración de Supabase, permitir la petición para evitar bloqueos
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
        if (headers) {
          Object.entries(headers).forEach(([key, val]) =>
            response.headers.set(key, val)
          );
        }
      },
    },
  });

  // Validar sesión del usuario con Supabase Auth (getUser valida el JWT contra el servidor de Auth)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname === '/login';

  // Si no está autenticado y no está en /login, redirigir a /login
  if (!user && !isLoginPage) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    return NextResponse.redirect(redirectUrl);
  }

  // Si el usuario ya está autenticado y trata de ir a /login, redirigir directamente al POS (/)
  if (user && isLoginPage) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/';
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

// Exportación principal y alias de compatibilidad
export const middleware = proxy;
export default proxy;

export const config = {
  matcher: [
    /*
     * Aplica protección a todas las rutas excepto:
     * - api (rutas de backend API)
     * - _next/static (archivos estáticos compilados)
     * - _next/image (optimización de imágenes)
     * - favicon.ico, sitemap.xml, robots.txt
     * - archivos estáticos con extensiones comunes (png, svg, jpg, jpeg, gif, webp, woff, woff2)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2)$).*)',
  ],
};
