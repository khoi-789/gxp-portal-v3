'use client';

import { useState, useMemo, useRef } from 'react';
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
import * as XLSX from 'xlsx';
import { ColumnSearchHeader, applyColumnFilters } from '@/lib/columnSearch';
import TableControls, { ColumnConfig } from '@/components/TableControls';
import ResizableTitle from '@/components/ResizableTitle';
import { useTablePreferences } from '@/lib/useTablePreferences';
import {
  Plus, Search, Edit3, Trash2, Truck, RefreshCw,
  AlertTriangle, HelpCircle, Upload, Download
} from 'lucide-react';
import { buildDiff, writeAuditLog } from '@/lib/auditLog';
import AuditLogTimeline from '@/components/AuditLogTimeline';

const { Option } = Select;

// ──────────────────────────────────────────────────────────
// Zod Schema Validation
// ──────────────────────────────────────────────────────────
function generateSupplierCode(name: string): string {
  if (!name) return '';
  // Chuyển sang không dấu
  const nonAccent = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Chuyển sang chữ hoa, thay thế ký tự đặc biệt bằng gạch dưới, giữ chữ và số
  const code = nonAccent.toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return code || `NCC_${Date.now()}`;
}

const masterSupplierSchema = z.object({
  supplier_code: z.string().optional(),
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
async function fetchMasterSuppliers(
  page: number,
  pageSize: number,
  search: string,
  filters: Record<string, string>
): Promise<{ items: MasterSupplier[]; count: number }> {
  let query = supabase
    .from('master_suppliers')
    .select('*', { count: 'exact' });

  if (search && search.trim()) {
    const q = `%${search.trim().toLowerCase()}%`;
    query = query.or(`supplier_code.ilike.${q},supplier_name.ilike.${q},notes.ilike.${q}`);
  }

  Object.entries(filters).forEach(([key, value]) => {
    if (!value || value.trim() === '') return;
    const val = value.trim();
    if (key === 'business_type') {
      query = query.contains('business_type', [val]);
    } else {
      query = query.ilike(key, `%${val}%`);
    }
  });

  query = query.order('supplier_name', { ascending: true });

  const from = (page - 1) * pageSize;
  const to = page * pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) {
    throw new Error('Lỗi khi tải danh mục nhà cung cấp: ' + error.message);
  }
  return {
    items: (data || []) as MasterSupplier[],
    count: count || 0,
  };
}

async function createMasterSupplier(data: MasterSupplierFormData): Promise<MasterSupplier> {
  const code = data.supplier_code || generateSupplierCode(data.supplier_name);
  const newSupplier = {
    supplier_code: code.trim().toUpperCase(),
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const headers = [
      {
        supplier_code: 'ALLEVIARE',
        supplier_name: 'Alleviare India',
        business_type: 'Nhập khẩu, Phân phối',
        notes: 'Ghi chú nhà cung cấp',
        is_active: 'TRUE'
      }
    ];
    const worksheet = XLSX.utils.json_to_sheet(headers);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'NCC Template');
    XLSX.writeFile(workbook, 'Template_Danh_Muc_NCC.xlsx');
    messageApi.success('Đã tải xuống template thành công!');
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    messageApi.loading({ content: 'Đang đọc và kiểm tra file Excel...', key: 'importSuppliers' });

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any>(sheet);

        if (rows.length === 0) {
          messageApi.warning({ content: 'File Excel trống!', key: 'importSuppliers' });
          return;
        }

        // Fetch all existing master suppliers from DB
        const { data: dbSuppliers, error: dbError } = await supabase
          .from('master_suppliers')
          .select('*');

        if (dbError) {
          throw new Error('Không thể tải danh mục nhà cung cấp từ database: ' + dbError.message);
        }

        const dbSuppliersMap = new Map(dbSuppliers?.map(s => [String(s.supplier_code).trim(), s]) || []);

        const suppliersToUpsert: any[] = [];
        const invalidRows: any[] = [];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rawName = String(row['supplier_name'] || row['Tên nhà cung cấp'] || row['Tên NCC'] || '').trim();
          let rawCode = String(row['supplier_code'] || row['Mã nhà cung cấp'] || row['Mã NCC'] || '').trim();

          if (!rawCode && rawName) {
            rawCode = generateSupplierCode(rawName);
          }

          if (!rawCode) {
            continue; // Skip completely empty rows
          }

          const dbSupp = dbSuppliersMap.get(rawCode);

          // Helper logic to merge fields
          const getStr = (excelVal: any, dbVal: string | null) => {
            if (excelVal === undefined || String(excelVal).trim() === '') return dbVal;
            return String(excelVal).trim();
          };

          const getBool = (excelVal: any, dbVal: boolean) => {
            if (excelVal === undefined || String(excelVal).trim() === '') return dbVal;
            const activeStr = String(excelVal).trim().toLowerCase();
            return activeStr === 'true' || activeStr === '1' || activeStr === 'yes' || activeStr === 'y';
          };

          const getBusinessType = (excelVal: any, dbVal: string[]) => {
            if (excelVal === undefined || String(excelVal).trim() === '') return dbVal;
            return String(excelVal).split(',').map(s => s.trim()).filter(Boolean);
          };

          const mergedSupp = {
            supplier_code: rawCode,
            supplier_name: getStr(row['supplier_name'] || row['Tên nhà cung cấp'] || row['Tên NCC'], dbSupp?.supplier_name || rawName || rawCode),
            business_type: getBusinessType(row['business_type'] || row['Loại hình'], dbSupp?.business_type || []),
            notes: getStr(row['notes'] || row['Ghi chú'], dbSupp?.notes || ''),
            is_active: getBool(row['is_active'] || row['Trạng thái hoạt động'] || row['Kích hoạt'], dbSupp?.is_active ?? true),
            created_at: dbSupp?.created_at || new Date().toISOString()
          };

          if (!mergedSupp.supplier_name) {
            invalidRows.push({ rowNum: i + 2, reason: 'Tên nhà cung cấp trống' });
            continue;
          }

          suppliersToUpsert.push(mergedSupp);
        }

        if (suppliersToUpsert.length === 0) {
          messageApi.error({ content: 'Không có dòng dữ liệu hợp lệ nào để import!', key: 'importSuppliers' });
          return;
        }

        messageApi.loading({ content: `Đang tải ${suppliersToUpsert.length} nhà cung cấp lên database...`, key: 'importSuppliers' });

        const { error: upsertError } = await supabase
          .from('master_suppliers')
          .upsert(suppliersToUpsert);

        if (upsertError) throw upsertError;

        if (invalidRows.length > 0) {
          messageApi.warning({
            content: `Đã import thành công ${suppliersToUpsert.length} dòng. Bỏ qua ${invalidRows.length} dòng không hợp lệ!`,
            key: 'importSuppliers',
            duration: 6
          });
        } else {
          messageApi.success({
            content: `Đã import thành công tất cả ${suppliersToUpsert.length} nhà cung cấp!`,
            key: 'importSuppliers',
            duration: 4
          });
        }

        // Local storage cache invalidate
        localStorage.removeItem('gxp_master_suppliers_cache');
        localStorage.removeItem('gxp_master_suppliers_cache_timestamp');

        queryClient.invalidateQueries({ queryKey: ['master_suppliers'] });
      } catch (err: any) {
        messageApi.error({ content: 'Lỗi import file: ' + err.message, key: 'importSuppliers', duration: 5 });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleExportExcel = async () => {
    try {
      messageApi.loading({ content: 'Đang chuẩn bị dữ liệu xuất Excel...', key: 'exportSuppliers' });

      // Fetch all matching records complying with search and filter
      let query = supabase
        .from('master_suppliers')
        .select('*');

      if (searchText && searchText.trim()) {
        const q = `%${searchText.trim().toLowerCase()}%`;
        query = query.or(`supplier_code.ilike.${q},supplier_name.ilike.${q}`);
      }

      Object.entries(columnFilters).forEach(([key, value]) => {
        if (!value || value.trim() === '') return;
        const val = value.trim();
        if (key === 'supplier_code' || key === 'supplier_name' || key === 'notes') {
          query = query.ilike(key, `%${val}%`);
        }
      });

      query = query.order('supplier_name', { ascending: true });

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        messageApi.warning({ content: 'Không có dữ liệu để xuất!', key: 'exportSuppliers' });
        return;
      }

      const excelRows = data.map(item => ({
        'Mã nhà cung cấp': item.supplier_code,
        'Tên nhà cung cấp': item.supplier_name,
        'Loại hình': Array.isArray(item.business_type) ? item.business_type.join(', ') : '',
        'Ghi chú': item.notes || '',
        'Trạng thái': item.is_active ? 'Hoạt động' : 'Khóa'
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Master Suppliers');

      const maxLens = Object.keys(excelRows[0]).map(key => {
        let max = key.length;
        excelRows.forEach(row => {
          const val = String((row as any)[key] || '');
          if (val.length > max) max = val.length;
        });
        return { wch: max + 2 };
      });
      worksheet['!cols'] = maxLens;

      XLSX.writeFile(workbook, 'Danh_Sach_Nha_Cung_Cap.xlsx');
      messageApi.success({ content: 'Xuất file Excel thành công!', key: 'exportSuppliers' });
    } catch (err: any) {
      messageApi.error({ content: 'Lỗi xuất file: ' + err.message, key: 'exportSuppliers' });
    }
  };

  const [searchText, setSearchText] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<MasterSupplier | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [drawerTab, setDrawerTab] = useState<'info' | 'history'>('info');

  // ── Per-user table preferences ──
  const { prefs, save, setColumnWidth } = useTablePreferences(
    'master-suppliers',
    userId,
    DEFAULT_SUPPLIER_COLS
  );
  const { columnConfigs: rawColumnConfigs, showFilters, columnWidths } = prefs;

  const columnConfigs = useMemo(() => {
    return rawColumnConfigs.filter(cfg => cfg.key !== 'supplier_code');
  }, [rawColumnConfigs]);

  const handleColumnFilter = (key: string, value: string) => {
    setColumnFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  // ── React Query ──
  const { data: supplierResult, isLoading, refetch } = useQuery({
    queryKey: ['master_suppliers', currentPage, pageSize, searchText, columnFilters],
    queryFn: () => fetchMasterSuppliers(currentPage, pageSize, searchText, columnFilters),
  });

  const rawSuppliers = supplierResult?.items || [];
  const totalCount = supplierResult?.count || 0;

  const createMutation = useMutation({
    mutationFn: createMasterSupplier,
    onSuccess: (data) => {
      writeAuditLog({
        tableName: 'master_suppliers', recordId: data.supplier_code,
        action: 'INSERT', changedBy: userId, userRole: 'Admin',
        newValues: data as unknown as Record<string, unknown>,
        changedFields: Object.keys(data),
      });
      queryClient.invalidateQueries({ queryKey: ['master_suppliers'] });
      messageApi.success('Thêm nhà cung cấp mới thành công!');
      setDrawerOpen(false);
    },
    onError: (err: Error) => messageApi.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ code, data }: { code: string; data: Partial<MasterSupplierFormData> }) =>
      updateMasterSupplier(code, data),
    onSuccess: (data) => {
      const { diff, changedFields } = buildDiff(
        editingSupplier as unknown as Record<string, unknown>,
        data as unknown as Record<string, unknown>
      );
      writeAuditLog({
        tableName: 'master_suppliers', recordId: data.supplier_code,
        action: 'UPDATE', changedBy: userId, userRole: 'Admin',
        oldValues: editingSupplier as unknown as Record<string, unknown>,
        newValues: data as unknown as Record<string, unknown>,
        diff, changedFields,
      });
      queryClient.invalidateQueries({ queryKey: ['master_suppliers'] });
      messageApi.success('Cập nhật nhà cung cấp thành công!');
      setDrawerOpen(false);
    },
    onError: (err: Error) => messageApi.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (item: MasterSupplier) => deleteMasterSupplier(item.supplier_code),
    onSuccess: (data, item) => {
      writeAuditLog({
        tableName: 'master_suppliers', recordId: item.supplier_code,
        action: 'DELETE', changedBy: userId, userRole: 'Admin',
        oldValues: item as unknown as Record<string, unknown>,
      });
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
    setDrawerTab('info');
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
    setDrawerTab('info');
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
          onConfirm={() => deleteMutation.mutate(record)}
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
          {/* Hidden File Input for Excel Import */}
          <input
            type="file"
            accept=".xlsx, .xls"
            style={{ display: 'none' }}
            onChange={handleImportExcel}
            ref={fileInputRef}
          />

          <Button
            icon={<Download size={14} />}
            onClick={handleDownloadTemplate}
            style={{ borderRadius: 6 }}
          >
            Tải Template
          </Button>

          <Button
            icon={<Upload size={14} />}
            onClick={() => fileInputRef.current?.click()}
            style={{ borderRadius: 6 }}
          >
            Nhập từ Excel
          </Button>

          <Button
            icon={<Download size={14} />}
            onClick={handleExportExcel}
            style={{ borderRadius: 6 }}
          >
            Xuất Excel
          </Button>

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
          onChange={e => {
            setSearchText(e.target.value);
            setCurrentPage(1);
          }}
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
          dataSource={rawSuppliers}
          rowKey="supplier_code"
          loading={isLoading}
          components={{ header: { cell: ResizableTitle } }}
          scroll={{ x: totalWidth, y: 550 }}
          style={{ width: '100%' }}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: totalCount,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            },
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
          {/* Tabs for Info / History */}
          {editingSupplier && (
            <div style={{ display: 'flex', gap: 4, padding: '0 4px' }}>
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

          {editingSupplier && drawerTab === 'history' ? (
            <div style={{ padding: '0 4px', overflowY: 'auto', flex: 1 }}>
              <AuditLogTimeline tableName="master_suppliers" recordId={editingSupplier.supplier_code} />
            </div>
          ) : (
            <Form layout="vertical" onFinish={handleSubmit(onSubmit)} style={{ flex: 1, overflowY: 'auto' }}>
              <Row gutter={16}>

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
          )}
        </div>
      </Drawer>
    </div>
  );
}
