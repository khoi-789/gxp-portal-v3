'use client';

import { useState } from 'react';
import { Tabs, Switch, Tag, Segmented } from 'antd';
import PortalLayout from '@/components/PortalLayout';
import AppDashboard from '@/components/AppDashboard';
import MasterItemManager from '@/components/MasterItemManager';
import ProductLabelManager from '@/components/ProductLabelManager';
import MasterSupplierManager from '@/components/MasterSupplierManager';
import UserGuide from '@/components/UserGuide';
import { MOCK_CURRENT_USER, MOCK_STAFF_USER, MOCK_VIEWER_USER } from '@/lib/mockData';
import { User } from '@/lib/types';
import { LayoutGrid, Package, Link2, Truck, Database, HelpCircle } from 'lucide-react';

/**
 * Trang chủ GxP Portal
 * - Tabs: Dashboard (AppDashboard) + Master Data (Consolidated admin managers)
 * - PILOT: user switcher để demo RBAC
 */
export default function HomePage() {
  const [selectedRole, setSelectedRole] = useState<'admin' | 'staff' | 'viewer'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('pilot_selected_role');
      if (stored === 'staff' || stored === 'viewer' || stored === 'admin') {
        return stored;
      }
    }
    return 'admin';
  });

  const handleRoleChange = (role: 'admin' | 'staff' | 'viewer') => {
    setSelectedRole(role);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pilot_selected_role', role);
    }
  };

  const currentUser: User =
    selectedRole === 'admin'
      ? MOCK_CURRENT_USER
      : selectedRole === 'staff'
      ? MOCK_STAFF_USER
      : MOCK_VIEWER_USER;

  const isAllowedMasterData = currentUser.system_role === 'admin' || currentUser.system_role === 'viewer';

  const masterDataSubItems = [
    {
      key: 'master-items',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
          <Package size={14} />
          Danh mục SP
        </span>
      ),
      children: <MasterItemManager userId={currentUser.id} userRole={currentUser.system_role} />,
    },
    {
      key: 'master-suppliers',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
          <Truck size={14} />
          Danh mục NCC
        </span>
      ),
      children: <MasterSupplierManager userId={currentUser.id} userRole={currentUser.system_role} />,
    },
    {
      key: 'label-mappings',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
          <Link2 size={14} />
          Liên kết SP - Tem
        </span>
      ),
      children: <ProductLabelManager userId={currentUser.id} userRole={currentUser.system_role} />,
    },
  ];

  const tabItems = [
    {
      key: 'dashboard',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
          <LayoutGrid size={15} />
          Dashboard
        </span>
      ),
      children: <AppDashboard currentUser={currentUser} />,
    },
    // Master Data hiện với Admin & Viewer
    ...(isAllowedMasterData
      ? [
          {
            key: 'master-data',
            label: (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                <Database size={15} />
                Master Data
              </span>
            ),
            children: (
              <div style={{ padding: '4px 0 12px' }}>
                <Tabs
                  defaultActiveKey="master-items"
                  items={masterDataSubItems}
                  type="card"
                  size="middle"
                />
              </div>
            ),
          },
        ]
      : []),
    {
      key: 'user-guide',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
          <HelpCircle size={15} />
          Hướng dẫn
        </span>
      ),
      children: <UserGuide />,
    },
  ];

  return (
    <PortalLayout
      currentUser={currentUser}
      onOpenGroupManager={() => alert('Mở quản lý nhóm (coming soon)')}
      onOpenAppManager={() => alert('Mở thêm công cụ mới (coming soon)')}
      fullWidth={true}
      noScroll={false}
      pilotSwitcher={
        <div
          id="pilot-user-switcher"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '4px 12px',
            background: 'rgba(255,255,255,0.5)',
            border: '1px dashed #cbd5e1',
            borderRadius: 10,
            backdropFilter: 'blur(4px)',
          }}
        >
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
            <strong style={{ color: '#92400e' }}>PILOT MODE</strong>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Segmented
              size="small"
              options={[
                { label: <span style={{ fontSize: 11, fontWeight: 500, color: '#1e3a8a' }}>Staff</span>, value: 'staff' },
                { label: <span style={{ fontSize: 11, fontWeight: 500, color: '#581c87' }}>Viewer</span>, value: 'viewer' },
                { label: <span style={{ fontSize: 11, fontWeight: 500, color: '#78350f' }}>Admin</span>, value: 'admin' },
              ]}
              value={selectedRole}
              onChange={(val) => handleRoleChange(val as any)}
              style={{ background: '#f1f5f9', borderRadius: 6, padding: 2 }}
            />
          </div>
          <div style={{ borderLeft: '1px solid #e2e8f0', height: 16, margin: '0 4px' }} />
          <span style={{ fontSize: 11, color: '#64748b' }}>
            User: <strong style={{ color: '#1e293b' }}>{currentUser.full_name}</strong>
          </span>
        </div>
      }
    >
      {/* ========= Tabs Navigation ========= */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(255,255,255,0.8)',
          borderRadius: 20,
          padding: '2px 12px 4px',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.6)',
          boxShadow: '0 4px 24px rgba(13,148,136,0.08)',
          overflow: 'visible'
        }}
      >
        <Tabs
          defaultActiveKey="dashboard"
          items={tabItems}
          size="large"
          className="portal-tabs-full-height"
        />
      </div>
    </PortalLayout>
  );
}
