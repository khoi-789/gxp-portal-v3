'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────────
export type MasterPermLevel = 'none' | 'view' | 'edit';

export type MasterPermsMap = Record<string, Record<string, MasterPermLevel>>;
// { 'PIC-1': { 'master_items': 'edit', 'master_warehouses': 'view', ... }, ... }

// All 9 tables we manage permissions for
export const MASTER_TABLE_KEYS = [
  'master_items',
  'master_suppliers',
  'product_label_mappings',
  'master_departments',
  'master_warehouses',
  'master_loggers',
  'master_label_types',
  'master_numbering_rules',
  'master_form_templates',
] as const;

export type MasterTableKey = typeof MASTER_TABLE_KEYS[number];

// ── Hardcoded fallback defaults (used if DB has no data yet) ───────────────────
export const DEFAULT_MASTER_PERMS: MasterPermsMap = {
  Viewer: {
    master_items: 'view',
    master_suppliers: 'view',
    product_label_mappings: 'view',
    master_departments: 'view',
    master_warehouses: 'view',
    master_loggers: 'view',
    master_label_types: 'view',
    master_numbering_rules: 'none',
    master_form_templates: 'view',
  },
  Draft: {
    master_items: 'view',
    master_suppliers: 'view',
    product_label_mappings: 'view',
    master_departments: 'view',
    master_warehouses: 'view',
    master_loggers: 'view',
    master_label_types: 'view',
    master_numbering_rules: 'none',
    master_form_templates: 'view',
  },
  'PIC-1': {
    master_items: 'edit',
    master_suppliers: 'edit',
    product_label_mappings: 'edit',
    master_departments: 'view',
    master_warehouses: 'view',
    master_loggers: 'edit',
    master_label_types: 'edit',
    master_numbering_rules: 'view',
    master_form_templates: 'view',
  },
  'PIC-2': {
    master_items: 'view',
    master_suppliers: 'view',
    product_label_mappings: 'view',
    master_departments: 'view',
    master_warehouses: 'edit',
    master_loggers: 'edit',
    master_label_types: 'view',
    master_numbering_rules: 'view',
    master_form_templates: 'view',
  },
  Admin: {
    master_items: 'edit',
    master_suppliers: 'edit',
    product_label_mappings: 'edit',
    master_departments: 'edit',
    master_warehouses: 'edit',
    master_loggers: 'edit',
    master_label_types: 'edit',
    master_numbering_rules: 'edit',
    master_form_templates: 'edit',
  },
};

const CACHE_KEY = 'gxp_master_data_perms';

export function normalizeRole(role?: string | null): string {
  if (!role) return 'Viewer';
  const lower = role.toLowerCase().trim();
  if (lower === 'admin') return 'Admin';
  if (lower === 'pic-1' || lower === 'pic1' || lower === 'staff') return 'PIC-1';
  if (lower === 'pic-2' || lower === 'pic2') return 'PIC-2';
  if (lower === 'draft') return 'Draft';
  if (lower === 'viewer') return 'Viewer';
  return role;
}

// ── Helper ─────────────────────────────────────────────────────────────────────
function mergeWithDefaults(loaded: MasterPermsMap): MasterPermsMap {
  const result: MasterPermsMap = {};
  for (const role of ['Viewer', 'Draft', 'PIC-1', 'PIC-2', 'Admin']) {
    result[role] = {
      ...DEFAULT_MASTER_PERMS[role],
      ...(loaded[role] || {}),
    };
  }
  return result;
}

// ── Main hook ─────────────────────────────────────────────────────────────────
export function useMasterPerms() {
  const [perms, setPerms] = useState<MasterPermsMap>(() => {
    // Hydrate from localStorage cache instantly
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) return mergeWithDefaults(JSON.parse(raw));
      } catch {}
    }
    return DEFAULT_MASTER_PERMS;
  });

  const [loading, setLoading] = useState(false);

  const loadFromDB = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('master_roles')
        .select('role_code, master_data_permissions')
        .in('role_code', ['Viewer', 'Draft', 'PIC-1', 'PIC-2', 'Admin']);

      if (!error && data && data.length > 0) {
        const loaded: MasterPermsMap = {};
        for (const row of data) {
          if (row.master_data_permissions && typeof row.master_data_permissions === 'object') {
            loaded[row.role_code] = row.master_data_permissions as Record<string, MasterPermLevel>;
          }
        }
        const merged = mergeWithDefaults(loaded);
        setPerms(merged);
        // Update cache
        if (typeof window !== 'undefined') {
          localStorage.setItem(CACHE_KEY, JSON.stringify(merged));
        }
      }
    } catch (err) {
      console.warn('[useMasterPerms] Cannot load from DB, using defaults/cache:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFromDB();
  }, [loadFromDB]);

  // Reactive cross-component sync: update state immediately when another component saves perms
  useEffect(() => {
    const handlePermsUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<MasterPermsMap>;
      if (customEvent.detail) {
        setPerms(customEvent.detail);
      }
    };
    window.addEventListener('master_perms_updated', handlePermsUpdated);
    return () => window.removeEventListener('master_perms_updated', handlePermsUpdated);
  }, []);

  /** Save the full perms map to master_roles.master_data_permissions for all roles.
   *  Uses individual UPDATE calls (not upsert) to avoid NOT NULL constraint on role_name.
   */
  const saveToDB = useCallback(async (newPerms: MasterPermsMap): Promise<{ success: boolean; error?: string }> => {
    const roles = ['Viewer', 'Draft', 'PIC-1', 'PIC-2', 'Admin'];
    const errors: string[] = [];

    for (const roleCode of roles) {
      if (!newPerms[roleCode]) continue;
      const { error } = await supabase
        .from('master_roles')
        .update({
          master_data_permissions: newPerms[roleCode],
          updated_at: new Date().toISOString(),
        })
        .eq('role_code', roleCode);

      if (error) {
        console.error(`[useMasterPerms] Error saving role ${roleCode}:`, error);
        errors.push(`${roleCode}: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      return { success: false, error: errors.join('; ') };
    }

    // Update local state and cache on success
    setPerms(newPerms);
    if (typeof window !== 'undefined') {
      localStorage.setItem(CACHE_KEY, JSON.stringify(newPerms));
      // Dispatch event to all components in current window
      window.dispatchEvent(new CustomEvent('master_perms_updated', { detail: newPerms }));
    }
    return { success: true };
  }, []);

  /** Force re-fetch from DB (clears cache first) */
  const forceRefresh = useCallback(async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CACHE_KEY);
    }
    await loadFromDB();
  }, [loadFromDB]);

  /** Get exact permission level: 'none' | 'view' | 'edit' */
  const getPermLevel = useCallback((role: string, tableKey: string): MasterPermLevel => {
    const norm = normalizeRole(role);
    return perms[norm]?.[tableKey] || (norm === 'Admin' ? 'edit' : 'none');
  }, [perms]);

  /** Check if a role can view a given master table */
  const canView = useCallback((role: string, tableKey: string): boolean => {
    const level = getPermLevel(role, tableKey);
    return level === 'view' || level === 'edit';
  }, [getPermLevel]);

  /** Check if a role can edit a given master table */
  const canEdit = useCallback((role: string, tableKey: string): boolean => {
    return getPermLevel(role, tableKey) === 'edit';
  }, [getPermLevel]);

  return { perms, loading, loadFromDB, forceRefresh, saveToDB, canView, canEdit, getPermLevel, normalizeRole };
}
