'use client';

import React, { useState } from 'react';
import { Tabs, Card, Tag, Alert, Radio, Table, Button, Space, message, Spin, Tooltip } from 'antd';
import {
  ShieldCheck, Users, Database, Sliders, Lock, CheckCircle2,
  Key, Layers, ShieldAlert, Sparkles, Save, RefreshCw
} from 'lucide-react';
import RbacMatrixManager from './admin/RbacMatrixManager';
import UserRoleManager from './admin/UserRoleManager';
import { useMasterPerms, MasterPermsMap, DEFAULT_MASTER_PERMS } from '@/lib/useMasterPerms';

interface RbacManagerProps {
  onDirtyChange?: (isDirty: boolean) => void;
  currentRole?: string;
}

export default function RbacManager({ onDirtyChange, currentRole }: RbacManagerProps) {
  const [activeTab, setActiveTab] = useState<string>('matrix');

  // Master Data Permission Matrix — backed by Supabase master_roles.master_data_permissions
  const { perms: dbPerms, loading: loadingPerms, saveToDB, forceRefresh } = useMasterPerms();
  const [masterPerms, setMasterPerms] = useState<MasterPermsMap | null>(null);
  const [isDirtyPerms, setIsDirtyPerms] = useState(false);
  const [savingMasterPerms, setSavingMasterPerms] = useState(false);

  // Sync local edit state when DB data loads
  React.useEffect(() => {
    if (!masterPerms) {
      setMasterPerms(dbPerms);
    }
  }, [dbPerms]); // eslint-disable-line react-hooks/exhaustive-deps

  const effectivePerms = masterPerms || dbPerms;

  const MASTER_TABLES = [
    { key: 'master_items', name: 'Danh mục Sản phẩm (master_items)', group: 'Nghiệp vụ' },
    { key: 'master_suppliers', name: 'Danh mục Hãng / NCC (master_suppliers)', group: 'Nghiệp vụ' },
    { key: 'product_label_mappings', name: 'Liên kết SP - Nhãn phụ (product_label_mappings)', group: 'Nghiệp vụ' },
    { key: 'master_departments', name: 'Phòng ban / Bộ phận (master_departments)', group: 'Hệ thống' },
    { key: 'master_warehouses', name: 'Kho bãi (master_warehouses)', group: 'Hệ thống' },
    { key: 'master_loggers', name: 'Thiết bị ghi nhiệt (master_loggers)', group: 'Hệ thống' },
    { key: 'master_label_types', name: 'Loại tem nhãn phụ (master_label_types)', group: 'Hệ thống' },
    { key: 'master_numbering_rules', name: 'Quy tắc sinh số mã phiếu (master_numbering_rules)', group: 'Hệ thống' },
    { key: 'master_form_templates', name: 'Biểu mẫu SOP (master_form_templates)', group: 'Hệ thống' },
  ];

  const handleMasterPermChange = (role: string, tableKey: string, val: 'none' | 'view' | 'edit') => {
    setMasterPerms((prev) => ({
      ...effectivePerms,
      ...prev,
      [role]: {
        ...(prev ? prev[role] : effectivePerms[role]),
        [tableKey]: val,
      },
    }));
    setIsDirtyPerms(true);
    onDirtyChange?.(true);
  };

  const handleSaveMasterPerms = async () => {
    setSavingMasterPerms(true);
    try {
      const result = await saveToDB(effectivePerms);
      if (result.success) {
        message.success('✅ Đã lưu phân quyền Master Data vào Supabase thành công và áp dụng tức thì!');
        setIsDirtyPerms(false);
        onDirtyChange?.(false);
      } else {
        message.error('❌ Lỗi lưu Database: ' + (result.error || 'Không xác định'));
      }
    } finally {
      setSavingMasterPerms(false);
    }
  };

  const handleResetDefaults = () => {
    setMasterPerms(DEFAULT_MASTER_PERMS);
    setIsDirtyPerms(true);
    onDirtyChange?.(true);
    message.info('Đã nạp ma trận chuẩn GxP. Hãy bấm "Lưu quyền Master Data" để cập nhật vào Database.');
  };

  const masterPermColumns = [
    {
      title: 'Bảng Master Data',
      key: 'table',
      width: 320,
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 700, color: '#1e293b' }}>{r.name}</div>
          <Tag color={r.group === 'Nghiệp vụ' ? 'teal' : 'geekblue'} style={{ marginTop: 2, fontSize: 11 }}>
            {r.group}
          </Tag>
        </div>
      ),
    },
    ...(['Viewer', 'Draft', 'PIC-1', 'PIC-2', 'Admin'] as const).map((role) => ({
      title: (
        <span style={{ fontWeight: 700, color: role === 'Admin' ? '#e11d48' : role === 'PIC-1' ? '#0d9488' : '#334155' }}>
          {role}
        </span>
      ),
      key: role,
      render: (_: any, r: any) => {
        const val = effectivePerms[role]?.[r.key] || 'none';
        const isNone = val === 'none';
        const isView = val === 'view';
        const isEdit = val === 'edit';

        return (
          <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: 2, borderRadius: 8, border: '1px solid #e2e8f0', gap: 2 }}>
            <button
              type="button"
              onClick={() => handleMasterPermChange(role, r.key, 'none')}
              style={{
                border: 'none',
                cursor: 'pointer',
                padding: '3px 9px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: isNone ? 700 : 500,
                background: isNone ? '#64748b' : 'transparent',
                color: isNone ? '#ffffff' : '#94a3b8',
                boxShadow: isNone ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              None
            </button>
            <button
              type="button"
              onClick={() => handleMasterPermChange(role, r.key, 'view')}
              style={{
                border: 'none',
                cursor: 'pointer',
                padding: '3px 9px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: isView ? 700 : 600,
                background: isView ? '#2563eb' : 'transparent',
                color: isView ? '#ffffff' : '#2563eb',
                boxShadow: isView ? '0 1px 3px rgba(37,99,235,0.25)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              View
            </button>
            <button
              type="button"
              onClick={() => handleMasterPermChange(role, r.key, 'edit')}
              style={{
                border: 'none',
                cursor: 'pointer',
                padding: '3px 9px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: isEdit ? 700 : 600,
                background: isEdit ? '#0d9488' : 'transparent',
                color: isEdit ? '#ffffff' : '#0d9488',
                boxShadow: isEdit ? '0 1px 3px rgba(13,148,136,0.25)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              Edit
            </button>
          </div>
        );
      },
    })),
  ];

  const adminTabs = [
    {
      key: 'matrix',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: 13 }}>
          <Sliders size={15} />
          Phân quyền 2 Tầng
        </span>
      ),
      children: <RbacMatrixManager onDirtyChange={onDirtyChange} />,
    },
    {
      key: 'users',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: 13 }}>
          <Users size={15} />
          Nhân sự & Vai trò
        </span>
      ),
      children: <UserRoleManager />,
    },
    {
      key: 'master-perms',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: 13 }}>
          <ShieldAlert size={15} />
          Quyền Master Data
        </span>
      ),
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card
            style={{
              borderRadius: 16,
              background: 'linear-gradient(135deg, #f0fdfa 0%, #ffffff 100%)',
              border: '1px solid #ccfbf1',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <ShieldCheck size={22} color="#0d9488" />
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f766e' }}>
                    Phân quyền Truy cập Master Data (None / View / Edit)
                  </h2>
                  {loadingPerms && <Spin size="small" style={{ marginLeft: 8 }} />}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                  Thiết lập quyền Xem và Chỉnh sửa cho từng vai trò trên 9 bảng Master Data nghiệp vụ và hệ thống.
                  {isDirtyPerms && <span style={{ color: '#f59e0b', fontWeight: 600, marginLeft: 8 }}>⚠ Chưa lưu</span>}
                </p>
              </div>

              <Space wrap>
                <Tooltip title="Tải lại phân quyền mới nhất từ Supabase Database">
                  <Button
                    icon={<RefreshCw size={14} />}
                    onClick={async () => {
                      await forceRefresh();
                      setMasterPerms(null);
                      setIsDirtyPerms(false);
                      onDirtyChange?.(false);
                      message.success('Đã làm mới phân quyền từ Database!');
                    }}
                    style={{ borderRadius: 10, height: 36, fontWeight: 500 }}
                  >
                    Tải lại DB
                  </Button>
                </Tooltip>

                <Button
                  onClick={handleResetDefaults}
                  style={{ borderRadius: 10, height: 36, fontWeight: 500 }}
                >
                  Khôi phục chuẩn GxP
                </Button>

                <Button
                  type="primary"
                  icon={<Save size={15} />}
                  loading={savingMasterPerms}
                  onClick={handleSaveMasterPerms}
                  disabled={!isDirtyPerms}
                  style={{
                    background: isDirtyPerms ? '#0d9488' : '#94a3b8',
                    borderColor: isDirtyPerms ? '#0d9488' : '#94a3b8',
                    fontWeight: 600,
                    borderRadius: 10,
                    height: 36,
                    opacity: isDirtyPerms ? 1 : 0.7,
                  }}
                >
                  {isDirtyPerms ? 'Lưu quyền Master Data' : 'Đã lưu (Không có thay đổi)'}
                </Button>
              </Space>
            </div>
          </Card>

          <Card style={{ borderRadius: 16, border: '1px solid #e2e8f0' }} bodyStyle={{ padding: 0 }}>
            <Table
              dataSource={MASTER_TABLES}
              columns={masterPermColumns}
              rowKey="key"
              pagination={false}
              size="middle"
            />
          </Card>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={adminTabs}
        type="card"
        size="large"
        className="admin-suite-tabs"
      />
    </div>
  );
}
