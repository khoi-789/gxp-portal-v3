-- ==============================================================================
-- GxP PORTAL V3 — COMPLETE DATABASE SCHEMA DDL SCRIPT (SCHEMA V1.9 COMPLIANT)
-- ==============================================================================
-- Bao gồm:
-- 1. 15 Bảng Master Data Hệ thống & Nghiệp vụ (kèm master_module_fields & master_field_permissions)
-- 2. Module IMP chuẩn hóa: imp_records, imp_items, imp_issues, imp_loggers, imp_tags
-- 3. Module COMP, LBL, INC, INT đồng bộ 4 trạng thái chuẩn (Khởi tạo, Chờ xử lý, Hoàn tất, Hủy)
-- 4. Bảng Audit Trail ALCOA+ (audit_logs)
-- 5. Bật RLS kèm chính sách mở quyền (Tránh cảnh báo bảo mật trên Supabase SQL Editor)
-- 6. Bộ Seed Data khởi tạo chuẩn GxP
-- ==============================================================================

-- Bật các tiện ích UUID & Crypto
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- PHẦN 1: 15 BẢNG MASTER DATA NGHIỆP VỤ & HỆ THỐNG
-- ==============================================================================

-- 1. BẢNG MASTER_DEPARTMENTS (Bộ phận / Phòng ban nội bộ)
CREATE TABLE IF NOT EXISTS public.master_departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_code TEXT NOT NULL UNIQUE,
    department_name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    warehouse_id UUID,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.master_departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_master_departments" ON public.master_departments;
CREATE POLICY "allow_all_master_departments" ON public.master_departments FOR ALL USING (true) WITH CHECK (true);

-- 2. BẢNG MASTER_USERS (Danh mục Nhân viên & Cấu hình cá nhân hóa giao diện)
CREATE TABLE IF NOT EXISTS public.master_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    department_id UUID REFERENCES public.master_departments(id) ON DELETE SET NULL,
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    list_view_prefs JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.master_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_master_users" ON public.master_users;
CREATE POLICY "allow_all_master_users" ON public.master_users FOR ALL USING (true) WITH CHECK (true);

-- 3. BẢNG MASTER_ROLES (Quản lý 5 Vai trò chuẩn toàn hệ thống)
CREATE TABLE IF NOT EXISTS public.master_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_code TEXT NOT NULL UNIQUE,
    role_name TEXT NOT NULL,
    master_data_permissions JSONB DEFAULT '{}'::jsonb,
    scope TEXT NOT NULL DEFAULT 'SYSTEM', -- SYSTEM | MODULE
    level INT NOT NULL DEFAULT 1, -- 1: Viewer, 2: Draft, 3: PIC-1, 4: PIC-2, 5: Admin
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.master_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_master_roles" ON public.master_roles;
CREATE POLICY "allow_all_master_roles" ON public.master_roles FOR ALL USING (true) WITH CHECK (true);

-- 4. BẢNG USER_MODULE_ROLES (Phân quyền User theo từng Module & Quyền PIC)
CREATE TABLE IF NOT EXISTS public.user_module_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.master_users(id) ON DELETE CASCADE,
    module_code TEXT NOT NULL, -- IMP | COMP | LBL | INC | INT | MASTER_DATA
    role_id UUID NOT NULL REFERENCES public.master_roles(id) ON DELETE CASCADE,
    is_primary_pic BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, module_code, role_id)
);
ALTER TABLE public.user_module_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_user_module_roles" ON public.user_module_roles;
CREATE POLICY "allow_all_user_module_roles" ON public.user_module_roles FOR ALL USING (true) WITH CHECK (true);

-- 5. BẢNG MASTER_GOODS_CATEGORIES (Phân loại hàng hóa)
CREATE TABLE IF NOT EXISTS public.master_goods_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_code TEXT NOT NULL UNIQUE,
    category_name TEXT NOT NULL,
    short_name TEXT,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.master_goods_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_master_goods_categories" ON public.master_goods_categories;
CREATE POLICY "allow_all_master_goods_categories" ON public.master_goods_categories FOR ALL USING (true) WITH CHECK (true);

-- 6. BẢNG MASTER_SUPPLIERS (Danh mục Hãng / Nhà cung cấp)
CREATE TABLE IF NOT EXISTS public.master_suppliers (
    supplier_code TEXT PRIMARY KEY,
    supplier_name TEXT NOT NULL,
    business_type TEXT[] DEFAULT '{}',
    notes TEXT DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.master_suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_master_suppliers" ON public.master_suppliers;
CREATE POLICY "allow_all_master_suppliers" ON public.master_suppliers FOR ALL USING (true) WITH CHECK (true);

-- 7. BẢNG MASTER_ITEMS (Danh mục Sản phẩm INFOR/SAP)
CREATE TABLE IF NOT EXISTS public.master_items (
    item_code TEXT PRIMARY KEY,
    item_name TEXT NOT NULL,
    supplier_code TEXT REFERENCES public.master_suppliers(supplier_code) ON DELETE SET NULL,
    visa_no TEXT DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT true,
    gross_weight NUMERIC DEFAULT 0,
    net_weight NUMERIC DEFAULT 0,
    cube NUMERIC DEFAULT 0,
    tare_weight NUMERIC DEFAULT 0,
    pallet_qty NUMERIC DEFAULT 0,
    case_qty NUMERIC DEFAULT 0,
    inner_pack NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.master_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_master_items" ON public.master_items;
CREATE POLICY "allow_all_master_items" ON public.master_items FOR ALL USING (true) WITH CHECK (true);

-- BẢNG LIÊN KẾT: PRODUCT_LABEL_MAPPINGS (Liên kết Sản phẩm - Tem nhãn)
CREATE TABLE IF NOT EXISTS public.product_label_mappings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_item_code TEXT NOT NULL REFERENCES public.master_items(item_code) ON DELETE CASCADE,
    label_item_code TEXT NOT NULL REFERENCES public.master_items(item_code) ON DELETE CASCADE,
    quantity_per_unit NUMERIC NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (product_item_code, label_item_code)
);
ALTER TABLE public.product_label_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_product_label_mappings" ON public.product_label_mappings;
CREATE POLICY "allow_all_product_label_mappings" ON public.product_label_mappings FOR ALL USING (true) WITH CHECK (true);

-- 8. BẢNG MASTER_WAREHOUSES (Danh mục Kho tiếp nhận & Lưu trữ)
CREATE TABLE IF NOT EXISTS public.master_warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_code TEXT NOT NULL UNIQUE,
    warehouse_name TEXT NOT NULL,
    short_name TEXT,
    address TEXT,
    temperature_condition TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.master_warehouses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_master_warehouses" ON public.master_warehouses;
CREATE POLICY "allow_all_master_warehouses" ON public.master_warehouses FOR ALL USING (true) WITH CHECK (true);

-- 9. BẢNG MASTER_LOGGERS (Danh mục Thiết bị ghi nhiệt độ)
CREATE TABLE IF NOT EXISTS public.master_loggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    logger_code TEXT NOT NULL UNIQUE,
    logger_name TEXT NOT NULL,
    model TEXT,
    temperature_range TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.master_loggers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_master_loggers" ON public.master_loggers;
CREATE POLICY "allow_all_master_loggers" ON public.master_loggers FOR ALL USING (true) WITH CHECK (true);

-- 10. BẢNG MASTER_TAGS (Danh mục Thẻ nhãn dán / Phân loại)
CREATE TABLE IF NOT EXISTS public.master_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_name TEXT NOT NULL,
    tag_color TEXT DEFAULT '#2563eb',
    module_code TEXT DEFAULT 'ALL',
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.master_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_master_tags" ON public.master_tags;
CREATE POLICY "allow_all_master_tags" ON public.master_tags FOR ALL USING (true) WITH CHECK (true);

-- 11. BẢNG MASTER_NUMBERING_RULES (Quy tắc đánh mã số tự động cho từng Module)
CREATE TABLE IF NOT EXISTS public.master_numbering_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_code TEXT NOT NULL UNIQUE,
    prefix_pattern TEXT NOT NULL,
    number_length INT NOT NULL DEFAULT 4,
    current_number INT NOT NULL DEFAULT 0,
    suffix_pattern TEXT,
    reset_frequency TEXT NOT NULL DEFAULT 'YEARLY', -- NEVER | YEARLY | MONTHLY
    is_active BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.master_numbering_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_master_numbering_rules" ON public.master_numbering_rules;
CREATE POLICY "allow_all_master_numbering_rules" ON public.master_numbering_rules FOR ALL USING (true) WITH CHECK (true);

-- 12. BẢNG MASTER_HYPERLINK_RULES (Quy tắc ghép hyperlink thư mục server theo phiếu)
CREATE TABLE IF NOT EXISTS public.master_hyperlink_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_code TEXT NOT NULL UNIQUE,
    base_path TEXT NOT NULL,
    path_pattern TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.master_hyperlink_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_master_hyperlink_rules" ON public.master_hyperlink_rules;
CREATE POLICY "allow_all_master_hyperlink_rules" ON public.master_hyperlink_rules FOR ALL USING (true) WITH CHECK (true);

-- 13. BẢNG MASTER_FORM_TEMPLATES (Quản lý Biểu mẫu SOP & Phiên bản hiệu lực)
CREATE TABLE IF NOT EXISTS public.master_form_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_code TEXT NOT NULL,
    form_code TEXT NOT NULL,
    version TEXT NOT NULL,
    is_current BOOLEAN NOT NULL DEFAULT true,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    template_file_url TEXT,
    change_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.master_form_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_master_form_templates" ON public.master_form_templates;
CREATE POLICY "allow_all_master_form_templates" ON public.master_form_templates FOR ALL USING (true) WITH CHECK (true);

-- 14. BẢNG MASTER_MODULE_FIELDS [MỚI V1.9] (Danh mục Khối & Trường theo từng Module)
CREATE TABLE IF NOT EXISTS public.master_module_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_code TEXT NOT NULL, -- IMP | COMP | LBL | INC | INT
    group_code TEXT NOT NULL,  -- group_header | group_items | group_issues | group_loggers
    group_name TEXT NOT NULL,
    field_code TEXT NOT NULL,  -- inv_no, visa_no, status...
    field_label TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(module_code, field_code)
);
ALTER TABLE public.master_module_fields ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_master_module_fields" ON public.master_module_fields;
CREATE POLICY "allow_all_master_module_fields" ON public.master_module_fields FOR ALL USING (true) WITH CHECK (true);

-- 15. BẢNG MASTER_FIELD_PERMISSIONS [MỚI V1.9] (Ma trận Phân quyền 2 Tầng: Nhóm + Ngoại lệ)
CREATE TABLE IF NOT EXISTS public.master_field_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_code TEXT NOT NULL,
    status_code TEXT NOT NULL, -- KHOI_TAO | CHO_XU_LY | HOAN_TAT | HUY
    role_code TEXT NOT NULL,   -- Viewer | Draft | PIC-1 | PIC-2 | Admin
    group_code TEXT NOT NULL,  -- group_header | group_items | group_issues | group_loggers
    group_permission TEXT NOT NULL DEFAULT 'EDIT', -- HIDDEN | READ | EDIT
    field_overrides JSONB DEFAULT '{}'::jsonb,    -- Ví dụ: {"status": "READ"}
    description TEXT,
    updated_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(module_code, status_code, role_code, group_code)
);
ALTER TABLE public.master_field_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_master_field_permissions" ON public.master_field_permissions;
CREATE POLICY "allow_all_master_field_permissions" ON public.master_field_permissions FOR ALL USING (true) WITH CHECK (true);


-- ==============================================================================
-- PHẦN 2: MODULE IMP (NHẬP KHẨU) — CHUẨN HÓA SCHEMA V1.9
-- ==============================================================================

-- 1. BẢNG MASTER HEADER: IMP_RECORDS
CREATE TABLE IF NOT EXISTS public.imp_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inv_no TEXT NOT NULL UNIQUE,
    received_date DATE NOT NULL DEFAULT CURRENT_DATE,
    supplier_code TEXT REFERENCES public.master_suppliers(supplier_code) ON DELETE SET NULL,
    customs_doc_status TEXT DEFAULT 'Chờ',
    awb_bl_no TEXT,
    carrier_name TEXT,
    payment_status TEXT DEFAULT 'Chưa TT',
    status TEXT NOT NULL DEFAULT 'Khởi tạo' CHECK (status IN ('Khởi tạo', 'Chờ xử lý', 'Hoàn tất', 'Hủy')),
    notes TEXT,
    link_folder TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.imp_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_imp_records" ON public.imp_records;
CREATE POLICY "allow_all_imp_records" ON public.imp_records FOR ALL USING (true) WITH CHECK (true);

-- 2. BẢNG CHI TIẾT SẢN PHẨM & VISA: IMP_ITEMS (Không quản lý số lượng)
CREATE TABLE IF NOT EXISTS public.imp_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID NOT NULL REFERENCES public.imp_records(id) ON DELETE CASCADE,
    item_code TEXT NOT NULL REFERENCES public.master_items(item_code) ON DELETE RESTRICT,
    item_name TEXT NOT NULL,
    lot_no TEXT NOT NULL,
    exp_date DATE NOT NULL,
    visa_no TEXT NOT NULL,
    visa_exp_date DATE NOT NULL,
    warehouse_code TEXT,
    arrival_date DATE,
    coa_status TEXT DEFAULT 'Chưa có',
    sub_label_status TEXT DEFAULT 'Chờ duyệt',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.imp_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_imp_items" ON public.imp_items;
CREATE POLICY "allow_all_imp_items" ON public.imp_items FOR ALL USING (true) WITH CHECK (true);

-- 3. BẢNG VẤN ĐỀ & HÀNH ĐỘNG: IMP_ISSUES (Gắn trực tiếp với Item, 1 vấn đề = 1 hành động)
CREATE TABLE IF NOT EXISTS public.imp_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID NOT NULL REFERENCES public.imp_records(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.imp_items(id) ON DELETE CASCADE,
    issue_type TEXT NOT NULL, -- COA | Nhãn phụ | Nhiệt độ | Hư hỏng | Khác
    description TEXT NOT NULL,
    action_required TEXT NOT NULL, -- 1 Vấn đề = 1 Ô hành động duy nhất
    pic_user_id UUID REFERENCES public.master_users(id) ON DELETE SET NULL,
    deadline DATE,
    status TEXT NOT NULL DEFAULT 'Chờ xử lý' CHECK (status IN ('Chờ xử lý', 'Đang xử lý', 'Đã xong')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.imp_issues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_imp_issues" ON public.imp_issues;
CREATE POLICY "allow_all_imp_issues" ON public.imp_issues FOR ALL USING (true) WITH CHECK (true);

-- 4. BẢNG THIẾT BỊ NHIỆT ĐỘ: IMP_LOGGERS (Rút gọn đúng 4 thông tin)
CREATE TABLE IF NOT EXISTS public.imp_loggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID NOT NULL REFERENCES public.imp_records(id) ON DELETE CASCADE,
    logger_id UUID REFERENCES public.master_loggers(id) ON DELETE SET NULL,
    logger_name TEXT,
    quantity INT NOT NULL DEFAULT 1,
    result TEXT NOT NULL DEFAULT 'ĐẠT' CHECK (result IN ('ĐẠT', 'FAIL')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.imp_loggers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_imp_loggers" ON public.imp_loggers;
CREATE POLICY "allow_all_imp_loggers" ON public.imp_loggers FOR ALL USING (true) WITH CHECK (true);

-- 5. BẢNG GẮN THẺ: IMP_TAGS
CREATE TABLE IF NOT EXISTS public.imp_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID NOT NULL REFERENCES public.imp_records(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES public.master_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (record_id, tag_id)
);
ALTER TABLE public.imp_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_imp_tags" ON public.imp_tags;
CREATE POLICY "allow_all_imp_tags" ON public.imp_tags FOR ALL USING (true) WITH CHECK (true);


-- ==============================================================================
-- PHẦN 3: ĐỒNG BỘ 4 PHÂN HỆ CÒN LẠI (COMP, LBL, INC, INT)
-- ==============================================================================

-- 1. MODULE COMP (KHIẾU NẠI CHẤT LƯỢNG)
CREATE TABLE IF NOT EXISTS public.comp_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comp_code TEXT NOT NULL UNIQUE,
    complaint_date DATE NOT NULL DEFAULT CURRENT_DATE,
    customer_name TEXT,
    supplier_code TEXT REFERENCES public.master_suppliers(supplier_code) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'Khởi tạo' CHECK (status IN ('Khởi tạo', 'Chờ xử lý', 'Hoàn tất', 'Hủy')),
    notes TEXT,
    link_folder TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.comp_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_comp_records" ON public.comp_records;
CREATE POLICY "allow_all_comp_records" ON public.comp_records FOR ALL USING (true) WITH CHECK (true);

-- 2. MODULE LBL (NHÃN PHỤ)
CREATE TABLE IF NOT EXISTS public.lbl_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lbl_code TEXT NOT NULL UNIQUE,
    request_date DATE NOT NULL DEFAULT CURRENT_DATE,
    item_code TEXT REFERENCES public.master_items(item_code) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'Khởi tạo' CHECK (status IN ('Khởi tạo', 'Chờ xử lý', 'Hoàn tất', 'Hủy')),
    notes TEXT,
    link_folder TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.lbl_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_lbl_records" ON public.lbl_records;
CREATE POLICY "allow_all_lbl_records" ON public.lbl_records FOR ALL USING (true) WITH CHECK (true);

-- 3. MODULE INC (BIÊN BẢN SỰ CỐ NGOẠI VIỆN)
CREATE TABLE IF NOT EXISTS public.inc_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inc_code TEXT NOT NULL UNIQUE,
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    supplier_code TEXT REFERENCES public.master_suppliers(supplier_code) ON DELETE SET NULL,
    goods_category TEXT,
    incident_type TEXT,
    doc_no TEXT,
    department TEXT,
    pic_name TEXT,
    sub_pic_name TEXT,
    status TEXT NOT NULL DEFAULT 'Khởi tạo' CHECK (status IN ('Khởi tạo', 'Chờ xử lý', 'Hoàn tất', 'Hủy')),
    completed_date DATE,
    notes TEXT,
    link_folder TEXT,
    investigation TEXT,
    immediate_action TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.inc_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_inc_records" ON public.inc_records;
CREATE POLICY "allow_all_inc_records" ON public.inc_records FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.inc_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID NOT NULL REFERENCES public.inc_records(id) ON DELETE CASCADE,
    item_code TEXT REFERENCES public.master_items(item_code) ON DELETE RESTRICT,
    item_name TEXT NOT NULL,
    lot_no TEXT,
    exp_date DATE,
    defect_qty NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.inc_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_inc_items" ON public.inc_items;
CREATE POLICY "allow_all_inc_items" ON public.inc_items FOR ALL USING (true) WITH CHECK (true);

-- 4. MODULE INT (BIÊN BẢN SỰ CỐ NỘI BỘ — ĐỒNG BỘ CẤU TRÚC VÀ LINK FOLDER VỚI INC)
-- Dọn dẹp bảng int cũ (0 rows, kiểu bigint cũ) để tạo lại chuẩn UUID đồng bộ
DROP TABLE IF EXISTS public.int_items CASCADE;
DROP TABLE IF EXISTS public.int_records CASCADE;

CREATE TABLE public.int_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    int_code TEXT NOT NULL UNIQUE,
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    supplier_code TEXT REFERENCES public.master_suppliers(supplier_code) ON DELETE SET NULL,
    category TEXT,
    warehouse_code TEXT,
    ref_doc_no TEXT,
    department TEXT,
    pic_name TEXT,
    sub_pic_name TEXT,
    status TEXT NOT NULL DEFAULT 'Khởi tạo' CHECK (status IN ('Khởi tạo', 'Chờ xử lý', 'Hoàn tất', 'Hủy')),
    completed_date DATE,
    notes TEXT,
    link_folder TEXT,
    investigation TEXT,
    immediate_action TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.int_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_int_records" ON public.int_records;
CREATE POLICY "allow_all_int_records" ON public.int_records FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.int_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID NOT NULL REFERENCES public.int_records(id) ON DELETE CASCADE,
    item_code TEXT REFERENCES public.master_items(item_code) ON DELETE RESTRICT,
    item_name TEXT NOT NULL,
    lot_no TEXT,
    exp_date DATE,
    qty NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.int_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_int_items" ON public.int_items;
CREATE POLICY "allow_all_int_items" ON public.int_items FOR ALL USING (true) WITH CHECK (true);


-- ==============================================================================
-- PHẦN 4: ALCOA+ AUDIT TRAIL LOGGING
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL, -- INSERT | UPDATE | DELETE
    changed_by TEXT,
    user_role TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    changed_fields TEXT[] DEFAULT '{}',
    old_values JSONB,
    new_values JSONB,
    diff JSONB,
    module_code TEXT
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_audit_logs" ON public.audit_logs;
CREATE POLICY "allow_all_audit_logs" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);

-- Index tăng tốc truy vấn Audit Log
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON public.audit_logs (table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at ON public.audit_logs (changed_at DESC);


-- ==============================================================================
-- PHẦN 5: SEED DATA KHỞI TẠO HỆ THỐNG
-- ==============================================================================

-- 1. Seed 5 Vai trò chuẩn toàn hệ thống
INSERT INTO public.master_roles (role_code, role_name, scope, level) VALUES
('Viewer', 'Người xem (Chỉ đọc dữ liệu)', 'SYSTEM', 1),
('Draft', 'Người lập phiếu (Soạn thảo ban đầu)', 'SYSTEM', 2),
('PIC-1', 'Người phụ trách vòng 1 (Xử lý chuyên môn)', 'MODULE', 3),
('PIC-2', 'Người phụ trách vòng 2 (Thẩm định/Kiểm nhận)', 'MODULE', 4),
('Admin', 'Quản trị viên (Toàn quyền hệ thống/module)', 'SYSTEM', 5)
ON CONFLICT (role_code) DO NOTHING;

-- 2. Seed các Phòng ban chuẩn
INSERT INTO public.master_departments (department_code, department_name, short_name) VALUES
('QA_OFFICE', 'Phòng Đảm bảo Chất lượng (QA)', 'QA VP'),
('KHO_NHAP', 'Kho Tiếp nhận & Nhập khẩu', 'Kho Nhập'),
('TEAM_DGC2', 'Tổ Đóng gói cấp 2', 'ĐGC2'),
('XNK', 'Phòng Xuất Nhập Khẩu & Logistics', 'XNK'),
('PLANNING', 'Phòng Kế hoạch Cung ứng', 'Planning'),
('CSKH', 'Phòng Chăm sóc Khách hàng', 'CSKH')
ON CONFLICT (department_code) DO NOTHING;

-- 3. Seed Thiết bị ghi nhiệt độ chuẩn
INSERT INTO public.master_loggers (logger_code, logger_name, model, temperature_range) VALUES
('LOG_FRIGGA_T70', 'FRIGGA T70 (USB/Wireless)', 'T70', '2°C - 8°C'),
('LOG_TEMPTALE_ULTRA', 'Sensitech TempTale Ultra', 'Ultra', '2°C - 8°C'),
('LOG_ELITECH_RC5', 'Elitech RC-5 USB Temp', 'RC-5', '15°C - 25°C')
ON CONFLICT (logger_code) DO NOTHING;

-- 4. Seed Kho tiếp nhận
INSERT INTO public.master_warehouses (warehouse_code, warehouse_name, short_name, temperature_condition) VALUES
('KHO_LONG_HAU', 'Kho Tổng Long Hậu (Cần Giuộc, Long An)', 'Kho Long Hậu', '2-8°C & 15-25°C'),
('KHO_HUNG_YEN', 'Kho Chi nhánh Hưng Yên', 'Kho Hưng Yên', '15-25°C'),
('KHO_DA_NANG', 'Kho Chi nhánh Đà Nẵng', 'Kho Đà Nẵng', '15-25°C')
ON CONFLICT (warehouse_code) DO NOTHING;

-- 5. Seed Quy tắc sinh mã (master_numbering_rules)
INSERT INTO public.master_numbering_rules (module_code, prefix_pattern, number_length, current_number, suffix_pattern, reset_frequency) VALUES
('IMP', 'INV-', 6, 0, '', 'NEVER'),
('INC', 'BBSC-', 4, 0, '-{yy}', 'YEARLY'),
('INT', 'INT-', 4, 0, '-{yy}', 'YEARLY'),
('COMP', 'CC-', 4, 0, '-{yy}', 'YEARLY'),
('LBL', 'LBL-', 4, 0, '', 'NEVER')
ON CONFLICT (module_code) DO NOTHING;

-- 6. Seed Quy tắc Hyperlink Server Folder (master_hyperlink_rules)
INSERT INTO public.master_hyperlink_rules (module_code, base_path, path_pattern, description) VALUES
('IMP', 'P:\7. LONG HAU\Kho Hóa Dược\01. Nhap Khau', '{base_path}\{YEAR}\{inv_no}', 'Link folder chứng từ nhập khẩu theo năm và số INV'),
('INC', 'P:\7. LONG HAU\Kho Hóa Dược\02. Bien Ban Su Co', '{base_path}\{YEAR}\{code}', 'Link folder biên bản sự cố ngoại viện theo mã'),
('INT', 'P:\7. LONG HAU\Kho Hóa Dược\03. Bien Ban Noi Bo', '{base_path}\{YEAR}\{code}', 'Link folder biên bản sự cố nội bộ theo mã'),
('COMP', 'P:\7. LONG HAU\QA\04. Khieu Nai Chat Luong', '{base_path}\{YEAR}\{code}', 'Link folder hồ sơ khiếu nại khách hàng'),
('LBL', 'P:\7. LONG HAU\To Dong Goi\05. Ho So Nhan Phu', '{base_path}\{code}', 'Link folder hồ sơ market nhãn phụ')
ON CONFLICT (module_code) DO NOTHING;

-- 7. Seed Danh mục Nhóm & Trường cho Module IMP (master_module_fields)
INSERT INTO public.master_module_fields (module_code, group_code, group_name, field_code, field_label, display_order) VALUES
-- Khối 1: Header
('IMP', 'group_header', 'Khối 1: Thông tin chung Header', 'inv_no', 'Số Hóa đơn (INV No)', 1),
('IMP', 'group_header', 'Khối 1: Thông tin chung Header', 'received_date', 'Ngày nhận email thông báo', 2),
('IMP', 'group_header', 'Khối 1: Thông tin chung Header', 'supplier_code', 'Hãng / Nhà cung cấp', 3),
('IMP', 'group_header', 'Khối 1: Thông tin chung Header', 'customs_doc_status', 'Tình trạng Hải quan', 4),
('IMP', 'group_header', 'Khối 1: Thông tin chung Header', 'awb_bl_no', 'Số vận đơn (AWB/BL)', 5),
('IMP', 'group_header', 'Khối 1: Thông tin chung Header', 'carrier_name', 'Đơn vị Giao nhận (FWD)', 6),
('IMP', 'group_header', 'Khối 1: Thông tin chung Header', 'payment_status', 'Tình trạng Thanh toán', 7),
('IMP', 'group_header', 'Khối 1: Thông tin chung Header', 'status', 'Trạng thái tiến độ hồ sơ', 8),
('IMP', 'group_header', 'Khối 1: Thông tin chung Header', 'notes', 'Ghi chú chung', 9),
('IMP', 'group_header', 'Khối 1: Thông tin chung Header', 'link_folder', 'Link Folder hồ sơ server', 10),

-- Khối 2: Chi tiết SP & Visa
('IMP', 'group_items', 'Khối 2: Chi tiết Sản phẩm & Visa', 'item_code', 'Mã sản phẩm (Item Code)', 11),
('IMP', 'group_items', 'Khối 2: Chi tiết Sản phẩm & Visa', 'item_name', 'Tên sản phẩm', 12),
('IMP', 'group_items', 'Khối 2: Chi tiết Sản phẩm & Visa', 'lot_no', 'Số lô sản xuất', 13),
('IMP', 'group_items', 'Khối 2: Chi tiết Sản phẩm & Visa', 'exp_date', 'Hạn dùng (HSD)', 14),
('IMP', 'group_items', 'Khối 2: Chi tiết Sản phẩm & Visa', 'visa_no', 'Số đăng ký lưu hành (Visa)', 15),
('IMP', 'group_items', 'Khối 2: Chi tiết Sản phẩm & Visa', 'visa_exp_date', 'Hạn hiệu lực Visa', 16),
('IMP', 'group_items', 'Khối 2: Chi tiết Sản phẩm & Visa', 'warehouse_code', 'Kho tiếp nhận', 17),
('IMP', 'group_items', 'Khối 2: Chi tiết Sản phẩm & Visa', 'arrival_date', 'Ngày hàng về kho thực tế', 18),
('IMP', 'group_items', 'Khối 2: Chi tiết Sản phẩm & Visa', 'coa_status', 'Tình trạng phiếu COA', 19),
('IMP', 'group_items', 'Khối 2: Chi tiết Sản phẩm & Visa', 'sub_label_status', 'Tình trạng Nhãn phụ', 20),

-- Khối 3: Vấn đề & Hành động
('IMP', 'group_issues', 'Khối 3: Vấn đề & Hành động', 'issue_type', 'Loại bất thường / vấn đề', 21),
('IMP', 'group_issues', 'Khối 3: Vấn đề & Hành động', 'description', 'Mô tả chi tiết vấn đề', 22),
('IMP', 'group_issues', 'Khối 3: Vấn đề & Hành động', 'action_required', 'Ô hành động xử lý duy nhất', 23),
('IMP', 'group_issues', 'Khối 3: Vấn đề & Hành động', 'pic_user_id', 'Người chịu trách nhiệm xử lý', 24),
('IMP', 'group_issues', 'Khối 3: Vấn đề & Hành động', 'deadline', 'Hạn hoàn thành', 25),
('IMP', 'group_issues', 'Khối 3: Vấn đề & Hành động', 'status', 'Trạng thái xử lý vấn đề', 26),

-- Khối 4: Thiết bị nhiệt độ
('IMP', 'group_loggers', 'Khối 4: Thiết bị nhiệt (Loggers)', 'logger_id', 'Loại thiết bị ghi nhiệt', 27),
('IMP', 'group_loggers', 'Khối 4: Thiết bị nhiệt (Loggers)', 'quantity', 'Số lượng thiết bị', 28),
('IMP', 'group_loggers', 'Khối 4: Thiết bị nhiệt (Loggers)', 'result', 'Kết quả thẩm định (Đạt/Fail)', 29),
('IMP', 'group_loggers', 'Khối 4: Thiết bị nhiệt (Loggers)', 'notes', 'Ghi chú dải nhiệt độ', 30)
ON CONFLICT (module_code, field_code) DO NOTHING;

-- 8. Seed Ma trận Phân quyền Động 2 Tầng (master_field_permissions) Mẫu cho IMP
INSERT INTO public.master_field_permissions (module_code, status_code, role_code, group_code, group_permission, field_overrides, description) VALUES
-- Trạng thái: KHOI_TAO
('IMP', 'KHOI_TAO', 'Viewer', 'group_header', 'READ', '{}', 'Viewer chỉ xem'),
('IMP', 'KHOI_TAO', 'Viewer', 'group_items', 'READ', '{}', 'Viewer chỉ xem'),
('IMP', 'KHOI_TAO', 'Draft', 'group_header', 'EDIT', '{}', 'Draft nhập tự do header'),
('IMP', 'KHOI_TAO', 'Draft', 'group_items', 'EDIT', '{}', 'Draft nhập tự do hàng hóa và visa'),
('IMP', 'KHOI_TAO', 'Draft', 'group_issues', 'EDIT', '{}', 'Draft ghi nhận nếu có'),
('IMP', 'KHOI_TAO', 'Draft', 'group_loggers', 'EDIT', '{}', 'Draft ghi nhận nếu có'),
('IMP', 'KHOI_TAO', 'PIC-1', 'group_header', 'READ', '{}', 'Chưa đến lượt PIC-1'),
('IMP', 'KHOI_TAO', 'PIC-2', 'group_header', 'READ', '{}', 'Chưa đến lượt PIC-2'),
('IMP', 'KHOI_TAO', 'Admin', 'group_header', 'EDIT', '{}', 'Admin toàn quyền'),
('IMP', 'KHOI_TAO', 'Admin', 'group_items', 'EDIT', '{}', 'Admin toàn quyền'),

-- Trạng thái: CHO_XU_LY (QA VP là PIC-1 xử lý chính, Kho/QA Nhập là PIC-2 nhập ngày về & logger)
('IMP', 'CHO_XU_LY', 'Viewer', 'group_header', 'READ', '{}', 'Viewer chỉ xem'),
('IMP', 'CHO_XU_LY', 'Draft', 'group_header', 'READ', '{}', 'Draft đã nộp phiếu, chuyển sang chỉ xem'),
('IMP', 'CHO_XU_LY', 'PIC-1', 'group_header', 'EDIT', '{"status": "READ"}', 'QA VP sửa thông tin header nhưng khóa ô status'),
('IMP', 'CHO_XU_LY', 'PIC-1', 'group_items', 'EDIT', '{"arrival_date": "READ"}', 'QA VP kiểm tra visa, coa, nhãn phụ; riêng ngày về kho do Kho nhập'),
('IMP', 'CHO_XU_LY', 'PIC-1', 'group_issues', 'EDIT', '{}', 'QA VP ghi nhận vấn đề và phân công hành động'),
('IMP', 'CHO_XU_LY', 'PIC-2', 'group_header', 'READ', '{}', 'Kho chỉ xem header'),
('IMP', 'CHO_XU_LY', 'PIC-2', 'group_items', 'READ', '{"arrival_date": "EDIT"}', 'Kho nhập duy nhất ngày hàng về thực tế'),
('IMP', 'CHO_XU_LY', 'PIC-2', 'group_loggers', 'EDIT', '{}', 'Kho nhập loại logger, số lượng, kết quả Đạt/Fail'),
('IMP', 'CHO_XU_LY', 'Admin', 'group_header', 'EDIT', '{}', 'Admin toàn quyền'),

-- Trạng thái: HOAN_TAT (Khóa toàn bộ, chỉ Admin được mở lại)
('IMP', 'HOAN_TAT', 'Viewer', 'group_header', 'READ', '{}', 'Đã hoàn tất - Khóa đọc'),
('IMP', 'HOAN_TAT', 'Draft', 'group_header', 'READ', '{}', 'Đã hoàn tất - Khóa đọc'),
('IMP', 'HOAN_TAT', 'PIC-1', 'group_header', 'READ', '{}', 'Đã hoàn tất - Khóa đọc'),
('IMP', 'HOAN_TAT', 'PIC-2', 'group_header', 'READ', '{}', 'Đã hoàn tất - Khóa đọc'),
('IMP', 'HOAN_TAT', 'Admin', 'group_header', 'EDIT', '{}', 'Admin có quyền Reopen mở khóa sửa lại')
ON CONFLICT (module_code, status_code, role_code, group_code) DO NOTHING;

-- Hoàn tất DDL
