'use client';

import { useParams, useRouter } from 'next/navigation';
import PortalLayout from '@/components/PortalLayout';
import { MOCK_CURRENT_USER } from '@/lib/mockData';
import { MOCK_PORTAL_APPS } from '@/lib/mockData';
import { Construction } from 'lucide-react';

/**
 * Catch-all placeholder page cho tất cả /apps/* routes
 * Hiển thị thông tin app được chọn và thông báo "Đang phát triển"
 */
export default function AppPlaceholderPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();

  // Tìm app info từ mock data
  const app = MOCK_PORTAL_APPS.find(
    (a) => a.target_url === `/apps/${slug}`
  );

  return (
    <PortalLayout currentUser={MOCK_CURRENT_USER}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 440,
          gap: 20,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: 24,
            background: 'linear-gradient(135deg, #ccfbf1, rgba(20,184,166,0.2))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8,
          }}
        >
          <Construction size={42} color="#0d9488" strokeWidth={1.5} />
        </div>

        <div>
          <h1 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 800, color: '#1e293b' }}>
            {app?.app_name ?? `Module /apps/${slug}`}
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: '#64748b', maxWidth: 380 }}>
            Module này đang được phát triển trong giai đoạn tiếp theo.
            <br />
            Vui lòng quay lại sau.
          </p>
        </div>

        <button
          onClick={() => router.push('/')}
          style={{
            marginTop: 8,
            padding: '10px 28px',
            background: '#0d9488',
            color: 'white',
            border: 'none',
            borderRadius: 12,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            transition: 'background 150ms ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#0f766e')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#0d9488')}
        >
          ← Quay lại Dashboard
        </button>
      </div>
    </PortalLayout>
  );
}
