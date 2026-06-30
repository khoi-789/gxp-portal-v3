'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Table, Button, Input, Tag, Select, Space, Tooltip,
  Badge, Drawer, InputNumber, message, Row, Col, Popconfirm,
  Spin, Switch, DatePicker, Segmented, Card, Statistic, Modal
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  Search, RefreshCw, Trash2, FileDown, Eye, CheckCircle2,
  AlertTriangle, Clock, Filter, Plus, FileText, ExternalLink,
  Calendar, PlusCircle, AlertCircle, Edit, Info, Copy, Folder
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
export interface ShipmentItem {
  id?: number;
  invoice_number: string;
  item_code: string | null;
  item_name: string;
  issue_notes: string | null;
  resolution_notes: string | null;
  created_at?: string;
  required_labels?: any[] | null; // Stored labels snapshot: { code: string, name: string, qty: number }[]
}

export interface ShipmentRecord {
  invoice_number: string;
  created_date: string;
  supplier_code: string;
  coa_status: string; // 'Chưa có' | 'Đã cập nhật' | 'Đang sai sót'
  label_status: string; // 'Chưa có' | 'Đã cập nhật'
  progress_status: string; // 'Created' | 'Checking' | 'Pending Inbound' | 'Issue' | 'Closed'
  has_data_logger: boolean;
  data_logger_type: string | null;
  logger_qty: number;
  temp_out_of_range: boolean;
  temp_out_of_range_details: string | null;
  import_date_lh?: string | null;
  import_date_hn?: string | null;
  import_date_lh_text?: string | null;
  import_date_hn_text?: string | null;
  target_warehouse?: string | null;
  actual_import_date_note?: string | null;
  issues?: { id: string; issue_text: string; resolution_text: string; }[];
  invoice_link: string | null;
  supplier_link: string | null;
  updated_at?: string;
  imp_shipment_items: ShipmentItem[];
}

const COA_STATUS_OPTIONS = [
  { value: 'Chưa có', label: 'Chưa có' },
  { value: 'Đã cập nhật', label: 'Đã cập nhật' },
  { value: 'Đang sai sót', label: 'Đang sai sót' },
];

const LABEL_STATUS_OPTIONS = [
  { value: 'Chưa có', label: 'Chưa có' },
  { value: 'Đã cập nhật', label: 'Đã cập nhật' },
];

const PROGRESS_STATUS_OPTIONS = [
  { value: 'Created', label: 'Khởi tạo (Created)' },
  { value: 'Checking', label: 'Đang kiểm chứng từ (Checking)' },
  { value: 'Pending Inbound', label: 'Chờ nhập kho (Pending Inbound)' },
  { value: 'Issue', label: 'Có sự cố (Issue)' },
  { value: 'Closed', label: 'Hoàn tất (Closed)' },
];

const PROGRESS_LABEL: Record<string, string> = {
  Created: 'Khởi tạo',
  Checking: 'Đang kiểm tra',
  'Pending Inbound': 'Chờ nhập kho',
  Issue: 'Có sự cố',
  Closed: 'Hoàn tất',
};

const PROGRESS_COLOR: Record<string, string> = {
  Created: 'default',
  Checking: 'processing',
  'Pending Inbound': 'warning',
  Issue: 'error',
  Closed: 'success',
};

const COA_COLOR: Record<string, string> = {
  'Chưa có': 'default',
  'Đã cập nhật': 'success',
  'Đang sai sót': 'error',
};

const LABEL_COLOR: Record<string, string> = {
  'Chưa có': 'default',
  'Đã cập nhật': 'success',
};

/* ──────────────────────────────────────────────────
   Table Configuration
   ────────────────────────────────────────────────── */
const DEFAULT_IMPORT_COLS: ColumnConfig[] = [
  { key: 'stt', label: 'STT', visible: true, fixed: true },
  { key: 'invoice_number', label: 'Số Invoice', visible: true, fixed: true },
  { key: 'created_date', label: 'Ngày lập', visible: true },
  { key: 'supplier_code', label: 'Nhà cung cấp', visible: true },
  { key: 'products', label: 'Sản phẩm', visible: true },
  { key: 'coa_status', label: 'COA', visible: true },
  { key: 'label_status', label: 'Nhãn phụ', visible: true },
  { key: 'progress_status', label: 'Tiến độ', visible: true },
  { key: 'temp_out_of_range', label: 'Cảnh báo nhiệt', visible: true },
  { key: 'import_dates', label: 'Ngày nhập kho', visible: true },
  { key: 'actions', label: 'Thao tác', visible: true, fixed: true },
];

const DEFAULT_IMPORT_WIDTHS: Record<string, number> = {
  stt: 50,
  invoice_number: 140,
  created_date: 110,
  supplier_code: 140,
  products: 240,
  coa_status: 110,
  label_status: 110,
  progress_status: 140,
  temp_out_of_range: 160,
  import_dates: 180,
  actions: 80,
};

// ── Server-side fetch function ──
async function fetchShipments(
  page: number,
  pageSize: number,
  search: string,
  filters: Record<string, string>
): Promise<{ items: ShipmentRecord[]; count: number }> {
  let query = supabase
    .from('imp_shipments')
    .select('*, imp_shipment_items(*)', { count: 'exact' });

  if (search.trim()) {
    const q = `%${search.trim()}%`;
    query = query.or(`invoice_number.ilike.${q},supplier_code.ilike.${q}`);
  }

  const colMap: Record<string, string> = {
    invoice_number: 'invoice_number',
    supplier_code: 'supplier_code',
    coa_status: 'coa_status',
    label_status: 'label_status',
    progress_status: 'progress_status',
  };

  Object.entries(filters).forEach(([key, value]) => {
    if (!value || value.trim() === '') return;
    const col = colMap[key];
    if (col) query = query.ilike(col, `%${value.trim()}%`);
  });

  query = query.order('created_date', { ascending: false });
  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, count, error } = await query;
  if (error) throw new Error('Lỗi tải danh sách chuyến hàng: ' + error.message);
  return { items: (data || []) as ShipmentRecord[], count: count || 0 };
}

export default function ImportModule({ userId = 'default' }: { userId?: string }) {
  const [messageApi, contextHolder] = message.useMessage();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Simulated Persona
  const [simulatedRole, setSimulatedRole] = useState<'QA_NHAP_KHAU' | 'QA_KHO'>('QA_NHAP_KHAU');

  // Master product data for select list (load all for dropdowns)
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

  // Product label mappings
  const { data: labelMappings = [] } = useQuery<any[]>({
    queryKey: ['label-mappings'],
    queryFn: async () => {
      return syncMasterData<any>({
        table: 'product_label_mappings',
        keyField: 'id',
        storageKey: 'gxp_product_label_mappings_cache'
      });
    },
    initialData: () => {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('gxp_product_label_mappings_cache');
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
  const impQueryKey = ['imp_shipments', currentPage, pageSize, globalSearch, columnFilters];
  const { data: impResult, isLoading: loading, refetch: loadData } = useQuery({
    queryKey: impQueryKey,
    queryFn: () => fetchShipments(currentPage, pageSize, globalSearch, columnFilters),
    placeholderData: (prev) => prev,
  });

  const rawData = impResult?.items || [];
  const totalCount = impResult?.count || 0;

  // Drawer / Form state
  const [detailRow, setDetailRow] = useState<ShipmentRecord | null>(null);
  const [isNew, setIsNew] = useState(false);
  
  // Track original detail items for smart DB updates
  const [originalItems, setOriginalItems] = useState<ShipmentItem[]>([]);

  // Custom required labels modal state
  const [customLabelModalVisible, setCustomLabelModalVisible] = useState(false);
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);
  const [tempLabelsList, setTempLabelsList] = useState<{ code: string; name: string; qty: number }[]>([]);

  const { prefs, save: savePrefs, setColumnWidth } = useTablePreferences(
    'import_shipments_table_v1',
    userId,
    DEFAULT_IMPORT_COLS
  );

  const showFilters = prefs.showFilters;
  const columnWidths = prefs.columnWidths;

  const w = (key: string) => columnWidths[key] ?? DEFAULT_IMPORT_WIDTHS[key] ?? 100;
  const resizable = (key: string) => ({
    width: w(key),
    ellipsis: true,
    onHeaderCell: () => ({
      onResize: (width: number) => setColumnWidth(key, width),
    } as any),
  });

  // Get required stamps/labels for a given product code
  const getProductLabels = useCallback((productItemCode: string | null) => {
    if (!productItemCode) return [];
    return (labelMappings as any[])
      .filter((m: any) => m.product_item_code === productItemCode)
      .map((m: any) => {
        const labelItem = (masterItems as any[]).find((item: any) => item.item_code === m.label_item_code);
        return {
          code: m.label_item_code,
          name: labelItem ? labelItem.item_name : 'Không rõ tên nhãn',
          qty: m.quantity_per_unit
        };
      });
  }, [labelMappings, masterItems]);

  // Master suppliers list
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

  // Unique suppliers from master data
  const suppliersList = useMemo(() => {
    return masterSuppliers.map((s: any) => s.supplier_code).filter(Boolean).sort();
  }, [masterSuppliers]);

  // Handle column filter change - reset page
  const handleColumnFilter = (key: string, value: string) => {
    setColumnFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleRefreshAll = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('gxp_master_items_cache');
      localStorage.removeItem('gxp_product_label_mappings_cache');
      localStorage.removeItem('gxp_master_suppliers_cache');
    }
    
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['master-items-dropdown'] }),
      queryClient.invalidateQueries({ queryKey: ['label-mappings'] }),
      queryClient.invalidateQueries({ queryKey: ['master-suppliers-dropdown'] }),
      queryClient.invalidateQueries({ queryKey: impQueryKey })
    ]);
  };

  // Auto-calculated label status
  const computedLabelStatus = useMemo(() => {
    if (!detailRow) return 'Chưa có';
    const currentItems = detailRow.imp_shipment_items || [];
    const hasReqLabels = currentItems.some(item => {
      const labels = (item.required_labels !== undefined && item.required_labels !== null)
        ? item.required_labels
        : getProductLabels(item.item_code);
      return labels && labels.length > 0;
    });
    return (!hasReqLabels || detailRow.progress_status === 'Closed') ? 'Đã cập nhật' : 'Chưa có';
  }, [detailRow, getProductLabels]);

  // Open required label customizer modal
  const handleOpenCustomLabelModal = (idx: number, currentLabels: any[]) => {
    setEditingItemIdx(idx);
    setTempLabelsList(JSON.parse(JSON.stringify(currentLabels || [])));
    setCustomLabelModalVisible(true);
  };

  // Revert labels mapping to Master Data Realtime
  const handleResetLabels = (idx: number) => {
    setDetailRow(prev => {
      if (!prev) return null;
      const items = [...prev.imp_shipment_items];
      items[idx] = {
        ...items[idx],
        required_labels: null,
      };
      return { ...prev, imp_shipment_items: items };
    });
    messageApi.success('Đã khôi phục tem nhãn theo Master Data realtime.');
  };

  // Save customized required labels list
  const handleSaveCustomLabels = () => {
    if (editingItemIdx === null) return;
    
    // Check for empty label codes or invalid quantities
    const invalid = tempLabelsList.some(lbl => !lbl.code || lbl.qty <= 0);
    if (invalid) {
      messageApi.warning('Vui lòng chọn mã tem và số lượng hợp lệ (> 0)!');
      return;
    }

    setDetailRow(prev => {
      if (!prev) return null;
      const items = [...prev.imp_shipment_items];
      items[editingItemIdx] = {
        ...items[editingItemIdx],
        required_labels: tempLabelsList
      };
      return { ...prev, imp_shipment_items: items };
    });

    setCustomLabelModalVisible(false);
    setEditingItemIdx(null);
    messageApi.success('Cập nhật tùy chỉnh tem nhãn thành công!');
  };

  // Statistics calculation
  const stats = useMemo(() => {
    const total = totalCount;
    const issues = rawData.filter(r => r.progress_status === 'Issue' || r.temp_out_of_range).length;
    const pendingInbound = rawData.filter(r => r.progress_status === 'Pending Inbound').length;
    const closed = rawData.filter(r => r.progress_status === 'Closed').length;
    const outOfRange = rawData.filter(r => r.temp_out_of_range).length;

    return { total, issues, pendingInbound, closed, outOfRange };
  }, [rawData, totalCount]);

  // Open Edit / Detail Drawer
  const handleOpenDetail = (record: ShipmentRecord) => {
    setDetailRow(JSON.parse(JSON.stringify(record))); // Deep copy
    setOriginalItems(JSON.parse(JSON.stringify(record.imp_shipment_items || [])));
    setIsNew(false);
  };

  // Open Create Drawer
  const handleCreateNew = () => {
    const emptyRecord: ShipmentRecord = {
      invoice_number: '',
      created_date: dayjs().format('YYYY-MM-DD'),
      supplier_code: '',
      coa_status: 'Chưa có',
      label_status: 'Chưa có',
      progress_status: 'Created',
      has_data_logger: false,
      data_logger_type: null,
      logger_qty: 0,
      temp_out_of_range: false,
      temp_out_of_range_details: null,
      target_warehouse: null,
      actual_import_date_note: null,
      issues: [],
      invoice_link: null,
      supplier_link: null,
      imp_shipment_items: [],
    };
    setDetailRow(emptyRecord);
    setOriginalItems([]);
    setIsNew(true);
  };

  // Delete shipment
  const handleDeleteShipment = async (invoiceNumber: string) => {
    try {
      const { error } = await supabase
        .from('imp_shipments')
        .delete()
        .eq('invoice_number', invoiceNumber);
      if (error) throw error;

      messageApi.success(`Đã xóa Invoice ${invoiceNumber} thành công!`);
      queryClient.invalidateQueries({ queryKey: ['imp_shipments'] });
    } catch (e: any) {
      messageApi.error('Lỗi khi xóa chuyến hàng: ' + e.message);
    }
  };

  // Handle Form changes
  const updateField = (key: keyof ShipmentRecord, value: any) => {
    setDetailRow(prev => {
      if (!prev) return null;
      return {
        ...prev,
        [key]: value,
      };
    });
  };

  // Handle Dynamic Items changes
  const updateItemField = (index: number, key: keyof ShipmentItem, value: any) => {
    setDetailRow(prev => {
      if (!prev) return null;
      const items = [...prev.imp_shipment_items];
      items[index] = { ...items[index], [key]: value };
      
      // Auto fill item_name and recalculate labels if SCM changes item_code
      if (key === 'item_code') {
        if (value) {
          const match = masterItems.find(m => m.item_code === value);
          if (match) {
            items[index].item_name = match.item_name;
          }
          items[index].required_labels = null;
        } else {
          items[index].required_labels = null;
        }
      }
      return { ...prev, imp_shipment_items: items };
    });
  };

  const handleAddItem = () => {
    if (!detailRow) return;
    const newItem: ShipmentItem = {
      invoice_number: detailRow.invoice_number,
      item_code: null,
      item_name: '',
      issue_notes: null,
      resolution_notes: null,
    };
    setDetailRow(prev => {
      if (!prev) return null;
      return {
        ...prev,
        imp_shipment_items: [...prev.imp_shipment_items, newItem],
      };
    });
  };

  const handleRemoveItem = (index: number) => {
    setDetailRow(prev => {
      if (!prev) return null;
      const items = [...prev.imp_shipment_items];
      items.splice(index, 1);
      return {
        ...prev,
        imp_shipment_items: items,
      };
    });
  };

  const handleAddIssue = () => {
    if (!detailRow) return;
    const currentIssues = detailRow.issues || [];
    setDetailRow(prev => {
      if (!prev) return null;
      return {
        ...prev,
        issues: [
          ...currentIssues,
          { id: `issue_${Date.now()}`, issue_text: '', resolution_text: '' }
        ]
      };
    });
  };

  const handleRemoveIssue = (index: number) => {
    if (!detailRow) return;
    const currentIssues = [...(detailRow.issues || [])];
    currentIssues.splice(index, 1);
    setDetailRow(prev => {
      if (!prev) return null;
      return {
        ...prev,
        issues: currentIssues
      };
    });
  };

  const updateIssueField = (index: number, key: string, val: any) => {
    if (!detailRow) return;
    const currentIssues = [...(detailRow.issues || [])];
    currentIssues[index] = { ...currentIssues[index], [key]: val };
    setDetailRow(prev => {
      if (!prev) return null;
      return {
        ...prev,
        issues: currentIssues
      };
    });
  };

  // Save changes to Supabase
  const handleSave = async () => {
    if (!detailRow) return;
    const invoiceNumber = detailRow.invoice_number.trim();
    if (!invoiceNumber) {
      messageApi.warning('Vui lòng nhập Số Invoice!');
      return;
    }
    if (!detailRow.supplier_code) {
      messageApi.warning('Vui lòng nhập/chọn Nhà cung cấp!');
      return;
    }

    setSaving(true);
    try {
      // 1. Prepare shipment payload (Master)
      const computedInvoiceLink = detailRow.supplier_code 
        ? `\\\\hd.domain\\hoangducdfs\\TAILIEUPHONG-HD\\P.QA\\7. LONG HAU\\7. CAC THEO DOI TRONG QUA TRINH\\18. FORM MAU CHO FOLDER NHA SAN XUAT\\${detailRow.supplier_code}`
        : null;
      const computedSupplierLink = (detailRow.supplier_code && invoiceNumber)
        ? `\\\\hd.domain\\hoangducdfs\\TAILIEUPHONG-HD\\P.QA\\7. LONG HAU\\7. CAC THEO DOI TRONG QUA TRINH\\18. FORM MAU CHO FOLDER NHA SAN XUAT\\${detailRow.supplier_code}\\5. THONG TIN NHAP - PHAN PHOI\\1. KIEM NHAP\\${invoiceNumber}`
        : null;

      const shipmentPayload: any = {
        invoice_number: invoiceNumber,
        created_date: detailRow.created_date,
        supplier_code: detailRow.supplier_code,
        coa_status: detailRow.coa_status,
        label_status: computedLabelStatus,
        progress_status: detailRow.progress_status,
        has_data_logger: detailRow.has_data_logger,
        data_logger_type: detailRow.has_data_logger ? detailRow.data_logger_type : null,
        logger_qty: detailRow.has_data_logger ? detailRow.logger_qty : 0,
        temp_out_of_range: detailRow.temp_out_of_range,
        temp_out_of_range_details: detailRow.temp_out_of_range ? detailRow.temp_out_of_range_details : null,
        target_warehouse: detailRow.target_warehouse || null,
        actual_import_date_note: detailRow.actual_import_date_note || null,
        issues: detailRow.issues || [],
        invoice_link: computedInvoiceLink,
        supplier_link: computedSupplierLink,
        updated_at: new Date().toISOString(),
      };

      // Upsert the shipment row
      const { error: shipmentError } = await supabase
        .from('imp_shipments')
        .upsert(shipmentPayload);

      if (shipmentError) throw shipmentError;

      // 2. Synchronize child items (Detail)
      const currentItems = detailRow.imp_shipment_items || [];

      // Find item IDs to delete
      const originalIds = originalItems.map(item => item.id).filter(Boolean) as number[];
      const currentIds = currentItems.map(item => item.id).filter(Boolean) as number[];
      const idsToDelete = originalIds.filter(id => !currentIds.includes(id));

      if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('imp_shipment_items')
          .delete()
          .in('id', idsToDelete);
        if (deleteError) throw deleteError;
      }

      // Separate into inserts & updates
      const toUpdate = currentItems.filter(item => item.id);
      const toInsert = currentItems.filter(item => !item.id).map(item => {
        const labels = (item.required_labels !== undefined && item.required_labels !== null)
          ? item.required_labels
          : getProductLabels(item.item_code);
        return {
          invoice_number: invoiceNumber,
          item_code: item.item_code || null,
          item_name: item.item_name || 'Sản phẩm mới',
          issue_notes: item.issue_notes || null,
          resolution_notes: item.resolution_notes || null,
          required_labels: (labels && labels.length > 0) ? labels : null,
        };
      });

      // Perform updates
      for (const item of toUpdate) {
        const labels = (item.required_labels !== undefined && item.required_labels !== null)
          ? item.required_labels
          : getProductLabels(item.item_code);
        const { error: updateError } = await supabase
          .from('imp_shipment_items')
          .update({
            item_code: item.item_code || null,
            item_name: item.item_name,
            issue_notes: item.issue_notes || null,
            resolution_notes: item.resolution_notes || null,
            required_labels: (labels && labels.length > 0) ? labels : null,
          })
          .eq('id', item.id);
        if (updateError) throw updateError;
      }

      // Perform inserts
      if (toInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('imp_shipment_items')
          .insert(toInsert);
        if (insertError) throw insertError;
      }

      messageApi.success(`Lưu thông tin Invoice ${invoiceNumber} thành công!`);
      setDetailRow(null);
      queryClient.invalidateQueries({ queryKey: ['imp_shipments'] });
    } catch (e: any) {
      messageApi.error('Lỗi khi lưu dữ liệu: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // Date formatting helper
  const renderDate = (dateStr: string | null, textStr: string | null) => {
    if (dateStr) return dayjs(dateStr).format('DD/MM/YYYY');
    return textStr || '—';
  };

  // Table Columns Definition
  const allColumnDefs: Record<string, any> = {
    stt: {
      title: <ColumnSearchHeader title="STT" dataKey="__stt" filters={columnFilters} onFilterChange={handleColumnFilter} align="center" showFilters={showFilters} />,
      key: 'stt',
      align: 'center',
      ...resizable('stt'),
      render: (_: any, __: any, idx: number) => (
        <span style={{ color: '#94a3b8', fontSize: 12 }}>
          {(currentPage - 1) * pageSize + idx + 1}
        </span>
      ),
    },
    invoice_number: {
      title: <ColumnSearchHeader title="Số Invoice" dataKey="invoice_number" filters={columnFilters} onFilterChange={handleColumnFilter} showFilters={showFilters} />,
      dataIndex: 'invoice_number',
      key: 'invoice_number',
      ...resizable('invoice_number'),
      render: (v: string, r: ShipmentRecord) => (
        <span 
          style={{ fontWeight: 700, color: '#0d9488', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          onClick={() => handleOpenDetail(r)}
        >
          {v}
          {r.invoice_link && (
            <Tooltip title="Xem file gốc">
              <a href={r.invoice_link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                <ExternalLink size={12} color="#94a3b8" />
              </a>
            </Tooltip>
          )}
        </span>
      ),
    },
    created_date: {
      title: <ColumnSearchHeader title="Ngày lập" dataKey="created_date" filters={columnFilters} onFilterChange={handleColumnFilter} showFilters={showFilters} />,
      dataIndex: 'created_date',
      key: 'created_date',
      ...resizable('created_date'),
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    supplier_code: {
      title: <ColumnSearchHeader title="Nhà cung cấp" dataKey="supplier_code" filters={columnFilters} onFilterChange={handleColumnFilter} showFilters={showFilters} />,
      dataIndex: 'supplier_code',
      key: 'supplier_code',
      ...resizable('supplier_code'),
      render: (v: string, r: ShipmentRecord) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Tag color="cyan" style={{ fontWeight: 600, margin: 0 }}>{v}</Tag>
          {r.supplier_link && (
            <a href={r.supplier_link} target="_blank" rel="noreferrer" title="Website NCC">
              <ExternalLink size={11} color="#64748b" />
            </a>
          )}
        </span>
      ),
    },
    products: {
      title: <ColumnSearchHeader title="Sản phẩm" dataKey="products" filters={columnFilters} onFilterChange={handleColumnFilter} showFilters={showFilters} />,
      dataIndex: 'products',
      key: 'products',
      ...resizable('products'),
      render: (v: string) => {
        const displayValue = v && v.length > 50 ? `${v.substring(0, 50)}...` : v;
        return (
          <Tooltip title={v} placement="topLeft">
            <span style={{ color: '#334155', fontWeight: 500, fontSize: 13 }}>{displayValue || '—'}</span>
          </Tooltip>
        );
      },
    },
    coa_status: {
      title: <ColumnSearchHeader title="COA" dataKey="coa_status" filters={columnFilters} onFilterChange={handleColumnFilter} align="center" showFilters={showFilters} />,
      dataIndex: 'coa_status',
      key: 'coa_status',
      align: 'center',
      ...resizable('coa_status'),
      render: (v: string) => <Tag color={COA_COLOR[v] || 'default'} style={{ margin: 0, fontWeight: 500 }}>{v}</Tag>,
    },
    label_status: {
      title: <ColumnSearchHeader title="Nhãn phụ" dataKey="label_status" filters={columnFilters} onFilterChange={handleColumnFilter} align="center" showFilters={showFilters} />,
      dataIndex: 'label_status',
      key: 'label_status',
      align: 'center',
      ...resizable('label_status'),
      render: (v: string) => <Tag color={LABEL_COLOR[v] || 'default'} style={{ margin: 0, fontWeight: 500 }}>{v}</Tag>,
    },
    progress_status: {
      title: <ColumnSearchHeader title="Tiến độ" dataKey="progress_status" filters={columnFilters} onFilterChange={handleColumnFilter} align="center" showFilters={showFilters} />,
      dataIndex: 'progress_status',
      key: 'progress_status',
      align: 'center',
      ...resizable('progress_status'),
      render: (v: string) => (
        <Tag color={PROGRESS_COLOR[v] || 'default'} style={{ margin: 0, fontWeight: 600 }}>
          {PROGRESS_LABEL[v] || v}
        </Tag>
      ),
    },
    temp_out_of_range: {
      title: <ColumnSearchHeader title="Cảnh báo nhiệt" dataKey="temp_out_of_range_details" filters={columnFilters} onFilterChange={handleColumnFilter} showFilters={showFilters} />,
      key: 'temp_out_of_range',
      ...resizable('temp_out_of_range'),
      render: (_: any, r: ShipmentRecord) => {
        if (r.temp_out_of_range) {
          return (
            <Tooltip title={r.temp_out_of_range_details}>
              <Tag color="red" icon={<AlertTriangle size={12} />} style={{ fontWeight: 600, margin: 0 }}>
                Lệch: {r.temp_out_of_range_details || 'Báo đỏ'}
              </Tag>
            </Tooltip>
          );
        }
        if (r.has_data_logger) {
          return <Tag color="green" style={{ margin: 0 }}>✅ Đạt ({r.data_logger_type || 'Logger'})</Tag>;
        }
        return <span style={{ color: '#94a3b8', fontSize: 12 }}>Không có logger</span>;
      },
    },
    import_dates: {
      title: <ColumnSearchHeader title="Ngày nhập kho" dataKey="actual_import_date_note" filters={columnFilters} onFilterChange={handleColumnFilter} showFilters={showFilters} />,
      key: 'import_dates',
      ...resizable('import_dates'),
      render: (_: any, r: ShipmentRecord) => {
        return (
          <div style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {r.target_warehouse && (
              <div>
                <Tag color={r.target_warehouse === 'Kho Long Hậu' ? 'blue' : 'purple'} style={{ fontSize: 10, margin: 0, padding: '0 4px' }}>
                  {r.target_warehouse}
                </Tag>
              </div>
            )}
            <div><strong>{r.actual_import_date_note || '—'}</strong></div>
          </div>
        );
      },
    },
    actions: {
      title: <div style={{ fontWeight: 600, fontSize: 12, textAlign: 'center' }}>Thao tác</div>,
      key: 'actions',
      fixed: 'right',
      align: 'center',
      ...resizable('actions'),
      render: (_: any, r: ShipmentRecord) => (
        <Space size={2}>
          <Tooltip title="Xem & Sửa">
            <Button
              type="text"
              size="small"
              icon={<Edit size={14} color="#0d9488" />}
              onClick={() => handleOpenDetail(r)}
            />
          </Tooltip>
          {simulatedRole === 'QA_NHAP_KHAU' && (
            <Tooltip title="Xóa">
              <Popconfirm
                title="Xóa Invoice"
                description="Bạn có chắc chắn muốn xóa chuyến hàng này?"
                onConfirm={() => handleDeleteShipment(r.invoice_number)}
                okText="Xóa"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
              >
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<Trash2 size={14} />}
                />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  };

  // Build columns based on visibility preferences
  const tableColumns = useMemo(() => {
    const visibleConfigs = prefs.columnConfigs.filter(c => c.visible);
    return visibleConfigs
      .map(c => {
        const def = allColumnDefs[c.key];
        if (!def) return null;
        return {
          ...def,
          width: prefs.columnWidths[c.key] ?? DEFAULT_IMPORT_WIDTHS[c.key] ?? 100,
        };
      })
      .filter(Boolean) as ColumnsType<ShipmentRecord>;
  }, [prefs.columnConfigs, prefs.columnWidths, allColumnDefs]);

  // Determine row highlighting styles based on progress status or temp warnings
  const rowClassName = (record: ShipmentRecord) => {
    if (record.progress_status === 'Issue') return 'row-highlight-issue';
    if (record.temp_out_of_range) return 'row-highlight-temp-alert';
    return '';
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {contextHolder}
      
      {/* Dynamic CSS styles injection for table row highlighting & smooth card hover */}
      <style>{`
        .row-highlight-issue {
          background-color: rgba(254, 242, 242, 0.75) !important;
        }
        .row-highlight-issue:hover > td {
          background-color: rgba(254, 226, 226, 0.9) !important;
        }
        .row-highlight-temp-alert {
          background-color: rgba(255, 251, 235, 0.75) !important;
        }
        .row-highlight-temp-alert:hover > td {
          background-color: rgba(254, 243, 199, 0.9) !important;
        }
        .metric-card-hover {
          transition: all 250ms ease;
          border: 1px solid rgba(255,255,255,0.5);
        }
        .metric-card-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(13, 148, 136, 0.08);
          border-color: rgba(13, 148, 136, 0.2);
        }
        .portal-table .ant-table-thead > tr > th {
          background: #f8fafc !important;
          border-bottom: 2px solid #edf2f7 !important;
        }
      `}</style>

      {/* ──────────────────────────────────────────────────
         Header Section
         ────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 16,
        borderBottom: '1px solid #e2e8f0',
        marginBottom: 16,
        gap: 16,
        flexWrap: 'wrap'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#134e4a' }}>
            IMP (Nhập khẩu)
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
            Theo dõi tiến độ duyệt COA, nhãn phụ, dữ liệu nhiệt độ data logger và thực tế nhập kho.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Simulated Persona Selector */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '3px 8px',
            background: '#f1f5f9',
            borderRadius: 10,
            border: '1px solid #e2e8f0'
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Info size={13} color="#0d9488" /> Vai trò giả lập:
            </span>
            <Segmented
              options={[
                { label: 'QA Nhập khẩu', value: 'QA_NHAP_KHAU' },
                { label: 'QA Kho', value: 'QA_KHO' }
              ]}
              value={simulatedRole}
              onChange={(val) => setSimulatedRole(val as any)}
              style={{ background: '#e2e8f0', borderRadius: 8 }}
            />
          </div>

          {/* Actions */}
          <Space>
            <Button
              icon={<RefreshCw size={14} />}
              onClick={handleRefreshAll}
              loading={loading}
              style={{ borderRadius: 8 }}
            >
              Làm mới
            </Button>
            {simulatedRole === 'QA_NHAP_KHAU' && (
              <Button
                type="primary"
                icon={<Plus size={14} />}
                onClick={handleCreateNew}
                style={{ background: '#0d9488', borderColor: '#0d9488', borderRadius: 8 }}
              >
                Tạo Invoice
              </Button>
            )}
          </Space>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────
         Statistics Cards
         ────────────────────────────────────────────────── */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={12} md={4} lg={4}>
          <Card className="metric-card-hover" style={{ borderRadius: 12, background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)' }} bodyStyle={{ padding: 12 }}>
            <Statistic
              title={<span style={{ color: '#0f766e', fontWeight: 600, fontSize: 12 }}>Tổng số Invoice</span>}
              value={stats.total}
              valueStyle={{ color: '#134e4a', fontWeight: 800, fontSize: 20 }}
              prefix={<FileText size={16} style={{ marginRight: 6 }} color="#0d9488" />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={5} lg={5}>
          <Card className="metric-card-hover" style={{ borderRadius: 12, background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' }} bodyStyle={{ padding: 12 }}>
            <Statistic
              title={<span style={{ color: '#1d4ed8', fontWeight: 600, fontSize: 12 }}>Chờ Duyệt Chứng Từ</span>}
              value={stats.pendingInbound} // In this context checking + inbound is represented
              valueStyle={{ color: '#1e3a8a', fontWeight: 800, fontSize: 20 }}
              prefix={<Clock size={16} style={{ marginRight: 6 }} color="#2563eb" />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={5} lg={5}>
          <Card className="metric-card-hover" style={{ borderRadius: 12, background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)' }} bodyStyle={{ padding: 12 }}>
            <Statistic
              title={<span style={{ color: '#b45309', fontWeight: 600, fontSize: 12 }}>Chờ Nhập Kho Vật Lý</span>}
              value={stats.pendingInbound}
              valueStyle={{ color: '#78350f', fontWeight: 800, fontSize: 20 }}
              prefix={<Filter size={16} style={{ marginRight: 6 }} color="#d97706" />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={5} lg={5}>
          <Card className="metric-card-hover" style={{ borderRadius: 12, background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)' }} bodyStyle={{ padding: 12 }}>
            <Statistic
              title={<span style={{ color: '#b91c1c', fontWeight: 600, fontSize: 12 }}>Vấn Đề / Lệch Nhiệt</span>}
              value={stats.issues}
              valueStyle={{ color: '#7f1d1d', fontWeight: 800, fontSize: 20 }}
              prefix={<AlertTriangle size={16} style={{ marginRight: 6 }} color="#dc2626" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={24} md={5} lg={5}>
          <Card className="metric-card-hover" style={{ borderRadius: 12, background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' }} bodyStyle={{ padding: 12 }}>
            <Statistic
              title={<span style={{ color: '#15803d', fontWeight: 600, fontSize: 12 }}>Hoàn Tất Lưu Trữ</span>}
              value={stats.closed}
              valueStyle={{ color: '#14532d', fontWeight: 800, fontSize: 20 }}
              prefix={<CheckCircle2 size={16} style={{ marginRight: 6 }} color="#16a34a" />}
            />
          </Card>
        </Col>
      </Row>

      {/* ──────────────────────────────────────────────────
         Filter & Table controls
         ────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#f8fafc',
        padding: '8px 12px',
        borderRadius: 8,
        marginBottom: 10,
        gap: 12
      }}>
        {/* Search */}
        <Input
          placeholder="Tìm theo số Invoice, Supplier, Tên sản phẩm..."
          prefix={<Search size={14} color="#94a3b8" />}
          value={globalSearch}
          onChange={(e) => {
            setGlobalSearch(e.target.value);
            setCurrentPage(1);
          }}
          allowClear
          style={{ maxWidth: 360, borderRadius: 6 }}
        />

        {/* Visibility Controls */}
        <TableControls
          showFilters={showFilters}
          onToggleFilters={() => savePrefs({ showFilters: !showFilters })}
          columns={prefs.columnConfigs}
          onColumnsChange={(cols) => savePrefs({ columnConfigs: cols })}
        />
      </div>

      {/* ──────────────────────────────────────────────────
         Main Shipment Table
         ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Table
          className="portal-table"
          components={{ header: { cell: ResizableTitle } }}
          columns={tableColumns}
          dataSource={rawData}
          loading={loading}
          rowKey="invoice_number"
          rowClassName={rowClassName}
          size="small"
          scroll={{ x: 'max-content', y: 'calc(100vh - 360px)' }}
          pagination={{
            size: 'small',
            current: currentPage,
            pageSize: pageSize,
            total: totalCount,
            onChange: (p, s) => {
              setCurrentPage(p);
              setPageSize(s);
            },
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total) => `Tổng ${total} bản ghi`,
            style: { margin: '8px 0 0' },
          }}
          style={{ background: 'white', borderRadius: 8 }}
        />
      </div>

      {/* ──────────────────────────────────────────────────
         Master-Detail Drawer / Form
         ────────────────────────────────────────────────── */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              background: 'linear-gradient(135deg, #0d9488, #2dd4bf)',
              width: 32,
              height: 32,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <FileText size={16} color="white" />
            </span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0f766e', lineHeight: 1.2 }}>
                {isNew ? 'Khởi tạo Lô hàng Nhập khẩu' : 'Chi tiết Lô hàng Nhập khẩu'}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                Đang sửa với vai trò: <strong style={{ color: '#0d9488' }}>{simulatedRole === 'QA_NHAP_KHAU' ? 'QA Nhập khẩu' : 'QA Kho'}</strong>
              </div>
            </div>
          </div>
        }
        width={780}
        onClose={() => setDetailRow(null)}
        open={!!detailRow}
        extra={
          <Space>
            <Button onClick={() => setDetailRow(null)} style={{ borderRadius: 6 }}>
              Hủy
            </Button>
            <Button
              type="primary"
              onClick={handleSave}
              loading={saving}
              style={{ background: '#0d9488', borderColor: '#0d9488', borderRadius: 6 }}
            >
              Lưu thay đổi
            </Button>
          </Space>
        }
        bodyStyle={{ padding: '20px 24px', background: '#f8fafc' }}
      >
        {detailRow && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            
            {/* Persona Notice */}
            <div style={{
              background: 'rgba(13,148,136,0.06)',
              border: '1px dashed rgba(13,148,136,0.3)',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 12,
              color: '#0f766e',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <AlertCircle size={15} color="#0d9488" style={{ flexShrink: 0 }} />
              <div>
                <strong>Lưu ý:</strong> Để sửa các trường bị mờ, vui lòng chuyển đổi <strong>Vai trò giả lập</strong> ở thanh công cụ phía trên trang.
              </div>
            </div>

            {/* PART 1: MASTER SHIPMENT INFO */}
            <div style={{ background: 'white', padding: 18, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: 13, fontWeight: 700, color: '#334155', borderLeft: '3px solid #0d9488', paddingLeft: 8 }}>
                THÔNG TIN CHUNG (MASTER)
              </h3>
              
              <Row gutter={[16, 16]}>
                {/* Invoice Number */}
                <Col span={12}>
                  <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, color: '#475569' }}>Số Invoice *</div>
                  <Input
                    placeholder="VD: INUK-240025"
                    value={detailRow.invoice_number}
                    onChange={(e) => updateField('invoice_number', e.target.value)}
                    disabled={!isNew || simulatedRole !== 'QA_NHAP_KHAU'}
                    style={{ borderRadius: 6 }}
                  />
                </Col>

                {/* Created Date */}
                <Col span={12}>
                  <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, color: '#475569' }}>Ngày nhận mail *</div>
                  <DatePicker
                    value={detailRow.created_date ? dayjs(detailRow.created_date) : null}
                    onChange={(date) => updateField('created_date', date ? date.format('YYYY-MM-DD') : '')}
                    disabled={simulatedRole !== 'QA_NHAP_KHAU'}
                    style={{ width: '100%', borderRadius: 6 }}
                    format="DD/MM/YYYY"
                    allowClear={false}
                  />
                </Col>

                {/* Supplier Code */}
                <Col span={12}>
                  <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, color: '#475569' }}>NCC/ Hãng *</div>
                  <Select
                    showSearch
                    placeholder="Chọn hoặc nhập NCC"
                    optionFilterProp="label"
                    value={detailRow.supplier_code || undefined}
                    onChange={(val) => updateField('supplier_code', val)}
                    disabled={simulatedRole !== 'QA_NHAP_KHAU'}
                    style={{ width: '100%' }}
                    options={suppliersList.map(s => ({ value: s, label: s }))}
                    dropdownStyle={{ borderRadius: 8 }}
                  />
                </Col>

                {/* Document Links */}
                <Col span={12}>
                  <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, color: '#475569' }}>Link INV</div>
                  {(() => {
                    const link = detailRow.supplier_code 
                      ? `\\\\hd.domain\\hoangducdfs\\TAILIEUPHONG-HD\\P.QA\\7. LONG HAU\\7. CAC THEO DOI TRONG QUA TRINH\\18. FORM MAU CHO FOLDER NHA SAN XUAT\\${detailRow.supplier_code}`
                      : '';
                    return (
                      <Input
                        value={link}
                        placeholder="Chọn NCC để tạo link..."
                        disabled
                        style={{ borderRadius: 6, background: '#f8fafc' }}
                        suffix={
                          link && (
                            <Tooltip title="Copy đường dẫn">
                              <Button
                                type="text"
                                size="small"
                                icon={<Folder size={14} />}
                                onClick={() => {
                                  navigator.clipboard.writeText(link);
                                  messageApi.success('Đã copy đường dẫn Link INV!');
                                }}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              />
                            </Tooltip>
                          )
                        }
                      />
                    );
                  })()}
                </Col>

                <Col span={12}>
                  <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, color: '#475569' }}>Link hãng</div>
                  {(() => {
                    const link = (detailRow.supplier_code && detailRow.invoice_number)
                      ? `\\\\hd.domain\\hoangducdfs\\TAILIEUPHONG-HD\\P.QA\\7. LONG HAU\\7. CAC THEO DOI TRONG QUA TRINH\\18. FORM MAU CHO FOLDER NHA SAN XUAT\\${detailRow.supplier_code}\\5. THONG TIN NHAP - PHAN PHOI\\1. KIEM NHAP\\${detailRow.invoice_number}`
                      : '';
                    return (
                      <Input
                        value={link}
                        placeholder="Nhập Invoice & NCC để tạo link..."
                        disabled
                        style={{ borderRadius: 6, background: '#f8fafc' }}
                        suffix={
                          link && (
                            <Tooltip title="Copy đường dẫn">
                              <Button
                                type="text"
                                size="small"
                                icon={<Folder size={14} />}
                                onClick={() => {
                                  navigator.clipboard.writeText(link);
                                  messageApi.success('Đã copy đường dẫn Link Hãng!');
                                }}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              />
                            </Tooltip>
                          )
                        }
                      />
                    );
                  })()}
                </Col>
              </Row>
            </div>

            {/* PART 2: QA VERIFICATION INFO */}
            <div style={{ background: 'white', padding: 18, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: 13, fontWeight: 700, color: '#334155', borderLeft: '3px solid #3b82f6', paddingLeft: 8 }}>
                KIỂM DUYỆT CHỨNG TỪ & NHIỆT ĐỘ (QA)
              </h3>

              <Row gutter={[16, 16]}>
                {/* COA Status */}
                <Col span={8}>
                  <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, color: '#475569' }}>Trạng thái COA</div>
                  <Select
                    value={detailRow.coa_status}
                    onChange={(val) => updateField('coa_status', val)}
                    disabled={simulatedRole !== 'QA_NHAP_KHAU'}
                    style={{ width: '100%' }}
                    options={COA_STATUS_OPTIONS}
                  />
                </Col>

                {/* Label Status (Auto calculated, read-only tag) */}
                <Col span={8}>
                  <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, color: '#475569' }}>Nhãn phụ</div>
                  <div style={{
                    padding: '5px 12px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    minHeight: 32,
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <Tag color={LABEL_COLOR[computedLabelStatus] || 'default'} style={{ margin: 0, fontWeight: 500 }}>
                      {computedLabelStatus}
                    </Tag>
                  </div>
                </Col>

                {/* Progress Status */}
                <Col span={8}>
                  <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, color: '#475569' }}>Tiến độ tổng</div>
                  <Select
                    value={detailRow.progress_status}
                    onChange={(val) => updateField('progress_status', val)}
                    style={{ width: '100%' }}
                    options={PROGRESS_STATUS_OPTIONS}
                  />
                </Col>

                {/* Has Data Logger */}
                <Col span={24}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Switch
                        checked={detailRow.has_data_logger}
                        onChange={(val) => updateField('has_data_logger', val)}
                      />
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>Data Logger kèm hàng</span>
                    </div>

                    {detailRow.has_data_logger && (
                      <Space size="middle" style={{ marginLeft: 16 }}>
                        <div>
                          <span style={{ fontSize: 11, color: '#64748b', marginRight: 6 }}>Loại logger:</span>
                          <Input
                            placeholder="VD: TempTale 4"
                            value={detailRow.data_logger_type || ''}
                            onChange={(e) => updateField('data_logger_type', e.target.value)}
                            size="small"
                            style={{ width: 120, borderRadius: 4 }}
                          />
                        </div>
                        <div>
                          <span style={{ fontSize: 11, color: '#64748b', marginRight: 6 }}>Số lượng:</span>
                          <InputNumber
                            min={0}
                            value={detailRow.logger_qty}
                            onChange={(val) => updateField('logger_qty', val || 0)}
                            size="small"
                            style={{ width: 80, borderRadius: 4 }}
                          />
                        </div>
                      </Space>
                    )}
                  </div>
                </Col>

                {/* Temperature Out of Range */}
                <Col span={24}>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    background: detailRow.temp_out_of_range ? '#fef2f2' : '#f8fafc',
                    padding: 12,
                    borderRadius: 8,
                    border: detailRow.temp_out_of_range ? '1px dashed #fca5a5' : '1px solid #f1f5f9',
                    transition: 'all 200ms ease'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Switch
                        checked={detailRow.temp_out_of_range}
                        onChange={(val) => updateField('temp_out_of_range', val)}
                      />
                      <span style={{ fontSize: 12, fontWeight: 600, color: detailRow.temp_out_of_range ? '#991b1b' : '#334155' }}>
                        🔴 NHIỆT ĐỘ VƯỢT NGƯỠNG (Out of Range)
                      </span>
                    </div>

                    {detailRow.temp_out_of_range && (
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, color: '#991b1b' }}>
                          Chi tiết chênh lệch nhiệt độ (VD: max 30.5°C trong 4h) *
                        </div>
                        <Input.TextArea
                          rows={2}
                          placeholder="Mô tả chi tiết thời gian và mức lệch nhiệt để QA làm báo cáo đánh giá..."
                          value={detailRow.temp_out_of_range_details || ''}
                          onChange={(e) => updateField('temp_out_of_range_details', e.target.value)}
                          style={{ borderRadius: 6 }}
                        />
                      </div>
                    )}
                  </div>
                </Col>
              </Row>
            </div>

            {/* PART 3: WAREHOUSE ACTUAL RECEIVED INFO */}
            <div style={{ background: 'white', padding: 18, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: 13, fontWeight: 700, color: '#334155', borderLeft: '3px solid #f59e0b', paddingLeft: 8 }}>
                THỜI GIAN NHẬP KHO THỰC TẾ (WAREHOUSE / KHO)
              </h3>

              <Row gutter={[16, 16]}>
                {/* Warehouse Dropdown */}
                <Col span={12}>
                  <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, color: '#475569' }}>Kho</div>
                  <Select
                    placeholder="Chọn Kho nhận hàng"
                    value={detailRow.target_warehouse || undefined}
                    onChange={(val) => updateField('target_warehouse', val)}
                    disabled={simulatedRole !== 'QA_NHAP_KHAU'}
                    style={{ width: '100%' }}
                    options={[
                      { value: 'Kho Long Hậu', label: 'Kho Long Hậu' },
                      { value: 'Kho Hưng Yên', label: 'Kho Hưng Yên' }
                    ]}
                    allowClear
                  />
                </Col>

                {/* Actual Import Date Note */}
                <Col span={12}>
                  <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, color: '#475569' }}>Ngày nhập (Ghi chú thực tế)</div>
                  <Input
                    placeholder="VD: Đã nhập kho LH 25/06/2026, Đang vận chuyển..."
                    value={detailRow.actual_import_date_note || ''}
                    onChange={(e) => updateField('actual_import_date_note', e.target.value)}
                    style={{ borderRadius: 6 }}
                  />
                </Col>
              </Row>
            </div>

            {/* PART 4: DETAIL PRODUCTS SECTION */}
            <div style={{ background: 'white', padding: 18, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#334155', borderLeft: '3px solid #14b8a6', paddingLeft: 8 }}>
                  DANH SÁCH CHI TIẾT SẢN PHẨM (DETAIL)
                </h3>
                {simulatedRole === 'QA_NHAP_KHAU' && (
                  <Button
                    type="dashed"
                    size="small"
                    icon={<PlusCircle size={14} />}
                    onClick={handleAddItem}
                    style={{ borderRadius: 6, color: '#0d9488', borderColor: '#0d9488' }}
                  >
                    Thêm sản phẩm
                  </Button>
                )}
              </div>

              {detailRow.imp_shipment_items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 8px', border: '1px dashed #cbd5e1', borderRadius: 8, color: '#94a3b8' }}>
                  Không có sản phẩm nào trong chuyến hàng này.
                  {simulatedRole === 'QA_NHAP_KHAU' && ' Bấm "Thêm sản phẩm" ở trên để tạo mới.'}
                </div>
              ) : (
                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                  {detailRow.imp_shipment_items.map((item, idx) => (
                    <div
                      key={item.id || `new-item-${idx}`}
                      style={{
                        padding: 14,
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        background: '#f8fafc',
                        position: 'relative'
                      }}
                    >
                      {/* Delete button (SCM only) */}
                      {simulatedRole === 'QA_NHAP_KHAU' && (
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<Trash2 size={14} />}
                          style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}
                          onClick={() => handleRemoveItem(idx)}
                        />
                      )}

                      <Row gutter={[12, 12]}>
                        {/* Match Item Code */}
                        <Col span={10}>
                          <div style={{ marginBottom: 4, fontSize: 10, fontWeight: 600, color: '#64748b' }}>
                            Mã Danh Mục (Item Code)
                          </div>
                          <Select
                            showSearch
                            placeholder="Khớp mã SP..."
                            optionFilterProp="label"
                            value={item.item_code || undefined}
                            onChange={(val) => updateItemField(idx, 'item_code', val)}
                            disabled={simulatedRole !== 'QA_NHAP_KHAU'}
                            style={{ width: '100%' }}
                            options={masterItems.map(m => ({ value: m.item_code, label: `[${m.item_code}] ${m.item_name}` }))}
                            dropdownStyle={{ borderRadius: 8 }}
                            popupMatchSelectWidth={false}
                            allowClear
                          />
                        </Col>

                        {/* Item Name (Free text / Auto filled) */}
                        <Col span={14}>
                          <div style={{ marginBottom: 4, fontSize: 10, fontWeight: 600, color: '#64748b' }}>
                            Tên sản phẩm thực tế nhập *
                          </div>
                          <Input
                            placeholder="Nhập tên chi tiết thuốc, hàm lượng, đóng gói..."
                            value={item.item_name}
                            onChange={(e) => updateItemField(idx, 'item_name', e.target.value)}
                            disabled={simulatedRole !== 'QA_NHAP_KHAU'}
                            style={{ borderRadius: 6, paddingRight: 24 }}
                          />
                        </Col>

                        {/* Required Stamps/Labels (Realtime from master data + Manual customization) */}
                        {item.item_code && (
                          <Col span={24}>
                            {(() => {
                              const isCustomized = !!(item.required_labels && Array.isArray(item.required_labels));
                              const reqLabels = isCustomized ? item.required_labels! : getProductLabels(item.item_code);
                              const hasLabels = reqLabels && reqLabels.length > 0;
                              
                              return (
                                <div style={{
                                  background: 'rgba(13,148,136,0.04)',
                                  border: '1px dashed rgba(13,148,136,0.3)',
                                  padding: '8px 12px',
                                  borderRadius: 8,
                                  marginTop: 4,
                                  marginBottom: 4
                                }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0f766e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <span style={{ fontSize: 13 }}>🏷️</span> Tem/Nhãn bắt buộc bổ sung:
                                    </span>
                                    
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span style={{
                                        fontSize: 9,
                                        fontWeight: 600,
                                        color: isCustomized ? '#d97706' : '#0d9488',
                                        background: isCustomized ? '#fef3c7' : '#ccfbf1',
                                        padding: '2px 6px',
                                        borderRadius: 4
                                      }}>
                                        {isCustomized ? 'Tùy chỉnh (Manual)' : 'Master Data Realtime'}
                                      </span>
                                      
                                      {simulatedRole === 'QA_NHAP_KHAU' && (
                                        <Space size={4}>
                                          <Button
                                            type="link"
                                            size="small"
                                            onClick={() => handleOpenCustomLabelModal(idx, reqLabels)}
                                            style={{ padding: 0, height: 'auto', fontSize: 11, color: '#2563eb' }}
                                          >
                                            [Tùy chỉnh]
                                          </Button>
                                          {isCustomized && (
                                            <Button
                                              type="link"
                                              size="small"
                                              onClick={() => handleResetLabels(idx)}
                                              style={{ padding: 0, height: 'auto', fontSize: 11, color: '#dc2626' }}
                                            >
                                              [Reset]
                                            </Button>
                                          )}
                                        </Space>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {hasLabels ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                      {reqLabels.map((lbl, lidx) => (
                                        <div key={lidx} style={{ fontSize: 11, color: '#334155', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                          <span>• <strong style={{ color: '#0d9488' }}>{lbl.code}</strong> - {lbl.name}</span>
                                          <span style={{ whiteSpace: 'nowrap' }}>Tỷ lệ: <strong style={{ color: '#0f766e' }}>{lbl.qty} cái/SP</strong></span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
                                      Chưa có yêu cầu tem nhãn bổ sung
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </Col>
                        )}
                      </Row>
                    </div>
                  ))}
                </Space>
              )}
            </div>

            {/* PART 5: SHIPMENT ISSUES LIST */}
            <div style={{ background: 'white', padding: 18, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#334155', borderLeft: '3px solid #ef4444', paddingLeft: 8 }}>
                  DANH SÁCH VẤN ĐỀ & HƯỚNG XỬ LÝ (QA)
                </h3>
                <Button
                  type="dashed"
                  size="small"
                  icon={<PlusCircle size={14} />}
                  onClick={handleAddIssue}
                  style={{ borderRadius: 6, color: '#dc2626', borderColor: '#dc2626' }}
                >
                  Thêm vấn đề
                </Button>
              </div>

              {(detailRow.issues || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 8px', border: '1px dashed #fca5a5', borderRadius: 8, color: '#94a3b8', fontSize: 12 }}>
                  Không có vấn đề phát sinh nào được ghi nhận cho hóa đơn này.
                </div>
              ) : (
                <Space direction="vertical" style={{ width: '100%' }} size={10}>
                  {(detailRow.issues || []).map((issue, idx) => (
                    <div
                      key={issue.id || `issue-${idx}`}
                      style={{
                        padding: 12,
                        border: '1px solid #fee2e2',
                        borderRadius: 8,
                        background: '#fff5f5',
                        position: 'relative'
                      }}
                    >
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<Trash2 size={13} />}
                        style={{ position: 'absolute', top: 6, right: 6, zIndex: 10 }}
                        onClick={() => handleRemoveIssue(idx)}
                      />

                      <Row gutter={[12, 12]}>
                        <Col span={12}>
                          <div style={{ marginBottom: 4, fontSize: 10, fontWeight: 600, color: '#991b1b' }}>Vấn đề *</div>
                          <Input.TextArea
                            rows={1}
                            placeholder="Nhập chi tiết vấn đề phát sinh..."
                            value={issue.issue_text || ''}
                            onChange={(e) => updateIssueField(idx, 'issue_text', e.target.value)}
                            style={{ borderRadius: 6 }}
                          />
                        </Col>
                        <Col span={12}>
                          <div style={{ marginBottom: 4, fontSize: 10, fontWeight: 600, color: '#991b1b' }}>Hướng xử lý</div>
                          <Input.TextArea
                            rows={1}
                            placeholder="Nhập hướng xử lý..."
                            value={issue.resolution_text || ''}
                            onChange={(e) => updateIssueField(idx, 'resolution_text', e.target.value)}
                            style={{ borderRadius: 6 }}
                          />
                        </Col>
                      </Row>
                    </div>
                  ))}
                </Space>
              )}
            </div>

          </Space>
        )}
      </Drawer>

      {/* Custom required labels modal */}
      <Modal
        title="Tùy chỉnh Tem nhãn bắt buộc"
        open={customLabelModalVisible}
        onOk={handleSaveCustomLabels}
        onCancel={() => {
          setCustomLabelModalVisible(false);
          setEditingItemIdx(null);
        }}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        width={600}
        destroyOnClose
      >
        <div style={{ marginBottom: 12, fontSize: 12, color: '#64748b' }}>
          Khai báo danh sách tem nhãn bắt buộc dán bổ sung cho dòng sản phẩm này.
        </div>
        
        <Row gutter={8} style={{ marginBottom: 8, fontWeight: 600, color: '#475569', fontSize: 12 }}>
          <Col span={12}>Chọn Tem/Nhãn (từ Master Data)</Col>
          <Col span={8}>Tỷ lệ (Cái/SP)</Col>
          <Col span={4} style={{ textAlign: 'center' }}>Xóa</Col>
        </Row>
        
        {tempLabelsList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px 8px', color: '#94a3b8', fontSize: 12, border: '1px dashed #e2e8f0', borderRadius: 8, margin: '8px 0' }}>
            Chưa thêm tem nhãn nào. Bấm nút bên dưới để thêm.
          </div>
        ) : (
          tempLabelsList.map((lbl, lIdx) => (
            <Row gutter={8} key={lIdx} style={{ marginBottom: 8, display: 'flex', alignItems: 'center' }}>
              <Col span={12}>
                <Select
                  showSearch
                  placeholder="Chọn tem nhãn"
                  value={lbl.code || undefined}
                  onChange={(val) => {
                    const matchedItem = masterItems.find((x: any) => x.item_code === val);
                    const name = matchedItem ? matchedItem.item_name : 'Không rõ tên nhãn';
                    const updated = [...tempLabelsList];
                    updated[lIdx] = { ...updated[lIdx], code: val, name };
                    setTempLabelsList(updated);
                  }}
                  optionFilterProp="label"
                  style={{ width: '100%' }}
                  options={masterItems.map((x: any) => ({
                    value: x.item_code,
                    label: `[${x.item_code}] ${x.item_name}`
                  }))}
                  dropdownStyle={{ borderRadius: 8 }}
                  popupMatchSelectWidth={false}
                />
              </Col>
              <Col span={8}>
                <InputNumber
                  min={1}
                  value={lbl.qty}
                  onChange={(val) => {
                    const updated = [...tempLabelsList];
                    updated[lIdx] = { ...updated[lIdx], qty: Number(val) || 1 };
                    setTempLabelsList(updated);
                  }}
                  style={{ width: '100%' }}
                />
              </Col>
              <Col span={4} style={{ textAlign: 'center' }}>
                <Button
                  type="text"
                  danger
                  icon={<Trash2 size={16} />}
                  onClick={() => {
                    const updated = tempLabelsList.filter((_, idx) => idx !== lIdx);
                    setTempLabelsList(updated);
                  }}
                />
              </Col>
            </Row>
          ))
        )}
        
        <Button
          type="dashed"
          onClick={() => {
            setTempLabelsList([...tempLabelsList, { code: '', name: '', qty: 1 }]);
          }}
          icon={<Plus size={14} />}
          style={{ width: '100%', marginTop: 8 }}
        >
          Thêm Tem nhãn
        </Button>
      </Modal>
    </div>
  );
}
