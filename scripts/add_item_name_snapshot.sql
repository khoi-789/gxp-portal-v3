-- SQL Migration: Thêm cột item_name snapshot vào các bảng nghiệp vụ GxP Portal
-- Copy và chạy script này trong Supabase SQL Editor

-- 1. Thêm cột item_name vào các bảng nếu chưa tồn tại
ALTER TABLE public.awc_changes ADD COLUMN IF NOT EXISTS item_name TEXT;
ALTER TABLE public.bbsc_incidents ADD COLUMN IF NOT EXISTS item_name TEXT;
ALTER TABLE public.cc_complaints ADD COLUMN IF NOT EXISTS item_name TEXT;
ALTER TABLE public.int_records ADD COLUMN IF NOT EXISTS item_name TEXT;
ALTER TABLE public.ldg_orders ADD COLUMN IF NOT EXISTS item_name TEXT;

-- 2. Điền dữ liệu item_name lịch sử từ bảng master_items sang các bản ghi hiện tại
UPDATE public.awc_changes t 
SET item_name = m.item_name 
FROM public.master_items m 
WHERE t.item_code = m.item_code AND t.item_name IS NULL;

UPDATE public.bbsc_incidents t 
SET item_name = m.item_name 
FROM public.master_items m 
WHERE t.item_code = m.item_code AND t.item_name IS NULL;

UPDATE public.cc_complaints t 
SET item_name = m.item_name 
FROM public.master_items m 
WHERE t.item_code = m.item_code AND t.item_name IS NULL;

UPDATE public.int_records t 
SET item_name = m.item_name 
FROM public.master_items m 
WHERE t.item_code = m.item_code AND t.item_name IS NULL;

UPDATE public.ldg_orders t 
SET item_name = m.item_name 
FROM public.master_items m 
WHERE t.item_code = m.item_code AND t.item_name IS NULL;
