'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Tag, Select, Space, Tooltip,
  Badge, Drawer, Form, InputNumber, message, Row, Col, Popconfirm,
  Spin, DatePicker, Card, Statistic, Divider, Switch
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  Search, RefreshCw, Trash2, Eye, AlertTriangle, Filter, Plus, FileText,
  Calendar, CheckCircle, Info, Save, Edit3, Link, Folder, Layers
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
export interface INTRecord {
  id: number;
  int_code: string;
  created_at?: string;
  category: string; // 'PAP' | 'Chuyển kho' | 'Nội bộ kho xử lý' | 'Yêu cầu hãng' | 'Khác'
  item_code: string;
  supplier_code: string;
  lot_number: string;
  exp_date: string;
  lpn_code: string;
  quantity: number;
  incident_content: string;
  handling_status: string; // 'Chờ xác định' | 'Chuyển bán' | 'Chuyển hủy' | 'Đơn chỉ định' | 'Xuất' | 'Khác'
  action_notes: string | null;
  ref_link: string | null;
  folder_url: string | null;
  is_in_stock: boolean;
  wms_doc_number: string | null;
}

const CATEGORY_OPTIONS = [
  { value: 'PAP', label: 'PAP' },
  { value: 'Chuyển kho', label: 'Chuyển kho' },
  { value: 'Nội bộ kho xử lý', label: 'Nội bộ kho xử lý' },
  { value: 'Yêu cầu hãng', label: 'Yêu cầu hãng' },
  { value: 'Khác', label: 'Khác' },
];

const HANDLING_OPTIONS = [
  { value: 'Chờ xác định', label: 'Chờ xác định' },
  { value: 'Chuyển bán', label: 'Chuyển bán' },
  { value: 'Chuyển hủy', label: 'Chuyển hủy' },
  { value: 'Đơn chỉ định', label: 'Đơn chỉ định' },
  { value: 'Xuất', label: 'Xuất' },
  { value: 'Khác', label: 'Khác' },
];

const HANDLING_COLOR: Record<string, string> = {
  'Chờ xác định': 'warning',
  'Chuyển bán': 'success',
  'Chuyển hủy': 'error',
  'Đơn chỉ định': 'purple',
  'Xuất': 'cyan',
  'Khác': 'default',
};

const DEFAULT_INT_COLS: ColumnConfig[] = [
  { key: 'stt', label: 'STT', visible: true, fixed: true },
  { key: 'int_code', label: 'Số Theo Dõi', visible: true, fixed: true },
  { key: 'category', label: 'Phân Loại', visible: true },
  { key: 'item_code', label: 'Sản Phẩm', visible: true },
  { key: 'lot_number', label: 'Số Lô', visible: true },
  { key: 'lpn_code', label: 'LPN', visible: true },
  { key: 'quantity', label: 'Số Lượng', visible: true },
  { key: 'handling_status', label: 'Tình Trạng', visible: true },
  { key: 'is_in_stock', label: 'Tồn Kho Vật Lý', visible: true },
  { key: 'actions', label: 'Thao Tác', visible: true, fixed: true },
];

const DEFAULT_INT_WIDTHS: Record<string, number> = {
  stt: 50,
  int_code: 140,
  category: 120,
  item_code: 120,
  lot_number: 110,
  lpn_code: 120,
  quantity: 90,
  handling_status: 140,
  is_in_stock: 120,
  actions: 80,
};

export default function INTModule({ userId = 'default' }: { userId?: string }) {
  const [messageApi, contextHolder] = message.useMessage();
  const [rawData, setRawData] = useState<INTRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Master Data
  const [masterItems, setMasterItems] = useState<any[]>([]);
  const [masterSuppliers, setMasterSuppliers] = useState<any[]>([]);

  // Drawer Form State
  const [detailRow, setDetailRow] = useState<INTRecord | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form] = Form.useForm();

  // Table configs
  const { prefs, save: savePrefs, setColumnWidth } = useTablePreferences(
    'int_records_table_v1',
    userId,
    DEFAULT_INT_COLS
  );

  const columnConfigs = prefs.columnConfigs;
  const showFilters = prefs.showFilters;
  const columnWidths = prefs.columnWidths;

  const w = (key: string) => columnWidths[key] ?? DEFAULT_INT_WIDTHS[key] ?? 100;
  const resizable = (key: string) => ({
    width: w(key),
    ellipsis: true,
    onHeaderCell: () => ({
      onResize: (width: number) => setColumnWidth(key, width),
    } as any),
  });

  // Load everything
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Master Items
      const { data: mItems } = await supabase
        .from('master_items')
        .select('item_code, item_name, supplier_code')
        .eq('is_active', true);
      setMasterItems(mItems || []);

      // 2. Fetch Master Suppliers
      const { data: mSuppliers } = await supabase
        .from('master_suppliers')
        .select('*')
        .order('supplier_code', { ascending: true });
      setMasterSuppliers(mSuppliers || []);

      // 3. Fetch INT Records
      const { data: records, error: iError } = await supabase
        .from('int_records')
        .select('*')
        .order('created_at', { ascending: false });

      if (iError) throw iError;
      setRawData(records || []);
    } catch (e: any) {
      messageApi.error('Lỗi tải dữ liệu INT: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle column filtering change
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
  const handleOpenDrawer = (record?: INTRecord) => {
    if (record) {
      setIsNew(false);
      setDetailRow(record);
      form.setFieldsValue({
        ...record,
        exp_date: record.exp_date ? dayjs(record.exp_date) : null,
      });
    } else {
      setIsNew(true);
      setDetailRow({
        id: 0,
        int_code: `INT-${dayjs().format('YYYY')}-${Math.floor(1000 + Math.random() * 9000)}`,
        category: 'PAP',
        item_code: '',
        supplier_code: '',
        lot_number: '',
        exp_date: '',
        lpn_code: '',
        quantity: 0,
        incident_content: '',
        handling_status: 'Chờ xác định',
        action_notes: '',
        ref_link: '',
        folder_url: '',
        is_in_stock: true,
        wms_doc_number: '',
      });
      form.resetFields();
      form.setFieldsValue({
        int_code: `INT-${dayjs().format('YYYY')}-${Math.floor(1000 + Math.random() * 9000)}`,
        category: 'PAP',
        handling_status: 'Chờ xác định',
        is_in_stock: true,
      });
    }
  };

  // Save changes to Supabase
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const dbPayload = {
        int_code: values.int_code,
        category: values.category,
        item_code: values.item_code,
        supplier_code: values.supplier_code,
        lot_number: values.lot_number,
        exp_date: values.exp_date ? values.exp_date.format('YYYY-MM-DD') : null,
        lpn_code: values.lpn_code,
        quantity: values.quantity,
        incident_content: values.incident_content,
        handling_status: values.handling_status,
        action_notes: values.action_notes || null,
        ref_link: values.ref_link || null,
        folder_url: values.folder_url || null,
        is_in_stock: !!values.is_in_stock,
        wms_doc_number: values.wms_doc_number || null,
      };

      if (isNew) {
        const { error } = await supabase.from('int_records').insert(dbPayload);
        if (error) throw error;
        messageApi.success('Thêm mới biên bản nội bộ INT thành công!');
      } else {
        const { error } = await supabase
          .from('int_records')
          .update(dbPayload)
          .eq('id', detailRow?.id);
        if (error) throw error;
        messageApi.success('Cập nhật biên bản nội bộ INT thành công!');
      }

      setDetailRow(null);
      loadData();
    } catch (e: any) {
      if (e.errorFields) return; // Antd validation failed
      messageApi.error('Lỗi khi lưu dữ liệu INT: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete record
  const handleDelete = async (id: number) => {
    try {
      const { error } = await supabase.from('int_records').delete().eq('id', id);
      if (error) throw error;
      messageApi.success('Xóa biên bản INT thành công!');
      loadData();
    } catch (e: any) {
      messageApi.error('Không thể xóa: ' + e.message);
    }
  };

  // Process data with filtering
  const processedData = useMemo(() => {
    let filtered = [...rawData];

    // Global Search
    if (globalSearch) {
      const searchLower = globalSearch.toLowerCase();
      filtered = filtered.filter(
        r =>
          r.int_code.toLowerCase().includes(searchLower) ||
          r.item_code.toLowerCase().includes(searchLower) ||
          r.lot_number.toLowerCase().includes(searchLower) ||
          r.lpn_code.toLowerCase().includes(searchLower) ||
          r.incident_content.toLowerCase().includes(searchLower)
      );
    }

    // Column Filters
    filtered = applyColumnFilters(filtered as any, columnFilters) as any;

    return filtered;
  }, [rawData, globalSearch, columnFilters]);

  // Statistics
  const stats = useMemo(() => {
    const total = processedData.length;
    const inStockCount = processedData.filter(r => r.is_in_stock).length;
    const resolvedCount = processedData.filter(r => r.handling_status === 'Chuyển bán' || r.handling_status === 'Chuyển hủy' || r.handling_status === 'Xuất').length;
    return { total, inStockCount, resolvedCount };
  }, [processedData]);

  // Columns definition
  const columns: ColumnsType<INTRecord> = useMemo(() => {
    const rawCols: ColumnsType<INTRecord> = [
      {
        title: '#',
        key: 'stt',
        render: (_, __, idx) => (currentPage - 1) * pageSize + idx + 1,
        ...resizable('stt'),
      },
      {
        title: (
          <ColumnSearchHeader
            title="Số Theo Dõi"
            dataKey="int_code"
            filters={columnFilters}
            onFilterChange={handleColumnFilter}
            showFilters={showFilters}
          />
        ),
        dataIndex: 'int_code',
        key: 'int_code',
        render: (text) => <strong style={{ color: '#0d9488' }}>{text}</strong>,
        ...resizable('int_code'),
      },
      {
        title: (
          <ColumnSearchHeader
            title="Phân Loại"
            dataKey="category"
            filters={columnFilters}
            onFilterChange={handleColumnFilter}
            showFilters={showFilters}
          />
        ),
        dataIndex: 'category',
        key: 'category',
        ...resizable('category'),
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
        render: (text) => {
          const item = masterItems.find(i => i.item_code === text);
          return (
            <Tooltip title={item ? item.item_name : ''}>
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
            title="Mã LPN"
            dataKey="lpn_code"
            filters={columnFilters}
            onFilterChange={handleColumnFilter}
            showFilters={showFilters}
          />
        ),
        dataIndex: 'lpn_code',
        key: 'lpn_code',
        render: (text) => <span style={{ fontFamily: 'monospace' }}>{text}</span>,
        ...resizable('lpn_code'),
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
        render: (val) => val.toLocaleString(),
        ...resizable('quantity'),
      },
      {
        title: (
          <ColumnSearchHeader
            title="Tình Trạng"
            dataKey="handling_status"
            filters={columnFilters}
            onFilterChange={handleColumnFilter}
            showFilters={showFilters}
          />
        ),
        dataIndex: 'handling_status',
        key: 'handling_status',
        render: (status) => (
          <Tag color={HANDLING_COLOR[status] || 'default'} style={{ fontWeight: 600 }}>
            {status}
          </Tag>
        ),
        ...resizable('handling_status'),
      },
      {
        title: (
          <ColumnSearchHeader
            title="Tồn Kho Vật Lý"
            dataKey="is_in_stock"
            filters={columnFilters}
            onFilterChange={handleColumnFilter}
            showFilters={showFilters}
          />
        ),
        dataIndex: 'is_in_stock',
        key: 'is_in_stock',
        render: (inStock) => (
          <Badge
            status={inStock ? 'success' : 'default'}
            text={inStock ? 'Còn tồn kho' : 'Không tồn kho'}
            style={{ fontWeight: 500 }}
          />
        ),
        ...resizable('is_in_stock'),
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
              title="Bạn chắc chắn muốn xóa biên bản INT này?"
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
        if (col.key !== 'stt' && col.key !== 'actions' && col.key !== 'int_code') {
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
            placeholder="Tìm số theo dõi, SP, lô, LPN..."
            value={globalSearch}
            onChange={e => setGlobalSearch(e.target.value)}
            style={{ width: 280, borderRadius: 8 }}
            prefix={<Search size={16} color="#64748b" />}
            allowClear
          />
          <Tooltip title="Tải lại dữ liệu">
            <Button
              type="text"
              onClick={loadData}
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
            Lập Biên Bản Mới
          </Button>
        </div>
      </div>

      {/* Analytics Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(10px)', borderRadius: 12 }}>
            <Statistic
              title="Tổng Biên Bản Nội Bộ"
              value={stats.total}
              valueStyle={{ color: '#0f766e', fontWeight: 800 }}
              prefix={<FileText size={18} style={{ marginRight: 6 }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(10px)', borderRadius: 12 }}>
            <Statistic
              title="Đang Tồn Kho Vật Lý"
              value={stats.inStockCount}
              valueStyle={{ color: '#d97706', fontWeight: 800 }}
              prefix={<Layers size={18} style={{ marginRight: 6 }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(10px)', borderRadius: 12 }}>
            <Statistic
              title="Đã Xử Lý Định Đoạt"
              value={stats.resolvedCount}
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
          dataSource={processedData}
          columns={columns}
          loading={loading}
          rowKey="id"
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            onChange: (p, s) => {
              setCurrentPage(p);
              setPageSize(s);
            },
            showSizeChanger: true,
            pageSizeOptions: ['5', '10', '20', '50'],
            style: { padding: '16px 24px', margin: 0 },
          }}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      {/* Detail/Add/Edit Drawer */}
      <Drawer
        title={isNew ? '📝 Lập Biên Bản Nội Bộ Mới' : '🔍 Biên Tập Biên Bản Nội Bộ INT'}
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
          <Form form={form} layout="vertical" initialValues={detailRow}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Số Theo Dõi (Biên bản)"
                  name="int_code"
                  rules={[{ required: true, message: 'Nhập số theo dõi' }]}
                >
                  <Input disabled placeholder="Mã tự động sinh" style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Phân Loại Biên Bản"
                  name="category"
                  rules={[{ required: true, message: 'Chọn phân loại' }]}
                >
                  <Select options={CATEGORY_OPTIONS} style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
            </Row>

            <Divider orientation="left" style={{ fontSize: 13, color: '#0f766e', margin: '12px 0' }}>Thông Tin Hàng Hóa & Vị Trí</Divider>

            <Form.Item
              label="Sản Phẩm Lưu Kho"
              name="item_code"
              rules={[{ required: true, message: 'Chọn sản phẩm' }]}
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
                  label="Số Lô (Batch Number)"
                  name="lot_number"
                  rules={[{ required: true, message: 'Nhập số lô' }]}
                >
                  <Input placeholder="Nhập số lô" style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Hạn Sử Dụng (EXP)"
                  name="exp_date"
                  rules={[{ required: true, message: 'Chọn hạn dùng' }]}
                >
                  <DatePicker format="DD/MM/YYYY" style={{ width: '100%', borderRadius: 6 }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Mã LPN (Pallet)"
                  name="lpn_code"
                  rules={[{ required: true, message: 'Nhập mã LPN' }]}
                >
                  <Input placeholder="Nhập mã LPN định danh" style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Số Lượng"
                  name="quantity"
                  rules={[{ required: true, message: 'Nhập số lượng' }]}
                >
                  <InputNumber min={1} style={{ width: '100%', borderRadius: 6 }} />
                </Form.Item>
              </Col>
              <Col span={12} style={{ display: 'flex', alignItems: 'center', paddingTop: 24 }}>
                <Form.Item name="is_in_stock" valuePropName="checked" noStyle>
                  <Switch checkedChildren="Còn tồn kho vật lý" unCheckedChildren="Đã xuất/hủy vật lý" />
                </Form.Item>
              </Col>
            </Row>

            <Divider orientation="left" style={{ fontSize: 13, color: '#0f766e', margin: '12px 0' }}>Sự Cố & Định Đoạt Xử Lý</Divider>

            <Form.Item
              label="Nội Dung Sự Cố / Yêu Cầu"
              name="incident_content"
              rules={[{ required: true, message: 'Vui lòng nhập nội dung sự cố' }]}
            >
              <Input.TextArea rows={3} placeholder="Mô tả sự cố xảy ra đối với pallet này..." style={{ borderRadius: 6 }} />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Tình Trạng Xử Lý (Quyết Định)"
                  name="handling_status"
                  rules={[{ required: true, message: 'Chọn hướng xử lý' }]}
                >
                  <Select options={HANDLING_OPTIONS} style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Chứng từ xuất/nhập WMS" name="wms_doc_number">
                  <Input placeholder="Nhập mã chứng từ WMS (nếu có)" style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label="Ghi Chú Hành Động Khắc Phục" name="action_notes">
              <Input.TextArea rows={2} placeholder="Chi tiết việc thực hiện dán lại nhãn, chuyển hủy..." style={{ borderRadius: 6 }} />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="Mã tham chiếu liên kết (BBSC/CC)" name="ref_link">
                  <Input prefix={<Link size={14} color="#64748b" />} placeholder="Ví dụ: BBSC-20260512-421" style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Link Thư mục Lưu Trữ Biên Bản" name="folder_url">
                  <Input prefix={<Folder size={14} color="#64748b" />} placeholder="Link OneDrive/SharePoint..." style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        )}
      </Drawer>
    </div>
  );
}
