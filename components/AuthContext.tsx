'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  cargando: boolean;
  isAuthenticated: boolean;
  cerrarSesion: () => Promise<void>;
  refrescarSesion: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  cargando: true,
  isAuthenticated: false,
  cerrarSesion: async () => {},
  refrescarSesion: async () => {},
});

/**
 * Proveedor de Autenticación Optimizado para Club 5.
 * Elimina el polling continuo hacia Supabase Auth:
 * - Consulta getSession() únicamente al inicializar la aplicación.
 * - Escucha cambios de sesión mediante onAuthStateChange (login, logout, refresh de token automático).
 * - Memoriza las funciones y el estado con useMemo y useCallback para prevenir re-renderizados innecesarios.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);

  // 1. Obtener sesión inicial estrictamente UNA VEZ al montar la aplicación
  useEffect(() => {
    let activo = true;

    async function inicializarSesion() {
      try {
        const { data: { session: sesionInicial }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('Aviso al recuperar sesión inicial:', error.message);
        }
        if (activo) {
          setSession(sesionInicial);
          setCargando(false);
        }
      } catch (err) {
        console.error('Error inicializando sesión:', err);
        if (activo) {
          setCargando(false);
        }
      }
    }

    inicializarSesion();

    // 2. Suscripción pasiva a eventos de Auth (sin polling ni peticiones de red repetitivas)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sesionActualizada) => {
      if (activo) {
        setSession(sesionActualizada);
        setCargando(false);
      }
    });

    return () => {
      activo = false;
      subscription.unsubscribe();
    };
  }, []);

  // 3. Callback memorizado para cerrar sesión seguro (evita 502 Bad Gateway con scope: 'local')
  const cerrarSesion = useCallback(async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (err) {
      console.warn('Aviso: error cerrando sesión en Supabase (posible 502), procediendo con purga local:', err);
    } finally {
      // Limpieza exhaustiva de cookies y almacenamiento local para garantizar cierre total
      try {
        if (typeof window !== 'undefined') {
          // Limpiar cookies de sesión
          const cookies = document.cookie.split(';');
          for (const cookie of cookies) {
            const eqPos = cookie.indexOf('=');
            const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
            if (name.startsWith('sb-') || name.startsWith('sb_') || name.includes('supabase') || name.includes('auth')) {
              document.cookie = `${name}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
            }
          }
          // Limpiar localStorage
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('sb-') || key.startsWith('sb_backup_') || key.includes('supabase') || key === 'club5_mantener_sesion')) {
              localStorage.removeItem(key);
            }
          }
          sessionStorage.clear();
        }
      } catch (storageErr) {
        console.warn('Aviso limpiando almacenamiento local:', storageErr);
      }
      setSession(null);
    }
  }, []);

  // 4. Callback memorizado para refrescar sesión solo ante demanda explícita
  const refrescarSesion = useCallback(async () => {
    try {
      const { data: { session: sesionActual } } = await supabase.auth.getSession();
      setSession(sesionActual);
    } catch (err) {
      console.error('Error al refrescar sesión:', err);
    }
  }, []);

  // 5. Estado memorizado para que los componentes consumidores no sufran renders superfluos
  const valorContexto = useMemo<AuthContextType>(() => ({
    session,
    user: session?.user ?? null,
    cargando,
    isAuthenticated: !!session?.user,
    cerrarSesion,
    refrescarSesion,
  }), [session, cargando, cerrarSesion, refrescarSesion]);

  return (
    <AuthContext.Provider value={valorContexto}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook para acceder a la sesión autenticada memorizada de Supabase.
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
}
