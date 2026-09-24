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

/**
 * Realiza una consulta a la API de DolarVZLA para obtener la tasa del dólar BCV en tiempo real.
 * Si ocurre un fallo de red o la respuesta no es válida, retorna un fallback seguro.
 *
 * @param fallback - Tasa de respaldo personalizada (opcional).
 * @returns Promesa con el valor de la tasa en bolívares por dólar (Bs/USD).
 */
export async function obtenerTasaBCV(fallback?: number): Promise<number> {
  const fallbackSeguro = fallback ?? ultimaTasaConocida ?? TASA_BCV_FALLBACK_DEFAULT;

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
      return tasa;
    }

    console.warn('[dolarApi] Respuesta con formato inesperado:', data);
    return fallbackSeguro;
  } catch (error) {
    console.error('[dolarApi] Error de red al obtener tasa BCV:', error);
    return fallbackSeguro;
  }
}
