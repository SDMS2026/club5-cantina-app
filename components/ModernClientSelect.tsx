'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronDown, User, Check, X, UserCheck, AlertCircle } from 'lucide-react';
import { Cliente } from '@/types/pos';
import { ResumenSaldoCliente } from '@/lib/clientBalance';
import { formatUSD } from '@/lib/utils';

interface ModernClientSelectProps {
  clientes: Cliente[];
  clienteSeleccionado: Cliente | null;
  onSeleccionarCliente: (cliente: Cliente | null) => void;
  saldosClientes?: Record<string, ResumenSaldoCliente>;
  placeholder?: string;
  error?: string | null;
}

export function ModernClientSelect({
  clientes,
  clienteSeleccionado,
  onSeleccionarCliente,
  saldosClientes = {},
  placeholder = 'Buscar o seleccionar cliente...',
  error,
}: ModernClientSelectProps) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cerrar al hacer clic fuera del dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Foco al abrir
  useEffect(() => {
    if (abierto && inputRef.current) {
      inputRef.current.focus();
    }
  }, [abierto]);

  const clientesFiltrados = useMemo(() => {
    if (!busqueda.trim()) return clientes;
    const query = busqueda.toLowerCase().trim();
    return clientes.filter((c) => {
      const nom = c.nombre_estudiante.toLowerCase();
      const grado = (c.grado_seccion || '').toLowerCase();
      const rep = (c.nombre_representante || '').toLowerCase();
      const tel = (c.telefono_whatsapp || '').toLowerCase();
      return nom.includes(query) || grado.includes(query) || rep.includes(query) || tel.includes(query);
    });
  }, [clientes, busqueda]);

  const saldo = clienteSeleccionado ? saldosClientes[clienteSeleccionado.id] : null;

  return (
    <div ref={containerRef} className="relative w-full">
      {clienteSeleccionado ? (
        // Tarjeta de Cliente Seleccionado estilizada y moderna
        <div className="rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/70 via-indigo-50/30 to-blue-50/40 dark:from-indigo-950/40 dark:via-slate-900/50 dark:to-blue-950/20 p-3 sm:p-3.5 transition-all shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
                <UserCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-xs sm:text-sm text-gray-900 dark:text-slate-100 truncate">
                    {clienteSeleccionado.nombre_estudiante}
                  </h4>
                  <span className="shrink-0 rounded-full bg-indigo-100/90 dark:bg-indigo-900/60 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                    {clienteSeleccionado.grado_seccion || 'General'}
                  </span>
                </div>
                {clienteSeleccionado.nombre_representante && (
                  <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate">
                    Rep: {clienteSeleccionado.nombre_representante}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onSeleccionarCliente(null);
                setBusqueda('');
                setAbierto(true);
              }}
              className="shrink-0 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 transition active:scale-95 shadow-2xs"
            >
              Cambiar
            </button>
          </div>

          {/* Resumen Financiero del Cliente Seleccionado */}
          <div className="mt-2.5 pt-2 border-t border-indigo-100/80 dark:border-indigo-950/80 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-white/70 dark:bg-slate-900/60 p-2 border border-gray-100 dark:border-slate-800/80">
              <span className="text-gray-500 dark:text-slate-400 text-[10px] font-medium block">
                Deuda Pendiente:
              </span>
              <p className={`font-mono font-bold text-xs ${
                (saldo?.deudaTotalUsd || 0) > 0 ? 'text-amber-800 dark:text-amber-300' : 'text-gray-700 dark:text-slate-300'
              }`}>
                {formatUSD(saldo?.deudaTotalUsd || 0)}
              </p>
            </div>
            <div className="rounded-xl bg-white/70 dark:bg-slate-900/60 p-2 border border-gray-100 dark:border-slate-800/80">
              <span className="text-gray-500 dark:text-slate-400 text-[10px] font-medium block">
                Saldo a Favor:
              </span>
              <p className={`font-mono font-bold text-xs ${
                (saldo?.saldoAFavorTotalUsd || 0) > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-700 dark:text-slate-300'
              }`}>
                +{formatUSD(saldo?.saldoAFavorTotalUsd || 0)}
              </p>
            </div>
          </div>
        </div>
      ) : (
        // Selector desplegable no seleccionado
        <div>
          <button
            type="button"
            onClick={() => setAbierto(!abierto)}
            className={`w-full flex items-center justify-between rounded-2xl border px-3.5 py-2.5 text-xs font-medium text-left transition-all ${
              error
                ? 'border-rose-400 bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200'
                : abierto
                ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 shadow-xs'
                : 'border-gray-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <User className="h-4 w-4 text-gray-400 dark:text-slate-500 shrink-0" />
              <span className="truncate">{placeholder}</span>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-gray-400 transition-transform duration-200 shrink-0 ${
                abierto ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : ''
              }`}
            />
          </button>

          {/* Menú Dropdown Moderno con Buscador */}
          {abierto && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1.5 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#111726] p-2 shadow-xl animate-in fade-in zoom-in-95 duration-150">
              {/* Barra de búsqueda interna */}
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 dark:text-slate-500" />
                <input
                  ref={inputRef}
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Escribe para filtrar clientes..."
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-900/80 py-1.5 pl-8 pr-7 text-xs text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900"
                />
                {busqueda && (
                  <button
                    type="button"
                    onClick={() => setBusqueda('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Lista con scroll suave */}
              <div className="max-h-56 overflow-y-auto overscroll-contain space-y-1 pr-1">
                {clientesFiltrados.length === 0 ? (
                  <div className="py-4 text-center text-xs text-gray-400 dark:text-slate-500">
                    No se encontraron clientes para &quot;{busqueda}&quot;
                  </div>
                ) : (
                  clientesFiltrados.map((cl) => {
                    const s = saldosClientes[cl.id];
                    const tieneDeuda = (s?.deudaTotalUsd || 0) > 0;
                    const tieneSaldo = (s?.saldoAFavorTotalUsd || 0) > 0;

                    return (
                      <button
                        key={cl.id}
                        type="button"
                        onClick={() => {
                          onSeleccionarCliente(cl);
                          setAbierto(false);
                          setBusqueda('');
                        }}
                        className="w-full flex items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition hover:bg-indigo-50/70 dark:hover:bg-slate-800/80 group"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-gray-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                              {cl.nombre_estudiante}
                            </span>
                          </div>
                          <span className="text-[11px] text-gray-500 dark:text-slate-400">
                            {cl.grado_seccion || 'Sin sección'}
                          </span>
                        </div>

                        {/* Badges de balance financiero */}
                        <div className="shrink-0 flex items-center gap-1 text-[11px] font-mono font-bold">
                          {tieneDeuda && (
                            <span className="rounded-lg bg-amber-100/80 dark:bg-amber-950/60 px-1.5 py-0.5 text-amber-800 dark:text-amber-300">
                              Debe: {formatUSD(s.deudaTotalUsd)}
                            </span>
                          )}
                          {tieneSaldo && (
                            <span className="rounded-lg bg-emerald-100/80 dark:bg-emerald-950/60 px-1.5 py-0.5 text-emerald-800 dark:text-emerald-300">
                              +{formatUSD(s.saldoAFavorTotalUsd)}
                            </span>
                          )}
                          {!tieneDeuda && !tieneSaldo && (
                            <span className="rounded-lg bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 text-gray-500 dark:text-slate-400 text-[10px]">
                              $0.00
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
