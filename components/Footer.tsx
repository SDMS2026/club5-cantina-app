'use client';

import React from 'react';
import Image from 'next/image';

export function Footer() {
  const anioActual = new Date().getFullYear();

  return (
    <footer className="mt-auto w-full border-t border-gray-100 dark:border-slate-800/80 bg-white/70 dark:bg-[#0f172a]/60 py-4 backdrop-blur-xs transition-colors">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2.5 px-4 text-xs text-gray-400 dark:text-slate-500 sm:flex-row sm:px-6 lg:px-8">
        {/* Copyright dinámico */}
        <p className="text-center sm:text-left text-[11px] sm:text-xs text-gray-400 dark:text-slate-500 font-medium">
          &copy; {anioActual} Club 5 Cantina Escolar. Todos los derechos reservados.
        </p>

        {/* Crédito SyncLogic con logo en pequeño */}
        <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-gray-500 dark:text-slate-400">
          <span>Desarrollado por</span>
          <span className="inline-flex items-center gap-1.5 font-bold text-gray-800 dark:text-slate-200 transition hover:text-cyan-500">
            <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
              <Image
                src="/synclogic-logo.png"
                alt="SyncLogic Logo"
                width={18}
                height={18}
                className="h-full w-full object-contain"
              />
            </span>
            <span className="tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-700 font-extrabold">
              SyncLogic
            </span>
          </span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
