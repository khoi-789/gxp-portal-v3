-- SQL Script to setup Supabase Database Schema for Import (IMP) Module

-- 1. Create imp_shipments table
CREATE TABLE IF NOT EXISTS public.imp_shipments (
    invoice_number TEXT PRIMARY KEY,
    created_date DATE NOT NULL DEFAULT CURRENT_DATE,
    supplier_code TEXT NOT NULL,
    coa_status TEXT NOT NULL DEFAULT 'Chưa có',
    label_status TEXT NOT NULL DEFAULT 'Chưa có',
    progress_status TEXT NOT NULL DEFAULT 'Created',
    has_data_logger BOOLEAN NOT NULL DEFAULT false,
    data_logger_type TEXT,
    logger_qty NUMERIC DEFAULT 0,
    temp_out_of_range BOOLEAN NOT NULL DEFAULT false,
    temp_out_of_range_details TEXT,
    import_date_lh DATE,
    import_date_hn DATE,
    import_date_lh_text TEXT,
    import_date_hn_text TEXT,
    invoice_link TEXT,
    supplier_link TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Disable RLS for imp_shipments (for public demo access, can be secured later)
ALTER TABLE public.imp_shipments DISABLE ROW LEVEL SECURITY;

-- 2. Create imp_shipment_items table
CREATE TABLE IF NOT EXISTS public.imp_shipment_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    invoice_number TEXT NOT NULL REFERENCES public.imp_shipments(invoice_number) ON DELETE CASCADE,
    item_code TEXT,
    item_name TEXT NOT NULL,
    issue_notes TEXT,
    resolution_notes TEXT,
    required_labels JSONB DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Disable RLS for imp_shipment_items (for public demo access, can be secured later)
ALTER TABLE public.imp_shipment_items DISABLE ROW LEVEL SECURITY;
