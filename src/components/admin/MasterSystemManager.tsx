'use client';

import React, { useState, useEffect } from 'react';
import {
  Card, Table, Tabs, Button, Tag, Space, Modal, Form, Input,
  Select, Switch, message, Popconfirm, Tooltip, InputNumber
} from 'antd';
import {
  Database, Building, Warehouse, Thermometer, Tag as TagIcon,
  FileCode, FileSpreadsheet, Plus, Edit, Trash2, CheckCircle,
  XCircle, RefreshCw
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function MasterSystemManager() {
  const [activeTab, setActiveTab] = useState('departments');
  const [loading, setLoading] = useState(false);

  // Data States
  const [departments, setDepartments] = useState<any[]>([
    { id: '1', department_code: 'QA', department_name: 'Phòng Đảm Bảo Chất Lượng', short_name: 'QA', is_active: true },
    { id: '2', department_code: 'KHO', department_name: 'Bộ Phận Kho Vận & Bảo Quản', short_name: 'KHO', is_active: true },
    { id: '3', department_code: 'SCM', department_name: 'Phòng Chuỗi Cung Ứng & XNK', short_name: 'SCM', is_active: true },
    { id: '4', department_code: 'DEV', department_name: 'Bộ Phận Công Nghệ & Hệ Thống', short_name: 'DEV', is_active: true },
  ]);

  const [warehouses, setWarehouses] = useState<any[]>([
    { id: '1', warehouse_code: 'KHO_LONG_HAU', warehouse_name: 'Kho GxP Long Hậu', address: 'KCN Long Hậu, Cần Giuộc, Long An', is_active: true },
    { id: '2', warehouse_code: 'KHO_HA_NOI', warehouse_name: 'Kho Phân Phối Hà Nội', address: 'KCN Quang Minh, Mê Linh, Hà Nội', is_active: true },
    { id: '3', warehouse_code: 'KHO_TRUNG_CHUYEN', warehouse_name: 'Kho Trung Chuyển Sân Bay TSN', address: 'Tân Bình, TP.HCM', is_active: true },
  ]);

  const [loggers, setLoggers] = useState<any[]>([
    { id: '1', logger_code: 'TT_ULTRA', logger_name: 'TempTale Ultra', model: 'Single-Use USB', temp_range: '2°C - 8°C', is_active: true },
    { id: '2', logger_code: 'LIBERO_PDF', logger_name: 'Elpro Libero PDF', model: 'Multi-Use PDF', temp_range: '15°C - 25°C', is_active: true },
    { id: '3', logger_code: 'TESTO_174T', logger_name: 'Testo 174T Mini', model: 'Display Logger', temp_range: '-30°C to +70°C', is_active: true },
  ]);

  const [labelTypes, setLabelTypes] = useState<any[]>([
    { id: '1', label_type_code: 'TT1300023', label_type_name: 'Nhãn DNNK 1x2.5cm', description: 'Dán ngoài hộp cho thuốc nhập khẩu', is_active: true },
    { id: '2', label_type_code: 'HDSD', label_type_name: 'Tờ Hướng Dẫn Sử Dụng tiếng Việt', description: 'Đính kèm hộp thuốc khi lưu hành', is_active: true },
    { id: '3', label_type_code: 'TEM_KIEM_SOAT', label_type_name: 'Tem Niêm Phong / Kiểm Soát QA', description: 'Dán nắp thùng sau khi kiểm nhập', is_active: true },
  ]);

  const [numberingRules, setNumberingRules] = useState<any[]>([
    { id: '1', module_code: 'IMP', prefix: 'IMP-', date_format: 'YYMM', seq_digits: 4, current_seq: 6, sample_output: 'IMP-2609-0007' },
    { id: '2', module_code: 'COMP', prefix: 'CC-', date_format: 'YYYY-', seq_digits: 4, current_seq: 12, sample_output: 'CC-2026-0013' },
    { id: '3', module_code: 'INC', prefix: 'BBSC-', date_format: 'YYYY-', seq_digits: 3, current_seq: 5, sample_output: 'BBSC-2026-006' },
  ]);

  const [formTemplates, setFormTemplates] = useState<any[]>([
    { id: '1', module_code: 'IMP', form_code: 'BM-QA-IMP-01', version: 'v3.2', effective_from: '2026-01-01', is_current: true, change_notes: 'Cập nhật theo Schema V1.9 (bỏ SL, tích hợp Visa)' },
    { id: '2', module_code: 'INC', form_code: 'BM-QA-BBSC-02', version: 'v2.0', effective_from: '2025-06-15', is_current: true, change_notes: 'Chuẩn hóa biên bản sự cố nhập' },
    { id: '3', module_code: 'COMP', form_code: 'BM-QA-CC-01', version: 'v1.5', effective_from: '2025-09-01', is_current: true, change_notes: 'Quy trình khiếu nại nhà sản xuất' },
  ]);

  // Load from Supabase on mount
  useEffect(() => {
    async function loadData() {
      try {
        const { data: deptData } = await supabase.from('master_departments').select('*');
        if (deptData && deptData.length > 0) setDepartments(deptData);

        const { data: whData } = await supabase.from('master_warehouses').select('*');
        if (whData && whData.length > 0) setWarehouses(whData);

        const { data: logData } = await supabase.from('master_loggers').select('*');
        if (logData && logData.length > 0) setLoggers(logData);

        const { data: lblData } = await supabase.from('master_label_types').select('*');
        if (lblData && lblData.length > 0) setLabelTypes(lblData);

        const { data: numData } = await supabase.from('master_numbering_rules').select('*');
        if (numData && numData.length > 0) setNumberingRules(numData);

        const { data: tmplData } = await supabase.from('master_form_templates').select('*');
        if (tmplData && tmplData.length > 0) setFormTemplates(tmplData);
      } catch (err) {
        console.warn('Load system master data error:', err);
      }
    }
    loadData();
  }, []);

  const tabItems = [
    {
      key: 'departments',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Building size={14} /> Phòng ban ({departments.length})
        </span>
      ),
      children: (
        <Table
          dataSource={departments}
          rowKey="id"
          pagination={false}
          columns={[
            { title: 'Mã phòng ban', dataIndex: 'department_code', width: 140, render: (t: string) => <Tag color="teal" style={{ fontWeight: 700 }}>{t}</Tag> },
            { title: 'Tên phòng ban / Bộ phận', dataIndex: 'department_name', render: (t: string) => <span style={{ fontWeight: 600 }}>{t}</span> },
            { title: 'Tên viết tắt', dataIndex: 'short_name', width: 120 },
            {
              title: 'Trạng thái',
              dataIndex: 'is_active',
              width: 140,
              render: (a: boolean) => a ? <Tag color="success">Đang dùng</Tag> : <Tag color="default">Khóa</Tag>,
            },
          ]}
        />
      ),
    },
    {
      key: 'warehouses',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Warehouse size={14} /> Danh mục Kho ({warehouses.length})
        </span>
      ),
      children: (
        <Table
          dataSource={warehouses}
          rowKey="id"
          pagination={false}
          columns={[
            { title: 'Mã kho', dataIndex: 'warehouse_code', width: 160, render: (t: string) => <Tag color="purple" style={{ fontWeight: 700 }}>{t}</Tag> },
            { title: 'Tên kho bãi', dataIndex: 'warehouse_name' },
            { title: 'Địa chỉ kho', dataIndex: 'address' },
            {
              title: 'Trạng thái',
              dataIndex: 'is_active',
              width: 140,
              render: (a: boolean) => a ? <Tag color="success">Đang dùng</Tag> : <Tag color="default">Khóa</Tag>,
            },
          ]}
        />
      ),
    },
    {
      key: 'loggers',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Thermometer size={14} /> Thiết bị nhiệt ({loggers.length})
        </span>
      ),
      children: (
        <Table
          dataSource={loggers}
          rowKey="id"
          pagination={false}
          columns={[
            { title: 'Mã thiết bị', dataIndex: 'logger_code', width: 140, render: (t: string) => <Tag color="blue" style={{ fontWeight: 700 }}>{t}</Tag> },
            { title: 'Tên thiết bị nhiệt độ', dataIndex: 'logger_name', render: (t: string) => <span style={{ fontWeight: 600 }}>{t}</span> },
            { title: 'Dòng sản phẩm / Loại', dataIndex: 'model' },
            { title: 'Dải nhiệt độ theo dõi', dataIndex: 'temp_range', render: (t: string) => <Tag color="cyan">{t}</Tag> },
            {
              title: 'Trạng thái',
              dataIndex: 'is_active',
              width: 140,
              render: (a: boolean) => a ? <Tag color="success">Hoạt động</Tag> : <Tag color="default">Khóa</Tag>,
            },
          ]}
        />
      ),
    },
    {
      key: 'label_types',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <TagIcon size={14} /> Loại tem nhãn ({labelTypes.length})
        </span>
      ),
      children: (
        <Table
          dataSource={labelTypes}
          rowKey="id"
          pagination={false}
          columns={[
            { title: 'Mã loại tem', dataIndex: 'label_type_code', width: 140, render: (t: string) => <Tag color="orange" style={{ fontWeight: 700 }}>{t}</Tag> },
            { title: 'Tên loại nhãn phụ', dataIndex: 'label_type_name', render: (t: string) => <span style={{ fontWeight: 600 }}>{t}</span> },
            { title: 'Mục đích sử dụng', dataIndex: 'description' },
            {
              title: 'Trạng thái',
              dataIndex: 'is_active',
              width: 140,
              render: (a: boolean) => a ? <Tag color="success">Áp dụng</Tag> : <Tag color="default">Khóa</Tag>,
            },
          ]}
        />
      ),
    },
    {
      key: 'numbering',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileCode size={14} /> Quy tắc sinh số ({numberingRules.length})
        </span>
      ),
      children: (
        <Table
          dataSource={numberingRules}
          rowKey="id"
          pagination={false}
          columns={[
            { title: 'Module', dataIndex: 'module_code', width: 110, render: (t: string) => <Tag color="geekblue" style={{ fontWeight: 700 }}>{t}</Tag> },
            { title: 'Tiền tố (Prefix)', dataIndex: 'prefix', width: 120, render: (t: string) => <code style={{ color: '#0d9488' }}>{t}</code> },
            { title: 'Định dạng ngày', dataIndex: 'date_format', width: 140 },
            { title: 'Số chữ số thứ tự', dataIndex: 'seq_digits', width: 150 },
            { title: 'Số hiện tại', dataIndex: 'current_seq', width: 120, render: (n: number) => <b>#{n}</b> },
            {
              title: 'Mẫu số phiếu tự sinh tiếp theo',
              dataIndex: 'sample_output',
              render: (s: string) => (
                <Tag color="magenta" style={{ fontWeight: 700, padding: '3px 8px', fontSize: 13 }}>
                  {s}
                </Tag>
              ),
            },
          ]}
        />
      ),
    },
    {
      key: 'templates',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileSpreadsheet size={14} /> Biểu mẫu SOP ({formTemplates.length})
        </span>
      ),
      children: (
        <Table
          dataSource={formTemplates}
          rowKey="id"
          pagination={false}
          columns={[
            { title: 'Module', dataIndex: 'module_code', width: 100, render: (t: string) => <Tag color="geekblue" style={{ fontWeight: 700 }}>{t}</Tag> },
            { title: 'Mã biểu mẫu SOP', dataIndex: 'form_code', width: 160, render: (t: string) => <code style={{ fontWeight: 600 }}>{t}</code> },
            { title: 'Phiên bản hiệu lực', dataIndex: 'version', width: 140, render: (v: string) => <Tag color="green" style={{ fontWeight: 700 }}>{v}</Tag> },
            { title: 'Ngày hiệu lực', dataIndex: 'effective_from', width: 140 },
            { title: 'Ghi chú thay đổi', dataIndex: 'change_notes' },
            {
              title: 'Hiệu lực',
              dataIndex: 'is_current',
              width: 120,
              render: (c: boolean) => c ? <Tag color="success">Đang áp dụng</Tag> : <Tag>Hết hạn</Tag>,
            },
          ]}
        />
      ),
    },
  ];

  return (
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
              <Database size={22} color="#0d9488" />
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f766e' }}>
                Quản trị Danh mục Master Data Hệ thống Mới (Schema V1.9)
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              Quản lý tập trung 6 bảng tham chiếu nền tảng: Phòng ban, Kho bãi, Thiết bị ghi nhiệt độ, Phân loại tem nhãn, Quy tắc tự sinh số phiếu và Biểu mẫu SOP hiệu lực.
            </p>
          </div>
        </div>
      </Card>

      <Card style={{ borderRadius: 16, border: '1px solid #e2e8f0' }} bodyStyle={{ padding: '8px 16px 16px' }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} type="line" size="middle" />
      </Card>
    </div>
  );
}
