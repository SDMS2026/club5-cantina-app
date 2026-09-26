'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Eye, EyeOff, Loader2, AlertCircle, ArrowRight, ShieldCheck, Star, Sparkles, Heart } from 'lucide-react';
import { supabase, MANTENER_SESION_KEY } from '@/lib/supabaseClient';
import { iniciarTransicionRuta } from '@/components/PageTransitionLoader';
import { KirbyEmailField } from '@/components/KirbyEmailField';
import { useTheme } from '@/components/ThemeContext';

export default function LoginPage() {
  const router = useRouter();
  const { isKirby: isKirbyMode, setKirby: setIsKirbyMode } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mantenerSesion, setMantenerSesion] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cargar preferencia previa de sesión
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const guardado = localStorage.getItem(MANTENER_SESION_KEY);
      if (guardado !== null) {
        setMantenerSesion(guardado !== 'false');
      }
    }
  }, []);


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
      if (typeof window !== 'undefined') {
        localStorage.setItem(MANTENER_SESION_KEY, String(mantenerSesion));
      }

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
    } catch (err: unknown) {
      console.error('Error durante autenticación:', err);
      setErrorMsg('Ocurrió un error inesperado de conexión. Verifica tu internet e inténtalo de nuevo.');
    } finally {
      setCargando(false);
    }
  };

  const anioActual = new Date().getFullYear();

  return (
    <div
      className={`relative min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden transition-all duration-500 ease-out ${
        isKirbyMode
          ? 'bg-gradient-to-br from-[#FFF0F4] via-[#FFE5EE] to-[#FFD8E6] dark:from-[#1A0C14] dark:via-[#220F1C] dark:to-[#170912]'
          : 'bg-[#F8FAFC] dark:bg-[#090D16]'
      }`}
    >
      {/* Elementos decorativos de fondo con animación suave */}
      {isKirbyMode ? (
        <>
          {/* Nubes y estrellas pastel flotantes en modo Kirby */}
          <div
            className="absolute top-[-5%] left-[-5%] w-96 h-96 rounded-full bg-pink-300/35 dark:bg-pink-600/15 blur-3xl pointer-events-none"
            aria-hidden="true"
          />
          <div
            className="absolute bottom-[-10%] right-[-10%] w-[450px] h-[450px] rounded-full bg-rose-300/30 dark:bg-rose-600/15 blur-3xl pointer-events-none"
            aria-hidden="true"
          />

          {/* Estrellitas flotantes decorativas en el fondo */}
          <motion.div
            animate={{ y: [0, -10, 0], rotate: [0, 15, 0] }}
            transition={{ repeat: Infinity, duration: 4.5, ease: 'easeInOut' }}
            className="absolute top-12 left-10 sm:left-24 text-amber-400/80 text-2xl select-none pointer-events-none drop-shadow-sm"
          >
            ✦
          </motion.div>
          <motion.div
            animate={{ y: [0, 8, 0], rotate: [0, -12, 0] }}
            transition={{ repeat: Infinity, duration: 3.8, ease: 'easeInOut', delay: 0.5 }}
            className="absolute bottom-20 left-12 sm:left-32 text-pink-400/70 text-xl select-none pointer-events-none"
          >
            ★
          </motion.div>
          <motion.div
            animate={{ y: [0, -12, 0], scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut', delay: 1 }}
            className="absolute top-24 right-10 sm:right-28 text-rose-400/80 text-3xl select-none pointer-events-none drop-shadow-sm"
          >
            ✦
          </motion.div>
          <motion.div
            animate={{ y: [0, 10, 0], rotate: [0, 20, 0] }}
            transition={{ repeat: Infinity, duration: 4.2, ease: 'easeInOut', delay: 1.5 }}
            className="absolute bottom-24 right-12 sm:right-36 text-amber-300/70 text-2xl select-none pointer-events-none"
          >
            ★
          </motion.div>
        </>
      ) : (
        <>
          {/* Elementos decorativos del modo estándar */}
          <div
            className="absolute top-[-10%] left-[-10%] w-96 h-96 rounded-full bg-blue-300/25 dark:bg-blue-600/10 blur-3xl pointer-events-none"
            aria-hidden="true"
          />
          <div
            className="absolute bottom-[-10%] right-[-10%] w-96 h-96 rounded-full bg-amber-300/20 dark:bg-amber-600/10 blur-3xl pointer-events-none"
            aria-hidden="true"
          />
        </>
      )}

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className={`relative z-10 w-full transition-all duration-500 ease-out ${
          isKirbyMode ? 'max-w-[450px]' : 'max-w-[420px]'
        }`}
      >
        {/* Tarjeta del formulario con transición fluida */}
        <div
          className={`backdrop-blur-md rounded-3xl p-6 sm:p-8 relative transition-all duration-500 ease-out ${
            isKirbyMode
              ? 'bg-white/95 dark:bg-[#20101A]/95 border-2 border-[#FFCCD8] dark:border-[#522538] shadow-2xl shadow-pink-300/35 dark:shadow-pink-950/50'
              : 'bg-white/95 dark:bg-[#111726]/95 border border-gray-100 dark:border-slate-800 shadow-xl dark:shadow-black/60'
          }`}
        >
          {/* Botón Switch / Toggle Discreto en la esquina superior derecha */}
          <div className="absolute top-4 right-4 sm:top-5 sm:right-5 z-20">
            {isKirbyMode ? (
              <button
                type="button"
                onClick={() => setIsKirbyMode(false)}
                className="px-2.5 py-1 rounded-full border border-pink-300 bg-pink-50/90 dark:bg-pink-950/70 text-[#8A2548] dark:text-pink-200 font-bold text-[11px] flex items-center gap-1.5 shadow-xs hover:bg-pink-100 dark:hover:bg-pink-900/60 hover:scale-105 active:scale-95 transition-all"
                title="Volver al Modo Estándar"
                aria-label="Desactivar Modo Kirby"
              >
                <span className="text-amber-400">★</span>
                <span>Modo Kirby</span>
                <span className="text-pink-400 text-[10px] ml-0.5">✕</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsKirbyMode(true)}
                className="p-2 rounded-2xl border border-gray-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 text-gray-500 hover:text-pink-500 hover:border-pink-300 hover:bg-pink-50/60 dark:hover:bg-pink-950/30 transition-all duration-300 shadow-2xs hover:scale-105 active:scale-95 group"
                title="Activar Modo Kirby ✦"
                aria-label="Activar Modo Kirby"
              >
                <Star className="h-4 w-4 fill-amber-300/40 text-amber-500 group-hover:fill-pink-400 group-hover:text-pink-500 transition-colors" />
              </button>
            )}
          </div>

          {/* Cabecera / Branding Club 5 */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative mb-3 flex items-center justify-center">
              <div
                className={`h-16 w-16 relative flex items-center justify-center rounded-2xl shadow-xs transition-all duration-500 ${
                  isKirbyMode
                    ? 'bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-950/40 dark:to-rose-950/30 border border-pink-200/90 dark:border-pink-900/50 ring-4 ring-pink-100/60'
                    : 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-200/80 dark:border-amber-900/50'
                }`}
              >
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
                <span
                  className={`transition-colors duration-500 ${
                    isKirbyMode
                      ? 'text-[#C72352] dark:text-pink-300 drop-shadow-[0_2px_0_#FFAEC0]'
                      : 'text-[#0E52A0] dark:text-white drop-shadow-[0_2px_0_#FACC15] dark:drop-shadow-none'
                  }`}
                >
                  Club
                </span>
                <span
                  className={`relative inline-flex items-center justify-center rounded-xl px-2.5 py-0.5 font-black text-2xl shadow-xs -rotate-3 transition-all duration-500 ${
                    isKirbyMode
                      ? 'bg-gradient-to-br from-pink-400 via-rose-400 to-pink-500 text-white ring-2 ring-pink-200'
                      : 'bg-gradient-to-br from-yellow-300 via-amber-400 to-amber-500 text-[#0A3D78] ring-2 ring-yellow-200/80'
                  }`}
                >
                  5
                </span>
              </span>
            </div>

            <p
              className={`font-[family-name:var(--font-brand)] text-xs font-bold tracking-wide mb-2 transition-colors duration-500 ${
                isKirbyMode
                  ? 'text-[#A0284F] dark:text-pink-400'
                  : 'text-amber-700/90 dark:text-amber-400'
              }`}
            >
              Cantina Escolar
            </p>

            <h1 className="text-lg font-bold text-gray-900 dark:text-white mt-1 transition-colors">
              Iniciar Sesión
            </h1>
            <p
              className={`text-xs mt-0.5 transition-colors duration-300 ${
                isKirbyMode
                  ? 'text-pink-600 dark:text-pink-300 font-medium'
                  : 'text-gray-500 dark:text-slate-400'
              }`}
            >
              {isKirbyMode
                ? '✦ ¡Bienvenido a Club 5 en Modo Kirby! ✦'
                : 'Ingresa tus credenciales para acceder al sistema'}
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
            {/* Campo Correo Electrónico (Con soporte interactivo de Kirby y animación de aspirar) */}
            <KirbyEmailField
              email={email}
              setEmail={setEmail}
              cargando={cargando}
              isKirbyMode={isKirbyMode}
            />

            {/* Campo Contraseña */}
            <div>
              <label
                htmlFor="password"
                className={`block text-xs font-semibold mb-1.5 transition-colors ${
                  isKirbyMode
                    ? 'text-[#8A2548] dark:text-pink-300 font-bold'
                    : 'text-gray-700 dark:text-slate-300'
                }`}
              >
                Contraseña
              </label>
              <div className="relative">
                <div
                  className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors ${
                    isKirbyMode ? 'text-pink-400' : 'text-gray-400 dark:text-slate-500'
                  }`}
                >
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
                  className={`w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm transition-all duration-300 disabled:opacity-60 outline-none ${
                    isKirbyMode
                      ? 'border-[#FFB3C6] focus:border-[#FF527B] bg-[#FFF8FA] dark:bg-[#1C0D17] text-gray-900 dark:text-pink-100 placeholder:text-pink-300/80 dark:placeholder:text-pink-600/70 focus:ring-4 focus:ring-pink-300/30 shadow-inner'
                      : 'border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/80 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#0E52A0]/25 focus:border-[#0E52A0]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword(!mostrarPassword)}
                  disabled={cargando}
                  className={`absolute inset-y-0 right-0 pr-3.5 flex items-center transition disabled:opacity-50 ${
                    isKirbyMode
                      ? 'text-pink-400 hover:text-pink-600'
                      : 'text-gray-400 hover:text-gray-600 dark:hover:text-slate-200'
                  }`}
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

            {/* Casilla Mantener sesión iniciada (Persistencia en iOS) */}
            <div className="flex items-center justify-between pt-0.5 px-0.5">
              <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  id="mantenerSesion"
                  checked={mantenerSesion}
                  onChange={(e) => setMantenerSesion(e.target.checked)}
                  disabled={cargando}
                  className={`h-4 w-4 rounded cursor-pointer transition-all ${
                    isKirbyMode
                      ? 'accent-pink-500 text-pink-500 focus:ring-pink-400'
                      : 'accent-[#0E52A0] text-[#0E52A0] focus:ring-blue-500'
                  }`}
                />
                <span
                  className={`text-xs font-semibold transition-colors ${
                    isKirbyMode
                      ? 'text-[#8A2548] dark:text-pink-300 group-hover:text-pink-600'
                      : 'text-gray-600 dark:text-slate-400 group-hover:text-gray-900 dark:group-hover:text-slate-200'
                  }`}
                >
                  Mantener sesión iniciada
                </span>
              </label>
            </div>

            {/* Botón de Enviar */}
            <button
              type="submit"
              disabled={cargando}
              className={`w-full mt-2 py-3 px-4 rounded-xl text-white font-bold text-sm active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed ${
                isKirbyMode
                  ? 'bg-gradient-to-r from-[#FF5E86] via-[#FF3D6E] to-[#FF2456] hover:from-[#FF4573] hover:to-[#E51848] shadow-lg shadow-pink-500/25 ring-2 ring-pink-300/40'
                  : 'bg-gradient-to-r from-[#0E52A0] to-[#1665C0] hover:from-[#0a4282] hover:to-[#0E52A0] shadow-md hover:shadow-lg shadow-blue-900/10'
              }`}
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
          <div
            className={`mt-6 pt-5 border-t flex items-center justify-center gap-1.5 text-[11px] transition-colors duration-300 ${
              isKirbyMode
                ? 'border-pink-100 dark:border-pink-950/60 text-pink-700/90 dark:text-pink-300/80 font-medium'
                : 'border-gray-100 dark:border-slate-800 text-gray-500'
            }`}
          >
            {isKirbyMode ? (
              <Heart className="h-3.5 w-3.5 fill-pink-400 text-pink-500" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            )}
            <span>Acceso seguro protegido por Supabase Auth</span>
          </div>
        </div>

        {/* Crédito de SyncLogic y Copyright */}
        <div className="mt-6 flex flex-col items-center gap-1 text-center">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
            <span>Desarrollado con excelencia por</span>
            <span className="inline-flex items-center gap-1.5 font-bold text-gray-800 dark:text-slate-200">
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
          <p className="text-[11px] text-gray-400 dark:text-slate-500">
            &copy; {anioActual} Club 5 Cantina Escolar. Todos los derechos reservados.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
