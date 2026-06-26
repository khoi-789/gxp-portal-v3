'use client';

import { useState, useMemo } from 'react';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table, Button, Drawer, Input, Form, Tag, Space,
  Popconfirm, message, Tooltip, Badge, Select, Row, Col,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MasterSupplier } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { ColumnSearchHeader, applyColumnFilters } from '@/lib/columnSearch';
import TableControls, { ColumnConfig } from '@/components/TableControls';
import ResizableTitle from '@/components/ResizableTitle';
import { useTablePreferences } from '@/lib/useTablePreferences';
import {
  Plus, Search, Edit3, Trash2, Truck, RefreshCw,
  AlertTriangle, HelpCircle,
} from 'lucide-react';

const { Option } = Select;

// ──────────────────────────────────────────────────────────
// Zod Schema Validation
// ──────────────────────────────────────────────────────────
const masterSupplierSchema = z.object({
  supplier_code: z
    .string()
    .min(1, 'Bắt buộc nhập Mã/ID Nhà Cung Cấp')
    .min(2, 'Mã phải có ít nhất 2 ký tự')
    .regex(/^[A-Za-z0-9 _&().\'-]+$/, 'Không dùng ký tự đặc biệt lạ (chỉ hỗ trợ A-Z, 0-9, dấu cách, &()_.\'-)'),
  supplier_name: z
    .string()
    .min(1, 'Bắt buộc nhập Tên Nhà Cung Cấp')
    .min(2, 'Tên phải có ít nhất 2 ký tự'),
  business_type: z.array(z.string()).default([]),
  notes: z.string().optional().default(''),
});

type MasterSupplierFormData = z.infer<typeof masterSupplierSchema>;

// ──────────────────────────────────────────────────────────
// Supabase CRUD functions
// ──────────────────────────────────────────────────────────
async function fetchMasterSuppliers(): Promise<MasterSupplier[]> {
  const { data, error } = await supabase
    .from('master_suppliers')
    .select('*')
    .order('supplier_code', { ascending: true });

  if (error) {
    throw new Error('Lỗi khi tải danh mục nhà cung cấp: ' + error.message);
  }
  return (data || []) as MasterSupplier[];
}

async function createMasterSupplier(data: MasterSupplierFormData): Promise<MasterSupplier> {
  const newSupplier = {
    supplier_code: data.supplier_code.trim().toUpperCase(),
    supplier_name: data.supplier_name.trim(),
    business_type: data.business_type || [],
    notes: data.notes || '',
  };

  // Check if supplier_code already exists
  const { data: existing } = await supabase
    .from('master_suppliers')
    .select('supplier_code')
    .eq('supplier_code', newSupplier.supplier_code)
    .maybeSingle();

  if (existing) {
    throw new Error('Mã Nhà Cung Cấp (ID) đã tồn tại!');
  }

  const { data: inserted, error } = await supabase
    .from('master_suppliers')
    .insert([newSupplier])
    .select()
    .single();

  if (error) {
    throw new Error('Lỗi khi thêm nhà cung cấp: ' + error.message);
  }
  return inserted as MasterSupplier;
}

async function updateMasterSupplier(
  supplier_code: string,
  data: Partial<MasterSupplierFormData>
): Promise<MasterSupplier> {
  const patch = {
    supplier_name: data.supplier_name?.trim(),
    business_type: data.business_type || [],
    notes: data.notes || '',
  };

  const { data: updated, error } = await supabase
    .from('master_suppliers')
    .update(patch)
    .eq('supplier_code', supplier_code)
    .select()
    .single();

  if (error) {
    throw new Error('Lỗi khi cập nhật nhà cung cấp: ' + error.message);
  }
  return updated as MasterSupplier;
}

async function deleteMasterSupplier(supplier_code: string): Promise<void> {
  const { error } = await supabase
    .from('master_suppliers')
    .delete()
    .eq('supplier_code', supplier_code);

  if (error) {
    throw new Error('Không thể xóa NCC này vì có thể đang có liên kết dữ liệu ở Module khác: ' + error.message);
  }
}

// Default columns configuration
const DEFAULT_SUPPLIER_COLS: ColumnConfig[] = [
  { key: 'supplier_code', label: 'Mã NCC (ID)', visible: true, fixed: true },
  { key: 'supplier_name', label: 'Tên nhà cung cấp', visible: true },
  { key: 'business_type', label: 'Loại hình', visible: true },
  { key: 'notes',         label: 'Ghi chú', visible: true },
  { key: 'created_at',    label: 'Ngày tạo', visible: true },
  { key: 'actions',       label: 'Thao tác', visible: true, fixed: true },
];

// Default widths
const DEFAULT_WIDTHS: Record<string, number> = {
  supplier_code: 160,
  supplier_name: 260,
  business_type: 220,
  notes: 240,
  created_at: 160,
  actions: 110,
};

export default function MasterSupplierManager({ userId = 'default' }: { userId?: string }) {
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();

  const [searchText, setSearchText] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<MasterSupplier | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  // ── Per-user table preferences ──
  const { prefs, save, setColumnWidth } = useTablePreferences(
    'master-suppliers',
    userId,
    DEFAULT_SUPPLIER_COLS
  );
  const { columnConfigs, showFilters, columnWidths } = prefs;

  const handleColumnFilter = (key: string, value: string) => {
    setColumnFilters(prev => ({ ...prev, [key]: value }));
  };

  // ── React Query ──
  const { data: suppliers = [], isLoading, refetch } = useQuery<MasterSupplier[]>({
    queryKey: ['master_suppliers'],
    queryFn: fetchMasterSuppliers,
  });

  const createMutation = useMutation({
    mutationFn: createMasterSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master_suppliers'] });
      messageApi.success('Thêm nhà cung cấp mới thành công!');
      setDrawerOpen(false);
    },
    onError: (err: Error) => messageApi.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ code, data }: { code: string; data: Partial<MasterSupplierFormData> }) =>
      updateMasterSupplier(code, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master_suppliers'] });
      messageApi.success('Cập nhật nhà cung cấp thành công!');
      setDrawerOpen(false);
    },
    onError: (err: Error) => messageApi.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMasterSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master_suppliers'] });
      messageApi.success('Xóa nhà cung cấp thành công!');
    },
    onError: (err: Error) => messageApi.error(err.message),
  });

  // ── react-hook-form ──
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MasterSupplierFormData>({
    resolver: zodResolver(masterSupplierSchema),
    defaultValues: {
      supplier_code: '',
      supplier_name: '',
      business_type: [],
      notes: '',
    },
  });

  const openDrawerForCreate = () => {
    setEditingSupplier(null);
    reset({
      supplier_code: '',
      supplier_name: '',
      business_type: [],
      notes: '',
    });
    setDrawerOpen(true);
  };

  const openDrawerForEdit = (supplier: MasterSupplier) => {
    setEditingSupplier(supplier);
    reset({
      supplier_code: supplier.supplier_code,
      supplier_name: supplier.supplier_name,
      business_type: supplier.business_type || [],
      notes: supplier.notes || '',
    });
    setDrawerOpen(true);
  };

  const onSubmit = (data: MasterSupplierFormData) => {
    if (editingSupplier) {
      updateMutation.mutate({ code: editingSupplier.supplier_code, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // ── Client-side filters ──
  const filteredSuppliers = useMemo(() => {
    let list = suppliers;

    // Global Search
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(
        s =>
          s.supplier_code.toLowerCase().includes(q) ||
          s.supplier_name.toLowerCase().includes(q) ||
          (s.notes && s.notes.toLowerCase().includes(q))
      );
    }

    // Per-column filters
    const activeColFilters = Object.fromEntries(
      Object.entries(columnFilters).filter(([, v]) => v.trim() !== '')
    );
    if (Object.keys(activeColFilters).length > 0) {
      list = applyColumnFilters(
        list as unknown as Record<string, unknown>[],
        activeColFilters
      ) as unknown as MasterSupplier[];
    }

    return list;
  }, [suppliers, searchText, columnFilters]);

  // Width resolver
  const w = (key: string) => columnWidths[key] ?? DEFAULT_WIDTHS[key];

  const resizable = (key: string) => ({
    width: w(key),
    ellipsis: true,
    onHeaderCell: () => ({
      onResize: (width: number) => setColumnWidth(key, width),
    } as any),
  });

  // ── Columns definition ──
  const allColumnDefs: Record<string, object> = {
    supplier_code: {
      title: (
        <ColumnSearchHeader
          title="Mã NCC (ID)"
          dataKey="supplier_code"
          filters={columnFilters}
          onFilterChange={handleColumnFilter}
          showFilters={showFilters}
        />
      ),
      dataIndex: 'supplier_code',
      key: 'supplier_code',
      fixed: 'left' as const,
      ...resizable('supplier_code'),
      render: (code: string) => (
        <code
          style={{
            fontFamily: 'monospace',
            fontWeight: 700,
            color: '#0d9488',
            background: '#f0fdfa',
            padding: '2px 8px',
            borderRadius: 6,
            fontSize: 13,
            display: 'inline-block',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {code}
        </code>
      ),
    },
    supplier_name: {
      title: (
        <ColumnSearchHeader
          title="Tên nhà cung cấp"
          dataKey="supplier_name"
          filters={columnFilters}
          onFilterChange={handleColumnFilter}
          showFilters={showFilters}
        />
      ),
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      ...resizable('supplier_name'),
      render: (name: string) => {
        const display = name && name.length > 50 ? `${name.substring(0, 50)}...` : name;
        return (
          <Tooltip title={name} placement="topLeft">
            <span
              style={{
                fontWeight: 500,
                color: '#1e293b',
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {display}
            </span>
          </Tooltip>
        );
      },
    },
    business_type: {
      title: (
        <ColumnSearchHeader
          title="Loại hình"
          dataKey="business_type"
          filters={columnFilters}
          onFilterChange={handleColumnFilter}
          showFilters={showFilters}
        />
      ),
      dataIndex: 'business_type',
      key: 'business_type',
      ...resizable('business_type'),
      render: (types: string[]) => {
        if (!types || types.length === 0) return <span style={{ color: '#cbd5e1' }}>Chưa thiết lập</span>;
        return (
          <Space size={4} wrap>
            {types.map(t => {
              let color = 'default';
              if (t === 'Nhập Khẩu') color = 'blue';
              if (t === 'Trong nước') color = 'green';
              if (t === 'Tự doanh') color = 'purple';
              return (
                <Tag color={color} key={t} style={{ fontSize: 11, fontWeight: 500, borderRadius: 6, margin: 0 }}>
                  {t}
                </Tag>
              );
            })}
          </Space>
        );
      },
    },
    notes: {
      title: (
        <ColumnSearchHeader
          title="Ghi chú"
          dataKey="notes"
          filters={columnFilters}
          onFilterChange={handleColumnFilter}
          showFilters={showFilters}
        />
      ),
      dataIndex: 'notes',
      key: 'notes',
      ...resizable('notes'),
      render: (text: string) => {
        if (!text) return <span style={{ color: '#cbd5e1' }}>—</span>;
        const display = text.length > 50 ? `${text.substring(0, 50)}...` : text;
        return (
          <Tooltip title={text} placement="topLeft">
            <span style={{ color: '#64748b', fontSize: 13 }}>{display}</span>
          </Tooltip>
        );
      },
    },
    created_at: {
      title: 'Ngày tạo',
      dataIndex: 'created_at',
      key: 'created_at',
      align: 'center' as const,
      ...resizable('created_at'),
      render: (v: string) => (
        <span style={{ fontSize: 12, color: '#64748b' }}>
          {v ? (dayjs(v).isValid() ? dayjs(v).format('DD/MM/YYYY HH:mm') : v) : '—'}
        </span>
      ),
    },
    actions: null as unknown as object,
  };

  const actionsCol = {
    title: 'Thao tác',
    key: 'actions',
    align: 'center' as const,
    fixed: 'right' as const,
    ...resizable('actions'),
    render: (_: unknown, record: MasterSupplier) => (
      <Space size={6}>
        <Tooltip title="Sửa">
          <Button
            type="text"
            size="small"
            id={`btn-supplier-edit-${record.supplier_code}`}
            icon={<Edit3 size={15} color="#0d9488" />}
            onClick={() => openDrawerForEdit(record)}
            style={{ borderRadius: 8 }}
          />
        </Tooltip>
        <Popconfirm
          title="Xóa nhà cung cấp"
          description={`Xác nhận xóa nhà cung cấp "${record.supplier_name}"?`}
          onConfirm={() => deleteMutation.mutate(record.supplier_code)}
          okText="Xóa"
          cancelText="Huỷ"
          okButtonProps={{ danger: true }}
        >
          <Button
            type="text"
            size="small"
            id={`btn-supplier-delete-${record.supplier_code}`}
            icon={<Trash2 size={15} color="#ef4444" />}
            style={{ borderRadius: 8 }}
          />
        </Popconfirm>
      </Space>
    ),
  };

  const columns = columnConfigs
    .filter(cfg => cfg.visible)
    .map(cfg => {
      if (cfg.key === 'actions') return actionsCol;
      return allColumnDefs[cfg.key] as ColumnsType<MasterSupplier>[number];
    })
    .filter(Boolean) as ColumnsType<MasterSupplier>;

  const totalWidth = useMemo(() => {
    return columnConfigs
      .filter(c => c.visible)
      .reduce(
        (sum, c) =>
          sum +
          (columnWidths[c.key] ||
            (allColumnDefs[c.key as keyof typeof allColumnDefs] as any)?.width ||
            150),
        0
      );
  }, [columnConfigs, columnWidths, allColumnDefs]);

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
            <Truck size={20} color="#0d9488" strokeWidth={1.8} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, color: '#1e293b', fontWeight: 700 }}>
              Danh mục Nhà Cung Cấp
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
              Quản lý danh sách hãng sản xuất, đối tác cung cấp toàn hệ thống GxP
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tooltip title="Tải lại dữ liệu">
            <Button
              shape="circle"
              icon={<RefreshCw size={16} />}
              onClick={() => refetch()}
              loading={isLoading}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            />
          </Tooltip>
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={openDrawerForCreate}
            id="btn-create-supplier"
            style={{
              background: 'linear-gradient(135deg, #0d9488, #0f766e)',
              border: 'none',
              borderRadius: 10,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              height: 38,
              boxShadow: '0 4px 10px rgba(13, 148, 136, 0.2)',
            }}
          >
            Thêm nhà cung cấp
          </Button>
        </div>
      </div>

      {/* ── Table Toolbar Controls ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          background: 'white',
          padding: '12px 16px',
          borderRadius: 12,
          border: '1px solid #f1f5f9',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <Input
          placeholder="Tìm theo Mã/Tên/Ghi chú..."
          prefix={<Search size={16} color="#94a3b8" />}
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          allowClear
          style={{ width: 280, borderRadius: 10 }}
        />

        <TableControls
          showFilters={showFilters}
          onToggleFilters={() => save({ ...prefs, showFilters: !showFilters })}
          columns={columnConfigs}
          onColumnsChange={newConfigs => save({ ...prefs, columnConfigs: newConfigs })}
        />
      </div>

      {/* ── Main Ant Design Table ── */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
        <Table
          columns={columns}
          dataSource={filteredSuppliers}
          rowKey="supplier_code"
          loading={isLoading}
          components={{ header: { cell: ResizableTitle } }}
          scroll={{ x: totalWidth, y: 550 }}
          style={{ width: '100%' }}
          pagination={{
            pageSize: pageSize,
            onChange: (page, size) => setPageSize(size),
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: total => `Tổng số ${total} nhà cung cấp`,
          }}
          className="gxp-table"
        />
      </div>

      {/* ── Form Drawer ── */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0f766e' }}>
            <Truck size={18} />
            <span>{editingSupplier ? 'Cập Nhật Nhà Cung Cấp' : 'Thêm Nhà Cung Cấp Mới'}</span>
          </div>
        }
        placement="right"
        width={480}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        styles={{ body: { paddingBottom: 80 } }}
      >
        <Form layout="vertical" onFinish={handleSubmit(onSubmit)}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                label={
                  <span style={{ fontWeight: 600, color: '#374151' }}>
                    Mã/ID Nhà Cung Cấp <span style={{ color: '#ef4444' }}>*</span>
                  </span>
                }
                validateStatus={errors.supplier_code ? 'error' : ''}
                help={errors.supplier_code?.message}
              >
                <Controller
                  name="supplier_code"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      disabled={!!editingSupplier}
                      placeholder="VD: ABBOTT, SANOFI"
                      style={{ borderRadius: 8, textTransform: 'uppercase' }}
                    />
                  )}
                />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item
                label={
                  <span style={{ fontWeight: 600, color: '#374151' }}>
                    Tên Nhà Cung Cấp <span style={{ color: '#ef4444' }}>*</span>
                  </span>
                }
                validateStatus={errors.supplier_name ? 'error' : ''}
                help={errors.supplier_name?.message}
              >
                <Controller
                  name="supplier_name"
                  control={control}
                  render={({ field }) => (
                    <Input {...field} placeholder="Tên đầy đủ của NCC" style={{ borderRadius: 8 }} />
                  )}
                />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item
                label={<span style={{ fontWeight: 600, color: '#374151' }}>Loại hình (Chọn nhiều)</span>}
                validateStatus={errors.business_type ? 'error' : ''}
                help={errors.business_type?.message}
              >
                <Controller
                  name="business_type"
                  control={control}
                  render={({ field }) => (
                    <Select
                      mode="multiple"
                      allowClear
                      style={{ width: '100%', borderRadius: 8 }}
                      placeholder="Chọn các loại hình kinh doanh"
                      value={field.value}
                      onChange={val => field.onChange(val)}
                    >
                      <Option value="Nhập Khẩu">Nhập Khẩu</Option>
                      <Option value="Trong nước">Trong nước</Option>
                      <Option value="Tự doanh">Tự doanh</Option>
                    </Select>
                  )}
                />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item
                label={<span style={{ fontWeight: 600, color: '#374151' }}>Ghi chú</span>}
                validateStatus={errors.notes ? 'error' : ''}
                help={errors.notes?.message}
              >
                <Controller
                  name="notes"
                  control={control}
                  render={({ field }) => (
                    <Input.TextArea
                      {...field}
                      rows={4}
                      placeholder="Mô tả hoặc thông tin lưu ý..."
                      style={{ borderRadius: 8 }}
                    />
                  )}
                />
              </Form.Item>
            </Col>
          </Row>

          <div
            style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              width: '100%',
              borderTop: '1px solid #f1f5f9',
              padding: '16px 24px',
              background: '#fff',
              textAlign: 'right',
              zIndex: 1,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12,
            }}
          >
            <Button onClick={() => setDrawerOpen(false)} style={{ borderRadius: 8 }}>
              Hủy
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={isSubmitting}
              style={{
                background: 'linear-gradient(135deg, #0d9488, #0f766e)',
                border: 'none',
                borderRadius: 8,
                fontWeight: 500,
              }}
            >
              {editingSupplier ? 'Lưu thay đổi' : 'Thêm mới'}
            </Button>
          </div>
        </Form>
      </Drawer>
    </div>
  );
}
