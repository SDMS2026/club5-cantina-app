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
const CACHE_TASA_MS = 5 * 60 * 1000; // 5 minutos de caché en memoria

/**
 * Realiza una consulta a la API de DolarVZLA para obtener la tasa del dólar BCV en tiempo real.
 * Si ocurre un fallo de red o la respuesta no es válida, retorna un fallback seguro.
 * Incluye caché en memoria de 5 minutos para evitar peticiones HTTP redundantes.
 *
 * @param fallback - Tasa de respaldo personalizada (opcional).
 * @param forzar - Si es true, ignora la caché y consulta la API fresca.
 * @returns Promesa con el valor de la tasa en bolívares por dólar (Bs/USD).
 */
export async function obtenerTasaBCV(fallback?: number, forzar: boolean = false): Promise<number> {
  const fallbackSeguro = fallback ?? ultimaTasaConocida ?? TASA_BCV_FALLBACK_DEFAULT;

  const ahora = Date.now();
  if (!forzar && ultimaTasaConocida !== null && ahora - timestampUltimaTasa < CACHE_TASA_MS) {
    return ultimaTasaConocida;
  }

  try {
    const response = await fetch('https://rates.dolarvzla.com/bcv/current.json', {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[dolarApi] Error al consultar API DolarVZLA: HTTP ${response.status}`);
      return fallbackSeguro;
    }

    const data: DolarBcvResponse = await response.json();
    const tasa = data?.current?.usd;

    if (typeof tasa === 'number' && !isNaN(tasa) && tasa > 0) {
      ultimaTasaConocida = tasa;
      timestampUltimaTasa = Date.now();
      return tasa;
    }

    console.warn('[dolarApi] Respuesta con formato inesperado:', data);
    return fallbackSeguro;
  } catch (error) {
    console.error('[dolarApi] Error de red al obtener tasa BCV:', error);
    return fallbackSeguro;
  }
}
