import { ImageResponse } from 'next/og';


export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FFFFFF',
          backgroundImage:
            'radial-gradient(circle at 25px 25px, #f1f5f9 2%, transparent 0%), radial-gradient(circle at 75px 75px, #f1f5f9 2%, transparent 0%)',
          backgroundSize: '100px 100px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 64px',
            borderRadius: '28px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #E2E8F0',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.08)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 80,
              height: 80,
              borderRadius: '24px',
              backgroundColor: '#0F172A',
              color: '#F59E0B',
              fontSize: 32,
              fontWeight: 800,
              marginBottom: 24,
              boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.3)',
            }}
          >
            C5
          </div>
          <h1
            style={{
              fontSize: 48,
              fontWeight: 800,
              color: '#0F172A',
              letterSpacing: '-0.03em',
              margin: '0 0 12px 0',
              textAlign: 'center',
            }}
          >
            Club 5 Cantina Escolar
          </h1>
          <p
            style={{
              fontSize: 22,
              color: '#64748B',
              margin: 0,
              textAlign: 'center',
              maxWidth: 550,
            }}
          >
            Sistema de Punto de Venta (POS) con tasa BCV en tiempo real y facturación bimoneda.
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginTop: 28,
              padding: '8px 18px',
              borderRadius: '9999px',
              backgroundColor: '#FEF3C7',
              border: '1px solid #FDE68A',
              color: '#92400E',
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            ⚡ Tasa oficial BCV sincronizada automáticamente
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
