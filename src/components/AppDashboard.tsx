'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from 'antd';
import { PortalApp, User } from '@/lib/types';
import { MOCK_PORTAL_APPS } from '@/lib/mockData';
import AppCard from './AppCard';
import FolderModal from './FolderModal';
import { useRouter } from 'next/navigation';
import { LayoutGrid, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

/**
 * URS §4.2: <AppDashboard>
 * - Fetch data từ bảng portal_apps bằng @tanstack/react-query
 * - Logic RBAC: Lọc theo user.department_code vs app.allowed_depts
 *   (Admin thấy tất cả)
 * - Giai đoạn Pilot: dùng MOCK_PORTAL_APPS thay vì gọi Supabase thật
 */
interface AppDashboardProps {
  currentUser: User;
}

// Fetch function - giai đoạn pilot dùng mock, sau thay bằng supabase
async function fetchPortalApps(): Promise<PortalApp[]> {
  try {
    const { data, error } = await supabase
      .from('portal_apps')
      .select('*')
      .order('order_index', { ascending: true });
    
    if (error) throw error;
    if (data && data.length > 0) {
      // Map database schema to frontend type (e.g. allowed_depts)
      return data.map(app => ({
        app_id: app.app_id,
        app_name: app.app_name,
        type: app.type as 'link' | 'folder',
        target_url: app.target_url,
        parent_id: app.parent_id,
        allowed_depts: app.allowed_depts || [],
        is_testing: app.is_testing || false,
      }));
    }
  } catch (err) {
    console.warn('Lỗi fetch portal_apps từ Supabase, fallback về Mock Data:', err);
  }

  // Fallback to Mock Data
  await new Promise((res) => setTimeout(res, 200));
  return MOCK_PORTAL_APPS;
}

export default function AppDashboard({ currentUser }: AppDashboardProps) {
  const router = useRouter();
  const [openFolder, setOpenFolder] = useState<PortalApp | null>(null);

  // §4.2: Fetch bằng @tanstack/react-query
  const { data: allApps = [], isLoading, isError } = useQuery<PortalApp[]>({
    queryKey: ['portal_apps'],
    queryFn: fetchPortalApps,
  });

  // §4.2: RBAC Filtering
  // Admin thấy tất cả; staff chỉ thấy app có department_code trong allowed_depts
  const visibleApps = allApps.filter((app) => {
    // Chỉ hiện root-level apps (parent_id === null)
    if (app.parent_id !== null) return false;

    if (currentUser.system_role === 'admin') return true;
    return app.allowed_depts.includes(currentUser.department_code);
  });

  // §4.2: Lấy apps con của folder
  const getChildApps = (folderId: string): PortalApp[] => {
    return allApps.filter((app) => {
      if (app.parent_id !== folderId) return false;
      if (currentUser.system_role === 'admin') return true;
      return app.allowed_depts.includes(currentUser.department_code);
    });
  };

  // §4.2: Event Handling - Link vs Folder
  const handleAppClick = (app: PortalApp) => {
    if (app.type === 'link' && app.target_url) {
      // Link: chuyển route
      router.push(app.target_url);
    } else if (app.type === 'folder') {
      // Folder: mở FolderModal
      setOpenFolder(app);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 320,
          gap: 16,
          color: '#0d9488',
        }}
      >
        <Loader2 size={40} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#64748b', fontSize: 14 }}>Đang tải danh sách ứng dụng...</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '48px 24px',
          color: '#ef4444',
        }}
      >
        <p style={{ fontWeight: 600 }}>Không thể tải dữ liệu. Vui lòng thử lại.</p>
      </div>
    );
  }

  return (
    <>
      {/* Section Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #ccfbf1, rgba(20,184,166,0.2))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <LayoutGrid size={18} color="#0d9488" strokeWidth={1.8} />
        </div>
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 17,
              fontWeight: 700,
              color: '#1e293b',
            }}
          >
            Ứng dụng của bạn
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
            {visibleApps.length} ứng dụng · Phòng ban:{' '}
            <strong>{currentUser.department_code}</strong>
          </p>
        </div>
      </div>

      {/* App Grid */}
      {visibleApps.length > 0 ? (
        <div className="app-grid">
          {visibleApps.map((app) => (
            <AppCard key={app.app_id} app={app} onClick={handleAppClick} />
          ))}
        </div>
      ) : (
        <div
          style={{
            textAlign: 'center',
            padding: '64px 24px',
            color: '#94a3b8',
          }}
        >
          <LayoutGrid size={56} strokeWidth={1} style={{ marginBottom: 12, color: '#e2e8f0' }} />
          <p style={{ fontSize: 15 }}>
            Không có ứng dụng nào được phân quyền cho phòng ban{' '}
            <strong>{currentUser.department_code}</strong>.
          </p>
        </div>
      )}

      {/* §4.2: FolderModal - hiển thị khi click folder */}
      {openFolder && (
        <FolderModal
          folder={openFolder}
          childApps={getChildApps(openFolder.app_id)}
          onClose={() => setOpenFolder(null)}
        />
      )}
    </>
  );
}
