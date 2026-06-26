'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Table, Button, Input, Tag, Select, Space, Tooltip,
  Badge, Drawer, Form, InputNumber, message, Row, Col, Popconfirm,
  Spin, DatePicker, Card, Statistic, Divider, Timeline, Checkbox
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  Search, RefreshCw, Trash2, Eye, AlertTriangle, Filter, Plus, FileText,
  Calendar, CheckCircle, Info, Save, Edit3, User, MapPin, Inbox, RefreshCcw
} from 'lucide-react';
import { ColumnSearchHeader, applyColumnFilters } from '@/lib/columnSearch';
import TableControls, { ColumnConfig } from '@/components/TableControls';
import ResizableTitle from '@/components/ResizableTitle';
import { useTablePreferences } from '@/lib/useTablePreferences';
import dayjs from 'dayjs';
import { supabase } from '@/lib/supabase';

/* ──────────────────────────────────────────────────
   Types
────────────────────────────────────────────────── */
export interface CCComplaint {
  id: number;
  cc_code: string;
  complaint_date: string;
  customer_name: string;
  customer_address: string | null;
  item_code: string;
  item_name?: string | null;
  supplier_code: string;
  lot_number: string;
  mfg_date: string | null;
  exp_date: string;
  unit: string;
  quantity: number;
  lpn_code: string | null;
  asn_number: string | null;
  complaint_reason: string;
  root_cause: string | null;
  status: string; // 'Khởi tạo' | 'Chờ Hãng xác nhận' | 'Đang xử lý' | 'Hoàn tất' | 'Hủy khiếu nại'
  is_info_secured: boolean;
  receive_method: string | null;
  supplier_action: string | null;
  received_date: string | null;
  samples_sent_to_supplier: string | null;
  created_at?: string;
}

const STATUS_OPTIONS = [
  { value: 'Khởi tạo', label: 'Khởi tạo' },
  { value: 'Chờ Hãng xác nhận', label: 'Chờ Hãng xác nhận' },
  { value: 'Đang xử lý', label: 'Đang xử lý' },
  { value: 'Hoàn tất', label: 'Hoàn tất' },
  { value: 'Hủy khiếu nại', label: 'Hủy khiếu nại' },
];

const STATUS_COLOR: Record<string, string> = {
  'Khởi tạo': 'blue',
  'Chờ Hãng xác nhận': 'warning',
  'Đang xử lý': 'purple',
  'Hoàn tất': 'success',
  'Hủy khiếu nại': 'default',
};

const RECEIVE_METHODS = [
  { value: 'Zalo', label: 'Zalo' },
  { value: 'Email', label: 'Email' },
  { value: 'Điện thoại', label: 'Điện thoại' },
  { value: 'Văn bản', label: 'Văn bản' },
  { value: 'Khác', label: 'Khác' },
];

const DEFAULT_CC_COLS: ColumnConfig[] = [
  { key: 'stt', label: 'STT', visible: true, fixed: true },
  { key: 'cc_code', label: 'Mã Khiếu Nại', visible: true, fixed: true },
  { key: 'complaint_date', label: 'Ngày Nhận', visible: true },
  { key: 'customer_name', label: 'Khách Hàng', visible: true },
  { key: 'item_code', label: 'Sản Phẩm', visible: true },
  { key: 'lot_number', label: 'Số Lô', visible: true },
  { key: 'quantity', label: 'Số Lượng', visible: true },
  { key: 'status', label: 'Trạng Thái', visible: true },
  { key: 'supplier_code', label: 'Nhà Cung Cấp', visible: true },
  { key: 'actions', label: 'Thao Tác', visible: true, fixed: true },
];

const DEFAULT_CC_WIDTHS: Record<string, number> = {
  stt: 50,
  cc_code: 150,
  complaint_date: 110,
  customer_name: 180,
  item_code: 120,
  lot_number: 110,
  quantity: 90,
  status: 150,
  supplier_code: 130,
  actions: 80,
};

// ── Server-side fetch function ──
async function fetchCCComplaints(
  page: number,
  pageSize: number,
  search: string,
  filters: Record<string, string>
): Promise<{ items: CCComplaint[]; count: number }> {
  let query = supabase
    .from('cc_complaints')
    .select('*', { count: 'exact' });

  if (search.trim()) {
    const q = `%${search.trim()}%`;
    query = query.or(`cc_code.ilike.${q},customer_name.ilike.${q},item_code.ilike.${q},lot_number.ilike.${q},complaint_reason.ilike.${q}`);
  }

  Object.entries(filters).forEach(([key, value]) => {
    if (!value || value.trim() === '') return;
    query = query.ilike(key, `%${value.trim()}%`);
  });

  query = query.order('complaint_date', { ascending: false });
  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, count, error } = await query;
  if (error) throw new Error('Lỗi tải dữ liệu CC: ' + error.message);
  return { items: (data || []) as CCComplaint[], count: count || 0 };
}

export default function CCModule({ userId = 'default' }: { userId?: string }) {
  const [messageApi, contextHolder] = message.useMessage();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Master Data (load-all for dropdowns)
  const { data: masterItems = [] } = useQuery({
    queryKey: ['master-items-dropdown'],
    queryFn: async () => {
      const { data } = await supabase.from('master_items').select('item_code, item_name, supplier_code').eq('is_active', true);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: masterSuppliers = [] } = useQuery({
    queryKey: ['master-suppliers-dropdown'],
    queryFn: async () => {
      const { data } = await supabase.from('master_suppliers').select('supplier_code, supplier_name').order('supplier_code', { ascending: true });
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Server-side paginated table data
  const ccQueryKey = ['cc_complaints', currentPage, pageSize, globalSearch, columnFilters];
  const { data: ccResult, isLoading: loading, refetch: loadData } = useQuery({
    queryKey: ccQueryKey,
    queryFn: () => fetchCCComplaints(currentPage, pageSize, globalSearch, columnFilters),
    placeholderData: (prev) => prev,
  });

  const rawData = ccResult?.items || [];
  const totalCount = ccResult?.count || 0;

  // Drawer Form State
  const [detailRow, setDetailRow] = useState<CCComplaint | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form] = Form.useForm();

  const { prefs, save: savePrefs, setColumnWidth } = useTablePreferences(
    'cc_complaints_table_v1',
    userId,
    DEFAULT_CC_COLS
  );

  const columnConfigs = prefs.columnConfigs;
  const showFilters = prefs.showFilters;
  const columnWidths = prefs.columnWidths;

  const w = (key: string) => columnWidths[key] ?? DEFAULT_CC_WIDTHS[key] ?? 100;
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
  const handleOpenDrawer = (record?: CCComplaint) => {
    if (record) {
      setIsNew(false);
      setDetailRow(record);
      form.setFieldsValue({
        ...record,
        complaint_date: record.complaint_date ? dayjs(record.complaint_date) : null,
        mfg_date: record.mfg_date ? dayjs(record.mfg_date) : null,
        exp_date: record.exp_date ? dayjs(record.exp_date) : null,
        received_date: record.received_date ? dayjs(record.received_date) : null,
      });
    } else {
      setIsNew(true);
      setDetailRow({
        id: 0,
        cc_code: `CC-${dayjs().format('YYMMDD')}-${Math.floor(100 + Math.random() * 900)}`,
        complaint_date: dayjs().format('YYYY-MM-DD'),
        customer_name: '',
        customer_address: '',
        item_code: '',
        supplier_code: '',
        lot_number: '',
        mfg_date: null,
        exp_date: '',
        unit: 'Hộp',
        quantity: 0,
        lpn_code: '',
        asn_number: '',
        complaint_reason: '',
        root_cause: '',
        status: 'Khởi tạo',
        is_info_secured: false,
        receive_method: 'Email',
        supplier_action: '',
        received_date: null,
        samples_sent_to_supplier: '',
      });
      form.resetFields();
      form.setFieldsValue({
        cc_code: `CC-${dayjs().format('YYMMDD')}-${Math.floor(100 + Math.random() * 900)}`,
        complaint_date: dayjs(),
        status: 'Khởi tạo',
        unit: 'Hộp',
        receive_method: 'Email',
        is_info_secured: false,
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
        cc_code: values.cc_code,
        complaint_date: values.complaint_date ? values.complaint_date.format('YYYY-MM-DD') : null,
        customer_name: values.customer_name,
        customer_address: values.customer_address || null,
        item_code: values.item_code,
        item_name: selectedItem ? selectedItem.item_name : (detailRow?.item_name || null),
        supplier_code: values.supplier_code,
        lot_number: values.lot_number,
        mfg_date: values.mfg_date ? values.mfg_date.format('YYYY-MM-DD') : null,
        exp_date: values.exp_date ? values.exp_date.format('YYYY-MM-DD') : null,
        unit: values.unit,
        quantity: values.quantity,
        lpn_code: values.lpn_code || null,
        asn_number: values.asn_number || null,
        complaint_reason: values.complaint_reason,
        root_cause: values.root_cause || null,
        status: values.status,
        is_info_secured: !!values.is_info_secured,
        receive_method: values.receive_method || null,
        supplier_action: values.supplier_action || null,
        received_date: values.received_date ? values.received_date.format('YYYY-MM-DD') : null,
        samples_sent_to_supplier: values.samples_sent_to_supplier || null,
      };

      if (isNew) {
        const { error } = await supabase.from('cc_complaints').insert(dbPayload);
        if (error) throw error;
        messageApi.success('Thêm mới khiếu nại khách hàng CC thành công!');
      } else {
        const { error } = await supabase
          .from('cc_complaints')
          .update(dbPayload)
          .eq('id', detailRow?.id);
        if (error) throw error;
        messageApi.success('Cập nhật khiếu nại khách hàng CC thành công!');
      }

      setDetailRow(null);
      queryClient.invalidateQueries({ queryKey: ['cc_complaints'] });
    } catch (e: any) {
      if (e.errorFields) return; // Antd validation failed
      messageApi.error('Lỗi khi lưu dữ liệu CC: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete record
  const handleDelete = async (id: number) => {
    try {
      const { error } = await supabase.from('cc_complaints').delete().eq('id', id);
      if (error) throw error;
      messageApi.success('Xóa khiếu nại CC thành công!');
      queryClient.invalidateQueries({ queryKey: ['cc_complaints'] });
    } catch (e: any) {
      messageApi.error('Không thể xóa: ' + e.message);
    }
  };

  // Statistics from server total
  const stats = useMemo(() => {
    const total = totalCount;
    const pending = rawData.filter(r => r.status === 'Khởi tạo' || r.status === 'Chờ Hãng xác nhận').length;
    const completed = rawData.filter(r => r.status === 'Hoàn tất').length;
    return { total, pending, completed };
  }, [rawData, totalCount]);

  // Columns definition
  const columns: ColumnsType<CCComplaint> = useMemo(() => {
    const rawCols: ColumnsType<CCComplaint> = [
      {
        title: '#',
        key: 'stt',
        render: (_, __, idx) => (currentPage - 1) * pageSize + idx + 1,
        ...resizable('stt'),
      },
      {
        title: (
          <ColumnSearchHeader
            title="Mã Khiếu Nại"
            dataKey="cc_code"
            filters={columnFilters}
            onFilterChange={handleColumnFilter}
            showFilters={showFilters}
          />
        ),
        dataIndex: 'cc_code',
        key: 'cc_code',
        render: (text) => <strong style={{ color: '#0d9488' }}>{text}</strong>,
        ...resizable('cc_code'),
      },
      {
        title: (
          <ColumnSearchHeader
            title="Ngày Nhận"
            dataKey="complaint_date"
            filters={columnFilters}
            onFilterChange={handleColumnFilter}
            showFilters={showFilters}
          />
        ),
        dataIndex: 'complaint_date',
        key: 'complaint_date',
        render: (date) => dayjs(date).format('DD/MM/YYYY'),
        ...resizable('complaint_date'),
      },
      {
        title: (
          <ColumnSearchHeader
            title="Khách Hàng"
            dataKey="customer_name"
            filters={columnFilters}
            onFilterChange={handleColumnFilter}
            showFilters={showFilters}
          />
        ),
        dataIndex: 'customer_name',
        key: 'customer_name',
        ...resizable('customer_name'),
        render: (text: string) => {
          const display = text && text.length > 50 ? `${text.substring(0, 50)}...` : text;
          return <Tooltip title={text}>{display || '—'}</Tooltip>;
        },
      },
      {
        title: (
          <ColumnSearchHeader
            title="Sản Phẩm"
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
            title="Số Lượng"
            dataKey="quantity"
            filters={columnFilters}
            onFilterChange={handleColumnFilter}
            showFilters={showFilters}
          />
        ),
        dataIndex: 'quantity',
        key: 'quantity',
        render: (val, r) => `${val.toLocaleString()} ${r.unit}`,
        ...resizable('quantity'),
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
            <Tooltip title="Xem & Biên tập">
              <Button
                type="text"
                size="small"
                onClick={() => handleOpenDrawer(r)}
                icon={<Edit3 size={15} color="#0d9488" />}
              />
            </Tooltip>
            <Popconfirm
              title="Bạn chắc chắn muốn xóa khiếu nại CC này?"
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
        if (col.key !== 'stt' && col.key !== 'actions' && col.key !== 'cc_code') {
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

  // Generate Timeline Items for detail view
  const timelineItems = useMemo(() => {
    if (!detailRow || isNew) return [];

    const items = [];
    items.push({
      color: 'green',
      children: (
        <div>
          <p style={{ fontWeight: 600, margin: '0 0 4px' }}>
            Khởi tạo khiếu nại từ khách hàng: {dayjs(detailRow.complaint_date).format('DD/MM/YYYY')}
          </p>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            Nhận qua <strong>{detailRow.receive_method}</strong>. Người liên hệ: {detailRow.customer_name}
          </span>
        </div>
      ),
    });

    if (detailRow.samples_sent_to_supplier) {
      items.push({
        color: 'blue',
        children: (
          <div>
            <p style={{ fontWeight: 600, margin: '0 0 4px' }}>Gửi mẫu điều tra sang hãng</p>
            <span style={{ fontSize: 12, color: '#64748b' }}>Ngày thực hiện: {detailRow.samples_sent_to_supplier}</span>
          </div>
        ),
      });
    }

    if (detailRow.received_date) {
      items.push({
        color: 'orange',
        children: (
          <div>
            <p style={{ fontWeight: 600, margin: '0 0 4px' }}>Nhận phản hồi/kết quả từ hãng</p>
            <span style={{ fontSize: 12, color: '#64748b' }}>Ngày nhận: {dayjs(detailRow.received_date).format('DD/MM/YYYY')}</span>
          </div>
        ),
      });
    }

    if (detailRow.status === 'Hoàn tất') {
      items.push({
        color: 'green',
        children: (
          <div>
            <p style={{ fontWeight: 600, margin: '0 0 4px', color: '#16a34a' }}>Đã hoàn tất khiếu nại</p>
            <span style={{ fontSize: 12, color: '#64748b' }}>Nguyên nhân xác định: {detailRow.root_cause || 'Chưa cập nhật nguyên nhân'}</span>
          </div>
        ),
      });
    } else if (detailRow.status === 'Hủy khiếu nại') {
      items.push({
        color: 'gray',
        children: (
          <div>
            <p style={{ fontWeight: 600, margin: '0 0 4px', color: '#64748b' }}>Hủy khiếu nại</p>
            <span style={{ fontSize: 12, color: '#64748b' }}>Lý do hủy/rút khiếu nại từ khách hàng.</span>
          </div>
        ),
      });
    } else {
      items.push({
        color: 'red',
        children: (
          <div>
            <p style={{ fontWeight: 600, margin: '0 0 4px' }}>Hiện tại: {detailRow.status}</p>
            <span style={{ fontSize: 12, color: '#64748b' }}>Hành động tiếp theo: {detailRow.supplier_action || 'Chờ cập nhật bước kế tiếp'}</span>
          </div>
        ),
      });
    }

    return items;
  }, [detailRow, isNew]);

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
            placeholder="Tìm mã CC, khách hàng, lô, sản phẩm..."
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
            Tiếp Nhận COMP Mới
          </Button>
        </div>
      </div>

      {/* Analytics Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(10px)', borderRadius: 12 }}>
            <Statistic
              title="Tổng Số Khiếu Nại CC"
              value={stats.total}
              valueStyle={{ color: '#0f766e', fontWeight: 800 }}
              prefix={<Inbox size={18} style={{ marginRight: 6 }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(10px)', borderRadius: 12 }}>
            <Statistic
              title="Chờ Xác Nhận / Đang Điều Tra"
              value={stats.pending}
              valueStyle={{ color: '#d97706', fontWeight: 800 }}
              prefix={<AlertTriangle size={18} style={{ marginRight: 6 }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(10px)', borderRadius: 12 }}>
            <Statistic
              title="Đã Hoàn Tất"
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
        title={isNew ? '📝 Tiếp Nhận Khiếu Nại CC Mới' : '🔍 Biên Tập Khiếu Nại Khách Hàng CC'}
        placement="right"
        width={720}
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
              Lưu Khiếu Nại
            </Button>
          </Space>
        }
      >
        {detailRow && (
          <Form form={form} layout="vertical" initialValues={detailRow}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Mã Khiếu Nại"
                  name="cc_code"
                  rules={[{ required: true, message: 'Nhập mã khiếu nại' }]}
                >
                  <Input disabled placeholder="Mã tự động sinh" style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Trạng Thái Khiếu Nại"
                  name="status"
                  rules={[{ required: true, message: 'Chọn trạng thái' }]}
                >
                  <Select options={STATUS_OPTIONS} style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
            </Row>

            <Divider orientation="left" style={{ fontSize: 13, color: '#0f766e', margin: '12px 0' }}>Thông Tin Khách Hàng</Divider>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Tên Bệnh Viện / Khách Hàng"
                  name="customer_name"
                  rules={[{ required: true, message: 'Nhập tên khách hàng' }]}
                >
                  <Input prefix={<User size={14} color="#64748b" />} placeholder="Nhập tên khách hàng" style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Ngày Tiếp Nhận" name="complaint_date" rules={[{ required: true, message: 'Chọn ngày tiếp nhận' }]}>
                  <DatePicker format="DD/MM/YYYY" style={{ width: '100%', borderRadius: 6 }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label="Địa Chỉ Khách Hàng" name="customer_address">
              <Input prefix={<MapPin size={14} color="#64748b" />} placeholder="Địa chỉ chi tiết khách hàng..." style={{ borderRadius: 6 }} />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="Phương Thức Nhận" name="receive_method">
                  <Select options={RECEIVE_METHODS} style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
              <Col span={12} style={{ display: 'flex', alignItems: 'center', paddingTop: 24 }}>
                <Form.Item name="is_info_secured" valuePropName="checked" noStyle>
                  <Checkbox>Bảo mật thông tin khách hàng (Secure)</Checkbox>
                </Form.Item>
              </Col>
            </Row>

            <Divider orientation="left" style={{ fontSize: 13, color: '#0f766e', margin: '12px 0' }}>Thông Tin Sản Phẩm Khiếu Nại</Divider>

            <Form.Item
              label="Sản Phẩm Khiếu Nại"
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
                  label="Nhà Cung Cấp"
                  name="supplier_code"
                  rules={[{ required: true, message: 'Chọn nhà cung cấp' }]}
                >
                  <Select
                    showSearch
                    placeholder="Chọn nhà cung cấp"
                    options={masterSuppliers.map(s => ({ value: s.supplier_code, label: `${s.supplier_code} - ${s.supplier_name}` }))}
                    optionFilterProp="label"
                    style={{ borderRadius: 6 }}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Số Lô (Lot Number)"
                  name="lot_number"
                  rules={[{ required: true, message: 'Nhập số lô' }]}
                >
                  <Input placeholder="Nhập số lô" style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="Ngày Sản Xuất (MFG)" name="mfg_date">
                  <DatePicker format="DD/MM/YYYY" style={{ width: '100%', borderRadius: 6 }} />
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
                <Form.Item label="Đơn Vị Tính" name="unit" rules={[{ required: true, message: 'ĐVT' }]}>
                  <Select
                    options={[
                      { value: 'Hộp', label: 'Hộp' },
                      { value: 'Chai', label: 'Chai' },
                      { value: 'Bút', label: 'Bút' },
                      { value: 'Cái', label: 'Cái' },
                    ]}
                    style={{ borderRadius: 6 }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Mã LPN" name="lpn_code">
                  <Input placeholder="Mã LPN (nếu có)" style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label="Số ASN Nhập Kho" name="asn_number">
              <Input placeholder="Mã ASN nhận hàng từ Infor..." style={{ borderRadius: 6 }} />
            </Form.Item>

            <Divider orientation="left" style={{ fontSize: 13, color: '#0f766e', margin: '12px 0' }}>Nội Dung Khiếu Nại & Điều Tra</Divider>

            <Form.Item
              label="Lý Do Khiếu Nại (Ý kiến Khách hàng)"
              name="complaint_reason"
              rules={[{ required: true, message: 'Vui lòng nhập nội dung khiếu nại' }]}
            >
              <Input.TextArea rows={3} placeholder="Lý do khách hàng phàn nàn..." style={{ borderRadius: 6 }} />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="Ngày Gửi Mẫu Cho Hãng" name="samples_sent_to_supplier">
                  <Input placeholder="Ví dụ: 15/04/2026 hoặc đã gửi..." style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Ngày Nhận Phản Hồi Từ Hãng" name="received_date">
                  <DatePicker format="DD/MM/YYYY" style={{ width: '100%', borderRadius: 6 }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label="Hành Động Của Hãng / Nhà Cung Cấp" name="supplier_action">
              <Input.TextArea rows={2} placeholder="Hãng đồng ý đổi hàng hay yêu cầu tiêu hủy..." style={{ borderRadius: 6 }} />
            </Form.Item>

            <Form.Item label="Nguyên Nhân Gốc (Root Cause)" name="root_cause">
              <Input.TextArea rows={3} placeholder="Phân tích nguyên nhân lỗi (do sản xuất, đóng gói, bảo quản, vận chuyển...)" style={{ borderRadius: 6 }} />
            </Form.Item>

            {!isNew && timelineItems.length > 0 && (
              <>
                <Divider orientation="left" style={{ fontSize: 13, color: '#0f766e', margin: '12px 0' }}>Trực Quan Lịch Trình (Timeline)</Divider>
                <Timeline items={timelineItems} style={{ marginTop: 12, paddingLeft: 12 }} />
              </>
            )}
          </Form>
        )}
      </Drawer>
    </div>
  );
}
