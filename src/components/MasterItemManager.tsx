'use client';

import { useState, useMemo } from 'react';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table, Button, Drawer, Input, Form, Switch, Tag, Space,
  Popconfirm, message, Tooltip, Badge, Empty, InputNumber, Row, Col,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MasterItem } from '@/lib/types';
import { MOCK_MASTER_ITEMS } from '@/lib/mockData';
import { ColumnSearchHeader, applyColumnFilters } from '@/lib/columnSearch';
import TableControls, { ColumnConfig } from '@/components/TableControls';
import ResizableTitle from '@/components/ResizableTitle';
import { useTablePreferences } from '@/lib/useTablePreferences';
import {
  Plus, Search, Edit3, Trash2, Package, RefreshCw,
  CheckCircle, XCircle, AlertTriangle,
} from 'lucide-react';

/**
 * URS §4.3: <MasterItemManager>
 * - Màn hình CRUD cho Admin quản lý danh mục INFOR/SAP
 * - Ant Design <Table> với Pagination + Search theo item_code
 * - Thêm/Sửa dùng <Drawer> + react-hook-form + zod validation
 * - Bắt buộc nhập: item_code và item_name
 */

// ──────────────────────────────────────────────────────────
// URS §4.3: Zod Schema Validation
// ──────────────────────────────────────────────────────────
const masterItemSchema = z.object({
  item_code: z
    .string()
    .min(1, 'Bắt buộc nhập Mã sản phẩm')
    .min(3, 'Mã sản phẩm phải có ít nhất 3 ký tự')
    .regex(/^[A-Za-z0-9]+$/, 'Chỉ được dùng chữ cái và số'),
  item_name: z
    .string()
    .min(1, 'Bắt buộc nhập Tên sản phẩm')
    .min(5, 'Tên sản phẩm phải có ít nhất 5 ký tự'),
  supplier_code: z.string().min(1, 'Bắt buộc nhập Mã nhà cung cấp'),
  visa_no: z.string().optional().or(z.literal('')),
  is_active: z.boolean(),
  gross_weight: z.number().optional().default(0),
  net_weight: z.number().optional().default(0),
  cube: z.number().optional().default(0),
  tare_weight: z.number().optional().default(0),
  pallet_qty: z.number().optional().default(0),
  case_qty: z.number().optional().default(0),
  inner_pack: z.number().optional().default(0),
});

type MasterItemFormData = z.infer<typeof masterItemSchema>;

// ──────────────────────────────────────────────────────────
// Mock CRUD functions (thay bằng Supabase thật sau)
// ──────────────────────────────────────────────────────────
let mockDb = [...MOCK_MASTER_ITEMS];
let isInitialized = false;

// Đồng bộ dữ liệu ra phạm vi global để các module khác (VD: Destruction) có thể dùng chung
const syncGlobal = () => {
  if (typeof window !== 'undefined') {
    (window as any)._masterItemsMock = mockDb;
    // Lưu vào LocalStorage để không bị mất khi Refresh trang
    localStorage.setItem('gxpportal_master_items', JSON.stringify(mockDb));
  }
};

async function fetchMasterItems(): Promise<MasterItem[]> {
  if (isInitialized) return mockDb;

  // Thử đọc từ LocalStorage trước
  const saved = typeof window !== 'undefined' ? localStorage.getItem('gxpportal_master_items') : null;
  if (saved) {
    try {
      mockDb = JSON.parse(saved);
      isInitialized = true;
      syncGlobal();
      return mockDb;
    } catch (e) { console.error('Failed to parse saved master items', e); }
  }

  try {
    const res = await fetch('/master-data.json');
    if (!res.ok) throw new Error('Failed to load master data');
    const json = await res.json();
    // Đồng bộ mockDb với dữ liệu từ file JSON để các hàm update/delete hoạt động đúng
    mockDb = json.items; 
    isInitialized = true;
    syncGlobal();
    return mockDb;
  } catch (err) {
    console.warn('Fallback to mock data:', err);
    return mockDb;
  }
}

async function createMasterItem(data: MasterItemFormData): Promise<MasterItem> {
  await new Promise((r) => setTimeout(r, 500));
  const newItem: MasterItem = {
    item_code: data.item_code.toUpperCase(),
    item_name: data.item_name,
    supplier_code: data.supplier_code,
    visa_no: data.visa_no || null,
    is_active: data.is_active,
    gross_weight: data.gross_weight,
    net_weight: data.net_weight,
    cube: data.cube,
    tare_weight: data.tare_weight,
    pallet_qty: data.pallet_qty,
    case_qty: data.case_qty,
    inner_pack: data.inner_pack,
    updated_at: dayjs().format('DD/MM/YYYY HH:mm:ss'),
  };
  if (mockDb.find((i) => i.item_code === newItem.item_code)) {
    throw new Error('Mã sản phẩm đã tồn tại!');
  }
  mockDb = [...mockDb, newItem];
  return newItem;
}

async function updateMasterItem(item_code: string, data: Partial<MasterItemFormData>): Promise<MasterItem> {
  await new Promise((r) => setTimeout(r, 400));
  const idx = mockDb.findIndex((i) => i.item_code === item_code);
  if (idx < 0) throw new Error('Không tìm thấy sản phẩm');
  const now = dayjs().format('DD/MM/YYYY HH:mm:ss');
  const updated = { ...mockDb[idx], ...data, visa_no: data.visa_no || null, updated_at: now };
  mockDb = [...mockDb.slice(0, idx), updated, ...mockDb.slice(idx + 1)];
  syncGlobal();
  return updated;
}

async function deleteMasterItem(item_code: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 400));
  mockDb = mockDb.filter((i) => i.item_code !== item_code);
}

// Default column configs
const DEFAULT_MASTER_COLS: ColumnConfig[] = [
  { key: 'item_code',    label: 'Mã SP',         visible: true, fixed: true },
  { key: 'item_name',    label: 'Tên sản phẩm', visible: true },
  { key: 'gross_weight', label: 'Gross Weight',  visible: true },
  { key: 'inner_pack',   label: 'Inner',          visible: true },
  { key: 'case_qty',     label: 'Case',           visible: true },
  { key: 'is_active',    label: 'Trạng thái',   visible: true },
  { key: 'updated_at',   label: 'Cập nhật lần cuối', visible: true },
  { key: 'actions',      label: 'Thao tác',       visible: true, fixed: true },
];

// Default column widths
const DEFAULT_WIDTHS: Record<string, number> = {
  item_code: 156, item_name: 280, gross_weight: 110,
  inner_pack: 80, case_qty: 80, pallet_qty: 80,
  is_active: 120, updated_at: 160, actions: 110,
};

// ──────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────
export default function MasterItemManager({ userId = 'default' }: { userId?: string }) {
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();

  const [searchText, setSearchText] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterItem | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  // ── Per-user persistent preferences ──
  const { prefs, save, setColumnWidth } = useTablePreferences(
    'master-items', userId, DEFAULT_MASTER_COLS,
  );
  const { columnConfigs, showFilters, columnWidths } = prefs;

  const handleColumnFilter = (key: string, value: string) => {
    setColumnFilters(prev => ({ ...prev, [key]: value }));
  };

  // ── TanStack Query ──
  const { data: items = [], isLoading, refetch } = useQuery<MasterItem[]>({
    queryKey: ['master_items'],
    queryFn: fetchMasterItems,
  });

  const createMutation = useMutation({
    mutationFn: createMasterItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master_items'] });
      messageApi.success('Thêm sản phẩm thành công!');
      setDrawerOpen(false);
    },
    onError: (err: Error) => messageApi.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ code, data }: { code: string; data: Partial<MasterItemFormData> }) =>
      updateMasterItem(code, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master_items'] });
      messageApi.success('Cập nhật thành công!');
      setDrawerOpen(false);
    },
    onError: (err: Error) => messageApi.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMasterItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master_items'] });
      messageApi.success('Đã xóa sản phẩm!');
    },
    onError: (err: Error) => messageApi.error(err.message),
  });

  // ── react-hook-form + zod ──
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MasterItemFormData>({
    resolver: zodResolver(masterItemSchema),
    defaultValues: {
      item_code: '',
      item_name: '',
      supplier_code: '',
      visa_no: '',
      is_active: true,
      gross_weight: 0,
      net_weight: 0,
      cube: 0,
      tare_weight: 0,
      pallet_qty: 0,
      case_qty: 0,
      inner_pack: 0,
    },
  });

  const openDrawerForCreate = () => {
    setEditingItem(null);
    reset({
      item_code: '',
      item_name: '',
      supplier_code: '',
      visa_no: '',
      is_active: true,
      gross_weight: 0,
      net_weight: 0,
      cube: 0,
      tare_weight: 0,
      pallet_qty: 0,
      case_qty: 0,
      inner_pack: 0,
    });
    setDrawerOpen(true);
  };

  const openDrawerForEdit = (item: MasterItem) => {
    setEditingItem(item);
    reset({
      item_code: item.item_code,
      item_name: item.item_name,
      supplier_code: item.supplier_code,
      visa_no: item.visa_no ?? '',
      is_active: item.is_active,
      gross_weight: item.gross_weight ?? 0,
      net_weight: item.net_weight ?? 0,
      cube: item.cube ?? 0,
      tare_weight: item.tare_weight ?? 0,
      pallet_qty: item.pallet_qty ?? 0,
      case_qty: item.case_qty ?? 0,
      inner_pack: item.inner_pack ?? 0,
    });
    setDrawerOpen(true);
  };

  const onSubmit = (data: MasterItemFormData) => {
    if (editingItem) {
      updateMutation.mutate({ code: editingItem.item_code, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // ── Search Filter (global + per-column) ──
  const filteredItems = useMemo(() => {
    let list = items;
    // Global search bar
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(
        (i) =>
          i.item_code.toLowerCase().includes(q) ||
          i.item_name.toLowerCase().includes(q)
      );
    }
    // Per-column filters with wildcard support
    const activeColFilters = Object.fromEntries(
      Object.entries(columnFilters).filter(([, v]) => v.trim() !== '')
    );
    if (Object.keys(activeColFilters).length > 0) {
      list = applyColumnFilters(list as unknown as Record<string, unknown>[], activeColFilters) as unknown as MasterItem[];
    }
    return list;
  }, [items, searchText, columnFilters]);

  // ── Column width helper ──
  const w = (key: string) => columnWidths[key] ?? DEFAULT_WIDTHS[key];

  // ── onHeaderCell factory: enables resize + ResizableTitle ──
  const resizable = (key: string) => ({
    onResize: (width: number) => setColumnWidth(key, width),
    style: { width: w(key) },
  });

  // ── Ant Design Table Columns (base definitions) ──
  const allColumnDefs: Record<string, object> = {
    item_code: {
      title: <ColumnSearchHeader title="Mã SP" dataKey="item_code" filters={columnFilters} onFilterChange={handleColumnFilter} showFilters={showFilters} />,
      dataIndex: 'item_code', key: 'item_code',
      width: w('item_code'), fixed: 'left' as const, ellipsis: true,
      onHeaderCell: () => resizable('item_code'),
      render: (code: string) => (
        <code style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0d9488', background: '#f0fdfa', padding: '2px 8px', borderRadius: 6, fontSize: 13, display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {code}
        </code>
      ),
    },
    item_name: {
      title: <ColumnSearchHeader title="Tên sản phẩm" dataKey="item_name" filters={columnFilters} onFilterChange={handleColumnFilter} showFilters={showFilters} />,
      dataIndex: 'item_name', key: 'item_name',
      width: w('item_name'), ellipsis: true,
      onHeaderCell: () => resizable('item_name'),
      render: (name: string) => (
        <Tooltip title={name} placement="topLeft">
          <span style={{ 
            fontWeight: 500, color: '#1e293b', display: 'block', 
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' 
          }}>
            {name}
          </span>
        </Tooltip>
      ),
    },
    gross_weight: {
      title: <ColumnSearchHeader title="Gross Weight" dataKey="gross_weight" filters={columnFilters} onFilterChange={handleColumnFilter} align="right" showFilters={showFilters} />,
      dataIndex: 'gross_weight', key: 'gross_weight',
      width: w('gross_weight'), align: 'right' as const,
      ellipsis: true,
      onHeaderCell: () => resizable('gross_weight'),
      render: (val: number) => <span style={{ fontFamily: 'monospace', color: '#1e293b' }}>{val.toFixed(4)}</span>,
    },
    inner_pack: {
      title: <ColumnSearchHeader title="Inner" dataKey="inner_pack" filters={columnFilters} onFilterChange={handleColumnFilter} align="right" showFilters={showFilters} />,
      dataIndex: 'inner_pack', key: 'inner_pack',
      width: w('inner_pack'), align: 'right' as const,
      ellipsis: true,
      onHeaderCell: () => resizable('inner_pack'),
      render: (val: number) => <span style={{ fontWeight: 600, color: '#0d9488' }}>{val}</span>,
    },
    case_qty: {
      title: <ColumnSearchHeader title="Case" dataKey="case_qty" filters={columnFilters} onFilterChange={handleColumnFilter} align="right" showFilters={showFilters} />,
      dataIndex: 'case_qty', key: 'case_qty',
      width: w('case_qty'), align: 'right' as const,
      ellipsis: true,
      onHeaderCell: () => resizable('case_qty'),
      render: (val: number) => <span style={{ fontWeight: 600, color: '#0d9488' }}>{val}</span>,
    },
    pallet_qty: {
      title: <ColumnSearchHeader title="Pallet" dataKey="pallet_qty" filters={columnFilters} onFilterChange={handleColumnFilter} align="right" showFilters={showFilters} />,
      dataIndex: 'pallet_qty', key: 'pallet_qty',
      width: w('pallet_qty'), align: 'right' as const,
      ellipsis: true,
      onHeaderCell: () => resizable('pallet_qty'),
      render: (val: number) => <span style={{ fontWeight: 600, color: '#0d9488' }}>{val}</span>,
    },
    is_active: {
      title: 'Trạng thái',
      dataIndex: 'is_active', key: 'is_active',
      width: w('is_active'), align: 'center' as const,
      onHeaderCell: () => resizable('is_active'),
      filters: [
        { text: 'Đang kinh doanh', value: true },
        { text: 'Ngưng kinh doanh', value: false },
      ],
      onFilter: (value: unknown, record: MasterItem) => record.is_active === value,
      render: (active: boolean) => active ? (
        <Badge status="success" text={<span style={{ fontSize: 12, fontWeight: 500, color: '#059669' }}>Đang KD</span>} />
      ) : (
        <Badge status="error" text={<span style={{ fontSize: 12, fontWeight: 500, color: '#dc2626' }}>Ngưng KD</span>} />
      ),
    },
    updated_at: {
      title: 'Cập nhật lần cuối',
      dataIndex: 'updated_at', key: 'updated_at',
      width: w('updated_at'), align: 'center' as const,
      onHeaderCell: () => resizable('updated_at'),
      render: (v: string) => <span style={{ fontSize: 12, color: '#64748b' }}>{v || '—'}</span>,
    },
    actions: null as unknown as object,
  };

  // Actions column (always last, fixed right)
  const actionsCol = {
    title: 'Thao tác',
    key: 'actions',
    width: w('actions'),
    align: 'center' as const,
    fixed: 'right' as const,
    render: (_: unknown, record: MasterItem) => (
      <Space size={6}>
        <Tooltip title="Sửa">
          <Button type="text" size="small" id={`btn-edit-${record.item_code}`} icon={<Edit3 size={15} color="#0d9488" />} onClick={() => openDrawerForEdit(record)} style={{ borderRadius: 8 }} />
        </Tooltip>
        <Popconfirm
          title="Xóa sản phẩm"
          description={`Xác nhận xóa "${record.item_name}"?`}
          onConfirm={() => deleteMutation.mutate(record.item_code)}
          okText="Xóa" cancelText="Huỷ" okButtonProps={{ danger: true }}
        >
          <Button type="text" size="small" id={`btn-delete-${record.item_code}`} icon={<Trash2 size={15} color="#ef4444" />} style={{ borderRadius: 8 }} />
        </Popconfirm>
      </Space>
    ),
  };

  // Build final columns from preferences (order + visibility)
  const visibleColumns = useMemo(() => {
    return columnConfigs
      .filter(c => c.visible)
      .map(config => allColumnDefs[config.key as keyof typeof allColumnDefs])
      .filter(Boolean);
  }, [columnConfigs, allColumnDefs]);

  // Calculate total width based on current column widths
  const totalWidth = useMemo(() => {
    return columnConfigs
      .filter(c => c.visible)
      .reduce((sum, c) => sum + (columnWidths[c.key] || (allColumnDefs[c.key as keyof typeof allColumnDefs] as any)?.width || 150), 0);
  }, [columnConfigs, columnWidths, allColumnDefs]);

  const columns: ColumnsType<MasterItem> = columnConfigs
    .filter((cfg) => cfg.visible)
    .map((cfg) => {
      if (cfg.key === 'actions') return actionsCol;
      return allColumnDefs[cfg.key] as ColumnsType<MasterItem>[number];
    })
    .filter(Boolean) as ColumnsType<MasterItem>;

  return (
    <div>
      {contextHolder}

      {/* ── Page Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #ccfbf1, rgba(20,184,166,0.25))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Package size={20} color="#0d9488" strokeWidth={1.8} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>
              Danh mục INFOR/SAP
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
              {items.length} sản phẩm · Quản lý Master Data
            </p>
          </div>
        </div>

        <Space size={12}>
          <Input
            id="master-item-search"
            placeholder="Tìm Mã SP, Tên, Nhà CC..."
            prefix={<Search size={14} color="#94a3b8" />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{
              width: 260,
              borderRadius: 10,
              borderColor: '#e2e8f0',
              height: 38
            }}
          />
          <Tooltip title="Làm mới dữ liệu">
            <Button
              id="btn-refresh-items"
              icon={<RefreshCw size={15} />}
              onClick={() => refetch()}
              loading={isLoading}
              style={{ borderRadius: 10, borderColor: '#e2e8f0', height: 38 }}
            >
              Làm mới
            </Button>
          </Tooltip>
          {/* URS §4.3: Nút mở Drawer thêm mới */}
          <Button
            id="btn-add-master-item"
            type="primary"
            icon={<Plus size={15} />}
            onClick={openDrawerForCreate}
            style={{ borderRadius: 10, background: '#0d9488', borderColor: '#0d9488', fontWeight: 600, height: 38 }}
          >
            Thêm sản phẩm
          </Button>

          {/* Table Controls: Filter toggle + Column Manager */}
          <TableControls
            showFilters={showFilters}
            onToggleFilters={() => save({ showFilters: !showFilters })}
            columns={columnConfigs}
            onColumnsChange={(configs) => save({ columnConfigs: configs })}
          />
        </Space>
      </div>



      {/* ── Ant Design Table with Pagination ── */}
      <div
        style={{
          background: 'rgba(255,255,255,0.85)',
          borderRadius: 16,
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 4px 20px rgba(13,148,136,0.08)',
          padding: 4,
          height: 'calc(100vh - 280px)', // Reduced height to account for footer
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Table<MasterItem>
          id="master-item-table"
          className="compact-table"
          columns={columns}
          dataSource={filteredItems}
          rowKey="item_code"
          loading={isLoading}
          pagination={{
            current: undefined, // Let Ant handle page
            pageSize: pageSize,
            onShowSizeChange: (_, size) => setPageSize(size),
            pageSizeOptions: [10, 20, 50, 100],
            showSizeChanger: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} / ${total} sản phẩm`,
            style: { padding: '8px 16px', margin: 0 },
            position: ['bottomRight'],
          }}
          scroll={{ x: totalWidth, y: 'calc(100vh - 380px)' }}
          locale={{
            emptyText: (
              <Empty
                description={
                  <span style={{ color: '#94a3b8' }}>
                    Không có sản phẩm nào.{' '}
                    <button
                      onClick={openDrawerForCreate}
                      style={{ color: '#0d9488', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Thêm ngay?
                    </button>
                  </span>
                }
              />
            ),
          }}
          rowClassName={(_, idx) => idx % 2 === 0 ? '' : 'ant-table-row-striped'}
          style={{ borderRadius: 0 }}
          components={{ header: { cell: ResizableTitle } }}
        />
      </div>

      {/* ─────────────────────────────────────────────────────
          URS §4.3: Drawer - Form thêm/sửa sản phẩm
          BẮT BUỘC dùng react-hook-form + zod
         ───────────────────────────────────────────────────── */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Package size={18} color="#0d9488" />
            <span style={{ fontWeight: 700 }}>
              {editingItem ? `Sửa: ${editingItem.item_code}` : 'Thêm sản phẩm mới'}
            </span>
          </div>
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={480}
        footer={
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button
              id="btn-drawer-cancel"
              onClick={() => setDrawerOpen(false)}
              style={{ borderRadius: 10 }}
            >
              Hủy
            </Button>
            <Button
              id="btn-drawer-submit"
              type="primary"
              loading={isSubmitting || createMutation.isPending || updateMutation.isPending}
              onClick={handleSubmit(onSubmit)}
              style={{ borderRadius: 10, background: '#0d9488', borderColor: '#0d9488', fontWeight: 600 }}
            >
              {editingItem ? 'Cập nhật' : 'Thêm sản phẩm'}
            </Button>
          </div>
        }
      >
        <Form layout="vertical" component="div" style={{ padding: '4px 0' }}>

          {/* item_code — BẮT BUỘC */}
          <Form.Item
            label={
              <span style={{ fontWeight: 600 }}>
                Mã sản phẩm (INFOR/SAP){' '}
                <span style={{ color: '#ef4444' }}>*</span>
              </span>
            }
            validateStatus={errors.item_code ? 'error' : ''}
            help={errors.item_code?.message}
            style={{ marginBottom: 20 }}
          >
            <Controller
              name="item_code"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  id="input-item-code"
                  placeholder="VD: SA1100013"
                  disabled={!!editingItem}
                  style={{ borderRadius: 10, fontFamily: 'monospace', fontWeight: 600 }}
                  prefix={<code style={{ color: '#94a3b8', fontSize: 12 }}>#</code>}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                />
              )}
            />
          </Form.Item>

          {/* item_name — BẮT BUỘC */}
          <Form.Item
            label={
              <span style={{ fontWeight: 600 }}>
                Tên sản phẩm <span style={{ color: '#ef4444' }}>*</span>
              </span>
            }
            validateStatus={errors.item_name ? 'error' : ''}
            help={errors.item_name?.message}
            style={{ marginBottom: 20 }}
          >
            <Controller
              name="item_name"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  id="input-item-name"
                  placeholder="VD: Amoxicillin 500mg Capsule x 100"
                  style={{ borderRadius: 10 }}
                />
              )}
            />
          </Form.Item>

          {/* supplier_code */}
          <Form.Item
            label={<span style={{ fontWeight: 600 }}>Mã Nhà cung cấp <span style={{ color: '#ef4444' }}>*</span></span>}
            validateStatus={errors.supplier_code ? 'error' : ''}
            help={errors.supplier_code?.message}
            style={{ marginBottom: 20 }}
          >
            <Controller
              name="supplier_code"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  id="input-supplier-code"
                  placeholder="VD: HYPHENS"
                  style={{ borderRadius: 10 }}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                />
              )}
            />
          </Form.Item>

          {/* visa_no — Optional */}
          <Form.Item
            label={<span style={{ fontWeight: 600 }}>Số đăng ký lưu hành</span>}
            style={{ marginBottom: 20 }}
          >
            <Controller
              name="visa_no"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  id="input-visa-no"
                  placeholder="VD: VD-12345-19 (để trống nếu chưa có)"
                  style={{ borderRadius: 10 }}
                />
              )}
            />
          </Form.Item>

           {/* is_active */}
          <Form.Item
            label={<span style={{ fontWeight: 600 }}>Trạng thái kinh doanh</span>}
            style={{ marginBottom: 20 }}
          >
            <Controller
              name="is_active"
              control={control}
              render={({ field }) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Switch
                    id="switch-is-active"
                    checked={field.value}
                    onChange={field.onChange}
                    style={{ background: field.value ? '#0d9488' : '#94a3b8' }}
                  />
                  {field.value ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#059669', fontWeight: 500 }}>
                      <CheckCircle size={15} /> Đang kinh doanh
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#dc2626', fontWeight: 500 }}>
                      <XCircle size={15} /> Ngừng kinh doanh
                    </span>
                  )}
                </div>
              )}
            />
          </Form.Item>

          <div style={{ borderTop: '1px dashed #e2e8f0', margin: '20px 0', paddingTop: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>📊 Thông số kỹ thuật</h3>
            
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label={<span style={{ fontWeight: 600 }}>Gross Weight (kg)</span>} style={{ marginBottom: 16 }}>
                  <Controller name="gross_weight" control={control} render={({ field }) => (
                    <InputNumber {...field} style={{ width: '100%', borderRadius: 10 }} placeholder="0.000" precision={4} />
                  )} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label={<span style={{ fontWeight: 600 }}>Net Weight (kg)</span>} style={{ marginBottom: 16 }}>
                  <Controller name="net_weight" control={control} render={({ field }) => (
                    <InputNumber {...field} style={{ width: '100%', borderRadius: 10 }} placeholder="0.000" precision={4} />
                  )} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label={<span style={{ fontWeight: 600 }}>Cube</span>} style={{ marginBottom: 16 }}>
                  <Controller name="cube" control={control} render={({ field }) => (
                    <InputNumber {...field} style={{ width: '100%', borderRadius: 10 }} placeholder="0.000" precision={4} />
                  )} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label={<span style={{ fontWeight: 600 }}>Tare Weight</span>} style={{ marginBottom: 16 }}>
                  <Controller name="tare_weight" control={control} render={({ field }) => (
                    <InputNumber {...field} style={{ width: '100%', borderRadius: 10 }} placeholder="0.000" precision={4} />
                  )} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16} style={{ marginTop: 8 }}>
              <Col span={8}>
                <Form.Item label={<span style={{ fontWeight: 600 }}>Pallet Qty</span>} style={{ marginBottom: 16 }}>
                  <Controller name="pallet_qty" control={control} render={({ field }) => (
                    <InputNumber {...field} style={{ width: '100%', borderRadius: 10 }} placeholder="0" />
                  )} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={<span style={{ fontWeight: 600 }}>Case Qty</span>} style={{ marginBottom: 16 }}>
                  <Controller name="case_qty" control={control} render={({ field }) => (
                    <InputNumber {...field} style={{ width: '100%', borderRadius: 10 }} placeholder="0" />
                  )} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={<span style={{ fontWeight: 600 }}>Inner Pack</span>} style={{ marginBottom: 16 }}>
                  <Controller name="inner_pack" control={control} render={({ field }) => (
                    <InputNumber {...field} style={{ width: '100%', borderRadius: 10 }} placeholder="0" />
                  )} />
                </Form.Item>
              </Col>
            </Row>
          </div>
        </Form>
      </Drawer>

      {/* Striped row style */}
      <style>{`
        .ant-table-row-striped > td {
          background: #f8fafc !important;
        }
      `}</style>
    </div>
  );
}
