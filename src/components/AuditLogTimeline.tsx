'use client';

import { useEffect, useState } from 'react';
import { Timeline, Tag, Spin, Empty, Typography, Tooltip } from 'antd';
import { History, User, Edit3, Plus, Trash2 } from 'lucide-react';
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
  required_labels: 'Tem nhãn',
  status: 'Trạng thái',
  is_active: 'Hoạt động',
  gross_weight: 'Khối lượng tổng',
  net_weight: 'Khối lượng tịnh',
  // AWC
  awc_code: 'Mã AWC',
  new_item_code: 'Mã SP mới',
  old_info: 'Thông tin cũ',
  new_change_info: 'Thông tin thay đổi',
  // BBSC
  bbsc_code: 'Mã BBSC',
  lot_number: 'Lot number',
  quantity: 'Số lượng',
  defect_description: 'Mô tả lỗi',
  // CC
  cc_code: 'Mã CC',
  customer_name: 'Tên khách hàng',
  complaint_reason: 'Lý do khiếu nại',
};

const actionConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  INSERT: { color: '#0d9488', icon: <Plus size={12} />, label: 'Tạo mới' },
  UPDATE: { color: '#2563eb', icon: <Edit3 size={12} />, label: 'Cập nhật' },
  DELETE: { color: '#dc2626', icon: <Trash2 size={12} />, label: 'Xóa' },
};

function formatValue(val: unknown): string {
  if (val === null || val === undefined || val === '') return '(trống)';
  if (typeof val === 'boolean') return val ? 'Có' : 'Không';
  if (typeof val === 'object') return JSON.stringify(val).substring(0, 60) + '...';
  return String(val);
}

export default function AuditLogTimeline({
  tableName, recordId, maxItems = 50,
}: AuditLogTimelineProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('table_name', tableName)
        .eq('record_id', String(recordId))
        .order('changed_at', { ascending: false })
        .limit(maxItems);
      if (!error) setLogs(data || []);
      setLoading(false);
    };
    fetchLogs();
  }, [tableName, recordId, maxItems]);

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

  const timelineItems = logs.map(log => {
    const cfg = actionConfig[log.action] ?? actionConfig.UPDATE;
    const timeStr = dayjs(log.changed_at).format('DD/MM/YYYY HH:mm');
    const userName = log.user_role
      ? `${log.changed_by} (${log.user_role})`
      : log.changed_by;

    return {
      key: log.id,
      color: cfg.color,
      dot: (
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          background: cfg.color, display: 'flex',
          alignItems: 'center', justifyContent: 'center', color: '#fff',
        }}>
          {cfg.icon}
        </div>
      ),
      children: (
        <div style={{
          background: '#f8fafc', border: '1px solid #e2e8f0',
          borderRadius: 8, padding: '8px 12px', marginBottom: 4,
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Tag color={cfg.color} style={{ fontSize: 11, margin: 0, padding: '0 6px' }}>
              {cfg.label}
            </Tag>
            <Text style={{ fontSize: 12, color: '#64748b' }}>
              🕒 {timeStr}
            </Text>
          </div>

          {/* User */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
            <User size={11} color="#94a3b8" />
            <Text style={{ fontSize: 12, color: '#475569' }}>{userName}</Text>
          </div>

          {/* Changed fields (for UPDATE) */}
          {log.action === 'UPDATE' && log.diff && Object.keys(log.diff).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Text style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>
                Đã sửa {Object.keys(log.diff).length} trường:
              </Text>
              {Object.entries(log.diff).map(([field, { old: oldVal, new: newVal }]) => (
                <div key={field} style={{
                  fontSize: 12, paddingLeft: 8,
                  borderLeft: '2px solid #e2e8f0',
                }}>
                  <Text strong style={{ fontSize: 11, color: '#334155' }}>
                    {FIELD_LABELS[field] ?? field}:{' '}
                  </Text>
                  <Text delete style={{ fontSize: 11, color: '#dc2626' }}>
                    {formatValue(oldVal)}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#94a3b8', margin: '0 4px' }}>→</Text>
                  <Text style={{ fontSize: 11, color: '#0d9488', fontWeight: 600 }}>
                    {formatValue(newVal)}
                  </Text>
                </div>
              ))}
            </div>
          )}

          {/* INSERT: show summary */}
          {log.action === 'INSERT' && (
            <Text style={{ fontSize: 12, color: '#475569' }}>
              Bản ghi được tạo mới.
            </Text>
          )}

          {/* DELETE: show old values summary */}
          {log.action === 'DELETE' && log.old_values && (
            <Text style={{ fontSize: 12, color: '#dc2626' }}>
              Bản ghi đã bị xóa.
            </Text>
          )}
        </div>
      ),
    };
  });

  return (
    <div style={{ padding: '8px 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <History size={14} color="#64748b" />
        <Text style={{ fontSize: 12, color: '#64748b' }}>
          {logs.length} thay đổi gần đây nhất
        </Text>
      </div>
      <Timeline items={timelineItems} />
    </div>
  );
}
