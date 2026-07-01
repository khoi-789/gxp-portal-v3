-- ============================================================
-- GxP Portal — Audit Trail Migration
-- Chay script nay trong Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Tao bang audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name     TEXT NOT NULL,
  record_id      TEXT NOT NULL,
  action         TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  changed_by     TEXT NOT NULL,
  user_role      TEXT,
  changed_at     TIMESTAMPTZ DEFAULT now() NOT NULL,
  changed_fields TEXT[] NOT NULL DEFAULT '{}' ,
  old_values     JSONB,
  new_values     JSONB,
  diff           JSONB
);

-- 2. Index tang toc truy van lich su cua 1 ban ghi
CREATE INDEX IF NOT EXISTS idx_audit_record
  ON public.audit_logs(table_name, record_id, changed_at DESC);

-- 3. Index tim kiem theo nguoi thuc hien
CREATE INDEX IF NOT EXISTS idx_audit_user
  ON public.audit_logs(changed_by, changed_at DESC);

-- 4. GIN Index cho mang changed_fields
CREATE INDEX IF NOT EXISTS idx_audit_fields
  ON public.audit_logs USING GIN(changed_fields);
