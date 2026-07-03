'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PortalLayout from '@/components/PortalLayout';
import { MOCK_CURRENT_USER, MOCK_STAFF_USER, MOCK_VIEWER_USER } from '@/lib/mockData';
import ImportModule from '@/components/ImportModule';
import { Button } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { User } from '@/lib/types';

/**
 * Standalone page for Import Module
 * Route: /apps/import
 */
export default function ImportPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User>(MOCK_CURRENT_USER);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('pilot_selected_role');
      if (stored === 'staff') {
        setCurrentUser(MOCK_STAFF_USER);
      } else if (stored === 'viewer') {
        setCurrentUser(MOCK_VIEWER_USER);
      } else {
        setCurrentUser(MOCK_CURRENT_USER);
      }
    }
  }, []);

  return (
    <PortalLayout currentUser={currentUser} fullWidth>
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
            overflow: 'visible' // Changed from hidden to visible for zoom scroll
          }}
        >
          <ImportModule userId={currentUser.id} userRole={currentUser.system_role} />
        </div>
      </div>
    </PortalLayout>
  );
}
