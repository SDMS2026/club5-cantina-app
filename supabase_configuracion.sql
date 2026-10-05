-- ==============================================================================
-- MIGRACIÓN DE CONFIGURACIÓN DEL SISTEMA Y PLANTILLAS DE WHATSAPP (CLUB 5 CANTINA)
-- ==============================================================================
-- Instrucciones:
-- Copia y pega el contenido en el SQL Editor de Supabase
-- (Dashboard de Supabase -> SQL Editor -> New Query -> Run).
-- ==============================================================================

-- 1. Crear tabla 'configuracion'
CREATE TABLE IF NOT EXISTS public.configuracion (
    clave TEXT PRIMARY KEY,
    valor JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar Row Level Security (RLS)
ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;

-- 3. Crear política permisiva para lectura, inserción y actualización
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'configuracion' 
        AND policyname = 'Permitir todo en configuracion'
    ) THEN
        CREATE POLICY "Permitir todo en configuracion" 
        ON public.configuracion 
        FOR ALL 
        TO anon, authenticated 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$;

-- 4. Insertar configuración inicial por defecto si no existe
INSERT INTO public.configuracion (clave, valor)
VALUES (
    'sistema_general',
    '{
        "pagoMovil": {
            "banco": "BNC (Banco Nacional de Crédito - 0191)",
            "cedula": "14953511",
            "telefono_pagomovil": "04125404830",
            "telefono_reporte": "04123588848",
            "nombre_cantina": "Club 5 Cantina Escolar",
            "nota_efectivo": "Directamente en caja de cantina ($ o Bs.)"
        },
        "ajustes": {
            "moneda_principal": "USD",
            "confirmar_anulaciones": true,
            "notificar_deuda_limite": true
        }
    }'::jsonb
)
ON CONFLICT (clave) DO NOTHING;
