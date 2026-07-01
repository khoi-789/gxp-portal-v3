'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Table, Button, Input, Tag, Select, Space, Tooltip,
  Badge, Drawer, Form, InputNumber, message, Row, Col, Popconfirm,
  Spin, DatePicker, Card, Statistic, Divider
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  Search, RefreshCw, Trash2, Eye, AlertTriangle, Filter, Plus, FileText,
  Calendar, CheckCircle, Info, UserCheck, Play, Save, X, Edit3
} from 'lucide-react';
import { ColumnSearchHeader, applyColumnFilters } from '@/lib/columnSearch';
import TableControls, { ColumnConfig } from '@/components/TableControls';
import ResizableTitle from '@/components/ResizableTitle';
import { useTablePreferences } from '@/lib/useTablePreferences';
import dayjs from 'dayjs';
import { syncMasterData } from '@/lib/masterDataSync';
import { supabase } from '@/lib/supabase';
import { useMasterItems, useMasterSuppliers } from '@/lib/useMasterData';
import { buildDiff, writeAuditLog } from '@/lib/auditLog';
import AuditLogTimeline from '@/components/AuditLogTimeline';

/* ──────────────────────────────────────────────────
   Types
────────────────────────────────────────────────── */
export interface BBSCIncident {
  id: number;
  bbsc_code: string;
  created_at?: string;
  status: string; // 'Khởi tạo' | 'Chờ hết INV' | 'Hoàn tất' | 'Đóng'
  supplier_code: string;
  department_id: string; // 'Kho Nhập' | 'ĐGC2' | 'QA' | 'SCM'
  pic_id: string | null;
  sub_pic_id: string | null;
  item_code: string | null;
  item_name?: string | null;
  lot_number: string;
  exp_date: string;
  quantity: number;
  lpn_code: string | null;
  defect_description: string;
  resolution_action: string | null;
  custom_fields?: {
    unit?: string;
    asn_number?: string;
    invoice_number?: string;
    [key: string]: any;
  } | null;
}

const STATUS_OPTIONS = [
  { value: 'Khởi tạo', label: 'Khởi tạo' },
  { value: 'Chờ hết INV', label: 'Chờ hết INV' },
  { value: 'Hoàn tất', label: 'Hoàn tất' },
  { value: 'Đóng', label: 'Đóng' },
];

const STATUS_COLOR: Record<string, string> = {
  'Khởi tạo': 'cyan',
  'Chờ hết INV': 'warning',
  'Hoàn tất': 'success',
  'Đóng': 'default',
};

const DEPT_OPTIONS = [
  { value: 'Kho Nhập', label: 'Kho Nhập' },
  { value: 'ĐGC2', label: 'Bộ Phận Đóng Gói (ĐGC2)' },
  { value: 'QA', label: 'Quản Lý Chất Lượng (QA)' },
  { value: 'SCM', label: 'Chuỗi Cung Ứng (SCM)' },
];

const DEFAULT_BBSC_COLS: ColumnConfig[] = [
  { key: 'stt', label: 'STT', visible: true, fixed: true },
  { key: 'bbsc_code', label: 'Mã Sự Cố', visible: true, fixed: true },
  { key: 'status', label: 'Trạng Thái', visible: true },
  { key: 'item_code', label: 'Mã Sản Phẩm', visible: true },
  { key: 'lot_number', label: 'Số Lô', visible: true },
  { key: 'supplier_code', label: 'Nhà Cung Cấp', visible: true },
  { key: 'quantity', label: 'Số Lượng', visible: true },
  { key: 'department_id', label: 'Bộ Phận', visible: true },
  { key: 'defect_description', label: 'Mô Tả Lỗi', visible: true },
  { key: 'actions', label: 'Thao Tác', visible: true, fixed: true },
];

const DEFAULT_BBSC_WIDTHS: Record<string, number> = {
  stt: 50,
  bbsc_code: 140,
  status: 120,
  item_code: 120,
  lot_number: 120,
  supplier_code: 140,
  quantity: 100,
  department_id: 130,
  defect_description: 250,
  actions: 80,
};

// ── Server-side fetch function ──
async function fetchBBSCIncidents(
  page: number,
  pageSize: number,
  search: string,
  filters: Record<string, string>
): Promise<{ items: BBSCIncident[]; count: number }> {
  let query = supabase
    .from('bbsc_incidents')
    .select('*', { count: 'exact' });

  if (search.trim()) {
    const q = `%${search.trim()}%`;
    query = query.or(`bbsc_code.ilike.${q},item_code.ilike.${q},supplier_code.ilike.${q},lot_number.ilike.${q},defect_description.ilike.${q}`);
  }

  Object.entries(filters).forEach(([key, value]) => {
    if (!value || value.trim() === '') return;
    query = query.ilike(key, `%${value.trim()}%`);
  });

  query = query.order('created_at', { ascending: false });
  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, count, error } = await query;
  if (error) throw new Error('Lỗi tải dữ liệu BBSC: ' + error.message);
  return { items: (data || []) as BBSCIncident[], count: count || 0 };
}

export default function BBSCModule({ userId = 'default' }: { userId?: string }) {
  const [messageApi, contextHolder] = message.useMessage();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerTab, setDrawerTab] = useState<'info' | 'history'>('info');

  // Master Data (load-all for dropdowns)
  const { data: masterItemsRaw = [] } = useMasterItems();
  const masterItems = useMemo(() => masterItemsRaw.filter(x => x.is_active), [masterItemsRaw]);

  const { data: masterSuppliers = [] } = useMasterSuppliers();

  const { data: users = [] } = useQuery({
    queryKey: ['users-dropdown'],
    queryFn: async () => {
      const { data } = await supabase.from('users').select('id, full_name, email, department_code');
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Server-side paginated table data
  const bbscQueryKey = ['bbsc_incidents', currentPage, pageSize, globalSearch, columnFilters];
  const { data: bbscResult, isLoading: loading, refetch: loadData } = useQuery({
    queryKey: bbscQueryKey,
    queryFn: () => fetchBBSCIncidents(currentPage, pageSize, globalSearch, columnFilters),
    placeholderData: (prev) => prev,
  });

  const rawData = bbscResult?.items || [];
  const totalCount = bbscResult?.count || 0;
  // Drawer Form State
  const [detailRow, setDetailRow] = useState<BBSCIncident | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form] = Form.useForm();

  const { prefs, save: savePrefs, setColumnWidth } = useTablePreferences(
    'bbsc_incidents_table_v1',
    userId,
    DEFAULT_BBSC_COLS
  );

  const columnConfigs = prefs.columnConfigs;
  const showFilters = prefs.showFilters;
  const columnWidths = prefs.columnWidths;

  const w = (key: string) => columnWidths[key] ?? DEFAULT_BBSC_WIDTHS[key] ?? 100;
  const resizable = (key: string) => ({
    width: w(key),
    ellipsis: true,
    onHeaderCell: () => ({
      onResize: (width: number) => setColumnWidth(key, width),
    } as any),
  });

  // Handle column filtering change - reset to page 1
  const handleColumnFilter = (key: string, value: string) => {
    setColumnFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  // Auto suggest supplier when item changes
  const handleItemChange = (itemCode: string) => {
    const selectedItem = masterItems.find(i => i.item_code === itemCode);
    if (selectedItem?.supplier_code) {
      form.setFieldsValue({ supplier_code: selectedItem.supplier_code });
    }
  };

  // Open Drawer for Add/Edit
  const handleOpenDrawer = (record?: BBSCIncident) => {
    setDrawerTab('info');
    if (record) {
      setIsNew(false);
      setDetailRow(record);
      form.setFieldsValue({
        ...record,
        exp_date: record.exp_date ? dayjs(record.exp_date) : null,
        unit: record.custom_fields?.unit || 'Hộp',
        invoice_number: record.custom_fields?.invoice_number || '',
        asn_number: record.custom_fields?.asn_number || '',
      });
    } else {
      setIsNew(true);
      setDetailRow({
        id: 0,
        bbsc_code: `BBSC-${dayjs().format('YYYYMMDD')}-${Math.floor(1000 + Math.random() * 9000)}`,
        status: 'Khởi tạo',
        supplier_code: '',
        department_id: 'Kho Nhập',
        pic_id: null,
        sub_pic_id: null,
        item_code: null,
        lot_number: '',
        exp_date: '',
        quantity: 0,
        lpn_code: '',
        defect_description: '',
        resolution_action: '',
      });
      form.resetFields();
      form.setFieldsValue({
        bbsc_code: `BBSC-${dayjs().format('YYYYMMDD')}-${Math.floor(1000 + Math.random() * 9000)}`,
        status: 'Khởi tạo',
        department_id: 'Kho Nhập',
        unit: 'Hộp',
      });
    }
  };

  // Save changes to Supabase
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const selectedItem = masterItems.find(i => i.item_code === values.item_code);
      const dbPayload = {
        bbsc_code: values.bbsc_code,
        status: values.status,
        supplier_code: values.supplier_code,
        department_id: values.department_id,
        pic_id: values.pic_id || null,
        sub_pic_id: values.sub_pic_id || null,
        item_code: values.item_code,
        item_name: selectedItem ? selectedItem.item_name : (detailRow?.item_name || null),
        lot_number: values.lot_number,
        exp_date: values.exp_date ? values.exp_date.format('YYYY-MM-DD') : null,
        quantity: values.quantity,
        lpn_code: values.lpn_code || null,
        defect_description: values.defect_description,
        resolution_action: values.resolution_action || null,
        custom_fields: {
          unit: values.unit,
          invoice_number: values.invoice_number,
          asn_number: values.asn_number,
        }
      };

      if (isNew) {
        const { error } = await supabase.from('bbsc_incidents').insert(dbPayload);
        if (error) throw error;
        writeAuditLog({
          tableName: 'bbsc_incidents', recordId: values.bbsc_code,
          action: 'INSERT', changedBy: userId, userRole: 'QA',
          newValues: dbPayload as Record<string, unknown>,
          changedFields: Object.keys(dbPayload),
        });
        messageApi.success('Thêm mới sự cố BBSC thành công!');
      } else {
        const { error } = await supabase
          .from('bbsc_incidents')
          .update(dbPayload)
          .eq('id', detailRow?.id);
        if (error) throw error;

        const { diff, changedFields } = buildDiff(
          detailRow as unknown as Record<string, unknown>,
          dbPayload as Record<string, unknown>
        );
        writeAuditLog({
          tableName: 'bbsc_incidents', recordId: values.bbsc_code,
          action: 'UPDATE', changedBy: userId, userRole: 'QA',
          oldValues: detailRow as unknown as Record<string, unknown>,
          newValues: dbPayload as Record<string, unknown>,
          diff, changedFields,
        });
        messageApi.success('Cập nhật sự cố BBSC thành công!');
      }

      setDetailRow(null);
      queryClient.invalidateQueries({ queryKey: ['bbsc_incidents'] });
    } catch (e: any) {
      if (e.errorFields) return; // Antd validation failed
      messageApi.error('Lỗi khi lưu dữ liệu BBSC: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete record
  const handleDelete = async (id: number) => {
    try {
      const { data: recordToDelete } = await supabase.from('bbsc_incidents').select('*').eq('id', id).single();
      const { error } = await supabase.from('bbsc_incidents').delete().eq('id', id);
      if (error) throw error;
      
      if (recordToDelete) {
        writeAuditLog({
          tableName: 'bbsc_incidents', recordId: recordToDelete.bbsc_code,
          action: 'DELETE', changedBy: userId, userRole: 'QA',
          oldValues: recordToDelete,
        });
      }
      
      messageApi.success('Xóa biên bản BBSC thành công!');
      queryClient.invalidateQueries({ queryKey: ['bbsc_incidents'] });
    } catch (e: any) {
      messageApi.error('Không thể xóa: ' + e.message);
    }
  };

  // Statistics from server total
  const stats = useMemo(() => {
    const total = totalCount;
    const pending = rawData.filter(r => r.status === 'Khởi tạo' || r.status === 'Chờ hết INV').length;
    const completed = rawData.filter(r => r.status === 'Hoàn tất' || r.status === 'Đóng').length;
    return { total, pending, completed };
  }, [rawData, totalCount]);

  // Columns definition
  const columns: ColumnsType<BBSCIncident> = useMemo(() => {
    const rawCols: ColumnsType<BBSCIncident> = [
      {
        title: '#',
        key: 'stt',
        render: (_, __, idx) => (currentPage - 1) * pageSize + idx + 1,
        ...resizable('stt'),
      },
      {
        title: (
          <ColumnSearchHeader
            title="Mã Sự Cố"
            dataKey="bbsc_code"
            filters={columnFilters}
            onFilterChange={handleColumnFilter}
            showFilters={showFilters}
          />
        ),
        dataIndex: 'bbsc_code',
        key: 'bbsc_code',
        render: (text) => <strong style={{ color: '#0d9488' }}>{text}</strong>,
        ...resizable('bbsc_code'),
      },
      {
        title: (
          <ColumnSearchHeader
            title="Trạng Thái"
            dataKey="status"
            filters={columnFilters}
            onFilterChange={handleColumnFilter}
            showFilters={showFilters}
          />
        ),
        dataIndex: 'status',
        key: 'status',
        render: (status) => (
          <Tag color={STATUS_COLOR[status] || 'default'} style={{ fontWeight: 600 }}>
            {status}
          </Tag>
        ),
        ...resizable('status'),
      },
      {
        title: (
          <ColumnSearchHeader
            title="Mã Sản Phẩm"
            dataKey="item_code"
            filters={columnFilters}
            onFilterChange={handleColumnFilter}
            showFilters={showFilters}
          />
        ),
        dataIndex: 'item_code',
        key: 'item_code',
        render: (text, record) => {
          const display = record.item_name || masterItems.find(i => i.item_code === text)?.item_name || '';
          return (
            <Tooltip title={display}>
              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{text || 'N/A'}</span>
            </Tooltip>
          );
        },
        ...resizable('item_code'),
      },
      {
        title: (
          <ColumnSearchHeader
            title="Số Lô"
            dataKey="lot_number"
            filters={columnFilters}
            onFilterChange={handleColumnFilter}
            showFilters={showFilters}
          />
        ),
        dataIndex: 'lot_number',
        key: 'lot_number',
        ...resizable('lot_number'),
      },
      {
        title: (
          <ColumnSearchHeader
            title="Nhà Cung Cấp"
            dataKey="supplier_code"
            filters={columnFilters}
            onFilterChange={handleColumnFilter}
            showFilters={showFilters}
          />
        ),
        dataIndex: 'supplier_code',
        key: 'supplier_code',
        ...resizable('supplier_code'),
        render: (val: string) => {
          const s = masterSuppliers.find(x => x.supplier_code === val);
          const display = s ? s.supplier_name : val;
          return display.length > 50 ? `${display.substring(0, 50)}...` : display;
        },
      },
      {
        title: (
          <ColumnSearchHeader
            title="Số Lượng"
            dataKey="quantity"
            filters={columnFilters}
            onFilterChange={handleColumnFilter}
            showFilters={showFilters}
          />
        ),
        dataIndex: 'quantity',
        key: 'quantity',
        render: (val, r) => `${val.toLocaleString()} ${r.custom_fields?.unit || 'Hộp'}`,
        ...resizable('quantity'),
      },
      {
        title: (
          <ColumnSearchHeader
            title="Bộ Phận"
            dataKey="department_id"
            filters={columnFilters}
            onFilterChange={handleColumnFilter}
            showFilters={showFilters}
          />
        ),
        dataIndex: 'department_id',
        key: 'department_id',
        ...resizable('department_id'),
      },
      {
        title: (
          <ColumnSearchHeader
            title="Mô Tả Lỗi"
            dataKey="defect_description"
            filters={columnFilters}
            onFilterChange={handleColumnFilter}
            showFilters={showFilters}
          />
        ),
        dataIndex: 'defect_description',
        key: 'defect_description',
        ...resizable('defect_description'),
        render: (text: string) => {
          const display = text && text.length > 50 ? `${text.substring(0, 50)}...` : text;
          return <Tooltip title={text}>{display || '—'}</Tooltip>;
        },
      },
      {
        title: 'Thao Tác',
        key: 'actions',
        render: (_, r) => (
          <Space>
            <Tooltip title="Xem & Sửa">
              <Button
                type="text"
                size="small"
                onClick={() => handleOpenDrawer(r)}
                icon={<Edit3 size={15} color="#0d9488" />}
              />
            </Tooltip>
            <Popconfirm
              title="Bạn có chắc chắn muốn xóa BBSC này?"
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              onConfirm={() => r.id && handleDelete(r.id)}
            >
              <Button
                type="text"
                danger
                size="small"
                icon={<Trash2 size={15} />}
              />
            </Popconfirm>
          </Space>
        ),
        ...resizable('actions'),
      },
    ];

    // Filter columns based on preferences (visibility and ordering)
    const map = new Map(rawCols.map(c => [c.key as string, c]));
    return columnConfigs
      .filter(cfg => cfg.visible && map.has(cfg.key))
      .map(cfg => {
        const col = map.get(cfg.key)!;
        if (col.key !== 'stt' && col.key !== 'actions' && col.key !== 'bbsc_code') {
          col.fixed = undefined; // override unless fixed originally
        }
        return col;
      });
  }, [currentPage, pageSize, columnFilters, showFilters, columnConfigs, columnWidths, masterItems]);

  const components = {
    header: {
      cell: ResizableTitle,
    },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {contextHolder}

      {/* Header toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Input
            placeholder="Tìm mã BBSC, lô, sản phẩm..."
            value={globalSearch}
            onChange={e => setGlobalSearch(e.target.value)}
            style={{ width: 280, borderRadius: 8 }}
            prefix={<Search size={16} color="#64748b" />}
            allowClear
          />
          <Tooltip title="Tải lại dữ liệu">
            <Button
              type="text"
              onClick={() => loadData()}
              icon={<RefreshCw size={16} color="#64748b" />}
            />
          </Tooltip>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <TableControls
            showFilters={showFilters}
            onToggleFilters={() => savePrefs({ showFilters: !showFilters })}
            columns={columnConfigs}
            onColumnsChange={cols => savePrefs({ columnConfigs: cols })}
          />
          <Button
            type="primary"
            onClick={() => handleOpenDrawer()}
            style={{
              background: '#0d9488',
              borderColor: '#0d9488',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            icon={<Plus size={16} />}
          >
            Tạo Sự Cố INC (BBSC)
          </Button>
        </div>
      </div>

      {/* Analytics Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(10px)', borderRadius: 12 }}>
            <Statistic
              title="Tổng Số Sự Cố BBSC"
              value={stats.total}
              valueStyle={{ color: '#0f766e', fontWeight: 800 }}
              prefix={<FileText size={18} style={{ marginRight: 6 }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(10px)', borderRadius: 12 }}>
            <Statistic
              title="Đang Xử Lý"
              value={stats.pending}
              valueStyle={{ color: '#d97706', fontWeight: 800 }}
              prefix={<AlertTriangle size={18} style={{ marginRight: 6 }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(10px)', borderRadius: 12 }}>
            <Statistic
              title="Đã Hoàn Tất / Đóng"
              value={stats.completed}
              valueStyle={{ color: '#16a34a', fontWeight: 800 }}
              prefix={<CheckCircle size={18} style={{ marginRight: 6 }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Table */}
      <Card
        bordered={false}
        styles={{ body: { padding: 0 } }}
        style={{
          borderRadius: 16,
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px 0 rgba(15,118,110,0.08)',
        }}
      >
        <Table
          components={components}
          dataSource={rawData}
          columns={columns}
          loading={loading}
          rowKey="id"
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: totalCount,
            onChange: (p, s) => {
              setCurrentPage(p);
              setPageSize(s);
            },
            showSizeChanger: true,
            pageSizeOptions: ['5', '10', '20', '50'],
            showTotal: (total) => `Tổng ${total} bản ghi`,
            style: { padding: '16px 24px', margin: 0 },
          }}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      {/* Detail/Add/Edit Drawer */}
      <Drawer
        title={isNew ? '📝 Tạo Biên Bản Sự Cố BBSC' : '🔍 Chi Tiết Biên Bản BBSC'}
        placement="right"
        width={680}
        onClose={() => setDetailRow(null)}
        open={!!detailRow}
        styles={{
          header: { background: 'linear-gradient(135deg, #f0fdfa, #ccfbf1)', borderBottom: '1px solid #e2e8f0' },
          body: { background: '#f8fafc', padding: 24 }
        }}
        extra={
          <Space>
            <Button onClick={() => setDetailRow(null)}>Hủy</Button>
            <Button
              type="primary"
              onClick={handleSave}
              loading={saving}
              style={{ background: '#0d9488', borderColor: '#0d9488' }}
              icon={<Save size={16} />}
            >
              Lưu Biên Bản
            </Button>
          </Space>
        }
      >
        {detailRow && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Tabs for Info / History */}
            {!isNew && (
              <div style={{ display: 'flex', gap: 4 }}>
                {(['info', 'history'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setDrawerTab(tab)}
                    style={{
                      padding: '5px 14px', fontSize: 12, fontWeight: 600,
                      borderRadius: 20, border: 'none', cursor: 'pointer',
                      background: drawerTab === tab ? '#0d9488' : '#e2e8f0',
                      color: drawerTab === tab ? '#fff' : '#475569',
                      transition: 'all 0.15s',
                    }}
                  >
                    {tab === 'info' ? '📋 Thông tin' : '🕒 Lịch sử'}
                  </button>
                ))}
              </div>
            )}

            {!isNew && drawerTab === 'history' ? (
              <AuditLogTimeline tableName="bbsc_incidents" recordId={detailRow.bbsc_code} />
            ) : (
              <Form form={form} layout="vertical" initialValues={detailRow}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Mã Sự Cố"
                  name="bbsc_code"
                  rules={[{ required: true, message: 'Vui lòng nhập mã sự cố' }]}
                >
                  <Input disabled placeholder="Mã tự động sinh" style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Trạng Thái"
                  name="status"
                  rules={[{ required: true, message: 'Chọn trạng thái' }]}
                >
                  <Select options={STATUS_OPTIONS} style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Bộ Phận Phát Hiện"
                  name="department_id"
                  rules={[{ required: true, message: 'Chọn bộ phận' }]}
                >
                  <Select options={DEPT_OPTIONS} style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Nhà Cung Cấp"
                  name="supplier_code"
                  rules={[{ required: true, message: 'Chọn nhà cung cấp' }]}
                >
                  <Select
                    showSearch
                    placeholder="Chọn nhà cung cấp"
                    options={masterSuppliers.map(s => ({ value: s.supplier_code, label: s.supplier_name }))}
                    optionFilterProp="label"
                    style={{ borderRadius: 6 }}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Divider orientation="left" style={{ fontSize: 13, color: '#0f766e', margin: '12px 0' }}>Thông Tin Hàng Hóa Lỗi</Divider>

            <Form.Item
              label="Sản Phẩm"
              name="item_code"
              rules={[{ required: true, message: 'Vui lòng chọn sản phẩm' }]}
            >
              <Select
                showSearch
                placeholder="Tìm mã hoặc tên sản phẩm..."
                options={masterItems.map(i => ({ value: i.item_code, label: `${i.item_code} - ${i.item_name}` }))}
                onChange={handleItemChange}
                optionFilterProp="label"
                style={{ borderRadius: 6 }}
              />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Số Lô"
                  name="lot_number"
                  rules={[{ required: true, message: 'Nhập số lô' }]}
                >
                  <Input placeholder="Nhập số lô" style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Hạn Sử Dụng (EXP)"
                  name="exp_date"
                  rules={[{ required: true, message: 'Chọn hạn dùng' }]}
                >
                  <DatePicker format="DD/MM/YYYY" style={{ width: '100%', borderRadius: 6 }} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  label="Số Lượng Lỗi"
                  name="quantity"
                  rules={[{ required: true, message: 'Nhập số lượng' }]}
                >
                  <InputNumber min={1} style={{ width: '100%', borderRadius: 6 }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Đơn Vị Tính" name="unit">
                  <Select
                    options={[
                      { value: 'Hộp', label: 'Hộp' },
                      { value: 'Chai', label: 'Chai' },
                      { value: 'Viên', label: 'Viên' },
                      { value: 'Cái', label: 'Cái' },
                    ]}
                    style={{ borderRadius: 6 }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Mã LPN (Pallet)" name="lpn_code">
                  <Input placeholder="Mã LPN (nếu có)" style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="Số Invoice tham chiếu" name="invoice_number">
                  <Input placeholder="Ví dụ: INV-12345" style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Số ASN" name="asn_number">
                  <Input placeholder="Ví dụ: ASN-67890" style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
            </Row>

            <Divider orientation="left" style={{ fontSize: 13, color: '#0f766e', margin: '12px 0' }}>Báo Cáo & Xử Lý Sự Cố</Divider>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="Người Phụ Trách (PIC)" name="pic_id">
                  <Select
                    placeholder="Chọn nhân sự phụ trách"
                    allowClear
                    options={users.map(u => ({ value: u.id, label: `${u.full_name} (${u.department_code})` }))}
                    style={{ borderRadius: 6 }}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Người Phụ Phụ Trách (Sub-PIC)" name="sub_pic_id">
                  <Select
                    placeholder="Chọn nhân sự hỗ trợ"
                    allowClear
                    options={users.map(u => ({ value: u.id, label: `${u.full_name} (${u.department_code})` }))}
                    style={{ borderRadius: 6 }}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label="Mô Tả Lỗi Chi Tiết"
              name="defect_description"
              rules={[{ required: true, message: 'Nhập mô tả lỗi chi tiết' }]}
            >
              <Input.TextArea rows={4} placeholder="Ghi nhận lỗi chi tiết..." style={{ borderRadius: 6 }} />
            </Form.Item>

            <Form.Item label="Hành Động Khắc Phục / Quyết Định" name="resolution_action">
              <Input.TextArea rows={3} placeholder="Hướng xử lý khắc phục (trả hàng, dán lại, chuyển hủy...)" style={{ borderRadius: 6 }} />
            </Form.Item>
              </Form>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
