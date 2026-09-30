export interface Cliente {
  id: string;
  nombre_estudiante: string;
  grado_seccion?: string | null;
  nombre_representante?: string | null;
  telefono_whatsapp?: string | null;
  created_at?: string;
  saldo?: number; // Cuenta corriente unificada (> 0: saldo a favor, < 0: deuda / cuenta por cobrar, 0: solvente)
  saldo_a_favor?: number;
  deuda_total?: number;
}

export interface Producto {
  id: string;
  nombre: string;
  precio_usd: number;
  imagen_url?: string | null;
  activo: boolean;
  categoria?: string;
}

export interface ItemCarrito {
  producto: Producto;
  cantidad: number;
}

export type MetodoPagoId = 'efectivo_usd' | 'efectivo_bs' | 'pago_movil' | 'punto_debito' | 'pendiente' | 'saldo_favor' | 'pago_mixto';

export interface MetodoPagoOpcion {
  id: MetodoPagoId;
  nombre: string;
  descripcion: string;
  moneda: 'USD' | 'Bs';
  icono: string;
  marcarPagado: boolean;
}

export interface ConsumoRegistro {
  id?: string;
  cliente_id: string | null;
  monto_total_usd: number;
  tasa_bcv_historica: number;
  metodo_pago: string;
  pagado: boolean;
  fecha?: string;
}

export interface ConsumoDetalleRegistro {
  id?: string;
  consumo_id: string;
  producto_id: string | null;
  cantidad: number;
  precio_unitario_usd: number;
}

export interface Proveedor {
  id: string;
  nombre: string;
  telefono?: string | null;
  categoria?: string | null;
  notas?: string | null;
  banco?: string | null;
  telefono_pagomovil?: string | null;
  cedula_rif?: string | null;
  created_at?: string;
}

export interface ProveedorCuenta {
  id: string;
  proveedor_id?: string | null;
  nombre_proveedor: string;
  concepto_mercancia: string;
  monto_usd: number;
  fecha_recepcion: string;
  fecha_vencimiento_pago: string;
  pagado: boolean;
  tasa_bcv_historica?: number | null;
  created_at?: string;
}

