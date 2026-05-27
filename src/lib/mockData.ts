import { User, PortalApp, MasterItem } from './types';

/**
 * MOCK DATA - URS §5: Dữ liệu mẫu để test UI trước khi kết nối Supabase
 * Phản ánh đúng cấu trúc schema từ URS §3
 */

// §5: 1 User (Admin - QA)
export const MOCK_CURRENT_USER: User = {
  id: 'usr-00001-admin-qa',
  email: 'admin@gxpportal.com',
  full_name: 'Nguyễn Quản Trị',
  department_code: 'QA',
  system_role: 'admin',
};

// §5: User thường để test RBAC
export const MOCK_STAFF_USER: User = {
  id: 'usr-00002-staff-kho',
  email: 'kho.nhanvien@company.com',
  full_name: 'Trần Kho Hàng',
  department_code: 'KHO',
  system_role: 'staff',
};

// §5: 4 Portal Apps
// 1 Folder "App Công Ty" + 2 App Link (QA/KHO) + 1 App Testing
export const MOCK_PORTAL_APPS: PortalApp[] = [
  {
    app_id: 'app-folder-001',
    app_name: 'App Công Ty',
    type: 'folder',
    target_url: null,
    parent_id: null,
    allowed_depts: ['QA', 'KHO', 'SCM', 'DEV'],
    is_testing: false,
  },
  {
    app_id: 'app-link-cc-001',
    app_name: 'Khiếu Nại CC',
    type: 'link',
    target_url: '/apps/cc',
    parent_id: null,
    allowed_depts: ['QA', 'SCM'],
    is_testing: false,
  },
  {
    app_id: 'app-link-bbsc-002',
    app_name: 'BBSC Kiểm Kho',
    type: 'link',
    target_url: '/apps/bbsc',
    parent_id: null,
    allowed_depts: ['KHO', 'QA'],
    is_testing: false,
  },
  {
    app_id: 'app-link-testing-003',
    app_name: 'Quản Lý Supplier',
    type: 'link',
    target_url: '/apps/supplier',
    parent_id: null,
    allowed_depts: ['QA', 'KHO', 'SCM'],
    is_testing: true, // Hiển thị ruy-băng "TESTING MODE"
  },
  {
    app_id: 'app-destruction',
    app_name: 'Phê Duyệt Hủy',
    type: 'link',
    target_url: '/apps/destruction', // We will handle this specially in AppDashboard
    parent_id: null,
    allowed_depts: ['QA', 'KHO'],
    is_testing: false,
  },
  {
    app_id: 'app-import',
    app_name: 'Quản Lý Nhập Khẩu',
    type: 'link',
    target_url: '/apps/import',
    parent_id: null,
    allowed_depts: ['QA', 'KHO', 'SCM'],
    is_testing: false,
  },
  // App con nằm trong folder "App Công Ty"
  {
    app_id: 'app-child-hr-001',
    app_name: 'Chấm Công',
    type: 'link',
    target_url: '/apps/hr-attendance',
    parent_id: 'app-folder-001',
    allowed_depts: ['QA', 'KHO', 'SCM', 'DEV'],
    is_testing: false,
  },
  {
    app_id: 'app-child-training-002',
    app_name: 'Đào Tạo GxP',
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
