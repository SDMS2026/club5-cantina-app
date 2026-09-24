import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formateo determinista para USD ($1,250.00) que evita discrepancias
 * de hidratación SSR entre el motor ICU de Node.js y el del navegador.
 */
export function formatUSD(amount: number): string {
  const num = isNaN(amount) ? 0 : amount;
  const parts = num.toFixed(2).split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `$${intPart}.${parts[1]}`;
}

/**
 * Formateo determinista para Bolívares (Bs. 1.250,00) que evita discrepancias
 * de hidratación SSR entre el motor ICU de Node.js y el del navegador.
 */
export function formatBs(amount: number): string {
  const num = isNaN(amount) ? 0 : amount;
  const parts = num.toFixed(2).split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `Bs. ${intPart},${parts[1]}`;
}

export function calcularConversionBs(montoUsd: number, tasaBcv: number): number {
  if (!montoUsd || !tasaBcv) return 0;
  return Math.round(montoUsd * tasaBcv * 100) / 100;
}
