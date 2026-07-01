'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { syncMasterData } from './masterDataSync';

export function useMasterItems() {
  return useQuery<any[]>({
    queryKey: ['master_items'],
    queryFn: async () => {
      const list = await syncMasterData<any>({
        table: 'master_items',
        keyField: 'item_code',
        storageKey: 'gxp_master_items_cache'
      });
      return list || [];
    },
    staleTime: Infinity, // Rely on realtime subscription for updates
  });
}

export function useMasterSuppliers() {
  return useQuery<any[]>({
    queryKey: ['master_suppliers'],
    queryFn: async () => {
      const list = await syncMasterData<any>({
        table: 'master_suppliers',
        keyField: 'supplier_code',
        storageKey: 'gxp_master_suppliers_cache'
      });
      return list || [];
    },
    staleTime: Infinity, // Rely on realtime subscription for updates
  });
}

export function useInitMasterDataRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('master-data-realtime-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'master_items' },
        (payload) => {
          console.log('Realtime change in master_items:', payload);
          queryClient.setQueryData(['master_items'], (old: any[] | undefined) => {
            if (!old) return old;
            let updated = [...old];
            if (payload.eventType === 'INSERT') {
              if (!updated.some(item => item.item_code === payload.new.item_code)) {
                updated.push(payload.new);
              }
            } else if (payload.eventType === 'UPDATE') {
              updated = updated.map(item => item.item_code === payload.new.item_code ? payload.new : item);
            } else if (payload.eventType === 'DELETE') {
              updated = updated.filter(item => item.item_code !== payload.old.item_code);
            }
            try {
              localStorage.setItem('gxp_master_items_cache', JSON.stringify(updated));
            } catch (e) {
              console.error('Failed to save master_items to localStorage:', e);
            }
            return updated;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'master_suppliers' },
        (payload) => {
          console.log('Realtime change in master_suppliers:', payload);
          queryClient.setQueryData(['master_suppliers'], (old: any[] | undefined) => {
            if (!old) return old;
            let updated = [...old];
            if (payload.eventType === 'INSERT') {
              if (!updated.some(item => item.supplier_code === payload.new.supplier_code)) {
                updated.push(payload.new);
              }
            } else if (payload.eventType === 'UPDATE') {
              updated = updated.map(item => item.supplier_code === payload.new.supplier_code ? payload.new : item);
            } else if (payload.eventType === 'DELETE') {
              updated = updated.filter(item => item.supplier_code !== payload.old.supplier_code);
            }
            try {
              localStorage.setItem('gxp_master_suppliers_cache', JSON.stringify(updated));
            } catch (e) {
              console.error('Failed to save master_suppliers to localStorage:', e);
            }
            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
