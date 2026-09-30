-- ==============================================================================
-- MIGRACIÓN DE PROVEEDORES Y CUENTAS POR PAGAR (CLUB 5 CANTINA)
-- ==============================================================================
-- Instrucciones:
-- Copia y pega todo el contenido de este archivo en el SQL Editor de tu proyecto Supabase
-- (Dashboard de Supabase -> SQL Editor -> New Query -> Run).
-- ==============================================================================

-- 1. Crear tabla independiente 'proveedores' con datos de Pago Móvil
CREATE TABLE IF NOT EXISTS public.proveedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL UNIQUE,
    telefono TEXT,
    categoria TEXT,
    notas TEXT,
    banco TEXT,
    telefono_pagomovil TEXT,
    cedula_rif TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Si la tabla ya fue creada previamente sin estas columnas, agregarlas de forma segura:
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'proveedores' AND column_name = 'banco') THEN
        ALTER TABLE public.proveedores ADD COLUMN banco TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'proveedores' AND column_name = 'telefono_pagomovil') THEN
        ALTER TABLE public.proveedores ADD COLUMN telefono_pagomovil TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'proveedores' AND column_name = 'cedula_rif') THEN
        ALTER TABLE public.proveedores ADD COLUMN cedula_rif TEXT;
    END IF;
END $$;

-- 2. Habilitar Row Level Security (RLS) en 'proveedores'
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;

-- 3. Crear política permisiva para lectura, inserción, actualización y eliminación
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'proveedores' 
        AND policyname = 'Permitir todo en proveedores'
    ) THEN
        CREATE POLICY "Permitir todo en proveedores" 
        ON public.proveedores 
        FOR ALL 
        TO anon, authenticated 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$;

-- 4. Agregar columna 'proveedor_id' como Foreign Key a 'proveedores_cuentas'
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'proveedores_cuentas' 
        AND column_name = 'proveedor_id'
    ) THEN
        ALTER TABLE public.proveedores_cuentas 
        ADD COLUMN proveedor_id UUID REFERENCES public.proveedores(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 5. Agregar columna 'proveedor_id' a 'cuentas_por_pagar' (en caso de que exista dicha tabla)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'cuentas_por_pagar'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'cuentas_por_pagar' 
            AND column_name = 'proveedor_id'
        ) THEN
            ALTER TABLE public.cuentas_por_pagar 
            ADD COLUMN proveedor_id UUID REFERENCES public.proveedores(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- 6. Migrar proveedores existentes desde 'proveedores_cuentas' a la nueva tabla 'proveedores'
INSERT INTO public.proveedores (nombre)
SELECT DISTINCT TRIM(nombre_proveedor)
FROM public.proveedores_cuentas
WHERE nombre_proveedor IS NOT NULL AND TRIM(nombre_proveedor) <> ''
ON CONFLICT (nombre) DO NOTHING;

-- 7. Enlazar las cuentas existentes con los proveedores recién registrados
UPDATE public.proveedores_cuentas pc
SET proveedor_id = p.id
FROM public.proveedores p
WHERE TRIM(pc.nombre_proveedor) = p.nombre
AND pc.proveedor_id IS NULL;

-- 8. Habilitar la replicación Realtime de Supabase para la tabla 'proveedores'
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 
            FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND schemaname = 'public' 
            AND tablename = 'proveedores'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.proveedores;
        END IF;
    END IF;
END $$;
