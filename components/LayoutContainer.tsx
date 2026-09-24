'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useSidebar } from './SidebarContext';
import { Sidebar } from './Sidebar';
import { NotificationsProvider } from './NotificationsContext';
import { WelcomeSessionToast } from './WelcomeSessionToast';
import { Footer } from './Footer';
import { motion, AnimatePresence } from 'framer-motion';

export function LayoutContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { abierto, setAbierto } = useSidebar();

  // Reseteo automático de desplazamiento en iOS Safari al cerrar teclados virtuales
  React.useEffect(() => {
    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.scrollTo({ left: 0, top: window.scrollY, behavior: 'instant' });
          }
        }, 60);
      }
    };

    document.addEventListener('focusout', handleFocusOut);
    return () => document.removeEventListener('focusout', handleFocusOut);
  }, []);

  // En la pantalla de inicio de sesión no mostrar Sidebar, Toast ni Footer estándar
  if (pathname === '/login') {
    return (
      <main className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center">
        {children}
      </main>
    );
  }

  return (
    <NotificationsProvider>
      <div className="relative min-h-screen flex flex-col bg-[#FAFAFA] overflow-x-hidden">
        {/* Notificación suave de bienvenida en la sesión */}
        <WelcomeSessionToast />

        {/* Sidebar con animación lenta y apertura progresiva */}
        <Sidebar />

        {/* Backdrop semi-transparente en pantallas móviles al abrir el sidebar */}
        <AnimatePresence>
          {abierto && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setAbierto(false)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
              aria-hidden="true"
            />
          )}
        </AnimatePresence>

        {/* Contenedor principal con transición progresiva y suave sincronizada */}
        <div
          className={`flex-1 flex flex-col min-h-screen overflow-x-hidden transition-[padding] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[padding] ${
            abierto ? 'md:pl-64' : 'pl-0'
          }`}
        >
          <div className="flex-1 flex flex-col min-w-0 w-full max-w-full overflow-x-hidden">{children}</div>
          <Footer />
        </div>
      </div>
    </NotificationsProvider>
  );
}
