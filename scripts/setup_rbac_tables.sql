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
('usr-x3n8m2k5d', 'Nguyễn Quản Trị', 'admin@gxpportal.com', 'QA', 'admin', '#0d9488', 'active', 'admin', 'Password123!'),
('usr-w9b4v7z2p', 'Trần Kho Hàng', 'kho.nhanvien@company.com', 'KHO', 'staff', '#581c87', 'active', 'khonv', 'Password123!'),
('usr-q7r3s8t5u', 'Phạm Người Xem', 'viewer.doc@company.com', 'DEV', 'viewer', '#9d174d', 'active', 'viewernv', 'Password123!'),
('usr-c2d9f4g6h', 'Lê Nhập Khẩu', 'import.nhanvien@company.com', 'SCM', 'staff', '#1e3a8a', 'active', 'importnv', 'Password123!'),
('usr-j8k3m9p4q', 'Vũ Giám Sát', 'audit.supervisor@company.com', 'QA', 'admin', '#78350f', 'active', 'auditsup', 'Password123!'),
('usr-v6w2x7y5z', 'Đỗ Nhân Viên', 'staff.test@company.com', 'KHO', 'staff', '#0284c7', 'inactive', 'stafftest', 'Password123!')
ON CONFLICT (id) DO NOTHING;

-- Seed initial permissions
INSERT INTO public.rbac_permissions (user_id, module_key, role) VALUES
('usr-x3n8m2k5d', 'imp', 'admin'),
('usr-x3n8m2k5d', 'bbsc', 'admin'),
('usr-x3n8m2k5d', 'cc', 'admin'),
('usr-x3n8m2k5d', 'lbl', 'admin'),
('usr-x3n8m2k5d', 'ldg', 'admin'),
('usr-x3n8m2k5d', 'master-items', 'admin'),
('usr-x3n8m2k5d', 'master-suppliers', 'admin'),
('usr-x3n8m2k5d', 'master-label-mappings', 'admin'),

('usr-w9b4v7z2p', 'imp', 'qa_kho'),
('usr-w9b4v7z2p', 'bbsc', 'qa_kho'),
('usr-w9b4v7z2p', 'cc', 'viewer'),
('usr-w9b4v7z2p', 'lbl', 'qa_kho'),
('usr-w9b4v7z2p', 'ldg', 'qa_kho'),
('usr-w9b4v7z2p', 'master-items', 'viewer'),
('usr-w9b4v7z2p', 'master-suppliers', 'viewer'),
('usr-w9b4v7z2p', 'master-label-mappings', 'viewer'),

('usr-q7r3s8t5u', 'imp', 'viewer'),
('usr-q7r3s8t5u', 'bbsc', 'viewer'),
('usr-q7r3s8t5u', 'cc', 'viewer'),
('usr-q7r3s8t5u', 'lbl', 'viewer'),
('usr-q7r3s8t5u', 'ldg', 'viewer'),
('usr-q7r3s8t5u', 'master-items', 'viewer'),
('usr-q7r3s8t5u', 'master-suppliers', 'viewer'),
('usr-q7r3s8t5u', 'master-label-mappings', 'viewer'),

('usr-c2d9f4g6h', 'imp', 'qa_nk'),
('usr-c2d9f4g6h', 'bbsc', 'viewer'),
('usr-c2d9f4g6h', 'cc', 'qa_nk'),
('usr-c2d9f4g6h', 'lbl', 'qa_nk'),
('usr-c2d9f4g6h', 'ldg', 'viewer'),
('usr-c2d9f4g6h', 'master-items', 'viewer'),
('usr-c2d9f4g6h', 'master-suppliers', 'viewer'),
('usr-c2d9f4g6h', 'master-label-mappings', 'viewer'),

('usr-j8k3m9p4q', 'imp', 'admin'),
('usr-j8k3m9p4q', 'bbsc', 'admin'),
('usr-j8k3m9p4q', 'cc', 'admin'),
('usr-j8k3m9p4q', 'lbl', 'admin'),
('usr-j8k3m9p4q', 'ldg', 'admin'),
('usr-j8k3m9p4q', 'master-items', 'admin'),
('usr-j8k3m9p4q', 'master-suppliers', 'admin'),
('usr-j8k3m9p4q', 'master-label-mappings', 'admin')
ON CONFLICT (user_id, module_key) DO NOTHING;
