'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, ReactNode } from 'react';
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';

/**
 * Providers bao gồm:
 * - TanStack React Query (fetch & cache theo URS §4.2)
 * - Ant Design ConfigProvider (locale vi-VN + theme teal)
 */
export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 phút
            retry: 2,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={viVN}
        theme={{
          token: {
            colorPrimary: '#0d9488',
            colorInfo: '#0d9488',
            borderRadius: 10,
            fontFamily: "'Inter', system-ui, sans-serif",
          },
          components: {
            Button: {
              colorPrimary: '#0d9488',
              algorithm: true,
            },
            Table: {
              headerBg: '#f0fdfa',
              headerColor: '#134e4a',
            },
            Drawer: {
              colorBgElevated: '#ffffff',
            },
          },
        }}
      >
        {children}
      </ConfigProvider>
    </QueryClientProvider>
  );
}
