import { User, PortalApp, MasterItem } from './types';

/**
 * MOCK DATA - URS §5: Dữ liệu mẫu để test UI trước khi kết nối Supabase
 * Phản ánh đúng cấu trúc schema từ URS §3
 */

// §5: 1 User (Admin - QA)
export const MOCK_CURRENT_USER: User = {
  id: 'usr-x3n8m2k5d',
  email: 'admin@gxpportal.com',
  full_name: 'Nguyễn Quản Trị',
  department_code: 'QA',
  system_role: 'admin',
};

// §5: User thường để test RBAC
export const MOCK_STAFF_USER: User = {
  id: 'usr-w9b4v7z2p',
  email: 'kho.nhanvien@company.com',
  full_name: 'Trần Kho Hàng',
  department_code: 'KHO',
  system_role: 'staff',
};

// §5: User Viewer chỉ đọc
export const MOCK_VIEWER_USER: User = {
  id: 'usr-q7r3s8t5u',
  email: 'viewer.doc@company.com',
  full_name: 'Phạm Người Xem',
  department_code: 'DEV',
  system_role: 'viewer',
};

// §5: 4 Portal Apps
export const MOCK_PORTAL_APPS: PortalApp[] = [
  {
    app_id: 'app-link-import',
    app_name: 'IMP (Nhập khẩu / Invoice)',
    type: 'link',
    target_url: '/apps/import',
    parent_id: null,
    allowed_depts: ['QA', 'KHO', 'SCM', 'DEV'],
    is_testing: false,
  },
  {
    app_id: 'app-folder-001',
    app_name: 'Tiện ích Doanh nghiệp',
    type: 'folder',
    target_url: null,
    parent_id: null,
    allowed_depts: ['QA', 'KHO', 'SCM', 'DEV'],
    is_testing: false,
  },
  // App con nằm trong folder
  {
    app_id: 'app-child-hr-001',
    app_name: 'Chấm Công & Nghỉ Phép',
    type: 'link',
    target_url: '/apps/hr-attendance',
    parent_id: 'app-folder-001',
    allowed_depts: ['QA', 'KHO', 'SCM', 'DEV'],
    is_testing: false,
  },
  {
    app_id: 'app-child-training-002',
    app_name: 'Đào Tạo & Quy trình GxP',
    type: 'link',
    target_url: '/apps/training',
    parent_id: 'app-folder-001',
    allowed_depts: ['QA', 'DEV'],
    is_testing: false,
  },
];

// §5: 5 Master Items
export const MOCK_MASTER_ITEMS: MasterItem[] = [
  {
    item_code: 'SA1100013',
    item_name: 'Amoxicillin 500mg Capsule x 100',
    supplier_code: 'HYPHENS',
    visa_no: 'VD-12345-19',
    is_active: true,
  },
  {
    item_code: 'SA2200045',
    item_name: 'Paracetamol 650mg Tablet x 200',
    supplier_code: 'PHARMAONE',
    visa_no: 'VD-23456-20',
    is_active: true,
  },
  {
    item_code: 'SA3300078',
    item_name: 'Ibuprofen 400mg Film-coated x 100',
    supplier_code: 'MEDIVANCE',
    visa_no: null,
    is_active: false,
  },
  {
    item_code: 'SA4400099',
    item_name: 'Omeprazole 20mg Capsule x 30',
    supplier_code: 'HYPHENS',
    visa_no: 'VD-34567-21',
    is_active: true,
  },
  {
    item_code: 'SA5500112',
    item_name: 'Vitamin C 1000mg Effervescent x 20',
    supplier_code: 'NUTRICHEM',
    visa_no: 'VD-45678-22',
    is_active: true,
  },
];
