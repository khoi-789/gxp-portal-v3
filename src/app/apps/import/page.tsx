'use client';

import { useRouter } from 'next/navigation';
import PortalLayout from '@/components/PortalLayout';
import { MOCK_CURRENT_USER } from '@/lib/mockData';
import ImportModule from '@/components/ImportModule';
import { Button } from 'antd';
import { ArrowLeft } from 'lucide-react';

/**
 * Standalone page for Import Module
 * Route: /apps/import
 */
export default function ImportPage() {
  const router = useRouter();

  return (
    <PortalLayout currentUser={MOCK_CURRENT_USER} fullWidth noScroll>
      <div style={{ padding: '0 4px', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Navigation / Header */}
        <div style={{ marginBottom: 8 }}>
          <Button 
            type="text" 
            icon={<ArrowLeft size={14} />} 
            onClick={() => router.push('/')}
            style={{ 
              color: '#64748b', 
              fontWeight: 600,
              padding: '0 4px',
              height: 28,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            Quay lại Dashboard
          </Button>
        </div>

        {/* Module Content */}
        <div
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.8)',
            borderRadius: 16,
            padding: '16px',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.6)',
            boxShadow: '0 4px 24px rgba(13,148,136,0.08)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden' // Important for internal scroll
          }}
        >
          <ImportModule userId={MOCK_CURRENT_USER.id} />
        </div>
      </div>
    </PortalLayout>
  );
}
