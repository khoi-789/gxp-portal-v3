'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Table, Tag, Segmented, Radio, Button, Space, message,
  Tooltip, Badge, Collapse, Alert, Divider, Modal, Switch, Select
} from 'antd';
import {
  ShieldCheck, Eye, Edit3, EyeOff, Save, RefreshCw, Layers,
  ChevronDown, ChevronRight, CheckCircle, AlertTriangle, Play,
  HelpCircle, Sliders, Lock, Unlock, Sparkles
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// 5 Cấp bậc Vai trò chuẩn Schema V1.9
export type RoleCode = 'Viewer' | 'Draft' | 'PIC-1' | 'PIC-2' | 'Admin';
export type StatusCode = 'Khởi tạo' | 'Chờ xử lý' | 'Hoàn tất' | 'Hủy';
export type PermLevel = 'HIDDEN' | 'READ' | 'EDIT';

export interface FieldDefinition {
  code: string;
  label: string;
  description?: string;
}

export interface GroupDefinition {
  groupCode: string;
  groupName: string;
  fields: FieldDefinition[];
}

export const IMP_MODULE_GROUPS: GroupDefinition[] = [
  {
    groupCode: 'group_header',
    groupName: '1. Khối Thông tin chung (Header)',
    fields: [
      { code: 'inv_no', label: 'Số hóa đơn (Invoice No)' },
      { code: 'received_date', label: 'Ngày nhận thông tin' },
      { code: 'supplier_code', label: 'Mã Hãng / Nhà cung cấp' },
      { code: 'customs_doc_status', label: 'Tình trạng Hồ sơ Hải quan' },
      { code: 'status', label: 'Trạng thái phiếu' },
      { code: 'notes', label: 'Ghi chú chung' },
      { code: 'link_folder', label: 'Liên kết thư mục hồ sơ (Hyperlink)' },
    ],
  },
  {
    groupCode: 'group_items',
    groupName: '2. Khối Chi tiết Sản phẩm & Visa (Items)',
    fields: [
      { code: 'item_code', label: 'Mã sản phẩm (Item Code)' },
      { code: 'item_name', label: 'Tên sản phẩm' },
      { code: 'lot_no', label: 'Số lô sản xuất (Lot No)' },
      { code: 'exp_date', label: 'Hạn dùng (Exp Date)' },
      { code: 'visa_no', label: 'Số Visa / Giấy phép nhập khẩu' },
      { code: 'visa_exp_date', label: 'Hạn Visa' },
      { code: 'warehouse_code', label: 'Kho nhập hàng' },
      { code: 'arrival_date', label: 'Ngày hàng về kho' },
      { code: 'coa_status', label: 'Tình trạng COA' },
      { code: 'sub_label_status', label: 'Tình trạng Nhãn phụ' },
    ],
  },
  {
    groupCode: 'group_loggers',
    groupName: '3. Khối Thiết bị ghi nhiệt (Loggers)',
    fields: [
      { code: 'logger_name', label: 'Tên thiết bị nhiệt độ' },
      { code: 'quantity', label: 'Số lượng thiết bị' },
      { code: 'result', label: 'Kết quả theo dõi nhiệt (ĐẠT / FAIL)' },
      { code: 'notes', label: 'Ghi chú bất thường nhiệt độ' },
    ],
  },
  {
    groupCode: 'group_issues',
    groupName: '4. Khối Vấn đề & Hành động (Issues)',
    fields: [
      { code: 'issue_type', label: 'Phân loại vấn đề' },
      { code: 'description', label: 'Mô tả chi tiết vấn đề' },
      { code: 'action_required', label: 'Hành động cần xử lý (1 ô duy nhất)' },
      { code: 'pic_user_id', label: 'Người chịu trách nhiệm xử lý (PIC)' },
      { code: 'deadline', label: 'Thời hạn giải quyết (Deadline)' },
      { code: 'status', label: 'Trạng thái xử lý vấn đề' },
    ],
  },
];

export interface FieldPermissionConfig {
  module_code: string;
  role_code: RoleCode;
  status_code: StatusCode;
  group_code: string;
  group_permission: PermLevel;
  field_overrides: Record<string, PermLevel>; // e.g. { "status": "READ" }
}

// Default Seed Matrix chuẩn GxP nếu chưa load từ DB
const DEFAULT_PERMISSIONS: FieldPermissionConfig[] = [
  // PIC-1 (QA Văn phòng / Nhập khẩu): Toàn quyền ở Khởi tạo & Chờ xử lý; Read-only ở Hoàn tất & Hủy
  { module_code: 'IMP', role_code: 'PIC-1', status_code: 'Khởi tạo', group_code: 'group_header', group_permission: 'EDIT', field_overrides: {} },
  { module_code: 'IMP', role_code: 'PIC-1', status_code: 'Khởi tạo', group_code: 'group_items', group_permission: 'EDIT', field_overrides: { 'arrival_date': 'READ' } },
  { module_code: 'IMP', role_code: 'PIC-1', status_code: 'Khởi tạo', group_code: 'group_loggers', group_permission: 'EDIT', field_overrides: {} },
  { module_code: 'IMP', role_code: 'PIC-1', status_code: 'Khởi tạo', group_code: 'group_issues', group_permission: 'EDIT', field_overrides: {} },

  { module_code: 'IMP', role_code: 'PIC-1', status_code: 'Chờ xử lý', group_code: 'group_header', group_permission: 'EDIT', field_overrides: {} },
  { module_code: 'IMP', role_code: 'PIC-1', status_code: 'Chờ xử lý', group_code: 'group_items', group_permission: 'EDIT', field_overrides: {} },
  { module_code: 'IMP', role_code: 'PIC-1', status_code: 'Chờ xử lý', group_code: 'group_loggers', group_permission: 'EDIT', field_overrides: {} },
  { module_code: 'IMP', role_code: 'PIC-1', status_code: 'Chờ xử lý', group_code: 'group_issues', group_permission: 'EDIT', field_overrides: {} },

  // PIC-2 (QA Kiểm hàng / Kho): Được nhập ngày về, thiết bị nhiệt độ; không sửa Header
  { module_code: 'IMP', role_code: 'PIC-2', status_code: 'Chờ xử lý', group_code: 'group_header', group_permission: 'READ', field_overrides: {} },
  { module_code: 'IMP', role_code: 'PIC-2', status_code: 'Chờ xử lý', group_code: 'group_items', group_permission: 'READ', field_overrides: { 'arrival_date': 'EDIT', 'warehouse_code': 'EDIT' } },
  { module_code: 'IMP', role_code: 'PIC-2', status_code: 'Chờ xử lý', group_code: 'group_loggers', group_permission: 'EDIT', field_overrides: {} },
  { module_code: 'IMP', role_code: 'PIC-2', status_code: 'Chờ xử lý', group_code: 'group_issues', group_permission: 'EDIT', field_overrides: {} },

  // Viewer: Luôn READ tất cả các nhóm ở mọi trạng thái
  { module_code: 'IMP', role_code: 'Viewer', status_code: 'Khởi tạo', group_code: 'group_header', group_permission: 'READ', field_overrides: {} },
  { module_code: 'IMP', role_code: 'Viewer', status_code: 'Khởi tạo', group_code: 'group_items', group_permission: 'READ', field_overrides: {} },
  { module_code: 'IMP', role_code: 'Viewer', status_code: 'Khởi tạo', group_code: 'group_loggers', group_permission: 'READ', field_overrides: {} },
  { module_code: 'IMP', role_code: 'Viewer', status_code: 'Khởi tạo', group_code: 'group_issues', group_permission: 'READ', field_overrides: {} },
];

export default function RbacMatrixManager({ onDirtyChange }: { onDirtyChange?: (isDirty: boolean) => void }) {
  const [selectedRole, setSelectedRole] = useState<RoleCode>('PIC-1');
  const [selectedStatus, setSelectedStatus] = useState<StatusCode>('Khởi tạo');
  const [permissions, setPermissions] = useState<FieldPermissionConfig[]>(DEFAULT_PERMISSIONS);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    group_header: false,
    group_items: false,
    group_loggers: false,
    group_issues: false,
  });

  // Simulator mode
  const [activeMode, setActiveMode] = useState<'matrix' | 'simulator'>('matrix');

  // Load from Supabase on mount
  useEffect(() => {
    async function loadPermissions() {
      try {
        const { data, error } = await supabase
          .from('master_field_permissions')
          .select('*')
          .eq('module_code', 'IMP');

        if (!error && data && data.length > 0) {
          const loaded: FieldPermissionConfig[] = data.map((d: any) => ({
            module_code: d.module_code,
            role_code: d.role_code as RoleCode,
            status_code: (d.status_code === 'KHOI_TAO' ? 'Khởi tạo' :
                          d.status_code === 'CHO_XU_LY' ? 'Chờ xử lý' :
                          d.status_code === 'HOAN_TAT' ? 'Hoàn tất' :
                          d.status_code === 'HUY' ? 'Hủy' : d.status_code) as StatusCode,
            group_code: d.group_code,
            group_permission: d.group_permission as PermLevel,
            field_overrides: d.field_overrides || {},
          }));
          setPermissions(loaded);
        }
      } catch (err) {
        console.warn('Cannot load master_field_permissions, using defaults:', err);
      }
    }
    loadPermissions();
  }, []);

  // Update dirty state
  const notifyDirty = (dirty: boolean) => {
    setIsDirty(dirty);
    onDirtyChange?.(dirty);
  };

  // Helper to find config
  const getConfig = (groupCode: string): FieldPermissionConfig => {
    const found = permissions.find(
      (p) =>
        p.role_code === selectedRole &&
        p.status_code === selectedStatus &&
        p.group_code === groupCode
    );

    if (found) return found;

    // Default if not configured
    const defaultPerm: PermLevel =
      selectedRole === 'Admin' ? 'EDIT' :
      selectedRole === 'Viewer' ? 'READ' :
      selectedStatus === 'Hoàn tất' || selectedStatus === 'Hủy' ? 'READ' : 'EDIT';

    return {
      module_code: 'IMP',
      role_code: selectedRole,
      status_code: selectedStatus,
      group_code: groupCode,
      group_permission: defaultPerm,
      field_overrides: {},
    };
  };

  // Handler update group permission
  const handleGroupPermChange = (groupCode: string, newPerm: PermLevel) => {
    notifyDirty(true);
    setPermissions((prev) => {
      const idx = prev.findIndex(
        (p) =>
          p.role_code === selectedRole &&
          p.status_code === selectedStatus &&
          p.group_code === groupCode
      );
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], group_permission: newPerm };
        return updated;
      } else {
        return [
          ...prev,
          {
            module_code: 'IMP',
            role_code: selectedRole,
            status_code: selectedStatus,
            group_code: groupCode,
            group_permission: newPerm,
            field_overrides: {},
          },
        ];
      }
    });
  };

  // Handler update field override
  const handleFieldOverrideChange = (groupCode: string, fieldCode: string, override: PermLevel | 'INHERIT') => {
    notifyDirty(true);
    setPermissions((prev) => {
      const current = getConfig(groupCode);
      const newOverrides = { ...current.field_overrides };

      if (override === 'INHERIT') {
        delete newOverrides[fieldCode];
      } else {
        newOverrides[fieldCode] = override;
      }

      const idx = prev.findIndex(
        (p) =>
          p.role_code === selectedRole &&
          p.status_code === selectedStatus &&
          p.group_code === groupCode
      );

      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], field_overrides: newOverrides };
        return updated;
      } else {
        return [
          ...prev,
          {
            ...current,
            field_overrides: newOverrides,
          },
        ];
      }
    });
  };

  // Save to Supabase
  const handleSave = async () => {
    setSaving(true);
    try {
      const statusDbMap: Record<string, string> = {
        'Khởi tạo': 'KHOI_TAO',
        'Chờ xử lý': 'CHO_XU_LY',
        'Hoàn tất': 'HOAN_TAT',
        'Hủy': 'HUY',
      };

      const payload = permissions.map((p) => ({
        module_code: p.module_code,
        role_code: p.role_code,
        status_code: statusDbMap[p.status_code] || p.status_code,
        group_code: p.group_code,
        group_permission: p.group_permission,
        field_overrides: p.field_overrides,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('master_field_permissions')
        .upsert(payload, { onConflict: 'module_code,status_code,role_code,group_code' });

      if (error) throw error;

      message.success('Đã lưu thành công cấu hình ma trận phân quyền 2 tầng!');
      notifyDirty(false);
    } catch (err: any) {
      console.error('Lỗi khi lưu master_field_permissions:', err);
      message.warning('Đã lưu cục bộ. Supabase thông báo: ' + (err.message || 'Lỗi mạng'));
      notifyDirty(false);
    } finally {
      setSaving(false);
    }
  };

  // Resolve permission for simulator
  const resolveFieldPerm = (groupCode: string, fieldCode: string): PermLevel => {
    const cfg = getConfig(groupCode);
    if (cfg.field_overrides && cfg.field_overrides[fieldCode]) {
      return cfg.field_overrides[fieldCode];
    }
    return cfg.group_permission;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Header Card */}
      <Card
        style={{
          borderRadius: 16,
          background: 'linear-gradient(135deg, #f0fdfa 0%, #ffffff 100%)',
          border: '1px solid #ccfbf1',
          boxShadow: '0 4px 12px rgba(13,148,136,0.06)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <ShieldCheck size={22} color="#0d9488" />
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f766e' }}>
                Ma trận Phân quyền 2 Tầng (2-Tier RBAC Matrix)
              </h2>
              <Tag color="cyan" style={{ borderRadius: 8, fontWeight: 600 }}>Schema V1.9</Tag>
              {isDirty && (
                <Tag color="warning" style={{ borderRadius: 8, fontWeight: 600 }}>
                  Có thay đổi chưa lưu
                </Tag>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              Quy định quyền xem/sửa/ẩn cho 5 Vai trò theo từng Trạng thái phiếu. Admin có thể chọn nhanh cả nhóm hoặc mở rộng để điều chỉnh riêng từng trường con (*vừa gọn, vừa ngon*).
            </p>
          </div>

          <Space>
            <Segmented
              value={activeMode}
              onChange={(val: any) => setActiveMode(val)}
              options={[
                { label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Sliders size={14} /> Cấu hình Ma trận</span>, value: 'matrix' },
                { label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Play size={14} /> Trình Giả lập (Simulator)</span>, value: 'simulator' },
              ]}
            />
            {activeMode === 'matrix' && (
              <Button
                type="primary"
                icon={<Save size={15} />}
                loading={saving}
                disabled={!isDirty}
                onClick={handleSave}
                style={{
                  background: isDirty ? '#0d9488' : undefined,
                  borderColor: isDirty ? '#0d9488' : undefined,
                  fontWeight: 600,
                  borderRadius: 10,
                  height: 36,
                }}
              >
                Lưu cấu hình
              </Button>
            )}
          </Space>
        </div>

        <Divider style={{ margin: '14px 0' }} />

        {/* Filter Toolbar: Select Role & Select Status */}
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase' }}>
              1. Chọn Vai trò (Role Level):
            </div>
            <Segmented
              value={selectedRole}
              onChange={(val: any) => setSelectedRole(val)}
              options={[
                { label: <span style={{ fontWeight: 600 }}>Viewer</span>, value: 'Viewer' },
                { label: <span style={{ fontWeight: 600 }}>Draft</span>, value: 'Draft' },
                { label: <span style={{ fontWeight: 600, color: '#0d9488' }}>PIC-1</span>, value: 'PIC-1' },
                { label: <span style={{ fontWeight: 600, color: '#7c3aed' }}>PIC-2</span>, value: 'PIC-2' },
                { label: <span style={{ fontWeight: 600, color: '#e11d48' }}>Admin</span>, value: 'Admin' },
              ]}
              size="middle"
            />
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase' }}>
              2. Chọn Trạng thái phiếu (Record Status):
            </div>
            <Segmented
              value={selectedStatus}
              onChange={(val: any) => setSelectedStatus(val)}
              options={[
                { label: <Tag color="blue">Khởi tạo</Tag>, value: 'Khởi tạo' },
                { label: <Tag color="orange">Chờ xử lý</Tag>, value: 'Chờ xử lý' },
                { label: <Tag color="green">Hoàn tất</Tag>, value: 'Hoàn tất' },
                { label: <Tag color="default">Hủy</Tag>, value: 'Hủy' },
              ]}
              size="middle"
            />
          </div>
        </div>
      </Card>

      {/* MODE 1: MATRIX CONFIGURATION */}
      {activeMode === 'matrix' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Alert
            message={
              <div style={{ fontSize: 13 }}>
                Đang cấu hình quyền cho vai trò <b>{selectedRole}</b> khi phiếu ở trạng thái <b>{selectedStatus}</b> trong module <b>IMP (Nhập khẩu)</b>.
              </div>
            }
            type="info"
            showIcon
            style={{ borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}
          />

          {IMP_MODULE_GROUPS.map((group) => {
            const cfg = getConfig(group.groupCode);
            const isExpanded = !!expandedGroups[group.groupCode];
            const overrideCount = Object.keys(cfg.field_overrides || {}).length;

            return (
              <Card
                key={group.groupCode}
                style={{
                  borderRadius: 14,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  overflow: 'hidden',
                }}
                bodyStyle={{ padding: 18 }}
              >
                {/* TẦNG 1: QUYỀN CẤP NHÓM (GROUP LEVEL) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Layers size={17} color="#0d9488" />
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
                        {group.groupName}
                      </span>
                      {overrideCount > 0 && (
                        <Tag color="purple" style={{ borderRadius: 6, fontWeight: 600 }}>
                          {overrideCount} trường có ngoại lệ
                        </Tag>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                      Bao gồm {group.fields.length} trường dữ liệu.
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Quyền chung cả nhóm:</span>
                      <Radio.Group
                        value={cfg.group_permission}
                        onChange={(e) => handleGroupPermChange(group.groupCode, e.target.value)}
                        buttonStyle="solid"
                      >
                        <Radio.Button value="EDIT">
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Edit3 size={13} /> Sửa (EDIT)
                          </span>
                        </Radio.Button>
                        <Radio.Button value="READ">
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Eye size={13} /> Chỉ xem (READ)
                          </span>
                        </Radio.Button>
                        <Radio.Button value="HIDDEN">
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <EyeOff size={13} /> Ẩn (HIDDEN)
                          </span>
                        </Radio.Button>
                      </Radio.Group>
                    </div>

                    <Button
                      type="text"
                      size="small"
                      onClick={() =>
                        setExpandedGroups((prev) => ({ ...prev, [group.groupCode]: !prev[group.groupCode] }))
                      }
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        color: '#0d9488',
                        fontWeight: 600,
                        background: '#f0fdfa',
                        borderRadius: 8,
                        padding: '4px 10px',
                        height: 32,
                      }}
                    >
                      {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      {isExpanded ? 'Thu gọn chi tiết' : 'Mở rộng chi tiết trường (Overrides)'}
                    </Button>
                  </div>
                </div>

                {/* TẦNG 2: MỞ RỘNG GHI ĐÈ TỪNG TRƯỜNG CON (FIELD-LEVEL OVERRIDES) */}
                {isExpanded && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: 14,
                      background: '#f8fafc',
                      borderRadius: 10,
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 10 }}>
                      DANH SÁCH CÁC TRƯỜNG CON — Mặc định kế thừa quyền nhóm [{cfg.group_permission}], Admin có thể đặt ngoại lệ riêng:
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 10 }}>
                      {group.fields.map((f) => {
                        const overrideVal = cfg.field_overrides?.[f.code];
                        const isOverridden = !!overrideVal;

                        return (
                          <div
                            key={f.code}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px 12px',
                              background: isOverridden ? '#faf5ff' : '#ffffff',
                              border: isOverridden ? '1px solid #d8b4fe' : '1px solid #e2e8f0',
                              borderRadius: 8,
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                                {f.label}
                              </div>
                              <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>
                                {f.code}
                              </div>
                            </div>

                            <Select
                              size="small"
                              style={{ width: 145 }}
                              value={isOverridden ? overrideVal : 'INHERIT'}
                              onChange={(val) => handleFieldOverrideChange(group.groupCode, f.code, val as PermLevel | 'INHERIT')}
                              options={[
                                { label: <span style={{ color: '#64748b' }}>Kế thừa ({cfg.group_permission})</span>, value: 'INHERIT' },
                                { label: <span style={{ color: '#0d9488', fontWeight: 600 }}>Sửa (EDIT)</span>, value: 'EDIT' },
                                { label: <span style={{ color: '#3b82f6', fontWeight: 600 }}>Chỉ xem (READ)</span>, value: 'READ' },
                                { label: <span style={{ color: '#ef4444', fontWeight: 600 }}>Ẩn (HIDDEN)</span>, value: 'HIDDEN' },
                              ]}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* MODE 2: SIMULATOR PREVIEW (TRÌNH GIẢ LẬP TRỰC QUAN CHO ADMIN) */}
      {activeMode === 'simulator' && (
        <Card
          style={{
            borderRadius: 16,
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
          }}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Play size={17} color="#0d9488" />
              <span>
                Giao diện Giả lập cho Vai trò <b>{selectedRole}</b> khi mở Phiếu ở trạng thái <b>{selectedStatus}</b>
              </span>
            </div>
          }
          extra={
            <Space>
              <Tag color="blue" style={{ borderRadius: 6, fontWeight: 600 }}>
                Xanh lá = Sửa được (EDIT)
              </Tag>
              <Tag color="default" style={{ borderRadius: 6, fontWeight: 600 }}>
                Xám = Chỉ xem (READ)
              </Tag>
              <Tag color="error" style={{ borderRadius: 6, fontWeight: 600 }}>
                Gạch đỏ = Bị ẩn (HIDDEN)
              </Tag>
            </Space>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {IMP_MODULE_GROUPS.map((group) => {
              const groupCfg = getConfig(group.groupCode);
              const isGroupHidden = groupCfg.group_permission === 'HIDDEN';

              return (
                <div
                  key={group.groupCode}
                  style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: 12,
                    padding: 16,
                    background: isGroupHidden ? '#fef2f2' : '#ffffff',
                    opacity: isGroupHidden ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, color: isGroupHidden ? '#ef4444' : '#0f766e', fontSize: 14 }}>
                      {group.groupName}
                    </div>
                    <div>
                      {isGroupHidden ? (
                        <Tag color="error">CẢ KHỐI ĐANG BỊ ẨN</Tag>
                      ) : (
                        <Tag color="cyan">Khối đang mở ({groupCfg.group_permission})</Tag>
                      )}
                    </div>
                  </div>

                  {!isGroupHidden && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                      {group.fields.map((f) => {
                        const perm = resolveFieldPerm(group.groupCode, f.code);

                        if (perm === 'HIDDEN') {
                          return (
                            <div
                              key={f.code}
                              style={{
                                padding: 10,
                                background: '#fef2f2',
                                border: '1px dashed #f87171',
                                borderRadius: 8,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <span style={{ textDecoration: 'line-through', color: '#991b1b', fontSize: 13 }}>
                                {f.label}
                              </span>
                              <Tag color="error" style={{ margin: 0, fontSize: 10 }}>BỊ ẨN</Tag>
                            </div>
                          );
                        }

                        if (perm === 'READ') {
                          return (
                            <div
                              key={f.code}
                              style={{
                                padding: 10,
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                borderRadius: 8,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <div>
                                <div style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>{f.label}</div>
                                <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>[Chỉ xem - Khóa sửa]</div>
                              </div>
                              <Lock size={14} color="#64748b" />
                            </div>
                          );
                        }

                        return (
                          <div
                            key={f.code}
                            style={{
                              padding: 10,
                              background: '#f0fdfa',
                              border: '1.5px solid #0d9488',
                              borderRadius: 8,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 12, color: '#0f766e', fontWeight: 700 }}>{f.label}</div>
                              <div style={{ fontSize: 12, color: '#0d9488' }}>[Được chỉnh sửa]</div>
                            </div>
                            <Unlock size={14} color="#0d9488" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
