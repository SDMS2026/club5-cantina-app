'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { obtenerTasaBCV, TASA_BCV_FALLBACK_DEFAULT } from '@/lib/dolarApi';
import { calcularConversionBs, formatUSD } from '@/lib/utils';
import { ProveedorCuenta } from '@/types/pos';
import { obtenerSaldosTodosClientes } from '@/lib/clientBalance';

export interface NotificacionItem {
  id: string;
  tipo: 'proveedor_vencido' | 'proveedor_proximo' | 'proveedor_pendiente' | 'cliente_deuda' | 'sistema';
  titulo: string;
  descripcion: string;
  montoUsd?: number;
  montoBs?: number;
  etiqueta?: string;
  color: 'rose' | 'amber' | 'emerald' | 'indigo';
  href: string;
  fecha?: string;
}

export interface NotificationsData {
  proveedores: {
    total: number;
    pendientes: number;
    pagadas: number;
    vencidas: number;
    proximas: number;
    totalPendienteUsd: number;
    totalPendienteBs: number;
    alertas: NotificacionItem[];
  };
  deudas: {
    clientesConDeuda: number;
    totalDeudaUsd: number;
    totalDeudaBs: number;
    consumosPendientes: number;
    alertas: NotificacionItem[];
  };
  tasaBcv: number;
  totalAlertasCriticas: number;
}

const DEFAULT_DATA: NotificationsData = {
  proveedores: {
    total: 0,
    pendientes: 0,
    pagadas: 0,
    vencidas: 0,
    proximas: 0,
    totalPendienteUsd: 0,
    totalPendienteBs: 0,
    alertas: [],
  },
  deudas: {
    clientesConDeuda: 0,
    totalDeudaUsd: 0,
    totalDeudaBs: 0,
    consumosPendientes: 0,
    alertas: [],
  },
  tasaBcv: TASA_BCV_FALLBACK_DEFAULT,
  totalAlertasCriticas: 0,
};

interface NotificationsContextType {
  data: NotificationsData;
  cargando: boolean;
  refrescar: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType>({
  data: DEFAULT_DATA,
  cargando: true,
  refrescar: async () => {},
});

export const EVENTO_ACTUALIZAR_NOTIFICACIONES = 'club5:actualizar-notificaciones';

/**
 * Disparador global para que cualquier página refresque las notificaciones
 * en el Sidebar y Navbar de forma reactiva sin recargar la página.
 */
export function refrescarNotificacionesGlobales() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENTO_ACTUALIZAR_NOTIFICACIONES));
  }
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [data, setData] = useState<NotificationsData>(DEFAULT_DATA);
  const [cargando, setCargando] = useState<boolean>(true);

  const cargarDatos = useCallback(async () => {
    try {
      // 1. Obtener Tasa BCV
      let tasaActual = TASA_BCV_FALLBACK_DEFAULT;
      try {
        const tasa = await obtenerTasaBCV();
        if (tasa && tasa > 0) tasaActual = tasa;
      } catch (e) {
        console.error('Error al obtener tasa BCV para notificaciones:', e);
      }

      // 2. Obtener Cuentas por Pagar a Proveedores
      const { data: cuentasData, error: cuentasErr } = await supabase
        .from('proveedores_cuentas')
        .select('*')
        .order('fecha_vencimiento_pago', { ascending: true });

      if (cuentasErr) {
        console.error('Error al cargar cuentas de proveedores en notificaciones:', cuentasErr);
      }

      const cuentas = (cuentasData as ProveedorCuenta[]) || [];
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      let totalProv = cuentas.length;
      let pendientesProv = 0;
      let pagadasProv = 0;
      let vencidasProv = 0;
      let proximasProv = 0;
      let totalPendienteUsdProv = 0;
      const alertasProv: NotificacionItem[] = [];

      cuentas.forEach((c) => {
        const monto = Number(c.monto_usd || 0);
        if (c.pagado) {
          pagadasProv++;
        } else {
          pendientesProv++;
          totalPendienteUsdProv += monto;

          const [y, m, d] = (c.fecha_vencimiento_pago || '').split('-').map(Number);
          const venc = new Date(y, (m || 1) - 1, d || 1);
          venc.setHours(0, 0, 0, 0);

          const diffDays = Math.ceil((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
          const montoBs = calcularConversionBs(monto, tasaActual);

          if (diffDays < 0) {
            vencidasProv++;
            alertasProv.push({
              id: `prov-venc-${c.id}`,
              tipo: 'proveedor_vencido',
              titulo: c.nombre_proveedor,
              descripcion: `Factura de mercancía vencida hace ${Math.abs(diffDays)} ${
                Math.abs(diffDays) === 1 ? 'día' : 'días'
              }: ${c.concepto_mercancia}`,
              montoUsd: monto,
              montoBs,
              etiqueta: `Vencida (-${Math.abs(diffDays)}d)`,
              color: 'rose',
              href: '/proveedores',
              fecha: c.fecha_vencimiento_pago,
            });
          } else if (diffDays <= 3) {
            proximasProv++;
            alertasProv.push({
              id: `prov-prox-${c.id}`,
              tipo: 'proveedor_proximo',
              titulo: c.nombre_proveedor,
              descripcion:
                diffDays === 0
                  ? `Factura vence HOY: ${c.concepto_mercancia}`
                  : `Vence en ${diffDays} ${diffDays === 1 ? 'día' : 'días'}: ${c.concepto_mercancia}`,
              montoUsd: monto,
              montoBs,
              etiqueta: diffDays === 0 ? 'Vence hoy' : `Vence en ${diffDays}d`,
              color: 'amber',
              href: '/proveedores',
              fecha: c.fecha_vencimiento_pago,
            });
          } else {
            alertasProv.push({
              id: `prov-pend-${c.id}`,
              tipo: 'proveedor_pendiente',
              titulo: c.nombre_proveedor,
              descripcion: `${c.concepto_mercancia}`,
              montoUsd: monto,
              montoBs,
              etiqueta: `Plazo: ${diffDays}d`,
              color: 'indigo',
              href: '/proveedores',
              fecha: c.fecha_vencimiento_pago,
            });
          }
        }
      });

      const totalPendienteBsProv = calcularConversionBs(totalPendienteUsdProv, tasaActual);

      // 3. Obtener Cuentas por Cobrar directamente de la cuenta corriente unificada (clientes.saldo < 0)
      const { data: clientesConDeudaData, error: clientesErr } = await supabase
        .from('clientes')
        .select('id, nombre_estudiante, grado_seccion, nombre_representante, saldo')
        .lt('saldo', 0)
        .order('saldo', { ascending: true });

      if (clientesErr) {
        console.error('Error al cargar clientes con saldo deudor en notificaciones:', clientesErr);
      }

      const clientesConDeuda = clientesConDeudaData || [];
      let totalDeudaUsd = 0;
      const alertasDeudas: NotificacionItem[] = [];

      clientesConDeuda.forEach((c) => {
        const saldoVal = Number(c.saldo || 0);
        const deudaUsd = Math.round(Math.abs(saldoVal) * 100) / 100;
        totalDeudaUsd += deudaUsd;

        const nombre = c.nombre_estudiante || 'Cliente';
        const grado = c.grado_seccion ? ` (${c.grado_seccion})` : '';
        const montoBs = calcularConversionBs(deudaUsd, tasaActual);

        alertasDeudas.push({
          id: `deuda-${c.id}`,
          tipo: 'cliente_deuda',
          titulo: `${nombre}${grado}`,
          descripcion: `Cuenta corriente con saldo deudor: -${formatUSD(deudaUsd)}`,
          montoUsd: deudaUsd,
          montoBs,
          etiqueta: 'Saldo por cobrar',
          color: 'amber',
          href: '/deudas',
        });
      });

      const totalDeudaBs = calcularConversionBs(totalDeudaUsd, tasaActual);
      const totalAlertasCriticas = vencidasProv + proximasProv + (clientesConDeuda.length > 0 ? 1 : 0);

      setData({
        proveedores: {
          total: totalProv,
          pendientes: pendientesProv,
          pagadas: pagadasProv,
          vencidas: vencidasProv,
          proximas: proximasProv,
          totalPendienteUsd: totalPendienteUsdProv,
          totalPendienteBs: totalPendienteBsProv,
          alertas: alertasProv,
        },
        deudas: {
          clientesConDeuda: clientesConDeuda.length,
          totalDeudaUsd,
          totalDeudaBs,
          consumosPendientes: clientesConDeuda.length,
          alertas: alertasDeudas,
        },
        tasaBcv: tasaActual,
        totalAlertasCriticas,
      });
    } catch (err) {
      console.error('Error general al refrescar centro de notificaciones:', err);
    } finally {
      setCargando(false);
    }
  }, []);

  // 1. Sincronización instantánea al cambiar de ruta en la aplicación
  useEffect(() => {
    cargarDatos();
  }, [pathname, cargarDatos]);

  // 2. Sondeo regular en segundo plano (cada 12s) para mantener badges 100% frescos
  useEffect(() => {
    const timer = setInterval(() => {
      cargarDatos();
    }, 12000);
    return () => clearInterval(timer);
  }, [cargarDatos]);

  useEffect(() => {
    // Suscripción al evento personalizado local
    const handleEvento = () => {
      cargarDatos();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(EVENTO_ACTUALIZAR_NOTIFICACIONES, handleEvento);
    }

    // Sincronización Realtime con Supabase para alertas en todos los dispositivos conectados
    const canalRealtime = supabase
      .channel('notificaciones_realtime_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'proveedores_cuentas' },
        () => {
          cargarDatos();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'consumos' },
        () => {
          cargarDatos();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clientes' },
        () => {
          cargarDatos();
        }
      )
      .subscribe();

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(EVENTO_ACTUALIZAR_NOTIFICACIONES, handleEvento);
      }
      supabase.removeChannel(canalRealtime);
    };
  }, [cargarDatos]);

  return (
    <NotificationsContext.Provider value={{ data, cargando, refrescar: cargarDatos }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useSystemNotifications() {
  return useContext(NotificationsContext);
}
