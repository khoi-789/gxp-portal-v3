'use client';

import { useState, useEffect } from 'react';
import PortalLayout from '@/components/PortalLayout';
import MasterItemManager from '@/components/MasterItemManager';
import { MOCK_CURRENT_USER } from '@/lib/mockData';
import { useRouter } from 'next/navigation';
import { useMasterPerms } from '@/lib/useMasterPerms';

/**
 * Route: /admin/master-items
 * Passes the correct permission-based userRole to MasterItemManager
 * based on the Admin-configured master_data_permissions.
 */
export default function MasterItemsPage() {
  const router = useRouter();
  const { canEdit } = useMasterPerms();

  // Read pilot role from localStorage (set by PilotMode selector)
  const [simulatedRole, setSimulatedRole] = useState<string>('Viewer');
  useEffect(() => {
    const role = localStorage.getItem('pilot_selected_role') || 'Viewer';
    setSimulatedRole(role);

    // Watch for role switches across tabs
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'pilot_selected_role') {
        setSimulatedRole(e.newValue || 'Viewer');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Map pilot role + master_items permission → userRole prop
  const userRole: 'admin' | 'staff' | 'viewer' = canEdit(simulatedRole, 'master_items')
    ? 'admin'
    : 'viewer';

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
        <span style={{ fontSize: 13, color: '#64748b' }}>Danh mục sản phẩm</span>
      </div>

      <MasterItemManager userId={MOCK_CURRENT_USER.id} userRole={userRole} currentRole={simulatedRole} />
    </PortalLayout>
  );
}
