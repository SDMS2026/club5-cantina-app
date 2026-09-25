'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type KirbyState = 'idle' | 'watching' | 'inhaling' | 'full' | 'happy';

interface KirbyAvatarProps {
  state: KirbyState;
  className?: string;
  size?: number;
  onClick?: () => void;
}

/**
 * Componente SVG interactivo de Kirby con proporciones auténticas de Nintendo.
 * Soporta múltiples estados visuales:
 * - 'idle': Sonrisa alegre, mirada al frente
 * - 'watching': Ojos curiosos mirando hacia el input de email
 * - 'inhaling': Boca gigante abierta aspirando hacia la izquierda con remolino de viento
 * - 'full': Mejillas infladas gorditas, cuerpo hinchado (1.2x) masticando el texto
 * - 'happy': Expresión satisfecha con ojitos felices y estrellitas de victoria
 */
export function KirbyAvatar({ state, className = '', size = 110, onClick }: KirbyAvatarProps) {
  const [parpadeando, setParpadeando] = useState(false);

  // Parpadeo natural aleatorio de Kirby cuando está en estado idle o watching
  useEffect(() => {
    if (state !== 'idle' && state !== 'watching') return;
    const interval = setInterval(() => {
      setParpadeando(true);
      setTimeout(() => setParpadeando(false), 160);
    }, 3800 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, [state]);

  const esInhalando = state === 'inhaling';
  const esLleno = state === 'full';
  const esFeliz = state === 'happy';
  const estaMirando = state === 'watching';

  return (
    <div
      onClick={onClick}
      className={`relative select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{ width: size, height: size }}
      title={esInhalando ? '¡Kirby está aspirando!' : 'Kirby ♡'}
    >
      {/* Remolinos de viento de succión cuando está aspirando (fluyen desde el input hacia Kirby) */}
      <AnimatePresence>
        {esInhalando && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute -left-12 top-1/2 -translate-y-1/2 pointer-events-none z-10 w-20 h-16"
          >
            <svg viewBox="0 0 100 80" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="windGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#FFA6C2" stopOpacity="0.1" />
                  <stop offset="50%" stopColor="#FF6B93" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#FF3366" stopOpacity="1" />
                </linearGradient>
              </defs>

              {/* Corrientes de viento de succión */}
              <motion.path
                d="M -10,18 Q 40,24 85,38"
                fill="none"
                stroke="url(#windGrad)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray="14 10"
                animate={{ strokeDashoffset: [-36, 0] }}
                transition={{ repeat: Infinity, duration: 0.35, ease: 'linear' }}
              />
              <motion.path
                d="M -20,40 Q 30,40 86,42"
                fill="none"
                stroke="url(#windGrad)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="16 8"
                animate={{ strokeDashoffset: [-40, 0] }}
                transition={{ repeat: Infinity, duration: 0.3, ease: 'linear' }}
              />
              <motion.path
                d="M -12,62 Q 40,56 85,46"
                fill="none"
                stroke="url(#windGrad)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray="14 10"
                animate={{ strokeDashoffset: [-36, 0] }}
                transition={{ repeat: Infinity, duration: 0.32, ease: 'linear' }}
              />

              {/* Estrellitas pequeñas arrastradas por la succión */}
              <motion.g
                animate={{
                  x: [0, 80],
                  y: [10, 40],
                  scale: [1, 0.3],
                  opacity: [1, 0],
                  rotate: [0, 180],
                }}
                transition={{ repeat: Infinity, duration: 0.45, ease: 'easeIn' }}
              >
                <polygon
                  points="5,0 6.5,3.5 10,4 7.5,6.5 8,10 5,8 2,10 2.5,6.5 0,4 3.5,3.5"
                  fill="#FFD700"
                />
              </motion.g>
              <motion.g
                animate={{
                  x: [-10, 80],
                  y: [55, 42],
                  scale: [1.1, 0.2],
                  opacity: [1, 0],
                  rotate: [0, -180],
                }}
                transition={{ repeat: Infinity, duration: 0.5, delay: 0.15, ease: 'easeIn' }}
              >
                <polygon
                  points="5,0 6.5,3.5 10,4 7.5,6.5 8,10 5,8 2,10 2.5,6.5 0,4 3.5,3.5"
                  fill="#FFAE19"
                />
              </motion.g>
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Estrellas brillantes que brotan cuando Kirby traga felizmente */}
      <AnimatePresence>
        {esFeliz && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 10 }}
            animate={{ opacity: 1, scale: 1.15, y: -16 }}
            exit={{ opacity: 0, scale: 0.4 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="absolute -top-3 left-1/2 -translate-x-1/2 pointer-events-none z-20 flex gap-2"
          >
            <span className="text-amber-400 text-lg drop-shadow-sm animate-bounce">✦</span>
            <span className="text-pink-400 text-sm drop-shadow-sm animate-pulse">★</span>
            <span className="text-amber-300 text-base drop-shadow-sm animate-bounce">✦</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SVG de Kirby */}
      <motion.svg
        viewBox="0 0 200 200"
        className="w-full h-full overflow-visible drop-shadow-md"
        animate={{
          scale: esLleno ? 1.22 : esInhalando ? 1.05 : 1,
          x: esInhalando ? [-1.5, 1.5, -1.5] : 0,
          y: esFeliz ? [-2, -8, 0] : esLleno ? [-1, 2, -1] : [0, -1.5, 0],
          rotate: esInhalando ? -3 : esFeliz ? 2 : 0,
        }}
        transition={{
          scale: { type: 'spring', stiffness: 350, damping: 20 },
          x: esInhalando ? { repeat: Infinity, duration: 0.08 } : { duration: 0.2 },
          y: esLleno ? { repeat: Infinity, duration: 0.4 } : esFeliz ? { duration: 0.5 } : { repeat: Infinity, duration: 2.4, ease: 'easeInOut' },
        }}
      >
        <defs>
          {/* Gradiente del cuerpo esférico de Kirby */}
          <radialGradient id="kirbySkin" cx="42%" cy="38%" r="62%">
            <stop offset="0%" stopColor="#FFD4DF" />
            <stop offset="55%" stopColor="#FFA6BC" />
            <stop offset="100%" stopColor="#F58DA7" />
          </radialGradient>

          {/* Gradiente de las botitas rojas de Kirby */}
          <linearGradient id="kirbyShoe" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FF3359" />
            <stop offset="60%" stopColor="#DE1B42" />
            <stop offset="100%" stopColor="#B30E2E" />
          </linearGradient>

          {/* Sombra suave bajo Kirby */}
          <radialGradient id="kirbyShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#C44866" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#C44866" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Sombra proyectada */}
        <ellipse cx="102" cy="172" rx={esLleno ? 58 : 46} ry="10" fill="url(#kirbyShadow)" />

        {/* ================= ZAPATO / PIE IZQUIERDO ================= */}
        <motion.path
          d="M 52,135 C 34,142 38,166 65,168 C 86,170 94,154 80,138 Z"
          fill="url(#kirbyShoe)"
          stroke="#381723"
          strokeWidth="3.6"
          strokeLinejoin="round"
          animate={{
            rotate: esInhalando ? -6 : 0,
            x: esInhalando ? -2 : 0,
          }}
        />

        {/* ================= ZAPATO / PIE DERECHO ================= */}
        <motion.path
          d="M 112,142 C 108,160 124,172 148,168 C 168,165 172,146 152,136 Z"
          fill="url(#kirbyShoe)"
          stroke="#381723"
          strokeWidth="3.6"
          strokeLinejoin="round"
          animate={{
            rotate: esInhalando ? 4 : 0,
          }}
        />

        {/* ================= BRAZO DERECHO ================= */}
        <motion.path
          d="M 138,96 C 158,84 172,100 152,118 C 144,112 140,104 138,96 Z"
          fill="url(#kirbySkin)"
          stroke="#381723"
          strokeWidth="3.6"
          strokeLinejoin="round"
          animate={{
            rotate: esFeliz ? [-10, 15, -10] : esInhalando ? -8 : 0,
            originX: '138px',
            originY: '100px',
          }}
          transition={esFeliz ? { repeat: Infinity, duration: 0.6 } : {}}
        />

        {/* ================= CUERPO ESFÉRICO PRINCIPAL ================= */}
        <circle
          cx="100"
          cy="104"
          r="48"
          fill="url(#kirbySkin)"
          stroke="#381723"
          strokeWidth="3.8"
        />

        {/* ================= BRAZO IZQUIERDO ================= */}
        <motion.path
          d={
            esInhalando
              ? 'M 54,88 C 30,86 32,108 50,118 C 58,114 60,102 54,88 Z' // Brazo estirado hacia el input
              : 'M 56,95 C 38,98 38,116 52,122 C 58,118 62,108 56,95 Z'
          }
          fill="url(#kirbySkin)"
          stroke="#381723"
          strokeWidth="3.6"
          strokeLinejoin="round"
          animate={{
            x: esInhalando ? -4 : 0,
            rotate: esInhalando ? -5 : 0,
          }}
        />

        {/* ================= MEJILLAS ROSADAS (BLUSH) ================= */}
        {/* Mejilla Izquierda */}
        <ellipse
          cx="62"
          cy="106"
          rx={esLleno ? 9 : 7.5}
          ry={esLleno ? 5.5 : 4}
          transform="rotate(-10 62 106)"
          fill="#FF527B"
          opacity="0.88"
        />
        {/* Tildes tiernas de mejilla izquierda */}
        <path
          d="M 57,105 Q 61,103 65,105"
          stroke="#FF285D"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.8"
        />

        {/* Mejilla Derecha */}
        <ellipse
          cx="104"
          cy="103"
          rx={esLleno ? 9 : 7.5}
          ry={esLleno ? 5.5 : 4}
          transform="rotate(10 104 103)"
          fill="#FF527B"
          opacity="0.88"
        />
        {/* Tildes tiernas de mejilla derecha */}
        <path
          d="M 100,102 Q 104,100 108,102"
          stroke="#FF285D"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.8"
        />

        {/* ================= OJOS ================= */}
        {/* 1. Ojos felices o masticando (⌒ ⌒) */}
        {esFeliz || esLleno ? (
          <g>
            <path
              d="M 64,88 Q 72,76 80,88"
              stroke="#381723"
              strokeWidth="3.8"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M 88,86 Q 96,74 104,86"
              stroke="#381723"
              strokeWidth="3.8"
              strokeLinecap="round"
              fill="none"
            />
          </g>
        ) : parpadeando ? (
          /* Parpadeo simple */
          <g>
            <line x1="66" y1="84" x2="78" y2="84" stroke="#381723" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="90" y1="82" x2="102" y2="82" stroke="#381723" strokeWidth="3.5" strokeLinecap="round" />
          </g>
        ) : (
          /* Ojos abiertos icónicos de Kirby mirando hacia la izquierda */
          <g>
            {/* OJO IZQUIERDO */}
            <g transform={estaMirando || esInhalando ? 'translate(-2, 0)' : ''}>
              {/* Fondo negro del ojo */}
              <rect x="67" y="70" width="10" height="23" rx="5" fill="#1C0E16" />
              {/* Brillo blanco superior */}
              <ellipse cx="72" cy="76" rx="3.6" ry="4.2" fill="#FFFFFF" />
              {/* Iris azul inferior */}
              <path
                d="M 68,85 Q 72,83 76,85 C 76,91 68,91 68,85 Z"
                fill="#1D65C2"
              />
            </g>

            {/* OJO DERECHO */}
            <g transform={estaMirando || esInhalando ? 'translate(-2, 0)' : ''}>
              {/* Fondo negro del ojo */}
              <rect x="91" y="68" width="10" height="23" rx="5" fill="#1C0E16" />
              {/* Brillo blanco superior */}
              <ellipse cx="96" cy="74" rx="3.6" ry="4.2" fill="#FFFFFF" />
              {/* Iris azul inferior */}
              <path
                d="M 92,83 Q 96,81 100,83 C 100,89 92,89 92,83 Z"
                fill="#1D65C2"
              />
            </g>
          </g>
        )}

        {/* ================= BOCA (ESTADOS DINÁMICOS) ================= */}
        {/* ESTADO 1: INHALANDO (Boca gigante abierta hacia la izquierda) */}
        {esInhalando ? (
          <g id="mouthOpen" className="kirby-mouth-open">
            {/* Cavidad profunda de la boca */}
            <path
              d="M 62,88 C 58,74 86,72 90,88 C 94,110 64,116 62,88 Z"
              fill="#2E0814"
              stroke="#381723"
              strokeWidth="3.6"
              strokeLinejoin="round"
            />
            {/* Lengua rosada en la parte inferior */}
            <path
              d="M 64,102 Q 76,95 88,102 C 86,112 68,114 64,102 Z"
              fill="#FF5E86"
            />
          </g>
        ) : esLleno ? (
          /* ESTADO 2: LLENO / MASTICANDO (Boca curvada de mejillas gordas) */
          <g id="mouthFull" className="kirby-mouth-full">
            <path
              d="M 76,108 Q 83,112 90,108"
              stroke="#381723"
              strokeWidth="3.2"
              strokeLinecap="round"
              fill="none"
            />
          </g>
        ) : esFeliz ? (
          /* ESTADO 3: FELIZ / SATISFECHO (Sonrisa abierta triangular) */
          <g id="mouthHappy">
            <path
              d="M 74,96 Q 84,112 94,96 Z"
              fill="#B01B3C"
              stroke="#381723"
              strokeWidth="3.2"
              strokeLinejoin="round"
            />
            <path
              d="M 77,104 Q 84,101 91,104 C 89,109 79,109 77,104 Z"
              fill="#FF6088"
            />
          </g>
        ) : (
          /* ESTADO 4: REPOSO (Sonrisa tierna tipo gato M77,98c0,1.93-2.12,3.5-4.5,3.5S68,99.93,68,98) */
          <g id="mouth" className="kirby-stroke">
            <path
              d="M 78,98 C 78,100 75.8,101.5 73.5,101.5 C 71.2,101.5 69,100 69,98"
              stroke="#381723"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
          </g>
        )}
      </motion.svg>
    </div>
  );
}
