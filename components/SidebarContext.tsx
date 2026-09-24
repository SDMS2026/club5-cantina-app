'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface SidebarContextType {
  abierto: boolean;
  setAbierto: (abierto: boolean) => void;
  toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType>({
  abierto: true,
  setAbierto: () => {},
  toggleSidebar: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(true);

  // En pantallas móviles (<768px) iniciar colapsado por defecto
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setAbierto(false);
    }
  }, []);

  const toggleSidebar = () => {
    setAbierto((prev) => !prev);
  };

  return (
    <SidebarContext.Provider
      value={{
        abierto,
        setAbierto,
        toggleSidebar,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export const useSidebar = () => useContext(SidebarContext);
