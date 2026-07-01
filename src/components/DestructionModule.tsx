'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Tag, Select, Space, Tooltip,
  Badge, Drawer, Form, InputNumber, message, Statistic,
  Row, Col, Popconfirm, Modal, Spin, Tabs, Card, Alert,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  Search, RefreshCw, Trash2, FileDown, Eye, CheckCircle2,
  AlertTriangle, Clock, Filter, Download, FlaskConical,
  LayoutDashboard, BarChart3, FileText, List, Settings, Plus
} from 'lucide-react';
import { ColumnSearchHeader, applyColumnFilters } from '@/lib/columnSearch';
import TableControls, { ColumnConfig } from '@/components/TableControls';
import ResizableTitle from '@/components/ResizableTitle';
import { useTablePreferences } from '@/lib/useTablePreferences';
import dayjs from 'dayjs';
import { syncMasterData } from '@/lib/masterDataSync';
import { supabase } from '@/lib/supabase';
import { useMasterItems } from '@/lib/useMasterData';

/* ──────────────────────────────────────────────────
   Types
────────────────────────────────────────────────── */
export interface DestructionRecord {
  id: number;
  owner: string;
  item: string;
  descr: string;
  location: string;
  lpn: string;
  onHand: number;
  available: number;
  status: string;
  visa: string;
  lotNo: string;
  expDate: string;
  soBatch: string;
  // HOLD
  lyDoHold: string;
  loaiHold: string;
  ngayHold: string;
  nguoiHold: string;
  ghiChu: string;
  // Item
  grossWgt: number;
  netWgt: number;
  tare: number;
  cube: number;
  // Pack
  innerPack: number;
  caseCnt: number;
  pallet: number;
  uom: string;
  // Decision
  decision: '' | 'HUY' | 'GIU' | 'TRA';
  soLuongHuy: number;
  lyDoQD: string;
  nguoiDuyet: string;
  ngayDuyet: string;
}

const DECISION_OPTIONS = [
  { value: '', label: 'Chưa quyết định' },
  { value: 'HUY', label: '🔴 Hủy' },
  { value: 'GIU', label: '🟡 Giữ lại' },
  { value: 'TRA', label: '🔵 Trả nhà cung cấp' },
];

const DECISION_COLOR: Record<string, string> = {
  HUY: 'error', GIU: 'warning', TRA: 'processing', '': 'default',
};

const DECISION_LABEL: Record<string, string> = {
  HUY: 'Hủy', GIU: 'Giữ lại', TRA: 'Trả NCC', '': 'Chưa QĐ',
};

/* ──────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────── */
const STORAGE_KEY = 'destruction-decisions-v1';

function loadDecisions(): Record<number, Partial<DestructionRecord>> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch { return {}; }
}

function saveDecisions(map: Record<number, Partial<DestructionRecord>>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/* ──────────────────────────────────────────────────
   Constants
────────────────────────────────────────────────── */
const DEFAULT_DESTR_COLS: ColumnConfig[] = [
  { key: 'stt',      label: 'STT',           visible: true, fixed: true },
  { key: 'owner',    label: 'Owner',          visible: true },
  { key: 'vendor',   label: 'NCC',            visible: true },
  { key: 'item',     label: 'Item',           visible: true },
  { key: 'descr',    label: 'Tên sản phẩm', visible: true },
  { key: 'location', label: 'Vị trí',       visible: true },
  { key: 'lpn',      label: 'LPN',            visible: true },
  { key: 'onHand',   label: 'Tồn kho',       visible: true },
  { key: 'expDate',  label: 'HSD',            visible: true },
  { key: 'lyDoHold', label: 'Holdcode',      visible: true },
  { key: 'ghiChu',   label: 'Lý do hold',    visible: true },
  { key: 'decision', label: 'Quyết định',  visible: true, fixed: true },
  { key: 'actions',  label: 'Chi tiết',      visible: true, fixed: true },
];

const DEFAULT_DESTR_WIDTHS: Record<string, number> = {
  stt: 55, owner: 90, vendor: 70, item: 110, descr: 220, location: 110,
  lpn: 110, onHand: 80, expDate: 100, lyDoHold: 150, ghiChu: 180, decision: 130, actions: 50,
};

const DESTR_DB_COLUMNS: Record<string, string> = {
  owner: 'owner',
  item: 'item',
  descr: 'descr',
  location: 'location',
  lpn: 'lpn',
  onHand: 'on_hand',
  expDate: 'exp_date',
  lyDoHold: 'ly_do_hold',
  ghiChu: 'ghi_chu',
  decision: 'decision'
};

/* ──────────────────────────────────────────────────
   Main Component
────────────────────────────────────────────────── */
export default function DestructionModule({ userId = 'default' }: { userId?: string }) {
  const [messageApi, ctx] = message.useMessage();
  const [data, setData] = useState<DestructionRecord[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [summaryData, setSummaryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('list');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [detailRow, setDetailRow] = useState<DestructionRecord | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<number[]>([]);
  const [batchDecision, setBatchDecision] = useState<string>('');
  const [isMounted, setIsMounted] = useState(false);
  const [lastCalculatedAt, setLastCalculatedAt] = useState<string | null>(null);
  const [vendorRules, setVendorRules] = useState<{prefix: string, label: string}[]>([]);

  const { data: masterItemsRaw = [] } = useMasterItems();
  const masterItems = useMemo(() => masterItemsRaw.filter(x => x.is_active), [masterItemsRaw]);

  const SNAPSHOT_KEY = 'destruction-snapshot-v1';
  const SNAPSHOT_TIME_KEY = 'destruction-snapshot-time-v1';

  const getVendorLabel = useCallback((itemCode: string) => {
    if (!itemCode) return '';
    const sortedRules = [...vendorRules].sort((a, b) => b.prefix.length - a.prefix.length);
    for (const rule of sortedRules) {
      if (itemCode.startsWith(rule.prefix)) return rule.label;
    }
    return itemCode.substring(0, 2).toUpperCase();
  }, [vendorRules]);

  // Load Rules on mount
  useEffect(() => {
    const loadRules = async () => {
      try {
        const { data: rules, error: rulesError } = await supabase
          .from('vendor_rules')
          .select('*')
          .order('id', { ascending: true });
        
        if (rulesError) {
          console.warn('Lỗi load rules:', rulesError.message);
        } else {
          setVendorRules(rules || []);
        }
      } catch (err: any) {
        console.error('Lỗi kết nối database để tải rules:', err);
      }
    };
    if (isMounted) {
      loadRules();
    }
  }, [isMounted]);

  const loadPageData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch paginated records from DB with server-side filters
      let query = supabase
        .from('destruction_records')
        .select('*', { count: 'exact' });

      // Apply column filters
      for (const [key, value] of Object.entries(columnFilters)) {
        if (!value || value.trim() === '') continue;
        
        if (key === 'vendor') {
          const matchingRules = vendorRules.filter(r => r.label.toLowerCase().includes(value.toLowerCase().trim()));
          if (matchingRules.length > 0) {
            const orClauses = matchingRules.map(r => `item.ilike.${r.prefix}%`).join(',');
            query = query.or(orClauses);
          } else {
            query = query.ilike('item', `%${value.trim()}%`);
          }
        } else {
          const dbCol = DESTR_DB_COLUMNS[key] || key;
          query = query.ilike(dbCol, `%${value.trim()}%`);
        }
      }

      query = query.order('id', { ascending: true });
      const from = (currentPage - 1) * pageSize;
      query = query.range(from, from + pageSize - 1);

      const { data: records, count, error } = await query;
      if (error) throw error;

      if (records) {
        const mapped: DestructionRecord[] = records.map(r => ({
          id: Number(r.id),
          owner: r.owner,
          item: r.item,
          descr: r.descr,
          location: r.location,
          lpn: r.lpn,
          onHand: Number(r.on_hand),
          available: Number(r.available),
          status: r.status,
          visa: r.visa,
          lotNo: r.lot_no,
          expDate: r.exp_date,
          soBatch: r.so_batch,
          lyDoHold: r.ly_do_hold,
          loaiHold: r.loai_hold,
          ngayHold: r.ngay_hold,
          nguoiHold: r.nguoi_hold,
          ghiChu: r.ghi_chu,
          grossWgt: Number(r.gross_wgt),
          netWgt: Number(r.net_wgt),
          tare: Number(r.tare),
          cube: Number(r.cube),
          innerPack: Number(r.inner_pack),
          caseCnt: Number(r.case_cnt),
          pallet: Number(r.pallet),
          uom: r.uom,
          decision: r.decision || '',
          soLuongHuy: Number(r.so_luong_huy) || 0,
          lyDoQD: r.ly_do_qd || '',
          nguoiDuyet: r.nguoi_duyet || '',
          ngayDuyet: r.ngay_duyet || '',
          vendor: getVendorLabel(r.item),
        }));
        setData(mapped);
        setTotalCount(count || 0);
      }

      // 2. Fetch lightweight summary for stats and zone calculations
      const { data: summary, error: summaryErr } = await supabase
        .from('destruction_records')
        .select('id, owner, decision, location, on_hand, gross_wgt, pallet, lpn');
      if (summaryErr) throw summaryErr;
      setSummaryData(summary || []);

      const snapTime = localStorage.getItem(SNAPSHOT_TIME_KEY) || dayjs().format('DD/MM/YYYY HH:mm:ss');
      setLastCalculatedAt(snapTime);
    } catch (err: any) {
      messageApi.error(err.message || 'Lỗi tải dữ liệu!');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, columnFilters, vendorRules, getVendorLabel, messageApi]);

  useEffect(() => {
    if (isMounted && vendorRules.length >= 0) {
      loadPageData();
    }
  }, [isMounted, currentPage, pageSize, columnFilters, vendorRules, loadPageData]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ── Per-user persistent preferences ──
  const { prefs, save, setColumnWidth } = useTablePreferences(
    'destruction', userId, DEFAULT_DESTR_COLS,
  );
  const { columnConfigs, showFilters, columnWidths } = prefs;

  const handleColumnFilter = (key: string, value: string) => {
    setColumnFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  // ── Column width helper ──
  const w = (key: string) => columnWidths[key] ?? DEFAULT_DESTR_WIDTHS[key] ?? 100;
  const resizable = (key: string) => ({
    width: w(key),
    ellipsis: true,
    onHeaderCell: () => ({
      onResize: (width: number) => setColumnWidth(key, width),
    } as any),
  });

  /* persist decision changes in Supabase */
  const updateRecord = useCallback(async (id: number, patch: Partial<DestructionRecord>) => {
    setData(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
    setSummaryData(prev => prev.map(r => r.id === id ? { ...r, decision: patch.decision ?? r.decision } : r));

    const dbPatch: Record<string, any> = {};
    if (patch.decision !== undefined) dbPatch.decision = patch.decision;
    if (patch.soLuongHuy !== undefined) dbPatch.so_luong_huy = patch.soLuongHuy;
    if (patch.lyDoQD !== undefined) dbPatch.ly_do_qd = patch.lyDoQD;
    if (patch.nguoiDuyet !== undefined) dbPatch.nguoi_duyet = patch.nguoiDuyet;
    if (patch.ngayDuyet !== undefined) dbPatch.ngay_duyet = patch.ngayDuyet;

    const { error } = await supabase
      .from('destruction_records')
      .update(dbPatch)
      .eq('id', id);

    if (error) {
      messageApi.error('Lỗi khi lưu quyết định: ' + error.message);
    }
  }, [messageApi]);

  const owners = useMemo(() =>
    Array.from(new Set(summaryData.map(r => r.owner))).sort(),
    [summaryData]);

  /* Zone Stats Calculation */
  const zoneStats = useMemo(() => {
    const zones = [
      { id: 'med-01', name: 'Thuốc · Chờ hủy', match: (loc: string) => loc.startsWith('Q26') && loc.includes('-01-') },
      { id: 'med-02', name: 'Thuốc · Thu hồi', match: (loc: string) => loc.startsWith('Q26') && loc.includes('-02-') },
      { id: 'med-03', name: 'Thuốc · Chờ xử lý', match: (loc: string) => loc.startsWith('Q26') && loc.includes('-03-') },
      { id: 'non-01', name: 'Ngoài thuốc · Chờ hủy', match: (loc: string) => loc.startsWith('Q27') && loc.includes('-01-') },
      { id: 'non-02', name: 'Ngoài thuốc · Thu hồi', match: (loc: string) => loc.startsWith('Q27') && loc.includes('-02-') },
      { id: 'non-03', name: 'Ngoài thuốc · Chờ xử lý', match: (loc: string) => loc.startsWith('Q27') && loc.includes('-03-') },
    ];

    return zones.map(z => {
      const records = summaryData.filter(r => z.match(r.location || ''));
      const totalQty = records.reduce((sum, r) => sum + (r.on_hand || 0), 0);
      const uniqueLPNs = new Set(records.map(r => r.lpn)).size;
      const totalWeight = records.reduce((sum, r) => sum + ((r.on_hand || 0) * (r.gross_wgt || 0)), 0);
      
      const estPallets = records.reduce((sum, r) => {
        if (!r.pallet || r.pallet <= 0) return sum;
        return sum + (r.on_hand || 0) / r.pallet;
      }, 0);

      return { ...z, totalQty, uniqueLPNs, totalWeight, estPallets };
    });
  }, [summaryData]);

  /* stats */
  const stats = useMemo(() => ({
    total: summaryData.length,
    huy: summaryData.filter(r => r.decision === 'HUY').length,
    giu: summaryData.filter(r => r.decision === 'GIU').length,
    tra: summaryData.filter(r => r.decision === 'TRA').length,
    chuaQD: summaryData.filter(r => !r.decision).length,
  }), [summaryData]);

  /* Recalculate based on current Master Data */
  const recalculateData = async () => {
    setLoading(true);
    try {
      const masterMap = new Map(masterItems.map(m => [m.item_code, m]));

      // 1. Tải toàn bộ destruction records từ database để cập nhật
      const { data: records, error: fetchErr } = await supabase
        .from('destruction_records')
        .select('*');
      if (fetchErr) throw fetchErr;

      // 2. Cập nhật dữ liệu tạm trong memory
      const updatedRecords = (records || []).map(r => {
        const masterItem = masterMap.get(r.item);
        if (masterItem) {
          return {
            ...r,
            gross_wgt: Number(masterItem.gross_weight) || r.gross_wgt,
            pallet: Number(masterItem.pallet_qty) || r.pallet,
          };
        }
        return r;
      });

      // 3. Upsert hàng loạt (batch upsert) lên Supabase để ghi nhận
      const batchSize = 100;
      for (let i = 0; i < updatedRecords.length; i += batchSize) {
        const batch = updatedRecords.slice(i, i + batchSize);

        const { error: upsertError } = await supabase
          .from('destruction_records')
          .upsert(batch);
        
        if (upsertError) throw upsertError;
      }

      await loadPageData();
      const nowStr = dayjs().format('DD/MM/YYYY HH:mm:ss');
      localStorage.setItem(SNAPSHOT_TIME_KEY, nowStr);
      setLastCalculatedAt(nowStr);
      messageApi.success('Đã tính toán lại dữ liệu và đồng bộ lên Supabase thành công!');
    } catch (e: any) {
      messageApi.error('Lỗi khi tính toán lại dữ liệu: ' + (e.message || e));
    } finally {
      setLoading(false);
    }
  };

  /* batch decision */
  const applyBatch = () => {
    if (!batchDecision || selectedKeys.length === 0) return;
    const now = dayjs().format('DD/MM/YYYY HH:mm');
    selectedKeys.forEach(id => {
      updateRecord(id, {
        decision: batchDecision as DestructionRecord['decision'],
        ngayDuyet: now,
      });
    });
    messageApi.success(`Đã áp dụng "${DECISION_LABEL[batchDecision]}" cho ${selectedKeys.length} dòng`);
    setSelectedKeys([]);
  };

  /* export CSV */
  const exportCSV = () => {
    const headers = [
      'Owner', 'Item', 'Description', 'Số lô', 'HSD', 'Số lượng', 'LPN', 'Location', 'Gross Weight', 'Khối lượng (kg)', 'Pallet Qty', 'Pallet (ước tính)', 'HoldCode', 'Lý do hold',
    ];
    const rows = data.map((r) => {
      // Logic ưu tiên HoldCode: Reject > Recall > Damage
      let holdCode = r.lyDoHold || '';
      const upper = holdCode.toUpperCase();
      if (upper.includes('REJECT')) holdCode = 'REJECT';
      else if (upper.includes('RECALL')) holdCode = 'RECALL';
      else if (upper.includes('DAMAGE')) holdCode = 'DAMAGE';

      return [
        r.owner,
        r.item,
        `"${r.descr.replace(/"/g, '""')}"`,
        r.lotNo || '',
        r.expDate || '',
        r.onHand,
        r.lpn,
        r.location,
        r.grossWgt || 0,
        ((r.onHand || 0) * (r.grossWgt || 0)).toFixed(4),
        r.pallet || 0,
        r.pallet && r.pallet > 0 ? ((r.onHand || 0) / r.pallet).toFixed(4) : '0',
        holdCode,
        `"${(r.ghiChu || '').replace(/"/g, '""')}"`,
      ];
    });
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Danh_sach_huy_${dayjs().format('YYYYMMDD_HHmm')}.csv`;
    a.click();
    messageApi.success('Đã xuất file CSV!');
  };

  /* columns */
  const allColumnDefs: Record<string, object | null> = {
    stt: {
      title: <ColumnSearchHeader title="STT" dataKey="__stt" filters={columnFilters} onFilterChange={handleColumnFilter} align="center" showFilters={showFilters} />,
      key: 'stt', align: 'center' as const,
      ...resizable('stt'),
      render: (_: unknown, __: unknown, idx: number) => <span style={{color:'#94a3b8',fontSize:12}}>{idx+1}</span>,
    },
    owner: {
      title: <ColumnSearchHeader title="Owner" dataKey="owner" filters={columnFilters} onFilterChange={handleColumnFilter} showFilters={showFilters} />,
      dataIndex: 'owner', key: 'owner',
      ...resizable('owner'),
      render: (v: string) => <Tag color="blue" style={{fontSize:11,fontWeight:600,margin:0}}>{v}</Tag>,
    },
    vendor: {
      title: <ColumnSearchHeader title="NCC" dataKey="vendor" filters={columnFilters} onFilterChange={handleColumnFilter} align="center" showFilters={showFilters} />,
      dataIndex: 'vendor', key: 'vendor', align: 'center' as const,
      ...resizable('vendor'),
      render: (v: string) => <Tag color="blue" style={{ borderRadius: 4, fontWeight: 600 }}>{v}</Tag>,
    },
    item: {
      title: <ColumnSearchHeader title="Item" dataKey="item" filters={columnFilters} onFilterChange={handleColumnFilter} showFilters={showFilters} />,
      dataIndex: 'item', key: 'item',
      ...resizable('item'),
      render: (v: string) => (
        <code style={{
          fontFamily:'monospace',fontWeight:700,color:'#0d9488',
          background:'#f0fdfa',padding:'2px 6px',borderRadius:5,fontSize:12,
          display: 'inline-block', maxWidth: '100%', overflow: 'hidden', 
          textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}>
          {v}
        </code>
      ),
    },
    descr: {
      title: <ColumnSearchHeader title="Tên sản phẩm" dataKey="descr" filters={columnFilters} onFilterChange={handleColumnFilter} showFilters={showFilters} />,
      dataIndex: 'descr', key: 'descr',
      ...resizable('descr'),
      render: (v: string) => {
        const display = v && v.length > 50 ? `${v.substring(0, 50)}...` : v;
        return (
          <Tooltip title={v} placement="topLeft">
            <span style={{
              fontWeight:500, color:'#1e293b', display: 'block', 
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>
              {display}
            </span>
          </Tooltip>
        );
      },
    },
    location: {
      title: <ColumnSearchHeader title="Vị trí" dataKey="location" filters={columnFilters} onFilterChange={handleColumnFilter} showFilters={showFilters} />,
      dataIndex: 'location', key: 'location',
      ...resizable('location'),
      render: (v: string) => <span style={{fontFamily:'monospace',fontSize:12,color:'#1e293b'}}>{v}</span>,
    },
    lpn: {
      title: <ColumnSearchHeader title="LPN" dataKey="lpn" filters={columnFilters} onFilterChange={handleColumnFilter} showFilters={showFilters} />,
      dataIndex: 'lpn', key: 'lpn',
      ...resizable('lpn'),
      render: (v: string) => (
        <span style={{
          fontFamily:'monospace',fontSize:12,color:'#7c3aed',
          display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}>
          {v}
        </span>
      ),
    },
    onHand: {
      title: <ColumnSearchHeader title="Tồn kho" dataKey="onHand" filters={columnFilters} onFilterChange={handleColumnFilter} align="right" showFilters={showFilters} />,
      dataIndex: 'onHand', key: 'onHand', align: 'right' as const,
      ...resizable('onHand'),
      render: (v: number) => <strong style={{color: v > 0 ? '#dc2626' : '#94a3b8'}}>{v}</strong>,
    },
    expDate: {
      title: <ColumnSearchHeader title="HSD" dataKey="expDate" filters={columnFilters} onFilterChange={handleColumnFilter} showFilters={showFilters} />,
      dataIndex: 'expDate', key: 'expDate',
      ...resizable('expDate'),
      render: (v: string) => v ? <span style={{fontSize:12,color:'#ef4444',fontWeight:500}}>{v}</span> : <span style={{color:'#cbd5e1'}}>—</span>,
    },
    lyDoHold: {
      title: <ColumnSearchHeader title="Holdcode" dataKey="lyDoHold" filters={columnFilters} onFilterChange={handleColumnFilter} align="center" showFilters={showFilters} />,
      dataIndex: 'lyDoHold', key: 'lyDoHold', align: 'center' as const,
      ...resizable('lyDoHold'),
      render: (v: string) => {
        if (!v) return <span style={{color:'#cbd5e1',fontSize:12}}>—</span>;
        
        let label = v;
        let color = 'default';
        let textColor = '#fff';

        if (v.includes('REJECT')) { label = 'Reject'; color = '#ef4444'; }
        else if (v.includes('RECALL')) { label = 'Recall'; color = '#f97316'; }
        else if (v.includes('DAMAGED')) { label = 'Damage'; color = '#3b82f6'; }

        return (
          <Tooltip title={v}>
            <Tag color={color} style={{ 
              fontSize: 11, 
              borderRadius: 6, 
              fontWeight: 600,
              minWidth: 60,
              textAlign: 'center',
              border: 'none'
            }}>
              {label}
            </Tag>
          </Tooltip>
        );
      },
    },
    ghiChu: {
      title: <ColumnSearchHeader title="Lý do hold" dataKey="ghiChu" filters={columnFilters} onFilterChange={handleColumnFilter} showFilters={showFilters} />,
      dataIndex: 'ghiChu', key: 'ghiChu',
      ...resizable('ghiChu'),
      render: (v: string) => {
        const display = v && v.length > 50 ? `${v.substring(0, 50)}...` : v;
        return (
          <Tooltip title={v}>
            <span style={{ fontSize: 12, color: '#64748b' }}>{display || '—'}</span>
          </Tooltip>
        );
      },
    },
    decision: {
      title: 'Quyết định', key: 'decision', fixed: 'right' as const,
      ...resizable('decision'),
      render: (_: unknown, record: DestructionRecord) => (
        <Select
          size="small" value={record.decision}
          onChange={val => updateRecord(record.id, {
            decision: val as DestructionRecord['decision'],
            ngayDuyet: val ? dayjs().format('DD/MM/YYYY HH:mm') : '',
          })}
          style={{width: 135}} options={DECISION_OPTIONS}
          getPopupContainer={() => document.body}
        />
      ),
    },
    actions: {
      title: '', key: 'actions', fixed: 'right' as const,
      ...resizable('actions'),
      render: (_: unknown, record: DestructionRecord) => (
        <Tooltip title="Chi tiết">
          <Button type="text" size="small" icon={<Eye size={14} color="#64748b"/>}
            onClick={() => setDetailRow(record)} style={{borderRadius:8}}/>
        </Tooltip>
      ),
    },
  };

  // Build visible columns list
  const visibleColumns = useMemo(() => {
    return columnConfigs
      .filter(c => c.visible)
      .map(config => allColumnDefs[config.key as keyof typeof allColumnDefs])
      .filter(Boolean);
  }, [columnConfigs, allColumnDefs]);

  // Calculate total table width dynamically
  const totalWidth = useMemo(() => {
    return columnConfigs
      .filter(c => c.visible)
      .reduce((sum, c) => sum + (columnWidths[c.key] || (allColumnDefs[c.key as keyof typeof allColumnDefs] as any)?.width || 120), 0);
  }, [columnConfigs, columnWidths, allColumnDefs]);

  const columns: ColumnsType<DestructionRecord> = columnConfigs
    .filter(cfg => cfg.visible)
    .map(cfg => allColumnDefs[cfg.key] as ColumnsType<DestructionRecord>[number])
    .filter(Boolean) as ColumnsType<DestructionRecord>;

  /* detail fields */
  const DetailItem = ({ label, value, mono = false }: {label:string,value:React.ReactNode,mono?:boolean}) => (
    <div style={{marginBottom:10}}>
      <div style={{fontSize:11,color:'#94a3b8',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>
        {label}
      </div>
      <div style={{fontSize:13,color:'#1e293b',fontWeight:500,fontFamily:mono?'monospace':'inherit'}}>
        {value || <span style={{color:'#cbd5e1'}}>—</span>}
      </div>
    </div>
  );

  if (!isMounted) return null;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {ctx}

      <Row gutter={[20, 20]} style={{ flex: 1, overflow: 'hidden' }}>
        {/* ── Sidebar Stats ── */}
        <Col xs={24} lg={6} xl={5} style={{ height: '100%', overflowY: 'auto', paddingRight: 4 }}>
          <div style={{ paddingBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 12,
                background: 'linear-gradient(135deg,#fef2f2,rgba(239,68,68,0.2))',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <FlaskConical size={20} color="#dc2626" strokeWidth={1.8} style={{ margin: 'auto' }} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>
                  DES (Hủy hàng)
                </h2>
                <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>
                  08/05/2026
                </p>
              </div>
            </div>

            <Space direction="vertical" style={{ width: '100%' }} size={10}>
              {[
                { title: 'Tổng cộng', value: stats.total, color: '#1e293b', bg: '#f8fafc' },
                { title: 'Chưa QĐ', value: stats.chuaQD, color: '#64748b', bg: '#f1f5f9' },
                { title: 'Hủy', value: stats.huy, color: '#dc2626', bg: '#fef2f2' },
                { title: 'Giữ lại', value: stats.giu, color: '#d97706', bg: '#fffbeb' },
                { title: 'Trả NCC', value: stats.tra, color: '#2563eb', bg: '#eff6ff' },
              ].map(s => (
                <div key={s.title} style={{
                  background: s.bg, borderRadius: 12, padding: '10px 14px',
                  border: `1px solid ${s.color}15`, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{s.title}</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</span>
                </div>
              ))}

              <div style={{
                background: '#f0fdf4', borderRadius: 12, padding: '12px 14px',
                border: '1px solid #bbf7d0', marginTop: 4
              }}>
                <div style={{ fontSize: 11, color: '#059669', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>
                  Tiến độ xử lý
                </div>
                <div style={{ height: 6, background: 'rgba(5,150,105,0.1)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 99,
                    background: 'linear-gradient(90deg,#10b981,#059669)',
                    width: `${Math.round(((stats.total - stats.chuaQD) / stats.total) * 100)}%`,
                    transition: 'width 0.5s ease'
                  }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#059669', marginTop: 6 }}>
                  {Math.round(((stats.total - stats.chuaQD) / stats.total) * 100)}% hoàn thành
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                {lastCalculatedAt && (
                  <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center', marginBottom: 8 }}>
                    Cập nhật lần cuối: <br /><strong>{lastCalculatedAt}</strong>
                  </div>
                )}
                
                <Button block type="primary" icon={<RefreshCw size={14} />}
                  onClick={recalculateData}
                  style={{ borderRadius: 8, fontSize: 13, height: 36, marginBottom: 8, background: '#0ea5e9' }}>
                  Tính toán lại
                </Button>

                <Button block icon={<RefreshCw size={14} />}
                  onClick={() => { setColumnFilters({}); }}
                  style={{ borderRadius: 8, fontSize: 13, height: 36, marginBottom: 8 }}>
                  Reset bộ lọc
                </Button>
                
                <Button block icon={<Download size={14} />}
                  onClick={exportCSV}
                  style={{ borderRadius: 8, fontSize: 13, height: 36, background: '#f8fafc', color: '#1e293b', border: '1px solid #e2e8f0', fontWeight: 600 }}>
                  Xuất CSV
                </Button>
              </div>
            </Space>
          </div>
        </Col>

        {/* ── Main Content Column ── */}
        <Col xs={24} lg={18} xl={19} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            className="custom-tabs"
            style={{ marginBottom: 8 }}
            items={[
              { key: 'list', label: <span style={{display:'flex',alignItems:'center',gap:6}}><List size={16}/> Tồn Q</span> },
              { key: 'overview', label: <span style={{display:'flex',alignItems:'center',gap:6}}><LayoutDashboard size={16}/> Tổng quan</span> },
              { key: 'chart', label: <span style={{display:'flex',alignItems:'center',gap:6}}><BarChart3 size={16}/> Chart</span> },
              { key: 'bm', label: <span style={{display:'flex',alignItems:'center',gap:6}}><FileText size={16}/> BM</span> },
              { key: 'rules', label: <span style={{display:'flex',alignItems:'center',gap:6}}><Settings size={16}/> Cài đặt NCC/BP</span> },
            ]}
            tabBarExtraContent={
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <TableControls
                  showFilters={showFilters}
                  onToggleFilters={() => save({ showFilters: !showFilters })}
                  columns={columnConfigs}
                  onColumnsChange={(configs) => save({ columnConfigs: configs })}
                />
              </div>
            }
          />

          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {activeTab === 'list' && (
              <>
                {/* ── Batch action bar ── */}
                {selectedKeys.length > 0 && (
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10,
                    padding:'10px 16px',background:'#eff6ff',borderRadius:12,
                    border:'1px solid #bfdbfe',flexWrap:'wrap'}}>
                    <span style={{fontSize:13,fontWeight:600,color:'#1d4ed8'}}>
                      Đã chọn {selectedKeys.length} dòng
                    </span>
                    <Select value={batchDecision} onChange={setBatchDecision}
                      style={{width:180}} options={DECISION_OPTIONS}/>
                    <Button type="primary" size="small" onClick={applyBatch}
                      disabled={!batchDecision}
                      style={{borderRadius:8,background:'#2563eb',borderColor:'#2563eb',fontWeight:600}}>
                      Áp dụng hàng loạt
                    </Button>
                    <Button size="small" onClick={() => setSelectedKeys([])}
                      style={{borderRadius:8}}>Bỏ chọn</Button>
                  </div>
                )}

                <div style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.85)', borderRadius: 12,
                  border: '1px solid #e2e8f0', overflow: 'hidden', backdropFilter: 'blur(12px)',
                  boxShadow: '0 4px 20px rgba(220,38,38,0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  <Table<DestructionRecord>
                    columns={columns}
                    dataSource={data}
                    rowKey="id"
                    loading={loading}
                    scroll={{ x: totalWidth, y: 'calc(100vh - 440px)' }}
                    sticky={{ offsetHeader: -16 }}
                    size="small"
                    rowSelection={{
                      selectedRowKeys: selectedKeys,
                      onChange: keys => setSelectedKeys(keys as number[]),
                    }}
                    pagination={{
                      current: currentPage,
                      pageSize: pageSize,
                      total: totalCount,
                      onChange: (p, s) => {
                        setCurrentPage(p);
                        setPageSize(s);
                      },
                      showSizeChanger: true,
                      pageSizeOptions: [10, 20, 50, 100],
                      showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} dòng`,
                      style: { padding: '10px 16px', margin: 0 },
                    }}
                    rowClassName={(record) => {
                      if (record.decision === 'HUY') return 'row-huy';
                      if (record.decision === 'GIU') return 'row-giu';
                      if (record.decision === 'TRA') return 'row-tra';
                      return '';
                    }}
                    components={{ header: { cell: ResizableTitle } }}
                  />
                </div>
              </>
            )}

            {activeTab === 'overview' && (
              <div style={{ height: '100%', overflowY: 'auto', paddingRight: 4 }}>
                <Row gutter={[16, 16]}>
                  <Col span={24}>
                    <Card title={<span style={{fontSize:15,fontWeight:700,color:'#1e293b'}}>📊 Phân bố hàng hóa theo khu vực</span>} 
                      styles={{body: {padding:0}}} style={{borderRadius:12, overflow:'hidden', border:'1px solid #e2e8f0'}}>
                      <Table
                        pagination={false}
                        size="middle"
                        dataSource={zoneStats}
                        rowKey="id"
                        columns={[
                          { title: 'Khu vực', dataIndex: 'name', key: 'name', render: (v) => <strong>{v}</strong> },
                          { title: 'Số lượng', dataIndex: 'totalQty', key: 'totalQty', align: 'right', render: (v) => v.toLocaleString() },
                          { title: 'Số LPN', dataIndex: 'uniqueLPNs', key: 'uniqueLPNs', align: 'right' },
                          { title: 'Khối lượng (kg)', dataIndex: 'totalWeight', key: 'totalWeight', align: 'right', render: (v) => v.toFixed(2) },
                          { title: 'Pallet (ước tính)', dataIndex: 'estPallets', key: 'estPallets', align: 'right', render: (v) => v.toFixed(2) },
                        ]}
                      />
                    </Card>
                  </Col>
                </Row>
              </div>
            )}

            {activeTab === 'chart' && (
              <div style={{ padding: 40, textAlign: 'center', background: '#f8fafc', borderRadius: 12, border: '1px dashed #cbd5e1' }}>
                <BarChart3 size={48} color="#94a3b8" style={{ marginBottom: 16 }} />
                <h3 style={{ color: '#64748b' }}>Trực quan hóa số liệu (Đang phát triển)</h3>
                <p style={{ color: '#94a3b8' }}>Biểu đồ phân tích xu hướng và tỉ lệ sẽ được hiển thị tại đây.</p>
              </div>
            )}

            {activeTab === 'bm' && (
              <div style={{ padding: 40, textAlign: 'center', background: '#f8fafc', borderRadius: 12, border: '1px dashed #cbd5e1' }}>
                <FileText size={48} color="#94a3b8" style={{ marginBottom: 16 }} />
                <h3 style={{ color: '#64748b' }}>Hệ thống biểu mẫu (Đang phát triển)</h3>
                <p style={{ color: '#94a3b8' }}>Chức năng xuất báo cáo và biểu mẫu trình ký theo quy định.</p>
              </div>
            )}

            {activeTab === 'rules' && (
              <div style={{ height: '100%', overflowY: 'auto' }}>
                <Card title={<Space><Settings size={18} color="#0ea5e9"/> Cài đặt Rule phân loại NCC/BP</Space>} 
                  style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <div style={{ marginBottom: 20 }}>
                    <Alert 
                      message="Hướng dẫn thiết lập"
                      description="Hệ thống sẽ quét Mã sản phẩm theo các tiền tố (Prefix) dưới đây để gán tên NCC/BP. Quy tắc nào dài hơn sẽ được ưu tiên trước. Nếu không khớp sẽ lấy 2 ký tự đầu."
                      type="info" showIcon 
                    />
                  </div>
                  
                  <Table
                    size="middle"
                    dataSource={vendorRules.map((r, i) => ({ ...r, key: i }))}
                    pagination={false}
                    bordered
                    columns={[
                      { 
                        title: 'Prefix (Mã bắt đầu bằng)', dataIndex: 'prefix', key: 'prefix',
                        render: (v) => <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, color: '#0f172a', fontWeight: 700 }}>{v}</code>
                      },
                      { 
                        title: 'Tên hiển thị (NCC/BP)', dataIndex: 'label', key: 'label',
                        render: (v) => <Tag color="blue" style={{ fontWeight: 600 }}>{v}</Tag>
                      },
                      { 
                        title: 'Thao tác', key: 'op', width: 120, align: 'center',
                        render: (_, __, index) => (
                          <Popconfirm title="Xóa quy tắc này?" onConfirm={async () => {
                            const targetRule = vendorRules[index];
                            const { error } = await supabase
                              .from('vendor_rules')
                              .delete()
                              .eq('prefix', targetRule.prefix);
                            if (!error) {
                              setVendorRules(prev => prev.filter((_, i) => i !== index));
                              message.success('Đã xóa rule');
                            } else {
                              message.error('Lỗi khi xóa rule: ' + error.message);
                            }
                          }}>
                            <Button type="text" danger icon={<Trash2 size={16}/>}>Xóa</Button>
                          </Popconfirm>
                        )
                      }
                    ]}
                  />

                  <div style={{ marginTop: 24, padding: 20, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 700, marginBottom: 12, color: '#1e293b' }}>➕ Thêm quy tắc mới</div>
                    <Row gutter={12}>
                      <Col span={8}>
                        <Input id="new-prefix" placeholder="Prefix (VD: BK hoặc ST9-)" />
                      </Col>
                      <Col span={10}>
                        <Input id="new-label" placeholder="Tên NCC/BP (VD: BP TBYT)" />
                      </Col>
                      <Col span={6}>
                        <Button type="primary" block icon={<Plus size={16}/>} onClick={async () => {
                          const p = (document.getElementById('new-prefix') as HTMLInputElement).value.trim();
                          const l = (document.getElementById('new-label') as HTMLInputElement).value.trim();
                          if (!p || !l) return message.warning('Vui lòng nhập đủ thông tin');
                          if (vendorRules.find(r => r.prefix === p)) return message.error('Prefix này đã tồn tại');
                          
                          const { data: inserted, error } = await supabase
                            .from('vendor_rules')
                            .insert([{ prefix: p, label: l }])
                            .select()
                            .single();
                          
                          if (!error && inserted) {
                            setVendorRules(prev => [...prev, inserted]);
                            (document.getElementById('new-prefix') as HTMLInputElement).value = '';
                            (document.getElementById('new-label') as HTMLInputElement).value = '';
                            message.success('Đã thêm Rule mới thành công');
                          } else {
                            message.error('Lỗi khi thêm Rule: ' + (error?.message || ''));
                          }
                        }}>Thêm Rule</Button>
                      </Col>
                    </Row>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </Col>
      </Row>

      {/* ── Detail Drawer ── */}
      <Drawer
        title={
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <Eye size={18} color="#0d9488"/>
            <span style={{fontWeight:700}}>Chi tiết · {detailRow?.lpn}</span>
          </div>
        }
        open={!!detailRow}
        onClose={() => setDetailRow(null)}
        width={520}
        footer={
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <Select value={detailRow?.decision} onChange={val => {
              if (detailRow) {
                updateRecord(detailRow.id, {
                  decision: val as DestructionRecord['decision'],
                  ngayDuyet: val ? dayjs().format('DD/MM/YYYY HH:mm') : '',
                });
                setDetailRow(prev => prev ? {...prev, decision:val as DestructionRecord['decision']} : null);
              }
            }} style={{width:180}} options={DECISION_OPTIONS}/>
            <Button onClick={() => setDetailRow(null)} style={{borderRadius:10}}>Đóng</Button>
          </div>
        }
      >
        {detailRow && (
          <div>
            {/* Decision badge */}
            <div style={{marginBottom:20,padding:'12px 16px',borderRadius:12,
              background: detailRow.decision === 'HUY' ? '#fef2f2'
                : detailRow.decision === 'GIU' ? '#fffbeb'
                : detailRow.decision === 'TRA' ? '#eff6ff' : '#f8fafc',
              border:`1px solid ${detailRow.decision === 'HUY' ? '#fecaca'
                : detailRow.decision === 'GIU' ? '#fde68a'
                : detailRow.decision === 'TRA' ? '#bfdbfe' : '#e2e8f0'}`}}>
              <div style={{fontSize:11,color:'#94a3b8',textTransform:'uppercase',fontWeight:600}}>
                Quyết định hiện tại
              </div>
              <div style={{fontSize:20,fontWeight:800,marginTop:4,
                color: detailRow.decision === 'HUY' ? '#dc2626'
                  : detailRow.decision === 'GIU' ? '#d97706'
                  : detailRow.decision === 'TRA' ? '#2563eb' : '#64748b'}}>
                {DECISION_LABEL[detailRow.decision] || 'Chưa quyết định'}
              </div>
            </div>

            <div style={{background:'#f8fafc',borderRadius:12,padding:'14px 16px',marginBottom:12}}>
              <div style={{fontWeight:700,color:'#1e293b',marginBottom:10,fontSize:13}}>
                📦 Thông tin hàng hóa
              </div>
              <DetailItem label="Owner" value={<Tag color="blue">{detailRow.owner}</Tag>}/>
              <DetailItem label="Item Code" value={detailRow.item} mono/>
              <DetailItem label="Tên sản phẩm" value={detailRow.descr}/>
              <DetailItem label="Vị trí / LPN" value={`${detailRow.location} · ${detailRow.lpn}`} mono/>
              <DetailItem label="Tồn kho" value={<strong style={{color:'#dc2626'}}>{detailRow.onHand}</strong>}/>
              <DetailItem label="HSD" value={detailRow.expDate || '—'}/>
              <DetailItem label="Visa/ASN" value={detailRow.visa}/>
              <DetailItem label="Số lô" value={detailRow.lotNo || detailRow.soBatch}/>
            </div>

            <div style={{background:'#fff7ed',borderRadius:12,padding:'14px 16px',marginBottom:12}}>
              <div style={{fontWeight:700,color:'#1e293b',marginBottom:10,fontSize:13}}>
                🔒 Thông tin HOLD
              </div>
              <DetailItem label="Lý do Hold" value={<Tag color="orange">{detailRow.lyDoHold || '—'}</Tag>}/>
              <DetailItem label="Loại Hold" value={detailRow.loaiHold}/>
              <DetailItem label="Ngày Hold" value={detailRow.ngayHold}/>
              <DetailItem label="Người Hold" value={detailRow.nguoiHold}/>
              <DetailItem label="Ghi chú" value={detailRow.ghiChu}/>
            </div>

            <div style={{background:'#f0fdf4',borderRadius:12,padding:'14px 16px',marginBottom:12}}>
              <div style={{fontWeight:700,color:'#1e293b',marginBottom:10,fontSize:13}}>
                ⚖️ Thông số vật lý
              </div>
              <Row gutter={8}>
                <Col span={12}><DetailItem label="Gross Weight (kg)" value={detailRow.grossWgt || '—'}/></Col>
                <Col span={12}><DetailItem label="Net Weight (kg)" value={detailRow.netWgt || '—'}/></Col>
                <Col span={12}><DetailItem label="Tare Weight" value={detailRow.tare || '—'}/></Col>
                <Col span={12}><DetailItem label="Cube" value={detailRow.cube || '—'}/></Col>
              </Row>
            </div>

            <div style={{background:'#f5f3ff',borderRadius:12,padding:'14px 16px'}}>
              <div style={{fontWeight:700,color:'#1e293b',marginBottom:10,fontSize:13}}>
                📦 Thông tin đóng gói
              </div>
              <Row gutter={8}>
                <Col span={8}><DetailItem label="Inner Pack" value={detailRow.innerPack || '—'}/></Col>
                <Col span={8}><DetailItem label="Case (CS)" value={detailRow.caseCnt || '—'}/></Col>
                <Col span={8}><DetailItem label="Pallet" value={detailRow.pallet || '—'}/></Col>
              </Row>
              <DetailItem label="UOM" value={detailRow.uom}/>
            </div>

            {detailRow.ngayDuyet && (
              <div style={{marginTop:12,fontSize:12,color:'#94a3b8',textAlign:'center'}}>
                Cập nhật lúc {detailRow.ngayDuyet} · {detailRow.nguoiDuyet || 'Hệ thống'}
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Row color styles */}
      <style>{`
        .row-huy > td { background: #fff5f5 !important; }
        .row-giu > td { background: #fffef0 !important; }
        .row-tra > td { background: #f0f5ff !important; }
        .ant-table-row:hover .row-huy > td,
        .ant-table-row:hover .row-giu > td,
        .ant-table-row:hover .row-tra > td { opacity: 0.9; }
      `}</style>
    </div>
  );
}
