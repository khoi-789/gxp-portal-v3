-- SQL Migration Script to setup all missing schemas for GxP Portal v3
-- Copy and paste this script into the Supabase SQL Editor

-- 1. Create master_suppliers table
CREATE TABLE IF NOT EXISTS public.master_suppliers (
    supplier_code TEXT PRIMARY KEY,
    supplier_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed default suppliers to prevent foreign key violations
INSERT INTO public.master_suppliers (supplier_code, supplier_name) VALUES
('ALLEVIARE', 'Alleviare'),
('P.Tem', 'Phòng Tem'),
('ASCENSIA', 'Ascensia'),
('BESINS', 'Besins'),
('BIO, ABBOT, NUMED, MERRIT', 'Bio, Abbot, Numed, Merrit'),
('DANONE', 'Danone'),
('DR.REDDY', 'Dr. Reddy'),
('HYPHENS', 'Hyphens Healthcare'),
('PHARMAONE', 'PharmaOne'),
('MEDIVANCE', 'Medivance Partners'),
('NUTRICHEM', 'NutriChem'),
('BESIN', 'Besin'),
('SANOFI', 'Sanofi'),
('Astra', 'AstraZeneca'),
('Hyphens', 'Hyphens')
ON CONFLICT (supplier_code) DO NOTHING;

-- Seed any other existing suppliers from master_items
INSERT INTO public.master_suppliers (supplier_code, supplier_name)
SELECT DISTINCT supplier_code, supplier_code
FROM public.master_items
ON CONFLICT (supplier_code) DO NOTHING;

-- 2. Alter master_items to add foreign key if possible
-- (We alter the column to be nullable just in case we need set null on delete)
ALTER TABLE public.master_items ALTER COLUMN supplier_code DROP NOT NULL;

-- Try adding foreign key constraint to master_items (will succeed since we seeded master_suppliers first)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_master_items_supplier' AND table_name = 'master_items'
    ) THEN
        ALTER TABLE public.master_items 
        ADD CONSTRAINT fk_master_items_supplier 
        FOREIGN KEY (supplier_code) REFERENCES public.master_suppliers(supplier_code) ON DELETE SET NULL;
    END IF;
END $$;

-- Disable RLS for master_suppliers
ALTER TABLE public.master_suppliers DISABLE ROW LEVEL SECURITY;

-- 3. Create users (profile table, separate from auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    department_code TEXT NOT NULL, -- QA, KHO, SCM, CS, DEV
    system_role TEXT NOT NULL, -- admin, manager, staff, viewer
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- 4. Create portal_apps table
CREATE TABLE IF NOT EXISTS public.portal_apps (
    app_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'link' hoặc 'folder'
    target_url TEXT,
    parent_id UUID REFERENCES public.portal_apps(app_id) ON DELETE SET NULL,
    allowed_depts TEXT[] NOT NULL DEFAULT '{}',
    is_testing BOOLEAN NOT NULL DEFAULT false,
    order_index INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.portal_apps DISABLE ROW LEVEL SECURITY;

-- Seed GxP Portal Apps in portal_apps table
INSERT INTO public.portal_apps (app_name, type, target_url, allowed_depts, is_testing, order_index) VALUES
('IMP (Nhập khẩu)', 'link', '/apps/import', '{"QA", "KHO", "SCM", "DEV"}', false, 1),
('DES (Hủy hàng)', 'link', '/apps/destruction', '{"QA", "KHO", "SCM", "DEV"}', false, 2),
('INC (BBSC)', 'link', '/apps/bbsc', '{"QA", "KHO", "SCM", "DEV"}', false, 3),
('COMP (Khiếu nại)', 'link', '/apps/cc', '{"QA", "KHO", "SCM", "DEV"}', false, 4),
('INT (Nội bộ)', 'link', '/apps/int', '{"QA", "KHO", "SCM", "DEV"}', false, 5),
('LBL (Nhãn phụ)', 'link', '/apps/lbl', '{"QA", "KHO", "SCM", "DEV"}', false, 6),
('LDG (Lệnh ĐG)', 'link', '/apps/ldg', '{"QA", "KHO", "SCM", "DEV"}', false, 7),
('AWC (Thay đổi AW)', 'link', '/apps/awc', '{"QA", "KHO", "SCM", "DEV"}', false, 8)
ON CONFLICT DO NOTHING;

-- 5. Create product_label_mappings table if not exists
CREATE TABLE IF NOT EXISTS public.product_label_mappings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_item_code TEXT NOT NULL REFERENCES public.master_items(item_code) ON DELETE CASCADE,
    label_item_code TEXT NOT NULL REFERENCES public.master_items(item_code) ON DELETE CASCADE,
    quantity_per_unit NUMERIC NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (product_item_code, label_item_code)
);
ALTER TABLE public.product_label_mappings DISABLE ROW LEVEL SECURITY;

-- 6. Create awc_changes table (Thay đổi Artwork)
CREATE TABLE IF NOT EXISTS public.awc_changes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    awc_code TEXT NOT NULL, -- AWC-001-24
    notice_date DATE NOT NULL,
    item_code TEXT NOT NULL REFERENCES public.master_items(item_code) ON DELETE RESTRICT,
    supplier_code TEXT NOT NULL REFERENCES public.master_suppliers(supplier_code) ON DELETE RESTRICT,
    new_item_code TEXT REFERENCES public.master_items(item_code) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'Alerted', -- Alerted, Pending 1st Batch, Verified, Closed
    old_info TEXT,
    new_change_info TEXT,
    expected_batch TEXT,
    estimated_receive DATE,
    actual_batch TEXT,
    actual_receive DATE,
    evidence_url TEXT,
    impact_analysis JSONB DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.awc_changes DISABLE ROW LEVEL SECURITY;

-- 7. Create lbl_labels table (Nhãn phụ)
CREATE TABLE IF NOT EXISTS public.lbl_labels (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    item_code TEXT NOT NULL REFERENCES public.master_items(item_code) ON DELETE CASCADE,
    product_category TEXT NOT NULL, -- Thuốc, TPCN, TTBYT, Mỹ phẩm
    supplier_code TEXT NOT NULL REFERENCES public.master_suppliers(supplier_code) ON DELETE RESTRICT,
    base_label_code TEXT NOT NULL, -- Số mã hóa gốc
    version_number TEXT NOT NULL, -- Ver01, Ver02
    status TEXT NOT NULL DEFAULT 'Draft', -- Draft, Active, Obsolete
    effective_date DATE NOT NULL,
    change_reason TEXT,
    original_file_url TEXT,
    preview_image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (item_code, version_number)
);
ALTER TABLE public.lbl_labels DISABLE ROW LEVEL SECURITY;

-- 8. Create ldg_orders table (Lệnh đóng gói)
CREATE TABLE IF NOT EXISTS public.ldg_orders (
    ldg_code TEXT PRIMARY KEY, -- LDG-0770-0423
    created_date DATE NOT NULL DEFAULT CURRENT_DATE,
    item_code TEXT NOT NULL REFERENCES public.master_items(item_code) ON DELETE RESTRICT,
    supplier_code TEXT NOT NULL REFERENCES public.master_suppliers(supplier_code) ON DELETE RESTRICT,
    lot_number TEXT NOT NULL,
    exp_date DATE NOT NULL,
    batch_size NUMERIC NOT NULL,
    packaging_req TEXT,
    label_version_id BIGINT REFERENCES public.lbl_labels(id) ON DELETE SET NULL,
    six_sides_photo TEXT,
    status TEXT NOT NULL DEFAULT 'Draft', -- Draft, In Progress, Pending QA Review, Issue, Released
    general_notes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.ldg_orders DISABLE ROW LEVEL SECURITY;

-- 9. Create ldg_lpns table (LPNs thuộc Lệnh đóng gói)
CREATE TABLE IF NOT EXISTS public.ldg_lpns (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ldg_code TEXT NOT NULL REFERENCES public.ldg_orders(ldg_code) ON DELETE CASCADE,
    lpn_code TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    released_qty NUMERIC,
    incident_note TEXT,
    incident_ref TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.ldg_lpns DISABLE ROW LEVEL SECURITY;

-- 10. Create bbsc_incidents table (Sự cố)
CREATE TABLE IF NOT EXISTS public.bbsc_incidents (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    bbsc_code TEXT NOT NULL, -- BBSC-0001-0124
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    status TEXT NOT NULL DEFAULT 'Khởi tạo', -- Khởi tạo, Chờ hết INV, Hoàn tất, Đóng
    supplier_code TEXT NOT NULL REFERENCES public.master_suppliers(supplier_code) ON DELETE RESTRICT,
    department_id TEXT NOT NULL, -- Kho Nhập, ĐGC2, ...
    pic_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    sub_pic_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    item_code TEXT REFERENCES public.master_items(item_code) ON DELETE SET NULL,
    lot_number TEXT NOT NULL,
    exp_date DATE NOT NULL,
    quantity NUMERIC NOT NULL,
    lpn_code TEXT,
    defect_description TEXT NOT NULL,
    custom_fields JSONB DEFAULT NULL,
    resolution_action TEXT
);
ALTER TABLE public.bbsc_incidents DISABLE ROW LEVEL SECURITY;

-- 11. Create cc_complaints table (Khiếu nại khách hàng)
CREATE TABLE IF NOT EXISTS public.cc_complaints (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cc_code TEXT NOT NULL, -- CC_010125-HCM
    complaint_date DATE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_address TEXT,
    item_code TEXT NOT NULL REFERENCES public.master_items(item_code) ON DELETE RESTRICT,
    supplier_code TEXT NOT NULL REFERENCES public.master_suppliers(supplier_code) ON DELETE RESTRICT,
    lot_number TEXT NOT NULL,
    mfg_date DATE,
    exp_date DATE NOT NULL,
    unit TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    lpn_code TEXT,
    asn_number TEXT,
    complaint_reason TEXT NOT NULL,
    root_cause TEXT,
    status TEXT NOT NULL DEFAULT 'Khởi tạo', -- Khởi tạo, Chờ Hãng xác nhận, Đang xử lý, Hoàn tất, Hủy khiếu nại
    is_info_secured BOOLEAN NOT NULL DEFAULT false,
    receive_method TEXT,
    supplier_action TEXT,
    received_date DATE,
    samples_sent_to_supplier TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.cc_complaints DISABLE ROW LEVEL SECURITY;

-- 12. Create int_records table (Biên bản nội bộ)
CREATE TABLE IF NOT EXISTS public.int_records (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    int_code TEXT NOT NULL, -- INT-0001-24
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    category TEXT NOT NULL, -- PAP, Chuyển kho, Nội bộ kho xử lý, Yêu cầu hãng, ...
    item_code TEXT NOT NULL REFERENCES public.master_items(item_code) ON DELETE RESTRICT,
    supplier_code TEXT NOT NULL REFERENCES public.master_suppliers(supplier_code) ON DELETE RESTRICT,
    lot_number TEXT NOT NULL,
    exp_date DATE NOT NULL,
    lpn_code TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    incident_content TEXT NOT NULL,
    handling_status TEXT NOT NULL DEFAULT 'Chờ xác định', -- Chưa xác định, Chuyển bán, Chuyển hủy, Đơn chỉ định, Xuất...
    action_notes TEXT,
    ref_link TEXT,
    folder_url TEXT,
    is_in_stock BOOLEAN NOT NULL DEFAULT true,
    wms_doc_number TEXT
);
ALTER TABLE public.int_records DISABLE ROW LEVEL SECURITY;
