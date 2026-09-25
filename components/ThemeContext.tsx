'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const THEME_STORAGE_KEY = 'club5_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [montado, setMontado] = useState(false);

  // Inicializar el tema desde localStorage o preferencia del sistema
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
    } catch {
      // Fallback a modo claro
      setThemeState('light');
    }
  }, []);

  const aplicarClaseTema = (nuevoTema: Theme) => {
    if (typeof document !== 'undefined') {
      // Bloquear temporalmente transiciones en masa en toda la página para evitar caída a 4 FPS
      // mientras se permite que el toggle animado fluya suavemente a 60fps
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

      const root = document.documentElement;
      if (nuevoTema === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }

      // Forzar un reflow instantáneo en un único fotograma
      if (document.body) {
        void document.body.offsetHeight;
      }

      // Liberar el bloqueo tras el fotograma de cambio
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const l = document.getElementById('theme-transition-lock');
          if (l) {
            l.remove();
          }
        });
      });
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

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme === 'dark',
        toggleTheme,
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    // Si se usa fuera del Provider, retornar fallback seguro
    return {
      theme: 'light',
      isDark: false,
      toggleTheme: () => {},
      setTheme: () => {},
    };
  }
  return context;
}
