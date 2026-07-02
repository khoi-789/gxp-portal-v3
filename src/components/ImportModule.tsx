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
  Calendar, PlusCircle, AlertCircle, Edit, Info, Copy, Folder,
  Thermometer
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
export interface ShipmentItem {
  id?: number;
  invoice_number: string;
  item_code: string | null;
  item_name: string;
  issue_notes: string | null;
  resolution_notes: string | null;
  created_at?: string;
  required_labels?: any[] | null; // Stored labels snapshot: { code: string, name: string, qty: number }[]
  coa_status?: string;
  visa_no?: string | null;
  decision_no?: string | null;
  valid_until?: string | null;
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
  { value: 'Đang sai sót', label: 'Chờ cập nhật' },
  { value: 'Đã cập nhật', label: 'Đạt' },
];

const LABEL_STATUS_OPTIONS = [
  { value: 'Chưa có', label: 'Chưa có' },
  { value: 'Đã cập nhật', label: 'Đã cập nhật' },
];

const PROGRESS_STATUS_OPTIONS = [
  { value: 'Khởi tạo', label: 'Khởi tạo' },
  { value: 'Đang xử lý', label: 'Đang xử lý' },
  { value: 'Hoàn tất', label: 'Hoàn tất' },
];

const PROGRESS_LABEL: Record<string, string> = {
  'Khởi tạo': 'Khởi tạo',
  'Đang xử lý': 'Đang xử lý',
  'Hoàn tất': 'Hoàn tất',
  // legacy fallbacks
  Created: 'Khởi tạo',
  Checking: 'Đang xử lý',
  'Pending Inbound': 'Đang xử lý',
  Issue: 'Đang xử lý',
  Closed: 'Hoàn tất',
};

const PROGRESS_COLOR: Record<string, string> = {
  'Khởi tạo': 'default',
  'Đang xử lý': 'processing',
  'Hoàn tất': 'success',
  // legacy fallbacks
  Created: 'default',
  Checking: 'processing',
  'Pending Inbound': 'warning',
  Issue: 'error',
  Closed: 'success',
};

const COA_COLOR: Record<string, string> = {
  'Đạt': 'success',
  'Chưa đạt': 'error',
  // legacy fallback
  'Chưa có': 'default',
  'Đã cập nhật': 'success',
  'Đang sai sót': 'error',
};

const LABEL_COLOR: Record<string, string> = {
  'Chờ bổ sung': 'warning',
  'Không': 'default',
  // legacy fallback
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
  filters: Record<string, string>,
  filterMissingItemCode?: boolean
): Promise<{ items: ShipmentRecord[]; count: number }> {
  let query = supabase
    .from('imp_shipments')
    .select('*, imp_shipment_items(*)', { count: 'exact' });

  // 0. Handle filterMissingItemCode
  if (filterMissingItemCode) {
    const { data: matchedItems } = await supabase
      .from('imp_shipment_items')
      .select('invoice_number')
      .or('item_code.is.null,item_code.eq.""');
    const invoiceNums = Array.from(new Set((matchedItems || []).map(x => x.invoice_number).filter(Boolean)));
    if (invoiceNums.length > 0) {
      query = query.in('invoice_number', invoiceNums);
    } else {
      query = query.eq('invoice_number', '____non_existent_invoice____');
    }
  }

  // 1. Handle products column search
  if (filters.products && filters.products.trim()) {
    const { data: matchedItems } = await supabase
      .from('imp_shipment_items')
      .select('invoice_number')
      .ilike('item_name', `%${filters.products.trim()}%`);
    const invoiceNums = Array.from(new Set((matchedItems || []).map(x => x.invoice_number).filter(Boolean)));
    if (invoiceNums.length > 0) {
      query = query.in('invoice_number', invoiceNums);
    } else {
      // Force empty results if no items match
      query = query.eq('invoice_number', '____non_existent_invoice____');
    }
  }

  // 2. Handle supplier_code column search (by supplier name)
  if (filters.supplier_code && filters.supplier_code.trim()) {
    const { data: matchedSuppliers } = await supabase
      .from('master_suppliers')
      .select('supplier_code')
      .or(`supplier_name.ilike.%${filters.supplier_code.trim()}%,supplier_code.ilike.%${filters.supplier_code.trim()}%`);
    
    const supplierCodes = Array.from(new Set((matchedSuppliers || []).map(x => x.supplier_code).filter(Boolean)));
    if (supplierCodes.length > 0) {
      query = query.in('supplier_code', supplierCodes);
    } else {
      query = query.eq('supplier_code', '____non_existent_supplier____');
    }
  }

  // 3. Handle global search (including searching through product names & supplier names)
  if (search.trim()) {
    const q = `%${search.trim()}%`;
    
    // Fetch matching suppliers
    const { data: matchedSuppliers } = await supabase
      .from('master_suppliers')
      .select('supplier_code')
      .or(`supplier_name.ilike.${q},supplier_code.ilike.${q}`);
    const supplierCodes = Array.from(new Set((matchedSuppliers || []).map(x => x.supplier_code).filter(Boolean)));

    // Fetch matching items
    const { data: matchedItems } = await supabase
      .from('imp_shipment_items')
      .select('invoice_number')
      .ilike('item_name', q);
    const invoiceNums = Array.from(new Set((matchedItems || []).map(x => x.invoice_number).filter(Boolean)));
    
    let orConditions = `invoice_number.ilike.${q}`;
    if (supplierCodes.length > 0) {
      const supplierInSql = `(${supplierCodes.map(c => `"${c}"`).join(',')})`;
      orConditions += `,supplier_code.in.${supplierInSql}`;
    } else {
      orConditions += `,supplier_code.ilike.${q}`;
    }
    
    if (invoiceNums.length > 0) {
      const arrayInSql = `(${invoiceNums.map(n => `"${n}"`).join(',')})`;
      orConditions += `,invoice_number.in.${arrayInSql}`;
    }
    
    query = query.or(orConditions);
  }

  const colMap: Record<string, string> = {
    invoice_number: 'invoice_number',
    coa_status: 'coa_status',
    label_status: 'label_status',
    progress_status: 'progress_status',
  };

  Object.entries(filters).forEach(([key, value]) => {
    if (!value || value.trim() === '') return;
    if (key === 'products') return; // Handled separately above
    if (key === 'supplier_code') return; // Handled separately above
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

const getInvoiceFolderLink = (supplierName: string, invoiceNumber: string) => {
  if (!supplierName || !invoiceNumber) return '';
  return `\\\\hd.domain\\hoangducdfs\\TAILIEUPHONG-HD\\P.QA\\7. LONG HAU\\7. CAC THEO DOI TRONG QUA TRINH\\18. FORM MAU CHO FOLDER NHA SAN XUAT\\${supplierName}\\5. THONG TIN NHAP - PHAN PHOI\\1. KIEM NHAP\\${invoiceNumber}`;
};

const getSupplierFolderLink = (supplierName: string) => {
  if (!supplierName) return '';
  return `\\\\hd.domain\\hoangducdfs\\TAILIEUPHONG-HD\\P.QA\\7. LONG HAU\\7. CAC THEO DOI TRONG QUA TRINH\\18. FORM MAU CHO FOLDER NHA SAN XUAT\\${supplierName}`;
};

export default function ImportModule({ userId = 'default' }: { userId?: string }) {
  const [messageApi, contextHolder] = message.useMessage();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterMissingItemCode, setFilterMissingItemCode] = useState(false);

  // Simulated Persona
  const [simulatedRole, setSimulatedRole] = useState<'QA_NHAP_KHAU' | 'QA_KHO'>('QA_NHAP_KHAU');

  // Master product data for select list (load all for dropdowns)
  const { data: masterItemsRaw = [] } = useMasterItems();
  const masterItems = useMemo(() => masterItemsRaw.filter(x => x.is_active), [masterItemsRaw]);

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
  const impQueryKey = ['imp_shipments', currentPage, pageSize, globalSearch, columnFilters, filterMissingItemCode];
  const { data: impResult, isLoading: loading, refetch: loadData } = useQuery({
    queryKey: impQueryKey,
    queryFn: () => fetchShipments(currentPage, pageSize, globalSearch, columnFilters, filterMissingItemCode),
    placeholderData: (prev) => prev,
  });

  const rawData = impResult?.items || [];
  const totalCount = impResult?.count || 0;

  // Helper to copy network folder path to clipboard
  const handleCopyLink = (e: React.MouseEvent, path: string, type: 'invoice' | 'supplier') => {
    e.stopPropagation();
    e.preventDefault();
    if (!path) return;
    navigator.clipboard.writeText(path).then(() => {
      messageApi.success(
        type === 'invoice'
          ? `Đã copy đường dẫn thư mục kiểm nhập Invoice! Bạn có thể dán vào File Explorer để mở.`
          : `Đã copy đường dẫn thư mục gốc Nhà cung cấp! Bạn có thể dán vào File Explorer để mở.`
      );
    }).catch(err => {
      messageApi.error('Không thể copy đường dẫn: ' + err);
    });
  };

  // Drawer / Form state
  const [detailRow, setDetailRow] = useState<ShipmentRecord | null>(null);
  const [isNew, setIsNew] = useState(false);
  
  // Track original detail items for smart DB updates
  const [originalItems, setOriginalItems] = useState<ShipmentItem[]>([]);
  // Snapshot of original master row for Audit Log diff
  const [originalRow, setOriginalRow] = useState<ShipmentRecord | null>(null);
  const isClosed = originalRow ? (originalRow.progress_status === 'Hoàn tất' || originalRow.progress_status === 'Closed') : false;
  // Active drawer tab
  const [drawerTab, setDrawerTab] = useState<'info' | 'history'>('info');

  // Custom required labels modal state
  const [customLabelModalVisible, setCustomLabelModalVisible] = useState(false);
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);
  const [tempLabelsList, setTempLabelsList] = useState<{ code: string; name: string; qty: number }[]>([]);
  const [selectSearchText, setSelectSearchText] = useState<Record<number, string>>({});
  const [showIssuesMap, setShowIssuesMap] = useState<Record<number, boolean>>({});

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
  const { data: masterSuppliers = [] } = useMasterSuppliers();

  // Unique suppliers from master data
  const suppliersList = useMemo(() => {
    const sorted = [...masterSuppliers].sort((a: any, b: any) => {
      const nameA = (a.supplier_name || '').toLowerCase();
      const nameB = (b.supplier_name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    return sorted.map((s: any) => ({
      value: s.supplier_code,
      label: s.supplier_name || s.supplier_code
    }));
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
    if (!detailRow) return 'Không';
    const currentItems = detailRow.imp_shipment_items || [];
    const hasReqLabels = currentItems.some(item => {
      const labels = (item.required_labels !== undefined && item.required_labels !== null)
        ? item.required_labels
        : getProductLabels(item.item_code);
      return labels && labels.length > 0;
    });
    return hasReqLabels ? 'Chờ bổ sung' : 'Không';
  }, [detailRow, getProductLabels]);

  // Auto-calculated COA status
  const computedCOAStatus = useMemo(() => {
    if (!detailRow) return 'Chưa đạt';
    const currentItems = detailRow.imp_shipment_items || [];
    if (currentItems.length === 0) return 'Chưa đạt';
    const allOk = currentItems.every(item => item.coa_status === 'Đã cập nhật');
    return allOk ? 'Đạt' : 'Chưa đạt';
  }, [detailRow]);

  // Open required label customizer modal
  const handleOpenCustomLabelModal = (idx: number, currentLabels: any[]) => {
    setEditingItemIdx(idx);
    setTempLabelsList(JSON.parse(JSON.stringify(currentLabels || [])));
    setSelectSearchText({});
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
    const missingCOA = rawData.filter(r => {
      const items = r.imp_shipment_items || [];
      const allOk = items.length > 0 && items.every(item => item.coa_status === 'Đã cập nhật');
      return !allOk;
    }).length;
    const tempWarnings = rawData.filter(r => r.temp_out_of_range).length;
    const missingItemCode = rawData.filter(r => {
      const items = r.imp_shipment_items || [];
      return items.some(item => !item.item_code);
    }).length;
    const closed = rawData.filter(r => r.progress_status === 'Hoàn tất' || r.progress_status === 'Closed').length;

    return { total, missingCOA, tempWarnings, missingItemCode, closed };
  }, [rawData, totalCount]);

  // Open Edit / Detail Drawer
  const handleOpenDetail = (record: ShipmentRecord) => {
    setDetailRow(JSON.parse(JSON.stringify(record))); // Deep copy
    setOriginalItems(JSON.parse(JSON.stringify(record.imp_shipment_items || [])));
    setOriginalRow(JSON.parse(JSON.stringify(record))); // Snapshot for audit log
    setIsNew(false);
    setDrawerTab('info');
    setShowIssuesMap({});
  };

  // Open Create Drawer
  const handleCreateNew = () => {
    const emptyRecord: ShipmentRecord = {
      invoice_number: '',
      created_date: dayjs().format('YYYY-MM-DD'),
      supplier_code: '',
      coa_status: 'Chưa đạt',
      label_status: 'Không',
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
    setOriginalRow(null);
    setIsNew(true);
    setDrawerTab('info');
    setShowIssuesMap({});
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

  // Helper to fetch the most recent visa, decision and validity date for a product
  const fetchAndFillRecentItemData = async (index: number, itemCode: string) => {
    try {
      const { data, error } = await supabase
        .from('imp_shipment_items')
        .select('visa_no, decision_no, valid_until')
        .eq('item_code', itemCode)
        .not('visa_no', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);

      let visaNo = '';
      let decisionNo = '';
      let validUntil = '';

      if (data && data.length > 0 && data[0].visa_no) {
        visaNo = data[0].visa_no || '';
        decisionNo = data[0].decision_no || '';
        validUntil = data[0].valid_until || '';
      } else {
        // Fallback to master item visa_no
        const match = masterItems.find(m => m.item_code === itemCode);
        if (match && match.visa_no) {
          visaNo = match.visa_no;
        }
      }

      setDetailRow(prev => {
        if (!prev) return null;
        const items = [...prev.imp_shipment_items];
        if (items[index]) {
          items[index] = {
            ...items[index],
            visa_no: visaNo,
            decision_no: decisionNo,
            valid_until: validUntil
          };
        }
        return { ...prev, imp_shipment_items: items };
      });
    } catch (err) {
      console.error('Error fetching recent item data:', err);
    }
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
          // Trigger async fetch for recent visa/decision data
          fetchAndFillRecentItemData(index, value);
        } else {
          items[index].required_labels = null;
          items[index].visa_no = null;
          items[index].decision_no = null;
          items[index].valid_until = null;
        }
      }
      return { ...prev, imp_shipment_items: items };
    });
  };

  const handleToggleIssueVisible = (idx: number, checked: boolean) => {
    setShowIssuesMap(prev => ({ ...prev, [idx]: checked }));
    if (!checked) {
      updateItemField(idx, 'issue_notes', null);
      updateItemField(idx, 'resolution_notes', null);
    }
  };

  const handleAddItem = () => {
    if (!detailRow) return;
    const newItem: ShipmentItem = {
      invoice_number: detailRow.invoice_number,
      item_code: null,
      item_name: '',
      issue_notes: null,
      resolution_notes: null,
      coa_status: 'Chưa có',
      visa_no: null,
      decision_no: null,
      valid_until: null,
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

    if (detailRow.progress_status === 'Hoàn tất' || detailRow.progress_status === 'Closed') {
      // 1. Validate Master fields
      if (!detailRow.created_date) {
        messageApi.warning('Trạng thái "Hoàn tất" yêu cầu nhập Ngày nhận mail!');
        return;
      }
      if (!detailRow.target_warehouse) {
        messageApi.warning('Trạng thái "Hoàn tất" yêu cầu nhập Kho!');
        return;
      }
      if (!parseImportDate(detailRow.actual_import_date_note)) {
        messageApi.warning('Trạng thái "Hoàn tất" yêu cầu nhập Ngày nhập kho (Ghi chú thực tế)!');
        return;
      }
      if (detailRow.has_data_logger) {
        if (!detailRow.data_logger_type?.trim()) {
          messageApi.warning('Trạng thái "Hoàn tất" yêu cầu nhập Loại Data Logger!');
          return;
        }
        if (detailRow.logger_qty <= 0) {
          messageApi.warning('Trạng thái "Hoàn tất" yêu cầu nhập Số lượng Data Logger > 0!');
          return;
        }
      }
      if (detailRow.temp_out_of_range && !detailRow.temp_out_of_range_details?.trim()) {
        messageApi.warning('Trạng thái "Hoàn tất" yêu cầu nhập Chi tiết lệch nhiệt!');
        return;
      }

      // 2. Validate Detail items
      const items = detailRow.imp_shipment_items || [];
      if (items.length === 0) {
        messageApi.warning('Trạng thái "Hoàn tất" yêu cầu chuyến hàng phải có ít nhất 1 sản phẩm!');
        return;
      }

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemIndexStr = `sản phẩm thứ ${i + 1}`;
        if (!item.item_name?.trim()) {
          messageApi.warning(`Trạng thái "Hoàn tất" yêu cầu nhập Tên sản phẩm thực tế cho ${itemIndexStr}!`);
          return;
        }
        if (!item.coa_status) {
          messageApi.warning(`Trạng thái "Hoàn tất" yêu cầu chọn COA cho ${itemIndexStr}!`);
          return;
        }
        if (!item.visa_no?.trim()) {
          messageApi.warning(`Trạng thái "Hoàn tất" yêu cầu nhập Số Visa cho ${itemIndexStr}!`);
          return;
        }
        if (!item.decision_no?.trim()) {
          messageApi.warning(`Trạng thái "Hoàn tất" yêu cầu nhập Số quyết định cho ${itemIndexStr}!`);
          return;
        }
        if (!parseImportDate(item.valid_until)) {
          messageApi.warning(`Trạng thái "Hoàn tất" yêu cầu nhập Hiệu lực đến cho ${itemIndexStr}!`);
          return;
        }

        // If Phát sinh vấn đề is checked (either in showIssuesMap or by existing notes)
        const isIssueVisible = showIssuesMap[i] ?? !!(item.issue_notes || item.resolution_notes);
        if (isIssueVisible) {
          if (!item.issue_notes?.trim()) {
            messageApi.warning(`Trạng thái "Hoàn tất" yêu cầu nhập Vấn đề (nếu có) cho ${itemIndexStr}!`);
            return;
          }
          if (!item.resolution_notes?.trim()) {
            messageApi.warning(`Trạng thái "Hoàn tất" yêu cầu nhập Hướng xử lý cho ${itemIndexStr}!`);
            return;
          }
        }
      }
    }

    setSaving(true);
    try {
      // 1. Prepare shipment payload (Master)
      const match = masterSuppliers.find((s: any) => s.supplier_code === detailRow.supplier_code);
      const supplierName = match ? match.supplier_name : detailRow.supplier_code;

      const computedInvoiceLink = (detailRow.supplier_code && invoiceNumber)
        ? `\\\\hd.domain\\hoangducdfs\\TAILIEUPHONG-HD\\P.QA\\7. LONG HAU\\7. CAC THEO DOI TRONG QUA TRINH\\18. FORM MAU CHO FOLDER NHA SAN XUAT\\${supplierName}\\5. THONG TIN NHAP - PHAN PHOI\\1. KIEM NHAP\\${invoiceNumber}`
        : null;
      const computedSupplierLink = detailRow.supplier_code 
        ? `\\\\hd.domain\\hoangducdfs\\TAILIEUPHONG-HD\\P.QA\\7. LONG HAU\\7. CAC THEO DOI TRONG QUA TRINH\\18. FORM MAU CHO FOLDER NHA SAN XUAT\\${supplierName}`
        : null;

      const shipmentPayload: any = {
        invoice_number: invoiceNumber,
        created_date: detailRow.created_date,
        supplier_code: detailRow.supplier_code,
        coa_status: computedCOAStatus,
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
          coa_status: item.coa_status || 'Chưa có',
          visa_no: item.visa_no || null,
          decision_no: item.decision_no || null,
          valid_until: item.valid_until || null,
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
            coa_status: item.coa_status || 'Chưa có',
            visa_no: item.visa_no || null,
            decision_no: item.decision_no || null,
            valid_until: item.valid_until || null,
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

      // ── Audit Log ──
      const changedBy = userId || 'unknown';
      const userRole = simulatedRole === 'QA_NHAP_KHAU' ? 'QA Nhập khẩu' : 'QA Kho';

      // 1. Log thay đổi của header shipment
      //    Chỉ so sánh các trường CÓ trong shipmentPayload để tránh log thừa
      //    (originalRow có thể chứa nhiều trường DB thừa như import_date_lh_text)
      const originalHeaderSlice: Record<string, unknown> = {};
      Object.keys(shipmentPayload).forEach(k => {
        originalHeaderSlice[k] = (originalRow as any)?.[k];
      });

      if (isNew) {
        writeAuditLog({
          tableName: 'imp_shipments', recordId: invoiceNumber,
          action: 'INSERT', changedBy, userRole,
          newValues: shipmentPayload as Record<string, unknown>,
          changedFields: Object.keys(shipmentPayload),
        });
      } else {
        const { diff, changedFields } = buildDiff(
          originalHeaderSlice,
          shipmentPayload as Record<string, unknown>
        );
        if (changedFields.length > 0) {
          writeAuditLog({
            tableName: 'imp_shipments', recordId: invoiceNumber,
            action: 'UPDATE', changedBy, userRole,
            oldValues: originalHeaderSlice,
            newValues: shipmentPayload as Record<string, unknown>,
            diff, changedFields,
          });

        }
      }

      // 2. Log từng item bị xóa
      for (const deletedId of idsToDelete) {
        const oldItem = originalItems.find((i: any) => i.id === deletedId);
        if (oldItem) {
          writeAuditLog({
            tableName: 'imp_shipment_items', recordId: `${invoiceNumber}::${deletedId}`,
            action: 'DELETE', changedBy, userRole,
            oldValues: oldItem as unknown as Record<string, unknown>,
          });
        }
      }

      // 3. Log từng item được thêm mới
      for (const newItem of toInsert) {
        writeAuditLog({
          tableName: 'imp_shipment_items', recordId: `${invoiceNumber}::new-${newItem.item_code || Date.now()}`,
          action: 'INSERT', changedBy, userRole,
          newValues: newItem as unknown as Record<string, unknown>,
          changedFields: Object.keys(newItem),
        });
      }

      // 4. Log từng item được cập nhật (chỉ ghi khi có thay đổi thực sự)
      for (const item of toUpdate) {
        const oldItem = originalItems.find((i: any) => i.id === item.id);
        if (oldItem) {
          const { diff: itemDiff, changedFields: itemChanged } = buildDiff(
            oldItem as unknown as Record<string, unknown>,
            item as unknown as Record<string, unknown>
          );
          if (itemChanged.length > 0) {
            writeAuditLog({
              tableName: 'imp_shipment_items', recordId: `${invoiceNumber}::${item.id}`,
              action: 'UPDATE', changedBy, userRole,
              oldValues: oldItem as unknown as Record<string, unknown>,
              newValues: item as unknown as Record<string, unknown>,
              diff: itemDiff,
              changedFields: itemChanged,
            });
          }
        }
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

  const parseImportDate = (val: string | null | undefined) => {
    if (!val) return null;
    let d = dayjs(val, 'DD/MM/YYYY', true);
    if (d.isValid()) return d;
    d = dayjs(val, 'YYYY-MM-DD', true);
    if (d.isValid()) return d;
    d = dayjs(val);
    if (d.isValid()) return d;
    return null;
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
      render: (v: string, r: ShipmentRecord) => {
        const match = masterSuppliers.find((s: any) => s.supplier_code === r.supplier_code);
        const supplierName = match ? match.supplier_name : r.supplier_code;
        const link = getInvoiceFolderLink(supplierName, v);
        return (
          <span 
            style={{ fontWeight: 700, color: '#0d9488', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            onClick={() => handleOpenDetail(r)}
          >
            {v}
            {link && (
              <Tooltip title="Click để copy đường dẫn thư mục kiểm nhập">
                <a 
                  href={link} 
                  onClick={(e) => handleCopyLink(e, link, 'invoice')}
                  style={{ display: 'inline-flex', alignItems: 'center' }}
                >
                  <ExternalLink size={12} color="#0d9488" />
                </a>
              </Tooltip>
            )}
          </span>
        );
      },
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
      render: (v: string, r: ShipmentRecord) => {
        const match = masterSuppliers.find((s: any) => s.supplier_code === v);
        const supplierName = match ? match.supplier_name : v;
        const link = getSupplierFolderLink(supplierName);
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Tag color="cyan" style={{ fontWeight: 600, margin: 0 }}>{supplierName}</Tag>
            {link && (
              <Tooltip title="Click để copy đường dẫn thư mục gốc NCC">
                <a 
                  href={link} 
                  onClick={(e) => handleCopyLink(e, link, 'supplier')}
                  style={{ display: 'inline-flex', alignItems: 'center' }}
                >
                  <ExternalLink size={11} color="#64748b" />
                </a>
              </Tooltip>
            )}
          </span>
        );
      },
    },
    products: {
      title: <ColumnSearchHeader title="Sản phẩm" dataKey="products" filters={columnFilters} onFilterChange={handleColumnFilter} showFilters={showFilters} />,
      dataIndex: 'products',
      key: 'products',
      ...resizable('products'),
      render: (_: string, r: ShipmentRecord) => {
        const items = r.imp_shipment_items || [];
        const names = items.map(item => item.item_name).filter(Boolean);
        const fullText = names.join(', ');
        const displayValue = fullText.length > 50 ? `${fullText.substring(0, 50)}...` : fullText;
        return (
          <Tooltip title={fullText} placement="topLeft">
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
      render: (_: string, r: ShipmentRecord) => {
        const items = r.imp_shipment_items || [];
        const allOk = items.length > 0 && items.every(item => item.coa_status === 'Đã cập nhật');
        const displayVal = allOk ? 'Đạt' : 'Chưa đạt';
        return <Tag color={COA_COLOR[displayVal] || 'default'} style={{ margin: 0, fontWeight: 500 }}>{displayVal}</Tag>;
      },
    },
    label_status: {
      title: <ColumnSearchHeader title="Nhãn phụ" dataKey="label_status" filters={columnFilters} onFilterChange={handleColumnFilter} align="center" showFilters={showFilters} />,
      dataIndex: 'label_status',
      key: 'label_status',
      align: 'center',
      ...resizable('label_status'),
      render: (v: string) => {
        let displayVal = v;
        if (v === 'Chưa có') displayVal = 'Chờ bổ sung';
        else if (v === 'Đã cập nhật') displayVal = 'Không';
        return <Tag color={LABEL_COLOR[displayVal] || 'default'} style={{ margin: 0, fontWeight: 500 }}>{displayVal}</Tag>;
      },
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
          <Tooltip title="Click để bật/tắt lọc các Invoice thiếu mã sản phẩm (Item Code)">
            <Card
              className="metric-card-hover"
              onClick={() => setFilterMissingItemCode(prev => !prev)}
              style={{
                borderRadius: 12,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                border: filterMissingItemCode ? '2px solid #8b5cf6' : '1px solid transparent',
                background: filterMissingItemCode
                  ? 'linear-gradient(135deg, #ddd6fe 0%, #c084fc 100%)'
                  : 'linear-gradient(135deg, #f5f3ff 0%, #e9d5ff 100%)',
                boxShadow: filterMissingItemCode ? '0 4px 12px rgba(139, 92, 246, 0.2)' : 'none',
              }}
              bodyStyle={{ padding: 12 }}
            >
              <Statistic
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: filterMissingItemCode ? '#581c87' : '#6d28d9', fontWeight: 600, fontSize: 12 }}>
                      Thiếu mã SP
                    </span>
                    {filterMissingItemCode && (
                      <span style={{ fontSize: 9, background: '#8b5cf6', color: '#fff', padding: '1px 4px', borderRadius: 4, fontWeight: 700 }}>
                        Đang lọc
                      </span>
                    )}
                  </div>
                }
                value={stats.missingItemCode}
                valueStyle={{ color: filterMissingItemCode ? '#3b0764' : '#5b21b6', fontWeight: 800, fontSize: 20 }}
                prefix={<AlertCircle size={16} style={{ marginRight: 6 }} color={filterMissingItemCode ? '#581c87' : '#7c3aed'} />}
              />
            </Card>
          </Tooltip>
        </Col>

        <Col xs={12} sm={12} md={5} lg={5}>
          <Card className="metric-card-hover" style={{ borderRadius: 12, background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)' }} bodyStyle={{ padding: 12 }}>
            <Statistic
              title={<span style={{ color: '#b91c1c', fontWeight: 600, fontSize: 12 }}>Thiếu COA</span>}
              value={stats.missingCOA}
              valueStyle={{ color: '#7f1d1d', fontWeight: 800, fontSize: 20 }}
              prefix={<AlertTriangle size={16} style={{ marginRight: 6 }} color="#dc2626" />}
            />
          </Card>
        </Col>

        <Col xs={12} sm={12} md={5} lg={5}>
          <Card className="metric-card-hover" style={{ borderRadius: 12, background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)' }} bodyStyle={{ padding: 12 }}>
            <Statistic
              title={<span style={{ color: '#b45309', fontWeight: 600, fontSize: 12 }}>Cảnh báo nhiệt</span>}
              value={stats.tempWarnings}
              valueStyle={{ color: '#78350f', fontWeight: 800, fontSize: 20 }}
              prefix={<Thermometer size={16} style={{ marginRight: 6 }} color="#d97706" />}
            />
          </Card>
        </Col>

        <Col xs={12} sm={12} md={5} lg={5}>
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
        width="90%"
        onClose={() => { setDetailRow(null); setOriginalRow(null); }}
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
              disabled={isClosed && simulatedRole !== 'QA_NHAP_KHAU'}
              style={{ background: '#0d9488', borderColor: '#0d9488', borderRadius: 6 }}
            >
              Lưu thay đổi
            </Button>
          </Space>
        }
        bodyStyle={{ padding: '8px 12px', background: '#f8fafc' }}
      >
        {detailRow && (
          <Space direction="vertical" size={10} style={{ width: '100%' }}>

            {/* Tabs: Thông tin / Lịch sử */}
            {!isNew && (
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
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

            {/* History Tab */}
            {!isNew && drawerTab === 'history' && (
              <div style={{ background: 'white', borderRadius: 12, padding: '12px 16px' }}>
                <AuditLogTimeline
                  tableName="imp_shipments"
                  recordId={detailRow.invoice_number}
                  additionalQuery={[{
                    tableName: 'imp_shipment_items',
                    recordIdPrefix: `${detailRow.invoice_number}::`,
                  }]}
                />
              </div>
            )}

            {/* Main Info (hidden when on history tab) */}
            {(isNew || drawerTab === 'info') && (
            <div style={{ display: 'contents' }}>
            {/* Persona Notice */}
            <div style={{
              background: 'rgba(13,148,136,0.06)',
              border: '1px dashed rgba(13,148,136,0.3)',
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: 11,
              color: '#0f766e',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <AlertCircle size={14} color="#0d9488" style={{ flexShrink: 0 }} />
              <div>
                <strong>Lưu ý:</strong> Để sửa các trường bị mờ, vui lòng chuyển đổi <strong>Vai trò giả lập</strong> ở thanh công cụ phía trên trang.
              </div>
            </div>

            {/* MERGED PART 1, 2, 3: THÔNG TIN CHUNG */}
            <div style={{ background: 'white', padding: '10px 14px', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 700, color: '#334155', borderLeft: '3px solid #0d9488', paddingLeft: 8 }}>
                THÔNG TIN CHUNG
              </h3>
              
              <Row gutter={[12, 8]}>
                {/* Invoice Number */}
                <Col span={4}>
                  <div style={{ marginBottom: 2, fontSize: 11, fontWeight: 600, color: '#475569' }}>Số Invoice *</div>
                  <Input
                    placeholder="VD: INUK-240025"
                    value={detailRow.invoice_number}
                    onChange={(e) => updateField('invoice_number', e.target.value)}
                    disabled={!isNew || simulatedRole !== 'QA_NHAP_KHAU' || isClosed}
                    style={{ borderRadius: 6 }}
                  />
                </Col>

                {/* Created Date */}
                <Col span={4}>
                  <div style={{ marginBottom: 2, fontSize: 11, fontWeight: 600, color: '#475569' }}>Ngày nhận mail *</div>
                  <DatePicker
                    value={detailRow.created_date ? dayjs(detailRow.created_date) : null}
                    onChange={(date) => updateField('created_date', date ? date.format('YYYY-MM-DD') : '')}
                    disabled={simulatedRole !== 'QA_NHAP_KHAU' || isClosed}
                    style={{ width: '100%', borderRadius: 6 }}
                    format="DD/MM/YYYY"
                    allowClear={false}
                  />
                </Col>

                {/* Supplier Code */}
                <Col span={4}>
                  <div style={{ marginBottom: 2, fontSize: 11, fontWeight: 600, color: '#475569' }}>NCC/ Hãng *</div>
                  <Select
                    showSearch
                    placeholder="Chọn hoặc nhập NCC"
                    optionFilterProp="label"
                    value={detailRow.supplier_code || undefined}
                    onChange={(val) => updateField('supplier_code', val)}
                    disabled={simulatedRole !== 'QA_NHAP_KHAU' || isClosed}
                    style={{ width: '100%' }}
                    options={suppliersList}
                    dropdownStyle={{ borderRadius: 8 }}
                  />
                </Col>

                {/* Document Links */}
                <Col span={6}>
                  <div style={{ marginBottom: 2, fontSize: 11, fontWeight: 600, color: '#475569' }}>Link INV</div>
                  {(() => {
                    const match = masterSuppliers.find((s: any) => s.supplier_code === detailRow.supplier_code);
                    const supplierName = match ? match.supplier_name : detailRow.supplier_code;
                    const link = getSupplierFolderLink(supplierName);
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

                <Col span={6}>
                  <div style={{ marginBottom: 2, fontSize: 11, fontWeight: 600, color: '#475569' }}>Link hãng</div>
                  {(() => {
                    const match = masterSuppliers.find((s: any) => s.supplier_code === detailRow.supplier_code);
                    const supplierName = match ? match.supplier_name : detailRow.supplier_code;
                    const link = getInvoiceFolderLink(supplierName, detailRow.invoice_number);
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

                {/* Warehouse Dropdown */}
                <Col span={8}>
                  <div style={{ marginBottom: 2, fontSize: 11, fontWeight: 600, color: '#475569' }}>Kho</div>
                  <Select
                    placeholder="Chọn Kho nhận hàng"
                    value={detailRow.target_warehouse || undefined}
                    onChange={(val) => updateField('target_warehouse', val)}
                    disabled={simulatedRole !== 'QA_NHAP_KHAU' || isClosed}
                    style={{ width: '100%' }}
                    options={[
                      { value: 'Kho Long Hậu', label: 'Kho Long Hậu' },
                      { value: 'Kho Hưng Yên', label: 'Kho Hưng Yên' }
                    ]}
                    allowClear
                  />
                </Col>

                {/* Actual Import Date Note (DatePicker with DD/MM/YYYY formatting) */}
                <Col span={10}>
                  <div style={{ marginBottom: 2, fontSize: 11, fontWeight: 600, color: '#475569' }}>Ngày nhập (Ghi chú thực tế)</div>
                  <DatePicker
                    placeholder="Chọn hoặc nhập ngày (DD/MM/YYYY)"
                    value={parseImportDate(detailRow.actual_import_date_note)}
                    onChange={(date) => updateField('actual_import_date_note', date ? date.format('DD/MM/YYYY') : '')}
                    disabled={isClosed}
                    style={{ width: '100%', borderRadius: 6 }}
                    format="DD/MM/YYYY"
                    allowClear
                  />
                </Col>

                {/* Progress Status */}
                <Col span={6}>
                  <div style={{ marginBottom: 2, fontSize: 11, fontWeight: 600, color: '#475569' }}>Tiến độ</div>
                  <Select
                    value={detailRow.progress_status}
                    onChange={(val) => {
                      if (val === 'Hoàn tất' || val === 'Closed') {
                        if (!detailRow.created_date) {
                          messageApi.warning('Vui lòng nhập Ngày nhận mail trước khi chuyển sang Hoàn tất!');
                          return;
                        }
                        if (!detailRow.target_warehouse) {
                          messageApi.warning('Vui lòng chọn Kho trước khi chuyển sang Hoàn tất!');
                          return;
                        }
                        if (!parseImportDate(detailRow.actual_import_date_note)) {
                          messageApi.warning('Vui lòng nhập Ngày nhập kho (Ghi chú thực tế) trước khi chuyển sang Hoàn tất!');
                          return;
                        }
                        if (detailRow.has_data_logger) {
                          if (!detailRow.data_logger_type?.trim()) {
                            messageApi.warning('Vui lòng nhập Loại Data Logger trước khi chuyển sang Hoàn tất!');
                            return;
                          }
                          if (detailRow.logger_qty <= 0) {
                            messageApi.warning('Vui lòng nhập Số lượng Data Logger trước khi chuyển sang Hoàn tất!');
                            return;
                          }
                        }
                        if (detailRow.temp_out_of_range && !detailRow.temp_out_of_range_details?.trim()) {
                          messageApi.warning('Vui lòng nhập Chi tiết lệch nhiệt trước khi chuyển sang Hoàn tất!');
                          return;
                        }
                        const items = detailRow.imp_shipment_items || [];
                        if (items.length === 0) {
                          messageApi.warning('Chuyến hàng phải có ít nhất 1 sản phẩm trước khi chuyển sang Hoàn tất!');
                          return;
                        }
                        for (let i = 0; i < items.length; i++) {
                          const item = items[i];
                          const itemIndexStr = `sản phẩm thứ ${i + 1}`;
                          if (!item.item_name?.trim()) {
                            messageApi.warning(`Vui lòng nhập Tên sản phẩm thực tế cho ${itemIndexStr} trước khi chuyển sang Hoàn tất!`);
                            return;
                          }
                          if (!item.coa_status) {
                            messageApi.warning(`Vui lòng chọn COA cho ${itemIndexStr} trước khi chuyển sang Hoàn tất!`);
                            return;
                          }
                          if (!item.visa_no?.trim()) {
                            messageApi.warning(`Vui lòng nhập Số Visa cho ${itemIndexStr} trước khi chuyển sang Hoàn tất!`);
                            return;
                          }
                          if (!item.decision_no?.trim()) {
                            messageApi.warning(`Vui lòng nhập Số quyết định cho ${itemIndexStr} trước khi chuyển sang Hoàn tất!`);
                            return;
                          }
                          if (!parseImportDate(item.valid_until)) {
                            messageApi.warning(`Vui lòng nhập Hiệu lực đến cho ${itemIndexStr} trước khi chuyển sang Hoàn tất!`);
                            return;
                          }
                          const isIssueVisible = showIssuesMap[i] ?? !!(item.issue_notes || item.resolution_notes);
                          if (isIssueVisible) {
                            if (!item.issue_notes?.trim()) {
                              messageApi.warning(`Vui lòng nhập Vấn đề cho ${itemIndexStr} trước khi chuyển sang Hoàn tất!`);
                              return;
                            }
                            if (!item.resolution_notes?.trim()) {
                              messageApi.warning(`Vui lòng nhập Hướng xử lý cho ${itemIndexStr} trước khi chuyển sang Hoàn tất!`);
                              return;
                            }
                          }
                        }
                      }
                      updateField('progress_status', val);
                    }}
                    disabled={isClosed ? simulatedRole !== 'QA_NHAP_KHAU' : false}
                    style={{ width: '100%' }}
                    options={PROGRESS_STATUS_OPTIONS}
                  />
                </Col>

                {/* Has Data Logger */}
                <Col span={12}>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    background: '#f8fafc',
                    padding: '4px 10px',
                    borderRadius: 8,
                    border: '1px solid #f1f5f9',
                    minHeight: 34,
                    justifyContent: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Switch
                        checked={detailRow.has_data_logger}
                        onChange={(val) => updateField('has_data_logger', val)}
                        disabled={isClosed}
                        size="small"
                      />
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>Data Logger kèm hàng</span>
                    </div>

                    {detailRow.has_data_logger && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                        <Input
                          placeholder="Loại logger"
                          value={detailRow.data_logger_type || ''}
                          onChange={(e) => updateField('data_logger_type', e.target.value)}
                          disabled={isClosed}
                          size="small"
                          style={{ flex: 1, borderRadius: 4, fontSize: 11 }}
                        />
                        <InputNumber
                          min={0}
                          placeholder="SL"
                          value={detailRow.logger_qty}
                          onChange={(val) => updateField('logger_qty', val || 0)}
                          disabled={isClosed}
                          size="small"
                          style={{ width: 60, borderRadius: 4, fontSize: 11 }}
                        />
                      </div>
                    )}
                  </div>
                </Col>

                {/* Temperature Out of Range */}
                <Col span={12}>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    background: detailRow.temp_out_of_range ? '#fef2f2' : '#f8fafc',
                    padding: '4px 10px',
                    borderRadius: 8,
                    border: detailRow.temp_out_of_range ? '1px dashed #fca5a5' : '1px solid #f1f5f9',
                    minHeight: 34,
                    justifyContent: 'center',
                    transition: 'all 200ms ease'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Switch
                        checked={detailRow.temp_out_of_range}
                        onChange={(val) => updateField('temp_out_of_range', val)}
                        disabled={isClosed}
                        size="small"
                      />
                      <span style={{ fontSize: 11, fontWeight: 600, color: detailRow.temp_out_of_range ? '#991b1b' : '#334155' }}>
                        🔴 Nhiệt độ vượt ngưỡng
                      </span>
                    </div>

                    {detailRow.temp_out_of_range && (
                      <div style={{ display: 'flex', alignItems: 'center', marginTop: 2 }}>
                        <Input
                          placeholder="Chi tiết lệch nhiệt (VD: max 30.5°C trong 4h)"
                          value={detailRow.temp_out_of_range_details || ''}
                          onChange={(e) => updateField('temp_out_of_range_details', e.target.value)}
                          disabled={isClosed}
                          size="small"
                          style={{ borderRadius: 4, fontSize: 11 }}
                        />
                      </div>
                    )}
                  </div>
                </Col>
              </Row>
            </div>

            {/* PART 4: DETAIL PRODUCTS SECTION */}
            <div style={{ background: 'white', padding: '10px 14px', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#334155', borderLeft: '3px solid #14b8a6', paddingLeft: 8 }}>
                  DANH SÁCH CHI TIẾT SẢN PHẨM (DETAIL)
                </h3>
                {simulatedRole === 'QA_NHAP_KHAU' && !isClosed && (
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
                <div style={{ textAlign: 'center', padding: '16px 8px', border: '1px dashed #cbd5e1', borderRadius: 8, color: '#94a3b8', fontSize: 11 }}>
                  Không có sản phẩm nào trong chuyến hàng này.
                  {simulatedRole === 'QA_NHAP_KHAU' && ' Bấm "Thêm sản phẩm" ở trên để tạo mới.'}
                </div>
              ) : (
                <Space direction="vertical" style={{ width: '100%' }} size={6}>
                  {detailRow.imp_shipment_items.map((item, idx) => {
                    const isIssueVisible = showIssuesMap[idx] ?? !!(item.issue_notes || item.resolution_notes);
                    const isRed = isIssueVisible || item.coa_status === 'Chưa có' || item.coa_status === 'Đang sai sót';
                    return (
                      <div
                        key={item.id || `new-item-${idx}`}
                        style={{
                          padding: '6px 10px',
                          border: isRed ? '1px solid #fca5a5' : '1px solid #e2e8f0',
                          borderRadius: 8,
                          background: isRed ? '#fff5f5' : '#f8fafc',
                          position: 'relative'
                        }}
                      >
                        {/* Delete button (SCM only) */}
                        {simulatedRole === 'QA_NHAP_KHAU' && !isClosed && (
                          <Button
                            type="text"
                            danger
                            size="small"
                            icon={<Trash2 size={14} />}
                            style={{ position: 'absolute', top: 4, right: 4, zIndex: 10 }}
                            onClick={() => handleRemoveItem(idx)}
                          />
                        )}

                        <Row gutter={[10, 6]} align="top">
                          {/* Left Section: Product Details, Visa/Decision & QA Issues (span 16) */}
                          <Col span={16}>
                            {/* Row 1: Code, Name, COA */}
                            <Row gutter={[10, 6]} align="middle">
                              {/* Match Item Code */}
                              <Col span={7}>
                                <div style={{ marginBottom: 2, fontSize: 10, fontWeight: 600, color: '#64748b' }}>
                                  Mã Danh Mục (Item Code)
                                </div>
                                <Select
                                  showSearch
                                  placeholder="Khớp mã SP..."
                                  optionFilterProp="label"
                                  filterOption={(input, option) => {
                                    if (!option) return false;
                                    const searchKey = input.toLowerCase().trim();
                                    const labelStr = (option.label as string || '').toLowerCase();
                                    const valStr = (option.value as string || '').toLowerCase();
                                    return labelStr.includes(searchKey) || valStr.includes(searchKey);
                                  }}
                                  value={item.item_code || undefined}
                                  onChange={(val) => updateItemField(idx, 'item_code', val)}
                                  disabled={simulatedRole !== 'QA_NHAP_KHAU' || isClosed}
                                  style={{ width: '100%' }}
                                  options={masterItems.map(m => ({ value: m.item_code, label: `[${m.item_code}] ${m.item_name}` }))}
                                  dropdownStyle={{ borderRadius: 8 }}
                                  popupMatchSelectWidth={false}
                                  allowClear
                                />
                              </Col>

                              {/* Item Name (Free text / Auto filled) */}
                              <Col span={11}>
                                <div style={{ marginBottom: 2, fontSize: 10, fontWeight: 600, color: '#64748b' }}>
                                  Tên sản phẩm thực tế nhập *
                                </div>
                                <Input
                                  placeholder="Nhập tên chi tiết thuốc, hàm lượng..."
                                  value={item.item_name}
                                  onChange={(e) => updateItemField(idx, 'item_name', e.target.value)}
                                  disabled={simulatedRole !== 'QA_NHAP_KHAU' || isClosed}
                                  style={{ borderRadius: 6, paddingRight: 24 }}
                                />
                              </Col>

                              {/* COA Status per Item */}
                              <Col span={6}>
                                <div style={{ marginBottom: 2, fontSize: 10, fontWeight: 600, color: '#64748b' }}>
                                  COA
                                </div>
                                <Select
                                  value={item.coa_status || 'Chưa có'}
                                  onChange={(val) => updateItemField(idx, 'coa_status', val)}
                                  disabled={simulatedRole !== 'QA_NHAP_KHAU' || isClosed}
                                  style={{ width: '100%' }}
                                  options={COA_STATUS_OPTIONS}
                                />
                              </Col>
                            </Row>

                            {/* Row 2: Visa, Decision, Validity */}
                            <Row gutter={[10, 6]} style={{ marginTop: 6 }}>
                              {/* Số Visa */}
                              <Col span={7}>
                                <div style={{ marginBottom: 2, fontSize: 10, fontWeight: 600, color: '#64748b' }}>
                                  Số Visa
                                </div>
                                <Input
                                  placeholder="Số Visa..."
                                  value={item.visa_no || ''}
                                  onChange={(e) => updateItemField(idx, 'visa_no', e.target.value)}
                                  disabled={simulatedRole !== 'QA_NHAP_KHAU' || isClosed}
                                  size="small"
                                  style={{ borderRadius: 6 }}
                                />
                              </Col>

                              {/* Số quyết định */}
                              <Col span={11}>
                                <div style={{ marginBottom: 2, fontSize: 10, fontWeight: 600, color: '#64748b' }}>
                                  Số quyết định
                                </div>
                                <Input
                                  placeholder="Số quyết định..."
                                  value={item.decision_no || ''}
                                  onChange={(e) => updateItemField(idx, 'decision_no', e.target.value)}
                                  disabled={simulatedRole !== 'QA_NHAP_KHAU' || isClosed}
                                  size="small"
                                  style={{ borderRadius: 6 }}
                                />
                              </Col>

                              {/* Hiệu lực đến */}
                              <Col span={6}>
                                <div style={{ marginBottom: 2, fontSize: 10, fontWeight: 600, color: '#64748b' }}>
                                  Hiệu lực đến
                                </div>
                                <DatePicker
                                  placeholder="DD/MM/YYYY"
                                  value={parseImportDate(item.valid_until)}
                                  onChange={(date) => updateItemField(idx, 'valid_until', date ? date.format('DD/MM/YYYY') : null)}
                                  disabled={simulatedRole !== 'QA_NHAP_KHAU' || isClosed}
                                  size="small"
                                  style={{ width: '100%', borderRadius: 6 }}
                                  format="DD/MM/YYYY"
                                  allowClear
                                />
                              </Col>
                            </Row>

                            {/* Row 3: QA Issues (Vấn đề & Hướng xử lý) */}
                            {isIssueVisible && (
                              <Row gutter={[10, 6]} style={{ marginTop: 6 }}>
                                {/* Vấn đề */}
                                <Col span={12}>
                                  <div style={{ marginBottom: 2, fontSize: 10, fontWeight: 600, color: '#b91c1c' }}>
                                    Vấn đề (nếu có)
                                  </div>
                                  <Input
                                    placeholder="Nhập chi tiết vấn đề phát sinh..."
                                    value={item.issue_notes || ''}
                                    onChange={(e) => updateItemField(idx, 'issue_notes', e.target.value)}
                                    disabled={simulatedRole !== 'QA_NHAP_KHAU' || isClosed}
                                    size="small"
                                    style={{ borderRadius: 6 }}
                                  />
                                </Col>

                                {/* Hướng xử lý */}
                                <Col span={12}>
                                  <div style={{ marginBottom: 2, fontSize: 10, fontWeight: 600, color: '#b91c1c' }}>
                                    Hướng xử lý
                                  </div>
                                  <Input
                                    placeholder="Nhập hướng xử lý..."
                                    value={item.resolution_notes || ''}
                                    onChange={(e) => updateItemField(idx, 'resolution_notes', e.target.value)}
                                    disabled={simulatedRole !== 'QA_NHAP_KHAU' || isClosed}
                                    size="small"
                                    style={{ borderRadius: 6 }}
                                  />
                                </Col>
                              </Row>
                            )}
                          </Col>

                          {/* Right Section: Required Stamps/Labels & Toggle (span 8) */}
                          <Col span={8}>
                            <Space direction="vertical" style={{ width: '100%' }} size={6}>
                              {(() => {
                                const isCustomized = !!(item.required_labels && Array.isArray(item.required_labels));
                                const reqLabels = isCustomized 
                                  ? item.required_labels! 
                                  : (item.item_code ? getProductLabels(item.item_code) : []);
                                const hasLabels = reqLabels && reqLabels.length > 0;
                                
                                return (
                                  <div style={{
                                    background: 'rgba(13,148,136,0.04)',
                                    border: '1px dashed rgba(13,148,136,0.3)',
                                    padding: '4px 8px',
                                    borderRadius: 8,
                                  }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: '#0f766e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        🏷️ Tem nhãn bắt buộc:
                                      </span>
                                      
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{
                                          fontSize: 8,
                                          fontWeight: 600,
                                          color: isCustomized ? '#d97706' : (item.item_code ? '#0d9488' : '#d97706'),
                                          background: isCustomized ? '#fef3c7' : (item.item_code ? '#ccfbf1' : '#fef3c7'),
                                          padding: '1px 4px',
                                          borderRadius: 3
                                        }}>
                                          {isCustomized ? 'Manual' : (item.item_code ? 'Realtime' : 'Manual')}
                                        </span>
                                        
                                        {simulatedRole === 'QA_NHAP_KHAU' && !isClosed && (
                                          <Space size={2}>
                                            <Button
                                              type="link"
                                              size="small"
                                              onClick={() => handleOpenCustomLabelModal(idx, reqLabels)}
                                              style={{ padding: 0, height: 'auto', fontSize: 10, color: '#2563eb' }}
                                            >
                                              [Sửa]
                                            </Button>
                                            {isCustomized && (
                                              <Button
                                                type="link"
                                                size="small"
                                                onClick={() => handleResetLabels(idx)}
                                                style={{ padding: 0, height: 'auto', fontSize: 10, color: '#dc2626' }}
                                              >
                                                [Reset]
                                              </Button>
                                            )}
                                          </Space>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {hasLabels ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        {reqLabels.map((lbl, lidx) => (
                                          <div key={lidx} style={{ fontSize: 10, color: '#334155', display: 'flex', justifyContent: 'space-between', gap: 8, lineHeight: 1.2 }}>
                                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                              • <strong style={{ color: '#0d9488' }}>{lbl.code}</strong> - {lbl.name}
                                            </span>
                                            <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                                              Tỷ lệ: <strong style={{ color: '#0f766e' }}>{lbl.qty}</strong>
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic', lineHeight: 1.2 }}>
                                        Chưa có yêu cầu tem nhãn bổ sung
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}

                              {/* Toggle switch for QA Issues */}
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: isIssueVisible ? '#fff5f5' : '#f8fafc',
                                border: isIssueVisible ? '1px dashed #fca5a5' : '1px solid #e2e8f0',
                                padding: '4px 8px',
                                borderRadius: 8,
                                transition: 'all 200ms ease'
                              }}>
                                <span style={{ fontSize: 10, fontWeight: 600, color: isIssueVisible ? '#b91c1c' : '#64748b' }}>
                                  ⚠️ Phát sinh vấn đề
                                </span>
                                <Switch
                                  checkedChildren="Có"
                                  unCheckedChildren="Không"
                                  checked={isIssueVisible}
                                  onChange={(val) => handleToggleIssueVisible(idx, val)}
                                  disabled={simulatedRole !== 'QA_NHAP_KHAU' || isClosed}
                                />
                              </div>
                            </Space>
                          </Col>
                        </Row>
                      </div>
                    );
                  })}
                </Space>
              )}
            </div>
            </div>
            )}



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
                  placeholder="Chọn hoặc nhập tên/mã tem..."
                  value={lbl.code || undefined}
                  onSearch={(val) => {
                    setSelectSearchText(prev => ({ ...prev, [lIdx]: val }));
                  }}
                  onChange={(val) => {
                    const matchedItem = masterItems.find((x: any) => x.item_code === val);
                    const name = matchedItem ? matchedItem.item_name : val;
                    const updated = [...tempLabelsList];
                    updated[lIdx] = { ...updated[lIdx], code: val, name };
                    setTempLabelsList(updated);
                    setSelectSearchText(prev => {
                      const copy = { ...prev };
                      delete copy[lIdx];
                      return copy;
                    });
                  }}
                  optionFilterProp="label"
                  style={{ width: '100%' }}
                  options={(() => {
                    const opts = masterItems.map((x: any) => ({
                      value: x.item_code,
                      label: `[${x.item_code}] ${x.item_name}`
                    }));
                    const currentTyped = selectSearchText[lIdx];
                    if (currentTyped && currentTyped.trim() && !masterItems.some(x => x.item_code === currentTyped || x.item_name === currentTyped)) {
                      opts.unshift({
                        value: currentTyped.trim(),
                        label: `Nhập mới: "${currentTyped.trim()}"`
                      });
                    }
                    return opts;
                  })()}
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
