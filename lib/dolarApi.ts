export interface DolarBcvResponse {
  current?: {
    date?: string;
    usd?: number;
    eur?: number;
  };
  previous?: {
    date?: string;
    usd?: number;
    eur?: number;
  };
  changePercentage?: {
    usd?: number;
    eur?: number;
  };
}

// Tasa de respaldo por defecto en caso de fallo de red
export const TASA_BCV_FALLBACK_DEFAULT = 854.46;

let ultimaTasaConocida: number | null = null;
let timestampUltimaTasa: number = 0;
let promesaTasaEnCurso: Promise<number> | null = null;
const CACHE_TASA_MS = 5 * 60 * 1000; // 5 minutos de caché en memoria y localStorage
const STORAGE_CACHE_BCV_KEY = 'club5_bcv_cache_v1';

function leerTasaCacheLocal(): { tasa: number; ts: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_CACHE_BCV_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.tasa === 'number' && parsed.tasa > 0 && typeof parsed?.ts === 'number') {
      return parsed;
    }
  } catch {
    // Silenciar errores de almacenamiento
  }
  return null;
}

function guardarTasaCacheLocal(tasa: number, ts: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_CACHE_BCV_KEY, JSON.stringify({ tasa, ts }));
  } catch {
    // Silenciar errores de almacenamiento
  }
}

/**
 * Realiza una consulta a la API de DolarVZLA para obtener la tasa del dólar BCV en tiempo real.
 * Si ocurre un fallo de red o la respuesta no es válida, retorna un fallback seguro.
 * Incluye caché en memoria y localStorage de 5 minutos, deduplicación en vuelo y timeout de 4s.
 *
 * @param fallback - Tasa de respaldo personalizada (opcional).
 * @param forzar - Si es true, ignora la caché y consulta la API fresca.
 * @returns Promesa con el valor de la tasa en bolívares por dólar (Bs/USD).
 */
export async function obtenerTasaBCV(fallback?: number, forzar: boolean = false): Promise<number> {
  const ahora = Date.now();

  if (!forzar) {
    if (ultimaTasaConocida !== null && ahora - timestampUltimaTasa < CACHE_TASA_MS) {
      return ultimaTasaConocida;
    }
    const cacheLocal = leerTasaCacheLocal();
    if (cacheLocal && ahora - cacheLocal.ts < CACHE_TASA_MS) {
      ultimaTasaConocida = cacheLocal.tasa;
      timestampUltimaTasa = cacheLocal.ts;
      return cacheLocal.tasa;
    }
    if (promesaTasaEnCurso) {
      return promesaTasaEnCurso;
    }
  }

  const cachePrevio = leerTasaCacheLocal();
  const fallbackSeguro = fallback ?? ultimaTasaConocida ?? cachePrevio?.tasa ?? TASA_BCV_FALLBACK_DEFAULT;

  const ejecutarConsulta = async (): Promise<number> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch('https://rates.dolarvzla.com/bcv/current.json', {
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        console.warn(`[dolarApi] Error al consultar API DolarVZLA: HTTP ${response.status}`);
        return fallbackSeguro;
      }

      const data: DolarBcvResponse = await response.json();
      const tasa = data?.current?.usd;

      if (typeof tasa === 'number' && !isNaN(tasa) && tasa > 0) {
        const tsActual = Date.now();
        ultimaTasaConocida = tasa;
        timestampUltimaTasa = tsActual;
        guardarTasaCacheLocal(tasa, tsActual);
        return tasa;
      }

      console.warn('[dolarApi] Respuesta con formato inesperado:', data);
      return fallbackSeguro;
    } catch (error) {
      console.warn('[dolarApi] Timeout o error de red al obtener tasa BCV, usando respaldo:', error);
      return fallbackSeguro;
    } finally {
      clearTimeout(timer);
    }
  };

  if (forzar) {
    return ejecutarConsulta();
  }

  promesaTasaEnCurso = ejecutarConsulta().finally(() => {
    promesaTasaEnCurso = null;
  });
  return promesaTasaEnCurso;
}
