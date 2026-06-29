import { supabase } from './supabase';

interface SyncConfig {
  table: string;
  keyField: string;
  storageKey: string;
}

/**
 * Synchronizes master data table incrementally with local browser cache.
 * 1. Reads local cache from localStorage.
 * 2. Queries only rows that have changed (updated_at > max(updated_at) in cache).
 * 3. Fetches lightweight active key list from database to clean up deleted rows.
 * 4. Merges updates and persists back to localStorage.
 */
export async function syncMasterData<T extends { updated_at: string }>(
  config: SyncConfig
): Promise<T[]> {
  const { table, keyField, storageKey } = config;

  let cached: T[] = [];
  let lastSync = '1970-01-01T00:00:00.000Z';

  // 1. Load cache from localStorage
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        cached = JSON.parse(raw);
        if (cached.length > 0) {
          // Find the maximum updated_at timestamp in the cache
          const maxUpdatedAt = cached.reduce((max, item) => {
            return item.updated_at > max ? item.updated_at : max;
          }, '1970-01-01T00:00:00.000Z');
          lastSync = maxUpdatedAt;
        }
      }
    } catch (e) {
      console.error(`Error loading cache for ${table}:`, e);
    }
  }

  try {
    // 2. Fetch only new or modified rows from the server
    let updatedRows = [];
    let fetchError = null;

    const query = supabase.from(table).select('*');
    
    // Attempt delta fetch if we have a lastSync date.
    // If it fails with 'column does not exist', fallback to fetching everything.
    const deltaRes = await query.gt('updated_at', lastSync);
    
    if (deltaRes.error) {
      if (deltaRes.error.message.includes('column') && deltaRes.error.message.includes('does not exist')) {
        // Fallback: table doesn't have updated_at column yet
        const fallbackRes = await supabase.from(table).select('*');
        if (fallbackRes.error) {
          fetchError = fallbackRes.error;
        } else {
          updatedRows = fallbackRes.data || [];
          // Force reset cache since we loaded all
          cached = [];
        }
      } else {
        fetchError = deltaRes.error;
      }
    } else {
      updatedRows = deltaRes.data || [];
    }

    if (fetchError) {
      console.error(`Error fetching updates for ${table}:`, fetchError.message);
      return cached;
    }

    // 3. Fetch active primary keys to handle deletions
    const { data: activeKeysData, error: keysError } = await supabase
      .from(table)
      .select(keyField);

    if (keysError) {
      console.error(`Error fetching active keys for ${table}:`, keysError.message);
    }

    // 4. Merge changes
    const mergedMap = new Map<any, T>();
    cached.forEach((item) => {
      mergedMap.set(item[keyField as keyof T], item);
    });

    if (updatedRows) {
      updatedRows.forEach((item: any) => {
        mergedMap.set(item[keyField], item);
      });
    }

    let finalData = Array.from(mergedMap.values());

    // 5. Filter out deleted records
    if (activeKeysData && !keysError) {
      const activeKeysSet = new Set(activeKeysData.map((x: any) => x[keyField]));
      finalData = finalData.filter((item) => activeKeysSet.has(item[keyField as keyof T]));
    }

    // 6. Save back to localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify(finalData));
      } catch (e) {
        console.error(`Error saving cache for ${table}:`, e);
      }
    }

    return finalData;
  } catch (err) {
    console.error(`Exception during sync for ${table}:`, err);
    return cached;
  }
}
