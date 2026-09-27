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
    .select('id, saldo, nombre_estudiante')
    .limit(5000);

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

export interface ConsumoInfoAudit {
  metodoBase: string;
  nombreLegible: string;
  referencia: string | null;
  esAnulado: boolean;
  esPendiente: boolean;
  esMixto: boolean;
  estadoBadge: {
    texto: string;
    color: 'emerald' | 'amber' | 'rose' | 'indigo' | 'gray';
  };
}

/**
 * Parsea el método de pago y estado de una transacción para auditoría contable.
 * Extrae referencias bancarias, banderas de anulación y clasifica el método.
 */
export function parseConsumoAudit(consumo: {
  metodo_pago?: string | null;
  pagado?: boolean | null;
}): ConsumoInfoAudit {
  const raw = consumo.metodo_pago || '';
  const esAnulado = raw.toLowerCase().startsWith('anulado');
  let limpio = esAnulado ? raw.replace(/^anulado:?/i, '').trim() : raw;

  let referencia: string | null = null;
  if (limpio.includes('#ref:')) {
    const parts = limpio.split('#ref:');
    limpio = parts[0];
    referencia = parts[1]?.trim() || null;
  } else if (limpio.includes('(Ref:')) {
    const match = limpio.match(/\(Ref:\s*([^)]+)\)/i);
    if (match) referencia = match[1]?.trim() || null;
    limpio = limpio.replace(/\(Ref:[^)]+\)/i, '').trim();
  }

  const esPendiente = !esAnulado && (consumo.pagado === false || limpio === 'pendiente');
  const esMixto = limpio.startsWith('mixto:');

  let metodoBase = limpio;
  let nombreLegible = 'Desconocido';

  if (limpio === 'efectivo_usd') {
    nombreLegible = 'Efectivo USD ($)';
  } else if (limpio === 'efectivo_bs') {
    nombreLegible = 'Efectivo Bs.';
  } else if (limpio === 'pago_movil') {
    nombreLegible = 'Pago Móvil';
  } else if (limpio === 'punto_debito') {
    nombreLegible = 'Punto de Venta';
  } else if (limpio === 'saldo_favor') {
    nombreLegible = 'Saldo a Favor';
  } else if (limpio === 'pendiente') {
    nombreLegible = 'Fiado / Por Cobrar';
  } else if (esMixto) {
    nombreLegible = 'Pago Mixto';
  } else if (limpio.startsWith('abono') || limpio.startsWith('vuelto')) {
    nombreLegible = 'Abono / Vuelto a Cuenta';
  } else if (limpio) {
    nombreLegible = limpio;
  }

  let estadoBadge: ConsumoInfoAudit['estadoBadge'];
  if (esAnulado) {
    estadoBadge = { texto: 'Anulada', color: 'rose' };
  } else if (esPendiente) {
    estadoBadge = { texto: 'Por Cobrar', color: 'amber' };
  } else {
    estadoBadge = { texto: 'Pagado', color: 'emerald' };
  }

  return {
    metodoBase,
    nombreLegible,
    referencia,
    esAnulado,
    esPendiente,
    esMixto,
    estadoBadge,
  };
}

export interface ResultadoAnulacionConsumo {
  exito: boolean;
  mensaje: string;
  reajusteSaldo: number;
  nuevoSaldoCliente?: number;
  consumoId: string;
}

/**
 * Anula una transacción de venta/consumo en Supabase.
 * - Marca la transacción como anulada (metodo_pago: 'anulado:...' y pagado: true).
 * - Si fue fiado ('pendiente'): reversa la deuda sumando el monto al saldo del cliente (+monto).
 * - Si fue pagado con saldo a favor ('saldo_favor'): reembolsa el saldo a favor al cliente (+monto).
 * - Si fue mixto: restituye la porción de saldo a favor usada (+saldoUsado) y cancela la deuda.
 * - Si fue efectivo/pago móvil en caja: se registra la anulación contable de caja (sin afectar cuenta corriente).
 */
export async function anularConsumo({
  consumoId,
  motivo,
}: {
  consumoId: string;
  motivo?: string;
}): Promise<ResultadoAnulacionConsumo> {
  if (!consumoId) throw new Error('ID de consumo requerido para anular.');

  // 1. Obtener la transacción original
  const { data: consumo, error: errConsumo } = await supabase
    .from('consumos')
    .select(`
      id,
      cliente_id,
      monto_total_usd,
      tasa_bcv_historica,
      metodo_pago,
      pagado
    `)
    .eq('id', consumoId)
    .single();

  if (errConsumo || !consumo) {
    throw new Error(errConsumo?.message || 'No se encontró la transacción de venta especificada.');
  }

  // 2. Verificar que no esté ya anulada
  if (consumo.metodo_pago?.toLowerCase().startsWith('anulado')) {
    throw new Error('Esta transacción ya se encuentra registrada como anulada.');
  }

  const metodoOriginal = consumo.metodo_pago || '';
  const montoTotalUsd = Number(consumo.monto_total_usd || 0);
  let reajusteSaldo = 0;

  // 3. Determinar reajuste al saldo unificado (clientes.saldo)
  if (metodoOriginal === 'pendiente') {
    // Fiado: el cliente acumuló deuda (-monto). Al anular, se reversa la deuda (+monto).
    reajusteSaldo = montoTotalUsd;
  } else if (metodoOriginal === 'saldo_favor') {
    // Saldo a favor: se le debitó su crédito. Al anular, se le reembolsa (+monto).
    reajusteSaldo = montoTotalUsd;
  } else if (metodoOriginal.startsWith('mixto:')) {
    // Mixto: se le debitó la parte de saldo a favor. Al anular, se le reembolsa esa porción.
    reajusteSaldo = extraerSaldoFavorUsado(metodoOriginal, montoTotalUsd);
  }

  let nuevoSaldoCliente: number | undefined = undefined;

  // 4. Si hay reajuste y el cliente existe, actualizar clientes.saldo
  if (reajusteSaldo > 0 && consumo.cliente_id) {
    const { data: clienteActual, error: errCliente } = await supabase
      .from('clientes')
      .select('saldo')
      .eq('id', consumo.cliente_id)
      .single();

    if (!errCliente && clienteActual) {
      const saldoPrevio = Number(clienteActual.saldo || 0);
      nuevoSaldoCliente = Math.round((saldoPrevio + reajusteSaldo) * 100) / 100;

      const { error: errUpdateCliente } = await supabase
        .from('clientes')
        .update({ saldo: nuevoSaldoCliente })
        .eq('id', consumo.cliente_id);

      if (errUpdateCliente) {
        console.error('Error actualizando saldo de cliente al anular consumo:', errUpdateCliente);
        throw new Error('Error al actualizar el saldo de la cuenta del cliente.');
      }
    }
  }

  // 5. Marcar la transacción como anulada en la tabla consumos
  const nuevoMetodoPago = `anulado:${metodoOriginal}`;
  const { error: errUpdateConsumo } = await supabase
    .from('consumos')
    .update({
      metodo_pago: nuevoMetodoPago,
      pagado: true,
    })
    .eq('id', consumoId);

  if (errUpdateConsumo) {
    console.error('Error actualizando consumo a estado anulado:', errUpdateConsumo);
    throw new Error('No se pudo marcar la transacción como anulada en la base de datos.');
  }

  // 6. Notificar actualización en tiempo real
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('club5:actualizar-notificaciones'));
  }

  let mensaje = 'Transacción anulada exitosamente.';
  if (reajusteSaldo > 0) {
    mensaje += ` Se reintegraron +$${reajusteSaldo.toFixed(2)} al saldo de la cuenta del cliente.`;
  } else {
    mensaje += ' Operación de caja cancelada / devuelta.';
  }

  return {
    exito: true,
    mensaje,
    reajusteSaldo,
    nuevoSaldoCliente,
    consumoId,
  };
}
