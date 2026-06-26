-- 1. Bỏ UNIQUE constraint của bbsc_code trong bảng bbsc_incidents
ALTER TABLE public.bbsc_incidents DROP CONSTRAINT IF EXISTS bbsc_incidents_bbsc_code_key;

-- 2. Bỏ UNIQUE constraint của cc_code trong bảng cc_complaints
ALTER TABLE public.cc_complaints DROP CONSTRAINT IF EXISTS cc_complaints_cc_code_key;

-- 3. Bỏ UNIQUE constraint của int_code trong bảng int_records
ALTER TABLE public.int_records DROP CONSTRAINT IF EXISTS int_records_int_code_key;

-- 4. Cấu trúc lại bảng awc_changes để dùng id làm PRIMARY KEY thay cho awc_code
-- Bỏ Primary Key hiện tại trên cột awc_code
ALTER TABLE public.awc_changes DROP CONSTRAINT IF EXISTS awc_changes_pkey;

-- Thêm cột id làm BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY (nếu chưa có)
ALTER TABLE public.awc_changes ADD COLUMN IF NOT EXISTS id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY;
