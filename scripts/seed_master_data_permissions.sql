-- ============================================================
-- MIGRATION: Seed master_data_permissions vào master_roles
-- Chạy script này 1 lần trong Supabase SQL Editor
-- ============================================================

-- Đảm bảo cột tồn tại (an toàn khi chạy lại)
ALTER TABLE public.master_roles 
  ADD COLUMN IF NOT EXISTS master_data_permissions JSONB DEFAULT '{}'::jsonb;

-- Seed / update master_data_permissions cho 5 vai trò chuẩn
UPDATE public.master_roles
SET master_data_permissions = '{
  "master_items": "view",
  "master_suppliers": "view",
  "product_label_mappings": "view",
  "master_departments": "view",
  "master_warehouses": "view",
  "master_loggers": "view",
  "master_label_types": "view",
  "master_numbering_rules": "none",
  "master_form_templates": "view"
}'::jsonb,
updated_at = now()
WHERE role_code = 'Viewer'
  AND (master_data_permissions IS NULL OR master_data_permissions = '{}'::jsonb);

UPDATE public.master_roles
SET master_data_permissions = '{
  "master_items": "view",
  "master_suppliers": "view",
  "product_label_mappings": "view",
  "master_departments": "view",
  "master_warehouses": "view",
  "master_loggers": "view",
  "master_label_types": "view",
  "master_numbering_rules": "none",
  "master_form_templates": "view"
}'::jsonb,
updated_at = now()
WHERE role_code = 'Draft'
  AND (master_data_permissions IS NULL OR master_data_permissions = '{}'::jsonb);

UPDATE public.master_roles
SET master_data_permissions = '{
  "master_items": "edit",
  "master_suppliers": "edit",
  "product_label_mappings": "edit",
  "master_departments": "view",
  "master_warehouses": "view",
  "master_loggers": "edit",
  "master_label_types": "edit",
  "master_numbering_rules": "view",
  "master_form_templates": "view"
}'::jsonb,
updated_at = now()
WHERE role_code = 'PIC-1'
  AND (master_data_permissions IS NULL OR master_data_permissions = '{}'::jsonb);

UPDATE public.master_roles
SET master_data_permissions = '{
  "master_items": "view",
  "master_suppliers": "view",
  "product_label_mappings": "view",
  "master_departments": "view",
  "master_warehouses": "edit",
  "master_loggers": "edit",
  "master_label_types": "view",
  "master_numbering_rules": "view",
  "master_form_templates": "view"
}'::jsonb,
updated_at = now()
WHERE role_code = 'PIC-2'
  AND (master_data_permissions IS NULL OR master_data_permissions = '{}'::jsonb);

UPDATE public.master_roles
SET master_data_permissions = '{
  "master_items": "edit",
  "master_suppliers": "edit",
  "product_label_mappings": "edit",
  "master_departments": "edit",
  "master_warehouses": "edit",
  "master_loggers": "edit",
  "master_label_types": "edit",
  "master_numbering_rules": "edit",
  "master_form_templates": "edit"
}'::jsonb,
updated_at = now()
WHERE role_code = 'Admin'
  AND (master_data_permissions IS NULL OR master_data_permissions = '{}'::jsonb);

-- Verify
SELECT role_code, master_data_permissions
FROM public.master_roles
ORDER BY level;
