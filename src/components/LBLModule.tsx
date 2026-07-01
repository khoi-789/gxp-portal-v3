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
  Calendar, CheckCircle, Info, Save, Edit3, Link, Check, AlertCircle, Layers
} from 'lucide-react';
import { ColumnSearchHeader, applyColumnFilters } from '@/lib/columnSearch';
import TableControls, { ColumnConfig } from '@/components/TableControls';
import ResizableTitle from '@/components/ResizableTitle';
import { useTablePreferences } from '@/lib/useTablePreferences';
import dayjs from 'dayjs';
import { syncMasterData } from '@/lib/masterDataSync';
import { supabase } from '@/lib/supabase';
import { useMasterItems, useMasterSuppliers } from '@/lib/useMasterData';

/* ──────────────────────────────────────────────────
   Types
────────────────────────────────────────────────── */
export interface LBLLabel {
  id: number;
  item_code: string;
  product_category: string; // 'Thuốc' | 'TPCN' | 'TTBYT' | 'Mỹ phẩm'
  supplier_code: string;
  base_label_code: string; // Số mã hóa gốc (ví dụ: 00370)
  version_number: string; // Ver01, Ver02
  status: string; // 'Draft' | 'Active' | 'Obsolete'
  effective_date: string;
  change_reason: string | null;
  original_file_url: string | null;
  preview_image_url: string | null;
  created_at?: string;
}

const CATEGORY_OPTIONS = [
  { value: 'Thuốc', label: 'Thuốc' },
  { value: 'TPCN', label: 'Thực phẩm chức năng (TPCN)' },
  { value: 'TTBYT', label: 'Trang thiết bị y tế (TTBYT)' },
  { value: 'Mỹ phẩm', label: 'Mỹ phẩm' },
];

const STATUS_OPTIONS = [
  { value: 'Draft', label: 'Nháp (Draft)' },
  { value: 'Active', label: 'Hiệu Lực (Active)' },
  { value: 'Obsolete', label: 'Hết Hiệu Lực (Obsolete)' },
];

const STATUS_COLOR: Record<string, string> = {
  'Draft': 'blue',
  'Active': 'success',
  'Obsolete': 'default',
};

const DEFAULT_LBL_COLS: ColumnConfig[] = [
  { key: 'stt', label: 'STT', visible: true, fixed: true },
  { key: 'item_code', label: 'Mã Sản Phẩm', visible: true, fixed: true },
  { key: 'product_category', label: 'Phân Loại', visible: true },
  { key: 'base_label_code', label: 'Số Mã Hóa Gốc', visible: true },
  { key: 'version_number', label: 'Phiên Bản', visible: true },
  { key: 'status', label: 'Trạng Thái', visible: true },
  { key: 'effective_date', label: 'Ngày Hiệu Lực', visible: true },
  { key: 'supplier_code', label: 'Nhà Cung Cấp', visible: true },
  { key: 'actions', label: 'Thao Tác', visible: true, fixed: true },
];

const DEFAULT_LBL_WIDTHS: Record<string, number> = {
  stt: 50,
  item_code: 130,
  product_category: 140,
  base_label_code: 140,
  version_number: 100,
  status: 120,
  effective_date: 120,
  supplier_code: 140,
  actions: 80,
};

// ── Server-side fetch function ──
async function fetchLBLLabels(
  page: number,
  pageSize: number,
  search: string,
  filters: Record<string, string>
): Promise<{ items: LBLLabel[]; count: number }> {
  let query = supabase
    .from('lbl_labels')
    .select('*', { count: 'exact' });

  if (search.trim()) {
    const q = `%${search.trim()}%`;
    query = query.or(`item_code.ilike.${q},base_label_code.ilike.${q},version_number.ilike.${q},supplier_code.ilike.${q}`);
  }

  Object.entries(filters).forEach(([key, value]) => {
    if (!value || value.trim() === '') return;
    query = query.ilike(key, `%${value.trim()}%`);
  });

  query = query.order('effective_date', { ascending: false });
  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, count, error } = await query;
  if (error) throw new Error('Lỗi tải danh sách nhãn phụ: ' + error.message);
  return { items: (data || []) as LBLLabel[], count: count || 0 };
}

export default function LBLModule({ userId = 'default' }: { userId?: string }) {
  const [messageApi, contextHolder] = message.useMessage();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Master Data (load-all for dropdowns)
  const { data: masterItemsRaw = [] } = useMasterItems();
  const masterItems = useMemo(() => masterItemsRaw.filter(x => x.is_active), [masterItemsRaw]);

  const { data: masterSuppliers = [] } = useMasterSuppliers();

  // Server-side paginated table data
  const lblQueryKey = ['lbl_labels', currentPage, pageSize, globalSearch, columnFilters];
  const { data: lblResult, isLoading: loading, refetch: loadData } = useQuery({
    queryKey: lblQueryKey,
    queryFn: () => fetchLBLLabels(currentPage, pageSize, globalSearch, columnFilters),
    placeholderData: (prev) => prev,
  });

  const rawData = lblResult?.items || [];
  const totalCount = lblResult?.count || 0;

  // Drawer Form State
  const [detailRow, setDetailRow] = useState<LBLLabel | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form] = Form.useForm();

  const { prefs, save: savePrefs, setColumnWidth } = useTablePreferences(
    'lbl_labels_table_v1',
    userId,
    DEFAULT_LBL_COLS
  );

  const columnConfigs = prefs.columnConfigs;
  const showFilters = prefs.showFilters;
  const columnWidths = prefs.columnWidths;

  const w = (key: string) => columnWidths[key] ?? DEFAULT_LBL_WIDTHS[key] ?? 100;
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
  const handleOpenDrawer = (record?: LBLLabel) => {
    if (record) {
      setIsNew(false);
      setDetailRow(record);
      form.setFieldsValue({
        ...record,
        effective_date: record.effective_date ? dayjs(record.effective_date) : null,
      });
    } else {
      setIsNew(true);
      setDetailRow({
        id: 0,
        item_code: '',
        product_category: 'Thuốc',
        supplier_code: '',
        base_label_code: '',
        version_number: 'Ver01',
        status: 'Draft',
        effective_date: dayjs().format('YYYY-MM-DD'),
        change_reason: '',
        original_file_url: '',
        preview_image_url: '',
      });
      form.resetFields();
      form.setFieldsValue({
        product_category: 'Thuốc',
        version_number: 'Ver01',
        status: 'Draft',
        effective_date: dayjs(),
      });
    }
  };

  // Save changes to Supabase
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const dbPayload = {
        item_code: values.item_code,
        product_category: values.product_category,
        supplier_code: values.supplier_code,
        base_label_code: values.base_label_code,
        version_number: values.version_number,
        status: values.status,
        effective_date: values.effective_date ? values.effective_date.format('YYYY-MM-DD') : null,
        change_reason: values.change_reason || null,
        original_file_url: values.original_file_url || null,
        preview_image_url: values.preview_image_url || null,
      };

      // Enforce: only ONE active version per item_code at a time
      if (values.status === 'Active') {
        const { error: updateOldsError } = await supabase
          .from('lbl_labels')
          .update({ status: 'Obsolete' })
          .eq('item_code', values.item_code)
          .eq('status', 'Active');
        
        if (updateOldsError) {
          console.warn('Lỗi ghi đè trạng thái nhãn cũ:', updateOldsError.message);
        }
      }

      if (isNew) {
        const { error } = await supabase.from('lbl_labels').insert(dbPayload);
        if (error) throw error;
        messageApi.success('Thêm mới phiên bản nhãn phụ thành công!');
      } else {
        const { error } = await supabase
          .from('lbl_labels')
          .update(dbPayload)
          .eq('id', detailRow?.id);
        if (error) throw error;
        messageApi.success('Cập nhật phiên bản nhãn phụ thành công!');
      }

      setDetailRow(null);
      queryClient.invalidateQueries({ queryKey: ['lbl_labels'] });
    } catch (e: any) {
      if (e.errorFields) return; // Antd validation failed
      messageApi.error('Lỗi khi lưu nhãn phụ: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete record
  const handleDelete = async (id: number) => {
    try {
      const { error } = await supabase.from('lbl_labels').delete().eq('id', id);
      if (error) throw error;
      messageApi.success('Xóa nhãn phụ thành công!');
      queryClient.invalidateQueries({ queryKey: ['lbl_labels'] });
    } catch (e: any) {
      messageApi.error('Không thể xóa: ' + e.message);
    }
  };

  // Statistics from server total
  const stats = useMemo(() => {
    const total = totalCount;
    const activeCount = rawData.filter(r => r.status === 'Active').length;
    const draftCount = rawData.filter(r => r.status === 'Draft').length;
    return { total, activeCount, draftCount };
  }, [rawData, totalCount]);

  // Columns definition
  const columns: ColumnsType<LBLLabel> = useMemo(() => {
    const rawCols: ColumnsType<LBLLabel> = [
      {
        title: '#',
        key: 'stt',
        render: (_, __, idx) => (currentPage - 1) * pageSize + idx + 1,
        ...resizable('stt'),
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
        render: (text) => {
          const item = masterItems.find(i => i.item_code === text);
          return (
            <Tooltip title={item ? item.item_name : ''}>
              <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0d9488' }}>{text}</span>
            </Tooltip>
          );
        },
        ...resizable('item_code'),
      },
      {
        title: (
          <ColumnSearchHeader
            title="Phân Loại"
            dataKey="product_category"
            filters={columnFilters}
            onFilterChange={handleColumnFilter}
            showFilters={showFilters}
          />
        ),
        dataIndex: 'product_category',
        key: 'product_category',
        ...resizable('product_category'),
      },
      {
        title: (
          <ColumnSearchHeader
            title="Số Mã Hóa Gốc"
            dataKey="base_label_code"
            filters={columnFilters}
            onFilterChange={handleColumnFilter}
            showFilters={showFilters}
          />
        ),
        dataIndex: 'base_label_code',
        key: 'base_label_code',
        ...resizable('base_label_code'),
      },
      {
        title: (
          <ColumnSearchHeader
            title="Phiên Bản"
            dataKey="version_number"
            filters={columnFilters}
            onFilterChange={handleColumnFilter}
            showFilters={showFilters}
          />
        ),
        dataIndex: 'version_number',
        key: 'version_number',
        render: (text) => <span style={{ fontWeight: 600 }}>{text}</span>,
        ...resizable('version_number'),
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
            {status === 'Active' ? '● Hiệu Lực' : status === 'Draft' ? 'Nháp' : 'Hết Hạn'}
          </Tag>
        ),
        ...resizable('status'),
      },
      {
        title: (
          <ColumnSearchHeader
            title="Ngày Hiệu Lực"
            dataKey="effective_date"
            filters={columnFilters}
            onFilterChange={handleColumnFilter}
            showFilters={showFilters}
          />
        ),
        dataIndex: 'effective_date',
        key: 'effective_date',
        render: (date) => dayjs(date).format('DD/MM/YYYY'),
        ...resizable('effective_date'),
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
              title="Bạn chắc chắn muốn xóa phiên bản nhãn này?"
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
        if (col.key !== 'stt' && col.key !== 'actions' && col.key !== 'item_code') {
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
            placeholder="Tìm mã SP, số mã hóa, version..."
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
            Tạo Version Nhãn Mới
          </Button>
        </div>
      </div>

      {/* Analytics Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(10px)', borderRadius: 12 }}>
            <Statistic
              title="Tổng Bản Ghi Thiết Kế"
              value={stats.total}
              valueStyle={{ color: '#0f766e', fontWeight: 800 }}
              prefix={<FileText size={18} style={{ marginRight: 6 }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(10px)', borderRadius: 12 }}>
            <Statistic
              title="Số Bản Ghi Đang Hiệu Lực"
              value={stats.activeCount}
              valueStyle={{ color: '#16a34a', fontWeight: 800 }}
              prefix={<CheckCircle size={18} style={{ marginRight: 6 }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(10px)', borderRadius: 12 }}>
            <Statistic
              title="Bản Ghi Nháp (Draft)"
              value={stats.draftCount}
              valueStyle={{ color: '#2563eb', fontWeight: 800 }}
              prefix={<Layers size={18} style={{ marginRight: 6 }} />}
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
        title={isNew ? '📝 Tạo Phiên Bản Thiết Kế Nhãn Mới' : '🔍 Thiết Kế & Version Control Nhãn Phụ'}
        placement="right"
        width={650}
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
              Lưu Thiết Kế
            </Button>
          </Space>
        }
      >
        {detailRow && (
          <Form form={form} layout="vertical" initialValues={detailRow}>
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
                <Form.Item
                  label="Phân Loại Sản Phẩm"
                  name="product_category"
                  rules={[{ required: true, message: 'Chọn loại' }]}
                >
                  <Select options={CATEGORY_OPTIONS} style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Số Mã Hóa Gốc"
                  name="base_label_code"
                  rules={[{ required: true, message: 'Nhập số mã hóa gốc' }]}
                >
                  <Input placeholder="Ví dụ: 00370 hoặc mã DAV..." style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Số Phiên Bản (Version)"
                  name="version_number"
                  rules={[
                    { required: true, message: 'Nhập phiên bản' },
                    { pattern: /^Ver\d+$/, message: 'Định dạng bắt buộc: Ver01, Ver02...' }
                  ]}
                >
                  <Input placeholder="Ví dụ: Ver01" style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Trạng Thái Thiết Kế"
                  name="status"
                  rules={[{ required: true, message: 'Chọn trạng thái' }]}
                >
                  <Select options={STATUS_OPTIONS} style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Ngày Hiệu Lực"
                  name="effective_date"
                  rules={[{ required: true, message: 'Chọn ngày hiệu lực' }]}
                >
                  <DatePicker format="DD/MM/YYYY" style={{ width: '100%', borderRadius: 6 }} />
                </Form.Item>
              </Col>
            </Row>

            {/* Warning alert if active */}
            <Form.Item noStyle shouldUpdate={(prev, curr) => prev.status !== curr.status}>
              {({ getFieldValue }) => {
                const status = getFieldValue('status');
                if (status === 'Active') {
                  return (
                    <div style={{ marginBottom: 16, display: 'flex', gap: 6, padding: '8px 12px', background: '#fffbeb', borderRadius: 8, border: '1px solid #ffe4e6' }}>
                      <AlertCircle size={16} color="#d97706" style={{ marginTop: 2 }} />
                      <span style={{ fontSize: 11, color: '#b45309' }}>
                        <strong>Lưu ý:</strong> Đặt trạng thái hiệu lực (Active) cho phiên bản này sẽ tự động chuyển tất cả các phiên bản trước đó của sản phẩm này sang trạng thái hết hiệu lực (Obsolete).
                      </span>
                    </div>
                  );
                }
                return null;
              }}
            </Form.Item>

            <Form.Item label="Lý Do Thay Đổi (Audit Trail)" name="change_reason">
              <Input.TextArea rows={3} placeholder="Mô tả tóm tắt nội dung thay đổi thiết kế so với phiên bản trước..." style={{ borderRadius: 6 }} />
            </Form.Item>

            <Form.Item label="Link File Thiết Kế PDF/AI Gốc" name="original_file_url">
              <Input prefix={<Link size={14} color="#64748b" />} placeholder="Link Drive/SharePoint chứa thiết kế độ phân giải cao..." style={{ borderRadius: 6 }} />
            </Form.Item>

            <Form.Item label="Link Ảnh Xem Nhanh (Preview)" name="preview_image_url">
              <Input prefix={<Link size={14} color="#64748b" />} placeholder="Link ảnh xem trước nhanh (PNG/JPG)..." style={{ borderRadius: 6 }} />
            </Form.Item>
          </Form>
        )}
      </Drawer>
    </div>
  );
}
