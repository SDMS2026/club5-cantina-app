export interface Cliente {
  id: string;
  nombre_estudiante: string;
  grado_seccion?: string | null;
  nombre_representante?: string | null;
  telefono_whatsapp?: string | null;
  created_at?: string;
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

export type MetodoPagoId = 'efectivo_usd' | 'pago_movil' | 'punto_debito' | 'pendiente';

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

export interface ProveedorCuenta {
  id: string;
  nombre_proveedor: string;
  concepto_mercancia: string;
  monto_usd: number;
  fecha_recepcion: string;
  fecha_vencimiento_pago: string;
  pagado: boolean;
  tasa_bcv_historica?: number | null;
  created_at?: string;
}
