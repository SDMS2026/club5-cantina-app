/**
 * lib/whatsappConfig.ts
 * Gestor centralizado de configuración de plantillas de WhatsApp, datos de Pago Móvil
 * y preferencias generales del sistema Club 5 Cantina Escolar.
 */

import { formatBs, formatUSD, calcularConversionBs } from './utils';
import { supabase } from './supabaseClient';

export interface DatosPagoMovilConfig {
  banco: string;
  cedula: string;
  telefono_pagomovil: string;
  telefono_reporte: string;
  nombre_cantina: string;
  nota_efectivo: string;
}

export interface PlantillasWhatsAppConfig {
  individual: string;
  familiar: string;
  estudiante: string;
}

export interface AjustesSistemaConfig {
  moneda_principal: 'USD' | 'BS';
  confirmar_anulaciones: boolean;
  notificar_deuda_limite: boolean;
}

export interface SistemaConfig {
  pagoMovil: DatosPagoMovilConfig;
  plantillas: PlantillasWhatsAppConfig;
  ajustes: AjustesSistemaConfig;
  actualizado_en?: string;
}

export const STORAGE_KEY_CONFIG = 'club5_sistema_config_v1';
export const EVENTO_CONFIG_ACTUALIZADA = 'club5:config-actualizada';

export const DEFAULT_PAGO_MOVIL: DatosPagoMovilConfig = {
  banco: 'BNC (Banco Nacional de Crédito - 0191)',
  cedula: '14953511',
  telefono_pagomovil: '04125404830',
  telefono_reporte: '04123588848',
  nombre_cantina: 'Club 5 Cantina Escolar',
  nota_efectivo: 'Directamente en caja de cantina ($ o Bs.)',
};

export const DEFAULT_PLANTILLA_INDIVIDUAL = `Hola, *{representante}*.
Le escribimos cordialmente de *{nombre_cantina}*.

Le compartimos el estado de cuenta pendiente de *{estudiante}* {grado}:

*Detalle de consumos ({cantidad_consumos}):*
{detalle_consumos}

---------------------------------
*TOTAL A PAGAR:* {total_usd}
*Equivalente en Bolívares:* {total_bs}
(Tasa oficial BCV del día: {tasa_bcv})
---------------------------------

*Datos para realizar el Pago Móvil:*
- Banco: {banco}
- Cédula: {cedula}
- Teléfono Pago Móvil: {telefono_pagomovil}
- Efectivo: {nota_efectivo}

*Reporte de Referencia:*
Por favor enviar la captura de la transferencia o referencia al WhatsApp: *{telefono_reporte}*

¡Muchas gracias y que tenga un excelente día!`;

export const DEFAULT_PLANTILLA_FAMILIAR = `Hola, estimado(a) *{representante}*.
Le escribimos cordialmente de *{nombre_cantina}*.

Le compartimos el estado de cuenta pendiente consolidado familiar de sus representados:

*Resumen de Cuentas:*
{resumen_familiar}

*Detalle de Consumos por Estudiante:*
{desglose_estudiantes}

---------------------------------
*GRAN TOTAL A PAGAR:* {total_usd}
*Equivalente en Bolívares:* {total_bs}
(Tasa oficial BCV del día: {tasa_bcv})
---------------------------------

*Datos para realizar el Pago Móvil:*
- Banco: {banco}
- Cédula: {cedula}
- Teléfono Pago Móvil: {telefono_pagomovil}
- Efectivo: {nota_efectivo}

*Reporte de Referencia:*
Por favor enviar la captura de la transferencia o referencia al WhatsApp: *{telefono_reporte}*

¡Muchas gracias y que tenga un excelente día!`;

export const DEFAULT_PLANTILLA_ESTUDIANTE = `Hola, *{destinatario}*.
Le escribimos cordialmente de *{nombre_cantina}* con relación a {sujeto}.

{estado_cuenta}

Cualquier consulta o para gestionar su pedido en la cantina, estamos a su completa disposición.
¡Que tenga un excelente día!`;

export const DEFAULT_AJUSTES: AjustesSistemaConfig = {
  moneda_principal: 'USD',
  confirmar_anulaciones: true,
  notificar_deuda_limite: true,
};

export const DEFAULT_CONFIG: SistemaConfig = {
  pagoMovil: DEFAULT_PAGO_MOVIL,
  plantillas: {
    individual: DEFAULT_PLANTILLA_INDIVIDUAL,
    familiar: DEFAULT_PLANTILLA_FAMILIAR,
    estudiante: DEFAULT_PLANTILLA_ESTUDIANTE,
  },
  ajustes: DEFAULT_AJUSTES,
  actualizado_en: new Date().toISOString(),
};

/**
 * Obtiene la configuración actual del sistema desde localStorage con fallback seguro
 */
export function obtenerConfiguracion(): SistemaConfig {
  if (typeof window === 'undefined') {
    return DEFAULT_CONFIG;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (!raw) return DEFAULT_CONFIG;

    const parseado = JSON.parse(raw);
    return {
      pagoMovil: {
        ...DEFAULT_PAGO_MOVIL,
        ...(parseado.pagoMovil || {}),
      },
      plantillas: {
        ...DEFAULT_CONFIG.plantillas,
        ...(parseado.plantillas || {}),
      },
      ajustes: {
        ...DEFAULT_AJUSTES,
        ...(parseado.ajustes || {}),
      },
      actualizado_en: parseado.actualizado_en || new Date().toISOString(),
    };
  } catch (err) {
    console.error('Error al leer configuración de localStorage:', err);
    return DEFAULT_CONFIG;
  }
}

/**
 * Guarda la configuración en localStorage, sincroniza opcionalmente con Supabase y notifica a los componentes
 */
export function guardarConfiguracion(nuevaConfig: SistemaConfig): void {
  if (typeof window === 'undefined') return;

  try {
    const configConFecha: SistemaConfig = {
      ...nuevaConfig,
      actualizado_en: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(configConFecha));

    // Notificar reactivamente a cualquier componente escuchando
    window.dispatchEvent(
      new CustomEvent(EVENTO_CONFIG_ACTUALIZADA, {
        detail: configConFecha,
      })
    );

    // Sincronización asíncrona silenciosa con Supabase si la tabla existe
    sincronizarConSupabase(configConFecha).catch((err) => {
      console.warn('Sincronización en la nube opcional omitida:', err);
    });
  } catch (err) {
    console.error('Error al guardar configuración en localStorage:', err);
  }
}

/**
 * Intento de persistencia remota en Supabase en tabla 'configuracion'
 */
async function sincronizarConSupabase(config: SistemaConfig): Promise<void> {
  try {
    await supabase.from('configuracion').upsert({
      clave: 'sistema_general',
      valor: config,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Si la tabla no existe aún, se maneja transparentemente con localStorage
  }
}

/**
 * Carga la configuración inicial desde Supabase si existe, fusionándola con local
 */
export async function sincronizarDesdeSupabase(): Promise<SistemaConfig> {
  try {
    const { data, error } = await supabase
      .from('configuracion')
      .select('valor, updated_at')
      .eq('clave', 'sistema_general')
      .single();

    if (!error && data?.valor) {
      const configRemota = data.valor as SistemaConfig;
      const configCombinada: SistemaConfig = {
        pagoMovil: {
          ...DEFAULT_PAGO_MOVIL,
          ...(configRemota.pagoMovil || {}),
        },
        plantillas: {
          ...DEFAULT_CONFIG.plantillas,
          ...(configRemota.plantillas || {}),
        },
        ajustes: {
          ...DEFAULT_AJUSTES,
          ...(configRemota.ajustes || {}),
        },
        actualizado_en: data.updated_at || configRemota.actualizado_en || new Date().toISOString(),
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(configCombinada));
        window.dispatchEvent(
          new CustomEvent(EVENTO_CONFIG_ACTUALIZADA, {
            detail: configCombinada,
          })
        );
      }
      return configCombinada;
    }
  } catch {
    // No hay tabla en Supabase todavía, continuar con local
  }
  return obtenerConfiguracion();
}

/**
 * Restablece una plantilla específica a su valor original por defecto
 */
export function restablecerPlantilla(tipo: keyof PlantillasWhatsAppConfig): SistemaConfig {
  const actual = obtenerConfiguracion();
  const actualizada: SistemaConfig = {
    ...actual,
    plantillas: {
      ...actual.plantillas,
      [tipo]: DEFAULT_CONFIG.plantillas[tipo],
    },
  };
  guardarConfiguracion(actualizada);
  return actualizada;
}

/**
 * Restablece toda la configuración a los valores originales de fábrica
 */
export function restablecerTodaLaConfiguracion(): SistemaConfig {
  guardarConfiguracion(DEFAULT_CONFIG);
  return DEFAULT_CONFIG;
}

/**
 * Sustituye variables {nombre_variable} en un texto de plantilla
 */
export function compilarPlantilla(
  plantilla: string,
  variables: Record<string, string | number | undefined | null>
): string {
  if (!plantilla) return '';

  return plantilla.replace(/{([a-zA-Z0-9_]+)}/g, (match, clave) => {
    const valor = variables[clave];
    if (valor !== undefined && valor !== null) {
      return String(valor);
    }
    return match; // Mantener la variable original si no fue provista
  });
}

/**
 * Parámetros para generar mensaje de cobro individual
 */
export interface ParametrosCobroIndividual {
  representante?: string | null;
  estudiante: string;
  grado?: string | null;
  esProfesorOPersonal?: boolean;
  consumos: Array<{
    fecha: string;
    monto_total_usd: number;
    consumo_detalles?: Array<{
      cantidad: number;
      precio_unitario_usd: number;
      productos?: { nombre: string } | null;
    }> | null;
  }>;
  totalUsd: number;
  totalBs: number;
  tasaBcv: number;
  config?: SistemaConfig;
}

/**
 * Genera el mensaje de cobro individual reemplazando todas las variables dinámicas
 */
export function generarMensajeCobroIndividual(params: ParametrosCobroIndividual): string {
  const config = params.config || obtenerConfiguracion();
  const pago = config.pagoMovil;

  const estudiante = params.estudiante || 'el estudiante';
  const rep = params.representante || 'Estimado(a) Representante';
  const gradoTexto = params.grado ? `(${params.grado})` : '';

  const detalleConsumos = params.consumos
    .map((c, index) => {
      let fTexto = 'Fecha';
      try {
        fTexto = new Date(c.fecha).toLocaleDateString('es-VE', {
          day: '2-digit',
          month: 'short',
        });
      } catch {
        fTexto = c.fecha;
      }

      let productosTexto = '';
      if (c.consumo_detalles && c.consumo_detalles.length > 0) {
        productosTexto = c.consumo_detalles
          .map(
            (d) =>
              `    - ${d.cantidad}x ${d.productos?.nombre || 'Producto'} (${formatUSD(d.precio_unitario_usd * d.cantidad)})`
          )
          .join('\n');
      } else {
        productosTexto = '    - Consumo en cantina escolar';
      }

      return `*Consumo #${index + 1} (${fTexto})* - ${formatUSD(c.monto_total_usd)}:\n${productosTexto}`;
    })
    .join('\n\n');

  // Si es profesor o personal y no se ha modificado la plantilla radicalmente
  let plantilla = config.plantillas.individual;
  if (params.esProfesorOPersonal) {
    plantilla = plantilla.replace(
      'Le compartimos el estado de cuenta pendiente de *{estudiante}* {grado}:',
      'Le compartimos su estado de cuenta pendiente personal:'
    );
  }

  const variables = {
    nombre_cantina: pago.nombre_cantina,
    representante: rep,
    estudiante: estudiante,
    grado: gradoTexto,
    cantidad_consumos: params.consumos.length,
    detalle_consumos: detalleConsumos,
    total_usd: formatUSD(params.totalUsd),
    total_bs: formatBs(params.totalBs),
    tasa_bcv: formatBs(params.tasaBcv),
    banco: pago.banco,
    cedula: pago.cedula,
    telefono_pagomovil: pago.telefono_pagomovil,
    telefono_reporte: pago.telefono_reporte,
    nota_efectivo: pago.nota_efectivo,
  };

  return compilarPlantilla(plantilla, variables);
}

/**
 * Parámetros para generar mensaje de cobro consolidado familiar
 */
export interface ParametrosCobroFamiliar {
  representante?: string | null;
  cuentas: Array<{
    cliente?: {
      nombre_estudiante?: string;
      grado_seccion?: string | null;
      nombre_representante?: string | null;
    } | null;
    totalDeudaUsd: number;
    totalDeudaBs: number;
    consumos: Array<{
      fecha: string;
      monto_total_usd: number;
      consumo_detalles?: Array<{
        cantidad: number;
        precio_unitario_usd: number;
        productos?: { nombre: string } | null;
      }> | null;
    }>;
  }>;
  tasaBcv: number;
  config?: SistemaConfig;
}

/**
 * Genera el mensaje de cobro consolidado familiar
 */
export function generarMensajeCobroFamiliar(params: ParametrosCobroFamiliar): string {
  const config = params.config || obtenerConfiguracion();
  const pago = config.pagoMovil;

  const granTotalUsd = params.cuentas.reduce((acc, c) => acc + c.totalDeudaUsd, 0);
  const granTotalBs = calcularConversionBs(granTotalUsd, params.tasaBcv);

  // Resumen claro: - Pedro (3er Año): $4.00, - Sofía (1er Año): $3.50
  const resumenFamiliar = params.cuentas
    .map((c) => {
      const nombre = c.cliente?.nombre_estudiante || 'Estudiante';
      const seccion = c.cliente?.grado_seccion ? `(${c.cliente.grado_seccion})` : '';
      return `- ${nombre} ${seccion}: ${formatUSD(c.totalDeudaUsd)} (${formatBs(c.totalDeudaBs)})`;
    })
    .join('\n');

  // Desglose detallado de consumos por cada estudiante
  const desgloseEstudiantes = params.cuentas
    .map((c) => {
      const nombre = c.cliente?.nombre_estudiante || 'Estudiante';
      const seccion = c.cliente?.grado_seccion ? `(${c.cliente.grado_seccion})` : '';
      const cantConsumos = c.consumos.length;

      const detalleConsumos = c.consumos
        .map((cons, index) => {
          let fTexto = 'Fecha';
          try {
            fTexto = new Date(cons.fecha).toLocaleDateString('es-VE', {
              day: '2-digit',
              month: 'short',
            });
          } catch {
            fTexto = cons.fecha;
          }

          let itemsTexto = '';
          if (cons.consumo_detalles && cons.consumo_detalles.length > 0) {
            itemsTexto = cons.consumo_detalles
              .map(
                (d) =>
                  `    - ${d.cantidad}x ${d.productos?.nombre || 'Producto'} (${formatUSD(d.precio_unitario_usd * d.cantidad)})`
              )
              .join('\n');
          } else {
            itemsTexto = '    - Consumo en cantina escolar';
          }

          return `  • *Consumo #${index + 1} (${fTexto})* - ${formatUSD(cons.monto_total_usd)}:\n${itemsTexto}`;
        })
        .join('\n\n');

      return `*${nombre}* ${seccion} - *Total: ${formatUSD(c.totalDeudaUsd)}* (${cantConsumos} ${cantConsumos === 1 ? 'consumo' : 'consumos'}):\n${detalleConsumos}`;
    })
    .join('\n\n------------------\n\n');

  const variables = {
    nombre_cantina: pago.nombre_cantina,
    representante: params.representante || 'Representante / Familia',
    cantidad_estudiantes: params.cuentas.length,
    resumen_familiar: resumenFamiliar,
    desglose_estudiantes: desgloseEstudiantes,
    total_usd: formatUSD(granTotalUsd),
    total_bs: formatBs(granTotalBs),
    tasa_bcv: formatBs(params.tasaBcv),
    banco: pago.banco,
    cedula: pago.cedula,
    telefono_pagomovil: pago.telefono_pagomovil,
    telefono_reporte: pago.telefono_reporte,
    nota_efectivo: pago.nota_efectivo,
  };

  return compilarPlantilla(config.plantillas.familiar, variables);
}

/**
 * Parámetros para generar mensaje de aviso a estudiante (desde Directorio)
 */
export interface ParametrosAvisoEstudiante {
  destinatario: string;
  sujeto: string;
  estudiante: string;
  grado?: string | null;
  saldo: number;
  tasaBcv: number;
  config?: SistemaConfig;
}

/**
 * Genera el mensaje de estado de cuenta enviado desde el directorio de estudiantes
 */
export function generarMensajeAvisoEstudiante(params: ParametrosAvisoEstudiante): string {
  const config = params.config || obtenerConfiguracion();
  const pago = config.pagoMovil;

  let textoDeuda = 'Actualmente su cuenta se encuentra completamente al día y solvente ($0.00).';
  const s = params.saldo;

  if (s < 0) {
    const deuda = Math.abs(s);
    const bs = calcularConversionBs(deuda, params.tasaBcv);
    textoDeuda = `Le recordamos amablemente que presenta un saldo pendiente de ${formatUSD(deuda)} (${formatBs(bs)} a tasa oficial BCV: ${formatBs(params.tasaBcv)}).`;
  } else if (s > 0) {
    const bs = calcularConversionBs(s, params.tasaBcv);
    textoDeuda = `Le informamos cordialmente que cuenta con un saldo a favor disponible de +${formatUSD(s)} (+${formatBs(bs)} a tasa oficial BCV).`;
  }

  const variables = {
    nombre_cantina: pago.nombre_cantina,
    destinatario: params.destinatario,
    sujeto: params.sujeto,
    estudiante: params.estudiante,
    grado: params.grado ? `(${params.grado})` : '',
    estado_cuenta: textoDeuda,
    saldo_usd: formatUSD(Math.abs(s)),
    saldo_bs: formatBs(calcularConversionBs(Math.abs(s), params.tasaBcv)),
    tasa_bcv: formatBs(params.tasaBcv),
    telefono_reporte: pago.telefono_reporte,
  };

  return compilarPlantilla(config.plantillas.estudiante, variables);
}
