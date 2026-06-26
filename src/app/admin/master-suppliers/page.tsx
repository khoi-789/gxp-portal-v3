'use client';

import PortalLayout from '@/components/PortalLayout';
import MasterSupplierManager from '@/components/MasterSupplierManager';
import { MOCK_CURRENT_USER } from '@/lib/mockData';
import { ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * Route: /admin/master-suppliers
 * Admin-only page for managing system Master Suppliers (NCC)
 */
export default function MasterSuppliersPage() {
  const router = useRouter();

  // Guard: chỉ admin mới vào được
  if (MOCK_CURRENT_USER.system_role !== 'admin') {
    return (
      <PortalLayout currentUser={MOCK_CURRENT_USER}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 400,
            gap: 16,
            color: '#64748b',
          }}
        >
          <ShieldCheck size={60} strokeWidth={1} color="#e2e8f0" />
          <h2 style={{ margin: 0, color: '#374151' }}>Không có quyền truy cập</h2>
          <p>Trang này chỉ dành cho Admin.</p>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout
      currentUser={MOCK_CURRENT_USER}
      onOpenGroupManager={() => alert('Quản lý nhóm (coming soon)')}
      onOpenAppManager={() => alert('Thêm công cụ (coming soon)')}
    >
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#0d9488',
            fontWeight: 500,
            fontSize: 13,
            padding: '4px 8px',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          ← Trang chủ
        </button>
        <span style={{ color: '#cbd5e1', fontSize: 14 }}>/</span>
        <span style={{ fontSize: 13, color: '#64748b' }}>Danh mục nhà cung cấp</span>
      </div>

      <MasterSupplierManager userId={MOCK_CURRENT_USER.id} />
    </PortalLayout>
  );
}
