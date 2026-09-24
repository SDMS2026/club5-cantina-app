import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

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
}

export async function POST(req: NextRequest) {
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

    // 3. System Prompt estructurado para Inteligencia Artificial
    const systemPrompt = `Eres el asistente inteligente de caja de "Club 5 Cantina Escolar".
Tu misión es interpretar la transcripción en lenguaje natural dictada por voz por el cajero o cliente y convertirla en una orden o registro estructurado en formato JSON estricto.

CONTEXTO DE PRODUCTOS DISPONIBLES EN LA CANTINA:
${JSON.stringify(catalogoContexto, null, 2)}

CONTEXTO DE CLIENTES Y ESTUDIANTES YA REGISTRADOS:
${JSON.stringify(clientesContexto, null, 2)}

INSTRUCCIONES CLAVE:
1. Mapeo de Productos ("items"):
   - Analiza las palabras del usuario en español venezolano (ej: "empanada de queso", "tequeños", "malta", "jugo de naranja", "pastelito", "brownie").
   - Relaciona cada producto mencionado con el "id" más apropiado del catálogo disponible.
   - Extrae la cantidad mencionada (ej: "una" = 1, "dos" = 2, "3", "media docena" = 6, "una ración" = 1). Si no se menciona cantidad, asume 1.
   - Si no se mencionan productos (por ejemplo, si solo pide registrar a alguien), retorna "items": [].

2. Mapeo de Cliente Existente ("cliente_id"):
   - Si se menciona un cliente que YA está registrado, coloca su "id" exacto de la base de datos.
   - Si no está registrado o no se menciona, coloca null.

3. Registro de Nuevo Estudiante / Profesor / Representante ("nuevo_cliente"):
   - Si la frase indica una instrucción para añadir o registrar a alguien al sistema (ej: "Añade al sistema al estudiante Mario Gómez, cursa quinto grado, representante Penélope Patterson...", "Registra al profesor de matemáticas Sebastián Martínez...", "Añade a este representante..."):
     Extrae el objeto:
     {
       "nombre_estudiante": "Nombre y apellido de la persona",
       "grado_seccion": "Nivel escolar, grado o rol (ej: '5to Grado A', 'Profesor / Docente', 'Representante / Padre de Familia', '3er Año B')",
       "nombre_representante": "Para estudiantes: Nombre del representante. Para profesores o personal: El cargo, materia o área (ej: 'Profesor de Matemáticas', 'Coordinador de Ciencias', 'Docente de Biología') o null",
       "cargo": "Materia, especialidad o cargo si es profesor/docente (ej: 'Profesor de Matemáticas') o null",
       "telefono_whatsapp": "Número telefónico en formato estándar (ej: '+58 424 936 9950') o null"
     }
   - Si no se solicita registrar a nadie nuevo, coloca "nuevo_cliente": null.

4. Estado de Pago ("pagado"):
   - Coloca false si la frase indica que queda pendiente, fiado, anotado a la cuenta, o que se pagará después (ej: "anótalo", "a la cuenta de", "fiado", "lo paga luego", "anótaselo a").
   - Coloca true si se indica explícitamente que ya pagó o si es una venta regular de mostrador sin indicación de crédito.

ESQUEMA OBLIGATORIO DE RESPUESTA:
Debes responder ÚNICAMENTE un objeto JSON válido con la siguiente estructura (sin bloques markdown adicionales ni texto previo):
{
  "cliente_id": "string_id_o_null",
  "nuevo_cliente": {
    "nombre_estudiante": "Nombre",
    "grado_seccion": "Grado o Rol",
    "nombre_representante": "Representante o Cargo del Profesor",
    "cargo": "Cargo o Materia si es Docente o null",
    "telefono_whatsapp": "Teléfono o null"
  },
  "items": [
    {
      "producto_id": "string_id_del_producto",
      "cantidad": 1
    }
  ],
  "pagado": true,
  "resumen_interpretado": "Breve explicación en 1 frase de lo detectado"
}`;

    const userPrompt = `Transcripción del pedido por voz: "${texto}"`;

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
        // Si no es 404 (error de modelo inexistente), no seguir probando en vano si es auth error
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

    let parsedResult: RespuestaVozPos;
    try {
      parsedResult = JSON.parse(rawContent);
    } catch {
      // Limpieza por si Gemini incluye marcas de código markdown ```json ... ```
      const cleaned = rawContent
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
      parsedResult = JSON.parse(cleaned);
    }

    // Normalizar y validar estructura
    const resultadoLimpio: RespuestaVozPos = {
      cliente_id: typeof parsedResult.cliente_id === 'string' ? parsedResult.cliente_id : null,
      cliente_creado: null,
      nuevo_cliente: parsedResult.nuevo_cliente || null,
      items: Array.isArray(parsedResult.items)
        ? parsedResult.items
            .filter((item) => item && typeof item.producto_id === 'string' && Number(item.cantidad) > 0)
            .map((item) => ({
              producto_id: item.producto_id,
              cantidad: Math.max(1, Math.round(Number(item.cantidad))),
            }))
        : [],
      pagado: typeof parsedResult.pagado === 'boolean' ? parsedResult.pagado : true,
      resumen_interpretado: parsedResult.resumen_interpretado || 'Procesado con éxito',
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
        // Verificar si ya existe en Supabase
        const { data: existente } = await supabase
          .from('clientes')
          .select('*')
          .ilike('nombre_estudiante', `%${nom}%`)
          .limit(1);

        if (existente && existente.length > 0) {
          let clienteActualizado = existente[0];
          // Si el cliente ya existía pero ahora se suministró su cargo y estaba vacío, actualizarlo
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
          // Registrar nuevo cliente en Supabase
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
