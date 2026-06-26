'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import {
  Table, Button, Drawer, Input, Tag, Space,
  Popconfirm, message, Tooltip, InputNumber, Row, Col, Select, Switch
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  Plus, Search, Edit3, Trash2, RefreshCw, Link2, Info
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ColumnSearchHeader, applyColumnFilters } from '@/lib/columnSearch';
import TableControls, { ColumnConfig } from '@/components/TableControls';
import ResizableTitle from '@/components/ResizableTitle';
import { useTablePreferences } from '@/lib/useTablePreferences';

export interface LabelMappingRecord {
  id?: number;
  product_item_code: string;
  product_name: string;
  supplier_code: string;
  label_item_code: string;
  label_name: string;
  quantity_per_unit: number;
  created_at?: string;
}

const DEFAULT_MAPPING_COLS: ColumnConfig[] = [
  { key: 'stt', label: 'STT', visible: true, fixed: true },
  { key: 'product_item_code', label: 'Mã SP', visible: true, fixed: true },
  { key: 'product_name', label: 'Tên sản phẩm', visible: true },
  { key: 'supplier_code', label: 'Hãng', visible: true },
  { key: 'label_item_code', label: 'Mã Tem/Nhãn', visible: true },
  { key: 'label_name', label: 'Tên Tem/Nhãn', visible: true },
  { key: 'quantity_per_unit', label: 'Số lượng / SP', visible: true },
  { key: 'actions', label: 'Thao tác', visible: true, fixed: true },
];

const DEFAULT_MAPPING_WIDTHS: Record<string, number> = {
  stt: 50,
  product_item_code: 120,
  product_name: 240,
  supplier_code: 100,
  label_item_code: 120,
  label_name: 220,
  quantity_per_unit: 120,
  actions: 80,
};

export default function ProductLabelManager({ userId = 'default' }: { userId?: string }) {
  const [messageApi, contextHolder] = message.useMessage();
  const [mappings, setMappings] = useState<any[]>([]);
  const [masterItems, setMasterItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'compact' | 'detailed'>('compact');

  // Form states
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedLabel, setSelectedLabel] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);

  const { prefs, save: savePrefs, setColumnWidth } = useTablePreferences(
    'product_label_mappings_table',
    userId,
    DEFAULT_MAPPING_COLS
  );

  const showFilters = prefs.showFilters;
  const columnWidths = prefs.columnWidths;

  const w = (key: string) => columnWidths[key] ?? DEFAULT_MAPPING_WIDTHS[key] ?? 100;
  const resizable = (key: string) => ({
    width: w(key),
    ellipsis: true,
    onHeaderCell: () => ({
      onResize: (width: number) => setColumnWidth(key, width),
    } as any),
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Master Items
      const { data: mItems, error: mError } = await supabase
        .from('master_items')
        .select('item_code, item_name, supplier_code')
        .eq('is_active', true);
      if (mError) throw mError;
      setMasterItems(mItems || []);

      // 2. Fetch Mappings
      const { data: maps, error: mapsError } = await supabase
        .from('product_label_mappings')
        .select('*')
        .order('id', { ascending: false });
      if (mapsError) throw mapsError;
      setMappings(maps || []);
    } catch (e: any) {
      messageApi.error('Lỗi tải dữ liệu: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Separate product items and label items
  const productOptions = useMemo(() => {
    // Exclude P.Tem or label prefix codes
    return masterItems.filter(
      item => item.supplier_code !== 'P.Tem' && !item.item_code.startsWith('TT') && !item.item_code.startsWith('BA')
    );
  }, [masterItems]);

  const labelOptions = useMemo(() => {
    // Only labels
    return masterItems.filter(
      item => item.supplier_code === 'P.Tem' || item.item_code.startsWith('TT') || item.item_code.startsWith('BA')
    );
  }, [masterItems]);

  // Map raw mappings to processed UI mappings with names
  const processedMappings = useMemo(() => {
    return mappings.map(m => {
      const product = masterItems.find(item => item.item_code === m.product_item_code);
      const label = masterItems.find(item => item.item_code === m.label_item_code);
      return {
        id: m.id,
        product_item_code: m.product_item_code,
        product_name: product ? product.item_name : 'Không rõ sản phẩm',
        supplier_code: product ? product.supplier_code : 'UNKNOWN',
        label_item_code: m.label_item_code,
        label_name: label ? label.item_name : 'Không rõ nhãn',
        quantity_per_unit: Number(m.quantity_per_unit),
        created_at: m.created_at,
      };
    });
  }, [mappings, masterItems]);

  // Apply filters & search (sorted by product_item_code so consecutive rows are grouped)
  const filteredMappings = useMemo(() => {
    let result = [...processedMappings];

    const activeColFilters = Object.fromEntries(
      Object.entries(columnFilters).filter(([, v]) => v.trim() !== '')
    );
    if (Object.keys(activeColFilters).length > 0) {
      result = applyColumnFilters(result as any, activeColFilters) as any;
    }

    if (globalSearch.trim()) {
      const q = globalSearch.toLowerCase().trim();
      result = result.filter(r => {
        return (
          r.product_item_code.toLowerCase().includes(q) ||
          r.product_name.toLowerCase().includes(q) ||
          r.label_item_code.toLowerCase().includes(q) ||
          r.label_name.toLowerCase().includes(q) ||
          r.supplier_code.toLowerCase().includes(q)
        );
      });
    }

    result.sort((a, b) => a.product_item_code.localeCompare(b.product_item_code));
    return result;
  }, [processedMappings, columnFilters, globalSearch]);

  const displayMappings = useMemo(() => {
    let productCounter = 0;
    return filteredMappings.map((item, idx) => {
      const isDuplicate = idx > 0 && filteredMappings[idx].product_item_code === filteredMappings[idx - 1].product_item_code;
      if (!isDuplicate) {
        productCounter++;
      }
      return {
        ...item,
        isDuplicateProduct: isDuplicate,
        productStt: isDuplicate ? '' : productCounter,
      };
    });
  }, [filteredMappings]);

  const compactMappings = useMemo(() => {
    const groups: Record<string, any> = {};
    processedMappings.forEach(m => {
      if (!groups[m.product_item_code]) {
        groups[m.product_item_code] = {
          id: m.product_item_code,
          product_item_code: m.product_item_code,
          product_name: m.product_name,
          supplier_code: m.supplier_code,
          label_item_codes: [],
          label_names: [],
        };
      }
      groups[m.product_item_code].label_item_codes.push(m.label_item_code);
      groups[m.product_item_code].label_names.push(m.label_name);
    });

    const list = Object.values(groups);
    let result = [...list];

    const activeColFilters = Object.fromEntries(
      Object.entries(columnFilters).filter(([, v]) => v.trim() !== '')
    );
    if (Object.keys(activeColFilters).length > 0) {
      result = applyColumnFilters(result as any, activeColFilters) as any;
    }

    if (globalSearch.trim()) {
      const q = globalSearch.toLowerCase().trim();
      result = result.filter(r => {
        return (
          r.product_item_code.toLowerCase().includes(q) ||
          r.product_name.toLowerCase().includes(q) ||
          r.supplier_code.toLowerCase().includes(q) ||
          r.label_item_codes.some((c: string) => c.toLowerCase().includes(q)) ||
          r.label_names.some((n: string) => n.toLowerCase().includes(q))
        );
      });
    }

    result.sort((a, b) => a.product_item_code.localeCompare(b.product_item_code));

    return result.map((item, idx) => ({
      ...item,
      stt: idx + 1,
      label_item_code: item.label_item_codes.join(', '),
      label_name: item.label_names.join(', '),
    }));
  }, [processedMappings, columnFilters, globalSearch]);

  const tableData = viewMode === 'compact' ? compactMappings : displayMappings;

  const handleColumnFilter = (key: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [key]: value,
    }));
    setCurrentPage(1);
  };

  // Open Create mapping
  const handleCreateNew = () => {
    setEditingId(null);
    setSelectedProduct('');
    setSelectedLabel('');
    setQuantity(1);
    setIsOpen(true);
  };

  // Open Edit mapping
  const handleEdit = (record: any) => {
    setEditingId(record.id);
    setSelectedProduct(record.product_item_code);
    setSelectedLabel(record.label_item_code);
    setQuantity(record.quantity_per_unit);
    setIsOpen(true);
  };

  // Delete mapping
  const handleDelete = async (id: number) => {
    try {
      const { error } = await supabase
        .from('product_label_mappings')
        .delete()
        .eq('id', id);
      if (error) throw error;
      messageApi.success('Đã xóa liên kết thành công!');
      loadData();
    } catch (e: any) {
      messageApi.error('Lỗi khi xóa liên kết: ' + e.message);
    }
  };

  // Save mapping
  const handleSave = async () => {
    if (!selectedProduct || !selectedLabel) {
      messageApi.warning('Vui lòng chọn sản phẩm và tem nhãn!');
      return;
    }
    if (quantity <= 0) {
      messageApi.warning('Số lượng / SP phải lớn hơn 0!');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        // Edit existing mapping (update qty)
        const { error } = await supabase
          .from('product_label_mappings')
          .update({
            quantity_per_unit: quantity,
          })
          .eq('id', editingId);

        if (error) throw error;
        messageApi.success('Đã cập nhật số lượng dán nhãn thành công!');
      } else {
        // Check duplicate
        const duplicate = mappings.some(
          m => m.product_item_code === selectedProduct && m.label_item_code === selectedLabel
        );
        if (duplicate) {
          messageApi.warning('Liên kết giữa sản phẩm và tem nhãn này đã tồn tại!');
          setSaving(false);
          return;
        }

        // Insert new mapping
        const { error } = await supabase
          .from('product_label_mappings')
          .insert([
            {
              product_item_code: selectedProduct,
              label_item_code: selectedLabel,
              quantity_per_unit: quantity,
            },
          ]);

        if (error) throw error;
        messageApi.success('Thêm mới liên kết SP - Tem thành công!');
      }
      setIsOpen(false);
      loadData();
    } catch (e: any) {
      messageApi.error('Lỗi khi lưu dữ liệu: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // Table columns definition
  const columns: Record<string, any> = {
    stt: {
      title: <ColumnSearchHeader title="STT" dataKey="__stt" filters={columnFilters} onFilterChange={handleColumnFilter} align="center" showFilters={showFilters} />,
      key: 'stt',
      align: 'center',
      ...resizable('stt'),
      render: (_: any, r: any, idx: number) => {
        if (viewMode === 'compact') {
          return (
            <span style={{ color: '#94a3b8', fontSize: 12 }}>
              {(currentPage - 1) * pageSize + idx + 1}
            </span>
          );
        }
        return (
          <span style={{ color: '#94a3b8', fontSize: 12 }}>
            {r.productStt}
          </span>
        );
      },
    },
    product_item_code: {
      title: <ColumnSearchHeader title="Mã SP" dataKey="product_item_code" filters={columnFilters} onFilterChange={handleColumnFilter} showFilters={showFilters} />,
      dataIndex: 'product_item_code',
      key: 'product_item_code',
      ...resizable('product_item_code'),
      render: (v: string, r: any) => {
        if (viewMode === 'detailed' && r.isDuplicateProduct) return '';
        return <code style={{ color: '#0d9488', fontWeight: 700 }}>{v}</code>;
      },
    },
    product_name: {
      title: <ColumnSearchHeader title="Tên sản phẩm" dataKey="product_name" filters={columnFilters} onFilterChange={handleColumnFilter} showFilters={showFilters} />,
      dataIndex: 'product_name',
      key: 'product_name',
      ...resizable('product_name'),
      render: (v: string, r: any) => {
        if (viewMode === 'detailed' && r.isDuplicateProduct) return '';
        const display = v && v.length > 50 ? `${v.substring(0, 50)}...` : v;
        return (
          <Tooltip title={v}>
            <span style={{ fontWeight: 500, color: '#334155' }}>{display}</span>
          </Tooltip>
        );
      },
    },
    supplier_code: {
      title: <ColumnSearchHeader title="Hãng" dataKey="supplier_code" filters={columnFilters} onFilterChange={handleColumnFilter} showFilters={showFilters} />,
      dataIndex: 'supplier_code',
      key: 'supplier_code',
      ...resizable('supplier_code'),
      render: (v: string, r: any) => {
        if (viewMode === 'detailed' && r.isDuplicateProduct) return '';
        return <Tag color="cyan">{v}</Tag>;
      },
    },
    label_item_code: {
      title: <ColumnSearchHeader title="Mã Tem/Nhãn" dataKey="label_item_code" filters={columnFilters} onFilterChange={handleColumnFilter} showFilters={showFilters} />,
      dataIndex: 'label_item_code',
      key: 'label_item_code',
      ...resizable('label_item_code'),
      render: (v: string) => <code style={{ color: '#7c3aed', fontWeight: 700 }}>{v}</code>,
    },
    label_name: {
      title: <ColumnSearchHeader title="Tên Tem/Nhãn" dataKey="label_name" filters={columnFilters} onFilterChange={handleColumnFilter} showFilters={showFilters} />,
      dataIndex: 'label_name',
      key: 'label_name',
      ...resizable('label_name'),
      render: (v: string) => {
        const display = v && v.length > 50 ? `${v.substring(0, 50)}...` : v;
        return (
          <Tooltip title={v}>
            <span style={{ color: '#475569' }}>{display}</span>
          </Tooltip>
        );
      },
    },
    quantity_per_unit: {
      title: <ColumnSearchHeader title="Số lượng / SP" dataKey="quantity_per_unit" filters={columnFilters} onFilterChange={handleColumnFilter} align="right" showFilters={showFilters} />,
      dataIndex: 'quantity_per_unit',
      key: 'quantity_per_unit',
      align: 'right',
      ...resizable('quantity_per_unit'),
      render: (v: number) => <strong style={{ color: '#0f766e' }}>{v}</strong>,
    },
    actions: {
      title: <div style={{ fontWeight: 600, fontSize: 12, textAlign: 'center' }}>Thao tác</div>,
      key: 'actions',
      fixed: 'right',
      align: 'center',
      ...resizable('actions'),
      render: (_: any, r: any) => (
        <Space size="middle">
          <Tooltip title="Sửa số lượng">
            <Button
              type="text"
              size="small"
              icon={<Edit3 size={14} color="#0d9488" />}
              onClick={() => handleEdit(r)}
            />
          </Tooltip>
          <Tooltip title="Xóa liên kết">
            <Popconfirm
              title="Xóa liên kết SP - Tem"
              description="Bạn có chắc chắn muốn xóa liên kết này?"
              onConfirm={() => handleDelete(r.id)}
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
        </Space>
      ),
    },
  };

  const tableColumns = useMemo(() => {
    const visibleConfigs = prefs.columnConfigs.filter(c => c.visible);
    return visibleConfigs
      .map(c => {
        if (viewMode === 'compact' && (c.key === 'quantity_per_unit' || c.key === 'actions')) {
          return null;
        }
        const def = columns[c.key];
        if (!def) return null;
        return {
          ...def,
          width: prefs.columnWidths[c.key] ?? DEFAULT_MAPPING_WIDTHS[c.key] ?? 100,
        };
      })
      .filter(Boolean) as ColumnsType<any>;
  }, [prefs.columnConfigs, prefs.columnWidths, columns, viewMode]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '8px 4px', overflow: 'hidden' }}>
      {contextHolder}

      {/* Header controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 16,
        marginBottom: 16,
        borderBottom: '1px solid #edf2f7',
        gap: 16,
        flexWrap: 'wrap'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Link2 size={18} color="#0d9488" /> Quản lý Liên kết Sản phẩm - Tem/Nhãn
          </h2>
          <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>
            Thiết lập danh mục tem nhãn phụ dán bổ sung cho mỗi loại sản phẩm theo tỉ lệ dán nhất định.
          </p>
        </div>

        <Space size="middle">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
            <span style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>Chế độ xem:</span>
            <Switch
              checkedChildren="Chi tiết"
              unCheckedChildren="Gọn"
              checked={viewMode === 'detailed'}
              onChange={(checked) => {
                setViewMode(checked ? 'detailed' : 'compact');
                setCurrentPage(1);
              }}
              style={{ background: viewMode === 'detailed' ? '#0d9488' : '#94a3b8' }}
            />
          </div>

          <Button
            icon={<RefreshCw size={14} />}
            onClick={loadData}
            loading={loading}
            style={{ borderRadius: 6 }}
          >
            Làm mới
          </Button>
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={handleCreateNew}
            style={{ background: '#0d9488', borderColor: '#0d9488', borderRadius: 6 }}
          >
            Thêm liên kết
          </Button>
        </Space>
      </div>

      {/* Filter / Search Bar */}
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
        <Input
          placeholder="Tìm theo Mã SP, Tên sản phẩm, Mã nhãn..."
          prefix={<Search size={14} color="#94a3b8" />}
          value={globalSearch}
          onChange={(e) => {
            setGlobalSearch(e.target.value);
            setCurrentPage(1);
          }}
          allowClear
          style={{ maxWidth: 360, borderRadius: 6 }}
        />

        <TableControls
          showFilters={showFilters}
          onToggleFilters={() => savePrefs({ showFilters: !showFilters })}
          columns={prefs.columnConfigs}
          onColumnsChange={(cols) => savePrefs({ columnConfigs: cols })}
        />
      </div>

      {/* Main Mapping Table */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Table
          className="portal-table"
          components={{ header: { cell: ResizableTitle } }}
          columns={tableColumns}
          dataSource={tableData}
          loading={loading}
          rowKey="id"
          size="small"
          scroll={{ x: 'max-content', y: 'calc(100vh - 350px)' }}
          pagination={{
            size: 'small',
            current: currentPage,
            pageSize: pageSize,
            onChange: (p, s) => {
              setCurrentPage(p);
              setPageSize(s);
            },
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            style: { margin: '8px 0 0' },
          }}
          style={{ background: 'white', borderRadius: 8 }}
        />
      </div>

      {/* Create / Edit Drawer */}
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
              <Link2 size={16} color="white" />
            </span>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f766e' }}>
              {editingId ? 'Chỉnh sửa số lượng nhãn dán' : 'Tạo mới liên kết SP - Tem/Nhãn'}
            </div>
          </div>
        }
        width={480}
        onClose={() => setIsOpen(false)}
        open={isOpen}
        extra={
          <Space>
            <Button onClick={() => setIsOpen(false)}>Hủy</Button>
            <Button
              type="primary"
              onClick={handleSave}
              loading={saving}
              style={{ background: '#0d9488', borderColor: '#0d9488' }}
            >
              Lưu liên kết
            </Button>
          </Space>
        }
        bodyStyle={{ padding: 24, background: '#f8fafc' }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          
          <div style={{ background: 'white', padding: 18, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <Row gutter={[16, 16]}>
              {/* Product Selection */}
              <Col span={24}>
                <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 600, color: '#475569' }}>
                  1. Chọn Sản phẩm thực thể (Product Item) *
                </div>
                <Select
                  showSearch
                  placeholder="Chọn sản phẩm..."
                  optionFilterProp="label"
                  value={selectedProduct || undefined}
                  onChange={(val) => setSelectedProduct(val)}
                  disabled={!!editingId}
                  style={{ width: '100%' }}
                  options={productOptions.map(p => ({ value: p.item_code, label: `[${p.item_code}] ${p.item_name}` }))}
                  dropdownStyle={{ borderRadius: 8 }}
                />
                {editingId && (
                  <span style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, display: 'block' }}>
                    Không thể thay đổi mã sản phẩm khi đang cập nhật liên kết.
                  </span>
                )}
              </Col>

              {/* Label Selection */}
              <Col span={24}>
                <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 600, color: '#475569' }}>
                  2. Chọn Tem/Nhãn tương ứng (Label Item) *
                </div>
                <Select
                  showSearch
                  placeholder="Chọn nhãn..."
                  optionFilterProp="label"
                  value={selectedLabel || undefined}
                  onChange={(val) => setSelectedLabel(val)}
                  disabled={!!editingId}
                  style={{ width: '100%' }}
                  options={labelOptions.map(l => ({ value: l.item_code, label: `[${l.item_code}] ${l.item_name}` }))}
                  dropdownStyle={{ borderRadius: 8 }}
                />
              </Col>

              {/* Quantity */}
              <Col span={24}>
                <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 600, color: '#475569' }}>
                  3. Số lượng tem nhãn cần dán / 1 sản phẩm *
                </div>
                <InputNumber
                  min={0.001}
                  step={0.1}
                  value={quantity}
                  onChange={(val) => setQuantity(val || 1)}
                  style={{ width: '100%', borderRadius: 6 }}
                />
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 11 }}>
                  <Info size={13} color="#0d9488" />
                  <span>VD: Nhãn phụ dán 1 cái/hộp thuốc nhập thì điền <strong>1</strong>. Nếu nhãn thùng lớn dán 1 cái/thùng 10 hộp thì điền <strong>0.1</strong>.</span>
                </div>
              </Col>
            </Row>
          </div>

        </Space>
      </Drawer>

    </div>
  );
}
