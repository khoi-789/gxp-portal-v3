/**
 * Type definitions khớp 100% với Supabase Schema trong URS §3
 */

// §3.1 Bảng users
export interface User {
  id: string;            // uuid - Primary Key (Supabase Auth)
  email: string;         // text - Not Null, Unique
  full_name: string;     // text - Not Null
  department_code: string; // text - Not Null (VD: QA, KHO, SCM, DEV)
  system_role: 'admin' | 'staff'; // text - Not Null
}

// §3.2 Bảng portal_apps
export interface PortalApp {
  app_id: string;        // uuid - Primary Key
  app_name: string;      // text - Not Null
  type: 'link' | 'folder'; // text - 'link' hoặc 'folder'
  target_url: string | null; // text - Nullable (bỏ trống nếu type='folder')
  parent_id: string | null; // uuid - Nullable, FK
  allowed_depts: string[]; // text[] - Not Null
  is_testing: boolean;   // boolean - Default false
}

// §3.3 Bảng master_items
export interface MasterItem {
  item_code: string;     // text - Primary Key
  item_name: string;     // text - Not Null
  supplier_code: string; // text - Not Null
  visa_no: string | null; // text - Nullable
  is_active: boolean;    // boolean - Default true

  // --- Extended fields from Item/Pack files ---
  gross_weight?: number;
  net_weight?: number;
  inner_pack?: number;
  case_qty?: number;
  pallet_qty?: number;
  uom1?: string;
  uom2?: string;
  uom3?: string;
  [key: string]: any;    // For future flexible columns
}

// Bảng master_suppliers
export interface MasterSupplier {
  supplier_code: string;  // text - Primary Key (ID)
  supplier_name: string;  // text - Not Null
  notes?: string;         // text
  business_type?: string[]; // text[]
  created_at?: string;    // timestamptz
}

