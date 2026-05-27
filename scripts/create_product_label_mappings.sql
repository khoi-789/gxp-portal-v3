-- SQL Script to setup product_label_mappings table

-- Create product_label_mappings table
CREATE TABLE IF NOT EXISTS public.product_label_mappings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_item_code TEXT NOT NULL REFERENCES public.master_items(item_code) ON DELETE CASCADE,
    label_item_code TEXT NOT NULL REFERENCES public.master_items(item_code) ON DELETE CASCADE,
    quantity_per_unit NUMERIC NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (product_item_code, label_item_code)
);

-- Disable RLS (for demo access)
ALTER TABLE public.product_label_mappings DISABLE ROW LEVEL SECURITY;
