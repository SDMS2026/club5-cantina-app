'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { iniciarTransicionRuta } from '@/components/PageTransitionLoader';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const emailLimpio = email.trim();
    if (!emailLimpio || !password) {
      setErrorMsg('Por favor ingresa tanto tu correo como tu contraseña.');
      return;
    }

    try {
      setCargando(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailLimpio,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setErrorMsg('Credenciales inválidas. Verifica que el correo y la contraseña sean correctos.');
        } else if (error.message.includes('Email not confirmed')) {
          setErrorMsg('El correo electrónico no ha sido confirmado aún en Supabase.');
        } else if (error.message.includes('Too many requests')) {
          setErrorMsg('Demasiados intentos. Por favor espera un momento antes de volver a intentar.');
        } else {
          setErrorMsg(error.message || 'Error al iniciar sesión. Inténtalo de nuevo.');
        }
        return;
      }

      if (data?.session) {
        // Redirigir al POS y refrescar router para actualizar la sesión en Next.js
        iniciarTransicionRuta();
        router.push('/');
        router.refresh();
      }
    } catch (err: any) {
      console.error('Error durante autenticación:', err);
      setErrorMsg('Ocurrió un error inesperado de conexión. Verifica tu internet e inténtalo de nuevo.');
    } finally {
      setCargando(false);
    }
  };

  const anioActual = new Date().getFullYear();

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden bg-[#F8FAFC] dark:bg-[#090D16] transition-colors">
      {/* Elementos decorativos de fondo sutiles */}
      <div
        className="absolute top-[-10%] left-[-10%] w-96 h-96 rounded-full bg-blue-300/25 dark:bg-blue-600/10 blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-[-10%] right-[-10%] w-96 h-96 rounded-full bg-amber-300/20 dark:bg-amber-600/10 blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[420px]"
      >
        {/* Tarjeta del formulario */}
        <div className="bg-white/95 dark:bg-[#111726]/95 backdrop-blur-md rounded-3xl border border-gray-100 dark:border-slate-800 shadow-xl dark:shadow-black/60 p-6 sm:p-8">
          {/* Cabecera / Branding Club 5 */}
          <div className="flex flex-col items-center text-center mb-7">
            <div className="relative mb-3 flex items-center justify-center">
              <div className="h-16 w-16 relative flex items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-200/80 dark:border-amber-900/50 shadow-xs">
                <Image
                  src="/club5logo-transparent.png"
                  alt="Club 5 Logo"
                  width={52}
                  height={52}
                  priority
                  className="object-contain drop-shadow-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-center mb-1">
              <span className="font-[family-name:var(--font-brand)] text-3xl font-black tracking-tight inline-flex items-center gap-1 select-none">
                <span className="text-[#0E52A0] dark:text-blue-400 drop-shadow-[0_2px_0_#FACC15]">Club</span>
                <span className="relative inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-yellow-300 via-amber-400 to-amber-500 px-2.5 py-0.5 text-[#0A3D78] font-black text-2xl shadow-xs ring-2 ring-yellow-200/80 -rotate-3">
                  5
                </span>
              </span>
            </div>

            <p className="font-[family-name:var(--font-brand)] text-xs font-bold tracking-wide text-amber-700/90 dark:text-amber-400 mb-2">
              Cantina Escolar
            </p>

            <h1 className="text-lg font-bold text-gray-900 dark:text-white mt-2">Iniciar Sesión</h1>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Ingresa tus credenciales para acceder al sistema
            </p>
          </div>

          {/* Alerta de Error */}
          <AnimatePresence>
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden mb-5"
              >
                <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-800 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                  <span className="leading-relaxed font-medium">{errorMsg}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo Correo */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5"
              >
                Correo Electrónico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 dark:text-slate-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@cantina.com"
                  autoComplete="email"
                  autoCapitalize="none"
                  required
                  disabled={cargando}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/80 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0E52A0]/25 focus:border-[#0E52A0] transition disabled:opacity-60"
                />
              </div>
            </div>

            {/* Campo Contraseña */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5"
              >
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 dark:text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  type={mostrarPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  disabled={cargando}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/80 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0E52A0]/25 focus:border-[#0E52A0] transition disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword(!mostrarPassword)}
                  disabled={cargando}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition disabled:opacity-50"
                  title={mostrarPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {mostrarPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Botón de Enviar */}
            <button
              type="submit"
              disabled={cargando}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-[#0E52A0] to-[#1665C0] hover:from-[#0a4282] hover:to-[#0E52A0] text-white font-bold text-sm shadow-md hover:shadow-lg shadow-blue-900/10 active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {cargando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <span>Validando credenciales...</span>
                </>
              ) : (
                <>
                  <span>Entrar al Sistema</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Seguridad y Estado */}
          <div className="mt-6 pt-5 border-t border-gray-100 flex items-center justify-center gap-1.5 text-[11px] text-gray-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Acceso seguro protegido por Supabase Auth</span>
          </div>
        </div>

        {/* Crédito de SyncLogic y Copyright */}
        <div className="mt-6 flex flex-col items-center gap-1 text-center">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span>Desarrollado con excelencia por</span>
            <span className="inline-flex items-center gap-1.5 font-bold text-gray-800">
              <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
                <Image
                  src="/synclogic-logo.png"
                  alt="SyncLogic Logo"
                  width={16}
                  height={16}
                  className="h-full w-full object-contain"
                />
              </span>
              <span className="tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-700 font-extrabold">
                SyncLogic
              </span>
            </span>
          </div>
          <p className="text-[11px] text-gray-400">
            &copy; {anioActual} Club 5 Cantina Escolar. Todos los derechos reservados.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
