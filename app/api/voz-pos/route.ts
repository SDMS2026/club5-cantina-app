import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { procesarAbonoCliente } from '@/lib/clientBalance';
import { obtenerTasaBCV, TASA_BCV_FALLBACK_DEFAULT } from '@/lib/dolarApi';
import { isMaintenanceMode } from '@/lib/maintenance';

export const dynamic = 'force-dynamic';

interface ItemProcesado {
  producto_id: string;
  cantidad: number;
}

interface NuevoClienteExtraido {
  nombre_estudiante: string;
  grado_seccion?: string;
  nombre_representante?: string;
  cargo?: string;
  telefono_whatsapp?: string;
}

interface RespuestaVozPos {
  accion: 'orden_pos' | 'abono_saldo_favor' | 'guardar_vuelto';
  monto_abono_usd?: number;
  metodo_pago_sugerido?: 'efectivo_usd' | 'pago_movil' | 'punto_debito' | 'pendiente' | 'saldo_favor';
  cliente_id: string | null;
  cliente_creado?: {
    id: string;
    nombre_estudiante: string;
    grado_seccion?: string | null;
    nombre_representante?: string | null;
    telefono_whatsapp?: string | null;
  } | null;
  nuevo_cliente?: NuevoClienteExtraido | null;
  items: ItemProcesado[];
  pagado: boolean;
  resumen_interpretado?: string;
  detalle_abono?: {
    deudaLiquidadaUsd: number;
    saldoAFavorAcreditadoUsd: number;
    mensaje: string;
  } | null;
}

export async function POST(req: NextRequest) {
  if (isMaintenanceMode()) {
    return NextResponse.json(
      { error: 'Sitio en Mantenimiento - Actualizando Club 5 Cantina Escolar. Regresaremos en breve.' },
      { status: 503 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const headerKey = req.headers.get('x-gemini-api-key')?.trim();
    const bodyKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';
    const envKey = process.env.GEMINI_API_KEY?.trim() || '';

    const apiKey = headerKey || bodyKey || envKey;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'GEMINI_API_KEY no configurada',
          detalles:
            'Debes agregar tu GEMINI_API_KEY en el archivo .env.local o ingresarla directamente en la ventana emergente para usar Gemini 1.5 Flash.',
        },
        { status: 400 }
      );
    }
    const texto = body?.texto?.trim();

    if (!texto) {
      return NextResponse.json(
        {
          error: 'Texto vacío',
          detalles: 'No se recibió ninguna transcripción de voz para procesar.',
        },
        { status: 400 }
      );
    }

    // 1. Obtener lista de productos activos de Supabase
    const { data: productos, error: errProd } = await supabase
      .from('productos')
      .select('id, nombre, precio_usd, categoria')
      .eq('activo', true);

    if (errProd) {
      console.error('Error consultando productos para Gemini:', errProd);
    }

    // 2. Obtener lista de clientes / estudiantes de Supabase
    const { data: clientes, error: errCli } = await supabase
      .from('clientes')
      .select('id, nombre_estudiante, grado_seccion, nombre_representante');

    if (errCli) {
      console.error('Error consultando clientes para Gemini:', errCli);
    }

    const catalogoContexto = (productos || []).map((p) => ({
      id: p.id,
      nombre: p.nombre,
      precio: p.precio_usd,
      categoria: p.categoria || 'General',
    }));

    const clientesContexto = (clientes || []).map((c) => ({
      id: c.id,
      estudiante: c.nombre_estudiante,
      grado: c.grado_seccion || '',
      representante: c.nombre_representante || '',
    }));

    // 3. System Prompt estructurado para Gemini 1.5 Flash
    const systemPrompt = `Eres el asistente inteligente de caja de "Club 5 Cantina Escolar".
Tu misión es interpretar la transcripción en lenguaje natural dictada por voz por el cajero o cliente y convertirla en una orden, abono financiero o registro estructurado en formato JSON estricto.

CONTEXTO DE PRODUCTOS DISPONIBLES EN LA CANTINA:
${JSON.stringify(catalogoContexto, null, 2)}

CONTEXTO DE CLIENTES Y ESTUDIANTES YA REGISTRADOS:
${JSON.stringify(clientesContexto, null, 2)}

INSTRUCCIONES CLAVE DE INTERPRETACIÓN:
1. Determinación de la Acción Financiera ("accion"):
   - "abono_saldo_favor": Si la instrucción pide abonar dinero, hacer un depósito o registrar un pago adelantado para un estudiante, profesor o cliente.
     Ejemplos:
     * "Abona $5 a favor del alumno Mateo Rivas" -> accion: "abono_saldo_favor", monto_abono_usd: 5.0, cliente: Mateo Rivas, items: []
     * "Registra un pago adelantado de $10 para la profesora Sofía Martínez" -> accion: "abono_saldo_favor", monto_abono_usd: 10.0, cliente: Sofía Martínez, items: []
     * "Abono de 3 dólares a Juan" -> accion: "abono_saldo_favor", monto_abono_usd: 3.0, items: []
   - "guardar_vuelto": Si la frase pide guardar o acreditar el vuelto o cambio como saldo a favor.
     Ejemplos:
     * "Guarda el vuelto de $0.50 como saldo a favor de Alejandro Pérez" -> accion: "guardar_vuelto", monto_abono_usd: 0.50, cliente: Alejandro Pérez, items: []
     * "Acredita el vuelto de 1 dólar a la cuenta de Mateo" -> accion: "guardar_vuelto", monto_abono_usd: 1.0, items: []
   - "orden_pos": Si se piden productos para consumir en el punto de venta.
     Ejemplos:
     * "Una empanada de queso y una malta"
     * "Carga dos empanadas a la cuenta de Sebastián Martínez y paga usando su saldo a favor" -> accion: "orden_pos", metodo_pago_sugerido: "saldo_favor", pagado: true

2. Método de Pago Sugerido ("metodo_pago_sugerido"):
   - "saldo_favor": Si la orden indica expresamente pagar con su saldo a favor, crédito a favor o dinero disponible (ej: "paga usando su saldo a favor", "cóbralo de su crédito a favor", "de su saldo"). pagado = true.
   - "pendiente": Si se indica fiado, anotado a la cuenta, etc. pagado = false.
   - "pago_movil": Si menciona pagar con pago móvil o transferencia.
   - "efectivo_usd": Cobro en efectivo o no especificado.

3. Mapeo de Productos ("items"):
   - Para pedidos de productos, relaciona cada ítem con el "id" más apropiado del catálogo.
   - Si la acción es "abono_saldo_favor" o "guardar_vuelto", "items" debe ser una lista vacía [].

4. Mapeo de Cliente ("cliente_id"):
   - Identifica el cliente mencionado y coloca su "id" exacto de la base de datos. Si no existe, null.

5. Registro de Nuevo Cliente ("nuevo_cliente"):
   - Si la frase indica agregar a una persona al sistema (ej: "Añade al sistema al estudiante Mario Gómez, 5to grado..."):
     Extrae su nombre_estudiante, grado_seccion, nombre_representante, cargo, telefono_whatsapp. Si no, null.

ESQUEMA OBLIGATORIO DE RESPUESTA JSON:
{
  "accion": "orden_pos" | "abono_saldo_favor" | "guardar_vuelto",
  "monto_abono_usd": 0.0,
  "metodo_pago_sugerido": "efectivo_usd" | "pago_movil" | "punto_debito" | "pendiente" | "saldo_favor",
  "cliente_id": "string_id_o_null",
  "nuevo_cliente": {
    "nombre_estudiante": "Nombre",
    "grado_seccion": "Grado o Rol",
    "nombre_representante": "Representante o Cargo del Profesor",
    "cargo": "Cargo o Materia si es Docente o null",
    "telefono_whatsapp": "Teléfono o null"
  } | null,
  "items": [
    {
      "producto_id": "string_id_del_producto",
      "cantidad": 1
    }
  ],
  "pagado": true,
  "resumen_interpretado": "Breve explicación en 1 frase de lo detectado"
}`;

    const userPrompt = `Transcripción dictada por voz: "${texto}"`;

    // 4. Llamar a la API REST de Gemini (con fallback dinámico de modelos)
    const modelosCandidatos = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-1.5-flash'];
    const geminiReqBody = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: `${systemPrompt}\n\n${userPrompt}` },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any = null;
    let ultimoError = '';

    for (const modelo of modelosCandidatos) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(geminiReqBody),
      });

      if (response.ok) {
        data = await response.json();
        break;
      } else {
        const errText = await response.text();
        ultimoError = `[${modelo}] (${response.status}): ${errText}`;
        console.warn(`Intento con ${modelo} falló:`, response.status, errText);
        if (response.status === 400 || response.status === 403) {
          return NextResponse.json(
            {
              error: `Error de autenticación con Gemini API (${response.status})`,
              detalles: errText,
            },
            { status: response.status }
          );
        }
      }
    }

    if (!data) {
      return NextResponse.json(
        {
          error: 'Error comunicándose con Gemini API',
          detalles: ultimoError || 'Ningún modelo disponible pudo responder a la solicitud.',
        },
        { status: 502 }
      );
    }

    const rawContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawContent) {
      return NextResponse.json(
        {
          error: 'Respuesta vacía de Gemini',
          detalles: 'El modelo no devolvió ningún contenido procesable.',
        },
        { status: 502 }
      );
    }

    let parsedResult: any;
    try {
      parsedResult = JSON.parse(rawContent);
    } catch {
      const cleaned = rawContent
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
      parsedResult = JSON.parse(cleaned);
    }

    // Normalizar y validar estructura
    const resultadoLimpio: RespuestaVozPos = {
      accion:
        parsedResult.accion === 'abono_saldo_favor' || parsedResult.accion === 'guardar_vuelto'
          ? parsedResult.accion
          : 'orden_pos',
      monto_abono_usd: Number(parsedResult.monto_abono_usd) || 0,
      metodo_pago_sugerido: parsedResult.metodo_pago_sugerido || (parsedResult.pagado === false ? 'pendiente' : 'efectivo_usd'),
      cliente_id: typeof parsedResult.cliente_id === 'string' ? parsedResult.cliente_id : null,
      cliente_creado: null,
      nuevo_cliente: parsedResult.nuevo_cliente || null,
      items: Array.isArray(parsedResult.items)
        ? parsedResult.items
            .filter((item: any) => item && typeof item.producto_id === 'string' && Number(item.cantidad) > 0)
            .map((item: any) => ({
              producto_id: item.producto_id,
              cantidad: Math.max(1, Math.round(Number(item.cantidad))),
            }))
        : [],
      pagado: typeof parsedResult.pagado === 'boolean' ? parsedResult.pagado : true,
      resumen_interpretado: parsedResult.resumen_interpretado || 'Procesado con éxito',
      detalle_abono: null,
    };

    // Si se dictó registrar a un nuevo estudiante, profesor o representante:
    if (parsedResult.nuevo_cliente && typeof parsedResult.nuevo_cliente.nombre_estudiante === 'string') {
      const nom = parsedResult.nuevo_cliente.nombre_estudiante.trim();
      const grado = parsedResult.nuevo_cliente.grado_seccion?.trim() || 'Estudiante';
      const cargoOrep = (
        parsedResult.nuevo_cliente.cargo ||
        parsedResult.nuevo_cliente.nombre_representante ||
        ''
      ).trim() || null;
      const tel = parsedResult.nuevo_cliente.telefono_whatsapp?.trim() || null;

      if (nom) {
        const { data: existente } = await supabase
          .from('clientes')
          .select('*')
          .ilike('nombre_estudiante', `%${nom}%`)
          .limit(1);

        if (existente && existente.length > 0) {
          let clienteActualizado = existente[0];
          if (cargoOrep && !existente[0].nombre_representante) {
            const { data: upd } = await supabase
              .from('clientes')
              .update({ nombre_representante: cargoOrep })
              .eq('id', existente[0].id)
              .select()
              .single();
            if (upd) clienteActualizado = upd;
          }
          resultadoLimpio.cliente_id = clienteActualizado.id;
          resultadoLimpio.cliente_creado = clienteActualizado;
        } else {
          const { data: insertado, error: errIns } = await supabase
            .from('clientes')
            .insert([
              {
                nombre_estudiante: nom,
                grado_seccion: grado,
                nombre_representante: cargoOrep,
                telefono_whatsapp: tel,
              },
            ])
            .select()
            .single();

          if (!errIns && insertado) {
            resultadoLimpio.cliente_id = insertado.id;
            resultadoLimpio.cliente_creado = insertado;
            resultadoLimpio.resumen_interpretado = `¡${nom} registrado con éxito en el sistema! ${resultadoLimpio.resumen_interpretado}`;
          }
        }
      }
    }

    // Si la acción es "abono_saldo_favor" o "guardar_vuelto", procesar el abono directamente en Supabase
    if (
      (resultadoLimpio.accion === 'abono_saldo_favor' || resultadoLimpio.accion === 'guardar_vuelto') &&
      resultadoLimpio.cliente_id &&
      resultadoLimpio.monto_abono_usd &&
      resultadoLimpio.monto_abono_usd > 0
    ) {
      let tasaBcvActual = TASA_BCV_FALLBACK_DEFAULT;
      try {
        tasaBcvActual = await obtenerTasaBCV();
      } catch (e) {
        console.warn('Fallback a tasa por defecto para abono:', e);
      }

      const resAbono = await procesarAbonoCliente({
        clienteId: resultadoLimpio.cliente_id,
        montoUsd: resultadoLimpio.monto_abono_usd,
        metodoPago: resultadoLimpio.accion === 'guardar_vuelto' ? 'vuelto_saldo_favor' : 'abono_saldo_favor',
        tasaBcv: tasaBcvActual,
        esVuelto: resultadoLimpio.accion === 'guardar_vuelto',
      });

      resultadoLimpio.detalle_abono = resAbono;
      resultadoLimpio.resumen_interpretado = resAbono.mensaje;
    }

    return NextResponse.json(resultadoLimpio);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error general en endpoint /api/voz-pos:', error);
    return NextResponse.json(
      {
        error: 'Error interno al procesar el pedido por voz',
        detalles: msg,
      },
      { status: 500 }
    );
  }
}
