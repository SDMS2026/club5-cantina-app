'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RefreshCw, Home, Users } from 'lucide-react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Next.js route error capturado:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#FAFAFA] dark:bg-[#090D16]">
      <div className="w-full max-w-md rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-6 shadow-xl text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 mb-4 shadow-xs">
          <AlertCircle className="h-7 w-7" />
        </div>

        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          Recuperación de pantalla
        </h2>

        <p className="mt-2 text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
          Ha ocurrido una discrepancia en la vista actual. Puedes reiniciar este módulo o volver a una sección segura del sistema sin perder datos.
        </p>

        {error?.message && (
          <div className="mt-3 rounded-xl bg-gray-50 dark:bg-slate-900/80 p-2.5 text-[11px] font-mono text-gray-500 dark:text-slate-400 text-left overflow-x-auto max-h-24">
            {error.message}
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 text-xs font-bold transition shadow-xs active:scale-95"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Recargar Módulo</span>
          </button>

          <Link
            href="/estudiantes"
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 px-4 py-2.5 text-xs font-bold transition shadow-2xs active:scale-95"
          >
            <Users className="h-4 w-4 text-indigo-500" />
            <span>Estudiantes</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
