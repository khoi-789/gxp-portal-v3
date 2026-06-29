-- SQL Migration Script: Add updated_at columns and automatic triggers for master data tables
-- Copy and paste this script into the Supabase SQL Editor

-- 1. Add updated_at column to master_suppliers and product_label_mappings if they don't exist
ALTER TABLE public.master_suppliers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;
ALTER TABLE public.product_label_mappings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;
ALTER TABLE public.master_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

-- 2. Create the update_updated_at_column function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 3. Add update trigger for master_suppliers
DROP TRIGGER IF EXISTS update_master_suppliers_updated_at ON public.master_suppliers;
CREATE TRIGGER update_master_suppliers_updated_at
    BEFORE UPDATE ON public.master_suppliers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 4. Add update trigger for master_items
DROP TRIGGER IF EXISTS update_master_items_updated_at ON public.master_items;
CREATE TRIGGER update_master_items_updated_at
    BEFORE UPDATE ON public.master_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Add update trigger for product_label_mappings
DROP TRIGGER IF EXISTS update_product_label_mappings_updated_at ON public.product_label_mappings;
CREATE TRIGGER update_product_label_mappings_updated_at
    BEFORE UPDATE ON public.product_label_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
