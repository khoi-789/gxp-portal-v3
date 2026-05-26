/**
 * useTablePreferences - Custom hook for persisting table settings per user
 *
 * Saves to localStorage:
 *  - Column configs (visibility + order)
 *  - Column widths (per column key)
 *  - showFilters state
 *
 * Key format: `gxp_tbl_{tableId}_{userId}`
 */

import { useState, useCallback } from 'react';
import type { ColumnConfig } from '@/components/TableControls';

export interface TablePreferences {
  columnConfigs: ColumnConfig[];
  columnWidths: Record<string, number>;
  showFilters: boolean;
}

export function useTablePreferences(
  tableId: string,
  userId: string,
  defaultConfigs: ColumnConfig[],
) {
  const storageKey = `gxp_tbl_${tableId}_${userId.replace(/[^a-z0-9]/gi, '_')}`;

  const load = (): TablePreferences => {
    if (typeof window === 'undefined') {
      return { columnConfigs: defaultConfigs, columnWidths: {}, showFilters: false };
    }
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as TablePreferences;
        // Merge any NEW columns added after the user last saved their prefs
        const storedKeys = new Set(parsed.columnConfigs.map((c) => c.key));
        const newCols = defaultConfigs.filter((c) => !storedKeys.has(c.key));
        return {
          ...parsed,
          showFilters: parsed.showFilters ?? false,
          columnConfigs: [...parsed.columnConfigs, ...newCols],
        };
      }
    } catch {
      // Ignore parse errors
    }
    return { columnConfigs: defaultConfigs, columnWidths: {}, showFilters: false };
  };

  const [prefs, setPrefs] = useState<TablePreferences>(load);

  /**
   * Save a partial update to both state + localStorage
   */
  const save = useCallback(
    (updates: Partial<TablePreferences>) => {
      setPrefs((prev) => {
        const next = { ...prev, ...updates };
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // Ignore write errors (quota exceeded, private mode, etc.)
        }
        return next;
      });
    },
    [storageKey],
  );

  /**
   * Convenience: update a single column's width
   */
  const setColumnWidth = useCallback(
    (key: string, width: number) => {
      setPrefs((prev) => {
        const next = {
          ...prev,
          columnWidths: { ...prev.columnWidths, [key]: width },
        };
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [storageKey],
  );

  return { prefs, save, setColumnWidth };
}
