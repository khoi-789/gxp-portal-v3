import { User, PortalApp, MasterItem } from './types';

/**
 * MOCK DATA - URS §5: Dữ liệu mẫu để test UI trước khi kết nối Supabase
 * Phản ánh đúng cấu trúc schema từ URS §3
 */

// 1. Admin
export const MOCK_ADMIN_USER: User = {
  id: 'usr-admin-01',
  email: 'admin@gxpportal.com',
  full_name: 'Nguyễn Quản Trị',
  department_code: 'QA',
  system_role: 'admin',
  pilot_role: 'Admin',
};

// 2. PIC-1 (QA Văn phòng / Nhập khẩu)
export const MOCK_PIC1_USER: User = {
  id: 'usr-pic1-02',
  email: 'lenk.pic1@company.com',
  full_name: 'Lê Nhập Khẩu (PIC-1)',
  department_code: 'QA',
  system_role: 'staff',
  pilot_role: 'PIC-1',
};

// 3. PIC-2 (QA Kiểm hàng / Kho)
export const MOCK_PIC2_USER: User = {
  id: 'usr-pic2-03',
  email: 'trankho.pic2@company.com',
  full_name: 'Trần Kho Hàng (PIC-2)',
  department_code: 'KHO',
  system_role: 'staff',
  pilot_role: 'PIC-2',
};

// 4. Viewer (Chỉ xem)
export const MOCK_VIEWER_USER: User = {
  id: 'usr-viewer-04',
  email: 'viewer.doc@company.com',
  full_name: 'Phạm Người Xem (Viewer)',
  department_code: 'DEV',
  system_role: 'viewer',
  pilot_role: 'Viewer',
};

export const MOCK_CURRENT_USER = MOCK_ADMIN_USER;
export const MOCK_STAFF_USER = MOCK_PIC1_USER;

// §5: Portal Apps - Chỉ giữ lại module IMP (Nhập khẩu) theo yêu cầu
export const MOCK_PORTAL_APPS: PortalApp[] = [
  {
    app_id: 'app-link-import',
    app_name: 'IMP (Nhập khẩu)',
    type: 'link',
    target_url: '/apps/import',
    parent_id: null,
    allowed_depts: ['QA', 'KHO', 'SCM', 'DEV'],
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
