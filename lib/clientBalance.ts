import { supabase } from '@/lib/supabaseClient';

export interface ResumenSaldoCliente {
  clienteId: string;
  saldo: number;              // Saldo unificado directo de clientes.saldo
  deudaTotalUsd: number;      // saldo < 0 ? Math.abs(saldo) : 0
  saldoAFavorTotalUsd: number;// saldo > 0 ? saldo : 0
  saldoNetoUsd: number;       // igual a saldo
  cantidadConsumosPendientes?: number;
  cantidadAbonos?: number;
}

/**
 * Determina si el método de pago corresponde a un abono entrante o saldo a favor cargado.
 */
export function esAbonoOEntradaSaldo(metodoPago?: string | null): boolean {
  if (!metodoPago) return false;
  const m = metodoPago.toLowerCase().trim();
  return (
    m === 'abono_saldo_favor' ||
    m === 'vuelto_saldo_favor' ||
    m === 'abono_adelantado' ||
    m === 'abono_cuenta' ||
    m.startsWith('abono_') ||
    m.startsWith('vuelto_')
  );
}

/**
 * Extrae la cantidad de saldo a favor que se debitó o consumió en una compra.
 * - Si metodo_pago === 'saldo_favor', consume el 100% de montoTotal.
 * - Si es pago mixto, ej: 'mixto:saldo_favor=2.50,efectivo_usd=1.00', extrae 2.50.
 */
export function extraerSaldoFavorUsado(metodoPago?: string | null, montoTotal: number = 0): number {
  if (!metodoPago) return 0;
  const m = metodoPago.toLowerCase().trim();
  if (m === 'saldo_favor') {
    return Number(montoTotal) || 0;
  }
  if (m.includes('saldo_favor=')) {
    const match = m.match(/saldo_favor=([0-9.]+)/);
    if (match && match[1]) {
      return parseFloat(match[1]) || 0;
    }
  }
  return 0;
}

/**
 * Consulta la base de datos de Supabase para obtener el estado financiero consolidado
 * de todos los clientes leyendo DIRECTAMENTE del campo clientes.saldo.
 * - saldo > 0 => Saldo a Favor disponible
 * - saldo < 0 => Deuda / Cuenta por cobrar (Math.abs(saldo))
 * - saldo === 0 => Solvente ($0.00)
 */
export async function obtenerSaldosTodosClientes(): Promise<Record<string, ResumenSaldoCliente>> {
  const { data, error } = await supabase
    .from('clientes')
    .select('id, saldo, nombre_estudiante');

  if (error || !data) {
    console.error('Error obteniendo clientes para saldos unificados:', error);
    return {};
  }

  const mapa: Record<string, ResumenSaldoCliente> = {};
  for (const c of data) {
    const s = Math.round(Number(c.saldo || 0) * 100) / 100;
    mapa[c.id] = {
      clienteId: c.id,
      saldo: s,
      deudaTotalUsd: s < 0 ? Math.round(Math.abs(s) * 100) / 100 : 0,
      saldoAFavorTotalUsd: s > 0 ? s : 0,
      saldoNetoUsd: s,
      cantidadConsumosPendientes: s < 0 ? 1 : 0,
      cantidadAbonos: s > 0 ? 1 : 0,
    };
  }

  return mapa;
}

/**
 * Consulta el saldo de la cuenta corriente unificada de un único cliente leyendo clientes.saldo.
 */
export async function obtenerSaldoCliente(clienteId: string): Promise<ResumenSaldoCliente> {
  if (!clienteId) {
    return {
      clienteId: '',
      saldo: 0,
      deudaTotalUsd: 0,
      saldoAFavorTotalUsd: 0,
      saldoNetoUsd: 0,
      cantidadConsumosPendientes: 0,
      cantidadAbonos: 0,
    };
  }

  const { data, error } = await supabase
    .from('clientes')
    .select('id, saldo')
    .eq('id', clienteId)
    .single();

  if (error || !data) {
    console.error('Error obteniendo saldo del cliente:', error);
    return {
      clienteId,
      saldo: 0,
      deudaTotalUsd: 0,
      saldoAFavorTotalUsd: 0,
      saldoNetoUsd: 0,
      cantidadConsumosPendientes: 0,
      cantidadAbonos: 0,
    };
  }

  const s = Math.round(Number(data.saldo || 0) * 100) / 100;
  return {
    clienteId,
    saldo: s,
    deudaTotalUsd: s < 0 ? Math.round(Math.abs(s) * 100) / 100 : 0,
    saldoAFavorTotalUsd: s > 0 ? s : 0,
    saldoNetoUsd: s,
    cantidadConsumosPendientes: s < 0 ? 1 : 0,
    cantidadAbonos: s > 0 ? 1 : 0,
  };
}

/**
 * Descuenta el monto de un consumo directamente de clientes.saldo:
 * Aplica cuando el cliente paga con 'saldo_favor' o queda debiendo con 'pendiente' / fiado.
 * Retorna el nuevo saldo resultante.
 */
export async function descontarSaldoCliente({
  clienteId,
  montoUsd,
}: {
  clienteId: string;
  montoUsd: number;
}): Promise<number> {
  if (!clienteId || montoUsd <= 0) return 0;

  // 1. Consultar saldo actual
  const { data: cliente, error: errSelect } = await supabase
    .from('clientes')
    .select('saldo')
    .eq('id', clienteId)
    .single();

  if (errSelect) {
    console.error('Error al consultar saldo para descontar consumo:', errSelect);
    throw new Error('Error al consultar saldo en Supabase: ' + errSelect.message);
  }

  const saldoActual = Number(cliente?.saldo || 0);
  const nuevoSaldo = Math.round((saldoActual - montoUsd) * 100) / 100;

  // 2. Actualizar clientes.saldo
  const { error: errUpdate } = await supabase
    .from('clientes')
    .update({ saldo: nuevoSaldo })
    .eq('id', clienteId);

  if (errUpdate) {
    console.error('Error al descontar saldo en la tabla clientes:', errUpdate);
    throw new Error('Error al actualizar clientes.saldo: ' + errUpdate.message);
  }

  // 3. Notificar actualización en tiempo real
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('club5:actualizar-notificaciones'));
  }

  return nuevoSaldo;
}

/**
 * Procesa un abono o depósito de un cliente sobre su cuenta corriente unificada:
 * 1. Suma el monto ingresado al campo clientes.saldo.
 * 2. Guarda el ticket en la tabla 'consumos' para el historial contable detallado.
 * 3. Notifica a toda la app y el sistema de notificaciones para actualización en tiempo real.
 */
export async function procesarAbonoCliente({
  clienteId,
  montoUsd,
  metodoPago = 'efectivo_usd',
  tasaBcv,
  esVuelto = false,
}: {
  clienteId: string;
  montoUsd: number;
  metodoPago?: string;
  tasaBcv: number;
  esVuelto?: boolean;
}): Promise<{
  exito: boolean;
  saldoAnterior: number;
  nuevoSaldo: number;
  deudaLiquidadaUsd: number;
  saldoAFavorAcreditadoUsd: number;
  mensaje: string;
}> {
  if (!clienteId || montoUsd <= 0) {
    return {
      exito: false,
      saldoAnterior: 0,
      nuevoSaldo: 0,
      deudaLiquidadaUsd: 0,
      saldoAFavorAcreditadoUsd: 0,
      mensaje: 'Monto inválido o cliente no especificado.',
    };
  }

  // 1. Consultar saldo actual directamente de clientes.saldo
  const { data: cliente, error: errCliente } = await supabase
    .from('clientes')
    .select('id, saldo, nombre_estudiante')
    .eq('id', clienteId)
    .single();

  if (errCliente || !cliente) {
    console.error('Error consultando saldo del cliente:', errCliente);
    throw new Error('Error al consultar saldo en Supabase: ' + (errCliente?.message || 'Cliente no encontrado'));
  }

  const saldoActual = Number(cliente.saldo || 0);
  const nuevoSaldo = Math.round((saldoActual + montoUsd) * 100) / 100;

  // 2. Sumar el monto ingresado al campo clientes.saldo
  const { error: errUpdate } = await supabase
    .from('clientes')
    .update({ saldo: nuevoSaldo })
    .eq('id', clienteId);

  if (errUpdate) {
    console.error('Error actualizando clientes.saldo en Supabase:', errUpdate);
    throw new Error('Error al actualizar clientes.saldo en Supabase: ' + errUpdate.message);
  }

  // 3. Registrar el ticket en consumos para el historial contable detallado
  const metodoRegistro = esVuelto ? 'vuelto_saldo_favor' : (metodoPago || 'abono_saldo_favor');
  const { error: errHistorial } = await supabase.from('consumos').insert({
    cliente_id: clienteId,
    monto_total_usd: montoUsd,
    tasa_bcv_historica: tasaBcv,
    metodo_pago: metodoRegistro,
    pagado: true,
  });

  if (errHistorial) {
    console.warn('Aviso: el saldo se actualizó pero hubo un problema guardando en consumos:', errHistorial);
  }

  // Si tenía consumos pendientes marcados en consumos con pagado: false, marcarlos como solventados
  if (saldoActual < 0) {
    try {
      const { data: consumosPendientes } = await supabase
        .from('consumos')
        .select('id, monto_total_usd')
        .eq('cliente_id', clienteId)
        .eq('pagado', false)
        .order('fecha', { ascending: true });

      if (consumosPendientes && consumosPendientes.length > 0) {
        let disponible = montoUsd;
        for (const cp of consumosPendientes) {
          if (disponible <= 0) break;
          const m = Number(cp.monto_total_usd || 0);
          if (disponible >= m) {
            await supabase.from('consumos').update({ pagado: true }).eq('id', cp.id);
            disponible = Math.round((disponible - m) * 100) / 100;
          } else {
            const restante = Math.round((m - disponible) * 100) / 100;
            await supabase.from('consumos').update({ monto_total_usd: restante }).eq('id', cp.id);
            disponible = 0;
            break;
          }
        }
      }
    } catch (e) {
      console.warn('Aviso al conciliar consumos pendientes:', e);
    }
  }

  // 4. Mensajes informativos
  let deudaLiquidada = 0;
  let saldoAcreditado = 0;

  if (saldoActual < 0) {
    const deudaAnterior = Math.abs(saldoActual);
    if (montoUsd >= deudaAnterior) {
      deudaLiquidada = deudaAnterior;
      saldoAcreditado = Math.round((montoUsd - deudaAnterior) * 100) / 100;
    } else {
      deudaLiquidada = montoUsd;
      saldoAcreditado = 0;
    }
  } else {
    saldoAcreditado = montoUsd;
  }

  let mensaje = '';
  if (deudaLiquidada > 0 && saldoAcreditado > 0) {
    mensaje = `¡Deuda saldada ($${deudaLiquidada.toFixed(2)}) y sobrante de $${saldoAcreditado.toFixed(2)} acreditado como saldo a favor!`;
  } else if (deudaLiquidada > 0 && nuevoSaldo === 0) {
    mensaje = `¡Deuda pendiente de $${deudaLiquidada.toFixed(2)} saldada exitosamente! Cuenta al día ($0.00).`;
  } else if (deudaLiquidada > 0 && nuevoSaldo < 0) {
    mensaje = `¡Abono de $${montoUsd.toFixed(2)} aplicado! Saldo deudor restante: $${Math.abs(nuevoSaldo).toFixed(2)}.`;
  } else {
    mensaje = `¡Se acreditaron $${montoUsd.toFixed(2)} como saldo a favor! Saldo total disponible: $${nuevoSaldo.toFixed(2)}.`;
  }

  // 5. Notificar actualización en tiempo real
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('club5:actualizar-notificaciones'));
  }

  return {
    exito: true,
    saldoAnterior: saldoActual,
    nuevoSaldo,
    deudaLiquidadaUsd: deudaLiquidada,
    saldoAFavorAcreditadoUsd: saldoAcreditado,
    mensaje,
  };
}
