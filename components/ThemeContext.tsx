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
      const root = document.documentElement;
      if (nuevoTema === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
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
