-- SQL Script to setup Supabase Database Schema for GxP Portal v3

-- 1. Create master_items table
CREATE TABLE IF NOT EXISTS public.master_items (
    item_code TEXT PRIMARY KEY,
    item_name TEXT NOT NULL,
    supplier_code TEXT NOT NULL,
    visa_no TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Disable RLS for master_items (for public demo access, can be secured later)
ALTER TABLE public.master_items DISABLE ROW LEVEL SECURITY;

-- 2. Create destruction_records table
CREATE TABLE IF NOT EXISTS public.destruction_records (
    id BIGINT PRIMARY KEY,
    owner TEXT NOT NULL,
    item TEXT NOT NULL,
    descr TEXT NOT NULL,
    location TEXT NOT NULL,
    lpn TEXT NOT NULL,
    on_hand NUMERIC NOT NULL,
    available NUMERIC NOT NULL,
    status TEXT NOT NULL,
    visa TEXT,
    lot_no TEXT NOT NULL,
    exp_date TEXT NOT NULL,
    so_batch TEXT NOT NULL,
    ly_do_hold TEXT,
    loai_hold TEXT,
    ngay_hold TEXT,
    nguoi_hold TEXT,
    ghi_chu TEXT,
    gross_wgt NUMERIC NOT NULL,
    net_wgt NUMERIC NOT NULL,
    tare NUMERIC NOT NULL,
    cube NUMERIC NOT NULL,
    inner_pack NUMERIC NOT NULL,
    case_cnt NUMERIC NOT NULL,
    pallet NUMERIC NOT NULL,
    uom TEXT NOT NULL,
    decision TEXT DEFAULT ''::text,
    so_luong_huy NUMERIC DEFAULT 0,
    ly_do_qd TEXT DEFAULT ''::text,
    nguoi_duyet TEXT,
    ngay_duyet TEXT
);

-- Disable RLS for destruction_records (for public demo access, can be secured later)
ALTER TABLE public.destruction_records DISABLE ROW LEVEL SECURITY;

-- 3. Create vendor_rules table
CREATE TABLE IF NOT EXISTS public.vendor_rules (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    prefix TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Disable RLS for vendor_rules (for public demo access, can be secured later)
ALTER TABLE public.vendor_rules DISABLE ROW LEVEL SECURITY;

-- Seed default vendor rules
INSERT INTO public.vendor_rules (prefix, label) VALUES
('BK', 'BP TBYT'),
('ST9-', 'BP TBYT'),
('NM', 'BP TBYT'),
('TT', 'P.Tem'),
('BA', 'P.Tem')
ON CONFLICT (prefix) DO UPDATE SET label = EXCLUDED.label;
