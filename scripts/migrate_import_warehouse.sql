-- SQL Migration Script: Reorganize Warehouse and Issues in imp_shipments table
-- Copy and paste this script into the Supabase SQL Editor

-- 1. Add new columns to imp_shipments
ALTER TABLE public.imp_shipments ADD COLUMN IF NOT EXISTS target_warehouse TEXT DEFAULT NULL;
ALTER TABLE public.imp_shipments ADD COLUMN IF NOT EXISTS actual_import_date_note TEXT DEFAULT NULL;
ALTER TABLE public.imp_shipments ADD COLUMN IF NOT EXISTS issues JSONB DEFAULT '[]'::jsonb NOT NULL;

-- 2. Migrate existing data from old columns (import_date_lh, import_date_hn, etc.)
-- If Long Hau info exists, set warehouse to 'Kho Long Hậu' and use its date/notes
UPDATE public.imp_shipments 
SET 
  target_warehouse = 'Kho Long Hậu', 
  actual_import_date_note = COALESCE(
    import_date_lh_text, 
    to_char(import_date_lh, 'DD/MM/YYYY')
  )
WHERE 
  import_date_lh IS NOT NULL OR import_date_lh_text IS NOT NULL;

-- If Hanoi info exists and target_warehouse is still null, set to 'Kho Hưng Yên' (as per new requirements)
UPDATE public.imp_shipments 
SET 
  target_warehouse = 'Kho Hưng Yên', 
  actual_import_date_note = COALESCE(
    import_date_hn_text, 
    to_char(import_date_hn, 'DD/MM/YYYY')
  )
WHERE 
  (import_date_hn IS NOT NULL OR import_date_hn_text IS NOT NULL) 
  AND target_warehouse IS NULL;
