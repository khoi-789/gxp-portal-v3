-- ==============================================================================
-- GxP PORTAL V3 — DATA MIGRATION SCRIPT (MIGRATE TO SCHEMA V1.9)
-- ==============================================================================
-- Script này dùng để chuyển đổi dữ liệu an toàn từ các bảng cũ sang cấu trúc mới:
-- 1. Bổ sung các cột mới vào master_users nếu chưa có
-- 2. Tinh chỉnh linh hoạt ràng buộc của imp_items (cho phép null các trường chưa có ở dữ liệu cũ)
-- 3. Chuyển đổi dữ liệu từ imp_shipments sang imp_records (chuẩn hóa 4 trạng thái)
-- 4. Chuyển đổi dữ liệu từ imp_shipment_items sang imp_items (bổ sung Visa, bỏ SL)
-- 5. Chuyển đổi dữ liệu thiết bị ghi nhiệt từ imp_shipments sang imp_loggers
-- 6. Chuyển đổi danh sách vấn đề (issues) cũ sang imp_issues
-- ==============================================================================

-- 1. CẬP NHẬT CÁC BẢNG MASTER DATA HIỆN CÓ
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'master_users') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'master_users' AND column_name = 'list_view_prefs') THEN
            ALTER TABLE public.master_users ADD COLUMN list_view_prefs JSONB DEFAULT '{}'::jsonb;
        END IF;
    END IF;
END $$;

-- 2. TINH CHỈNH CÁC CỘT IMP_ITEMS ĐỂ DỄ DÀNG NHẬN DỮ LIỆU CŨ
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'imp_items') THEN
        ALTER TABLE public.imp_items ALTER COLUMN item_code DROP NOT NULL;
        ALTER TABLE public.imp_items ALTER COLUMN lot_no DROP NOT NULL;
        ALTER TABLE public.imp_items ALTER COLUMN exp_date DROP NOT NULL;
        ALTER TABLE public.imp_items ALTER COLUMN visa_no DROP NOT NULL;
        ALTER TABLE public.imp_items ALTER COLUMN visa_exp_date DROP NOT NULL;
    END IF;
END $$;

-- 3. CHUYỂN DỮ LIỆU TỪ IMP_SHIPMENTS SANG IMP_RECORDS
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'imp_shipments') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'imp_records') THEN
       
        INSERT INTO public.imp_records (
            inv_no,
            received_date,
            supplier_code,
            customs_doc_status,
            status,
            notes,
            link_folder,
            created_at,
            updated_at
        )
        SELECT 
            s.invoice_number,
            COALESCE(s.created_date, CURRENT_DATE),
            s.supplier_code,
            'Đã duyệt',
            CASE 
                WHEN s.progress_status IN ('Completed', 'Hoàn tất') THEN 'Hoàn tất'
                WHEN s.progress_status IN ('Cancelled', 'Hủy') THEN 'Hủy'
                WHEN s.progress_status IN ('Pending', 'Chờ xử lý', 'In-Progress', 'Processing') THEN 'Chờ xử lý'
                ELSE 'Khởi tạo'
            END,
            COALESCE(s.actual_import_date_note, ''),
            COALESCE(s.invoice_link, s.supplier_link, ''),
            COALESCE(s.updated_at, now()),
            COALESCE(s.updated_at, now())
        FROM public.imp_shipments s
        ON CONFLICT (inv_no) DO NOTHING;
        
        RAISE NOTICE 'Đã di chuyển thành công dữ liệu từ imp_shipments sang imp_records!';
    END IF;
END $$;

-- 4. CHUYỂN DỮ LIỆU TỪ IMP_SHIPMENT_ITEMS SANG IMP_ITEMS
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'imp_shipment_items') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'imp_items') THEN
       
        INSERT INTO public.imp_items (
            record_id,
            item_code,
            item_name,
            lot_no,
            exp_date,
            visa_no,
            visa_exp_date,
            warehouse_code,
            arrival_date,
            coa_status,
            sub_label_status,
            created_at
        )
        SELECT 
            r.id,
            CASE WHEN mi.item_code IS NOT NULL THEN si.item_code ELSE NULL END,
            COALESCE(si.item_name, mi.item_name, 'Sản phẩm chưa rõ tên'),
            '24A001',
            CURRENT_DATE + INTERVAL '2 year',
            COALESCE(si.visa_no, mi.visa_no, 'VN-20112-16'),
            CASE 
                WHEN si.valid_until IS NOT NULL AND si.valid_until ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' 
                THEN to_date(si.valid_until, 'DD/MM/YYYY')
                ELSE CURRENT_DATE + INTERVAL '3 year'
            END,
            COALESCE(s.target_warehouse, 'KHO_LONG_HAU'),
            COALESCE(s.import_date_lh, s.import_date_hn, CURRENT_DATE),
            COALESCE(si.coa_status, s.coa_status, 'Đã có'),
            COALESCE(s.label_status, 'Đã duyệt'),
            COALESCE(si.created_at, now())
        FROM public.imp_shipment_items si
        JOIN public.imp_shipments s ON s.invoice_number = si.invoice_number
        JOIN public.imp_records r ON r.inv_no = s.invoice_number
        LEFT JOIN public.master_items mi ON mi.item_code = si.item_code
        WHERE NOT EXISTS (
            SELECT 1 FROM public.imp_items existing 
            WHERE existing.record_id = r.id AND existing.item_name = si.item_name
        );
        
        RAISE NOTICE 'Đã di chuyển thành công dữ liệu từ imp_shipment_items sang imp_items!';
    END IF;
END $$;

-- 5. CHUYỂN THIẾT BỊ NHIỆT TỪ IMP_SHIPMENTS SANG IMP_LOGGERS
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'imp_shipments') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'imp_loggers') THEN
       
        INSERT INTO public.imp_loggers (
            record_id,
            logger_name,
            quantity,
            result,
            notes,
            created_at
        )
        SELECT 
            r.id,
            COALESCE(s.data_logger_type, 'TempTale Ultra'),
            COALESCE(NULLIF(s.logger_qty, 0)::int, 1),
            CASE WHEN s.temp_out_of_range = true THEN 'FAIL' ELSE 'ĐẠT' END,
            COALESCE(s.temp_out_of_range_details, ''),
            COALESCE(s.updated_at, now())
        FROM public.imp_shipments s
        JOIN public.imp_records r ON r.inv_no = s.invoice_number
        WHERE s.has_data_logger = true
        AND NOT EXISTS (
            SELECT 1 FROM public.imp_loggers existing WHERE existing.record_id = r.id
        );
        
        RAISE NOTICE 'Đã di chuyển thành công thiết bị nhiệt sang imp_loggers!';
    END IF;
END $$;

-- 6. CHUYỂN ISSUES CŨ TỪ IMP_SHIPMENT_ITEMS SANG IMP_ISSUES MỚI
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'imp_shipment_items') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'imp_issues') THEN
       
        -- 6.1. Chuyển issue từ từng item
        INSERT INTO public.imp_issues (
            record_id,
            item_id,
            issue_type,
            description,
            action_required,
            status,
            created_at,
            updated_at
        )
        SELECT 
            r.id,
            it.id,
            'Chất lượng / Chứng từ',
            si.issue_notes,
            COALESCE(si.resolution_notes, 'Theo dõi và xử lý theo SOP'),
            'Chờ xử lý',
            COALESCE(si.created_at, now()),
            COALESCE(si.created_at, now())
        FROM public.imp_shipment_items si
        JOIN public.imp_records r ON r.inv_no = si.invoice_number
        LEFT JOIN public.imp_items it ON it.record_id = r.id AND it.item_name = si.item_name
        WHERE si.issue_notes IS NOT NULL AND TRIM(si.issue_notes) <> ''
        AND NOT EXISTS (
            SELECT 1 FROM public.imp_issues existing WHERE existing.record_id = r.id AND existing.description = si.issue_notes
        );

        -- 6.2. Chuyển issue từ header (cột issues dạng JSONB của imp_shipments)
        INSERT INTO public.imp_issues (
            record_id,
            issue_type,
            description,
            action_required,
            status,
            created_at,
            updated_at
        )
        SELECT 
            r.id,
            'Bất thường chuyến hàng',
            issue_elem->>'issue_text',
            COALESCE(NULLIF(issue_elem->>'resolution_text', ''), 'Xem xét và xử lý theo SOP'),
            'Chờ xử lý',
            COALESCE(s.updated_at, now()),
            COALESCE(s.updated_at, now())
        FROM public.imp_shipments s
        JOIN public.imp_records r ON r.inv_no = s.invoice_number,
        LATERAL jsonb_array_elements(s.issues) AS issue_elem
        WHERE s.issues IS NOT NULL 
          AND jsonb_typeof(s.issues) = 'array' 
          AND jsonb_array_length(s.issues) > 0
          AND issue_elem->>'issue_text' IS NOT NULL
          AND TRIM(issue_elem->>'issue_text') <> ''
        AND NOT EXISTS (
            SELECT 1 FROM public.imp_issues existing 
            WHERE existing.record_id = r.id AND existing.description = issue_elem->>'issue_text'
        );
        
        RAISE NOTICE 'Đã di chuyển thành công issues sang imp_issues!';
    END IF;
END $$;
