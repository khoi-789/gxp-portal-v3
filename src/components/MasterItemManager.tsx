'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table, Button, Drawer, Form, Switch, Tag, Space,
  Popconfirm, message, Tooltip, Badge, Empty, InputNumber, Row, Col, Select, Input
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MasterItem } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import { syncMasterData } from '@/lib/masterDataSync';
import { ColumnSearchHeader, applyColumnFilters } from '@/lib/columnSearch';
import TableControls, { ColumnConfig } from '@/components/TableControls';
import ResizableTitle from '@/components/ResizableTitle';
import { useTablePreferences } from '@/lib/useTablePreferences';
import {
  Plus, Search, Edit3, Trash2, Package, RefreshCw,
  CheckCircle, XCircle, AlertTriangle, Upload, Download
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
// Supabase CRUD functions
// ──────────────────────────────────────────────────────────
async function fetchMasterItems(
  page: number,
  pageSize: number,
  search: string,
  filters: Record<string, string>
): Promise<{ items: MasterItem[]; count: number }> {
  let query = supabase
    .from('master_items')
    .select('*', { count: 'exact' });

  // 1. Apply global search
  if (search && search.trim()) {
    const q = `%${search.trim().toLowerCase()}%`;
    query = query.or(`item_code.ilike.${q},item_name.ilike.${q}`);
  }

  // 2. Apply column-specific filters
  Object.entries(filters).forEach(([key, value]) => {
    if (!value || value.trim() === '') return;
    const val = value.trim();

    if (key === 'is_active') {
      const valLower = val.toLowerCase();
      if (valLower.includes('ngưng') || valLower.includes('stop') || valLower.includes('false') || valLower === '0' || valLower.includes('ngung')) {
        query = query.eq('is_active', false);
      } else if (valLower.includes('đang') || valLower.includes('active') || valLower.includes('true') || valLower === '1' || valLower.includes('dang') || valLower.includes('kd')) {
        query = query.eq('is_active', true);
      }
    } else {
      query = query.ilike(key, `%${val}%`);
    }
  });

  // 3. Sorting (default descending by updated_at)
  query = query.order('updated_at', { ascending: false });

  // 4. Pagination range
  const from = (page - 1) * pageSize;
  const to = page * pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) {
    throw new Error('Lỗi khi tải danh mục sản phẩm: ' + error.message);
  }
  return {
    items: (data || []) as MasterItem[],
    count: count || 0,
  };
}

async function createMasterItem(data: MasterItemFormData): Promise<MasterItem> {
  const newItem = {
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
    updated_at: new Date().toISOString(),
  };

  // Check if item_code already exists
  const { data: existing } = await supabase
    .from('master_items')
    .select('item_code')
    .eq('item_code', newItem.item_code)
    .maybeSingle();

  if (existing) {
    throw new Error('Mã sản phẩm đã tồn tại!');
  }

  const { data: inserted, error } = await supabase
    .from('master_items')
    .insert([newItem])
    .select()
    .single();

  if (error) {
    throw new Error('Lỗi khi thêm sản phẩm: ' + error.message);
  }
  return inserted as MasterItem;
}

async function updateMasterItem(item_code: string, data: Partial<MasterItemFormData>): Promise<MasterItem> {
  const patch: any = {
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
    updated_at: new Date().toISOString(),
  };

  const { data: updated, error } = await supabase
    .from('master_items')
    .update(patch)
    .eq('item_code', item_code)
    .select()
    .single();

  if (error) {
    throw new Error('Lỗi khi cập nhật sản phẩm: ' + error.message);
  }
  return updated as MasterItem;
}

async function deleteMasterItem(item_code: string): Promise<void> {
  const { error } = await supabase
    .from('master_items')
    .delete()
    .eq('item_code', item_code);

  if (error) {
    throw new Error('Lỗi khi xóa sản phẩm: ' + error.message);
  }
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const headers = [
      {
        item_code: 'AV1100002',
        item_name: 'GLEMONT CT4 4MG 30.S',
        supplier_code: 'ALLEVIARE',
        visa_no: 'VN-22013-19',
        gross_weight: 0.12,
        net_weight: 0.1,
        cube: 0.001,
        tare_weight: 0.02,
        pallet_qty: 2400,
        case_qty: 160,
        inner_pack: 1,
        is_active: 'TRUE'
      }
    ];
    const worksheet = XLSX.utils.json_to_sheet(headers);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'SP Template');
    XLSX.writeFile(workbook, 'Template_Danh_Muc_SP.xlsx');
    messageApi.success('Đã tải xuống template thành công!');
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    messageApi.loading({ content: 'Đang đọc và kiểm tra file Excel...', key: 'importItems' });

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any>(sheet);

        if (rows.length === 0) {
          messageApi.warning({ content: 'File Excel trống!', key: 'importItems' });
          return;
        }

        // Fetch all existing master items from DB
        const { data: dbItems, error: dbError } = await supabase
          .from('master_items')
          .select('*');

        if (dbError) {
          throw new Error('Không thể tải danh mục sản phẩm từ database: ' + dbError.message);
        }

        const dbItemsMap = new Map(dbItems?.map(x => [String(x.item_code).trim(), x]) || []);

        const itemsToUpsert: any[] = [];
        const invalidRows: any[] = [];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rawItemCode = String(row['item_code'] || row['Mã sản phẩm'] || row['Mã SP'] || '').trim();
          
          if (!rawItemCode) {
            continue; // Skip empty rows
          }

          const dbItem = dbItemsMap.get(rawItemCode);

          // Helper logic to merge fields
          const getStr = (excelVal: any, dbVal: string | null) => {
            if (excelVal === undefined || String(excelVal).trim() === '') return dbVal;
            return String(excelVal).trim();
          };

          const getNum = (excelVal: any, dbVal: number | null) => {
            if (excelVal === undefined || String(excelVal).trim() === '') return dbVal;
            const num = Number(excelVal);
            return isNaN(num) ? dbVal : num;
          };

          const getBool = (excelVal: any, dbVal: boolean) => {
            if (excelVal === undefined || String(excelVal).trim() === '') return dbVal;
            const activeStr = String(excelVal).trim().toLowerCase();
            return activeStr === 'true' || activeStr === '1' || activeStr === 'yes' || activeStr === 'y';
          };

          const mergedItem = {
            item_code: rawItemCode,
            item_name: getStr(row['item_name'] || row['Tên sản phẩm'] || row['Tên SP'], dbItem?.item_name || ''),
            supplier_code: getStr(row['supplier_code'] || row['Mã nhà cung cấp'] || row['Mã NCC'], dbItem?.supplier_code || null),
            visa_no: getStr(row['visa_no'] || row['Số đăng ký'] || row['SĐK'], dbItem?.visa_no || null),
            gross_weight: getNum(row['gross_weight'] || row['Trọng lượng cả bì'] || row['Gross Weight'], dbItem?.gross_weight || 0),
            net_weight: getNum(row['net_weight'] || row['Trọng lượng tịnh'] || row['Net Weight'], dbItem?.net_weight || 0),
            cube: getNum(row['cube'] || row['Thể tích'] || row['M3'], dbItem?.cube || 0),
            tare_weight: getNum(row['tare_weight'] || row['Trọng lượng vỏ'] || row['Tare Weight'], dbItem?.tare_weight || 0),
            pallet_qty: getNum(row['pallet_qty'] || row['Số lượng/Pallet'] || row['Pallet Qty'], dbItem?.pallet_qty || 0),
            case_qty: getNum(row['case_qty'] || row['Số lượng/Thùng'] || row['Case Qty'], dbItem?.case_qty || 0),
            inner_pack: getNum(row['inner_pack'] || row['Inner Pack'] || row['Inner'], dbItem?.inner_pack || 0),
            is_active: getBool(row['is_active'] || row['Trạng thái hoạt động'] || row['Kích hoạt'], dbItem?.is_active ?? true),
            updated_at: new Date().toISOString()
          };

          if (!mergedItem.item_name) {
            invalidRows.push({ rowNum: i + 2, reason: 'Tên sản phẩm trống' });
            continue;
          }

          itemsToUpsert.push(mergedItem);
        }

        if (itemsToUpsert.length === 0) {
          messageApi.error({ content: 'Không có dòng dữ liệu hợp lệ nào để import!', key: 'importItems' });
          return;
        }

        messageApi.loading({ content: `Đang tải ${itemsToUpsert.length} sản phẩm lên database...`, key: 'importItems' });

        const { error: upsertError } = await supabase
          .from('master_items')
          .upsert(itemsToUpsert);

        if (upsertError) throw upsertError;

        if (invalidRows.length > 0) {
          messageApi.warning({
            content: `Đã import thành công ${itemsToUpsert.length} dòng. Bỏ qua ${invalidRows.length} dòng không hợp lệ!`,
            key: 'importItems',
            duration: 6
          });
        } else {
          messageApi.success({
            content: `Đã import thành công tất cả ${itemsToUpsert.length} sản phẩm!`,
            key: 'importItems',
            duration: 4
          });
        }

        // Local storage cache invalidate
        localStorage.removeItem('gxp_master_items_cache');
        localStorage.removeItem('gxp_master_items_cache_timestamp');

        queryClient.invalidateQueries({ queryKey: ['master_items'] });
      } catch (err: any) {
        messageApi.error({ content: 'Lỗi import file: ' + err.message, key: 'importItems', duration: 5 });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleExportExcel = async () => {
    try {
      messageApi.loading({ content: 'Đang chuẩn bị dữ liệu xuất Excel...', key: 'exportItems' });

      // Fetch all matching records complying with search and filter
      let query = supabase
        .from('master_items')
        .select('*');

      if (debouncedSearch && debouncedSearch.trim()) {
        query = query.ilike('item_code', `%${debouncedSearch.trim()}%`);
      }

      Object.entries(debouncedFilters).forEach(([key, value]) => {
        if (!value || value.trim() === '') return;
        const val = value.trim();
        if (key === 'item_code' || key === 'item_name' || key === 'supplier_code') {
          query = query.ilike(key, `%${val}%`);
        }
      });

      query = query.order('item_code', { ascending: true });

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        messageApi.warning({ content: 'Không có dữ liệu để xuất!', key: 'exportItems' });
        return;
      }

      const excelRows = data.map(item => ({
        'Mã sản phẩm': item.item_code,
        'Tên sản phẩm': item.item_name,
        'Mã nhà cung cấp': item.supplier_code || '',
        'Số đăng ký': item.visa_no || '',
        'Trọng lượng cả bì': Number(item.gross_weight || 0),
        'Trọng lượng tịnh': Number(item.net_weight || 0),
        'Thể tích': Number(item.cube || 0),
        'Trọng lượng vỏ': Number(item.tare_weight || 0),
        'Số lượng/Pallet': Number(item.pallet_qty || 0),
        'Số lượng/Thùng': Number(item.case_qty || 0),
        'Inner Pack': Number(item.inner_pack || 0),
        'Trạng thái': item.is_active ? 'Kích hoạt' : 'Khóa'
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Master Items');

      const maxLens = Object.keys(excelRows[0]).map(key => {
        let max = key.length;
        excelRows.forEach(row => {
          const val = String((row as any)[key] || '');
          if (val.length > max) max = val.length;
        });
        return { wch: max + 2 };
      });
      worksheet['!cols'] = maxLens;

      XLSX.writeFile(workbook, 'Danh_Sach_San_Pham.xlsx');
      messageApi.success({ content: 'Xuất file Excel thành công!', key: 'exportItems' });
    } catch (err: any) {
      messageApi.error({ content: 'Lỗi xuất file: ' + err.message, key: 'exportItems' });
    }
  };

  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterItem | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [debouncedFilters, setDebouncedFilters] = useState<Record<string, string>>({});

  // Debounce search text
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchText);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchText]);

  // Debounce column filters
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedFilters(columnFilters);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [columnFilters]);

  // ── Per-user persistent preferences ──
  const { prefs, save, setColumnWidth } = useTablePreferences(
    'master-items', userId, DEFAULT_MASTER_COLS,
  );
  const { columnConfigs, showFilters, columnWidths } = prefs;

  const handleColumnFilter = (key: string, value: string) => {
    setColumnFilters(prev => ({ ...prev, [key]: value }));
  };

  // ── TanStack Query (Server-side Paginated) ──
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['master_items', currentPage, pageSize, debouncedSearch, debouncedFilters],
    queryFn: () => fetchMasterItems(currentPage, pageSize, debouncedSearch, debouncedFilters),
  });

  const items = data?.items ?? [];
  const totalCount = data?.count ?? 0;

  const { data: suppliersList = [] } = useQuery<any[]>({
    queryKey: ['master_suppliers_list'],
    queryFn: async () => {
      const items = await syncMasterData({ table: 'master_suppliers', keyField: 'supplier_code', storageKey: 'gxp_master_suppliers_cache' });
      return items.map((s: any) => ({ supplier_code: s.supplier_code, supplier_name: s.supplier_name }));
    },
    staleTime: 5 * 60 * 1000,
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
  const filteredItems = items;

  // ── Column width helper ──
  const w = (key: string) => columnWidths[key] ?? DEFAULT_WIDTHS[key];

  // ── onHeaderCell factory: enables resize + ResizableTitle ──
  const resizable = (key: string) => ({
    width: w(key),
    ellipsis: true,
    onHeaderCell: () => ({
      onResize: (width: number) => setColumnWidth(key, width),
    } as any),
  });

  // ── Ant Design Table Columns (base definitions) ──
  const allColumnDefs: Record<string, object> = {
    item_code: {
      title: <ColumnSearchHeader title="Mã SP" dataKey="item_code" filters={columnFilters} onFilterChange={handleColumnFilter} showFilters={showFilters} />,
      dataIndex: 'item_code', key: 'item_code',
      fixed: 'left' as const,
      ...resizable('item_code'),
      render: (code: string) => (
        <code style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0d9488', background: '#f0fdfa', padding: '2px 8px', borderRadius: 6, fontSize: 13, display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {code}
        </code>
      ),
    },
    item_name: {
      title: <ColumnSearchHeader title="Tên sản phẩm" dataKey="item_name" filters={columnFilters} onFilterChange={handleColumnFilter} showFilters={showFilters} />,
      dataIndex: 'item_name', key: 'item_name',
      ...resizable('item_name'),
      render: (name: string) => {
        const display = name && name.length > 50 ? `${name.substring(0, 50)}...` : name;
        return (
          <Tooltip title={name} placement="topLeft">
            <span style={{ 
              fontWeight: 500, color: '#1e293b', display: 'block', 
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' 
            }}>
              {display}
            </span>
          </Tooltip>
        );
      },
    },
    gross_weight: {
      title: <ColumnSearchHeader title="Gross Weight" dataKey="gross_weight" filters={columnFilters} onFilterChange={handleColumnFilter} align="right" showFilters={showFilters} />,
      dataIndex: 'gross_weight', key: 'gross_weight',
      align: 'right' as const,
      ...resizable('gross_weight'),
      render: (val: number) => <span style={{ fontFamily: 'monospace', color: '#1e293b' }}>{val.toFixed(4)}</span>,
    },
    inner_pack: {
      title: <ColumnSearchHeader title="Inner" dataKey="inner_pack" filters={columnFilters} onFilterChange={handleColumnFilter} align="right" showFilters={showFilters} />,
      dataIndex: 'inner_pack', key: 'inner_pack',
      align: 'right' as const,
      ...resizable('inner_pack'),
      render: (val: number) => <span style={{ fontWeight: 600, color: '#0d9488' }}>{val}</span>,
    },
    case_qty: {
      title: <ColumnSearchHeader title="Case" dataKey="case_qty" filters={columnFilters} onFilterChange={handleColumnFilter} align="right" showFilters={showFilters} />,
      dataIndex: 'case_qty', key: 'case_qty',
      align: 'right' as const,
      ...resizable('case_qty'),
      render: (val: number) => <span style={{ fontWeight: 600, color: '#0d9488' }}>{val}</span>,
    },
    pallet_qty: {
      title: <ColumnSearchHeader title="Pallet" dataKey="pallet_qty" filters={columnFilters} onFilterChange={handleColumnFilter} align="right" showFilters={showFilters} />,
      dataIndex: 'pallet_qty', key: 'pallet_qty',
      align: 'right' as const,
      ...resizable('pallet_qty'),
      render: (val: number) => <span style={{ fontWeight: 600, color: '#0d9488' }}>{val}</span>,
    },
    is_active: {
      title: <ColumnSearchHeader title="Trạng thái" dataKey="is_active" filters={columnFilters} onFilterChange={handleColumnFilter} align="center" showFilters={showFilters} />,
      dataIndex: 'is_active', key: 'is_active',
      align: 'center' as const,
      ...resizable('is_active'),
      render: (active: boolean) => active ? (
        <Badge status="success" text={<span style={{ fontSize: 12, fontWeight: 500, color: '#059669' }}>Đang KD</span>} />
      ) : (
        <Badge status="error" text={<span style={{ fontSize: 12, fontWeight: 500, color: '#dc2626' }}>Ngưng KD</span>} />
      ),
    },
    updated_at: {
      title: 'Cập nhật lần cuối',
      dataIndex: 'updated_at', key: 'updated_at',
      align: 'center' as const,
      ...resizable('updated_at'),
      render: (v: string) => (
        <span style={{ fontSize: 12, color: '#64748b' }}>
          {v ? (dayjs(v).isValid() ? dayjs(v).format('DD/MM/YYYY HH:mm:ss') : v) : '—'}
        </span>
      ),
    },
    actions: null as unknown as object,
  };

  // Actions column (always last, fixed right)
  const actionsCol = {
    title: 'Thao tác',
    key: 'actions',
    align: 'center' as const,
    fixed: 'right' as const,
    ...resizable('actions'),
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
              {totalCount} sản phẩm · Quản lý Master Data
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
            style={{ borderRadius: 10, height: 38 }}
          >
            Tải Template
          </Button>

          <Button
            icon={<Upload size={14} />}
            onClick={() => fileInputRef.current?.click()}
            style={{ borderRadius: 10, height: 38 }}
          >
            Nhập từ Excel
          </Button>

          <Button
            icon={<Download size={14} />}
            onClick={handleExportExcel}
            style={{ borderRadius: 10, height: 38 }}
          >
            Xuất Excel
          </Button>

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
            current: currentPage,
            pageSize: pageSize,
            total: totalCount,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            },
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
                <Select
                  {...field}
                  id="select-supplier-code"
                  placeholder="Chọn nhà cung cấp"
                  style={{ width: '100%', borderRadius: 10 }}
                  showSearch
                  optionFilterProp="children"
                >
                  {suppliersList.map((s: any) => (
                    <Select.Option key={s.supplier_code} value={s.supplier_code}>
                      {s.supplier_name}
                    </Select.Option>
                  ))}
                </Select>
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
