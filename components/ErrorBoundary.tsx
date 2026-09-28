'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Users } from 'lucide-react';
import Link from 'next/link';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary capturó una excepción no controlada:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-rose-200/80 dark:border-rose-900/60 bg-white dark:bg-[#0D111A] p-6 shadow-xl text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mb-4 shadow-xs">
              <AlertTriangle className="h-7 w-7" />
            </div>

            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {this.props.fallbackTitle || 'Algo no salió como se esperaba'}
            </h2>

            <p className="mt-2 text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
              {this.props.fallbackMessage ||
                'Ocurrió un problema temporal al procesar la información. No te preocupes, tus datos en Supabase están seguros.'}
            </p>

            {this.state.error?.message && (
              <div className="mt-3 rounded-xl bg-gray-50 dark:bg-slate-900/80 p-2.5 text-[11px] font-mono text-rose-600 dark:text-rose-400 text-left overflow-x-auto max-h-24">
                {this.state.error.message}
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 text-xs font-bold transition shadow-xs active:scale-95"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Reintentar y Recargar</span>
              </button>

              <Link
                href="/estudiantes"
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 px-4 py-2.5 text-xs font-bold transition shadow-2xs active:scale-95"
              >
                <Users className="h-4 w-4 text-indigo-500" />
                <span>Ir a Estudiantes</span>
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
