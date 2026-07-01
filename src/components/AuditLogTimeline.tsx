'use client';

import { useEffect, useState } from 'react';
import { Tag, Spin, Empty, Typography, Button, Modal, Table, Tooltip, Badge } from 'antd';
import { History, User, Edit3, Plus, Trash2, ChevronRight, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import dayjs from 'dayjs';

const { Text } = Typography;

interface AuditLogEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  changed_by: string;
  user_role: string | null;
  changed_at: string;
  changed_fields: string[];
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  diff: Record<string, { old: unknown; new: unknown }> | null;
}

interface AuditLogTimelineProps {
  tableName: string;
  recordId: string | number;
  additionalQuery?: {
    tableName: string;
    recordIds?: (string | number)[];
    recordIdPrefix?: string;
  }[];
  maxItems?: number;
}

// Human-readable field label mapping
const FIELD_LABELS: Record<string, string> = {
  coa_status: 'Trạng thái COA',
  label_status: 'Trạng thái tem nhãn',
  progress_status: 'Tiến độ',
  supplier_code: 'NCC / Hãng',
  actual_import_date_note: 'Ngày nhập (Ghi chú)',
  target_warehouse: 'Kho',
  has_data_logger: 'Data Logger',
  data_logger_type: 'Loại Logger',
  logger_qty: 'Số lượng Logger',
  temp_out_of_range: 'Nhiệt độ vượt ngưỡng',
  temp_out_of_range_details: 'Chi tiết nhiệt độ',
  issues: 'Danh sách vấn đề',
  invoice_number: 'Số Invoice',
  item_code: 'Mã SP',
  item_name: 'Tên sản phẩm',
  visa_no: 'Số Visa',
  decision_no: 'Số quyết định',
  valid_until: 'Hiệu lực đến',
  issue_notes: 'Vấn đề',
  resolution_notes: 'Hướng xử lý',
  required_labels: 'Tem nhãn bắt buộc',
  quantity_per_unit: 'SL / SP',
  status: 'Trạng thái',
  is_active: 'Hoạt động',
  gross_weight: 'Khối lượng tổng',
  net_weight: 'Khối lượng tịnh',
  awc_code: 'Mã AWC',
  new_item_code: 'Mã SP mới',
  old_info: 'Thông tin cũ',
  new_change_info: 'Thông tin thay đổi',
  bbsc_code: 'Mã BBSC',
  lot_number: 'Lot number',
  quantity: 'Số lượng',
  defect_description: 'Mô tả lỗi',
  cc_code: 'Mã CC',
  customer_name: 'Tên khách hàng',
  complaint_reason: 'Lý do khiếu nại',
  supplier_name: 'Tên nhà cung cấp',
  business_type: 'Loại hình',
  notes: 'Ghi chú',
  product_item_code: 'Mã sản phẩm',
  label_item_code: 'Mã tem/nhãn',
};

const ACTION_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  INSERT: { color: '#0d9488', bg: '#f0fdf9', icon: <Plus size={11} />, label: 'Tạo mới' },
  UPDATE: { color: '#2563eb', bg: '#eff6ff', icon: <Edit3 size={11} />, label: 'Cập nhật' },
  DELETE: { color: '#dc2626', bg: '#fef2f2', icon: <Trash2 size={11} />, label: 'Đã xóa' },
};

// ── Smart value formatter ──────────────────────────────────────────
function formatValue(val: unknown): string {
  if (val === null || val === undefined || val === '') return '(trống)';
  if (typeof val === 'boolean') return val ? 'Có' : 'Không';
  if (Array.isArray(val)) return `${val.length} mục`;
  if (typeof val === 'object') {
    // Try to extract meaningful field
    const obj = val as Record<string, unknown>;
    if (obj.name) return String(obj.name);
    if (obj.code) return String(obj.code);
    return JSON.stringify(val).substring(0, 40) + '...';
  }
  return String(val);
}

// Get display name for a log entry (title for the left panel)
function getEntryTitle(log: AuditLogEntry, index: number): string {
  const total = `Phiên bản ${index + 1}`;
  if (log.table_name === 'imp_shipment_items') {
    const vals = log.new_values || log.old_values;
    const name = vals?.item_name || vals?.item_code;
    if (name) return `SP: ${String(name).substring(0, 20)}`;
  }
  return total;
}

// ── Array diff comparison modal ────────────────────────────────────
interface ArrayDiffModalProps {
  open: boolean;
  onClose: () => void;
  fieldLabel: string;
  oldArray: unknown[];
  newArray: unknown[];
}

function ArrayDiffModal({ open, onClose, fieldLabel, oldArray, newArray }: ArrayDiffModalProps) {
  const oldStrs = oldArray.map(x => JSON.stringify(x));
  const newStrs = newArray.map(x => JSON.stringify(x));

  const renderLabel = (item: unknown) => {
    if (typeof item === 'object' && item !== null) {
      const o = item as Record<string, unknown>;
      const codeStr = o.code != null ? String(o.code) : null;
      const nameStr = o.name != null ? String(o.name) : null;
      const qtyStr = o.qty != null ? String(o.qty) : null;
      return (
        <span>
          {codeStr && <code style={{ fontSize: 11, color: '#7c3aed', marginRight: 6 }}>{codeStr}</code>}
          {nameStr && <span style={{ color: '#334155' }}>{nameStr}</span>}
          {qtyStr && <Badge count={`x${qtyStr}`} style={{ background: '#0d9488', marginLeft: 6, fontSize: 10 }} />}
        </span>
      );
    }
    return <span>{String(item)}</span>;
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={<span style={{ fontWeight: 700, color: '#0f766e' }}>So sánh: {fieldLabel}</span>}
      width={700}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 8 }}>
        {/* Old */}
        <div>
          <div style={{ fontWeight: 600, fontSize: 12, color: '#dc2626', marginBottom: 8, padding: '4px 10px', background: '#fef2f2', borderRadius: 6 }}>
            DỮ LIỆU CŨ (TRƯỚC KHI SỬA) — {oldArray.length} mục
          </div>
          {oldArray.length === 0
            ? <Text type="secondary" style={{ fontSize: 12 }}>(trống)</Text>
            : oldArray.map((item, i) => {
              const isRemoved = !newStrs.includes(oldStrs[i]);
              return (
                <div key={i} style={{
                  padding: '6px 10px', marginBottom: 4, borderRadius: 6, fontSize: 12,
                  background: isRemoved ? '#fef2f2' : '#f8fafc',
                  border: `1px solid ${isRemoved ? '#fca5a5' : '#e2e8f0'}`,
                  textDecoration: isRemoved ? 'line-through' : 'none',
                  color: isRemoved ? '#dc2626' : '#334155',
                }}>
                  {renderLabel(item)}
                </div>
              );
            })}
        </div>
        {/* New */}
        <div>
          <div style={{ fontWeight: 600, fontSize: 12, color: '#0d9488', marginBottom: 8, padding: '4px 10px', background: '#f0fdf9', borderRadius: 6 }}>
            DỮ LIỆU MỚI (SAU KHI SỬA) — {newArray.length} mục
          </div>
          {newArray.length === 0
            ? <Text type="secondary" style={{ fontSize: 12 }}>(trống)</Text>
            : newArray.map((item, i) => {
              const isAdded = !oldStrs.includes(newStrs[i]);
              return (
                <div key={i} style={{
                  padding: '6px 10px', marginBottom: 4, borderRadius: 6, fontSize: 12,
                  background: isAdded ? '#f0fdf9' : '#f8fafc',
                  border: `1px solid ${isAdded ? '#6ee7b7' : '#e2e8f0'}`,
                  fontWeight: isAdded ? 600 : 400,
                  color: isAdded ? '#0d9488' : '#334155',
                }}>
                  {renderLabel(item)}
                </div>
              );
            })}
        </div>
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 16, fontSize: 11, color: '#64748b' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#fca5a5', display: 'inline-block' }} />
          Dữ liệu cũ / Bị xóa
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#6ee7b7', display: 'inline-block' }} />
          Dữ liệu mới / Mới thêm
        </span>
      </div>
    </Modal>
  );
}

// ── Detail diff table for a single log entry ───────────────────────
function LogDetailPanel({ log, versionNum }: { log: AuditLogEntry; versionNum: number }) {
  const cfg = ACTION_CONFIG[log.action] ?? ACTION_CONFIG.UPDATE;
  const [arrayModal, setArrayModal] = useState<{ field: string; old: unknown[]; new: unknown[] } | null>(null);

  const timeStr = dayjs(log.changed_at).format('DD/MM/YYYY HH:mm');
  const userName = log.user_role ? `${log.changed_by} (${log.user_role})` : log.changed_by;

  // Get context label for the table name
  const tableLabels: Record<string, string> = {
    imp_shipments: 'Header Invoice',
    imp_shipment_items: 'Sản phẩm chi tiết',
    master_items: 'Danh mục sản phẩm',
    master_suppliers: 'Nhà cung cấp',
    product_label_mappings: 'Liên kết SP-Tem',
  };
  const tableLabel = tableLabels[log.table_name] ?? log.table_name;

  // Extract item name for shipment_items
  const itemContext = log.table_name === 'imp_shipment_items'
    ? (log.new_values?.item_name || log.old_values?.item_name || log.new_values?.item_code || log.old_values?.item_code)
    : null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px',
        background: cfg.bg,
        borderBottom: `2px solid ${cfg.color}20`,
        borderRadius: '8px 8px 0 0',
        marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Tag
            color={cfg.color}
            style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20 }}
          >
            {cfg.label.toUpperCase()}
          </Tag>
          <Text style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
            Phiên bản {versionNum} — {tableLabel}
          </Text>
        </div>
        {itemContext != null && (
          <Text style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>
            🔹 Sản phẩm: <strong style={{ color: '#0f766e' }}>{String(itemContext)}</strong>
          </Text>
        )}
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#64748b', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            🕒 {timeStr}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <User size={12} />
            {userName}
          </span>
        </div>
      </div>

      {/* INSERT */}
      {log.action === 'INSERT' && (
        <div style={{ padding: '12px 16px' }}>
          <div style={{
            background: '#f0fdf9', border: '1px solid #a7f3d0',
            borderRadius: 8, padding: '12px 16px',
            fontSize: 13, color: '#065f46', fontWeight: 500,
          }}>
            ✅ Bản ghi mới được tạo thành công.
          </div>
          {log.new_values && (
            <div style={{ marginTop: 12 }}>
              <Text style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 8 }}>Thông tin khởi tạo:</Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(log.new_values)
                  .filter(([k, v]) => v !== null && v !== undefined && v !== '' && !['invoice_number', 'updated_at', 'created_at'].includes(k))
                  .slice(0, 8)
                  .map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                      <Text type="secondary" style={{ minWidth: 160, fontSize: 12 }}>{FIELD_LABELS[k] ?? k}:</Text>
                      <Text style={{ color: '#0d9488', fontWeight: 500 }}>{formatValue(v)}</Text>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* DELETE */}
      {log.action === 'DELETE' && (
        <div style={{ padding: '12px 16px' }}>
          <div style={{
            background: '#fef2f2', border: '1px solid #fca5a5',
            borderRadius: 8, padding: '12px 16px',
            fontSize: 13, color: '#991b1b', fontWeight: 500,
          }}>
            🗑️ Bản ghi này đã bị xóa.
          </div>
          {log.old_values && (
            <div style={{ marginTop: 12 }}>
              <Text style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 8 }}>Thông tin trước khi xóa:</Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(log.old_values)
                  .filter(([k, v]) => v !== null && v !== undefined && v !== '' && !['invoice_number', 'updated_at', 'created_at'].includes(k))
                  .slice(0, 8)
                  .map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                      <Text type="secondary" style={{ minWidth: 160, fontSize: 12 }}>{FIELD_LABELS[k] ?? k}:</Text>
                      <Text delete style={{ color: '#dc2626' }}>{formatValue(v)}</Text>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* UPDATE — Table diff */}
      {log.action === 'UPDATE' && log.diff && Object.keys(log.diff).length > 0 && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 4px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={{ padding: '7px 12px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 600, width: '30%', borderBottom: '1px solid #e2e8f0' }}>Trường dữ liệu</th>
                <th style={{ padding: '7px 12px', textAlign: 'left', fontSize: 11, color: '#dc2626', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>Giá trị cũ</th>
                <th style={{ padding: '7px 4px', textAlign: 'center', fontSize: 11, color: '#94a3b8', width: 24, borderBottom: '1px solid #e2e8f0' }}>→</th>
                <th style={{ padding: '7px 12px', textAlign: 'left', fontSize: 11, color: '#0d9488', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>Giá trị mới</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(log.diff).map(([field, { old: oldVal, new: newVal }], i) => {
                const isArray = Array.isArray(oldVal) || Array.isArray(newVal);
                const oldArr = Array.isArray(oldVal) ? oldVal : [];
                const newArr = Array.isArray(newVal) ? newVal : [];
                return (
                  <tr key={field} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: '#334155', borderBottom: '1px solid #f1f5f9' }}>
                      {FIELD_LABELS[field] ?? field}
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 12, borderBottom: '1px solid #f1f5f9' }}>
                      {isArray ? (
                        <span style={{ color: '#dc2626', fontStyle: 'italic' }}>{oldArr.length} mục</span>
                      ) : (
                        <Text delete={!!newVal && oldVal !== null} style={{ fontSize: 12, color: '#dc2626' }}>
                          {formatValue(oldVal)}
                        </Text>
                      )}
                    </td>
                    <td style={{ padding: '8px 4px', textAlign: 'center', color: '#94a3b8', fontSize: 14, borderBottom: '1px solid #f1f5f9' }}>→</td>
                    <td style={{ padding: '8px 12px', fontSize: 12, borderBottom: '1px solid #f1f5f9' }}>
                      {isArray ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: '#0d9488', fontWeight: 600 }}>{newArr.length} mục</span>
                          <Button
                            size="small"
                            type="link"
                            icon={<Eye size={11} />}
                            style={{ padding: '0 6px', height: 22, fontSize: 11, color: '#7c3aed' }}
                            onClick={() => setArrayModal({ field, old: oldArr, new: newArr })}
                          >
                            Xem chi tiết
                          </Button>
                        </div>
                      ) : (
                        <Text style={{ fontSize: 12, color: '#0d9488', fontWeight: 600 }}>
                          {formatValue(newVal)}
                        </Text>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {log.action === 'UPDATE' && (!log.diff || Object.keys(log.diff).length === 0) && (
        <div style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 12 }}>Không có thay đổi nào được ghi nhận chi tiết.</div>
      )}

      {/* Array diff modal */}
      {arrayModal && (
        <ArrayDiffModal
          open={true}
          onClose={() => setArrayModal(null)}
          fieldLabel={FIELD_LABELS[arrayModal.field] ?? arrayModal.field}
          oldArray={arrayModal.old}
          newArray={arrayModal.new}
        />
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────
export default function AuditLogTimeline({
  tableName, recordId, additionalQuery = [], maxItems = 50,
}: AuditLogTimelineProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      const { data: primaryData, error: primaryError } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('table_name', tableName)
        .eq('record_id', String(recordId))
        .order('changed_at', { ascending: false })
        .limit(maxItems);

      if (primaryError) console.warn('[AuditLogTimeline] Primary fetch error:', primaryError.message);

      let allLogs = primaryData || [];

      for (const extra of additionalQuery) {
        if (extra.recordIdPrefix) {
          const { data: extraData } = await supabase
            .from('audit_logs')
            .select('*')
            .eq('table_name', extra.tableName)
            .like('record_id', `${extra.recordIdPrefix}%`)
            .order('changed_at', { ascending: false })
            .limit(maxItems);
          if (extraData) allLogs = allLogs.concat(extraData);
        } else if (extra.recordIds && extra.recordIds.length > 0) {
          const { data: extraData } = await supabase
            .from('audit_logs')
            .select('*')
            .eq('table_name', extra.tableName)
            .in('record_id', extra.recordIds.map(String))
            .order('changed_at', { ascending: false })
            .limit(maxItems);
          if (extraData) allLogs = allLogs.concat(extraData);
        }
      }

      allLogs.sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());
      setLogs(allLogs.slice(0, maxItems));
      setSelectedIdx(0);
      setLoading(false);
    };
    fetchLogs();
  }, [tableName, recordId, maxItems, JSON.stringify(additionalQuery)]);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 32 }}>
      <Spin size="small" />
    </div>
  );

  if (logs.length === 0) return (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={<Text type="secondary" style={{ fontSize: 13 }}>Chưa có lịch sử thay đổi</Text>}
      style={{ padding: '24px 0' }}
    />
  );

  const selectedLog = logs[selectedIdx];

  return (
    <div style={{ display: 'flex', gap: 0, height: '100%', minHeight: 320 }}>
      {/* ── Left panel: version list ── */}
      <div style={{
        width: 200,
        minWidth: 200,
        borderRight: '1px solid #e2e8f0',
        overflowY: 'auto',
        background: '#f8fafc',
        borderRadius: '8px 0 0 8px',
      }}>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 6 }}>
          <History size={13} color="#64748b" />
          <Text style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{logs.length} thay đổi</Text>
        </div>
        {logs.map((log, i) => {
          const cfg = ACTION_CONFIG[log.action] ?? ACTION_CONFIG.UPDATE;
          const isSelected = i === selectedIdx;
          const tableLabels: Record<string, string> = {
            imp_shipment_items: 'Chi tiết SP',
            imp_shipments: 'Header',
          };
          const subLabel = tableLabels[log.table_name];
          return (
            <div
              key={log.id}
              onClick={() => setSelectedIdx(i)}
              style={{
                padding: '10px 12px',
                cursor: 'pointer',
                borderBottom: '1px solid #e2e8f0',
                background: isSelected ? '#fff' : 'transparent',
                borderLeft: isSelected ? `3px solid ${cfg.color}` : '3px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                <Tag
                  color={cfg.color}
                  style={{ fontSize: 10, padding: '0 6px', margin: 0, borderRadius: 10, lineHeight: '18px' }}
                >
                  {cfg.label}
                </Tag>
                {isSelected && <ChevronRight size={12} color={cfg.color} />}
              </div>
              <div style={{ fontSize: 11, color: '#334155', fontWeight: isSelected ? 600 : 400, marginBottom: 2 }}>
                Phiên bản {logs.length - i}
              </div>
              {subLabel && (
                <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>{subLabel}</div>
              )}
              <div style={{ fontSize: 10, color: '#94a3b8' }}>
                {dayjs(log.changed_at).format('DD/MM HH:mm')}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Right panel: detail ── */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#fff', borderRadius: '0 8px 8px 0', minWidth: 0 }}>
        {selectedLog && (
          <LogDetailPanel log={selectedLog} versionNum={logs.length - selectedIdx} />
        )}
      </div>
    </div>
  );
}
