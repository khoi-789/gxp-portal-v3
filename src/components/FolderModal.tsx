'use client';

import { PortalApp } from '@/lib/types';
import AppCard from './AppCard';
import { X, Folder } from 'lucide-react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * URS §4.2: <FolderModal>
 * - Bôi mờ nền phía sau
 * - Hiển thị danh sách các AppCard con có parent_id khớp với folder
 */
interface FolderModalProps {
  folder: PortalApp;
  childApps: PortalApp[];
  onClose: () => void;
}

export default function FolderModal({ folder, childApps, onClose }: FolderModalProps) {
  const router = useRouter();

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleChildClick = (app: PortalApp) => {
    if (app.type === 'link' && app.target_url) {
      router.push(app.target_url);
      onClose();
    }
  };

  return (
    <div
      className="folder-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={`Thư mục: ${folder.app_name}`}
    >
      <div className="folder-modal">
        {/* Modal Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: 'linear-gradient(135deg, #fef9c3, #fef08a)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Folder size={22} color="#92400e" strokeWidth={1.8} />
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 700,
                  color: '#1e293b',
                }}
              >
                {folder.app_name}
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                {childApps.length} ứng dụng
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            id="folder-modal-close"
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: 36,
              height: 36,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 150ms ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#e2e8f0')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#f1f5f9')}
            aria-label="Đóng"
          >
            <X size={18} color="#475569" />
          </button>
        </div>

        {/* Divider */}
        <div
          style={{
            height: 1,
            background: 'linear-gradient(90deg, #ccfbf1, transparent)',
            marginBottom: 24,
          }}
        />

        {/* Child App Grid */}
        {childApps.length > 0 ? (
          <div className="app-grid">
            {childApps.map((app) => (
              <AppCard key={app.app_id} app={app} onClick={handleChildClick} />
            ))}
          </div>
        ) : (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 24px',
              color: '#94a3b8',
            }}
          >
            <Folder size={48} strokeWidth={1} style={{ marginBottom: 12, color: '#cbd5e1' }} />
            <p>Thư mục này chưa có ứng dụng nào.</p>
          </div>
        )}
      </div>
    </div>
  );
}
