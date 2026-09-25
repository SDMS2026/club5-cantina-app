'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Star, Sparkles } from 'lucide-react';
import { KirbyAvatar, KirbyState } from './KirbyAvatar';

interface KirbyEmailFieldProps {
  email: string;
  setEmail: (val: string) => void;
  cargando: boolean;
  isKirbyMode: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}

export function KirbyEmailField({
  email,
  setEmail,
  cargando,
  isKirbyMode,
  onFocus,
  onBlur,
}: KirbyEmailFieldProps) {
  const [kirbyState, setKirbyState] = useState<KirbyState>('idle');
  const [aspirandoLetras, setAspirandoLetras] = useState<string[]>([]);
  const [enSuccion, setEnSuccion] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Manejo de la animación interactiva de succión / comer texto
  const handleAspirarTexto = () => {
    if (enSuccion || cargando) return;

    if (!email.trim()) {
      // Si el campo está vacío, Kirby hace un baile tierno
      setKirbyState('happy');
      setTimeout(() => setKirbyState('idle'), 1100);
      return;
    }

    const caracteres = email.split('');
    setAspirandoLetras(caracteres);
    setEnSuccion(true);
    setKirbyState('inhaling');

    // 1. Duración del vuelo de las letras hacia la boca de Kirby
    const duracionVuelo = Math.min(650, 350 + caracteres.length * 20);

    setTimeout(() => {
      // 2. Kirby termina de aspirar la última letra y se infla con la boca llena
      setEmail('');
      setAspirandoLetras([]);
      setKirbyState('full');

      // 3. Kirby mastica y traga feliz
      setTimeout(() => {
        setKirbyState('happy');

        // 4. Regresa a estado normal
        setTimeout(() => {
          setKirbyState('idle');
          setEnSuccion(false);
          inputRef.current?.focus();
        }, 800);
      }, 650);
    }, duracionVuelo);
  };

  const handleInputFocus = () => {
    if (!enSuccion) setKirbyState('watching');
    onFocus?.();
  };

  const handleInputBlur = () => {
    if (!enSuccion) setKirbyState('idle');
    onBlur?.();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (enSuccion) return;
    setEmail(e.target.value);
    if (!enSuccion) setKirbyState('watching');
  };

  if (!isKirbyMode) {
    // Modo Estándar: Diseño limpio corporativo Club 5
    return (
      <div>
        <label
          htmlFor="email"
          className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5 transition-colors"
        >
          Correo Electrónico
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 dark:text-slate-500">
            <Mail className="h-4 w-4" />
          </div>
          <input
            ref={inputRef}
            id="email"
            type="email"
            value={email}
            onChange={handleInputChange}
            placeholder="ejemplo@cantina.com"
            autoComplete="email"
            autoCapitalize="none"
            required
            disabled={cargando}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/80 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0E52A0]/25 focus:border-[#0E52A0] transition disabled:opacity-60"
          />
        </div>
      </div>
    );
  }

  // Modo Kirby: Diseño pastel con nube envolvente y Kirby interactivo al lado
  return (
    <div className="relative pt-1 pb-1">
      {/* Nube esponjosa de fondo detrás del input (estilo de la referencia Takagi / Kirby) */}
      <div className="absolute -inset-x-3 -top-3.5 -bottom-3.5 pointer-events-none z-0">
        <svg
          viewBox="0 0 460 120"
          preserveAspectRatio="none"
          className="w-full h-full filter drop-shadow-[0_4px_16px_rgba(255,182,193,0.35)]"
        >
          {/* Nube esponjosa con curvas orgánicas suaves */}
          <path
            d="M 50,75 
               C 30,75 15,60 22,42 
               C 18,22 42,10 65,18 
               C 85,2 125,4 140,24 
               C 165,6 215,8 230,30 
               C 255,14 300,18 315,38 
               C 345,22 385,34 395,58 
               C 415,50 435,66 430,85 
               C 440,105 415,118 385,112 
               C 355,120 290,118 260,110 
               C 220,122 160,118 130,110 
               C 95,120 45,116 35,96 
               C 25,92 35,76 50,75 Z"
            fill="#FFFFFF"
            className="dark:fill-[#281420] transition-colors duration-300"
          />
        </svg>
      </div>

      <div className="relative z-10">
        {/* Etiqueta suave en tono rosado/berry */}
        <div className="flex items-center justify-between mb-1.5 px-1">
          <label
            htmlFor="email"
            className="text-xs font-bold text-[#8A2548] dark:text-pink-300 flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 text-pink-400" />
            <span>Correo Electrónico</span>
          </label>

          {/* Indicador de ayuda interactiva */}
          <span className="text-[10px] font-semibold text-pink-500/80 dark:text-pink-400/80 flex items-center gap-1">
            <span>¡Usa la estrella para que Kirby aspire!</span>
            <span className="text-amber-400">★</span>
          </span>
        </div>

        {/* Fila del input + Kirby al lado */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Contenedor del input con estilo píldora rosada */}
          <div className="relative flex-1 group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-pink-400">
              <Mail className="h-4 w-4" />
            </div>

            <input
              ref={inputRef}
              id="email"
              type="email"
              value={enSuccion ? '' : email}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              placeholder="ejemplo@cantina.com"
              autoComplete="email"
              autoCapitalize="none"
              required
              disabled={cargando || enSuccion}
              className={`w-full pl-10 pr-11 py-2.5 rounded-full border-2 text-sm font-medium transition-all duration-300 outline-none ${
                enSuccion
                  ? 'border-pink-400 bg-pink-100/50 text-transparent'
                  : 'border-[#FFB3C6] hover:border-[#FF8DA7] focus:border-[#FF527B] bg-[#FFF8FA] dark:bg-[#1C0D17] text-gray-900 dark:text-pink-100 placeholder:text-pink-300/80 dark:placeholder:text-pink-600/70 focus:ring-4 focus:ring-pink-300/30 shadow-inner'
              }`}
            />

            {/* Capa de animación: Letras aspiradas hacia Kirby */}
            <AnimatePresence>
              {enSuccion && aspirandoLetras.length > 0 && (
                <div className="absolute inset-y-0 left-10 right-10 flex items-center overflow-visible pointer-events-none z-20">
                  <div className="flex items-center font-mono font-bold text-sm text-[#E0245E]">
                    {aspirandoLetras.map((char, index) => {
                      // Las letras del final (más cerca de Kirby) se aspiran primero
                      const distanciaHaciaKirby = aspirandoLetras.length - 1 - index;
                      const delay = distanciaHaciaKirby * 0.025;

                      return (
                        <motion.span
                          key={`char-${index}`}
                          initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
                          animate={{
                            x: [0, 40, 110, 160],
                            y: [0, -8, 6, 0],
                            scale: [1, 0.9, 0.45, 0],
                            opacity: [1, 1, 0.8, 0],
                            rotate: [0, 25, 90, 180],
                          }}
                          transition={{
                            duration: 0.45,
                            delay,
                            ease: [0.25, 0.1, 0.25, 1],
                          }}
                          className="inline-block"
                        >
                          {char === ' ' ? '\u00A0' : char}
                        </motion.span>
                      );
                    })}
                  </div>
                </div>
              )}
            </AnimatePresence>

            {/* Botón de Estrella interactivo para que Kirby aspire el texto */}
            <button
              type="button"
              onClick={handleAspirarTexto}
              disabled={cargando || enSuccion}
              className={`absolute inset-y-0 right-1.5 my-auto h-8 w-8 rounded-full flex items-center justify-center transition-all ${
                email.length > 0
                  ? 'bg-amber-400 hover:bg-amber-500 text-white shadow-xs hover:scale-110 active:scale-95 animate-pulse'
                  : 'bg-pink-100 hover:bg-pink-200 text-pink-400 hover:text-pink-600'
              }`}
              title={
                email.length > 0
                  ? '¡Haz clic para que Kirby aspire el texto!'
                  : 'Estrella de Kirby ✦'
              }
              aria-label="Aspirar texto con Kirby"
            >
              <motion.div
                animate={
                  enSuccion
                    ? { rotate: 360, scale: [1, 1.25, 1] }
                    : email.length > 0
                    ? { rotate: [0, -10, 10, 0] }
                    : {}
                }
                transition={
                  enSuccion
                    ? { repeat: Infinity, duration: 0.4, ease: 'linear' }
                    : email.length > 0
                    ? { repeat: Infinity, duration: 2, repeatDelay: 1 }
                    : {}
                }
              >
                <Star
                  className={`h-4 w-4 ${
                    email.length > 0 ? 'fill-white text-white' : 'fill-pink-300 text-pink-400'
                  }`}
                />
              </motion.div>
            </button>
          </div>

          {/* Kirby de pie al lado derecho del input */}
          <div className="shrink-0 -mr-2 sm:-mr-3 -my-2 flex items-center justify-center">
            <KirbyAvatar
              state={kirbyState}
              size={94}
              onClick={handleAspirarTexto}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
