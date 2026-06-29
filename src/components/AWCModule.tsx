'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Table, Button, Input, Tag, Select, Space, Tooltip,
  Badge, Drawer, Form, message, Row, Col, Popconfirm,
  Card, Statistic, Divider, DatePicker
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  Search, RefreshCw, Trash2, Eye, Filter, Plus, FileText,
  Calendar, CheckCircle, Info, Save, Edit3, Link, AlertCircle, AlertTriangle, Clipboard
} from 'lucide-react';
import { ColumnSearchHeader, applyColumnFilters } from '@/lib/columnSearch';
import TableControls, { ColumnConfig } from '@/components/TableControls';
import ResizableTitle from '@/components/ResizableTitle';
import { useTablePreferences } from '@/lib/useTablePreferences';
import dayjs from 'dayjs';
import { syncMasterData } from '@/lib/masterDataSync';
import { supabase } from '@/lib/supabase';

/* ──────────────────────────────────────────────────
   Types
────────────────────────────────────────────────── */
export interface AWCChange {
  id: number;
  awc_code: string;
  notice_date: string;
  item_code: string;
  item_name?: string | null;
  supplier_code: string;
  new_item_code: string | null;
  status: string; // 'Alerted' | 'Pending 1st Batch' | 'Verified' | 'Closed'
  old_info: string | null;
  new_change_info: string | null;
  expected_batch: string | null;
  estimated_receive: string | null;
  actual_batch: string | null;
  actual_receive: string | null;
  evidence_url: string | null;
  impact_analysis: {
    requires_label_change?: boolean;
    dav_report_needed?: boolean;
    notes?: string;
  } | null;
  created_at?: string;
}

const STATUS_OPTIONS = [
  { value: 'Alerted', label: 'Cảnh báo (Alerted)' },
  { value: 'Pending 1st Batch', label: 'Chờ lô đầu tiên (Pending 1st Batch)' },
  { value: 'Verified', label: 'Đã kiểm chứng (Verified)' },
  { value: 'Closed', label: 'Đã đóng hồ sơ (Closed)' },
];

const STATUS_COLOR: Record<string, string> = {
  'Alerted': 'error',
  'Pending 1st Batch': 'warning',
  'Verified': 'success',
  'Closed': 'default',
};

const DEFAULT_AWC_COLS: ColumnConfig[] = [
  { key: 'stt', label: 'STT', visible: true, fixed: true },
  { key: 'awc_code', label: 'Mã Thay Đổi', visible: true, fixed: true },
  { key: 'status', label: 'Trạng Thái', visible: true },
  { key: 'item_code', label: 'Mã Sản Phẩm', visible: true },
  { key: 'notice_date', label: 'Ngày Thông Báo', visible: true },
  { key: 'expected_batch', label: 'Lô Dự Kiến', visible: true },
  { key: 'actual_batch', label: 'Lô Thực Tế', visible: true },
  { key: 'supplier_code', label: 'Nhà Cung Cấp', visible: true },
  { key: 'actions', label: 'Thao Tác', visible: true, fixed: true },
];

const DEFAULT_AWC_WIDTHS: Record<string, number> = {
  stt: 50,
  awc_code: 150,
  status: 150,
  item_code: 120,
  notice_date: 120,
  expected_batch: 120,
  actual_batch: 120,
  supplier_code: 140,
  actions: 80,
};

// ── Server-side fetch function ──
async function fetchAWCChanges(
  page: number,
  pageSize: number,
  search: string,
  filters: Record<string, string>
): Promise<{ items: AWCChange[]; count: number }> {
  let query = supabase
    .from('awc_changes')
    .select('*', { count: 'exact' });

  if (search.trim()) {
    const q = `%${search.trim()}%`;
    query = query.or(`awc_code.ilike.${q},item_code.ilike.${q},supplier_code.ilike.${q},expected_batch.ilike.${q}`);
  }

  Object.entries(filters).forEach(([key, value]) => {
    if (!value || value.trim() === '') return;
    query = query.ilike(key, `%${value.trim()}%`);
  });

  query = query.order('notice_date', { ascending: false });
  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, count, error } = await query;
  if (error) throw new Error('Lỗi tải danh sách AWC: ' + error.message);
  return { items: (data || []) as AWCChange[], count: count || 0 };
}

export default function AWCModule({ userId = 'default' }: { userId?: string }) {
  const [messageApi, contextHolder] = message.useMessage();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Master Data (load-all for dropdowns, lightweight select)
  const { data: masterItems = [] } = useQuery<any[]>({
    queryKey: ['master-items-dropdown'],
    queryFn: async () => {
      const list = await syncMasterData<any>({
        table: 'master_items',
        keyField: 'item_code',
        storageKey: 'gxp_master_items_cache'
      });
      return list.filter(x => x.is_active);
    },
    initialData: () => {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('gxp_master_items_cache');
        if (raw) {
          try {
            return JSON.parse(raw).filter((x: any) => x.is_active);
          } catch {}
        }
      }
      return undefined;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: masterSuppliers = [] } = useQuery<any[]>({
    queryKey: ['master-suppliers-dropdown'],
    queryFn: async () => {
      return syncMasterData<any>({
        table: 'master_suppliers',
        keyField: 'supplier_code',
        storageKey: 'gxp_master_suppliers_cache'
      });
    },
    initialData: () => {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('gxp_master_suppliers_cache');
        if (raw) {
          try {
            return JSON.parse(raw);
          } catch {}
        }
      }
      return undefined;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Server-side paginated table data
  const awcQueryKey = ['awc_changes', currentPage, pageSize, globalSearch, columnFilters];
  const { data: awcResult, isLoading: loading, refetch: loadData } = useQuery({
    queryKey: awcQueryKey,
    queryFn: () => fetchAWCChanges(currentPage, pageSize, globalSearch, columnFilters),
    placeholderData: (prev) => prev,
  });

  const rawData = awcResult?.items || [];
  const totalCount = awcResult?.count || 0;

  // Drawer Form State
  const [detailRow, setDetailRow] = useState<AWCChange | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form] = Form.useForm();

  // Table configs
  const { prefs, save: savePrefs, setColumnWidth } = useTablePreferences(
    'awc_changes_table_v1',
    userId,
    DEFAULT_AWC_COLS
  );

  const columnConfigs = prefs.columnConfigs;
  const showFilters = prefs.showFilters;
  const columnWidths = prefs.columnWidths;

  const w = (key: string) => columnWidths[key] ?? DEFAULT_AWC_WIDTHS[key] ?? 100;
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
  const handleOpenDrawer = (record?: AWCChange) => {
    if (record) {
      setIsNew(false);
      setDetailRow(record);
      form.setFieldsValue({
        ...record,
        notice_date: record.notice_date ? dayjs(record.notice_date) : null,
        estimated_receive: record.estimated_receive ? dayjs(record.estimated_receive) : null,
        actual_receive: record.actual_receive ? dayjs(record.actual_receive) : null,
        requires_label_change: record.impact_analysis?.requires_label_change ?? false,
        dav_report_needed: record.impact_analysis?.dav_report_needed ?? false,
        impact_notes: record.impact_analysis?.notes || '',
      });
    } else {
      setIsNew(true);
      const code = `AWC-${dayjs().format('YY')}-${Math.floor(100 + Math.random() * 900)}`;
      setDetailRow({
        id: 0,
        awc_code: code,
        notice_date: dayjs().format('YYYY-MM-DD'),
        item_code: '',
        supplier_code: '',
        new_item_code: null,
        status: 'Alerted',
        old_info: '',
        new_change_info: '',
        expected_batch: '',
        estimated_receive: null,
        actual_batch: '',
        actual_receive: null,
        evidence_url: '',
        impact_analysis: {
          requires_label_change: false,
          dav_report_needed: false,
          notes: ''
        },
      });
      form.resetFields();
      form.setFieldsValue({
        awc_code: code,
        notice_date: dayjs(),
        status: 'Alerted',
        requires_label_change: false,
        dav_report_needed: false,
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
        awc_code: values.awc_code,
        notice_date: values.notice_date ? values.notice_date.format('YYYY-MM-DD') : null,
        item_code: values.item_code,
        item_name: selectedItem ? selectedItem.item_name : (detailRow?.item_name || null),
        supplier_code: values.supplier_code,
        new_item_code: values.new_item_code || null,
        status: values.status,
        old_info: values.old_info || null,
        new_change_info: values.new_change_info || null,
        expected_batch: values.expected_batch || null,
        estimated_receive: values.estimated_receive ? values.estimated_receive.format('YYYY-MM-DD') : null,
        actual_batch: values.actual_batch || null,
        actual_receive: values.actual_receive ? values.actual_receive.format('YYYY-MM-DD') : null,
        evidence_url: values.evidence_url || null,
        impact_analysis: {
          requires_label_change: !!values.requires_label_change,
          dav_report_needed: !!values.dav_report_needed,
          notes: values.impact_notes || '',
        }
      };

      if (isNew) {
        const { error } = await supabase.from('awc_changes').insert(dbPayload);
        if (error) throw error;
        messageApi.success('Thêm mới cảnh báo thay đổi Artwork thành công!');
      } else {
        const { error } = await supabase
          .from('awc_changes')
          .update(dbPayload)
          .eq('id', detailRow?.id);
        if (error) throw error;
        messageApi.success('Cập nhật thay đổi Artwork thành công!');
      }

      setDetailRow(null);
      queryClient.invalidateQueries({ queryKey: ['awc_changes'] });
    } catch (e: any) {
      if (e.errorFields) return; // Antd validation failed
      messageApi.error('Lỗi khi lưu Artwork Change: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete record
  const handleDelete = async (id: number) => {
    try {
      const { error } = await supabase.from('awc_changes').delete().eq('id', id);
      if (error) throw error;
      messageApi.success('Xóa bản ghi thay đổi Artwork thành công!');
      queryClient.invalidateQueries({ queryKey: ['awc_changes'] });
    } catch (e: any) {
      messageApi.error('Không thể xóa: ' + e.message);
    }
  };

  // Statistics from server total
  const stats = useMemo(() => {
    const total = totalCount;
    const alertingCount = rawData.filter(r => r.status === 'Alerted' || r.status === 'Pending 1st Batch').length;
    const verifiedCount = rawData.filter(r => r.status === 'Verified' || r.status === 'Closed').length;
    return { total, alertingCount, verifiedCount };
  }, [rawData, totalCount]);

  // Columns definition
  const columns: ColumnsType<AWCChange> = useMemo(() => {
    const rawCols: ColumnsType<AWCChange> = [
      {
        title: '#',
        key: 'stt',
        render: (_, __, idx) => (currentPage - 1) * pageSize + idx + 1,
        ...resizable('stt'),
      },
      {
        title: (
          <ColumnSearchHeader
            title="Mã Cảnh Báo AWC"
            dataKey="awc_code"
            filters={columnFilters}
            onFilterChange={handleColumnFilter}
            showFilters={showFilters}
          />
        ),
        dataIndex: 'awc_code',
        key: 'awc_code',
        render: (text) => <strong style={{ color: '#0d9488' }}>{text}</strong>,
        ...resizable('awc_code'),
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
              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{text}</span>
            </Tooltip>
          );
        },
        ...resizable('item_code'),
      },
      {
        title: (
          <ColumnSearchHeader
            title="Ngày Cảnh Báo"
            dataKey="notice_date"
            filters={columnFilters}
            onFilterChange={handleColumnFilter}
            showFilters={showFilters}
          />
        ),
        dataIndex: 'notice_date',
        key: 'notice_date',
        render: (date) => dayjs(date).format('DD/MM/YYYY'),
        ...resizable('notice_date'),
      },
      {
        title: (
          <ColumnSearchHeader
            title="Lô Dự Kiến"
            dataKey="expected_batch"
            filters={columnFilters}
            onFilterChange={handleColumnFilter}
            showFilters={showFilters}
          />
        ),
        dataIndex: 'expected_batch',
        key: 'expected_batch',
        ...resizable('expected_batch'),
      },
      {
        title: (
          <ColumnSearchHeader
            title="Lô Thực Tế"
            dataKey="actual_batch"
            filters={columnFilters}
            onFilterChange={handleColumnFilter}
            showFilters={showFilters}
          />
        ),
        dataIndex: 'actual_batch',
        key: 'actual_batch',
        render: (text) => text ? <Tag color="green">{text}</Tag> : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Chưa nhập hàng</span>,
        ...resizable('actual_batch'),
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
              title="Bạn chắc chắn muốn xóa bản ghi Artwork này?"
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
        if (col.key !== 'stt' && col.key !== 'actions' && col.key !== 'awc_code') {
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
            placeholder="Tìm mã AWC, sản phẩm, lô dự kiến..."
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
            Khai Báo Thay Đổi AW
          </Button>
        </div>
      </div>

      {/* Analytics Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(10px)', borderRadius: 12 }}>
            <Statistic
              title="Tổng Số Thay Đổi AW"
              value={stats.total}
              valueStyle={{ color: '#0f766e', fontWeight: 800 }}
              prefix={<Clipboard size={18} style={{ marginRight: 6 }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(10px)', borderRadius: 12 }}>
            <Statistic
              title="Đang Theo Dõi Lô Mới"
              value={stats.alertingCount}
              valueStyle={{ color: '#d97706', fontWeight: 800 }}
              prefix={<AlertTriangle size={18} style={{ marginRight: 6 }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(10px)', borderRadius: 12 }}>
            <Statistic
              title="Đã Kiểm Chứng / Lưu Trữ"
              value={stats.verifiedCount}
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
        title={isNew ? '📝 Khai Báo Thay Đổi Artwork Mới' : '🔍 Biên Tập Thay Đổi Artwork Bao Bì Gốc AWC'}
        placement="right"
        width={700}
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
              Lưu AWC
            </Button>
          </Space>
        }
      >
        {detailRow && (
          <Form form={form} layout="vertical" initialValues={detailRow}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Mã Thay Đổi AW (AWC Code)"
                  name="awc_code"
                  rules={[{ required: true, message: 'Nhập mã thay đổi' }]}
                >
                  <Input placeholder="Ví dụ: AWC-001-24" style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Trạng Thái Theo Dõi"
                  name="status"
                  rules={[{ required: true, message: 'Chọn trạng thái' }]}
                >
                  <Select options={STATUS_OPTIONS} style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
            </Row>

            <Divider orientation="left" style={{ fontSize: 13, color: '#0f766e', margin: '12px 0' }}>Sản Phẩm & Nhà Cung Cấp</Divider>

            <Form.Item
              label="Sản Phẩm Thay Đổi"
              name="item_code"
              rules={[{ required: true, message: 'Vui lòng chọn sản phẩm' }]}
            >
              <Select
                showSearch
                placeholder="Tìm mã hoặc tên sản phẩm..."
                options={masterItems.map(i => ({ value: i.item_code, label: `${i.item_code} - ${i.item_name}` }))}
                onChange={handleItemChange}
                optionFilterProp="label"
                disabled={!isNew}
                style={{ borderRadius: 6 }}
              />
            </Form.Item>

            <Row gutter={16}>
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
              <Col span={12}>
                <Form.Item label="Ngày Nhận Thông Báo (Notice Date)" name="notice_date" rules={[{ required: true, message: 'Chọn ngày thông báo' }]}>
                  <DatePicker format="DD/MM/YYYY" style={{ width: '100%', borderRadius: 6 }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label="Mã Sản Phẩm Mới (Nếu Hãng thay đổi SKU/Code sản phẩm mới)" name="new_item_code">
              <Select
                showSearch
                placeholder="Mã sản phẩm mới (nếu có)..."
                allowClear
                options={masterItems.map(i => ({ value: i.item_code, label: `${i.item_code} - ${i.item_name}` }))}
                optionFilterProp="label"
                style={{ borderRadius: 6 }}
              />
            </Form.Item>

            <Divider orientation="left" style={{ fontSize: 13, color: '#0f766e', margin: '20px 0 12px' }}>
              So Sánh Chi Tiết Thiết Kế Bao Bì (Old vs New)
            </Divider>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="Thông Tin Cấu Trúc Cũ" name="old_info">
                  <Input.TextArea rows={4} placeholder="Ví dụ: nhãn cũ có ghi hạn dùng 2 năm, xuất xứ Pháp..." style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Thông Tin Thay Đổi Mới" name="new_change_info">
                  <Input.TextArea rows={4} placeholder="Ví dụ: nhãn mới tăng hạn lên 3 năm, đổi nhà máy sản xuất sang Ý..." style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
            </Row>

            <Divider orientation="left" style={{ fontSize: 13, color: '#0f766e', margin: '20px 0 12px' }}>
              Theo Dõi Lô Hàng Đầu Tiên Áp Dụng
            </Divider>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="Số Lô Dự Kiến (Expected Batch)" name="expected_batch">
                  <Input placeholder="Lô dự kiến hãng thông báo..." style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Ngày Nhập Hàng Dự Kiến" name="estimated_receive">
                  <DatePicker format="DD/MM/YYYY" style={{ width: '100%', borderRadius: 6 }} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="Số Lô Thực Tế (Actual Batch)" name="actual_batch">
                  <Input placeholder="Số lô khi hàng thực tế về kho..." style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Ngày Nhập Hàng Thực Tế" name="actual_receive">
                  <DatePicker format="DD/MM/YYYY" style={{ width: '100%', borderRadius: 6 }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label="Đường dẫn minh chứng bao bì gốc mới (Link Drive/SharePoint)" name="evidence_url">
              <Input prefix={<Link size={14} color="#64748b" />} placeholder="Link hình ảnh bao bì cũ và mới..." style={{ borderRadius: 6 }} />
            </Form.Item>

            <Divider orientation="left" style={{ fontSize: 13, color: '#0f766e', margin: '20px 0 12px' }}>
              Đánh Giá Tác Động GxP
            </Divider>

            <Row gutter={16} style={{ marginBottom: 12 }}>
              <Col span={12}>
                <Form.Item name="requires_label_change" valuePropName="checked" noStyle>
                  <Space style={{ display: 'flex', padding: 8, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <input type="checkbox" id="lbl_change_chk" style={{ transform: 'scale(1.2)' }} />
                    <label htmlFor="lbl_change_chk" style={{ fontSize: 12, fontWeight: 500, color: '#1e293b', cursor: 'pointer' }}>
                      Cần thay đổi mẫu Thiết Kế Nhãn Phụ
                    </label>
                  </Space>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="dav_report_needed" valuePropName="checked" noStyle>
                  <Space style={{ display: 'flex', padding: 8, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <input type="checkbox" id="dav_report_chk" style={{ transform: 'scale(1.2)' }} />
                    <label htmlFor="dav_report_chk" style={{ fontSize: 12, fontWeight: 500, color: '#1e293b', cursor: 'pointer' }}>
                      Cần báo cáo Cục Quản Lý Dược (DAV)
                    </label>
                  </Space>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label="Ghi chú đánh giá tác động chi tiết" name="impact_notes">
              <Input.TextArea rows={2} placeholder="Hồ sơ DAV số mấy, cập nhật nhãn ở phiên bản nào..." style={{ borderRadius: 6 }} />
            </Form.Item>
          </Form>
        )}
      </Drawer>
    </div>
  );
}
