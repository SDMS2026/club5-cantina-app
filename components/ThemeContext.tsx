'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  isKirby: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  toggleKirby: () => void;
  setKirby: (activo: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const THEME_STORAGE_KEY = 'club5_theme';
export const KIRBY_STORAGE_KEY = 'club5_kirby';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [isKirby, setIsKirbyState] = useState<boolean>(false);
  const [montado, setMontado] = useState(false);

  // Inicializar el tema y modo Kirby desde localStorage o preferencia del sistema
  useEffect(() => {
    setMontado(true);
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      if (stored === 'dark' || stored === 'light') {
        setThemeState(stored);
        aplicarClaseTema(stored);
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const initialTheme: Theme = prefersDark ? 'dark' : 'light';
        setThemeState(initialTheme);
        aplicarClaseTema(initialTheme);
      }

      const storedKirby = localStorage.getItem(KIRBY_STORAGE_KEY);
      if (storedKirby === 'true') {
        setIsKirbyState(true);
        aplicarClaseKirby(true);
      }
    } catch {
      // Fallback a modo claro y sin Kirby
      setThemeState('light');
      setIsKirbyState(false);
    }
  }, []);

  const bloquearTransiciones = () => {
    if (typeof document === 'undefined') return;
    let lock = document.getElementById('theme-transition-lock');
    if (!lock) {
      lock = document.createElement('style');
      lock.id = 'theme-transition-lock';
      lock.appendChild(
        document.createTextNode(`
          *:not(.ditdot-switch):not(.ditdot-slider):not(.ditdot-slider *) {
            -webkit-transition: none !important;
            -moz-transition: none !important;
            -o-transition: none !important;
            -ms-transition: none !important;
            transition: none !important;
          }
        `)
      );
      document.head.appendChild(lock);
    }

    if (document.body) {
      void document.body.offsetHeight;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const l = document.getElementById('theme-transition-lock');
        if (l) l.remove();
      });
    });
  };

  const aplicarClaseTema = (nuevoTema: Theme) => {
    if (typeof document !== 'undefined') {
      bloquearTransiciones();
      const root = document.documentElement;
      if (nuevoTema === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  };

  const aplicarClaseKirby = (activo: boolean) => {
    if (typeof document !== 'undefined') {
      bloquearTransiciones();
      const root = document.documentElement;
      if (activo) {
        root.classList.add('kirby');
      } else {
        root.classList.remove('kirby');
      }
    }
  };

  const setTheme = (nuevoTema: Theme) => {
    setThemeState(nuevoTema);
    aplicarClaseTema(nuevoTema);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nuevoTema);
    } catch {}
  };

  const toggleTheme = () => {
    const siguienteTema: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(siguienteTema);
  };

  const setKirby = (activo: boolean) => {
    setIsKirbyState(activo);
    aplicarClaseKirby(activo);
    try {
      localStorage.setItem(KIRBY_STORAGE_KEY, String(activo));
    } catch {}
  };

  const toggleKirby = () => {
    setKirby(!isKirby);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme === 'dark',
        isKirby,
        toggleTheme,
        setTheme,
        toggleKirby,
        setKirby,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: 'light',
      isDark: false,
      isKirby: false,
      toggleTheme: () => {},
      setTheme: () => {},
      toggleKirby: () => {},
      setKirby: () => {},
    };
  }
  return context;
}
