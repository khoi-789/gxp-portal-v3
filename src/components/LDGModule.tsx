'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Table, Button, Input, Tag, Select, Space, Tooltip,
  Badge, Drawer, Form, InputNumber, message, Row, Col, Popconfirm,
  Card, Statistic, Divider, DatePicker
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  Search, RefreshCw, Trash2, Eye, Filter, Plus, FileText,
  Calendar, CheckCircle, Info, Save, Edit3, Image, AlertTriangle, Layers
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
export interface LDGLpn {
  id?: number;
  ldg_code: string;
  lpn_code: string;
  quantity: number;
  released_qty: number | null;
  incident_note: string | null;
  incident_ref: string | null;
  created_at?: string;
}

export interface LDGOrder {
  id?: number;
  ldg_code: string;
  created_date: string;
  item_code: string;
  item_name?: string | null;
  supplier_code: string;
  lot_number: string;
  exp_date: string;
  batch_size: number;
  packaging_req: string | null;
  label_version_id: number | null;
  six_sides_photo: string | null;
  status: string; // 'Draft' | 'In Progress' | 'Pending QA Review' | 'Issue' | 'Released'
  general_notes: string | null;
  updated_at?: string;
  ldg_lpns: LDGLpn[];
}

const STATUS_OPTIONS = [
  { value: 'Draft', label: 'Bản nháp (Draft)' },
  { value: 'In Progress', label: 'Đang dán nhãn (In Progress)' },
  { value: 'Pending QA Review', label: 'Chờ QA duyệt (Pending QA Review)' },
  { value: 'Issue', label: 'Có sự cố (Issue)' },
  { value: 'Released', label: 'Hoàn tất xuất kho (Released)' },
];

const STATUS_COLOR: Record<string, string> = {
  'Draft': 'default',
  'In Progress': 'processing',
  'Pending QA Review': 'warning',
  'Issue': 'error',
  'Released': 'success',
};

const DEFAULT_LDG_COLS: ColumnConfig[] = [
  { key: 'stt', label: 'STT', visible: true, fixed: true },
  { key: 'ldg_code', label: 'Mã Lệnh', visible: true, fixed: true },
  { key: 'status', label: 'Trạng Thái', visible: true },
  { key: 'item_code', label: 'Mã Sản Phẩm', visible: true },
  { key: 'lot_number', label: 'Số Lô', visible: true },
  { key: 'batch_size', label: 'Cỡ Lô', visible: true },
  { key: 'supplier_code', label: 'Nhà Cung Cấp', visible: true },
  { key: 'lpns_count', label: 'Số LPN/Pallet', visible: true },
  { key: 'actions', label: 'Thao Tác', visible: true, fixed: true },
];

const DEFAULT_LDG_WIDTHS: Record<string, number> = {
  stt: 50,
  ldg_code: 150,
  status: 150,
  item_code: 120,
  lot_number: 120,
  batch_size: 110,
  supplier_code: 140,
  lpns_count: 110,
  actions: 80,
};

// ── Server-side fetch function ──
async function fetchLDGOrders(
  page: number,
  pageSize: number,
  search: string,
  filters: Record<string, string>
): Promise<{ items: LDGOrder[]; count: number }> {
  let query = supabase
    .from('ldg_orders')
    .select('*, ldg_lpns(*)', { count: 'exact' });

  if (search.trim()) {
    const q = `%${search.trim()}%`;
    query = query.or(`ldg_code.ilike.${q},item_code.ilike.${q},lot_number.ilike.${q},supplier_code.ilike.${q}`);
  }

  Object.entries(filters).forEach(([key, value]) => {
    if (!value || value.trim() === '') return;
    query = query.ilike(key, `%${value.trim()}%`);
  });

  query = query.order('created_date', { ascending: false });
  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, count, error } = await query;
  if (error) throw new Error('Lỗi tải danh sách lệnh đóng gói: ' + error.message);
  return { items: (data || []) as LDGOrder[], count: count || 0 };
}

export default function LDGModule({ userId = 'default' }: { userId?: string }) {
  const [messageApi, contextHolder] = message.useMessage();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerTab, setDrawerTab] = useState<'info' | 'history'>('info');

  // Master Data (load-all for dropdowns)
  const { data: masterItemsRaw = [] } = useMasterItems();
  const masterItems = useMemo(() => masterItemsRaw.filter(x => x.is_active), [masterItemsRaw]);

  const { data: masterSuppliers = [] } = useMasterSuppliers();

  const { data: allLabels = [] } = useQuery({
    queryKey: ['lbl-labels-dropdown'],
    queryFn: async () => {
      const { data } = await supabase.from('lbl_labels').select('id, item_code, base_label_code, version_number, status');
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Server-side paginated table data
  const ldgQueryKey = ['ldg_orders', currentPage, pageSize, globalSearch, columnFilters];
  const { data: ldgResult, isLoading: loading, refetch: loadData } = useQuery({
    queryKey: ldgQueryKey,
    queryFn: () => fetchLDGOrders(currentPage, pageSize, globalSearch, columnFilters),
    placeholderData: (prev) => prev,
  });

  const rawData = ldgResult?.items || [];
  const totalCount = ldgResult?.count || 0;

  // Drawer Form State
  const [detailRow, setDetailRow] = useState<LDGOrder | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form] = Form.useForm();
  
  // Detail LPN list state
  const [lpnList, setLpnList] = useState<LDGLpn[]>([]);
  const [activeLabelInfo, setActiveLabelInfo] = useState<string>('Chưa chọn sản phẩm');

  // Table configs
  const { prefs, save: savePrefs, setColumnWidth } = useTablePreferences(
    'ldg_orders_table_v1',
    userId,
    DEFAULT_LDG_COLS
  );

  const columnConfigs = prefs.columnConfigs;
  const showFilters = prefs.showFilters;
  const columnWidths = prefs.columnWidths;

  const w = (key: string) => columnWidths[key] ?? DEFAULT_LDG_WIDTHS[key] ?? 100;
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

  // Auto suggest supplier and Active Label version when item changes
  const handleItemChange = async (itemCode: string) => {
    const selectedItem = masterItems.find(i => i.item_code === itemCode);
    if (selectedItem?.supplier_code) {
      form.setFieldsValue({ supplier_code: selectedItem.supplier_code });
    }

    // Lookup Active label for this item code
    const activeLabel = allLabels.find(l => l.item_code === itemCode && l.status === 'Active');
    if (activeLabel) {
      form.setFieldsValue({ label_version_id: activeLabel.id });
      setActiveLabelInfo(`Mã nhãn: ${activeLabel.base_label_code} - Phiên bản: ${activeLabel.version_number}`);
    } else {
      form.setFieldsValue({ label_version_id: null });
      setActiveLabelInfo('Cảnh báo: Sản phẩm này chưa có thiết kế nhãn Active nào!');
    }
  };

  // Open Drawer for Add/Edit
  const handleOpenDrawer = (record?: LDGOrder) => {
    setDrawerTab('info');
    if (record) {
      setIsNew(false);
      setDetailRow(record);
      setLpnList(record.ldg_lpns || []);

      const activeLabel = allLabels.find(l => l.id === record.label_version_id);
      if (activeLabel) {
        setActiveLabelInfo(`Mã nhãn: ${activeLabel.base_label_code} - Phiên bản: ${activeLabel.version_number}`);
      } else {
        setActiveLabelInfo('Chưa gắn nhãn hiệu lực');
      }

      form.setFieldsValue({
        ...record,
        created_date: record.created_date ? dayjs(record.created_date) : null,
        exp_date: record.exp_date ? dayjs(record.exp_date) : null,
      });
    } else {
      setIsNew(true);
      const code = `LDG-${dayjs().format('YYYY')}-${Math.floor(1000 + Math.random() * 9000)}`;
      setDetailRow({
        ldg_code: code,
        created_date: dayjs().format('YYYY-MM-DD'),
        item_code: '',
        supplier_code: '',
        lot_number: '',
        exp_date: '',
        batch_size: 0,
        packaging_req: '',
        label_version_id: null,
        six_sides_photo: '',
        status: 'Draft',
        general_notes: '',
        ldg_lpns: [],
      });
      setLpnList([]);
      setActiveLabelInfo('Chưa chọn sản phẩm');
      form.resetFields();
      form.setFieldsValue({
        ldg_code: code,
        created_date: dayjs(),
        status: 'Draft',
      });
    }
  };

  // Add LPN row to list
  const handleAddLpn = () => {
    const code = form.getFieldValue('ldg_code');
    const newLpn: LDGLpn = {
      ldg_code: code || '',
      lpn_code: `LPN-${dayjs().format('YY')}-${Math.floor(100000 + Math.random() * 900000)}`,
      quantity: 0,
      released_qty: 0,
      incident_note: '',
      incident_ref: '',
    };
    setLpnList(prev => [...prev, newLpn]);
  };

  // Remove LPN row
  const handleRemoveLpn = (index: number) => {
    setLpnList(prev => prev.filter((_, idx) => idx !== index));
  };

  // Update LPN cell
  const handleLpnCellChange = (index: number, key: keyof LDGLpn, value: any) => {
    setLpnList(prev => prev.map((item, idx) => {
      if (idx === index) {
        return { ...item, [key]: value };
      }
      return item;
    }));
  };

  // Save changes to Supabase
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const selectedItem = masterItems.find(i => i.item_code === values.item_code);
      const dbPayload = {
        ldg_code: values.ldg_code,
        created_date: values.created_date ? values.created_date.format('YYYY-MM-DD') : null,
        item_code: values.item_code,
        item_name: selectedItem ? selectedItem.item_name : (detailRow?.item_name || null),
        supplier_code: values.supplier_code,
        lot_number: values.lot_number,
        exp_date: values.exp_date ? values.exp_date.format('YYYY-MM-DD') : null,
        batch_size: values.batch_size,
        packaging_req: values.packaging_req || null,
        label_version_id: values.label_version_id || null,
        six_sides_photo: values.six_sides_photo || null,
        status: values.status,
        general_notes: values.general_notes || null,
      };

      // 1. Upsert Order
      if (isNew) {
        const { error } = await supabase.from('ldg_orders').insert(dbPayload);
        if (error) throw error;
        writeAuditLog({
          tableName: 'ldg_orders', recordId: values.ldg_code,
          action: 'INSERT', changedBy: userId, userRole: 'QA',
          newValues: dbPayload as Record<string, unknown>,
          changedFields: Object.keys(dbPayload),
        });
      } else {
        const { error } = await supabase
          .from('ldg_orders')
          .update(dbPayload)
          .eq('ldg_code', detailRow?.ldg_code);
        if (error) throw error;

        const { diff, changedFields } = buildDiff(
          detailRow as unknown as Record<string, unknown>,
          dbPayload as Record<string, unknown>
        );
        writeAuditLog({
          tableName: 'ldg_orders', recordId: values.ldg_code,
          action: 'UPDATE', changedBy: userId, userRole: 'QA',
          oldValues: detailRow as unknown as Record<string, unknown>,
          newValues: dbPayload as Record<string, unknown>,
          diff, changedFields,
        });
      }

      // 2. Sync LPNs
      // First, get currently stored LPNs in DB for this order
      const { data: currentDbLpns } = await supabase
        .from('ldg_lpns')
        .select('id')
        .eq('ldg_code', values.ldg_code);
      
      const dbLpnIds = currentDbLpns?.map(x => x.id) || [];
      const keepLpnIds = lpnList.map(x => x.id).filter(Boolean) as number[];

      // Delete removed LPNs
      const toDelete = dbLpnIds.filter(id => !keepLpnIds.includes(id));
      if (toDelete.length > 0) {
        await supabase.from('ldg_lpns').delete().in('id', toDelete);
      }

      // Upsert current LPN list
      if (lpnList.length > 0) {
        const lpnsToUpsert = lpnList.map(lpn => ({
          id: lpn.id, // will do insert if undefined, update if exists
          ldg_code: values.ldg_code,
          lpn_code: lpn.lpn_code,
          quantity: lpn.quantity,
          released_qty: lpn.released_qty,
          incident_note: lpn.incident_note || null,
          incident_ref: lpn.incident_ref || null,
        }));

        const { error: upsertError } = await supabase.from('ldg_lpns').upsert(lpnsToUpsert);
        if (upsertError) throw upsertError;
      }

      messageApi.success('Lưu lệnh đóng gói LDG thành công!');
      setDetailRow(null);
      queryClient.invalidateQueries({ queryKey: ['ldg_orders'] });
    } catch (e: any) {
      if (e.errorFields) return; // Antd validation failed
      messageApi.error('Lỗi khi lưu lệnh đóng gói: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete record
  const handleDelete = async (code: string) => {
    try {
      const { data: recordToDelete } = await supabase.from('ldg_orders').select('*').eq('ldg_code', code).single();
      const { error } = await supabase.from('ldg_orders').delete().eq('ldg_code', code);
      if (error) throw error;
      
      if (recordToDelete) {
        writeAuditLog({
          tableName: 'ldg_orders', recordId: recordToDelete.ldg_code,
          action: 'DELETE', changedBy: userId, userRole: 'QA',
          oldValues: recordToDelete,
        });
      }
      
      messageApi.success('Xóa lệnh đóng gói thành công!');
      queryClient.invalidateQueries({ queryKey: ['ldg_orders'] });
    } catch (e: any) {
      messageApi.error('Không thể xóa: ' + e.message);
    }
  };

  // Statistics from server total
  const stats = useMemo(() => {
    const total = totalCount;
    const activeCount = rawData.filter(r => r.status === 'In Progress').length;
    const completed = rawData.filter(r => r.status === 'Released').length;
    return { total, activeCount, completed };
  }, [rawData, totalCount]);

  // Columns definition
  const columns: ColumnsType<LDGOrder> = useMemo(() => {
    const rawCols: ColumnsType<LDGOrder> = [
      {
        title: '#',
        key: 'stt',
        render: (_, __, idx) => (currentPage - 1) * pageSize + idx + 1,
        ...resizable('stt'),
      },
      {
        title: (
          <ColumnSearchHeader
            title="Mã Lệnh Đóng Gói"
            dataKey="ldg_code"
            filters={columnFilters}
            onFilterChange={handleColumnFilter}
            showFilters={showFilters}
          />
        ),
        dataIndex: 'ldg_code',
        key: 'ldg_code',
        render: (text) => <strong style={{ color: '#0d9488' }}>{text}</strong>,
        ...resizable('ldg_code'),
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
            title="Cỡ Lô Đóng Gói"
            dataKey="batch_size"
            filters={columnFilters}
            onFilterChange={handleColumnFilter}
            showFilters={showFilters}
          />
        ),
        dataIndex: 'batch_size',
        key: 'batch_size',
        render: (val) => val.toLocaleString(),
        ...resizable('batch_size'),
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
        title: 'Số LPN/Pallet',
        key: 'lpns_count',
        render: (_, r) => <span style={{ fontWeight: 600 }}>{(r.ldg_lpns || []).length}</span>,
        ...resizable('lpns_count'),
      },
      {
        title: 'Thao Tác',
        key: 'actions',
        render: (_, r) => (
          <Space>
            <Tooltip title="Biên tập / Xem chi tiết">
              <Button
                type="text"
                size="small"
                onClick={() => handleOpenDrawer(r)}
                icon={<Edit3 size={15} color="#0d9488" />}
              />
            </Tooltip>
            <Popconfirm
              title="Bạn muốn xóa lệnh đóng gói này cùng các LPN đi kèm?"
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleDelete(r.ldg_code)}
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
        if (col.key !== 'stt' && col.key !== 'actions' && col.key !== 'ldg_code') {
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
            placeholder="Tìm số lệnh, SP, lô..."
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
            Tạo Lệnh Đóng Gói (LDG)
          </Button>
        </div>
      </div>

      {/* Analytics Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(10px)', borderRadius: 12 }}>
            <Statistic
              title="Tổng Lệnh Đóng Gói"
              value={stats.total}
              valueStyle={{ color: '#0f766e', fontWeight: 800 }}
              prefix={<FileText size={18} style={{ marginRight: 6 }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(10px)', borderRadius: 12 }}>
            <Statistic
              title="Lệnh Đang Dán Nhãn"
              value={stats.activeCount}
              valueStyle={{ color: '#2563eb', fontWeight: 800 }}
              prefix={<Layers size={18} style={{ marginRight: 6 }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(10px)', borderRadius: 12 }}>
            <Statistic
              title="Lệnh Đã Đóng Gói / Release"
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
          rowKey="ldg_code"
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
        title={isNew ? '📝 Tạo Lệnh Đóng Gói Tem Nhãn Phụ' : '🔍 Biên Tập Chi Tiết Lệnh Đóng Gói'}
        placement="right"
        width={780}
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
              Lưu Lệnh Đóng Gói
            </Button>
          </Space>
        }
      >
        {detailRow && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Tabs for Info / History */}
            {!isNew && (
              <div style={{ display: 'flex', gap: 4 }}>
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

            {!isNew && drawerTab === 'history' ? (
              <AuditLogTimeline tableName="ldg_orders" recordId={detailRow.ldg_code} />
            ) : (
              <Form form={form} layout="vertical" initialValues={detailRow}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Mã Lệnh Đóng Gói"
                  name="ldg_code"
                  rules={[{ required: true, message: 'Nhập mã lệnh' }]}
                >
                  <Input disabled placeholder="Mã tự động sinh" style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Trạng Thái Lệnh"
                  name="status"
                  rules={[{ required: true, message: 'Chọn trạng thái' }]}
                >
                  <Select options={STATUS_OPTIONS} style={{ borderRadius: 6 }} />
                </Form.Item>
              </Col>
            </Row>

            <Divider orientation="left" style={{ fontSize: 13, color: '#0f766e', margin: '12px 0' }}>Sản Phẩm & Kế Hoạch</Divider>

            <Form.Item
              label="Sản Phẩm Đóng Gói"
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
                  label="Ngày Tạo Lệnh"
                  name="created_date"
                  rules={[{ required: true, message: 'Chọn ngày tạo' }]}
                >
                  <DatePicker format="DD/MM/YYYY" style={{ width: '100%', borderRadius: 6 }} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Số Lô (Lot/Batch)"
                  name="lot_number"
                  rules={[{ required: true, message: 'Nhập số lô' }]}
                >
                  <Input placeholder="Nhập số lô đóng gói" style={{ borderRadius: 6 }} />
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
              <Col span={12}>
                <Form.Item
                  label="Cỡ Lô (Tổng Số Lượng)"
                  name="batch_size"
                  rules={[{ required: true, message: 'Nhập tổng số lượng dán' }]}
                >
                  <InputNumber min={1} style={{ width: '100%', borderRadius: 6 }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Mẫu nhãn phụ sử dụng (Gắn từ LBL)" name="label_version_id">
                  <Select
                    placeholder="Chọn mẫu nhãn phụ..."
                    options={allLabels
                      .filter(l => l.item_code === form.getFieldValue('item_code'))
                      .map(l => ({ value: l.id, label: `${l.base_label_code} - ${l.version_number} (${l.status})` }))
                    }
                    style={{ borderRadius: 6 }}
                  />
                </Form.Item>
              </Col>
            </Row>

            <div style={{ padding: '8px 12px', background: '#f0fdfa', borderRadius: 8, marginBottom: 16, border: '1px dashed #5eead4', display: 'flex', gap: 6, alignItems: 'center' }}>
              <CheckCircle size={15} color="#0d9488" />
              <span style={{ fontSize: 11, color: '#0f766e', fontWeight: 500 }}>
                Phiên bản thiết kế liên kết: {activeLabelInfo}
              </span>
            </div>

            <Form.Item label="Yêu Cầu Đóng Gói (Ví dụ: dán nắp hộp, dán nhãn ngang...)" name="packaging_req">
              <Input.TextArea rows={2} placeholder="Yêu cầu dán nhãn chi tiết..." style={{ borderRadius: 6 }} />
            </Form.Item>

            <Form.Item label="Link Ảnh Chụp 6 Mặt Thực Tế Đã Dán Tem" name="six_sides_photo">
              <Input prefix={<Image size={14} color="#64748b" />} placeholder="Link ảnh lưu trữ SharePoint..." style={{ borderRadius: 6 }} />
            </Form.Item>

            <Form.Item label="Ghi chú chung" name="general_notes">
              <Input.TextArea rows={2} placeholder="Ghi chú thêm..." style={{ borderRadius: 6 }} />
            </Form.Item>

            {/* LPN List Section */}
            <Divider orientation="left" style={{ fontSize: 13, color: '#0f766e', margin: '20px 0 12px' }}>
              Danh Sách Pallets/LPNs Định Danh
            </Divider>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <Button
                type="dashed"
                onClick={handleAddLpn}
                icon={<Plus size={14} />}
                style={{ borderColor: '#0d9488', color: '#0d9488', borderRadius: 6 }}
              >
                Thêm LPN/Pallet
              </Button>
            </div>

            {lpnList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', background: '#f1f5f9', borderRadius: 8, color: '#94a3b8', fontSize: 13 }}>
                <Layers size={24} style={{ marginBottom: 6, opacity: 0.5 }} />
                <p style={{ margin: 0 }}>Chưa có Pallet nào được liên kết với lệnh dán nhãn này.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {lpnList.map((lpn, index) => (
                  <Card key={index} size="small" style={{ background: 'white', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <Row gutter={12} align="middle">
                      <Col span={6}>
                        <Form.Item label="Mã LPN" required style={{ margin: 0 }}>
                          <Input
                            value={lpn.lpn_code}
                            onChange={(e) => handleLpnCellChange(index, 'lpn_code', e.target.value)}
                            placeholder="Mã LPN"
                            style={{ borderRadius: 6, fontSize: 12 }}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item label="Số lượng" required style={{ margin: 0 }}>
                          <InputNumber
                            min={0}
                            value={lpn.quantity}
                            onChange={(val) => handleLpnCellChange(index, 'quantity', val || 0)}
                            style={{ width: '100%', borderRadius: 6, fontSize: 12 }}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item label="Đã duyệt" style={{ margin: 0 }}>
                          <InputNumber
                            min={0}
                            value={lpn.released_qty || 0}
                            onChange={(val) => handleLpnCellChange(index, 'released_qty', val || 0)}
                            style={{ width: '100%', borderRadius: 6, fontSize: 12 }}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="Sự cố / Ghi chú" style={{ margin: 0 }}>
                          <Input
                            value={lpn.incident_note || ''}
                            onChange={(e) => handleLpnCellChange(index, 'incident_note', e.target.value)}
                            placeholder="Báo lỗi móp, rách..."
                            style={{ borderRadius: 6, fontSize: 12 }}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={2} style={{ textAlign: 'center', paddingTop: 24 }}>
                        <Popconfirm
                          title="Xóa LPN này khỏi lệnh?"
                          onConfirm={() => handleRemoveLpn(index)}
                          okText="Xóa"
                          cancelText="Không"
                          okButtonProps={{ danger: true }}
                        >
                          <Button
                            type="text"
                            danger
                            icon={<Trash2 size={15} />}
                          />
                        </Popconfirm>
                      </Col>
                    </Row>
                  </Card>
                ))}
              </div>
            )}
          </Form>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
