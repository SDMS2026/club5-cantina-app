import { supabase } from '@/lib/supabaseClient';

export interface ResumenSaldoCliente {
  clienteId: string;
  deudaTotalUsd: number;
  saldoAFavorTotalUsd: number;
  saldoNetoUsd: number; // saldoAFavorTotalUsd - deudaTotalUsd (+ positivo: a favor, - negativo: debe)
  cantidadConsumosPendientes: number;
  cantidadAbonos: number;
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
 * Procesa un arreglo de consumos de Supabase y calcula el balance (deuda y saldo a favor)
 * para cada cliente agrupado por su ID.
 */
export function calcularSaldosClientes(
  consumos: Array<{
    id?: string;
    cliente_id: string | null;
    monto_total_usd: number;
    metodo_pago?: string | null;
    pagado: boolean;
    fecha?: string;
  }>
): Record<string, ResumenSaldoCliente> {
  const saldosMap: Record<string, ResumenSaldoCliente> = {};

  for (const c of consumos) {
    if (!c.cliente_id) continue;
    const cid = c.cliente_id;

    if (!saldosMap[cid]) {
      saldosMap[cid] = {
        clienteId: cid,
        deudaTotalUsd: 0,
        saldoAFavorTotalUsd: 0,
        saldoNetoUsd: 0,
        cantidadConsumosPendientes: 0,
        cantidadAbonos: 0,
      };
    }

    const monto = Number(c.monto_total_usd) || 0;

    if (!c.pagado) {
      // Consumo a crédito / fiado pendiente
      saldosMap[cid].deudaTotalUsd += monto;
      saldosMap[cid].cantidadConsumosPendientes += 1;
    } else {
      // Consumo pagado: puede ser abono entrante o gasto usando saldo a favor
      if (esAbonoOEntradaSaldo(c.metodo_pago)) {
        saldosMap[cid].saldoAFavorTotalUsd += monto;
        saldosMap[cid].cantidadAbonos += 1;
      } else {
        const gastado = extraerSaldoFavorUsado(c.metodo_pago, monto);
        saldosMap[cid].saldoAFavorTotalUsd -= gastado;
      }
    }
  }

  // Redondear a 2 decimales y calcular saldo neto
  for (const cid in saldosMap) {
    const s = saldosMap[cid];
    s.saldoAFavorTotalUsd = Math.max(0, Math.round(s.saldoAFavorTotalUsd * 100) / 100);
    s.deudaTotalUsd = Math.round(s.deudaTotalUsd * 100) / 100;
    s.saldoNetoUsd = Math.round((s.saldoAFavorTotalUsd - s.deudaTotalUsd) * 100) / 100;
  }

  return saldosMap;
}

/**
 * Consulta la base de datos de Supabase para obtener el estado financiero consolidado
 * de todos los clientes.
 */
export async function obtenerSaldosTodosClientes(): Promise<Record<string, ResumenSaldoCliente>> {
  const { data, error } = await supabase
    .from('consumos')
    .select('id, cliente_id, monto_total_usd, metodo_pago, pagado, fecha')
    .not('cliente_id', 'is', null);

  if (error || !data) {
    console.error('Error obteniendo consumos para saldos:', error);
    return {};
  }

  return calcularSaldosClientes(data);
}

/**
 * Consulta el saldo consolidado de un único cliente.
 */
export async function obtenerSaldoCliente(clienteId: string): Promise<ResumenSaldoCliente> {
  if (!clienteId) {
    return {
      clienteId: '',
      deudaTotalUsd: 0,
      saldoAFavorTotalUsd: 0,
      saldoNetoUsd: 0,
      cantidadConsumosPendientes: 0,
      cantidadAbonos: 0,
    };
  }

  const { data, error } = await supabase
    .from('consumos')
    .select('id, cliente_id, monto_total_usd, metodo_pago, pagado, fecha')
    .eq('cliente_id', clienteId);

  if (error || !data) {
    console.error('Error obteniendo saldo del cliente:', error);
    return {
      clienteId,
      deudaTotalUsd: 0,
      saldoAFavorTotalUsd: 0,
      saldoNetoUsd: 0,
      cantidadConsumosPendientes: 0,
      cantidadAbonos: 0,
    };
  }

  const mapa = calcularSaldosClientes(data);
  return (
    mapa[clienteId] || {
      clienteId,
      deudaTotalUsd: 0,
      saldoAFavorTotalUsd: 0,
      saldoNetoUsd: 0,
      cantidadConsumosPendientes: 0,
      cantidadAbonos: 0,
    }
  );
}

/**
 * Procesa un abono o depósito de un cliente aplicando las reglas de negocio estrictas:
 * 1. Liquidación prioritaria de deudas (de la más antigua a la más reciente).
 * 2. Si el abono cubre parcialmente una deuda, se rebaja el saldo deudor.
 * 3. Si el dinero abonado supera la deuda pendiente, el sobrante se asigna automáticamente como saldo a favor.
 * 4. Si no tiene deuda pendiente ($0.00), el 100% va directo como saldo a favor disponible.
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
  deudaLiquidadaUsd: number;
  saldoAFavorAcreditadoUsd: number;
  mensaje: string;
}> {
  if (!clienteId || montoUsd <= 0) {
    return {
      exito: false,
      deudaLiquidadaUsd: 0,
      saldoAFavorAcreditadoUsd: 0,
      mensaje: 'Monto inválido o cliente no especificado.',
    };
  }

  // 1. Obtener deudas pendientes del cliente ordenadas cronológicamente ASC (más antiguas primero)
  const { data: deudasPendientes, error: errDeudas } = await supabase
    .from('consumos')
    .select('id, monto_total_usd, fecha')
    .eq('cliente_id', clienteId)
    .eq('pagado', false)
    .order('fecha', { ascending: true });

  if (errDeudas) {
    console.error('Error buscando deudas pendientes:', errDeudas);
    throw new Error('Error al consultar deudas pendientes en Supabase: ' + errDeudas.message);
  }

  let dineroRestante = Math.round(montoUsd * 100) / 100;
  let deudaLiquidada = 0;

  // 2. Liquidación prioritaria de deuda
  if (deudasPendientes && deudasPendientes.length > 0) {
    for (const d of deudasPendientes) {
      if (dineroRestante <= 0) break;
      const montoDeuda = Math.round(Number(d.monto_total_usd) * 100) / 100;

      if (dineroRestante >= montoDeuda) {
        // Se cancela completamente esta deuda
        const { error: errUpd } = await supabase
          .from('consumos')
          .update({
            pagado: true,
            metodo_pago: metodoPago,
          })
          .eq('id', d.id);

        if (errUpd) throw errUpd;

        dineroRestante = Math.round((dineroRestante - montoDeuda) * 100) / 100;
        deudaLiquidada = Math.round((deudaLiquidada + montoDeuda) * 100) / 100;
      } else {
        // Se cubre parcialmente la deuda
        const restanteDeuda = Math.round((montoDeuda - dineroRestante) * 100) / 100;
        const { error: errUpdPart } = await supabase
          .from('consumos')
          .update({
            monto_total_usd: restanteDeuda,
          })
          .eq('id', d.id);

        if (errUpdPart) throw errUpdPart;

        // Registrar el pago parcial recibido
        await supabase.from('consumos').insert({
          cliente_id: clienteId,
          monto_total_usd: dineroRestante,
          tasa_bcv_historica: tasaBcv,
          metodo_pago: metodoPago,
          pagado: true,
        });

        deudaLiquidada = Math.round((deudaLiquidada + dineroRestante) * 100) / 100;
        dineroRestante = 0;
        break;
      }
    }
  }

  // 3. Excedente o abono sin deuda -> Asignar como Saldo a Favor
  let saldoAcreditado = 0;
  if (dineroRestante > 0) {
    saldoAcreditado = dineroRestante;
    const metodoRegistro = esVuelto ? 'vuelto_saldo_favor' : 'abono_saldo_favor';
    const { error: errAbono } = await supabase.from('consumos').insert({
      cliente_id: clienteId,
      monto_total_usd: dineroRestante,
      tasa_bcv_historica: tasaBcv,
      metodo_pago: metodoRegistro,
      pagado: true,
    });

    if (errAbono) {
      console.error('Error insertando saldo a favor en Supabase:', errAbono);
      throw new Error('Error al registrar saldo a favor en Supabase: ' + errAbono.message);
    }
  }

  let mensaje = '';
  if (deudaLiquidada > 0 && saldoAcreditado > 0) {
    mensaje = `¡Deuda saldada ($${deudaLiquidada.toFixed(2)}) y sobrante de $${saldoAcreditado.toFixed(2)} acreditado como saldo a favor!`;
  } else if (deudaLiquidada > 0) {
    mensaje = `¡Se liquidaron $${deudaLiquidada.toFixed(2)} de deuda pendiente exitosamente!`;
  } else {
    mensaje = `¡Se acreditaron $${saldoAcreditado.toFixed(2)} como saldo a favor exitosamente!`;
  }

  // Notificar al contexto global de notificaciones para actualizar badges en tiempo real
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('club5:actualizar-notificaciones'));
  }

  return {
    exito: true,
    deudaLiquidadaUsd: deudaLiquidada,
    saldoAFavorAcreditadoUsd: saldoAcreditado,
    mensaje,
  };
}
