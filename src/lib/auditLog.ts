/**
 * auditLog.ts
 * Utility to write audit trail entries to Supabase `audit_logs` table.
 */
import { supabase } from './supabase';

const SKIP_FIELDS = [
  'updated_at', 'created_at', 'updated_date', 'created_date',
  'invoice_link', 'supplier_link',
];

export interface DiffResult {
  changedFields: string[];
  diff: Record<string, { old: unknown; new: unknown }>;
}

export function buildDiff(
  oldObj: Record<string, unknown> | null | undefined,
  newObj: Record<string, unknown> | null | undefined,
  skipFields: string[] = []
): DiffResult {
  const diff: Record<string, { old: unknown; new: unknown }> = {};
  const changedFields: string[] = [];

  if (!oldObj) return { diff, changedFields };

  const skipList = SKIP_FIELDS.concat(skipFields);
  
  // Combine all keys into a unique array using Set and Array.from
  const rawKeys = Object.keys(oldObj).concat(Object.keys(newObj ?? {}));
  const uniqueKeys: string[] = [];
  rawKeys.forEach(k => {
    if (uniqueKeys.indexOf(k) === -1) {
      uniqueKeys.push(k);
    }
  });

  uniqueKeys.forEach(key => {
    if (skipList.indexOf(key) !== -1) return;
    const oldVal = oldObj[key];
    const newVal = newObj?.[key];
    if (JSON.stringify(oldVal ?? null) !== JSON.stringify(newVal ?? null)) {
      diff[key] = { old: oldVal ?? null, new: newVal ?? null };
      changedFields.push(key);
    }
  });

  return { diff, changedFields };
}

export interface WriteAuditLogParams {
  tableName: string;
  recordId: string | number;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  changedBy: string;
  userRole?: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  diff?: Record<string, { old: unknown; new: unknown }>;
  changedFields?: string[];
}

export async function writeAuditLog(params: WriteAuditLogParams): Promise<void> {
  const {
    tableName, recordId, action, changedBy, userRole,
    oldValues, newValues, diff, changedFields = [],
  } = params;

  if (action === 'UPDATE' && changedFields.length === 0) return;

  try {
    const { error } = await supabase.from('audit_logs').insert({
      table_name: tableName,
      record_id: String(recordId),
      action,
      changed_by: changedBy,
      user_role: userRole ?? null,
      changed_fields: changedFields,
      old_values: oldValues ?? null,
      new_values: newValues ?? null,
      diff: diff ?? null,
    });
    if (error) console.warn('[AuditLog] Failed to write:', error.message);
  } catch (e) {
    console.warn('[AuditLog] Unexpected error:', e);
  }
}
