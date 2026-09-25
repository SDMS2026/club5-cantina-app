import { NextResponse } from 'next/server';
import { isMaintenanceMode } from '@/lib/maintenance';

export const dynamic = 'force-dynamic';

export async function GET() {
  const activo = isMaintenanceMode();

  return NextResponse.json(
    {
      mantenimiento: activo,
      mensaje: activo
        ? 'Sitio en Mantenimiento - Actualizando Club 5 Cantina Escolar'
        : 'Sistema operativo y disponible',
      timestamp: new Date().toISOString(),
    },
    {
      status: activo ? 503 : 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    }
  );
}
