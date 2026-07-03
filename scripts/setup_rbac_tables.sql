-- Create rbac_users table
CREATE TABLE IF NOT EXISTS public.rbac_users (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    department_code TEXT NOT NULL,
    system_role TEXT NOT NULL,
    avatar_color TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    username TEXT,
    password TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.rbac_users DISABLE ROW LEVEL SECURITY;

-- Create rbac_permissions table
CREATE TABLE IF NOT EXISTS public.rbac_permissions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.rbac_users(id) ON DELETE CASCADE,
    module_key TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (user_id, module_key)
);
ALTER TABLE public.rbac_permissions DISABLE ROW LEVEL SECURITY;

-- Seed initial users into rbac_users
INSERT INTO public.rbac_users (id, full_name, email, department_code, system_role, avatar_color, status, username, password) VALUES
('usr-00001-admin-qa', 'Nguyễn Quản Trị', 'admin@gxpportal.com', 'QA', 'admin', '#0d9488', 'active', 'admin', 'Password123!'),
('usr-00002-staff-kho', 'Trần Kho Hàng', 'kho.nhanvien@company.com', 'KHO', 'staff', '#581c87', 'active', 'khonv', 'Password123!'),
('usr-00003-viewer', 'Phạm Người Xem', 'viewer.doc@company.com', 'DEV', 'viewer', '#9d174d', 'active', 'viewernv', 'Password123!'),
('usr-00004-import-scm', 'Lê Nhập Khẩu', 'import.nhanvien@company.com', 'SCM', 'staff', '#1e3a8a', 'active', 'importnv', 'Password123!'),
('usr-00005-audit-sup', 'Vũ Giám Sát', 'audit.supervisor@company.com', 'QA', 'admin', '#78350f', 'active', 'auditsup', 'Password123!'),
('usr-00006-staff-test', 'Đỗ Nhân Viên', 'staff.test@company.com', 'KHO', 'staff', '#0284c7', 'inactive', 'stafftest', 'Password123!')
ON CONFLICT (id) DO NOTHING;

-- Seed initial permissions
INSERT INTO public.rbac_permissions (user_id, module_key, role) VALUES
('usr-00001-admin-qa', 'imp', 'admin'),
('usr-00001-admin-qa', 'bbsc', 'admin'),
('usr-00001-admin-qa', 'cc', 'admin'),
('usr-00001-admin-qa', 'lbl', 'admin'),
('usr-00001-admin-qa', 'ldg', 'admin'),
('usr-00001-admin-qa', 'master-items', 'admin'),
('usr-00001-admin-qa', 'master-suppliers', 'admin'),
('usr-00001-admin-qa', 'master-label-mappings', 'admin'),

('usr-00002-staff-kho', 'imp', 'qa_kho'),
('usr-00002-staff-kho', 'bbsc', 'qa_kho'),
('usr-00002-staff-kho', 'cc', 'viewer'),
('usr-00002-staff-kho', 'lbl', 'qa_kho'),
('usr-00002-staff-kho', 'ldg', 'qa_kho'),
('usr-00002-staff-kho', 'master-items', 'viewer'),
('usr-00002-staff-kho', 'master-suppliers', 'viewer'),
('usr-00002-staff-kho', 'master-label-mappings', 'viewer'),

('usr-00003-viewer', 'imp', 'viewer'),
('usr-00003-viewer', 'bbsc', 'viewer'),
('usr-00003-viewer', 'cc', 'viewer'),
('usr-00003-viewer', 'lbl', 'viewer'),
('usr-00003-viewer', 'ldg', 'viewer'),
('usr-00003-viewer', 'master-items', 'viewer'),
('usr-00003-viewer', 'master-suppliers', 'viewer'),
('usr-00003-viewer', 'master-label-mappings', 'viewer'),

('usr-00004-import-scm', 'imp', 'qa_nk'),
('usr-00004-import-scm', 'bbsc', 'viewer'),
('usr-00004-import-scm', 'cc', 'qa_nk'),
('usr-00004-import-scm', 'lbl', 'qa_nk'),
('usr-00004-import-scm', 'ldg', 'viewer'),
('usr-00004-import-scm', 'master-items', 'viewer'),
('usr-00004-import-scm', 'master-suppliers', 'viewer'),
('usr-00004-import-scm', 'master-label-mappings', 'viewer'),

('usr-00005-audit-sup', 'imp', 'admin'),
('usr-00005-audit-sup', 'bbsc', 'admin'),
('usr-00005-audit-sup', 'cc', 'admin'),
('usr-00005-audit-sup', 'lbl', 'admin'),
('usr-00005-audit-sup', 'ldg', 'admin'),
('usr-00005-audit-sup', 'master-items', 'admin'),
('usr-00005-audit-sup', 'master-suppliers', 'admin'),
('usr-00005-audit-sup', 'master-label-mappings', 'admin')
ON CONFLICT (user_id, module_key) DO NOTHING;
