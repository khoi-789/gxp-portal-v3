'use client';

import { useState, useEffect } from 'react';
import { Tabs, Switch, Tag, Segmented, Modal } from 'antd';
import PortalLayout from '@/components/PortalLayout';
import AppDashboard from '@/components/AppDashboard';
import MasterItemManager from '@/components/MasterItemManager';
import ProductLabelManager from '@/components/ProductLabelManager';
import MasterSupplierManager from '@/components/MasterSupplierManager';
import UserGuide from '@/components/UserGuide';
import RbacManager from '@/components/RbacManager';
import { MOCK_ADMIN_USER, MOCK_PIC1_USER, MOCK_PIC2_USER, MOCK_VIEWER_USER } from '@/lib/mockData';
import { User, PilotRole } from '@/lib/types';
import ImportModule from '@/components/ImportModule';
import MasterSystemManager from '@/components/admin/MasterSystemManager';
import { 
  LayoutGrid, Package, Link2, Truck, Database, HelpCircle, Shield, FileText,
  Building, Warehouse, Thermometer, Tag as TagIcon, FileCode, FileSpreadsheet
} from 'lucide-react';

/**
 * Trang chủ GxP Portal
 * - Tabs: Dashboard + IMP (Nhập khẩu) + Master Data + Admin Suite (RBAC Matrix 2 Tầng) + Hướng dẫn
 */
export default function HomePage() {
  const [selectedRole, setSelectedRole] = useState<PilotRole>('Admin');
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isRbacDirty, setIsRbacDirty] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('pilot_selected_role');
      if (stored === 'Viewer' || stored === 'PIC-1' || stored === 'PIC-2' || stored === 'Admin') {
        setSelectedRole(stored);
      } else if (stored === 'staff') {
        setSelectedRole('PIC-1');
      } else if (stored === 'viewer') {
        setSelectedRole('Viewer');
      } else if (stored === 'admin') {
        setSelectedRole('Admin');
      }
    }
  }, []);

  const handleRoleChange = (role: PilotRole) => {
    setSelectedRole(role);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pilot_selected_role', role);
    }
  };

  const currentUser: User =
    selectedRole === 'Admin'
      ? MOCK_ADMIN_USER
      : selectedRole === 'PIC-1'
        ? MOCK_PIC1_USER
        : selectedRole === 'PIC-2'
          ? MOCK_PIC2_USER
          : MOCK_VIEWER_USER;

  // Cho phép tất cả các vai trò truy cập Master Data để nghiệm thu tính năng (Viewer sẽ ở chế độ chỉ đọc)
  const isAllowedMasterData = true;

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
    {
      key: 'departments',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
          <Building size={14} />
          Phòng ban
        </span>
      ),
      children: <MasterSystemManager forcedTab="departments" hideTabBar={true} />,
    },
    {
      key: 'warehouses',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
          <Warehouse size={14} />
          Danh mục Kho
        </span>
      ),
      children: <MasterSystemManager forcedTab="warehouses" hideTabBar={true} />,
    },
    {
      key: 'loggers',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
          <Thermometer size={14} />
          Thiết bị nhiệt
        </span>
      ),
      children: <MasterSystemManager forcedTab="loggers" hideTabBar={true} />,
    },
    {
      key: 'label_types',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
          <TagIcon size={14} />
          Loại tem nhãn
        </span>
      ),
      children: <MasterSystemManager forcedTab="label_types" hideTabBar={true} />,
    },
    {
      key: 'numbering',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
          <FileCode size={14} />
          Quy tắc sinh số
        </span>
      ),
      children: <MasterSystemManager forcedTab="numbering" hideTabBar={true} />,
    },
    {
      key: 'templates',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
          <FileSpreadsheet size={14} />
          Biểu mẫu SOP
        </span>
      ),
      children: <MasterSystemManager forcedTab="templates" hideTabBar={true} />,
    },
  ];

  const tabItems = [
    {
      key: 'dashboard',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
          <LayoutGrid size={15} />
          Dashboard
        </span>
      ),
      children: <AppDashboard currentUser={currentUser} />,
    },
    {
      key: 'imp',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#0d9488' }}>
          <FileText size={15} />
          IMP (Nhập khẩu / Invoice)
        </span>
      ),
      children: (
        <div style={{ padding: '8px 0 16px' }}>
          <ImportModule userId={currentUser.id} userRole={currentUser.system_role} />
        </div>
      ),
    },
    // Master Data hợp nhất 9 bảng trong 1 hàng tab duy nhất
    ...(isAllowedMasterData
      ? [
        {
          key: 'master-data',
          label: (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
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
    ...(currentUser.system_role === 'admin'
      ? [
        {
          key: 'rbac',
          label: (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#0f766e' }}>
              <Shield size={15} />
              Quản trị Admin
            </span>
          ),
          children: <RbacManager onDirtyChange={setIsRbacDirty} />,
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

  const handleTabChange = (key: string) => {
    if (isRbacDirty && activeTab === 'rbac') {
      Modal.confirm({
        title: 'Xác nhận rời khỏi',
        content: 'Bạn đang có thay đổi chưa lưu trong cấu hình Phân quyền. Bạn có chắc chắn muốn rời đi và hủy toàn bộ thay đổi này?',
        okText: 'Đồng ý',
        cancelText: 'Hủy',
        okButtonProps: { danger: true },
        onOk: () => {
          setIsRbacDirty(false);
          setActiveTab(key);
        }
      });
    } else {
      setActiveTab(key);
    }
  };

  if (!isMounted) {
    return null;
  }

  return (
    <PortalLayout
      currentUser={currentUser}
      onOpenGroupManager={() => alert('Mở quản lý nhóm (coming soon)')}
      onOpenAppManager={() => alert('Mở thêm công cụ mới (coming soon)')}
      fullWidth={true}
      noScroll={false}
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
          activeKey={activeTab}
          onChange={handleTabChange}
          items={tabItems}
          size="large"
          className="portal-tabs-full-height"
        />
      </div>
    </PortalLayout>
  );
}
