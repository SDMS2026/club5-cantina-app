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

export function calcularConversionUSD(montoBs: number, tasaBcv: number): number {
  if (!montoBs || !tasaBcv) return 0;
  return Math.round((montoBs / tasaBcv) * 100) / 100;
}

/**
 * Sanitiza entradas numéricas permitiendo únicamente números y un solo punto/coma decimal.
 * Bloquea letras, signos negativos y caracteres especiales.
 */
export function sanitizeDecimalInput(val: string): string {
  let cleaned = val.replace(/,/g, '.');
  cleaned = cleaned.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('');
  }
  return cleaned;
}

/**
 * Previene en tiempo de pulsación de tecla caracteres no numéricos en inputs de dinero.
 */
export function handleDecimalKeyDown(
  e: React.KeyboardEvent<HTMLInputElement>,
  currentVal: string
): void {
  const allowedKeys = [
    'Backspace',
    'Delete',
    'Tab',
    'Escape',
    'Enter',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Home',
    'End',
  ];
  if (allowedKeys.includes(e.key)) return;
  if (e.ctrlKey || e.metaKey) return;

  if (e.key === '.' || e.key === ',') {
    if (currentVal.includes('.') || currentVal.includes(',')) {
      e.preventDefault();
    }
    return;
  }

  if (!/^[0-9]$/.test(e.key)) {
    e.preventDefault();
  }
}

/**
 * Normaliza una cadena de texto para búsquedas insensibles a mayúsculas, minúsculas,
 * tildes y diacríticos (ej: "Martínez" -> "martinez", "TEQUEÑOS" -> "tequenos").
 */
export function normalizarTexto(texto?: string | null): string {
  if (!texto) return '';
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Comprueba si un texto contiene un término de búsqueda ignorando mayúsculas y acentos.
 */
export function coincideBusqueda(texto?: string | null, termino?: string | null): boolean {
  if (!termino || !termino.trim()) return true;
  if (!texto) return false;
  return normalizarTexto(texto).includes(normalizarTexto(termino));
}

/**
 * Genera un patrón regex compatible con PostgreSQL / PostgREST (imatch)
 * que empareja una palabra sin importar si tiene tildes o no en la base de datos
 * (ej: "Gomez" o "Gómez" generarán el patrón que busca ambas grafías indistintamente).
 */
export function construirPatronRegexBusqueda(termino?: string | null): string {
  const limpio = (termino || '').trim();
  if (!limpio) return '';

  const mapa: Record<string, string> = {
    a: '[aáàäâãAÁÀÄÂÃ]',
    e: '[eéèëêEÉÈËÊ]',
    i: '[iíìïîIÍÌÏÎ]',
    o: '[oóòöôõOÓÒÖÔÕ]',
    u: '[uúùüûUÚÙÜÛ]',
    n: '[nñNÑ]',
    c: '[cçCÇ]',
  };

  let regexStr = '';
  for (const ch of limpio) {
    if (/[.*+?^${}()|[\]\\]/.test(ch)) {
      regexStr += '\\' + ch;
      continue;
    }
    const unaccented = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (mapa[unaccented]) {
      regexStr += mapa[unaccented];
    } else {
      regexStr += ch;
    }
  }

  return '.*' + regexStr + '.*';
}
